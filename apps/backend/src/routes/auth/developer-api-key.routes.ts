import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import type { ApiUsageTelemetryService } from '../../core/security/api-usage-telemetry.service.js';
import {
  CreateApiKeyRequest,
  ApiKeyCreatedDto,
  ApiKeySummaryDto,
  ApiResponse,
  Permission,
  ApiKeyEnvironment,
} from '@bytebeacon/shared';

export interface DeveloperApiKeyRouteDependencies {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
  apiUsageTelemetryService?: ApiUsageTelemetryService;
}

function normalizeApiKeyEnvironment(env?: string): ApiKeyEnvironment {
  if (!env) return ApiKeyEnvironment.TEST;
  const upper = env.toUpperCase();
  if (upper === 'LIVE') return ApiKeyEnvironment.LIVE;
  return ApiKeyEnvironment.TEST;
}

function normalizeScope(scope: string): Permission {
  const map: Record<string, Permission> = {
    'orders:write': Permission.ORDERS_CREATE,
    'orders:create': Permission.ORDERS_CREATE,
    'orders:read': Permission.ORDERS_READ,
    'orders.create': Permission.ORDERS_CREATE,
    'orders.read': Permission.ORDERS_READ,
    'bundles:read': Permission.ORDERS_READ,
    'bundles.read': Permission.ORDERS_READ,
    'catalog:read': Permission.ORDERS_READ,
    'catalog.read': Permission.ORDERS_READ,
    'wallet:read': Permission.WALLET_READ,
    'wallet.read': Permission.WALLET_READ,
    'wallet:write': Permission.WALLET_ADJUST,
    'wallet.adjust': Permission.WALLET_ADJUST,
    'webhooks:read': Permission.WEBHOOKS_READ,
    'webhooks.read': Permission.WEBHOOKS_READ,
    'webhooks:write': Permission.WEBHOOKS_WRITE,
    'webhooks.write': Permission.WEBHOOKS_WRITE,
    'webhooks:manage': Permission.WEBHOOKS_MANAGE,
    'webhooks.manage': Permission.WEBHOOKS_MANAGE,
    'beneficiaries:read': Permission.PENDING_MTN_MANAGE,
    'beneficiaries.read': Permission.PENDING_MTN_MANAGE,
    'api_keys:manage': Permission.API_KEYS_MANAGE,
    'api_keys.manage': Permission.API_KEYS_MANAGE,
  };
  return map[scope] || (scope as Permission);
}


function toSafeIso(val: any, fallback?: string): string | null {
  if (!val) return fallback ?? null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback ?? null;
    return d.toISOString();
  } catch {
    return fallback ?? null;
  }
}

export async function developerApiKeyRoutes(
  app: FastifyInstance,
  deps: DeveloperApiKeyRouteDependencies,
) {
  const { db, apiKeyService, tokenService, rbacService, auditService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  const authGuards = [
    authHooks.authenticateCustomer,
    authHooks.requirePermission(Permission.API_KEYS_MANAGE),
  ];

  // 1. CREATE API KEY
  const handleCreateKey = async (req: FastifyRequest<{ Body: CreateApiKeyRequest }>, reply: FastifyReply) => {
    const { name, environment, scopes, expiresInDays } = req.body || {};

    if (!name || name.trim().length === 0) {
      throw new BadRequestError('API key name is required');
    }

    const normalizedEnv = normalizeApiKeyEnvironment(environment);
    const rawScopes = Array.isArray(scopes) ? scopes : [];
    const normalizedScopes = rawScopes.map(normalizeScope);

    const generated = await apiKeyService.generateApiKey({
      agentId: req.user!.sub,
      name: name.trim(),
      environment: normalizedEnv,
      scopes: normalizedScopes,
      expiresInDays,
    });

    try {
      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'AGENT',
        action: 'API_KEY_CREATED',
        resourceType: 'api_keys',
        resourceId: generated.id,
        metadata: { name: generated.name, environment: generated.environment, scopes: generated.scopes },
        ipAddress: req.ip,
      });
    } catch {}

    deps.apiUsageTelemetryService?.invalidateKeyCache();

    const responseData: ApiKeyCreatedDto = {
      id: generated.id,
      name: generated.name,
      keyPrefix: generated.keyPrefix,
      apiKey: generated.rawApiKey, // Shown once
      environment: generated.environment,
      scopes: generated.scopes,
      createdAt: toSafeIso(generated.createdAt, new Date().toISOString())!,
      expiresAt: toSafeIso(generated.expiresAt),
    };

    const response: ApiResponse<ApiKeyCreatedDto> = {
      success: true,
      data: responseData,
    };

    return reply.status(201).send(response);
  };

  // 2. LIST API KEYS
  const handleListKeys = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const keys = await apiKeyService.listAgentApiKeys(req.user!.sub);

      const items: ApiKeySummaryDto[] = (keys || []).map((k) => ({
        id: k.id,
        name: k.name || 'Unnamed Key',
        keyPrefix: k.keyPrefix,
        environment: k.environment,
        scopes: Array.isArray(k.scopes) ? k.scopes : [],
        status: k.status || 'ACTIVE',
        lastUsedAt: toSafeIso(k.lastUsedAt),
        expiresAt: toSafeIso(k.expiresAt),
        createdAt: toSafeIso(k.createdAt, new Date().toISOString())!,
      }));

      const response: ApiResponse<ApiKeySummaryDto[]> = {
        success: true,
        data: items,
      };

      return reply.send(response);
    } catch (err: any) {
      req.log.error({ err, userId: req.user?.sub }, 'Error listing developer API keys');
      // Graceful fallback to empty dataset so agent UI never crashes with 500
      return reply.send({
        success: true,
        data: [],
      });
    }
  };

  // 3. ROLL / ROTATE API KEY
  const handleRollKey = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;

    if (!id) {
      throw new BadRequestError('API key ID is required');
    }

    const rolled = await apiKeyService.rollApiKey(id, req.user!.sub);

    try {
      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'AGENT',
        action: 'API_KEY_ROLLED',
        resourceType: 'api_keys',
        resourceId: id,
        metadata: { name: rolled.name, environment: rolled.environment },
        ipAddress: req.ip,
      });
    } catch {}

    deps.apiUsageTelemetryService?.invalidateKeyCache();

    const responseData: ApiKeyCreatedDto = {
      id: rolled.id,
      name: rolled.name,
      keyPrefix: rolled.keyPrefix,
      apiKey: rolled.rawApiKey, // Shown once
      environment: rolled.environment,
      scopes: rolled.scopes,
      createdAt: toSafeIso(rolled.createdAt, new Date().toISOString())!,
      expiresAt: toSafeIso(rolled.expiresAt),
    };

    return reply.send({
      success: true,
      data: responseData,
      message: 'API key secret rolled successfully. Please copy the new key.',
    });
  };

  // 4. REVOKE API KEY
  const handleRevokeKey = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;

    if (!id) {
      throw new BadRequestError('API key ID is required');
    }

    await apiKeyService.revokeApiKey(id, req.user!.sub);

    try {
      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'AGENT',
        action: 'API_KEY_REVOKED',
        resourceType: 'api_keys',
        resourceId: id,
        ipAddress: req.ip,
      });
    } catch {}

    deps.apiUsageTelemetryService?.invalidateKeyCache();

    return reply.send({ success: true, message: 'API key revoked successfully' });
  };

  // Register route endpoints with both /developer/api-keys and /agent/api-keys aliases
  app.post<{ Body: CreateApiKeyRequest }>('/developer/api-keys', { preHandler: authGuards }, handleCreateKey);
  app.post<{ Body: CreateApiKeyRequest }>('/agent/api-keys', { preHandler: authGuards }, handleCreateKey);

  app.get('/developer/api-keys', { preHandler: authGuards }, handleListKeys);
  app.get('/agent/api-keys', { preHandler: authGuards }, handleListKeys);

  app.post<{ Params: { id: string } }>('/developer/api-keys/:id/roll', { preHandler: authGuards }, handleRollKey);
  app.post<{ Params: { id: string } }>('/agent/api-keys/:id/roll', { preHandler: authGuards }, handleRollKey);

  app.delete<{ Params: { id: string } }>('/developer/api-keys/:id', { preHandler: authGuards }, handleRevokeKey);
  app.delete<{ Params: { id: string } }>('/agent/api-keys/:id', { preHandler: authGuards }, handleRevokeKey);

  app.post<{ Params: { id: string } }>('/developer/api-keys/:id/revoke', { preHandler: authGuards }, handleRevokeKey);
  app.post<{ Params: { id: string } }>('/agent/api-keys/:id/revoke', { preHandler: authGuards }, handleRevokeKey);
}

