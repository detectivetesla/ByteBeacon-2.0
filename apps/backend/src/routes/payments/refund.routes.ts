import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type pg from 'pg';
import { RefundService } from '../../core/payments/refund.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitPreHandler } from '../../plugins/rate-limit.plugin.js';
import { Permission, UserRole } from '@bytebeacon/shared';
import { BadRequestError } from '../../core/errors/app-error.js';

const requestRefundSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  paymentId: z.string().optional(),
  amountPesewas: z.number().int().positive().optional(),
  reason: z.string().min(3, 'reason must be at least 3 characters'),
  idempotencyKey: z.string().optional(),
});

export async function refundRoutes(
  app: FastifyInstance,
  deps: {
    db: pg.Pool;
    refundService: RefundService;
    tokenService: TokenService;
    apiKeyService: ApiKeyService;
    rbacService: RbacService;
    rateLimiter: RateLimiterService;
  },
) {
  const authHooks = createAuthHooks(deps.tokenService, deps.apiKeyService, deps.rbacService, deps.db);
  const refundRateLimit = createRateLimitPreHandler(deps.rateLimiter, 'REFUNDS');

  app.post(
    '/refunds/request',
    {
      preHandler: [
        authHooks.authenticate,
        authHooks.requirePermission(Permission.ORDERS_REFUND),
        refundRateLimit,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = requestRefundSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Invalid refund request payload',
          parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            code: e.code,
            message: e.message,
          })),
        );
      }

      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || parsed.data.idempotencyKey;

      const result = await deps.refundService.requestRefund(
        { ...parsed.data, idempotencyKey },
        {
          userId: req.user!.sub,
          role: req.user!.role as UserRole,
          correlationId: req.id,
          actorType: req.apiKey ? 'API_KEY' : 'USER',
        },
      );

      reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  app.get(
    '/refunds/:id',
    {
      preHandler: [authHooks.authenticate],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const result = await deps.refundService.getRefundDetails(
        id,
        req.user!.sub,
        req.user!.role as UserRole,
      );

      reply.send({
        success: true,
        data: result,
      });
    },
  );
}
