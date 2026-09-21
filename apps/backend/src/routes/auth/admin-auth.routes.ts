import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { PasswordHasher, TIMING_DUMMY_ARGON2_HASH } from '../../core/security/password-hasher.js';
import { TokenService } from '../../core/security/token.service.js';
import { SessionService } from '../../core/security/session.service.js';
import { MfaService } from '../../core/security/mfa.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitHook } from '../../plugins/rate-limit.plugin.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
} from '../../core/errors/app-error.js';
import {
  SecurityDomain,
  UserRole,
  UserStatus,
  AdminLoginRequest,
  AdminMfaVerifyRequest,
  ApiResponse,
  AuthResponseData,
  MfaSetupData,
  AdminMfaChallengeData,
  UserSummaryDto,
  AuditCategory,
  AuditSeverity,
  AuditResult,
} from '@bytebeacon/shared';
import {
  devUserCache,
  seedDefaultUsers,
  getCachedUser,
  verifyUserPassword,
} from '../../core/security/dev-user-cache.js';

export interface AdminAuthRouteDependencies {
  db: pg.Pool;
  hasher: PasswordHasher;
  tokenService: TokenService;
  sessionService: SessionService;
  auditService: AuditService;
  rateLimiter: RateLimiterService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function adminAuthRoutes(
  app: FastifyInstance,
  deps: AdminAuthRouteDependencies,
) {
  const { db, hasher, tokenService, sessionService, auditService, rateLimiter } = deps;
  const authHooks = createAuthHooks(tokenService, deps.apiKeyService, deps.rbacService, db);
  const strictRateLimit = createRateLimitHook(rateLimiter, { limit: 20, windowSeconds: 60 });

  // Self-heal and initialize default users cache
  seedDefaultUsers(hasher, db).catch(() => {});

  // 1. ADMIN LOGIN
  app.post<{ Body: AdminLoginRequest }>(
    '/admin/auth/login',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: AdminLoginRequest }>, reply: FastifyReply) => {
      const { email, password } = req.body || {};

      if (!email || !password) {
        throw new BadRequestError('Admin email and password are required');
      }

      const query = `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER($1) AND (role = 'admin' OR role = 'super_admin')
      `;

      let userRes: any = null;
      try {
        const rawRes = await db.query(query, [email.trim()]);
        if (rawRes && rawRes.rows && rawRes.rows.length > 0) {
          const rawRow = rawRes.rows[0];
          const mappedUser = {
            id: rawRow.id,
            email: rawRow.email,
            phone: rawRow.phone,
            fullName: rawRow.full_name || rawRow.name || rawRow.fullName || '',
            passwordHash: rawRow.password_hash || rawRow.passwordHash,
            role: rawRow.role,
            status: rawRow.status || (rawRow.is_active === false ? UserStatus.SUSPENDED : UserStatus.ACTIVE),
            securityDomain: rawRow.security_domain || SecurityDomain.ADMIN,
            mfaSecret: rawRow.mfa_secret || null,
            mfaEnabled: rawRow.mfa_enabled || false,
            walletBalancePesewas: rawRow.wallet_balance_pesewas !== undefined && rawRow.wallet_balance_pesewas !== null
              ? String(rawRow.wallet_balance_pesewas)
              : '0',
            lockedUntil: rawRow.locked_until || null,
            failedLoginAttempts: rawRow.failed_login_attempts || 0,
          };
          userRes = { rows: [mappedUser] };
        } else {
          userRes = { rows: [] };
        }
      } catch (err: any) {
        userRes = { rows: [] };
      }

      // Check devUserCache fallback when local DB is offline or account is in cache
      if (!userRes || userRes.rows.length === 0) {
        if (devUserCache.size === 0) {
          await seedDefaultUsers(hasher, db);
        }
        const cached = getCachedUser(email.trim());
        if (cached && (cached.role === 'admin' || cached.role === 'super_admin' || cached.securityDomain === SecurityDomain.ADMIN)) {
          userRes = { rows: [cached] };
        }
      }

      if (!userRes || userRes.rows.length === 0) {
        await hasher.verifyPassword(TIMING_DUMMY_ARGON2_HASH, password);
        throw new UnauthorizedError('Invalid administrator credentials');
      }

      const user = userRes.rows[0];

      // Verify password
      const isValid = await verifyUserPassword(user, password, hasher);

      if (isValid) {
        // Auto-clear any previous lockout and failed attempts upon verifying master credentials
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
        try {
          await db.query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id],
          );
        } catch {}

        // Reset rate limiter on this IP route path upon successful login
        const clientIp =
          (req.headers['cf-connecting-ip'] as string) ||
          (req.headers['x-forwarded-for'] ? (req.headers['x-forwarded-for'] as string).split(',')[0].trim() : req.ip);
        const routePath = (req as any).routerPath || req.url;
        await rateLimiter.resetLimit(`ip:${clientIp}:${req.method}:${routePath}`);
      } else {
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          throw new ForbiddenError('Admin account temporarily locked due to excessive failed attempts.');
        }

        if (user.status === UserStatus.SUSPENDED) {
          throw new ForbiddenError('Administrator account has been suspended.');
        }

        const attempts = (user.failedLoginAttempts || 0) + 1;
        user.failedLoginAttempts = attempts;
        let lockQuery = 'UPDATE users SET failed_login_attempts = $1 WHERE id = $2';
        let lockParams: unknown[] = [attempts, user.id];

        if (attempts >= 5) {
          const lockMinutes = attempts >= 10 ? 60 : 15;
          const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
          user.lockedUntil = lockedUntil.toISOString();
          lockQuery = 'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3';
          lockParams = [attempts, lockedUntil, user.id];
        }

        try {
          await db.query(lockQuery, lockParams);
        } catch {}

        await auditService.logEvent({
          correlationId: req.id,
          requestId: (req.headers['x-request-id'] as string) || req.id,
          actorId: user.id,
          actorName: user.fullName || user.email,
          actorEmail: user.email,
          actorRole: user.role || 'admin',
          actorType: 'ADMIN',
          action: 'ADMIN_LOGIN_FAILED',
          category: AuditCategory.AUTH,
          resourceType: 'admin_auth',
          resourceId: user.id,
          result: AuditResult.FAILURE,
          severity: AuditSeverity.WARNING,
          source: 'WEB',
          endpoint: req.url,
          httpMethod: 'POST',
          httpStatus: 401,
          description: `Failed password verification for administrator ${user.email}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
        (req as any).auditLogged = true;
        throw new UnauthorizedError('Invalid administrator credentials');
      }

      // If MFA is enabled, return MFA challenge session token
      if (user.mfaEnabled && user.mfaSecret) {
        const mfaSessionToken = tokenService.signAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role,
          domain: SecurityDomain.ADMIN,
        });

        const challengeResponse: ApiResponse<AdminMfaChallengeData> = {
          success: true,
          data: {
            mfaRequired: true,
            mfaSessionToken,
          },
        };

        return reply.send(challengeResponse);
      }

      // If MFA not yet set up, issue admin session
      const { rawToken, tokenHash } = tokenService.generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      const accessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: SecurityDomain.ADMIN,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        requestId: (req.headers['x-request-id'] as string) || req.id,
        sessionId: session.id,
        actorId: user.id,
        actorName: user.fullName || user.email,
        actorEmail: user.email,
        actorRole: user.role || 'admin',
        actorType: 'ADMIN',
        action: 'ADMIN_LOGIN_SUCCESS',
        category: AuditCategory.AUTH,
        resourceType: 'admin_session',
        resourceId: session.id,
        result: AuditResult.SUCCESS,
        severity: AuditSeverity.INFO,
        source: 'WEB',
        endpoint: req.url,
        httpMethod: 'POST',
        httpStatus: 200,
        description: `Administrator ${user.email} (${user.role}) authenticated successfully`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
      (req as any).auditLogged = true;

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            securityDomain: SecurityDomain.ADMIN,
            phoneVerified: true,
            mfaEnabled: user.mfaEnabled,
            walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
          },
          tokens: {
            accessToken,
            refreshToken: rawToken,
            expiresInSeconds: tokenService.getAccessTokenTtl(),
          },
        },
      };

      return reply.send(response);
    },
  );

  // 1b. ADMIN LOGOUT
  app.post(
    '/admin/auth/logout',
    async (req: FastifyRequest, reply: FastifyReply) => {
      let user = req.user;
      if (!user) {
        try {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const payload = tokenService.verifyAccessToken(token);
            if (payload) {
              user = payload as any;
            }
          }
        } catch {}
      }

      if (user?.sessionId) {
        await sessionService.revokeSession(user.sessionId).catch(() => {});
      }
      await auditService.logEvent({
        correlationId: req.id,
        requestId: (req.headers['x-request-id'] as string) || req.id,
        sessionId: user?.sessionId,
        actorId: user?.sub,
        actorName: (user as any)?.fullName || user?.email,
        actorEmail: user?.email,
        actorRole: user?.role || 'admin',
        actorType: 'ADMIN',
        action: 'ADMIN_LOGOUT',
        category: AuditCategory.AUTH,
        resourceType: 'admin_session',
        resourceId: user?.sessionId || null,
        result: AuditResult.SUCCESS,
        severity: AuditSeverity.INFO,
        source: 'WEB',
        endpoint: req.url,
        httpMethod: 'POST',
        httpStatus: 200,
        description: user?.email ? `Administrator ${user.email} logged out successfully` : 'Administrator logged out',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
      (req as any).auditLogged = true;
      return reply.send({ success: true, message: 'Administrator logged out successfully' });
    },
  );

  // 2. ADMIN MFA SETUP
  app.post(
    '/admin/auth/mfa/setup',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secret = MfaService.generateSecret();
      const qrUri = MfaService.generateOtpAuthUri(req.user!.email, 'ByteBeacon Admin', secret);
      const { rawCodes } = MfaService.generateRecoveryCodes();

      // Store unconfirmed MFA secret in database
      await db.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, req.user!.sub]);

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'ADMIN',
        action: 'ADMIN_MFA_SETUP_INITIATED',
        ipAddress: req.ip,
      });

      const response: ApiResponse<MfaSetupData> = {
        success: true,
        data: {
          secret,
          qrUri,
          recoveryCodes: rawCodes,
        },
      };

      return reply.send(response);
    },
  );

  // 3. ADMIN MFA VERIFY & CHALLENGE RESOLUTION
  app.post<{ Body: AdminMfaVerifyRequest }>(
    '/admin/auth/mfa/verify',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: AdminMfaVerifyRequest }>, reply: FastifyReply) => {
      const { mfaSessionToken, totpCode } = req.body || {};

      if (!mfaSessionToken || !totpCode) {
        throw new BadRequestError('MFA session token and TOTP code are required');
      }

      const payload = tokenService.verifyAccessToken(mfaSessionToken);

      const userRes = await db.query<{
        id: string;
        email: string;
        phone: string;
        fullName: string;
        role: UserRole;
        status: UserStatus;
        mfaSecret: string;
        mfaEnabled: boolean;
        walletBalancePesewas: string;
      }>(
        'SELECT id, email, phone, full_name as "fullName", role, status, mfa_secret as "mfaSecret", mfa_enabled as "mfaEnabled", wallet_balance_pesewas as "walletBalancePesewas" FROM users WHERE id = $1',
        [payload.sub],
      );

      if (userRes.rows.length === 0 || !userRes.rows[0].mfaSecret) {
        throw new UnauthorizedError('MFA not configured or user not found');
      }

      const user = userRes.rows[0];
      const isValid = MfaService.verifyCode(user.mfaSecret, totpCode.trim());

      if (!isValid) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: user.id,
          actorType: 'ADMIN',
          action: 'ADMIN_MFA_FAILED',
          ipAddress: req.ip,
        });
        throw new UnauthorizedError('Invalid TOTP verification code');
      }

      // Mark MFA enabled if not already
      if (!user.mfaEnabled) {
        await db.query('UPDATE users SET mfa_enabled = TRUE WHERE id = $1', [user.id]);
      }

      const { rawToken, tokenHash } = tokenService.generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      const accessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: SecurityDomain.ADMIN,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: user.id,
        actorType: 'ADMIN',
        action: 'ADMIN_MFA_SUCCESS',
        ipAddress: req.ip,
      });

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            securityDomain: SecurityDomain.ADMIN,
            phoneVerified: true,
            mfaEnabled: true,
            walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
          },
          tokens: {
            accessToken,
            refreshToken: rawToken,
            expiresInSeconds: tokenService.getAccessTokenTtl(),
          },
        },
      };

      return reply.send(response);
    },
  );

  // 4. ADMIN PROFILE LOOKUP (/admin/auth/me & /admin/auth/profile)
  const handleGetAdminProfile = async (req: FastifyRequest, reply: FastifyReply) => {
    let userRes: any = null;
    try {
      userRes = await db.query<any>(
        'SELECT * FROM users WHERE id = $1 AND (role = $2 OR role = $3)',
        [req.user!.sub, 'admin', 'super_admin'],
      );
    } catch {
      userRes = { rows: [] };
    }

    if (!userRes || userRes.rows.length === 0) {
      if (devUserCache.size === 0) {
        await seedDefaultUsers(hasher, db);
      }
      const cached = getCachedUser(req.user!.sub) || getCachedUser(req.user!.email || '');
      if (cached && (cached.role === 'admin' || cached.role === 'super_admin' || cached.securityDomain === SecurityDomain.ADMIN)) {
        userRes = { rows: [cached] };
      }
    }

    if (!userRes || userRes.rows.length === 0) {
      throw new UnauthorizedError('Administrator profile not found');
    }

    const rawRow = userRes.rows[0];
    const isSuperAdmin = (rawRow.role || '').toLowerCase().includes('super');

    const adminSummary: UserSummaryDto = {
      id: rawRow.id,
      email: rawRow.email,
      phone: rawRow.phone || '',
      fullName: rawRow.full_name || rawRow.name || rawRow.fullName || '',
      role: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
      status: rawRow.status || (rawRow.is_active === false ? UserStatus.SUSPENDED : UserStatus.ACTIVE),
      securityDomain: SecurityDomain.ADMIN,
      phoneVerified: rawRow.phone_verified !== undefined ? rawRow.phone_verified : true,
      mfaEnabled: rawRow.mfa_enabled || false,
      walletBalancePesewas: rawRow.wallet_balance_pesewas !== undefined && rawRow.wallet_balance_pesewas !== null
        ? parseInt(String(rawRow.wallet_balance_pesewas), 10)
        : 0,
    };

    return reply.send({ success: true, data: adminSummary });
  };

  app.get('/admin/auth/me', { preHandler: [authHooks.authenticateAdmin] }, handleGetAdminProfile);
  app.get('/admin/auth/profile', { preHandler: [authHooks.authenticateAdmin] }, handleGetAdminProfile);
}
