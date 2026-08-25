import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { BulkOrderService } from '../../core/commerce/bulk-order.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitHook } from '../../plugins/rate-limit.plugin.js';
import { createMaintenanceHook } from '../../plugins/maintenance.plugin.js';
import { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import {
  CreateBulkSubmissionRequest,
  BulkSubmissionDetailsDto,
  ApiResponse,
  Permission,
  UserRole,
  AgentBulkOrderRequest,
} from '@bytebeacon/shared';

export interface BulkOrderRouteDependencies {
  db: pg.Pool;
  bulkOrderService: BulkOrderService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  rateLimiter: RateLimiterService;
  featureFlagService?: FeatureFlagService;
}

export async function bulkOrderRoutes(
  app: FastifyInstance,
  deps: BulkOrderRouteDependencies,
) {
  const { db, bulkOrderService, tokenService, apiKeyService, rbacService, rateLimiter } = deps;
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const bulkRateLimit = createRateLimitHook(rateLimiter, { limit: 10, windowSeconds: 60 });
  const maintenanceHook = createMaintenanceHook(featureFlagService);

  // 1. CREATE BULK SUBMISSION
  app.post<{ Body: CreateBulkSubmissionRequest }>(
    '/bulk-orders',
    {
      preHandler: [
        bulkRateLimit,
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_CREATE),
        maintenanceHook,
      ],
    },
    async (req: FastifyRequest<{ Body: CreateBulkSubmissionRequest }>, reply: FastifyReply) => {
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

      const submission = await bulkOrderService.createBulkSubmission(
        {
          ...req.body,
          idempotencyKey,
        },
        req.user!.sub,
      );

      const response: ApiResponse<BulkSubmissionDetailsDto> = {
        success: true,
        data: submission,
      };

      return reply.status(202).send(response);
    },
  );

  // 2. GET BULK SUBMISSION BY ID
  app.get<{ Params: { id: string } }>(
    '/bulk-orders/:id',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_READ),
      ],
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const isAdmin =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;

      const submission = await bulkOrderService.getBulkSubmissionById(
        req.params.id,
        req.user!.sub,
        isAdmin,
      );

      const response: ApiResponse<BulkSubmissionDetailsDto> = {
        success: true,
        data: submission,
      };

      return reply.send(response);
    },
  );

  // 3. PLACE AGENT BULK ORDER (JSON API-Key): POST /agent/orders/bulk
  app.post<{ Body: AgentBulkOrderRequest }>(
    '/agent/orders/bulk',
    {
      preHandler: [
        bulkRateLimit,
        authHooks.authenticate,
        authHooks.requirePermission(Permission.ORDERS_CREATE),
        maintenanceHook,
      ],
    },
    async (req: FastifyRequest<{ Body: AgentBulkOrderRequest }>, reply: FastifyReply) => {
      const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
      const isSandbox =
        Boolean((req as any).apiKey?.isSandbox) ||
        Boolean((req.user as any)?.isSandbox) ||
        apiKeyHeader.startsWith('ak_test_');

      const idempotencyKey =
        req.body?.idempotencyKey || (req.headers['idempotency-key'] as string) || '';

      const result = await bulkOrderService.placeAgentBulkOrder({
        agentOrUserId: req.user!.sub,
        isSandbox,
        network: req.body.network,
        recipients: req.body.recipients,
        idempotencyKey,
        confirmedPorted: req.body.confirmedPorted,
        onUnvalidated: req.body.onUnvalidated,
      });

      return reply.status(201).send({
        success: true,
        statusCode: 201,
        message: 'Bulk order placed and queued for processing.',
        data: result,
      });
    },
  );

  // 4. AGENT DASHBOARD FILE UPLOAD (JWT Mirror): POST /me/agent/orders/bulk
  app.post(
    '/me/agent/orders/bulk',
    {
      preHandler: [
        bulkRateLimit,
        authHooks.authenticateCustomer,
        maintenanceHook,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      let network = 'MTN';
      let idempotencyKey = (req.headers['idempotency-key'] as string) || `bulk-${Date.now()}`;
      let confirmedPorted: string[] = [];
      let onUnvalidated: 'set_aside' | 'reject' = 'set_aside';
      let recipients: Array<{ phoneNumber: string; dataSizeGb: number }> = [];

      if (req.isMultipart && req.isMultipart()) {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            const buffer = await part.toBuffer();
            recipients = bulkOrderService.parseXlsxRecipients(buffer);
          } else if (part.type === 'field') {
            if (part.fieldname === 'network') {
              network = String(part.value || 'MTN');
            } else if (part.fieldname === 'idempotencyKey') {
              idempotencyKey = String(part.value || idempotencyKey);
            } else if (part.fieldname === 'onUnvalidated') {
              onUnvalidated = part.value === 'reject' ? 'reject' : 'set_aside';
            } else if (part.fieldname === 'confirmedPorted') {
              try {
                confirmedPorted = typeof part.value === 'string' ? JSON.parse(part.value) : part.value;
              } catch {
                confirmedPorted = [];
              }
            }
          }
        }
      } else {
        const body = (req.body as any) || {};
        network = body.network || network;
        idempotencyKey = body.idempotencyKey || idempotencyKey;
        confirmedPorted = body.confirmedPorted || confirmedPorted;
        onUnvalidated = body.onUnvalidated || onUnvalidated;
        recipients = body.recipients || [];
      }

      if (!recipients || recipients.length === 0) {
        throw new BadRequestError('No valid recipient rows found in upload or body.');
      }

      const result = await bulkOrderService.placeAgentBulkOrder({
        agentOrUserId: req.user!.sub,
        isSandbox: false,
        network,
        recipients,
        idempotencyKey,
        confirmedPorted,
        onUnvalidated,
      });

      return reply.status(201).send({
        success: true,
        statusCode: 201,
        message: 'Bulk order received and queued for processing.',
        data: result,
      });
    },
  );
}

