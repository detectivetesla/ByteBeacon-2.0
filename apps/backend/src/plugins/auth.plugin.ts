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

export function createAuthHooks(
  tokenService: TokenService,
  apiKeyService: ApiKeyService,
  rbacService: RbacService,
  db: pg.Pool,
  featureFlagService?: FeatureFlagService,
) {
  const authenticateCustomer = async (req: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Customer authorization token missing');
    }

    const token = authHeader.substring(7).trim();
    const payload = tokenService.verifyAccessToken(token);

    // Verify user is active in database
    const userRes = await db.query<any>(
      'SELECT * FROM users WHERE id = $1',
      [payload.sub],
    );

    if (userRes.rows.length === 0) {
      throw new UnauthorizedError('User account not found');
    }

    const rawUser = userRes.rows[0];
    const userStatus = rawUser.status || (rawUser.is_active === false ? UserStatus.SUSPENDED : UserStatus.ACTIVE);
    if (userStatus === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Contact support.');
    }

    req.user = { ...payload, status: userStatus };

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
      let rawKey = req.headers['x-api-key'] as string;

      if (!rawKey && req.headers.authorization?.startsWith('Bearer ak_')) {
        rawKey = req.headers.authorization.substring(7).trim();
      }

      if (!rawKey) {
        throw new UnauthorizedError('API key missing from request headers');
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
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
        return authenticateApiKey()(req, reply);
      } else {
        return authenticateCustomer(req, reply);
      }
    }

    const scope = reqOrScope as Permission | undefined;
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (apiKeyHeader || authHeader?.startsWith('Bearer ak_')) {
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
