import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type pg from 'pg';
import { PaymentService } from '../../core/payments/payment.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitPreHandler } from '../../plugins/rate-limit.plugin.js';
import { PaymentMethod, PaymentChannel, UserRole } from '@bytebeacon/shared';
import { BadRequestError } from '../../core/errors/app-error.js';

const initializePaymentSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  channel: z.nativeEnum(PaymentChannel).optional(),
  email: z.string().email().optional(),
  callbackUrl: z.string().url().optional(),
  idempotencyKey: z.string().optional(),
});

export async function paymentRoutes(
  app: FastifyInstance,
  deps: {
    db: pg.Pool;
    paymentService: PaymentService;
    tokenService: TokenService;
    apiKeyService: ApiKeyService;
    rbacService: RbacService;
    rateLimiter: RateLimiterService;
  },
) {
  const authHooks = createAuthHooks(deps.tokenService, deps.apiKeyService, deps.rbacService, deps.db);
  const paymentRateLimit = createRateLimitPreHandler(deps.rateLimiter, 'PAYMENTS');

  app.post(
    '/payments/initialize',
    {
      preHandler: [authHooks.authenticate, paymentRateLimit],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = initializePaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Invalid payment initialization payload',
          parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            code: e.code,
            message: e.message,
          })),
        );
      }

      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || parsed.data.idempotencyKey;

      const result = await deps.paymentService.initializePayment(
        { ...parsed.data, idempotencyKey },
        {
          userId: req.user!.sub,
          userEmail: req.user!.email,
          role: req.user!.role as UserRole,
          correlationId: req.id,
          actorType: req.apiKey ? 'API_KEY' : 'USER',
          ipAddress: req.ip,
        },
      );

      reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  app.get(
    '/payments/:id',
    {
      preHandler: [authHooks.authenticate],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const result = await deps.paymentService.getPaymentDetails(
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
