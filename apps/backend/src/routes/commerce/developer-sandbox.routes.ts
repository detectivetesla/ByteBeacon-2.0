import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import { ApiKeyEnvironment, Permission, NetworkProvider, OrderStatus } from '@bytebeacon/shared';

export interface DeveloperSandboxRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
}

export async function developerSandboxRoutes(
  app: FastifyInstance,
  deps: DeveloperSandboxRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper: Resolve agent ID for logged-in user
  async function resolveAgentId(userId: string): Promise<string> {
    const res = await db.query('SELECT id FROM agents WHERE user_id = $1', [userId]);
    if (res.rows.length === 0) {
      // Create lightweight agent profile if missing
      const insert = await db.query(
        `INSERT INTO agents (user_id, business_name, tier) VALUES ($1, 'Developer Account', 'STANDARD') RETURNING id`,
        [userId],
      );
      return insert.rows[0].id;
    }
    return res.rows[0].id;
  }

  // 1. LIST API KEYS (/developer/keys)
  app.get(
    '/developer/keys',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const agentId = await resolveAgentId(req.user!.sub);
      const keys = await apiKeyService.listAgentApiKeys(agentId);

      return reply.send({
        success: true,
        data: keys,
      });
    },
  );

  // 2. CREATE API KEY (/developer/keys)
  app.post<{
    Body: {
      name: string;
      environment: 'LIVE' | 'SANDBOX';
      scopes?: Permission[];
      expiresInDays?: number;
    };
  }>(
    '/developer/keys',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { name, environment = 'SANDBOX', scopes, expiresInDays } = req.body || {};

      if (!name || name.trim().length === 0) {
        throw new BadRequestError('API key name is required');
      }

      const agentId = await resolveAgentId(req.user!.sub);
      const env = environment === 'LIVE' ? ApiKeyEnvironment.LIVE : ApiKeyEnvironment.TEST;
      const defaultScopes: Permission[] = scopes && scopes.length > 0 ? scopes : [Permission.ORDERS_CREATE, Permission.ORDERS_READ];

      const generated = await apiKeyService.generateApiKey({
        agentId,
        name: name.trim(),
        environment: env,
        scopes: defaultScopes,
        expiresInDays,
      });

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'AGENT',
          action: 'API_KEY_CREATED',
          resourceType: 'api_keys',
          resourceId: generated.id,
          metadata: { name: generated.name, environment: generated.environment },
        });
      }

      return reply.status(201).send({
        success: true,
        data: generated,
        message: 'API key created. Please store your secret key securely; it will not be shown again.',
      });
    },
  );

  // 3. REVOKE API KEY (/developer/keys/:id)
  app.delete<{ Params: { id: string } }>(
    '/developer/keys/:id',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const agentId = await resolveAgentId(req.user!.sub);
      await apiKeyService.revokeApiKey(req.params.id, agentId);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'AGENT',
          action: 'API_KEY_REVOKED',
          resourceType: 'api_keys',
          resourceId: req.params.id,
        });
      }

      return reply.send({
        success: true,
        message: 'API key successfully revoked.',
      });
    },
  );

  // 4. DEVELOPER SANDBOX: SIMULATE TELECOM FULFILLMENT (/developer/sandbox/simulate-fulfillment)
  app.post<{
    Body: {
      recipientPhone: string;
      network: NetworkProvider;
      dataAmountMb: number;
      simulateStatus?: 'COMPLETED' | 'FAILED' | 'DELAYED';
    };
  }>(
    '/developer/sandbox/simulate-fulfillment',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { recipientPhone, network, dataAmountMb, simulateStatus = 'COMPLETED' } = req.body || {};

      if (!recipientPhone || !network || !dataAmountMb) {
        throw new BadRequestError('recipientPhone, network, and dataAmountMb are required');
      }

      const mockOrderId = `ord_sbx_${Date.now()}`;
      const mockProviderRef = `dh_sbx_${Math.floor(100000 + Math.random() * 900000)}`;

      let resultingStatus: OrderStatus = OrderStatus.COMPLETED;
      let failureReason: string | undefined;

      if (simulateStatus === 'FAILED') {
        resultingStatus = OrderStatus.FAILED;
        failureReason = 'SIMULATED_CARRIER_REJECTION: Insufficient balance or inactive subscriber';
      } else if (simulateStatus === 'DELAYED') {
        resultingStatus = OrderStatus.PROCESSING;
      }

      return reply.send({
        success: true,
        data: {
          orderId: mockOrderId,
          providerReference: mockProviderRef,
          network,
          recipientPhone,
          dataAmountMb,
          orderStatus: resultingStatus,
          isSandbox: true,
          simulatedAt: new Date().toISOString(),
          failureReason,
          message: 'Sandbox telecom fulfillment simulation executed successfully.',
        },
      });
    },
  );
}
