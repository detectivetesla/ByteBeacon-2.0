import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';
import { OrderService } from '../../core/commerce/order.service.js';
import { AgentWebhookDispatcherService } from '../../core/webhooks/agent-webhook-dispatcher.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createMaintenanceHook } from '../../plugins/maintenance.plugin.js';
import { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import { BadRequestError, NotFoundError, ConflictError, InvalidPhoneError, BeneficiaryNotValidatedError } from '../../core/errors/app-error.js';
import {
  ApplyAgentRequest,
  AgentProfileDto,
  ApiResponse,
  Currency,
  PaymentMethod,
  LedgerEntryType,
  LedgerAccountType,
  Permission,
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
}

export async function agentRoutes(
  app: FastifyInstance,
  deps: AgentRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, ledgerService, paymentProvider } = deps;
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const orderService = deps.orderService ?? (app as any).orderService;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const maintenanceHook = createMaintenanceHook(featureFlagService);

  interface ListAgentOrdersQuery {
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
      status,
      network,
      paymentStatus,
      after,
      before,
      search,
      page,
      limit,
    } = req.query;

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;

    let result;
    if (orderService) {
      result = await orderService.listAgentOrders({
        agentOrUserId: req.user!.sub,
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

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: {
        data: result.data,
        orders: result.data,
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

    const order = await orderService.getAgentOrderById(id, req.user!.sub);

    return reply.status(200).send({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: order,
    });
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

      const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
      const isSandbox =
        Boolean((req as any).apiKey?.isSandbox) ||
        Boolean((req.user as any)?.isSandbox) ||
        apiKeyHeader.startsWith('ak_test_');

      // First-time MTN validation check
      const normalizedLocal = cleanPhone.startsWith('+233') ? `0${cleanPhone.slice(4)}` : cleanPhone;
      const isMtn = /^(?:\+233|0)(?:24|25|54|55|59)\d{7}$/.test(cleanPhone);

      if (isMtn && !isSandbox) {
        const validatedCheck = await db.query(
          `SELECT 1 FROM beneficiary_validation
           WHERE (phone_number = $1 OR phone_number = $2)
             AND network = 'MTN'
             AND validation_status = 'VALID'
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           UNION
           SELECT 1 FROM orders
           WHERE (recipient_phone = $1 OR recipient_phone = $2)
             AND network = 'MTN'
             AND order_status IN ('COMPLETED', 'DELIVERED', 'PROCESSING', 'SUBMITTED')
           LIMIT 1`,
          [normalizedLocal, `+233${normalizedLocal.slice(1)}`],
        );

        if (validatedCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO pending_beneficiary_approvals (
                phone_number, network, agent_id, status, created_at, updated_at
             ) VALUES ($1, 'MTN', $2, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING`,
            [normalizedLocal, req.user!.sub],
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

      const { order } = await orderService.createOrder(
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

      // Dispatch order.received webhook event to agent
      const targetAgentId = order.agentId || req.user!.sub;
      if (targetAgentId) {
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

      return reply.status(201).send({
        success: true,
        statusCode: 201,
        message: 'Order placed and queued for processing.',
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
          status: 'received',
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
          const digits = search.replace(/\D/g, '');
          approvalConditions.push(`phone_number ILIKE $${aIdx++}`);
          approvalParams.push(`%${digits || search.trim()}%`);
        }

        const approvalWhere = `WHERE ${approvalConditions.join(' AND ')}`;

        const countRes = await db.query(
          `SELECT COUNT(*) as total FROM pending_beneficiary_approvals ${approvalWhere}`,
          approvalParams,
        ).catch(() => null);

        if (countRes && parseInt(countRes.rows[0]?.total || '0', 10) > 0) {
          total = parseInt(countRes.rows[0]?.total || '0', 10);
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
              resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
            };
          });
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

  // 2. APPLY AS AGENT
  app.post<{ Body: ApplyAgentRequest }>(
    '/agents/apply',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: ApplyAgentRequest }>, reply: FastifyReply) => {
      const { businessName, slug } = req.body || {};

      if (!businessName || !slug) {
        throw new BadRequestError('Business name and store slug are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check if user already is an agent
      const existingUser = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('You have already applied or have an active agent account');
      }

      // Check slug uniqueness
      const existingSlug = await db.query('SELECT id FROM agents WHERE slug = $1', [cleanSlug]);
      if (existingSlug.rows.length > 0) {
        throw new ConflictError('Storefront slug is already taken. Please choose another.');
      }

      const insertRes = await db.query(
        `INSERT INTO agents (user_id, business_name, slug, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, user_id as "userId", business_name as "businessName",
                   slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
        [req.user!.sub, businessName.trim(), cleanSlug],
      );

      // Update user role to agent
      await db.query("UPDATE users SET role = 'agent' WHERE id = $1", [req.user!.sub]);

      const r = insertRes.rows[0];
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

      return reply.status(201).send(response);
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

      return {
        id: r.referenceId || `TXN-${r.id.substring(0, 8).toUpperCase()}`,
        ledgerId: r.id,
        type: inferredType,
        method: inferredType === 'DEPOSIT' ? 'Paystack' : inferredType === 'PURCHASE' ? 'Wallet' : 'Internal',
        amountPesewas: Number(r.amountPesewas),
        feePesewas: inferredType === 'DEPOSIT' ? Math.round(Number(r.amountPesewas) * 0.03) : 0,
        isCredit,
        description: r.description,
        status: 'SUCCESSFUL',
        date: new Date(r.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawDate: new Date(r.createdAt).toISOString(),
      };
    });

    return reply.send({
      success: true,
      data: {
        items,
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

  // 4. GET AGENT / CUSTOMER WALLET BALANCE
  const handleGetWalletBalance = async (req: FastifyRequest, reply: FastifyReply) => {
    let balancePesewas = 0;
    if (ledgerService) {
      const bal = await ledgerService.getAccountBalance(LedgerAccountType.CUSTOMER_WALLET, req.user!.sub);
      balancePesewas = bal.balancePesewas;
    } else {
      const res = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as balance
         FROM financial_ledger WHERE account_id = $1`,
        [req.user!.sub],
      );
      balancePesewas = Number(res.rows[0]?.balance || 0);
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
  app.post<{ Body: { amountPesewas: number; callbackUrl?: string } }>(
    '/agents/wallet/topup/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: { amountPesewas: number; callbackUrl?: string } }>, reply: FastifyReply) => {
      const { amountPesewas, callbackUrl } = req.body || {};
      if (!amountPesewas || amountPesewas < 100) {
        throw new BadRequestError('Minimum top-up amount is GH₵ 1.00 (100 pesewas)');
      }

      if (paymentProvider) {
        const initRes = await paymentProvider.initializePayment({
          orderId: `topup_${req.user!.sub}_${Date.now()}`,
          email: req.user!.email || 'agent@bytebeacon.com',
          amountPesewas,
          currency: Currency.GHS,
          paymentMethod: PaymentMethod.MOMO,
          callbackUrl: callbackUrl || 'https://bytebeacon.online/agent/wallet',
          metadata: {
            type: 'WALLET_TOPUP',
            userId: req.user!.sub,
          },
        });

        return reply.send({
          success: true,
          data: {
            authorizationUrl: initRes.authorizationUrl,
            reference: initRes.providerReference,
          },
        });
      }

      const reference = `pst_topup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return reply.send({
        success: true,
        data: {
          authorizationUrl: `https://checkout.paystack.com/${reference}`,
          reference,
        },
      });
    },
  );

  // 6. VERIFY WALLET TOPUP & POST DOUBLE-ENTRY JOURNAL
  app.post<{ Body: { reference: string } }>(
    '/agents/wallet/topup/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: { reference: string } }>, reply: FastifyReply) => {
      const { reference } = req.body || {};
      if (!reference) {
        throw new BadRequestError('Payment reference is required');
      }

      let verifiedAmountPesewas = 5000;
      if (paymentProvider) {
        const verifyRes = await paymentProvider.verifyPayment(reference);
        if (verifyRes.status !== 'SUCCESS') {
          throw new BadRequestError(`Payment verification failed: status is ${verifyRes.status}`);
        }
        verifiedAmountPesewas = verifyRes.amountPesewas;
      }

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
            accountId: req.user!.sub,
            amountPesewas: verifiedAmountPesewas,
            currency: Currency.GHS,
            referenceType: 'DEPOSIT',
            referenceId: reference,
            description: `Paystack wallet deposit credited (${reference})`,
          },
        ]);
      }

      return reply.send({
        success: true,
        data: {
          success: true,
          newBalancePesewas: verifiedAmountPesewas,
        },
      });
    },
  );

  // 7. AGENT PROFIT WITHDRAWALS
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
        throw new BadRequestError('Payout method, account number, and account name are required');
      }

      // Check agent wallet balance
      let currentBalancePesewas = 0;
      try {
        const balRes = await db.query<{ wallet_balance: string; wallet_balance_pesewas: string }>(
          'SELECT wallet_balance, wallet_balance_pesewas FROM users WHERE id = $1',
          [req.user!.sub],
        );
        if (balRes.rows[0]) {
          const row = balRes.rows[0];
          if (row.wallet_balance_pesewas !== null && row.wallet_balance_pesewas !== undefined) {
            currentBalancePesewas = parseInt(row.wallet_balance_pesewas, 10) || 0;
          } else if (row.wallet_balance) {
            currentBalancePesewas = Math.round(parseFloat(row.wallet_balance) * 100) || 0;
          }
        }
      } catch {
        currentBalancePesewas = 0;
      }

      if (currentBalancePesewas < amountPesewas) {
        throw new BadRequestError(`Insufficient balance. Available: GH₵ ${(currentBalancePesewas / 100).toFixed(2)}`);
      }

      const withdrawalId = `wth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reference = `PAYOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      // Post double-entry journal to debit wallet and credit payout escrow
      if (ledgerService) {
        const platformAccountId = '00000000-0000-0000-0000-000000000000';
        await ledgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: req.user!.sub,
            amountPesewas,
            currency: Currency.GHS,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            description: `Agent profit withdrawal to ${payoutMethod} (${accountNumber})`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformAccountId,
            amountPesewas,
            currency: Currency.GHS,
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            description: `Payout processing escrow for withdrawal (${withdrawalId})`,
          },
        ]);
      }

      // Update user wallet balance cache
      try {
        await db.query(
          `UPDATE users
           SET wallet_balance_pesewas = GREATEST(0, COALESCE(wallet_balance_pesewas, 0) - $1),
               wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - ($1::numeric / 100))
           WHERE id = $2`,
          [amountPesewas, req.user!.sub],
        );
      } catch {
        // Continue
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: withdrawalId,
          reference,
          amountPesewas,
          feePesewas: 0,
          method: payoutMethod === 'BANK' ? `${bankName || 'Bank'} Account` : payoutMethod.replace('_', ' '),
          recipientAccount: accountNumber,
          recipientName: accountName,
          status: 'PROCESSING',
          createdAt: new Date().toISOString(),
        },
      });
    },
  );

  // 7. GET AGENT WITHDRAWALS
  app.get(
    '/agents/withdrawals',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await db.query<{
          id: string;
          reference_id: string;
          amount_pesewas: string;
          description: string;
          created_at: string;
        }>(
          `SELECT id, reference_id, amount_pesewas, description, created_at
           FROM financial_ledger
           WHERE account_id = $1 AND reference_type = 'WITHDRAWAL' AND entry_type = 'DEBIT'
           ORDER BY created_at DESC
           LIMIT 50`,
          [req.user!.sub],
        );

        const withdrawals = (result.rows || []).map((row) => ({
          id: row.id,
          reference: row.reference_id || `PAYOUT-${row.id.slice(0, 8).toUpperCase()}`,
          amountPesewas: parseInt(row.amount_pesewas, 10) || 0,
          feePesewas: 0,
          method: 'Mobile Money',
          recipientAccount: '—',
          recipientName: 'Agent Payout',
          status: 'COMPLETED',
          date: new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          rawDate: row.created_at,
        }));

        return reply.send({
          success: true,
          data: {
            withdrawals,
          },
        });
      } catch {
        return reply.send({
          success: true,
          data: {
            withdrawals: [],
          },
        });
      }
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
        `SELECT o.id, o.network, o.data_amount_mb, o.amount_pesewas, o.order_status, o.payment_status, o.refund_status, o.created_at
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

      // Estimated wholesale base cost (82% of sales price on average)
      const totalCostPesewas = Math.round(netSalesPesewas * 0.82);
      const grossProfitPesewas = netSalesPesewas - totalCostPesewas;
      const marginPercent = netSalesPesewas > 0 ? Math.round((grossProfitPesewas / netSalesPesewas) * 1000) / 10 : 0;
      const totalOrders = completedOrders.length;
      const avgOrderValueGhs = totalOrders > 0 ? (netSalesPesewas / totalOrders / 100) : 0;

      // Network Breakdown
      const networks = ['MTN', 'TELECEL', 'AIRTELTIGO'];
      const networkBreakdown = networks.map((net) => {
        const netOrders = completedOrders.filter((o) => o.network === net);
        const netSales = netOrders.reduce((sum, o) => sum + (parseInt(o.amount_pesewas, 10) || 0), 0) / 100;
        const netCost = netSales * 0.82;
        const netProfit = netSales - netCost;
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
      const bundleGroups = new Map<string, { name: string; network: string; orders: number; salesPesewas: number }>();
      completedOrders.forEach((o) => {
        const sizeGb = (o.data_amount_mb || 0) / 1024;
        const name = `${sizeGb >= 1 ? `${sizeGb} GB` : `${o.data_amount_mb} MB`} ${o.network}`;
        const key = `${o.network}_${o.data_amount_mb}`;
        const curr = bundleGroups.get(key) || { name, network: o.network, orders: 0, salesPesewas: 0 };
        curr.orders += 1;
        curr.salesPesewas += parseInt(o.amount_pesewas, 10) || 0;
        bundleGroups.set(key, curr);
      });

      const bundleBreakdown = Array.from(bundleGroups.entries()).map(([id, b]) => {
        const costPesewas = Math.round(b.salesPesewas * 0.82);
        const profitPesewas = b.salesPesewas - costPesewas;
        const marginPct = b.salesPesewas > 0 ? Math.round((profitPesewas / b.salesPesewas) * 1000) / 10 : 0;
        return {
          id,
          name: b.name,
          network: b.network,
          orders: b.orders,
          salesPesewas: b.salesPesewas,
          costPesewas,
          profitPesewas,
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
                  ba.created_at as "createdAt", ba.updated_at as "updatedAt"
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
                  COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND payment_status = 'PAID'), 0) as "totalSalesPesewas",
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
}


