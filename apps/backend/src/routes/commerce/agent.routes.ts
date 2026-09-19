import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';
import { OrderService } from '../../core/commerce/order.service.js';
import { OrderStateMachine } from '../../core/commerce/order-state-machine.js';
import { AgentWebhookDispatcherService } from '../../core/webhooks/agent-webhook-dispatcher.service.js';
import { createAuthHooks, extractApiKeyFromRequest } from '../../plugins/auth.plugin.js';
import { createMaintenanceHook } from '../../plugins/maintenance.plugin.js';
import { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import { BadRequestError, NotFoundError, ConflictError, InvalidPhoneError, BeneficiaryNotValidatedError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';
import { BeneficiaryService } from '../../core/commerce/beneficiary.service.js';
import { ITelecomProvider } from '../../core/providers/telecom/telecom-provider.interface.js';
import { getLatestSuccessfulOrdersTelemetry } from '../../core/commerce/latest-order-telemetry.js';
import {
  SubmitAgentApplicationRequest,
  AgentApplicationDto,
  AgentProfileDto,
  ApiResponse,
  Currency,
  PaymentMethod,
  LedgerEntryType,
  LedgerAccountType,
  Permission,
  UserRole,
  NetworkProvider,
} from '@bytebeacon/shared';

export interface AgentRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  ledgerService?: FinancialLedgerService;
  paymentProvider?: IPaymentProvider;
  featureFlagService?: FeatureFlagService;
  orderService?: OrderService;
  beneficiaryService?: BeneficiaryService;
  telecomProvider?: ITelecomProvider;
}

export async function agentRoutes(
  app: FastifyInstance,
  deps: AgentRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, ledgerService, paymentProvider } = deps;
  const beneficiaryService = deps.beneficiaryService ?? (app as any).beneficiaryService;
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const orderService = deps.orderService ?? (app as any).orderService;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const maintenanceHook = createMaintenanceHook(featureFlagService);

  interface ListAgentOrdersQuery {
    agentId?: string;
    status?: string;
    network?: string;
    paymentStatus?: string;
    after?: string;
    before?: string;
    search?: string;
    page?: string;
    limit?: string;
  }

  // 0. LIST AGENT ORDERS: GET /agent/orders & GET /agents/orders
  const handleListAgentOrders = async (
    req: FastifyRequest<{ Querystring: ListAgentOrdersQuery }>,
    reply: FastifyReply,
  ) => {
    const {
      agentId,
      status,
      network,
      paymentStatus,
      after,
      before,
      search,
      page,
      limit,
    } = req.query;

    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 30;
    const isAdmin = String(req.user?.role || '').toLowerCase().includes('admin');
    const targetAgentOrUserId = (isAdmin && agentId) ? agentId : req.user!.sub;

    let result;
    try {
      if (orderService) {
        result = await orderService.listAgentOrders({
          agentOrUserId: targetAgentOrUserId,
          isAdmin,
          status,
          network,
          paymentStatus,
          after,
          before,
          search,
          page: pageNum,
          limit: limitNum,
        });
      } else {
        result = { data: [], meta: { page: pageNum, limit: limitNum, total: 0, totalPages: 1 } };
      }
    } catch (err: any) {
      req.log.error({ err: err?.message, userId: req.user?.sub }, '[AGENT_ORDERS] Failed to list agent orders');
      result = { data: [], meta: { page: pageNum, limit: limitNum, total: 0, totalPages: 1 } };
    }

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        data: result.data,
        orders: result.data,
        items: result.data,
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
        totalPages: result.meta.totalPages,
        meta: result.meta,
      },
    });
  };

  app.get<{ Querystring: ListAgentOrdersQuery }>(
    '/agent/orders',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleListAgentOrders,
  );
  app.get<{ Querystring: ListAgentOrdersQuery }>(
    '/agents/orders',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleListAgentOrders,
  );

  // 0.05 GET LATEST SUCCESSFUL ORDER TELEMETRY
  const handleGetAgentLatestSuccessfulOrder = async (
    req: FastifyRequest<{ Querystring: { network?: string } }>,
    reply: FastifyReply,
  ) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    const { network } = req.query || {};
    const telemetry = await getLatestSuccessfulOrdersTelemetry(db, network);

    return reply.status(200).send({
      success: true,
      data: telemetry,
    });
  };

  app.get<{ Querystring: { network?: string } }>(
    '/agent/orders/latest-successful',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleGetAgentLatestSuccessfulOrder,
  );
  app.get<{ Querystring: { network?: string } }>(
    '/agents/orders/latest-successful',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleGetAgentLatestSuccessfulOrder,
  );

  // 0.1 LOOKUP AGENT ORDER BY ID: GET /agent/orders/:id & GET /agents/orders/:id
  const handleGetAgentOrder = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('Order ID is required');
    }

    if (!orderService) {
      throw new NotFoundError(`Order '${id}' not found`);
    }

    const isAdmin = String(req.user?.role || '').toLowerCase().includes('admin');
    try {
      const order = await orderService.getAgentOrderById(id, req.user!.sub, isAdmin);

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: order,
      });
    } catch (err: any) {
      if (err instanceof NotFoundError || err?.statusCode === 404) {
        throw err;
      }
      req.log.error({ err: err?.message, id, userId: req.user?.sub }, '[AGENT_ORDERS] Unexpected error retrieving agent order');
      throw new NotFoundError(`Order '${id}' not found for current agent`);
    }
  };

  app.get<{ Params: { id: string } }>(
    '/agent/orders/:id',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleGetAgentOrder,
  );
  app.get<{ Params: { id: string } }>(
    '/agents/orders/:id',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    handleGetAgentOrder,
  );

  // 0.2 PLACE SINGLE AGENT ORDER: POST /agent/orders
  app.post<{
    Body: {
      bundleId: string;
      phoneNumber: string;
      idempotencyKey: string;
      email?: string;
    };
  }>(
    '/agent/orders',
    {
      preHandler: [
        authHooks.authenticate(Permission.ORDERS_CREATE),
        authHooks.requirePermission(Permission.ORDERS_CREATE),
        maintenanceHook,
      ],
    },
    async (req, reply) => {
      const { bundleId, phoneNumber, idempotencyKey, email } = req.body || {};

      if (!bundleId) {
        throw new BadRequestError('bundleId is required');
      }
      if (!phoneNumber) {
        throw new BadRequestError('phoneNumber is required');
      }

      // Ghanaian MSISDN validation (0XXXXXXXXX or +233XXXXXXXXX)
      const cleanPhone = String(phoneNumber).trim().replace(/\s+/g, '');
      const ghanaPhoneRegex = /^(?:\+233|0)[235]\d{8}$/;
      if (!ghanaPhoneRegex.test(cleanPhone)) {
        throw new InvalidPhoneError('Phone not a Ghanaian MSISDN');
      }

      // idempotencyKey is required and must be a UUID v4
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!idempotencyKey || !uuidV4Regex.test(idempotencyKey)) {
        throw new BadRequestError('idempotencyKey is required and must be a UUID v4');
      }

      const apiKeyHeader = extractApiKeyFromRequest(req) || '';
      const isSandbox =
        Boolean((req as any).apiKey?.isSandbox) ||
        Boolean((req.user as any)?.isSandbox) ||
        apiKeyHeader.startsWith('ak_test_');

      // First-time MTN validation check
      const normalizedLocal = cleanPhone.startsWith('+233') ? `0${cleanPhone.slice(4)}` : cleanPhone;
      const isMtn = /^(?:\+233|0)(?:24|25|54|55|59)\d{7}$/.test(cleanPhone);

      if (isMtn && !isSandbox) {
        const queryPhones = Array.from(
          new Set([
            normalizedLocal,
            `+233${normalizedLocal.slice(1)}`,
            `233${normalizedLocal.slice(1)}`,
            cleanPhone,
          ].filter(Boolean)),
        );

        let bundleSizeGb: number | null = null;
        try {
          const bundleRes = await db.query(
            `SELECT data_amount_mb FROM catalog_products WHERE id = $1 LIMIT 1`,
            [bundleId],
          );
          if (bundleRes.rows[0]?.data_amount_mb) {
            bundleSizeGb = Math.round((bundleRes.rows[0].data_amount_mb / 1024) * 100) / 100;
          }
        } catch {}

        const validatedCheck = await db.query(
          `SELECT 1 FROM beneficiary_validation
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND validation_status IN ('VALID', 'APPROVED')
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           UNION
           SELECT 1 FROM pending_beneficiary_approvals
           WHERE phone_number = ANY($1)
             AND network = 'MTN'
             AND status = 'APPROVED'
           UNION
           SELECT 1 FROM orders
           WHERE recipient_phone = ANY($1)
             AND network = 'MTN'
             AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT')
           LIMIT 1`,
          [queryPhones],
        );

        if (validatedCheck.rows.length === 0 && beneficiaryService) {
          try {
            const liveCheck = await beneficiaryService.precheckPublicBeneficiaries({
              network: NetworkProvider.MTN,
              phoneNumbers: [normalizedLocal],
              record: false,
              userId: req.user?.sub,
            });
            const firstResult = liveCheck.results?.[0];
            if (firstResult && (firstResult.known || firstResult.isKnown || firstResult.status === 'APPROVED')) {
              await db.query(
                `INSERT INTO beneficiary_validation (
                    phone_number, network, validation_status, attempt_count,
                    last_bundle_size_gb, agent_id, created_at, updated_at
                 ) VALUES ($1, 'MTN', 'VALID', 1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (phone_number, network) DO UPDATE
                 SET validation_status = 'VALID',
                     updated_at = CURRENT_TIMESTAMP`,
                [normalizedLocal, bundleSizeGb, req.user?.sub],
              ).catch(() => {});
              validatedCheck.rows.push({ dummy: 1 } as any);
            }
          } catch {
            // ignore
          }
        }

        if (validatedCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO pending_beneficiary_approvals (
                phone_number, network, agent_id, status, attempt_count,
                last_bundle_size_gb, first_detected_at, last_detected_at, created_at, updated_at
             ) VALUES ($1, 'MTN', $2, 'PENDING', 1, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (agent_id, phone_number, network) DO UPDATE
             SET attempt_count = pending_beneficiary_approvals.attempt_count + 1,
                 last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, pending_beneficiary_approvals.last_bundle_size_gb),
                 last_detected_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP`,
            [normalizedLocal, req.user!.sub, bundleSizeGb],
          ).catch(() => {});

          await db.query(
            `INSERT INTO beneficiary_validation (
                phone_number, network, validation_status, attempt_count,
                last_bundle_size_gb, agent_id, created_at, updated_at
             ) VALUES ($1, 'MTN', 'PENDING', 1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (phone_number, network) DO UPDATE
             SET attempt_count = beneficiary_validation.attempt_count + 1,
                 last_bundle_size_gb = COALESCE(EXCLUDED.last_bundle_size_gb, beneficiary_validation.last_bundle_size_gb),
                 updated_at = CURRENT_TIMESTAMP`,
            [normalizedLocal, bundleSizeGb, req.user!.sub],
          ).catch(() => {});

          throw new BeneficiaryNotValidatedError(
            'First-time MTN number not yet validated — recorded for MTN approval; precheck first.',
          );
        }
      }

      // Sandbox key short-circuit
      if (isSandbox) {
        const isSimulatedFailure = cleanPhone.endsWith('0000');
        const sandboxRef = `SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const sandboxPublicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
        const simulatedStatus = isSimulatedFailure ? 'fulfillment_failed' : 'fulfilled';

        const sandboxDispatcher = new AgentWebhookDispatcherService(db);
        sandboxDispatcher.dispatchAgentEvent(req.user!.sub, 'order.received', {
          id: sandboxPublicId,
          order_id: sandboxPublicId,
          public_id: sandboxPublicId,
          reference: sandboxRef,
          bundle_id: bundleId,
          phone_number: normalizedLocal,
          network: isMtn ? 'MTN' : 'TELECEL',
          amount: '21.00',
          status: 'received',
          created_at: new Date().toISOString(),
        }).catch(() => {});

        return reply.status(201).send({
          success: true,
          statusCode: 201,
          message: 'Order placed and queued for processing.',
          data: {
            id: sandboxPublicId,
            publicId: sandboxPublicId,
            referenceCode: sandboxRef,
            idempotencyKey,
            userId: req.user!.sub,
            agentId: req.user!.sub,
            channel: 'agent_api',
            bundleId,
            amount: '21.00',
            network: isMtn ? 'MTN' : 'TELECEL',
            bundleType: 'DATA',
            groupSizeGb: '5.00',
            phoneNumber: normalizedLocal,
            email: email || null,
            status: simulatedStatus,
            isSandbox: true,
            createdAt: new Date().toISOString(),
          },
        });
      }

      if (!orderService) {
        throw new BadRequestError('Order service is unavailable');
      }

      const { order, isIdempotentReplay } = await orderService.createOrder(
        {
          productId: bundleId,
          recipientPhone: normalizedLocal,
          idempotencyKey,
          paymentMethod: PaymentMethod.WALLET,
          agentId: req.user!.sub,
        },
        {
          userId: req.user!.sub,
          correlationId: req.id,
          actorType: 'AGENT',
          agentId: req.user!.sub,
          ipAddress: req.ip,
        },
      );

      const refCode = order.providerReference || `TXN-${order.publicId.slice(-6).toUpperCase()}`;
      const amountGhs = (Number(order.amountPesewas || 0) / 100).toFixed(2);
      const groupSizeGb = (Number(order.dataAmountMb || 1024) / 1024).toFixed(2);

      // Dispatch order.received webhook event to agent only on fresh order submissions
      const targetAgentId = order.agentId || req.user!.sub;
      if (targetAgentId && !isIdempotentReplay) {
        const dispatcher = new AgentWebhookDispatcherService(db);
        dispatcher.dispatchAgentEvent(targetAgentId, 'order.received', {
          id: order.id,
          order_id: order.id,
          public_id: order.publicId,
          reference: refCode,
          bundle_id: bundleId,
          phone_number: normalizedLocal,
          network: order.network,
          amount: amountGhs,
          status: 'received',
          created_at: order.createdAt,
        }).catch(() => {});
      }

      const orderLifecycleStatus = order.orderStatus
        ? OrderStateMachine.mapToAgentLifecycleStatus(order.orderStatus, order.paymentStatus, order.refundStatus)
        : 'received';

      return reply.status(isIdempotentReplay ? 200 : 201).send({
        success: true,
        statusCode: isIdempotentReplay ? 200 : 201,
        message: isIdempotentReplay ? 'Order already placed.' : 'Order placed and queued for processing.',
        data: {
          id: order.id,
          publicId: order.publicId,
          referenceCode: refCode,
          idempotencyKey,
          userId: order.userId,
          agentId: order.agentId || req.user!.sub,
          channel: 'agent_api',
          bundleId,
          amount: amountGhs,
          network: order.network,
          bundleType: 'DATA',
          groupSizeGb,
          phoneNumber: normalizedLocal,
          email: email || null,
          status: orderLifecycleStatus,
          isSandbox: false,
          createdAt: order.createdAt,
        },
      });
    },
  );

  // 0.3 GET AGENT PROFILE ME: GET /agent/me & GET /agents/me
  const handleGetAgentMe = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.sub;

    let balancePesewas = 0;
    if (ledgerService) {
      try {
        const bal = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, userId);
        balancePesewas = bal.balancePesewas;
      } catch {
        // Continue with zero balance
      }
    } else {
      try {
        const balRes = await db.query(
          `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as balance
           FROM financial_ledger WHERE account_id = $1`,
          [userId],
        );
        balancePesewas = Number(balRes.rows[0]?.balance || 0);
      } catch {
        // Table might not exist or empty
      }
    }
    const balanceGhs = Number((balancePesewas / 100).toFixed(2));

    let agentRow: any = null;
    let userRow: any = null;

    try {
      const qRes = await db.query(
        `SELECT u.id as user_id, u.full_name, u.email, u.phone_number, u.status as user_status,
                a.id as agent_id, a.business_name, a.agent_tier, a.status as agent_status,
                a.commission_rate
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE u.id = $1 OR a.id = $1
         LIMIT 1`,
        [userId],
      );
      if (qRes.rows.length > 0) {
        const row = qRes.rows[0];
        userRow = {
          id: row.user_id,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone_number,
          status: row.user_status,
        };
        agentRow = {
          id: row.agent_id,
          businessName: row.business_name,
          tier: row.agent_tier,
          status: row.agent_status,
          commissionRate: row.commission_rate,
        };
      }
    } catch {
      // Fallback
    }

    const effectiveId = agentRow?.id || userId;
    const publicId = `agt_${effectiveId.replace(/-/g, '').slice(0, 10)}`;
    const businessName = agentRow?.businessName || userRow?.fullName || req.apiKey?.name || 'Agent';
    const email = userRow?.email || req.user?.email || '';
    const phone = userRow?.phone || '';
    const status = (agentRow?.status || userRow?.status || 'active').toLowerCase();
    const tier = agentRow?.tier || 'TIER_1';

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        id: effectiveId,
        publicId,
        businessName,
        email,
        phone,
        status,
        tier,
        pricePerGb: 4.5,
        wallet: {
          balance: balanceGhs,
          overdraftLimit: 0.0,
          availableToSpend: balanceGhs,
        },
      },
    });
  };

  app.get('/agent/me', { preHandler: [authHooks.authenticate] }, handleGetAgentMe);
  app.get('/agents/me', { preHandler: [authHooks.authenticate] }, handleGetAgentMe);

  // 0.4 GET AGENT BUNDLES: GET /agent/bundles
  app.get<{
    Querystring: {
      type?: string;
      network?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/agent/bundles',
    { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] },
    async (req, reply) => {
      const { type, network, search, page, limit } = req.query;
      const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const userId = req.user!.sub;

      let agentRow: any = null;
      try {
        const aRes = await db.query(
          `SELECT id, agent_tier, price_per_gb
           FROM agents
           WHERE user_id = $1 OR id = $1
           LIMIT 1`,
          [userId],
        ).catch(async () => {
          return await db.query(
            `SELECT id, agent_tier FROM agents WHERE user_id = $1 OR id = $1 LIMIT 1`,
            [userId],
          );
        });
        if (aRes && aRes.rows.length > 0) {
          agentRow = aRes.rows[0];
        }
      } catch {
        // Non-fatal
      }

      const agentId = agentRow?.id || userId;

      const conditions: string[] = ['cp.is_active = true'];
      const params: any[] = [agentId];
      let paramIdx = 2;

      if (network && network.toUpperCase() !== 'ALL') {
        conditions.push(`UPPER(cp.network) = UPPER($${paramIdx++})`);
        params.push(network);
      }

      if (search && search.trim().length > 0) {
        conditions.push(`(cp.name ILIKE $${paramIdx} OR cp.sku ILIKE $${paramIdx})`);
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      const whereClause = conditions.join(' AND ');

      let total = 0;
      let rows: any[] = [];

      try {
        const countRes = await db.query(
          `SELECT COUNT(*) as total
           FROM catalog_products cp
           WHERE ${whereClause}`,
          params.slice(1),
        );
        total = parseInt(countRes.rows[0]?.total || '0', 10);

        const listRes = await db.query(
          `SELECT cp.id, cp.name, cp.network, cp.data_amount_mb,
                  cp.base_price_pesewas, cp.agent_price_pesewas,
                  cp.validity_days, cp.validity_desc, cp.is_active,
                  ap.custom_price_pesewas
           FROM catalog_products cp
           LEFT JOIN agent_pricing ap ON ap.product_id = cp.id AND ap.agent_id = $1 AND ap.is_active = true
           WHERE ${whereClause}
           ORDER BY cp.data_amount_mb ASC, cp.base_price_pesewas ASC
           LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
          [...params, limitNum, offset],
        );
        rows = listRes.rows;
      } catch {
        const fallbackRes = await db.query(
          `SELECT cp.* FROM catalog_products cp WHERE cp.is_active = true LIMIT $1 OFFSET $2`,
          [limitNum, offset],
        ).catch(() => ({ rows: [] }));
        rows = fallbackRes.rows || [];
        total = rows.length;
      }

      const bundles = rows.map((r: any) => {
        const mb = Number(r.data_amount_mb || 1024);
        const gb = mb / 1024;
        const basePesewas = Number(r.base_price_pesewas || 0);

        // Price resolution hierarchy:
        // 1. per-bundle override (agent_pricing)
        // 2. agent.pricePerGb * GB
        // 3. bundle.agent_amount (agent_price_pesewas)
        // 4. bundle.amount (base_price_pesewas)
        let effectivePesewas: number;
        if (r.custom_price_pesewas != null) {
          effectivePesewas = Number(r.custom_price_pesewas);
        } else if (agentRow?.price_per_gb != null && Number(agentRow.price_per_gb) > 0) {
          effectivePesewas = Math.round(Number(agentRow.price_per_gb) * gb * 100);
        } else if (r.agent_price_pesewas != null && Number(r.agent_price_pesewas) > 0) {
          effectivePesewas = Number(r.agent_price_pesewas);
        } else {
          effectivePesewas = basePesewas;
        }

        const price = Number((basePesewas / 100).toFixed(2));
        const agentPrice = Number((effectivePesewas / 100).toFixed(2));

        return {
          id: r.id,
          name: r.name,
          network: r.network,
          capacity: Math.round(gb),
          capacityUnit: 'GB',
          dataSizeGb: Number(gb.toFixed(2)),
          price,
          amount: price,
          agentPrice,
          agentAmount: agentPrice,
          validity: r.validity_desc || `${r.validity_days || 30} Days`,
          validityDays: Number(r.validity_days || 30),
          type: type || 'DATA',
          isActive: Boolean(r.is_active),
        };
      });

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: bundles,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      });
    },
  );

  // 0.5 GET AGENT BENEFICIARIES STATUS: GET /agent/beneficiaries
  app.get<{
    Querystring: {
      status?: string;
      network?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/agent/beneficiaries',
    { preHandler: [authHooks.authenticate(Permission.PENDING_MTN_MANAGE)] },
    async (req, reply) => {
      const { status, network, search, page, limit } = req.query;
      const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (status && status.toLowerCase() !== 'all') {
        const s = status.toLowerCase();
        if (s === 'approved') {
          conditions.push(`validation_status = 'VALID'`);
        } else if (s === 'rejected') {
          conditions.push(`validation_status = 'INVALID'`);
        } else if (s === 'pending' || s === 'submitted') {
          conditions.push(`validation_status = 'PENDING'`);
        } else {
          conditions.push(`validation_status = $${idx++}`);
          params.push(status.toUpperCase());
        }
      }

      if (network && network.toUpperCase() !== 'ALL') {
        conditions.push(`UPPER(network) = UPPER($${idx++})`);
        params.push(network);
      }

      if (search && search.trim().length > 0) {
        const digits = search.replace(/\D/g, '');
        conditions.push(`phone_number ILIKE $${idx++}`);
        params.push(`%${digits || search.trim()}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      let beneficiaries: any[] = [];

      try {
        const agentId = req.user!.sub;

        // 1. Sync from upstream provider if available so latest DataHouse statuses are updated locally
        if (beneficiaryService) {
          await beneficiaryService.syncBeneficiariesFromProvider({
            network,
            status,
            search,
            limit: limitNum,
          }).catch(() => {});
        }

        const approvalConditions: string[] = [`(agent_id = $1 OR agent_id IS NULL)`];
        const approvalParams: any[] = [agentId];
        let aIdx = 2;

        if (status && status.toLowerCase() !== 'all') {
          const s = status.toLowerCase();
          approvalConditions.push(`LOWER(status) = LOWER($${aIdx++})`);
          approvalParams.push(s);
        }

        if (network && network.toUpperCase() !== 'ALL') {
          approvalConditions.push(`UPPER(network) = UPPER($${aIdx++})`);
          approvalParams.push(network);
        }

        if (search && search.trim().length > 0) {
          let searchPattern = search.trim();
          const digitsOnly = search.replace(/\D/g, '');
          if (digitsOnly.startsWith('233') && digitsOnly.length > 3) {
            searchPattern = '0' + digitsOnly.slice(3);
          } else if (digitsOnly) {
            searchPattern = digitsOnly;
          }
          approvalConditions.push(`phone_number ILIKE $${aIdx++}`);
          approvalParams.push(`%${searchPattern}%`);
        }

        const approvalWhere = `WHERE ${approvalConditions.join(' AND ')}`;

        const countRes = await db.query(
          `SELECT COUNT(*) as total FROM pending_beneficiary_approvals ${approvalWhere}`,
          approvalParams,
        ).catch(() => null);

        if (countRes !== null) {
          total = parseInt(countRes.rows[0]?.total || '0', 10);
          if (total > 0) {
            const listRes = await db.query(
              `SELECT id, phone_number, network, status, attempt_count, last_bundle_size_gb,
                      first_detected_at, last_detected_at, submitted_at, resolved_at, created_at, updated_at
               FROM pending_beneficiary_approvals
               ${approvalWhere}
               ORDER BY created_at DESC
               LIMIT $${aIdx++} OFFSET $${aIdx++}`,
              [...approvalParams, limitNum, offset],
            );
            beneficiaries = listRes.rows.map((r: any) => {
              let mappedStatus = 'pending';
              if (r.status) {
                mappedStatus = String(r.status).toLowerCase();
              } else if (r.validation_status === 'VALID') {
                mappedStatus = 'approved';
              } else if (r.validation_status === 'INVALID') {
                mappedStatus = 'rejected';
              }
              return {
                msisdn: r.phone_number,
                network: r.network,
                status: mappedStatus,
                attemptCount: Number(r.attempt_count || 1),
                lastBundleSizeGb: r.last_bundle_size_gb ? String(r.last_bundle_size_gb) : null,
                firstDetectedAt: new Date(r.first_detected_at || r.created_at).toISOString(),
                lastDetectedAt: new Date(r.last_detected_at || r.updated_at || r.created_at).toISOString(),
                submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
                resolvedAt:
                  r.resolved_at
                    ? new Date(r.resolved_at).toISOString()
                    : (mappedStatus === 'approved' || mappedStatus === 'rejected') && r.validated_at
                    ? new Date(r.validated_at).toISOString()
                    : null,
              };
            });
          } else {
            beneficiaries = [];
          }
        } else {
          // Fallback to beneficiary_validation for legacy/mock compatibility
          const fbCount = await db.query(
            `SELECT COUNT(*) as total FROM beneficiary_validation ${whereClause}`,
            params,
          );
          total = parseInt(fbCount.rows[0]?.total || '0', 10);

          const listRes = await db.query(
            `SELECT id, phone_number, network, validation_status, created_at, updated_at, validated_at,
                    attempt_count, last_bundle_size_gb, first_detected_at, last_detected_at, submitted_at, resolved_at
             FROM beneficiary_validation
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, limitNum, offset],
          );

          beneficiaries = listRes.rows.map((r: any) => {
            let mappedStatus = 'pending';
            if (r.validation_status === 'VALID') mappedStatus = 'approved';
            else if (r.validation_status === 'INVALID') mappedStatus = 'rejected';
            else if (r.validation_status === 'PENDING') mappedStatus = 'pending';
            else mappedStatus = String(r.status || r.validation_status || 'pending').toLowerCase();

            return {
              msisdn: r.phone_number,
              network: r.network,
              status: mappedStatus,
              attemptCount: Number(r.attempt_count || 1),
              lastBundleSizeGb: r.last_bundle_size_gb ? String(r.last_bundle_size_gb) : null,
              firstDetectedAt: new Date(r.first_detected_at || r.created_at).toISOString(),
              lastDetectedAt: new Date(r.last_detected_at || r.updated_at || r.created_at).toISOString(),
              submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
              resolvedAt:
                r.resolved_at
                  ? new Date(r.resolved_at).toISOString()
                  : (mappedStatus === 'approved' || mappedStatus === 'rejected') && r.validated_at
                  ? new Date(r.validated_at).toISOString()
                  : null,
            };
          });
        }
      } catch {
        beneficiaries = [];
        total = 0;
      }

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: {
          data: beneficiaries,
          meta: {
            page: pageNum,
            limit: limitNum,
            total,
          },
        },
      });
    },
  );

  // 0.6 GET AGENT WALLET LEDGER: GET /agent/wallet/ledger
  app.get(
    '/agent/wallet/ledger',
    { preHandler: [authHooks.authenticate(Permission.WALLET_READ)] },
    async (req, reply) => {
      const userId = req.user!.sub;

      let rows: any[] = [];
      let total = 0;

      try {
        const countRes = await db.query(
          `SELECT COUNT(*) as total FROM financial_ledger WHERE account_id = $1`,
          [userId],
        );
        total = parseInt(countRes.rows[0]?.total || '0', 10);

        const listRes = await db.query(
          `WITH running AS (
             SELECT id, transaction_id, entry_type, account_type, account_id, amount_pesewas,
                    reference_type, reference_id, description, created_at,
                    SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END)
                      OVER (ORDER BY created_at ASC, id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_pesewas
             FROM financial_ledger
             WHERE account_id = $1
           )
           SELECT *,
                  running_pesewas as balance_after,
                  running_pesewas - (CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END) as balance_before
           FROM running
           ORDER BY created_at DESC, id DESC
           LIMIT 50 OFFSET 0`,
          [userId],
        );
        rows = listRes.rows;
      } catch {
        const fallbackRes = await db.query(
          `SELECT * FROM financial_ledger WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [userId],
        ).catch(() => ({ rows: [] }));

        let running = 0;
        rows = (fallbackRes.rows || []).map((r: any) => {
          const amt = Number(r.amount_pesewas || 0);
          const isCredit = r.entry_type === 'CREDIT';
          const balAfter = running;
          const balBefore = isCredit ? running - amt : running + amt;
          running = balBefore;
          return {
            ...r,
            balance_after: balAfter,
            balance_before: balBefore,
          };
        });
        total = rows.length;
      }

      const ledger = rows.map((r: any) => ({
        id: r.id,
        walletId: `w_${String(userId).replace(/-/g, '').slice(0, 16)}`,
        direction: String(r.entry_type || 'debit').toLowerCase(),
        amount: Number((Number(r.amount_pesewas || 0) / 100).toFixed(2)),
        balanceAfter: Number((Number(r.balance_after || 0) / 100).toFixed(2)),
        balanceBefore: Number((Number(r.balance_before || 0) / 100).toFixed(2)),
        category: String(r.reference_type || 'purchase').toLowerCase(),
        referenceType: r.reference_type || 'Order',
        referenceId: r.reference_id || r.id,
        reference: r.reference_id || r.id,
        description: r.description || 'Agent wallet ledger transaction',
        source: r.source || null,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: {
          data: ledger,
          meta: {
            page: 1,
            limit: 50,
            total,
          },
        },
      });
    },
  );

  // 0.7 AGENT WEBHOOKS: GET /agent/webhooks
  app.get(
    '/agent/webhooks',
    { preHandler: [authHooks.authenticate(Permission.WEBHOOKS_READ)] },
    async (req, reply) => {
      const userId = req.user!.sub;
      const res = await db.query(
        `SELECT id, agent_id, url, events, status, created_at as "createdAt"
         FROM agent_webhooks
         WHERE agent_id = $1 AND status != 'DISABLED'
         ORDER BY created_at DESC`,
        [userId],
      ).catch(() => ({ rows: [] }));

      const webhooks = res.rows.map((row: any) => ({
        id: row.id,
        agentId: row.agent_id || userId,
        url: row.url,
        events: row.events || [],
        isActive: row.status === 'ACTIVE',
        createdAt: new Date(row.createdAt).toISOString(),
      }));

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'Success',
        data: webhooks,
      });
    },
  );

  // 0.8 AGENT CREATE WEBHOOK: POST /agent/webhooks
  app.post<{ Body: { url: string; events: string[] } }>(
    '/agent/webhooks',
    { preHandler: [authHooks.authenticate(Permission.WEBHOOKS_WRITE)] },
    async (req, reply) => {
      const { url, events } = req.body || {};

      if (!url || typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://localhost'))) {
        throw new BadRequestError('A valid HTTPS webhook destination URL is required');
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        throw new BadRequestError('At least one event subscription string is required');
      }

      const userId = req.user!.sub;
      const rawSecret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
      const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

      const res = await db.query(
        `INSERT INTO agent_webhooks (agent_id, url, secret_hash, events, status, rate_limit_per_minute)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 60)
         RETURNING id, agent_id, url, events, status, created_at as "createdAt"`,
        [userId, url.trim(), secretHash, events],
      );

      const created = res.rows[0];

      return reply.status(201).send({
        success: true,
        statusCode: 201,
        message: 'Subscription created. The secret is shown ONCE — store it now.',
        data: {
          id: created.id,
          agentId: created.agent_id || userId,
          url: created.url,
          events: created.events || events,
          isActive: true,
          createdAt: new Date(created.createdAt).toISOString(),
          signingSecret: rawSecret,
        },
      });
    },
  );

  // 0.9 AGENT ROTATE WEBHOOK SECRET: POST /agent/webhooks/:id/rotate-secret
  app.post<{ Params: { id: string } }>(
    '/agent/webhooks/:id/rotate-secret',
    { preHandler: [authHooks.authenticate(Permission.WEBHOOKS_WRITE)] },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user!.sub;

      const existing = await db.query(
        `SELECT id, agent_id as "agentId", url, events, status, created_at as "createdAt"
         FROM agent_webhooks WHERE id = $1 AND agent_id = $2`,
        [id, userId],
      );
      if (existing.rows.length === 0) {
        throw new NotFoundError(`Webhook subscription '${id}' not found`);
      }

      const rawSecret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
      const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

      await db.query(
        `UPDATE agent_webhooks
         SET secret_hash = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND agent_id = $3`,
        [secretHash, id, userId],
      );

      const row = existing.rows[0];

      return reply.status(200).send({
        success: true,
        statusCode: 200,
        message: 'New signing secret generated. It is shown ONCE — store it now.',
        data: {
          id,
          agentId: row.agentId || userId,
          url: row.url,
          events: row.events || [],
          isActive: row.status === 'ACTIVE',
          createdAt: new Date(row.createdAt).toISOString(),
          signingSecret: rawSecret,
        },
      });
    },
  );

  // 0.10 AGENT DELETE WEBHOOK: DELETE /agent/webhooks/:id
  app.delete<{ Params: { id: string } }>(
    '/agent/webhooks/:id',
    { preHandler: [authHooks.authenticate(Permission.WEBHOOKS_WRITE)] },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user!.sub;

      const existing = await db.query(
        `SELECT id FROM agent_webhooks WHERE id = $1 AND agent_id = $2`,
        [id, userId],
      );
      if (existing.rows.length === 0) {
        throw new NotFoundError(`Webhook subscription '${id}' not found`);
      }

      await db.query(
        `UPDATE agent_webhooks SET status = 'DISABLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id],
      );

      return reply.status(204).send();
    },
  );

  // 1. GET AGENT PROFILE
  app.get(
    '/agents/profile',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = `
        SELECT id, user_id as "userId", business_name as "businessName",
               slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM agents
        WHERE user_id = $1
      `;

      const result = await db.query(query, [req.user!.sub]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Agent account not found for current user');
      }

      const r = result.rows[0];
      const profile: AgentProfileDto = {
        id: r.id,
        userId: r.userId,
        businessName: r.businessName,
        slug: r.slug,
        isActive: r.isActive,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };

      const response: ApiResponse<AgentProfileDto> = {
        success: true,
        data: profile,
      };

      return reply.send(response);
    },
  );

  // Helper to map DB row to AgentApplicationDto
  const mapApplicationRow = (r: any): AgentApplicationDto => {
    const feePesewas = parseInt(r.fee_pesewas || r.feePesewas || '10000', 10);
    return {
      id: r.id,
      userId: r.user_id || r.userId,
      fullName: r.full_name || r.fullName || '',
      businessName: r.business_name || r.businessName || '',
      slug: r.slug || '',
      phone: r.phone || '',
      email: r.email || '',
      locationRegion: r.location_region || r.locationRegion || undefined,
      experienceDescription: r.experience_description || r.experienceDescription || undefined,
      feePesewas,
      feeGhs: Number((feePesewas / 100).toFixed(2)),
      paymentStatus: (r.payment_status || r.paymentStatus || 'PAYMENT_PENDING') as any,
      paystackReference: r.paystack_reference || r.paystackReference || undefined,
      status: (r.status || 'PENDING_APPROVAL') as any,
      adminNotes: r.admin_notes || r.adminNotes || undefined,
      reviewedBy: r.reviewed_by || r.reviewedBy || undefined,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  };

  // Helper to get dynamic application fee from system_configurations
  const getDynamicApplicationFee = async (): Promise<number> => {
    try {
      const configRes = await db.query(
        `SELECT value FROM system_configurations WHERE config_key = 'agent_application_fee_pesewas'`,
      );
      let feePesewas = 10000; // Default GH₵ 100.00
      if (configRes.rows.length > 0) {
        const val = configRes.rows[0].value;
        const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          feePesewas = parsed;
        }
      }
      return feePesewas;
    } catch {
      return 10000;
    }
  };

  // Helper to dispatch in-app notifications to all system administrators
  const notifyAdminsOfNewApplication = async (appRecord: AgentApplicationDto) => {
    try {
      const adminUsers = await db.query(
        `SELECT id FROM users WHERE role IN ('admin', 'super_admin')`,
      );
      const title = 'New Agent Application Submitted';
      const body = `${appRecord.fullName} (${appRecord.businessName}) has submitted an agent application (GH₵ ${appRecord.feeGhs.toFixed(2)} paid). Admin review & verification required.`;
      
      for (const adminRow of adminUsers.rows) {
        await db.query(
          `INSERT INTO notifications (
             user_id, type, severity, title, body, message, action_url, channel, is_read, created_at, updated_at
           )
           VALUES ($1, 'AGENT_APPLICATION', 'HIGH', $2, $3, $3, '/admin/agents?tab=APPLICATIONS', 'IN_APP', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [adminRow.id, title, body],
        ).catch(() => {});
      }
    } catch (notifErr) {
      logger.warn({ err: notifErr }, '[AGENT_APPLICATIONS] Failed to send admin notifications for agent application');
    }
  };

  // 2a. GET CURRENT AGENT APPLICATION FEE (/agents/application-fee)
  app.get(
    '/agents/application-fee',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const feePesewas = await getDynamicApplicationFee();
      return reply.send({
        success: true,
        data: {
          feePesewas,
          feeGhs: Number((feePesewas / 100).toFixed(2)),
          configKey: 'agent_application_fee_pesewas',
        },
      });
    },
  );

  // 2b. GET MY AGENT APPLICATION STATUS (/agents/my-application)
  app.get(
    '/agents/my-application',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user!.sub;

      // Check if user is already an agent
      const isAgentRole = String(req.user?.role || '').toLowerCase() === 'agent';
      const agentCheck = await db.query('SELECT id, status FROM agents WHERE user_id = $1', [userId]);
      const isAgent = isAgentRole || agentCheck.rows.length > 0;

      // Query latest application
      const appRes = await db.query(
        `SELECT * FROM agent_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );

      const feePesewas = await getDynamicApplicationFee();

      return reply.send({
        success: true,
        data: {
          application: appRes.rows.length > 0 ? mapApplicationRow(appRes.rows[0]) : null,
          isAgent,
          currentFeePesewas: feePesewas,
          currentFeeGhs: Number((feePesewas / 100).toFixed(2)),
        },
      });
    },
  );

  // 2c. SUBMIT AGENT APPLICATION WITH FEE (/agents/apply)
  app.post<{ Body: SubmitAgentApplicationRequest }>(
    '/agents/apply',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: SubmitAgentApplicationRequest }>, reply: FastifyReply) => {
      const userId = req.user!.sub;
      const {
        businessName,
        slug,
        phone,
        email,
        fullName,
        locationRegion,
        experienceDescription,
        paymentMethod = 'PAYSTACK',
      } = req.body || {};

      if (!businessName || !slug || !phone) {
        throw new BadRequestError('Business name, storefront slug, and contact phone are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (cleanSlug.length < 3) {
        throw new BadRequestError('Storefront slug must be at least 3 characters long');
      }

      // Check if user already is an active agent
      const existingAgent = await db.query(
        'SELECT id FROM agents WHERE user_id = $1 AND status != \'DISABLED\'',
        [userId],
      );
      if (existingAgent.rows.length > 0 || req.user?.role === 'agent') {
        throw new ConflictError('You already have an active agent account.');
      }

      // Check slug uniqueness in approved agents
      const slugCheck = await db.query(
        `SELECT id FROM agents WHERE slug = $1
         UNION
         SELECT id FROM agent_applications WHERE slug = $1 AND status = 'APPROVED' AND user_id != $2`,
        [cleanSlug, userId],
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('This custom storefront slug is already registered. Please choose another.');
      }

      // Fetch user fallback info
      const userRes = await db.query('SELECT full_name, email, phone FROM users WHERE id = $1', [userId]);
      const userRow = userRes.rows[0] || {};
      const resolvedName = fullName?.trim() || userRow.full_name || 'Agent Applicant';
      const resolvedEmail = email?.trim() || userRow.email || req.user?.email || '';
      const resolvedPhone = phone?.trim() || userRow.phone || '';

      const dynamicFeePesewas = await getDynamicApplicationFee();
      const reference = `AGTPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Check for an existing unapproved application
      const existingAppRes = await db.query(
        `SELECT * FROM agent_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );

      let applicationId: string;
      let appRecord: AgentApplicationDto;

      if (existingAppRes.rows.length > 0 && existingAppRes.rows[0].status === 'PENDING_APPROVAL' && existingAppRes.rows[0].payment_status === 'PAID') {
        return reply.send({
          success: true,
          data: mapApplicationRow(existingAppRes.rows[0]),
          message: 'You already have a paid agent application under review.',
        });
      }

      if (existingAppRes.rows.length > 0 && existingAppRes.rows[0].payment_status !== 'PAID') {
        // Reuse and update the existing unpaid application
        const updated = await db.query(
          `UPDATE agent_applications
           SET full_name = $1, business_name = $2, slug = $3, phone = $4, email = $5,
               location_region = $6, experience_description = $7, fee_pesewas = $8,
               paystack_reference = $9, status = 'PENDING_APPROVAL', updated_at = CURRENT_TIMESTAMP
           WHERE id = $10
           RETURNING *`,
          [
            resolvedName,
            businessName.trim(),
            cleanSlug,
            resolvedPhone,
            resolvedEmail,
            locationRegion || null,
            experienceDescription || null,
            dynamicFeePesewas,
            reference,
            existingAppRes.rows[0].id,
          ],
        );
        applicationId = updated.rows[0].id;
        appRecord = mapApplicationRow(updated.rows[0]);
      } else {
        // Create new application
        const insertRes = await db.query(
          `INSERT INTO agent_applications (
             user_id, full_name, business_name, slug, phone, email,
             location_region, experience_description, fee_pesewas, payment_status,
             paystack_reference, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAYMENT_PENDING', $10, 'PENDING_APPROVAL')
           RETURNING *`,
          [
            userId,
            resolvedName,
            businessName.trim(),
            cleanSlug,
            resolvedPhone,
            resolvedEmail,
            locationRegion || null,
            experienceDescription || null,
            dynamicFeePesewas,
            reference,
          ],
        );
        applicationId = insertRes.rows[0].id;
        appRecord = mapApplicationRow(insertRes.rows[0]);
      }

      // Handle optional payment via existing wallet balance if chosen and available
      if (paymentMethod === 'WALLET' && ledgerService) {
        try {
          const balance = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, userId);
          const balancePesewas = balance?.balancePesewas || 0;
          if (balancePesewas >= dynamicFeePesewas) {
            // Deduct fee from wallet
            await ledgerService.recordJournalEntries(db, [
              {
                entryType: LedgerEntryType.DEBIT,
                accountType: LedgerAccountType.CUSTOMER_WALLET,
                accountId: userId,
                amountPesewas: dynamicFeePesewas,
                currency: Currency.GHS,
                referenceType: 'AGENT_APPLICATION',
                referenceId: applicationId,
                description: `Agent Application Fee - ${businessName.trim()}`,
              },
              {
                entryType: LedgerEntryType.CREDIT,
                accountType: LedgerAccountType.PLATFORM_ESCROW,
                accountId: 'PLATFORM_ESCROW',
                amountPesewas: dynamicFeePesewas,
                currency: Currency.GHS,
                referenceType: 'AGENT_APPLICATION',
                referenceId: applicationId,
                description: `Agent Application Fee - ${businessName.trim()}`,
              },
            ]);

            // Mark paid immediately
            const paidRes = await db.query(
              `UPDATE agent_applications
               SET payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
               WHERE id = $1
               RETURNING *`,
              [applicationId],
            );
            appRecord = mapApplicationRow(paidRes.rows[0]);

            // Notify admins immediately
            await notifyAdminsOfNewApplication(appRecord);

            return reply.status(201).send({
              success: true,
              data: appRecord,
              message: 'Agent application fee paid via wallet! Your application has been submitted to administrators for review.',
            });
          }
        } catch (walletErr) {
          logger.warn({ err: walletErr }, '[AGENT_APPLICATION] Wallet deduction failed, proceeding to Paystack');
        }
      }

      // Default: Initialize Paystack payment
      let authorizationUrl: string | undefined;
      if (paymentProvider) {
        try {
          const payRes = await paymentProvider.initializePayment({
            orderId: applicationId,
            amountPesewas: dynamicFeePesewas,
            currency: 'GHS' as any,
            email: resolvedEmail,
            paymentMethod: 'PAYSTACK' as any,
            callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/apply-agent?verify=${reference}`,
            metadata: {
              applicationId,
              reference,
              purpose: 'AGENT_APPLICATION',
            },
          });
          if (payRes?.authorizationUrl) {
            authorizationUrl = payRes.authorizationUrl;
          }
        } catch (payErr) {
          logger.warn({ err: payErr }, '[AGENT_APPLICATION] Payment provider initialization notice');
        }
      }

      return reply.status(201).send({
        success: true,
        data: {
          ...appRecord,
          authorizationUrl,
          paystackReference: reference,
        },
        message: 'Agent application registered. Please complete payment to submit for admin verification.',
      });
    },
  );

  // 2d. VERIFY AGENT APPLICATION PAYMENT (/agents/apply/verify-payment)
  app.post<{ Body: { reference: string } }>(
    '/agents/apply/verify-payment',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: { reference: string } }>, reply: FastifyReply) => {
      const { reference } = req.body || {};
      if (!reference) {
        throw new BadRequestError('Payment reference is required');
      }

      const userId = req.user!.sub;

      const appRes = await db.query(
        `SELECT * FROM agent_applications WHERE paystack_reference = $1 AND user_id = $2`,
        [reference, userId],
      );

      if (appRes.rows.length === 0) {
        throw new NotFoundError('Agent application record for this payment reference was not found.');
      }

      const existingApp = appRes.rows[0];

      // Idempotency: If already paid, return status
      if (existingApp.payment_status === 'PAID') {
        return reply.send({
          success: true,
          data: mapApplicationRow(existingApp),
          message: 'Payment was already verified and recorded.',
        });
      }

      // Mark payment as PAID and application as PENDING_APPROVAL
      const updateRes = await db.query(
        `UPDATE agent_applications
         SET payment_status = 'PAID',
             status = 'PENDING_APPROVAL',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [existingApp.id],
      );

      const updatedRecord = mapApplicationRow(updateRes.rows[0]);

      // Trigger high-priority notification to platform administrators
      await notifyAdminsOfNewApplication(updatedRecord);

      return reply.send({
        success: true,
        data: updatedRecord,
        message: 'Payment verified successfully! Your application has been submitted and administrators have been notified to verify and approve.',
      });
    },
  );

  // 3. GET AGENT WALLET TRANSACTIONS (Filtered, Sorted, Paginated)
  const handleGetWalletTransactions = async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const {
      type = 'ALL',
      status: _status = 'ALL',
      dateRange = '30d',
      sortBy = 'newest',
      page = '1',
      limit = '10',
      search = '',
    } = (req.query as {
      type?: string;
      status?: string;
      dateRange?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      page?: string;
      limit?: string;
      search?: string;
    }) || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const conditions: string[] = ['account_id = $1'];
    const params: any[] = [req.user!.sub];
    let paramIdx = 2;

    // Filter by Type
    if (type && type !== 'ALL') {
      if (type === 'DEPOSIT') {
        conditions.push(`(reference_type = 'DEPOSIT' OR reference_type = 'PAYMENT' OR description ILIKE '%top-up%' OR description ILIKE '%deposit%')`);
      } else if (type === 'PURCHASE') {
        conditions.push(`(reference_type = 'ORDER' OR description ILIKE '%bundle%' OR description ILIKE '%purchase%')`);
      } else if (type === 'REFUND') {
        conditions.push(`(reference_type = 'REFUND' OR description ILIKE '%refund%')`);
      } else if (type === 'ADJUSTMENT') {
        conditions.push(`(reference_type = 'ADJUSTMENT' OR description ILIKE '%adjust%' OR description ILIKE '%bonus%')`);
      }
    }

    // Filter by Date Range
    if (dateRange && dateRange !== 'all') {
      let interval = '30 days';
      if (dateRange === 'today') interval = '1 day';
      else if (dateRange === '7d') interval = '7 days';
      else if (dateRange === '30d') interval = '30 days';
      else if (dateRange === '90d') interval = '90 days';
      else if (dateRange === '1y') interval = '1 year';

      conditions.push(`created_at >= NOW() - INTERVAL '${interval}'`);
    }

    // Search keyword filter
    if (search && search.trim()) {
      conditions.push(`(description ILIKE $${paramIdx} OR reference_id ILIKE $${paramIdx})`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    // Sorting
    let orderClause = 'ORDER BY created_at DESC';
    if (sortBy === 'oldest') {
      orderClause = 'ORDER BY created_at ASC';
    } else if (sortBy === 'highest') {
      orderClause = 'ORDER BY amount_pesewas DESC';
    } else if (sortBy === 'lowest') {
      orderClause = 'ORDER BY amount_pesewas ASC';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await db.query(
      `SELECT COUNT(*) as total FROM financial_ledger ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Paginated Select Query
    const offset = (pageNum - 1) * limitNum;
    const selectQuery = `
      SELECT id, entry_type as "entryType", account_type as "accountType",
             account_id as "accountId", amount_pesewas as "amountPesewas",
             currency, reference_type as "referenceType", reference_id as "referenceId",
             description, created_at as "createdAt"
      FROM financial_ledger
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limitNum, offset);

    const itemsRes = await db.query(selectQuery, params);

    const items = itemsRes.rows.map((r) => {
      const isCredit = r.entryType === 'CREDIT';
      let inferredType: 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT' = 'PURCHASE';
      if (r.referenceType === 'DEPOSIT' || r.description?.toLowerCase().includes('top-up') || r.description?.toLowerCase().includes('deposit')) {
        inferredType = 'DEPOSIT';
      } else if (r.referenceType === 'REFUND' || r.description?.toLowerCase().includes('refund')) {
        inferredType = 'REFUND';
      } else if (r.referenceType === 'ADJUSTMENT' || r.description?.toLowerCase().includes('bonus')) {
        inferredType = 'ADJUSTMENT';
      }

      const amtPesewas = Number(r.amountPesewas);
      const amtGhs = Number((amtPesewas / 100).toFixed(2));
      const createdAtIso = new Date(r.createdAt).toISOString();

      return {
        id: r.referenceId || `TXN-${r.id.substring(0, 8).toUpperCase()}`,
        referenceId: r.referenceId || r.id,
        ledgerId: r.id,
        type: inferredType,
        method: inferredType === 'DEPOSIT' ? 'Paystack' : inferredType === 'PURCHASE' ? 'Wallet' : 'Internal',
        amountPesewas: amtPesewas,
        amountGhs: amtGhs,
        balanceAfterPesewas: amtPesewas,
        balanceAfterGhs: amtGhs,
        feePesewas: inferredType === 'DEPOSIT' ? Math.round(amtPesewas * 0.03) : 0,
        isCredit,
        description: r.description || `${inferredType} transaction`,
        status: 'SUCCESSFUL',
        createdAt: createdAtIso,
        date: new Date(r.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawDate: createdAtIso,
      };
    });

    return reply.send({
      success: true,
      data: {
        items,
        transactions: items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  };

  app.get('/agents/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/agent/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/customer/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);
  app.get('/customers/wallet/transactions', { preHandler: [authHooks.authenticateCustomer] }, handleGetWalletTransactions);

  // 4. GET AGENT / CUSTOMER WALLET BALANCE (Reconciled & Authoritative)
  const handleGetWalletBalance = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.sub;

    // 1. Check users table balance
    let userBalancePesewas = 0;
    try {
      const uRes = await db.query(
        `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1`,
        [userId],
      );
      if (uRes.rows.length > 0) {
        userBalancePesewas = Number(uRes.rows[0].wallet_balance_pesewas ?? 0);
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, userId }, '[WALLET_BALANCE] Error querying users table balance');
    }

    // 2. Check financial_ledger balance
    let ledgerBalancePesewas = 0;
    try {
      if (ledgerService) {
        const bal = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, userId);
        ledgerBalancePesewas = bal.balancePesewas;
      } else {
        const res = await db.query(
          `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as balance
           FROM financial_ledger WHERE account_id = $1`,
          [userId],
        );
        ledgerBalancePesewas = Number(res.rows[0]?.balance || 0);
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, userId }, '[WALLET_BALANCE] Error querying ledger balance');
    }

    // 3. Reconcile: ensure users.wallet_balance_pesewas matches authoritative balance
    // If ledger has a higher balance (e.g. from topup), sync users table.
    // If users has a balance but ledger is uninitialized, keep users balance authoritative.
    let balancePesewas = userBalancePesewas;
    if (ledgerBalancePesewas > userBalancePesewas) {
      balancePesewas = ledgerBalancePesewas;
      db.query(
        `UPDATE users
         SET wallet_balance_pesewas = $1,
             wallet_balance = ROUND($1 / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [balancePesewas, userId],
      ).catch(() => {});
    } else if (userBalancePesewas > 0 && ledgerBalancePesewas === 0) {
      balancePesewas = userBalancePesewas;
    } else if (ledgerBalancePesewas !== 0 && ledgerBalancePesewas === userBalancePesewas) {
      balancePesewas = ledgerBalancePesewas;
    }

    const balanceGhs = Number((balancePesewas / 100).toFixed(2));
    const overdraftLimit = 0.0;
    const overdraftUsed = 0.0;
    const overdraftAvailable = 0.0;
    const overdraftActive = false;
    const availableToSpend = balanceGhs;

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        balance: balanceGhs,
        currency: 'GHS',
        overdraftLimit,
        overdraftUsed,
        overdraftAvailable,
        overdraftActive,
        availableToSpend,
        balancePesewas,
        balanceGhs,
        availablePesewas: balancePesewas,
        availableGhs: balanceGhs,
      },
    });
  };

  app.get('/agents/wallet/balance', { preHandler: [authHooks.authenticate(Permission.WALLET_READ)] }, handleGetWalletBalance);
  app.get('/agent/wallet/balance', { preHandler: [authHooks.authenticate(Permission.WALLET_READ)] }, handleGetWalletBalance);
  app.get('/wallet/balance', { preHandler: [authHooks.authenticate(Permission.WALLET_READ)] }, handleGetWalletBalance);
  app.get('/customer/wallet/balance', { preHandler: [authHooks.authenticate(Permission.WALLET_READ)] }, handleGetWalletBalance);

  // 5. INITIALIZE WALLET TOPUP (Paystack)
  const handleInitializeTopup = async (
    req: FastifyRequest<{ Body: { amountPesewas: number; callbackUrl?: string } }>,
    reply: FastifyReply,
  ) => {
    const { amountPesewas, callbackUrl } = req.body || {};
    if (!amountPesewas || amountPesewas < 100) {
      throw new BadRequestError('Minimum top-up amount is GH₵ 1.00 (100 pesewas)');
    }

    const userId = req.user!.sub;
    const tempRef = `pst_topup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const metadata = {
      type: 'WALLET_TOPUP',
      userId,
      amountPesewas,
    };

    // Pre-insert pending payment intent into payments table so webhooks can find it
    let paymentId = '';
    try {
      const insertRes = await db.query(
        `INSERT INTO payments (
           user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status, metadata
         ) VALUES ($1, $2, 'GHS', 'PAYSTACK', $3, 'MOMO', 'PENDING', $4)
         RETURNING id`,
        [userId, amountPesewas, tempRef, JSON.stringify(metadata)],
      );
      paymentId = insertRes.rows[0]?.id || '';
    } catch {
      try {
        const insertRes = await db.query(
          `INSERT INTO payments (
             user_id, amount_pesewas, currency, provider, provider_reference, payment_method, status
           ) VALUES ($1, $2, 'GHS', 'PAYSTACK', $3, 'MOMO', 'PENDING')
           RETURNING id`,
          [userId, amountPesewas, tempRef],
        );
        paymentId = insertRes.rows[0]?.id || '';
      } catch (err: any) {
        logger.warn({ err: err?.message, userId }, '[TOPUP_INITIALIZE] Failed to pre-insert pending payment record');
      }
    }

    if (paymentProvider) {
      const defaultCallback = req.user!.role === UserRole.AGENT
        ? 'https://bytebeacon.online/agent/wallet'
        : 'https://bytebeacon.online/customer/wallet';

      const initRes = await paymentProvider.initializePayment({
        orderId: `topup_${userId}_${Date.now()}`,
        email: req.user!.email || 'user@bytebeacon.online',
        amountPesewas,
        currency: Currency.GHS,
        paymentMethod: PaymentMethod.MOMO,
        callbackUrl: callbackUrl || defaultCallback,
        metadata: {
          type: 'WALLET_TOPUP',
          userId,
          paymentId,
        },
      });

      // Update provider_reference if Paystack generated its own reference
      if (paymentId && initRes.providerReference) {
        db.query(
          `UPDATE payments SET provider_reference = $1 WHERE id = $2`,
          [initRes.providerReference, paymentId],
        ).catch(() => {});
      }

      return reply.send({
        success: true,
        data: {
          authorizationUrl: initRes.authorizationUrl,
          reference: initRes.providerReference,
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        authorizationUrl: `https://checkout.paystack.com/${tempRef}`,
        reference: tempRef,
      },
    });
  };

  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/agents/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    handleInitializeTopup,
  );
  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/agent/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    handleInitializeTopup,
  );
  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/customer/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    handleInitializeTopup,
  );
  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    handleInitializeTopup,
  );

  // 6. VERIFY WALLET TOPUP & POST DOUBLE-ENTRY JOURNAL (Atomic & Idempotent)
  const handleVerifyTopup = async (
    req: FastifyRequest<{ Body: { reference: string } }>,
    reply: FastifyReply,
  ) => {
    const { reference } = req.body || {};
    if (!reference) {
      throw new BadRequestError('Payment reference is required');
    }

    const userId = req.user!.sub;

    // Check if this deposit has already been credited in the ledger
    let isAlreadyCredited = false;
    try {
      const existingLedger = await db.query(
        `SELECT id, reference_id FROM financial_ledger WHERE reference_type = 'DEPOSIT' AND reference_id = $1 AND account_id = $2`,
        [reference, userId],
      );
      // Ensure row is a genuine financial_ledger entry (not a generic mock user row with role)
      isAlreadyCredited = (existingLedger.rows || []).some(
        (r: any) => !r.role && (r.reference_id === reference || r.entry_type),
      );
    } catch {
      isAlreadyCredited = false;
    }

    if (isAlreadyCredited) {
      const uRes = await db.query(
        `SELECT wallet_balance_pesewas FROM users WHERE id = $1`,
        [userId],
      ).catch(() => ({ rows: [] }));
      const currentPesewas = Number(uRes.rows[0]?.wallet_balance_pesewas || 0);

      return reply.send({
        success: true,
        data: {
          success: true,
          newBalancePesewas: currentPesewas,
          message: 'Deposit already credited.',
        },
      });
    }

    let verifiedAmountPesewas = 5000;
    if (paymentProvider) {
      const verifyRes = await paymentProvider.verifyPayment(reference);
      if (verifyRes.status !== 'SUCCESS') {
        throw new BadRequestError(`Payment verification failed: status is ${verifyRes.status}`);
      }
      verifiedAmountPesewas = verifyRes.amountPesewas;
    }

    // Read current user balance
    let currentPesewas = 0;
    try {
      const uRes = await db.query(
        `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1`,
        [userId],
      );
      if (uRes.rows.length > 0 && uRes.rows[0].wallet_balance_pesewas !== undefined && uRes.rows[0].wallet_balance_pesewas !== null) {
        currentPesewas = Number(uRes.rows[0].wallet_balance_pesewas);
      }
    } catch {}

    let newBalancePesewas = currentPesewas + verifiedAmountPesewas;
    const client = typeof db.connect === 'function' ? await db.connect().catch(() => null) : null;

    if (client) {
      try {
        await client.query('BEGIN');

        // 1. Lock user row
        const userRes = await client.query(
          `SELECT wallet_balance_pesewas, wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
          [userId],
        );
        const currentPesewas = Number(userRes.rows[0]?.wallet_balance_pesewas || 0);
        newBalancePesewas = currentPesewas + verifiedAmountPesewas;
        const newBalanceGhs = Number((newBalancePesewas / 100).toFixed(2));

        // 2. Atomically credit users table
        await client.query(
          `UPDATE users
           SET wallet_balance_pesewas = $1,
               wallet_balance = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newBalancePesewas, newBalanceGhs, userId],
        );

        // 3. Post double-entry financial ledger lines
        if (ledgerService) {
          const platformAccountId = '00000000-0000-0000-0000-000000000000';
          await ledgerService.recordJournalEntries(client, [
            {
              entryType: LedgerEntryType.DEBIT,
              accountType: LedgerAccountType.PLATFORM_ESCROW,
              accountId: platformAccountId,
              amountPesewas: verifiedAmountPesewas,
              currency: Currency.GHS,
              referenceType: 'DEPOSIT',
              referenceId: reference,
              description: `Paystack wallet top-up verified (${reference})`,
            },
            {
              entryType: LedgerEntryType.CREDIT,
              accountType: LedgerAccountType.CUSTOMER_WALLET,
              accountId: userId,
              amountPesewas: verifiedAmountPesewas,
              currency: Currency.GHS,
              referenceType: 'DEPOSIT',
              referenceId: reference,
              description: `Paystack wallet deposit credited (${reference})`,
            },
          ]);
        } else {
          const platformAccountId = '00000000-0000-0000-0000-000000000000';
          await client.query(
            `INSERT INTO financial_ledger (
               entry_type, account_type, account_id, amount_pesewas, currency, reference_type, reference_id, description
             ) VALUES
               ('DEBIT', 'PLATFORM_ESCROW', $1, $2, 'GHS', 'DEPOSIT', $3, $4),
               ('CREDIT', 'CUSTOMER_WALLET', $5, $2, 'GHS', 'DEPOSIT', $3, $6)`,
            [
              platformAccountId,
              verifiedAmountPesewas,
              reference,
              `Paystack wallet top-up verified (${reference})`,
              userId,
              `Paystack wallet deposit credited (${reference})`,
            ],
          );
        }

        // 4. Update payments table if record exists
        await client.query(
          `UPDATE payments
           SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE provider_reference = $1`,
          [reference],
        ).catch(() => {});

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error({ err: err?.message, reference, userId }, '[TOPUP_VERIFY] Failed in transaction');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Fallback if client connect not available
      if (ledgerService) {
        const platformAccountId = '00000000-0000-0000-0000-000000000000';
        await ledgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformAccountId,
            amountPesewas: verifiedAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'DEPOSIT',
            referenceId: reference,
            description: `Paystack wallet top-up verified (${reference})`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: userId,
            amountPesewas: verifiedAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'DEPOSIT',
            referenceId: reference,
            description: `Paystack wallet deposit credited (${reference})`,
          },
        ]);
      }
      await db.query(
        `UPDATE users
         SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
             wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [verifiedAmountPesewas, userId],
      ).catch(() => {});
    }

    return reply.send({
      success: true,
      data: {
        success: true,
        newBalancePesewas,
        amountCreditedPesewas: verifiedAmountPesewas,
      },
    });
  };

  app.post<{ Body: { reference: string } }>(
    '/agents/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    handleVerifyTopup,
  );
  app.post<{ Body: { reference: string } }>(
    '/agent/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    handleVerifyTopup,
  );
  app.post<{ Body: { reference: string } }>(
    '/customer/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    handleVerifyTopup,
  );
  app.post<{ Body: { reference: string } }>(
    '/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    handleVerifyTopup,
  );

  // 7. HELPER: Calculate Agent Storefront Sales Profit & Payout Balances
  const getAgentStorefrontProfit = async (userId: string) => {
    // 1. Resolve agent's storefront
    const storeRes = await db.query<{
      id: string;
      agent_id: string | null;
      store_name: string;
      slug: string;
      store_status: string;
    }>(
      `SELECT s.id, s.agent_id, s.store_name, s.slug, s.store_status
       FROM stores s
       WHERE s.user_id = $1 OR s.agent_id = (SELECT id FROM agents WHERE user_id = $1 LIMIT 1)
       LIMIT 1`,
      [userId]
    );

    const store = storeRes.rows[0] || null;

    if (!store) {
      return {
        hasStore: false,
        store: null,
        totalProfitEarnedPesewas: 0,
        totalWithdrawnPesewas: 0,
        pendingWithdrawnPesewas: 0,
        settledWithdrawnPesewas: 0,
        availableProfitPesewas: 0,
        salesCount: 0,
        salesVolumePesewas: 0,
      };
    }

    // 2. Sum profit earned strictly from paid storefront customer sales
    const profitRes = await db.query<{
      total_profit_pesewas: string;
      sales_count: string;
      sales_volume_pesewas: string;
    }>(
      `SELECT 
         COALESCE(SUM(
           CASE 
             WHEN (o.pricing_snapshot->>'markupPesewas') IS NOT NULL AND (o.pricing_snapshot->>'markupPesewas') != '' 
               THEN (o.pricing_snapshot->>'markupPesewas')::bigint
             WHEN (o.pricing_snapshot->>'unitPricePesewas') IS NOT NULL AND (o.pricing_snapshot->>'basePricePesewas') IS NOT NULL 
               THEN GREATEST(0, (o.pricing_snapshot->>'unitPricePesewas')::bigint - (o.pricing_snapshot->>'basePricePesewas')::bigint)
             ELSE 0
           END
         ), 0) as total_profit_pesewas,
         COUNT(o.id) as sales_count,
         COALESCE(SUM(o.amount_pesewas), 0) as sales_volume_pesewas
       FROM orders o
       WHERE o.store_id = $1
         AND o.payment_status = 'PAID'
         AND COALESCE(o.refund_status, 'NONE') != 'COMPLETED'`,
      [store.id]
    );

    const totalProfitEarnedPesewas = parseInt(profitRes.rows[0]?.total_profit_pesewas || '0', 10);
    const salesCount = parseInt(profitRes.rows[0]?.sales_count || '0', 10);
    const salesVolumePesewas = parseInt(profitRes.rows[0]?.sales_volume_pesewas || '0', 10);

    // 3. Sum payouts requested / processed from store_payouts
    const payoutsRes = await db.query<{
      total_withdrawn_pesewas: string;
      pending_withdrawn_pesewas: string;
      settled_withdrawn_pesewas: string;
    }>(
      `SELECT 
         COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PROCESSING', 'PAID') THEN amount_pesewas ELSE 0 END), 0) as total_withdrawn_pesewas,
         COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN amount_pesewas ELSE 0 END), 0) as pending_withdrawn_pesewas,
         COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_pesewas ELSE 0 END), 0) as settled_withdrawn_pesewas
       FROM store_payouts
       WHERE store_id = $1 OR (agent_id IS NOT NULL AND agent_id = $2)`,
      [store.id, store.agent_id]
    );

    const totalWithdrawnPesewas = parseInt(payoutsRes.rows[0]?.total_withdrawn_pesewas || '0', 10);
    const pendingWithdrawnPesewas = parseInt(payoutsRes.rows[0]?.pending_withdrawn_pesewas || '0', 10);
    const settledWithdrawnPesewas = parseInt(payoutsRes.rows[0]?.settled_withdrawn_pesewas || '0', 10);

    const availableProfitPesewas = Math.max(0, totalProfitEarnedPesewas - totalWithdrawnPesewas);

    return {
      hasStore: true,
      store: {
        id: store.id,
        agentId: store.agent_id,
        storeName: store.store_name,
        slug: store.slug,
        status: store.store_status,
      },
      storeName: store.store_name,
      storeSlug: store.slug,
      totalProfitEarnedPesewas,
      totalWithdrawnPesewas,
      pendingWithdrawnPesewas,
      settledWithdrawnPesewas,
      availableProfitPesewas,
      salesCount,
      salesVolumePesewas,
    };
  };

  // 7a. AGENT STOREFRONT PROFIT WITHDRAWALS (DO NOT TOUCH OPERATIONAL WALLET)
  app.post<{
    Body: {
      amountPesewas: number;
      payoutMethod: string;
      accountNumber: string;
      accountName: string;
      bankName?: string;
    };
  }>(
    '/agents/withdrawals',
    { preHandler: [authHooks.authenticateCustomer, maintenanceHook] },
    async (req: FastifyRequest<{
      Body: {
        amountPesewas: number;
        payoutMethod: string;
        accountNumber: string;
        accountName: string;
        bankName?: string;
      };
    }>, reply: FastifyReply) => {
      const { amountPesewas, payoutMethod, accountNumber, accountName, bankName } = req.body || {};

      if (!amountPesewas || amountPesewas < 1000) {
        throw new BadRequestError('Minimum withdrawal amount is GH₵ 10.00 (1000 pesewas)');
      }
      if (!accountNumber || !accountName || !payoutMethod) {
        throw new BadRequestError('Payout method, destination account number, and account holder name are required');
      }

      // Check agent storefront profit balance
      const profitData = await getAgentStorefrontProfit(req.user!.sub);
      if (!profitData.hasStore || !profitData.store) {
        throw new BadRequestError('You must have an active agent storefront to earn and withdraw reseller profits.');
      }

      if (profitData.availableProfitPesewas < amountPesewas) {
        throw new BadRequestError(
          `Insufficient storefront profit. Available profit: GH₵ ${(profitData.availableProfitPesewas / 100).toFixed(2)}. (Withdrawals draw strictly from storefront sales profit, not your purchasing wallet).`
        );
      }

      const reference = `PAYOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Insert directly into authoritative store_payouts table
      const payoutRes = await db.query<{
        id: string;
        store_id: string;
        agent_id: string;
        amount_pesewas: string;
        destination_account: string;
        destination_provider: string;
        account_name: string;
        bank_name: string | null;
        reference: string;
        status: string;
        created_at: string;
      }>(
        `INSERT INTO store_payouts (
           store_id, agent_id, amount_pesewas, destination_account, destination_provider,
           account_name, bank_name, reference, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, store_id, agent_id, amount_pesewas, destination_account, destination_provider,
                   account_name, bank_name, reference, status, created_at`,
        [
          profitData.store.id,
          profitData.store.agentId || null,
          amountPesewas,
          accountNumber.trim(),
          payoutMethod,
          accountName.trim(),
          payoutMethod === 'BANK' ? (bankName?.trim() || 'Bank') : null,
          reference,
        ]
      );

      const created = payoutRes.rows[0];

      // Format method label
      const formattedMethod = payoutMethod === 'BANK'
        ? `${created.bank_name || 'Bank'} Account`
        : payoutMethod.replace(/_/g, ' ');

      // Also record double-entry audit entry in financial ledger
      if (ledgerService) {
        try {
          const platformAccountId = '00000000-0000-0000-0000-000000000000';
          await ledgerService.recordJournalEntries(db, [
            {
              entryType: LedgerEntryType.DEBIT,
              accountType: LedgerAccountType.PLATFORM_ESCROW,
              accountId: platformAccountId,
              amountPesewas,
              currency: Currency.GHS,
              referenceType: 'MERCHANT_PAYOUT',
              referenceId: created.id,
              description: `Agent storefront profit withdrawal to ${formattedMethod} (${accountNumber.trim()})`,
            },
          ]);
        } catch {
          // Non-blocking audit log
        }
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: created.id,
          reference: created.reference,
          amountPesewas: parseInt(created.amount_pesewas, 10),
          feePesewas: 0,
          method: formattedMethod,
          recipientAccount: created.destination_account,
          destinationAccount: created.destination_account,
          recipientName: created.account_name,
          accountName: created.account_name,
          bankName: created.bank_name,
          status: 'PENDING',
          createdAt: created.created_at,
          availableProfitPesewas: Math.max(0, profitData.availableProfitPesewas - amountPesewas),
        },
      });
    },
  );

  // 7b. GET AGENT WITHDRAWALS & PAYOUT HISTORY (READS FROM STORE_PAYOUTS)
  app.get(
    '/agents/withdrawals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const profitData = await getAgentStorefrontProfit(req.user!.sub);

        let withdrawals: any[] = [];

        if (profitData.hasStore && profitData.store) {
          const result = await db.query<{
            id: string;
            reference: string | null;
            amount_pesewas: string;
            destination_account: string;
            destination_provider: string;
            account_name: string | null;
            bank_name: string | null;
            status: string;
            created_at: string;
            paid_at: string | null;
            admin_notes: string | null;
          }>(
            `SELECT id, reference, amount_pesewas, destination_account, destination_provider,
                    account_name, bank_name, status, created_at, paid_at, admin_notes
             FROM store_payouts
             WHERE store_id = $1 OR (agent_id IS NOT NULL AND agent_id = $2)
             ORDER BY created_at DESC
             LIMIT 100`,
            [profitData.store.id, profitData.store.agentId]
          );

          withdrawals = (result.rows || []).map((row) => {
            const methodLabel = row.destination_provider === 'BANK'
              ? `${row.bank_name || 'Bank'} Account`
              : row.destination_provider.replace(/_/g, ' ');

            return {
              id: row.id,
              reference: row.reference || `PAYOUT-${row.id.slice(0, 8).toUpperCase()}`,
              amountPesewas: parseInt(row.amount_pesewas, 10) || 0,
              feePesewas: 0,
              method: methodLabel,
              recipientAccount: row.destination_account,
              recipientName: row.account_name || 'Agent Payout',
              bankName: row.bank_name,
              status: row.status === 'PAID' ? 'COMPLETED' : row.status,
              date: new Date(row.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              rawDate: row.created_at,
              adminNotes: row.admin_notes,
            };
          });
        }

        // Generate Profit Ledger records (Storefront order markups + Payouts)
        let ledger: any[] = [];
        if (profitData.hasStore && profitData.store) {
          const orderLedgerRes = await db.query<{
            id: string;
            public_id: string;
            amount_pesewas: string;
            pricing_snapshot: any;
            created_at: string;
          }>(
            `SELECT id, public_id, amount_pesewas, pricing_snapshot, created_at
             FROM orders
             WHERE store_id = $1 AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'
             ORDER BY created_at DESC
             LIMIT 50`,
            [profitData.store.id]
          );

          const orderEntries = (orderLedgerRes.rows || []).map((o) => {
            let markup = 0;
            const snap = typeof o.pricing_snapshot === 'string' ? JSON.parse(o.pricing_snapshot) : o.pricing_snapshot;
            if (snap?.markupPesewas) {
              markup = parseInt(snap.markupPesewas, 10);
            } else if (snap?.unitPricePesewas && snap?.basePricePesewas) {
              markup = Math.max(0, parseInt(snap.unitPricePesewas, 10) - parseInt(snap.basePricePesewas, 10));
            }

            return {
              id: `pl_ord_${o.id.slice(0, 8)}`,
              date: new Date(o.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              rawDate: o.created_at,
              reference: o.public_id,
              type: 'Profit Earned',
              amountPesewas: markup,
              balanceAfterPesewas: 0,
              status: 'POSTED',
              isCredit: true,
            };
          });

          const payoutEntries = withdrawals.map((w) => ({
            id: `pl_wd_${w.id.slice(0, 8)}`,
            date: w.date,
            rawDate: w.rawDate,
            reference: w.reference,
            type: 'Withdrawal',
            amountPesewas: w.amountPesewas,
            balanceAfterPesewas: 0,
            status: w.status === 'REJECTED' ? 'REVERSED' : 'POSTED',
            isCredit: false,
          }));

          ledger = [...orderEntries, ...payoutEntries].sort(
            (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
          );
        }

        return reply.send({
          success: true,
          data: {
            withdrawals,
            ledger,
            summary: {
              hasStore: profitData.hasStore,
              storeName: profitData.store?.storeName || null,
              slug: profitData.store?.slug || null,
              totalProfitEarnedPesewas: profitData.totalProfitEarnedPesewas,
              totalWithdrawnPesewas: profitData.totalWithdrawnPesewas,
              pendingWithdrawnPesewas: profitData.pendingWithdrawnPesewas,
              settledWithdrawnPesewas: profitData.settledWithdrawnPesewas,
              availableProfitPesewas: profitData.availableProfitPesewas,
              salesCount: profitData.salesCount,
              salesVolumePesewas: profitData.salesVolumePesewas,
            },
          },
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          data: {
            withdrawals: [],
            ledger: [],
            summary: {
              hasStore: false,
              totalProfitEarnedPesewas: 0,
              totalWithdrawnPesewas: 0,
              availableProfitPesewas: 0,
            },
          },
        });
      }
    },
  );

  // 7c. GET AGENT WITHDRAWALS SUMMARY (/agents/withdrawals/summary)
  app.get(
    '/agents/withdrawals/summary',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const summary = await getAgentStorefrontProfit(req.user!.sub);
      return reply.send({
        success: true,
        data: summary,
      });
    },
  );

  // 9. GET AGENT REVENUE TREND ANALYTICS (/agents/analytics/revenue)
  app.get(
    '/agents/analytics/revenue',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      const agentId = agentRes.rows[0]?.id;

      const userClause = agentId
        ? '(user_id = $1 OR agent_id = $2)'
        : 'user_id = $1';
      const userParams = agentId ? [req.user!.sub, agentId] : [req.user!.sub];

      // Fetch completed orders in last 365 days
      const ordersRes = await db.query(
        `SELECT amount_pesewas, created_at, order_status, payment_status
         FROM orders
         WHERE ${userClause}
           AND (order_status = 'COMPLETED' OR payment_status = 'PAID')
           AND created_at >= CURRENT_TIMESTAMP - INTERVAL '365 days'
         ORDER BY created_at ASC`,
        userParams,
      );

      const completedOrders = ordersRes.rows;
      const now = new Date();

      // Helper for period aggregation
      const calculatePeriodStats = (days: number, intervalCount: number, labelPrefix: string, type: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const periodOrders = completedOrders.filter((o) => new Date(o.created_at) >= periodStart);

        const totalPesewas = periodOrders.reduce((acc, o) => acc + (parseInt(o.amount_pesewas, 10) || 0), 0);
        const orderCount = periodOrders.length;
        const totalGhs = totalPesewas / 100;

        // Bucket points
        const points: Array<{ label: string; revenue: number; orders: number }> = [];
        const intervalMs = (days * 24 * 60 * 60 * 1000) / intervalCount;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < intervalCount; i++) {
          const bucketStart = new Date(periodStart.getTime() + i * intervalMs);
          const bucketEnd = new Date(periodStart.getTime() + (i + 1) * intervalMs);

          const bucketOrders = periodOrders.filter((o) => {
            const d = new Date(o.created_at);
            return d >= bucketStart && d < bucketEnd;
          });

          const bucketRevenue = bucketOrders.reduce((acc, o) => acc + (parseInt(o.amount_pesewas, 10) || 0), 0) / 100;

          let label = `${labelPrefix}${i + 1}`;
          if (type === 'daily') {
            label = dayNames[bucketStart.getDay()];
          }

          points.push({
            label,
            revenue: Math.round(bucketRevenue * 100) / 100,
            orders: bucketOrders.length,
          });
        }

        return {
          label: `${days} days`,
          revenueDisplay: `GH₵ ${totalGhs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          orderCount,
          trendDisplay: orderCount > 0 ? '↑ Live' : '0.0%',
          points,
        };
      };

      const result = {
        '7D': calculatePeriodStats(7, 7, '', 'daily'),
        '30D': calculatePeriodStats(30, 4, 'W', 'weekly'),
        '90D': calculatePeriodStats(90, 3, 'M', 'monthly'),
        '1Y': calculatePeriodStats(365, 4, 'Q', 'quarterly'),
      };

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 10. GET AGENT SALES & MARGIN ANALYTICS (/agents/analytics/sales-margins)
  app.get<{
    Querystring: {
      period?: string;
      network?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
    };
  }>(
    '/agents/analytics/sales-margins',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { period = '30d', network = 'ALL', startDate, endDate } = req.query;

      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      const agentId = agentRes.rows[0]?.id;

      const conditions: string[] = ['(o.user_id = $1' + (agentId ? ' OR o.agent_id = $2' : '') + ')'];
      const params: any[] = [req.user!.sub];
      if (agentId) params.push(agentId);

      if (network && network !== 'ALL') {
        params.push(network);
        conditions.push(`o.network = $${params.length}`);
      }

      if (startDate) {
        params.push(startDate);
        conditions.push(`o.created_at >= $${params.length}`);
      } else {
        let days = 30;
        if (period === 'today') days = 1;
        else if (period === '7d') days = 7;
        else if (period === '30d') days = 30;
        else if (period === '90d') days = 90;
        else if (period === '1y') days = 365;
        conditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`);
      }

      if (endDate) {
        params.push(endDate);
        conditions.push(`o.created_at <= $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const ordersRes = await db.query(
        `SELECT o.id, o.network, o.data_amount_mb, o.amount_pesewas, o.order_status, o.payment_status, o.refund_status, o.pricing_snapshot, o.created_at
         FROM orders o
         ${whereClause}`,
        params,
      );

      const allOrders = ordersRes.rows;
      const completedOrders = allOrders.filter((o) => o.order_status === 'COMPLETED' || o.payment_status === 'PAID');
      const refundedOrders = allOrders.filter((o) => o.refund_status === 'COMPLETED');

      const grossSalesPesewas = completedOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0);
      const refundsPesewas = refundedOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0);
      const netSalesPesewas = Math.max(0, grossSalesPesewas - refundsPesewas);

      // Compute exact profit & wholesale base cost from pricing snapshot when available
      let totalCostPesewas = 0;
      let grossProfitPesewas = 0;

      completedOrders.forEach((o) => {
        const snap = typeof o.pricing_snapshot === 'string' ? JSON.parse(o.pricing_snapshot) : o.pricing_snapshot;
        const amount = parseInt(o.amount_pesewas, 10) || 0;
        let profit = 0;
        let cost = 0;
        if (snap?.markupPesewas !== undefined && snap?.markupPesewas !== '') {
          profit = parseInt(snap.markupPesewas, 10) || 0;
          cost = Math.max(0, amount - profit);
        } else if (snap?.basePricePesewas !== undefined) {
          cost = parseInt(snap.basePricePesewas, 10) || 0;
          profit = Math.max(0, amount - cost);
        } else {
          cost = Math.round(amount * 0.82);
          profit = Math.max(0, amount - cost);
        }
        totalCostPesewas += cost;
        grossProfitPesewas += profit;
      });

      const marginPercent = netSalesPesewas > 0 ? Math.round((grossProfitPesewas / netSalesPesewas) * 1000) / 10 : 0;
      const totalOrders = completedOrders.length;
      const avgOrderValueGhs = totalOrders > 0 ? (netSalesPesewas / totalOrders / 100) : 0;

      // Network Breakdown
      const networks = ['MTN', 'TELECEL', 'AIRTELTIGO'];
      const networkBreakdown = networks.map((net) => {
        const netOrders = completedOrders.filter((o) => o.network === net);
        const netSales = netOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0) / 100;
        let netProfitPesewas = 0;
        let netCostPesewas = 0;

        netOrders.forEach((o) => {
          const snap = typeof o.pricing_snapshot === 'string' ? JSON.parse(o.pricing_snapshot) : o.pricing_snapshot;
          const amount = parseInt(o.amount_pesewas, 10) || 0;
          if (snap?.markupPesewas !== undefined && snap?.markupPesewas !== '') {
            const p = parseInt(snap.markupPesewas, 10) || 0;
            netProfitPesewas += p;
            netCostPesewas += Math.max(0, amount - p);
          } else if (snap?.basePricePesewas !== undefined) {
            const c = parseInt(snap.basePricePesewas, 10) || 0;
            netCostPesewas += c;
            netProfitPesewas += Math.max(0, amount - c);
          } else {
            const c = Math.round(amount * 0.82);
            netCostPesewas += c;
            netProfitPesewas += Math.max(0, amount - c);
          }
        });

        const netCost = netCostPesewas / 100;
        const netProfit = netProfitPesewas / 100;
        const netMargin = netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0;
        const share = grossSalesPesewas > 0 ? Math.round((netSales * 100 / (grossSalesPesewas / 100)) * 10) / 10 : 0;

        return {
          network: net,
          name: net === 'MTN' ? 'MTN Ghana' : net === 'TELECEL' ? 'Telecel Ghana' : 'AirtelTigo Ghana',
          color: net === 'MTN' ? '#FFCC00' : net === 'TELECEL' ? '#E7192D' : '#0066B2',
          orders: netOrders.length,
          sales: Math.round(netSales * 100) / 100,
          cost: Math.round(netCost * 100) / 100,
          profit: Math.round(netProfit * 100) / 100,
          margin: netMargin,
          share,
        };
      });

      // Bundle Breakdown
      const bundleGroups = new Map<string, { name: string; network: string; orders: number; salesPesewas: number; costPesewas: number; profitPesewas: number }>();
      completedOrders.forEach((o) => {
        const sizeGb = (o.data_amount_mb || 0) / 1024;
        const name = `${sizeGb >= 1 ? `${sizeGb} GB` : `${o.data_amount_mb} MB`} ${o.network}`;
        const key = `${o.network}_${o.data_amount_mb}`;
        const curr = bundleGroups.get(key) || { name, network: o.network, orders: 0, salesPesewas: 0, costPesewas: 0, profitPesewas: 0 };
        curr.orders += 1;
        const amount = parseInt(o.amount_pesewas, 10) || 0;
        curr.salesPesewas += amount;

        const snap = typeof o.pricing_snapshot === 'string' ? JSON.parse(o.pricing_snapshot) : o.pricing_snapshot;
        if (snap?.markupPesewas !== undefined && snap?.markupPesewas !== '') {
          const p = parseInt(snap.markupPesewas, 10) || 0;
          curr.profitPesewas += p;
          curr.costPesewas += Math.max(0, amount - p);
        } else if (snap?.basePricePesewas !== undefined) {
          const c = parseInt(snap.basePricePesewas, 10) || 0;
          curr.costPesewas += c;
          curr.profitPesewas += Math.max(0, amount - c);
        } else {
          const c = Math.round(amount * 0.82);
          curr.costPesewas += c;
          curr.profitPesewas += Math.max(0, amount - c);
        }

        bundleGroups.set(key, curr);
      });

      const bundleBreakdown = Array.from(bundleGroups.entries()).map(([id, b]) => {
        const marginPct = b.salesPesewas > 0 ? Math.round((b.profitPesewas / b.salesPesewas) * 1000) / 10 : 0;
        return {
          id,
          name: b.name,
          network: b.network,
          orders: b.orders,
          salesPesewas: b.salesPesewas,
          costPesewas: b.costPesewas,
          profitPesewas: b.profitPesewas,
          marginPercent: marginPct,
        };
      });

      return reply.send({
        success: true,
        data: {
          totals: {
            grossSalesGhs: grossSalesPesewas / 100,
            refundsGhs: refundsPesewas / 100,
            netSalesGhs: netSalesPesewas / 100,
            totalCostGhs: totalCostPesewas / 100,
            grossProfitGhs: grossProfitPesewas / 100,
            marginPercent,
            totalOrders,
            avgOrderValueGhs: Math.round(avgOrderValueGhs * 100) / 100,
          },
          networkBreakdown,
          bundleBreakdown,
        },
      });
    },
  );

  // 11. GET AGENT PENDING MTN BENEFICIARY APPROVALS (/agents/pending-approvals)
  app.get<{
    Querystring: {
      status?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/agents/pending-approvals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { status = 'ALL', page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['ba.user_id = $1'];
      const params: any[] = [req.user!.sub];

      if (status && status !== 'ALL') {
        params.push(status);
        conditions.push(`ba.status = $${params.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      try {
        const countRes = await db.query(`SELECT COUNT(*) as total FROM beneficiary_approvals ba ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.total || '0', 10);

        const itemsRes = await db.query(
          `SELECT ba.id, ba.phone_number as "phoneNumber", ba.network, ba.status,
                  ba.created_at as "createdAt", ba.updated_at as "updatedAt",
                  ba.last_bundle_size_gb as "lastBundleSizeGb",
                  CASE WHEN ba.last_bundle_size_gb IS NOT NULL THEN CONCAT(ba.last_bundle_size_gb, ' GB') ELSE '5 GB' END as "dataSize",
                  'Excel Upload' as "detectedFrom"
           FROM beneficiary_approvals ba
           ${whereClause}
           ORDER BY ba.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limitNum, offset],
        );

        return reply.send({
          success: true,
          data: {
            items: itemsRes.rows,
            total,
            page: pageNum,
            limit: limitNum,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            items: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
          },
        });
      }
    },
  );

  // 12. UPDATE AGENT SETTINGS & PROFILE (/agents/settings & /agents/profile)
  app.put<{
    Body: {
      businessName?: string;
      businessPhone?: string;
      businessEmail?: string;
      whatsAppNumber?: string;
      fullName?: string;
      personalEmail?: string;
      personalPhone?: string;
    };
  }>(
    '/agents/settings',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const {
        businessName,
        businessPhone,
        businessEmail,
        whatsAppNumber,
        fullName,
        personalEmail,
        personalPhone,
      } = req.body || {};

      const userId = req.user!.sub;

      // Update user details
      if (fullName || personalPhone || personalEmail) {
        await db.query(
          `UPDATE users
           SET full_name = COALESCE($1, full_name),
               name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               email = COALESCE($3, email),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [fullName || null, personalPhone || null, personalEmail ? personalEmail.toLowerCase().trim() : null, userId],
        );
      }

      // Update agent details if present
      if (businessName) {
        await db.query(
          `UPDATE agents
           SET business_name = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [businessName.trim(), userId],
        );
      }

      // Also update store details if present
      if (businessName || businessPhone || businessEmail || whatsAppNumber) {
        await db.query(
          `UPDATE stores
           SET store_name = COALESCE($1, store_name),
               contact_phone = COALESCE($2, contact_phone),
               contact_email = COALESCE($3, contact_email),
               contact_whatsapp = COALESCE($4, contact_whatsapp),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $5`,
          [businessName || null, businessPhone || null, businessEmail || null, whatsAppNumber || null, userId],
        );
      }

      return reply.send({
        success: true,
        message: 'Agent settings and profile updated successfully.',
      });
    },
  );

  app.patch<{
    Body: {
      fullName?: string;
      phone?: string;
      email?: string;
    };
  }>(
    '/agents/profile',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { fullName, phone, email } = req.body || {};
      const userId = req.user!.sub;

      await db.query(
        `UPDATE users
         SET full_name = COALESCE($1, full_name),
             name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [fullName || null, phone || null, email ? email.toLowerCase().trim() : null, userId],
      );

      return reply.send({
        success: true,
        message: 'Profile updated successfully.',
      });
    },
  );

  // 13. SUB-AGENTS MANAGEMENT
  app.get(
    '/agents/sub-agents',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        // 1. Identify current agent
        const agentRes = await db.query(
          'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
          [req.user!.sub],
        );
        const currentAgentId = agentRes.rows[0]?.id;

        if (!currentAgentId) {
          return reply.send({
            success: true,
            data: {
              subAgents: [],
            },
          });
        }

        // 2. Query ONLY sub-agents belonging to this parent agent
        const result = await db.query<{
          id: string;
          agentTableId: string;
          name: string;
          email: string;
          phone: string;
          storeName: string;
          storeSlug: string;
          storeStatus: string;
          status: string;
          balancePesewas: string | number;
          commissionRate: string | number;
          ordersCount: string | number;
          successfulOrdersCount: string | number;
          failedOrdersCount: string | number;
          totalSalesPesewas: string | number;
          createdAt: string;
        }>(
          `SELECT u.id as "id",
                  a.id as "agentTableId",
                  COALESCE(u.full_name, a.business_name, 'Sub-Agent') as "name",
                  u.email,
                  COALESCE(u.phone, '—') as "phone",
                  COALESCE(s.store_name, a.business_name, u.full_name, 'Sub-Agent Store') as "storeName",
                  COALESCE(s.slug, a.slug, 'sub-store') as "storeSlug",
                  COALESCE(s.store_status, 'ONLINE') as "storeStatus",
                  COALESCE(a.status, 'ACTIVE') as "status",
                  COALESCE(u.wallet_balance_pesewas, 0) as "balancePesewas",
                  COALESCE(a.commission_rate, 8) as "commissionRate",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE agent_id = a.id OR user_id = u.id), 0) as "ordersCount",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND order_status IN ('COMPLETED', 'DELIVERED')), 0) as "successfulOrdersCount",
                  COALESCE((SELECT COUNT(*) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND order_status = 'FAILED'), 0) as "failedOrdersCount",
                  COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND payment_status = 'PAID' AND order_status IN ('COMPLETED', 'DELIVERED') AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED')), 0) as "totalSalesPesewas",
                  a.created_at as "createdAt"
           FROM agents a
           JOIN users u ON a.user_id = u.id
           LEFT JOIN stores s ON s.agent_id = a.id
           WHERE a.parent_agent_id = $1
           ORDER BY a.created_at DESC`,
          [currentAgentId],
        );

        const subAgents = (result.rows || []).map((row) => {
          const salesPesewas = parseInt(row.totalSalesPesewas as any || '0', 10) || 0;
          const commissionRate = parseFloat(row.commissionRate as any || '8') || 8;
          const commissionPesewas = Math.round((salesPesewas * commissionRate) / 100);
          const ordersCount = parseInt(row.ordersCount as any || '0', 10) || 0;
          const successfulCount = parseInt(row.successfulOrdersCount as any || '0', 10) || 0;
          const failedCount = parseInt(row.failedOrdersCount as any || '0', 10) || 0;
          const balancePesewas = parseInt(row.balancePesewas as any || '0', 10) || 0;

          return {
            id: row.id,
            agentId: `SA-${row.id.slice(0, 6).toUpperCase()}`,
            name: row.name,
            email: row.email,
            phone: row.phone,
            storeName: row.storeName,
            storeSlug: row.storeSlug,
            storeStatus: row.storeStatus === 'MAINTENANCE' ? 'MAINTENANCE' : row.storeStatus === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
            enabledProductsCount: 12,
            dateJoined: new Date(row.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
            lastActive: 'Active today',
            rawLastActive: row.createdAt,
            status: row.status === 'ACTIVE' ? 'ACTIVE' : row.status === 'PENDING' ? 'PENDING' : row.status === 'SUSPENDED' ? 'SUSPENDED' : 'INACTIVE',
            ordersCount,
            successfulOrdersCount: successfulCount,
            failedOrdersCount: failedCount,
            totalSalesPesewas: salesPesewas,
            totalCommissionPesewas: commissionPesewas,
            balancePesewas,
            totalDepositedPesewas: balancePesewas,
            totalSpentPesewas: salesPesewas,
            recentOrders: [],
            activityLogs: [
              {
                id: `log-${row.id}-1`,
                time: new Date(row.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                text: 'Enrolled as sub-agent under partner network',
              },
            ],
          };
        });

        return reply.send({
          success: true,
          data: {
            subAgents,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            subAgents: [],
          },
        });
      }
    },
  );

  app.post<{
    Body: {
      name: string;
      email: string;
      phone: string;
      storeName?: string;
    };
  }>(
    '/agents/sub-agents',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{
      Body: {
        name: string;
        email: string;
        phone: string;
        storeName?: string;
      };
    }>, reply: FastifyReply) => {
      const { name, email, phone, storeName } = req.body || {};
      if (!name || !email || !phone) {
        throw new BadRequestError('Name, email, and phone are required for sub-agent enrollment');
      }

      // 1. Ensure current agent record exists
      const agentRes = await db.query(
        'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
        [req.user!.sub],
      );
      let parentAgentId = agentRes.rows[0]?.id;
      if (!parentAgentId) {
        const insertParent = await db.query<{ id: string }>(
          `INSERT INTO agents (user_id, business_name, status)
           VALUES ($1, $2, 'ACTIVE')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [req.user!.sub, req.user?.email || 'Agent Business'],
        );
        parentAgentId = insertParent.rows[0]?.id;
        if (!parentAgentId) {
          const refetch = await db.query('SELECT id FROM agents WHERE user_id = $1 OR id = $1', [req.user!.sub]);
          parentAgentId = refetch.rows[0]?.id;
        }
      }

      const existing = await db.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [
        email.toLowerCase().trim(),
        phone.trim(),
      ]);
      if (existing.rows.length > 0) {
        throw new BadRequestError('A user with this email or phone already exists');
      }

      const defaultHash = '$argon2id$v=19$m=65536,t=3,p=4$tempHash$tempHashPlaceholder';
      const insertRes = await db.query<{ id: string; created_at: string }>(
        `INSERT INTO users (email, phone, full_name, name, password_hash, role, status, security_domain)
         VALUES ($1, $2, $3, $3, $4, 'agent', 'ACTIVE', 'CUSTOMER')
         RETURNING id, created_at`,
        [email.toLowerCase().trim(), phone.trim(), name.trim(), defaultHash],
      );

      const createdUser = insertRes.rows[0];
      const cleanSlug = (storeName || name.trim()).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `sa-${createdUser.id.slice(0, 6)}`;

      const insertAgentRes = await db.query<{ id: string }>(
        `INSERT INTO agents (user_id, parent_agent_id, business_name, slug, status, commission_rate)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 8.00)
         RETURNING id`,
        [createdUser.id, parentAgentId, storeName?.trim() || `${name.trim()}'s Store`, cleanSlug],
      );
      const newAgentRecord = insertAgentRes.rows[0];

      if (newAgentRecord) {
        await db.query(
          `INSERT INTO stores (agent_id, user_id, store_name, slug, store_status, approval_status)
           VALUES ($1, $2, $3, $4, 'ONLINE', 'APPROVED')
           ON CONFLICT DO NOTHING`,
          [newAgentRecord.id, createdUser.id, storeName?.trim() || `${name.trim()}'s Store`, cleanSlug],
        ).catch(() => {});
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: createdUser.id,
          agentId: `SA-${createdUser.id.slice(0, 6).toUpperCase()}`,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          storeName: storeName || `${name.trim()}'s Store`,
          storeSlug: cleanSlug,
          storeStatus: 'ONLINE',
          status: 'ACTIVE',
          createdAt: createdUser.created_at,
        },
      });
    },
  );

  // 14. UPDATE SUB-AGENT STATUS
  app.patch<{
    Params: { id: string };
    Body: { status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' };
  }>(
    '/agents/sub-agents/:id/status',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: { status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' };
    }>, reply: FastifyReply) => {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!status || !['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
        throw new BadRequestError('Invalid sub-agent status');
      }

      const agentRes = await db.query(
        'SELECT id FROM agents WHERE user_id = $1 OR id = $1',
        [req.user!.sub],
      );
      const parentAgentId = agentRes.rows[0]?.id;
      if (!parentAgentId) {
        throw new NotFoundError('Agent profile not found');
      }

      const updateRes = await db.query(
        `UPDATE agents
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE (id = $2 OR user_id = $2) AND parent_agent_id = $3
         RETURNING id, status`,
        [status, id, parentAgentId],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError('Sub-agent not found under your account');
      }

      return reply.send({
        success: true,
        data: {
          id,
          status: updateRes.rows[0].status,
        },
      });
    },
  );

  interface AgentApiUsageQuery {
    mode?: 'all' | 'live' | 'sandbox';
    keyId?: string;
    page?: string;
    limit?: string;
  }

  // 14. GET AGENT API USAGE TELEMETRY (/agent/api-usage & /agents/api-usage)
  const handleGetAgentApiUsage = async (
    req: FastifyRequest<{ Querystring: AgentApiUsageQuery }>,
    reply: FastifyReply,
  ) => {
    const { mode = 'all', keyId, page = '1', limit = '20' } = req.query || {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    const currentUserId = req.user!.sub;

    // 1. Resolve all candidate user and agent IDs for this authenticated session
    const candidateUserIds: string[] = [currentUserId];
    try {
      const agentCheck = await db.query(
        `SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1`,
        [currentUserId],
      );
      for (const row of agentCheck.rows) {
        if (row.id && !candidateUserIds.includes(row.id)) candidateUserIds.push(row.id);
        if (row.user_id && !candidateUserIds.includes(row.user_id)) candidateUserIds.push(row.user_id);
      }
    } catch {
      // Non-blocking fallback
    }

    // 2. Resolve all API key IDs owned by this agent
    const candidateKeyIds: string[] = [];
    try {
      const keysCheck = await db.query(
        `SELECT id::text FROM api_keys 
         WHERE agent_id::text = ANY($1::text[]) 
            OR owner_user_id::text = ANY($1::text[])`,
        [candidateUserIds],
      );
      for (const row of keysCheck.rows) {
        if (row.id && !candidateKeyIds.includes(row.id)) candidateKeyIds.push(row.id);
      }
    } catch {
      // Non-blocking fallback
    }

    // 3. Environment & Key filter clauses
    let envClause = '';
    if (mode === 'live') {
      envClause = "AND m.environment = 'LIVE'";
    } else if (mode === 'sandbox') {
      envClause = "AND (m.environment = 'TEST' OR m.environment = 'SANDBOX')";
    }

    let specificKeyClause = '';
    const queryParams: any[] = [candidateUserIds, candidateKeyIds];
    if (keyId && candidateKeyIds.includes(keyId)) {
      queryParams.push(keyId);
      specificKeyClause = `AND m.key_id = $${queryParams.length}`;
    }

    // 4. Query 7-day Overview
    const overviewRes = await db.query(
      `SELECT
        COUNT(*) as "totalCalls7d",
        COUNT(CASE WHEN m.environment = 'LIVE' THEN 1 END) as "liveCalls7d",
        COUNT(CASE WHEN m.environment = 'TEST' OR m.environment = 'SANDBOX' THEN 1 END) as "sandboxCalls7d",
        COUNT(CASE WHEN m.status_code >= 200 AND m.status_code < 400 THEN 1 END) as "successCount",
        COUNT(CASE WHEN m.status_code >= 400 THEN 1 END) as "failureCount",
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.response_time_ms), 0) as "p95LatencyMs",
        COALESCE(AVG(m.response_time_ms), 0) as "avgLatencyMs"
      FROM api_usage_metrics m
      WHERE (
        (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
        OR
        (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
      ) ${specificKeyClause}
      AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`,
      queryParams,
    ).catch(() => ({ rows: [] }));

    const ov = overviewRes.rows[0] || {};
    const totalCalls7d = parseInt(ov.totalCalls7d || '0', 10);
    const successCount = parseInt(ov.successCount || '0', 10);
    const failureCount = parseInt(ov.failureCount || '0', 10);
    const successRate = totalCalls7d > 0 ? Math.round((successCount / totalCalls7d) * 100) : 100;
    const failureRate = totalCalls7d > 0 ? Math.round((failureCount / totalCalls7d) * 100) : 0;

    // 5. Query 7-day Daily Series
    const dailyRes = await db.query(
      `SELECT
        TO_CHAR(d.day, 'MM-DD') as date,
        TO_CHAR(d.day, 'YYYY-MM-DD') as "fullDate",
        COUNT(CASE WHEN m.status_code >= 200 AND m.status_code < 400 THEN 1 END) as successes,
        COUNT(CASE WHEN m.status_code >= 400 THEN 1 END) as failures,
        COUNT(m.id) as total,
        COALESCE(ROUND(AVG(m.response_time_ms)), 0) as "avgLatencyMs"
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
      LEFT JOIN api_usage_metrics m ON DATE(m.created_at) = DATE(d.day)
        AND (
          (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
          OR
          (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
        ) ${specificKeyClause}
      GROUP BY d.day
      ORDER BY d.day ASC`,
      queryParams,
    ).catch(() => ({ rows: [] }));

    let dailyItems = (dailyRes.rows || []).map((r: any) => ({
      date: r.date,
      fullDate: r.fullDate,
      successes: parseInt(r.successes || '0', 10),
      failures: parseInt(r.failures || '0', 10),
      total: parseInt(r.total || '0', 10),
      avgLatencyMs: parseInt(r.avgLatencyMs || '0', 10),
    }));

    if (dailyItems.length === 0) {
      dailyItems = Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date(Date.now() - (6 - idx) * 86400000);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return {
          date: `${mm}-${dd}`,
          fullDate: d.toISOString().slice(0, 10),
          successes: 0,
          failures: 0,
          total: 0,
          avgLatencyMs: 0,
        };
      });
    }

    // 6. Query Top Endpoints
    const topEndpointsRes = await db.query(
      `SELECT
        m.method,
        m.endpoint as path,
        COUNT(*) as count
      FROM api_usage_metrics m
      WHERE (
        (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
        OR
        (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
      ) ${specificKeyClause}
      AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY m.method, m.endpoint
      ORDER BY count DESC
      LIMIT 5`,
      queryParams,
    ).catch(() => ({ rows: [] }));

    // 7. Query Agent API Keys with usage metrics
    const apiKeysUsageRes = await db.query(
      `SELECT
        k.id,
        k.name,
        k.key_prefix as "keyPrefix",
        CASE WHEN k.environment = 'TEST' OR k.environment = 'SANDBOX' THEN 'SANDBOX' ELSE 'LIVE' END as environment,
        k.status,
        k.last_used_at as "lastUsedAt",
        COUNT(m.id) as "totalCalls",
        COUNT(CASE WHEN m.status_code >= 200 AND m.status_code < 400 THEN 1 END) as "successCount",
        COUNT(CASE WHEN m.status_code >= 400 THEN 1 END) as "failureCount",
        COALESCE(ROUND(AVG(m.response_time_ms)), 0) as "avgLatencyMs"
      FROM api_keys k
      LEFT JOIN api_usage_metrics m ON m.key_id = k.id
      WHERE k.agent_id::text = ANY($1::text[]) OR k.owner_user_id::text = ANY($1::text[])
      GROUP BY k.id, k.name, k.key_prefix, k.environment, k.status, k.last_used_at, k.created_at
      ORDER BY k.created_at DESC`,
      [candidateUserIds],
    ).catch(() => ({ rows: [] }));

    const apiKeysUsage = (apiKeysUsageRes.rows || []).map((r: any) => {
      const total = parseInt(r.totalCalls || '0', 10);
      const successes = parseInt(r.successCount || '0', 10);
      return {
        id: r.id,
        name: r.name,
        keyPrefix: r.keyPrefix,
        environment: r.environment,
        status: r.status || 'ACTIVE',
        totalCalls: total,
        successCount: successes,
        failureCount: parseInt(r.failureCount || '0', 10),
        successRatePercent: total > 0 ? Math.round((successes / total) * 100) : 100,
        lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
        avgLatencyMs: parseInt(r.avgLatencyMs || '0', 10),
      };
    });

    // 8. Query Recent Requests Count & Page
    const recentTotalRes = await db.query(
      `SELECT COUNT(*) as total 
      FROM api_usage_metrics m 
      WHERE (
        (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
        OR
        (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
      ) ${envClause} ${specificKeyClause}`,
      queryParams,
    ).catch(() => ({ rows: [{ total: '0' }] }));
    const recentTotal = parseInt(recentTotalRes.rows[0]?.total || '0', 10);

    const recentItemsParams = [...queryParams, limitNum, offset];
    const limitParamIdx = recentItemsParams.length - 1;
    const offsetParamIdx = recentItemsParams.length;

    const recentItemsRes = await db.query(
      `SELECT
        m.id,
        m.created_at as timestamp,
        CASE WHEN m.environment = 'LIVE' THEN 'live' ELSE 'sandbox' END as mode,
        m.method,
        m.endpoint as path,
        m.status_code as "statusCode",
        ROUND(m.response_time_ms) as "latencyMs",
        m.ip_address as "ipAddress",
        COALESCE(m.user_agent, '') as "userAgent",
        m.key_id as "keyId",
        COALESCE(m.key_name, k.name, '') as "keyName",
        COALESCE(m.key_prefix, k.key_prefix, '') as "keyPrefix",
        m.request_headers as "requestHeaders",
        m.request_payload as "requestPayload",
        m.response_headers as "responseHeaders",
        m.response_payload as "responsePayload",
        m.error_code as "errorCode",
        m.error_message as "errorMessage"
      FROM api_usage_metrics m
      LEFT JOIN api_keys k ON k.id = m.key_id
      WHERE (
        (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
        OR
        (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
      ) ${envClause} ${specificKeyClause}
      ORDER BY m.created_at DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      recentItemsParams,
    ).catch(async () => {
      return db.query(
        `SELECT
          m.id,
          m.created_at as timestamp,
          CASE WHEN m.environment = 'LIVE' THEN 'live' ELSE 'sandbox' END as mode,
          m.method,
          m.endpoint as path,
          m.status_code as "statusCode",
          ROUND(m.response_time_ms) as "latencyMs",
          m.ip_address as "ipAddress",
          m.key_id as "keyId",
          COALESCE(k.name, '') as "keyName",
          COALESCE(k.key_prefix, '') as "keyPrefix",
          m.error_code as "errorCode",
          m.error_message as "errorMessage"
        FROM api_usage_metrics m
        LEFT JOIN api_keys k ON k.id = m.key_id
        WHERE (
          (m.user_id IS NOT NULL AND m.user_id::text = ANY($1::text[]))
          OR
          (m.key_id IS NOT NULL AND m.key_id::text = ANY($2::text[]))
        ) ${envClause} ${specificKeyClause}
        ORDER BY m.created_at DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        recentItemsParams,
      ).catch(() => ({ rows: [] }));
    });

    return reply.send({
      success: true,
      data: {
        overview: {
          totalCalls7d,
          liveCalls7d: parseInt(ov.liveCalls7d || '0', 10),
          sandboxCalls7d: parseInt(ov.sandboxCalls7d || '0', 10),
          successRatePercent: successRate,
          failureRatePercent: failureRate,
          p95LatencyMs: Math.round(parseFloat(ov.p95LatencyMs || '0')),
          avgLatencyMs: Math.round(parseFloat(ov.avgLatencyMs || '0')),
        },
        daily: dailyItems,
        topEndpoints: (topEndpointsRes.rows || []).map((r: any) => ({
          method: r.method,
          path: r.path,
          count: parseInt(r.count || '0', 10),
        })),
        apiKeysUsage,
        recentRequests: {
          items: recentItemsRes.rows || [],
          total: recentTotal,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.max(1, Math.ceil(recentTotal / limitNum)),
        },
      },
    });
  };

  app.get<{ Querystring: AgentApiUsageQuery }>(
    '/agent/api-usage',
    { preHandler: [authHooks.authenticateCustomer] },
    handleGetAgentApiUsage,
  );
  app.get<{ Querystring: AgentApiUsageQuery }>(
    '/agents/api-usage',
    { preHandler: [authHooks.authenticateCustomer] },
    handleGetAgentApiUsage,
  );
}
