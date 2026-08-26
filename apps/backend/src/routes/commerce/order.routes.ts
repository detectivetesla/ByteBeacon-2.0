import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { OrderService } from '../../core/commerce/order.service.js';
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
  CreateOrderRequest,
  ApiResponse,
  OrderDetailsDto,
  OrderSummaryDto,
  PaginatedResponse,
  Permission,
  UserRole,
} from '@bytebeacon/shared';

export interface OrderRouteDependencies {
  db: pg.Pool;
  orderService: OrderService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  rateLimiter: RateLimiterService;
  featureFlagService?: FeatureFlagService;
}

export async function orderRoutes(
  app: FastifyInstance,
  deps: OrderRouteDependencies,
) {
  const { db, orderService, tokenService, apiKeyService, rbacService, rateLimiter } = deps;
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const orderRateLimit = createRateLimitHook(rateLimiter, { limit: 120, windowSeconds: 60 });
  const maintenanceHook = createMaintenanceHook(featureFlagService);

  // 1. CREATE ORDER (Returns 202 Accepted)
  app.post<{ Body: CreateOrderRequest }>(
    '/orders',
    {
      preHandler: [
        orderRateLimit,
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_CREATE),
        maintenanceHook,
      ],
    },
    async (req: FastifyRequest<{ Body: CreateOrderRequest }>, reply: FastifyReply) => {
      const rawBody = (req.body || {}) as any;

      const productId =
        rawBody.productId ||
        rawBody.product_id ||
        rawBody.bundleId ||
        rawBody.bundle_id ||
        rawBody.planId ||
        rawBody.plan_id ||
        rawBody.packageId ||
        rawBody.package_id;

      const rawPhone =
        rawBody.recipientPhone ??
        rawBody.recipient_phone ??
        rawBody.phone ??
        rawBody.phoneNumber ??
        rawBody.phone_number ??
        rawBody.msisdn ??
        rawBody.recipient;

      const recipientPhone =
        rawPhone !== undefined && rawPhone !== null ? String(rawPhone).trim() : '';

      const agentId = rawBody.agentId || rawBody.agent_id;
      const paymentMethod = rawBody.paymentMethod || rawBody.payment_method;

      if (!productId || !recipientPhone) {
        throw new BadRequestError('Product ID and recipient phone are required');
      }

      // Check Idempotency-Key header or body field
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        rawBody.idempotencyKey ||
        rawBody.idempotency_key;

      const actorType =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN
          ? 'ADMIN'
          : req.user!.role === UserRole.AGENT
            ? 'AGENT'
            : 'CUSTOMER';

      const { order, isIdempotentReplay } = await orderService.createOrder(
        {
          productId,
          recipientPhone,
          idempotencyKey,
          agentId,
          paymentMethod,
        },
        {
          userId: req.user!.sub,
          correlationId: req.id,
          actorType,
          agentId,
          ipAddress: req.ip,
        },
      );

      if (isIdempotentReplay) {
        reply.header('Idempotency-Replay', 'true');
      }

      const response: ApiResponse<OrderDetailsDto> = {
        success: true,
        data: order,
      };

      return reply.status(202).send(response);
    },
  );

  // 2. GET ORDER BY ID
  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_READ),
      ],
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const isAdmin =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;

      const order = await orderService.getOrderById(req.params.id, req.user!.sub, isAdmin);

      const response: ApiResponse<OrderDetailsDto> = {
        success: true,
        data: order,
      };

      return reply.send(response);
    },
  );

  // 3. GET PUBLIC CUSTOMER-SAFE ORDER (Provider Anonymity Guaranteed)
  const handlePublicOrder = async (
    req: FastifyRequest<{ Params: { reference: string } }>,
    reply: FastifyReply,
  ) => {
    const order = await orderService.getPublicOrder(req.params.reference);
    if (!order) {
      throw new BadRequestError(`Order '${req.params.reference}' not found`);
    }

    return reply.send({
      success: true,
      data: order,
    });
  };

  app.get<{ Params: { reference: string } }>(
    '/public/orders/:reference',
    {
      preHandler: [orderRateLimit],
    },
    handlePublicOrder,
  );

  app.get<{ Params: { reference: string } }>(
    '/orders/track/:reference',
    {
      preHandler: [orderRateLimit],
    },
    handlePublicOrder,
  );


  // 3. LIST ORDERS (Paginated with tenant isolation)
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/orders',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_READ),
      ],
    },
    async (
      req: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>,
      reply: FastifyReply,
    ) => {
      const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : 1;
      const limit = req.query.limit
        ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10)))
        : 20;

      const isAdmin =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;

      const result = await orderService.listOrders(req.user!.sub, isAdmin, page, limit);

      const response: ApiResponse<PaginatedResponse<OrderSummaryDto>> = {
        success: true,
        data: result,
      };

      return reply.send(response);
    },
  );

  // 4. CANCEL ORDER
  app.post<{ Params: { id: string } }>(
    '/orders/:id/cancel',
    {
      preHandler: [authHooks.authenticateCustomer],
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const isAdmin =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;

      const updated = await orderService.cancelOrder(
        req.params.id,
        req.user!.sub,
        req.id,
        isAdmin,
      );

      const response: ApiResponse<OrderDetailsDto> = {
        success: true,
        data: updated,
      };

      return reply.send(response);
    },
  );
}
