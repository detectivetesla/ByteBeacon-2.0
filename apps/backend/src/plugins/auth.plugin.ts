import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenService, JwtPayload } from '../core/security/token.service.js';
import { ApiKeyService, ValidatedApiKeyResult } from '../core/security/api-key.service.js';
import { RbacService } from '../core/security/rbac.service.js';
import { SecurityDomain, UserRole, Permission, UserStatus } from '@bytebeacon/shared';
import { UnauthorizedError, ForbiddenError, AppError } from '../core/errors/app-error.js';
import type { FeatureFlagService } from '../infrastructure/features/feature-flag.service.js';
import type pg from 'pg';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload & { status?: UserStatus };
    apiKey?: ValidatedApiKeyResult;
    correlationId: string;
  }
}

export function extractApiKeyFromRequest(req: FastifyRequest): string | null {
  const h = req.headers;
  const directKey =
    (h['x-api-key'] as string | undefined) ||
    (h['x-api-token'] as string | undefined) ||
    (h['apikey'] as string | undefined) ||
    (h['api-key'] as string | undefined);

  if (directKey && typeof directKey === 'string' && directKey.trim().length > 0) {
    return directKey.trim();
  }

  const auth = req.headers.authorization;
  if (auth && typeof auth === 'string') {
    const trimmedAuth = auth.trim();
    if (trimmedAuth.startsWith('Bearer ak_')) {
      return trimmedAuth.substring(7).trim();
    }
    if (
      trimmedAuth.startsWith('Bearer ') &&
      (trimmedAuth.substring(7).trim().startsWith('ak_live_') ||
        trimmedAuth.substring(7).trim().startsWith('ak_test_'))
    ) {
      return trimmedAuth.substring(7).trim();
    }
    if (trimmedAuth.toLowerCase().startsWith('apikey ')) {
      return trimmedAuth.substring(7).trim();
    }
    if (trimmedAuth.startsWith('ak_live_') || trimmedAuth.startsWith('ak_test_')) {
      return trimmedAuth;
    }
  }

  const query = req.query as any;
  if (query) {
    const qKey = query.api_key || query.apiKey;
    if (typeof qKey === 'string' && (qKey.startsWith('ak_live_') || qKey.startsWith('ak_test_'))) {
      return qKey.trim();
    }
  }

  return null;
}

export function createAuthHooks(
  tokenService: TokenService,
  apiKeyService: ApiKeyService,
  rbacService: RbacService,
  db: pg.Pool,
  featureFlagService?: FeatureFlagService,
) {
  const authenticateCustomer = async (req: FastifyRequest, _reply: FastifyReply) => {
    const apiKey = extractApiKeyFromRequest(req);

    // If an API key is provided, authenticate via API key service
    if (apiKey) {
      await authenticateApiKey()(req, _reply);
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Customer authorization token missing');
    }

    const token = authHeader.substring(7).trim();
    const payload = tokenService.verifyAccessToken(token);

    // Verify user is active in database
    let userRes: { rows: any[] } = { rows: [] };
    try {
      userRes = await db.query<any>(
        'SELECT * FROM users WHERE id = $1',
        [payload.sub],
      );
    } catch (dbErr: any) {
      // In development or during temporary database reconnection, trust cryptographically verified admin tokens
      if (payload.role === UserRole.ADMIN || payload.role === UserRole.SUPER_ADMIN) {
        req.user = { ...payload, status: UserStatus.ACTIVE };
        return;
      }
      throw dbErr;
    }

    if (userRes.rows.length === 0) {
      // Allow valid signed admin tokens if user record is not yet seeded
      if (payload.role === UserRole.ADMIN || payload.role === UserRole.SUPER_ADMIN) {
        req.user = { ...payload, status: UserStatus.ACTIVE };
        return;
      }
      throw new UnauthorizedError('User account not found');
    }

    const rawUser = userRes.rows[0];
    const userStatus = rawUser.status || (rawUser.is_active === false ? UserStatus.SUSPENDED : UserStatus.ACTIVE);
    if (userStatus === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Contact support.');
    }

    // Determine authoritative role and security domain from database status & agent registry
    const rawRoleStr = (rawUser.role || payload.role || '').toString().toLowerCase().trim();
    let authoritativeRole: UserRole = UserRole.CUSTOMER;
    let authoritativeDomain: SecurityDomain = payload.domain || SecurityDomain.CUSTOMER;

    if (rawRoleStr === 'admin') {
      authoritativeRole = UserRole.ADMIN;
      authoritativeDomain = SecurityDomain.ADMIN;
    } else if (rawRoleStr === 'super_admin' || rawRoleStr === 'superadmin') {
      authoritativeRole = UserRole.SUPER_ADMIN;
      authoritativeDomain = SecurityDomain.ADMIN;
    } else if (rawRoleStr === 'agent' || rawRoleStr === 'superagent' || rawRoleStr === 'super_agent') {
      authoritativeRole = UserRole.AGENT;
      authoritativeDomain = SecurityDomain.AGENT;
    } else {
      // Check if user is registered in agents table
      try {
        const agentCheck = await db.query('SELECT id FROM agents WHERE user_id = $1 LIMIT 1', [rawUser.id]);
        if (agentCheck.rows.length > 0) {
          authoritativeRole = UserRole.AGENT;
          authoritativeDomain = SecurityDomain.AGENT;
        }
      } catch {}
    }

    req.user = {
      ...payload,
      role: authoritativeRole,
      domain: authoritativeDomain,
      status: userStatus,
    };

    // Enforce maintenance mode blackout for non-administrative users
    if (
      featureFlagService &&
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      const isMaint = await featureFlagService.isMaintenanceModeActive();
      if (isMaint) {
        throw new AppError(
          'Platform is currently undergoing scheduled maintenance. Portal access is temporarily restricted.',
          503,
          'MAINTENANCE_MODE_ACTIVE',
        );
      }
    }
  };

  const authenticateAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    await authenticateCustomer(req, _reply);

    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN)) {
      throw new ForbiddenError('Administrator privileges required');
    }

    if (req.user.domain !== SecurityDomain.ADMIN) {
      throw new ForbiddenError('Invalid security domain for administrative access');
    }
  };

  const authenticateApiKey = (requiredScope?: Permission) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      const rawKey = extractApiKeyFromRequest(req);

      if (!rawKey) {
        throw new UnauthorizedError('API key missing from request headers or query');
      }

      const validatedKey = await apiKeyService.validateApiKey(rawKey, requiredScope);
      req.apiKey = validatedKey;
      const now = Math.floor(Date.now() / 1000);
      req.user = {
        sub: validatedKey.agentId,
        email: `${validatedKey.name}@bytebeacon.agent`,
        role: UserRole.AGENT,
        domain: SecurityDomain.AGENT,
        iat: now,
        exp: now + 86400,
      };
    };
  };

  function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  function authenticate(requiredScope?: Permission): (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  function authenticate(
    reqOrScope?: FastifyRequest | Permission,
    maybeReply?: FastifyReply,
  ): Promise<void> | ((req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
    if (reqOrScope && typeof reqOrScope === 'object' && 'headers' in reqOrScope && maybeReply) {
      const req = reqOrScope as FastifyRequest;
      const reply = maybeReply;
      const apiKey = extractApiKeyFromRequest(req);

      if (apiKey) {
        return authenticateApiKey()(req, reply);
      } else {
        return authenticateCustomer(req, reply);
      }
    }

    const scope = reqOrScope as Permission | undefined;
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = extractApiKeyFromRequest(req);

      if (apiKey) {
        await authenticateApiKey(scope)(req, reply);
      } else {
        await authenticateCustomer(req, reply);
      }
    };
  }

  const requirePermission = (permission: Permission) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // If request was authenticated via API key, permission checks are already enforced by apiKeyService
      if (req.apiKey) {
        return;
      }

      // Special case: API_KEYS_MANAGE is granted to all Agents, Admins, or any account linked to an agent profile
      if (permission === Permission.API_KEYS_MANAGE) {
        if (
          req.user.role === UserRole.AGENT ||
          req.user.role === UserRole.ADMIN ||
          req.user.role === UserRole.SUPER_ADMIN
        ) {
          return;
        }
        try {
          const agentCheck = await db.query('SELECT id FROM agents WHERE user_id = $1 LIMIT 1', [req.user.sub]);
          if (agentCheck.rows.length > 0) {
            req.user.role = UserRole.AGENT;
            return;
          }
        } catch {}
      }

      const hasPerm = await rbacService.hasPermission(req.user.role, permission);
      if (!hasPerm) {
        throw new ForbiddenError(`Insufficient permission: ${permission}`);
      }
    };
  };

  return {
    authenticate,
    authenticateCustomer,
    authenticateAdmin,
    authenticateApiKey,
    requirePermission,
  };
}
