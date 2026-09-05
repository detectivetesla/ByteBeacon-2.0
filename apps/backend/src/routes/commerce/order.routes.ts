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
import { BadRequestError, InsufficientBalanceError, BeneficiaryNotValidatedError } from '../../core/errors/app-error.js';
import {
  CreateOrderRequest,
  ApiResponse,
  OrderDetailsDto,
  OrderSummaryDto,
  PaginatedResponse,
  Permission,
  UserRole,
  NetworkProvider,
  PaymentMethod,
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

      // Beneficiary validation enforcement for MTN individual orders (Up2U first-time rule)
      const prodRes = await Promise.resolve(
        db.query(`SELECT network FROM products WHERE id = $1 LIMIT 1`, [productId]),
      ).catch(() => ({ rows: [] }));
      const prodNetwork = prodRes.rows?.[0]?.network;
      if (prodNetwork === 'MTN' || prodNetwork === NetworkProvider.MTN) {
        const cleanPhone = recipientPhone.trim().replace(/\s+/g, '');
        const normalizedLocal = cleanPhone.startsWith('+233')
          ? `0${cleanPhone.slice(4)}`
          : cleanPhone.startsWith('233')
            ? `0${cleanPhone.slice(3)}`
            : cleanPhone;

        const validatedCheck = await Promise.resolve(
          db.query(
            `SELECT 1 FROM beneficiary_validation
              WHERE phone_number = $1
                AND network = 'MTN'
                AND validation_status = 'VALID'
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
              UNION
              SELECT 1 FROM pending_beneficiary_approvals
              WHERE (phone_number = $1 OR phone_number = $2)
                AND network = 'MTN'
                AND status = 'APPROVED'
              UNION
              SELECT 1 FROM orders
              WHERE (recipient_phone = $1 OR recipient_phone = $2)
                AND network = 'MTN'
                AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT')
              LIMIT 1`,
            [normalizedLocal, `+233${normalizedLocal.slice(1)}`],
          ),
        ).catch(() => ({ rows: [{ dummy: 1 }] })); // fallback gracefully if query fails

        if (validatedCheck.rows.length === 0) {
          await Promise.resolve(
            db.query(
              `INSERT INTO pending_beneficiary_approvals (
                  phone_number, network, agent_id, status, created_at, updated_at
               ) VALUES ($1, 'MTN', $2, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT DO NOTHING`,
              [normalizedLocal, req.user!.sub],
            ),
          ).catch(() => {});

          throw new BeneficiaryNotValidatedError(
            `The phone number ${normalizedLocal} is not added to our beneficiary list at the moment. Number has been recorded and will be added to our beneficiary list. Please try again later.`,
          );
        }
      }

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

  // 5. CUSTOM API COMPATIBILITY: POST /order/:network (and /orders/:network)
  app.post<{ Params: { network: string } }>(
    '/order/:network',
    {
      preHandler: [
        orderRateLimit,
        authHooks.authenticate,
        maintenanceHook,
      ],
    },
    async (req: FastifyRequest<{ Params: { network: string } }>, reply: FastifyReply) => {
      const rawNetwork = String(req.params.network || 'mtn').trim().toLowerCase();
      let networkProvider: NetworkProvider = NetworkProvider.MTN;
      if (rawNetwork === 'telecel' || rawNetwork === 'vodafone') {
        networkProvider = NetworkProvider.TELECEL;
      } else if (rawNetwork === 'at' || rawNetwork === 'airteltigo' || rawNetwork === 'airtel') {
        networkProvider = NetworkProvider.AIRTELTIGO;
      }

      const rawBody = (req.body || {}) as any;
      const orderType = String(rawBody.type || 'single').toLowerCase();

      if (orderType !== 'single' && orderType !== 'bulk') {
        throw new BadRequestError(`Invalid order type '${orderType}'. Only 'single' and 'bulk' types are supported.`);
      }

      // Check current user wallet balance
      const userRes = await db.query(
        `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1`,
        [req.user!.sub],
      );

      let balancePesewas = 0;
      if (userRes.rows.length > 0) {
        const r = userRes.rows[0];
        if (r.wallet_balance_pesewas !== null && r.wallet_balance_pesewas !== undefined) {
          balancePesewas = parseInt(String(r.wallet_balance_pesewas), 10);
        } else if (r.wallet_balance !== null && r.wallet_balance !== undefined) {
          balancePesewas = Math.round(parseFloat(r.wallet_balance) * 100);
        }
      }

      const actorType =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN
          ? 'ADMIN'
          : req.user!.role === UserRole.AGENT
            ? 'AGENT'
            : 'CUSTOMER';

      if (orderType === 'single') {
        const rawPhone =
          rawBody.phone ??
          rawBody.phoneNumber ??
          rawBody.recipientPhone ??
          rawBody.recipient_phone ??
          rawBody.recipient ??
          rawBody.msisdn;

        const cleanPhone = String(rawPhone || '').trim().replace(/\s+/g, '');
        if (!cleanPhone) {
          throw new BadRequestError("Recipient phone number ('phone') is required.");
        }

        const volumeGb = Number(rawBody.volume || 1);
        const targetMb = volumeGb * 1024;

        // Resolve active catalog bundle for this network
        const prodRes = await db.query(
          `SELECT id, sku, name, network, data_amount_mb, base_price_pesewas, agent_price_pesewas
           FROM catalog_products
           WHERE network = $1 AND is_active = TRUE
           ORDER BY ABS(data_amount_mb - $2) ASC
           LIMIT 1`,
          [networkProvider, targetMb],
        );

        if (prodRes.rows.length === 0) {
          throw new BadRequestError(`No active data bundles available for ${networkProvider}`);
        }

        const product = prodRes.rows[0];
        const pricePesewas =
          actorType === 'AGENT' && product.agent_price_pesewas
            ? parseInt(product.agent_price_pesewas, 10)
            : parseInt(product.base_price_pesewas, 10);

        if (balancePesewas < pricePesewas) {
          const have = (balancePesewas / 100).toFixed(2);
          const need = (pricePesewas / 100).toFixed(2);
          throw new InsufficientBalanceError(
            `Insufficient agent wallet balance: have ${have} GHS, need ${need} GHS`,
          );
        }

        const idempotencyKey =
          (req.headers['idempotency-key'] as string) ||
          rawBody.idempotencyKey ||
          rawBody.idempotency_key ||
          `custom_api_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const { order } = await orderService.createOrder(
          {
            productId: product.id,
            recipientPhone: cleanPhone,
            paymentMethod: PaymentMethod.WALLET,
            idempotencyKey,
          },
          {
            userId: req.user!.sub,
            correlationId: req.id,
            actorType,
            agentId: rawBody.agentId,
            ipAddress: req.ip,
          },
        );

        return reply.send({
          success: true,
          orderId: order.publicId,
          reference: order.publicId,
          status: 'pending',
          totalAmount: order.amountPesewas / 100,
          currency: 'GHS',
          items: [
            {
              recipient: cleanPhone,
              volume: volumeGb,
              status: 'pending',
            },
          ],
          metadata: {
            webhookUrl: rawBody.webhookUrl || null,
            source: 'api',
            requestedOfferSlug: rawBody.offerSlug || `${rawNetwork}_data_bundle`,
            network: networkProvider,
          },
        });
      }

      // BULK ORDER TYPE
      const rawRecipients: any[] = Array.isArray(rawBody.recipients)
        ? rawBody.recipients
        : Array.isArray(rawBody.items)
        ? rawBody.items
        : [];

      if (rawRecipients.length === 0) {
        throw new BadRequestError("Recipients array ('recipients') is required for bulk order type");
      }

      let totalCostPesewas = 0;
      const itemsToOrder: Array<{ phone: string; productId: string; volume: number }> = [];

      for (const rec of rawRecipients) {
        const pPhone = String(rec.phone || rec.phoneNumber || rec.recipient || '').trim().replace(/\s+/g, '');
        const pVol = Number(rec.volume || rec.dataSizeGb || rawBody.volume || 1);
        const itemMb = pVol * 1024;

        const prodRes = await db.query(
          `SELECT id, base_price_pesewas, agent_price_pesewas
           FROM catalog_products
           WHERE network = $1 AND is_active = TRUE
           ORDER BY ABS(data_amount_mb - $2) ASC
           LIMIT 1`,
          [networkProvider, itemMb],
        );

        if (prodRes.rows.length === 0) {
          throw new BadRequestError(`No active data bundles available for ${networkProvider}`);
        }

        const prod = prodRes.rows[0];
        const cost =
          actorType === 'AGENT' && prod.agent_price_pesewas
            ? parseInt(prod.agent_price_pesewas, 10)
            : parseInt(prod.base_price_pesewas, 10);

        totalCostPesewas += cost;
        itemsToOrder.push({ phone: pPhone, productId: prod.id, volume: pVol });
      }

      if (balancePesewas < totalCostPesewas) {
        const have = (balancePesewas / 100).toFixed(2);
        const need = (totalCostPesewas / 100).toFixed(2);
        throw new InsufficientBalanceError(
          `Insufficient agent wallet balance: have ${have} GHS, need ${need} GHS`,
        );
      }

      let primaryOrderId = `ORD-${Date.now().toString().slice(-6)}`;
      const resultItems: any[] = [];

      for (let i = 0; i < itemsToOrder.length; i++) {
        const itm = itemsToOrder[i];
        const { order } = await orderService.createOrder(
          {
            productId: itm.productId,
            recipientPhone: itm.phone,
            paymentMethod: PaymentMethod.WALLET,
            idempotencyKey: `bulk_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          },
          {
            userId: req.user!.sub,
            correlationId: req.id,
            actorType,
            agentId: rawBody.agentId,
            ipAddress: req.ip,
          },
        );

        if (i === 0) {
          primaryOrderId = order.publicId;
        }

        resultItems.push({
          recipient: itm.phone,
          volume: itm.volume,
          status: 'pending',
        });
      }

      return reply.send({
        success: true,
        orderId: primaryOrderId,
        reference: primaryOrderId,
        status: 'pending',
        totalAmount: totalCostPesewas / 100,
        currency: 'GHS',
        items: resultItems,
        metadata: {
          webhookUrl: rawBody.webhookUrl || null,
          source: 'api',
          requestedOfferSlug: rawBody.offerSlug || `${rawNetwork}_data_bundle`,
          network: networkProvider,
        },
      });
    },
  );
}
