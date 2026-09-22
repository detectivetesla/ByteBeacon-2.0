import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { FulfillmentQueueService } from '../../core/providers/fulfillment-queue.service.js';
import { ProviderReconciliationService } from '../../core/providers/provider-reconciliation.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import * as XLSX from 'xlsx';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import {
  NetworkProvider,
  LedgerEntryType,
  LedgerAccountType,
  AuditCategory,
  AuditSeverity,
  AuditSource,
  AuditResult,
} from '@bytebeacon/shared';

export interface AdminOrdersRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  fulfillmentQueueService: FulfillmentQueueService;
  providerReconciliationService: ProviderReconciliationService;
  financialLedgerService?: FinancialLedgerService;
}

export interface OrderFilterQueryParams {
  search?: string;
  lifecycle?: string;
  paymentStatus?: string;
  provider?: string;
  network?: string;
  source?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  operationalState?: string;
}

export async function adminOrdersRoutes(
  app: FastifyInstance,
  deps: AdminOrdersRouteDependencies,
) {
  const {
    db,
    tokenService,
    apiKeyService,
    rbacService,
    auditService,
    fulfillmentQueueService,
    providerReconciliationService,
    financialLedgerService,
  } = deps;

  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper to sanitize JSON payloads and redact secrets/credentials
  const sanitizePayload = (payload: any): any => {
    if (!payload || typeof payload !== 'object') return payload;
    const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };
    const sensitiveKeys = ['secret', 'apiKey', 'token', 'password', 'authorization', 'api_key', 'privateKey'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizePayload(sanitized[key]);
      }
    }
    return sanitized;
  };

  // Self-healing migration verification for paused orders schema
  const ensurePausedOrdersSchema = async () => {
    try {
      await db.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS paused_from_status VARCHAR(30);

        DO $$
        DECLARE
            constraint_name TEXT;
        BEGIN
            SELECT con.conname INTO constraint_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = rel.oid
                AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = 'orders'
              AND att.attname = 'order_status'
              AND con.contype = 'c';

            IF constraint_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
            END IF;

            ALTER TABLE orders
                ADD CONSTRAINT orders_order_status_check
                CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'));
        END $$;

        CREATE INDEX IF NOT EXISTS idx_orders_is_paused ON orders(is_paused) WHERE is_paused = true;
        CREATE INDEX IF NOT EXISTS idx_orders_paused_status ON orders(order_status) WHERE order_status = 'PAUSED';
      `);
    } catch {
      // Non-fatal in test mocks or offline
    }
  };
  ensurePausedOrdersSchema().catch(() => {});

  function buildOrderFilterClause(query: OrderFilterQueryParams = {}, startIdx = 1) {
    const whereConditions: string[] = [];
    const params: any[] = [];
    let idx = startIdx;

    if (query.lifecycle && query.lifecycle !== 'ALL') {
      if (query.lifecycle === 'COMPLETED') {
        whereConditions.push(`(o.order_status IN ('COMPLETED', 'DELIVERED', 'FULFILLED') OR po.provider_status IN ('COMPLETED', 'FULFILLED'))`);
      } else if (query.lifecycle === 'REFUNDED') {
        whereConditions.push(`(o.order_status = 'REFUNDED' OR o.refund_status = 'COMPLETED')`);
      } else if (query.lifecycle === 'PAUSED') {
        whereConditions.push(`(o.order_status = 'PAUSED' OR o.is_paused = true)`);
      } else {
        whereConditions.push(`o.order_status = $${idx}`);
        params.push(query.lifecycle);
        idx++;
      }
    }

    if (query.paymentStatus && query.paymentStatus !== 'ALL') {
      if (query.paymentStatus === 'UNPAID') {
        whereConditions.push(`o.payment_status IN ('PENDING', 'PROCESSING', 'UNPAID')`);
      } else {
        whereConditions.push(`o.payment_status = $${idx}`);
        params.push(query.paymentStatus);
        idx++;
      }
    }

    if (query.network && query.network !== 'ALL') {
      if (query.network === 'AIRTELTIGO' || query.network === 'AT') {
        whereConditions.push(`o.network IN ('AIRTELTIGO', 'AT')`);
      } else {
        whereConditions.push(`o.network = $${idx}`);
        params.push(query.network);
        idx++;
      }
    }

    if (query.provider && query.provider !== 'ALL') {
      whereConditions.push(`po.provider_name = $${idx}`);
      params.push(query.provider);
      idx++;
    }

    if (query.source && query.source !== 'ALL') {
      if (query.source === 'AGENT') {
        whereConditions.push(`o.agent_id IS NOT NULL`);
      } else if (query.source === 'CUSTOMER') {
        whereConditions.push(`o.agent_id IS NULL`);
      }
    }

    if (query.search && query.search.trim() !== '') {
      const term = `%${query.search.trim().toLowerCase()}%`;
      whereConditions.push(`(
        o.id::text LIKE $${idx} OR
        LOWER(COALESCE(o.recipient_phone, '')) LIKE $${idx} OR
        LOWER(COALESCE(u.email, '')) LIKE $${idx} OR
        LOWER(COALESCE(u.full_name, '')) LIKE $${idx} OR
        LOWER(COALESCE(po.provider_order_id, '')) LIKE $${idx} OR
        LOWER(COALESCE(po.provider_reference, '')) LIKE $${idx} OR
        LOWER(COALESCE(p.provider_reference, '')) LIKE $${idx}
      )`);
      params.push(term);
      idx++;
    }

    if (query.operationalState && query.operationalState !== 'ALL') {
      if (query.operationalState === 'RECONCILIATION_REQUIRED') {
        whereConditions.push(`(o.order_status = 'COMPLETED' AND (o.provider_status = 'FAILED' OR po.provider_status = 'FAILED'))`);
      } else if (query.operationalState === 'AWAITING_APPROVAL') {
        whereConditions.push(`o.order_status = 'AWAITING_APPROVAL'`);
      } else if (query.operationalState === 'FAILED_QUEUE') {
        whereConditions.push(`(o.order_status = 'FAILED' AND (po.provider_status IS NULL OR po.provider_status NOT IN ('COMPLETED', 'FULFILLED')))`);
      } else if (query.operationalState === 'REFUND_PENDING') {
        whereConditions.push(`o.refund_status = 'PENDING'`);
      }
    }

    if (query.startDate) {
      whereConditions.push(`o.created_at >= $${idx}::date`);
      params.push(query.startDate);
      idx++;
    }

    if (query.endDate) {
      whereConditions.push(`o.created_at <= ($${idx}::date + INTERVAL '1 day')`);
      params.push(query.endDate);
      idx++;
    }

    if (query.period && query.period !== 'ALL') {
      if (query.period === 'TODAY') {
        whereConditions.push(`o.created_at >= CURRENT_DATE`);
      } else if (query.period === 'YESTERDAY') {
        whereConditions.push(`o.created_at >= CURRENT_DATE - INTERVAL '1 day' AND o.created_at < CURRENT_DATE`);
      } else if (query.period === '7D') {
        whereConditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
      } else if (query.period === '30D') {
        whereConditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
      } else if (query.period === '90D') {
        whereConditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
      } else if (query.period === 'MONTH') {
        whereConditions.push(`o.created_at >= date_trunc('month', CURRENT_DATE)`);
      }
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    return { whereConditions, params, whereSql, nextIdx: idx };
  }

  // 1. GET /admin/orders/stats — Overview Statistics Counters (Dynamically Filtered)
  app.get<{
    Querystring: OrderFilterQueryParams;
  }>(
    '/admin/orders/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Querystring: OrderFilterQueryParams }>, reply: FastifyReply) => {
      const { whereSql, params } = buildOrderFilterClause(req.query || {});

      const statsSql = `
        SELECT 
          COUNT(DISTINCT o.id) as "totalOrders",
          COUNT(DISTINCT CASE WHEN o.order_status IN ('PROCESSING', 'PENDING', 'SUBMITTED') THEN o.id END) as "processing",
          COUNT(DISTINCT CASE WHEN o.order_status = 'COMPLETED' OR o.provider_status IN ('COMPLETED', 'FULFILLED') OR po.provider_status IN ('COMPLETED', 'FULFILLED') THEN o.id END) as "completed",
          COUNT(DISTINCT CASE WHEN o.order_status = 'FAILED' AND (po.provider_status IS NULL OR po.provider_status NOT IN ('COMPLETED', 'FULFILLED')) THEN o.id END) as "failed",
          COUNT(DISTINCT CASE WHEN o.order_status = 'REFUNDED' OR o.refund_status = 'COMPLETED' THEN o.id END) as "refunded",
          COUNT(DISTINCT CASE WHEN o.order_status = 'AWAITING_APPROVAL' THEN o.id END) as "awaitingApproval",
          COUNT(DISTINCT CASE WHEN o.order_status = 'PAUSED' OR o.is_paused = true THEN o.id END) as "paused",
          COUNT(DISTINCT CASE WHEN o.provider_status IN ('SYNC_FAILED', 'STALE', 'RECONCILIATION_REQUIRED') OR po.provider_status IN ('SYNC_FAILED', 'STALE', 'RECONCILIATION_REQUIRED') THEN o.id END) as "syncIssues",
          COUNT(DISTINCT CASE WHEN o.order_status = 'COMPLETED' AND (o.provider_status = 'FAILED' OR po.provider_status = 'FAILED') THEN o.id END) as "reconciliationRequired"
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT provider_name, provider_order_id, provider_reference, provider_status
          FROM provider_orders
          WHERE order_id = o.id
          ORDER BY created_at DESC
          LIMIT 1
        ) po ON true
        LEFT JOIN payment_transactions p ON o.id = p.order_id
        ${whereSql}
      `;

      const statsRes = await db.query(statsSql, params).catch((err) => {
        app.log.error({ err }, '[ADMIN_ORDERS] Error calculating orders stats');
        return {
          rows: [{
            totalOrders: 0, processing: 0, completed: 0, failed: 0, refunded: 0, awaitingApproval: 0, paused: 0, syncIssues: 0, reconciliationRequired: 0,
          }],
        };
      });

      const r = statsRes.rows[0] || {};
      return reply.send({
        success: true,
        data: {
          totalOrders: Number(r.totalOrders || 0),
          processing: Number(r.processing || 0),
          completed: Number(r.completed || 0),
          failed: Number(r.failed || 0),
          refunded: Number(r.refunded || 0),
          awaitingApproval: Number(r.awaitingApproval || 0),
          paused: Number(r.paused || 0),
          syncIssues: Number(r.syncIssues || 0),
          reconciliationRequired: Number(r.reconciliationRequired || 0),
        },
      });
    },
  );

  // 2. GET /admin/orders — Search & Multi-Filtered Orders Directory
  app.get<{
    Querystring: OrderFilterQueryParams & {
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/orders',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        page = '1',
        limit = '25',
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const { whereSql, params, nextIdx } = buildOrderFilterClause(req.query || {});

      const countSql = `
        SELECT COUNT(DISTINCT o.id) as total
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT provider_name, provider_order_id, provider_reference, provider_status
          FROM provider_orders
          WHERE order_id = o.id
          ORDER BY created_at DESC
          LIMIT 1
        ) po ON true
        LEFT JOIN payment_transactions p ON o.id = p.order_id
        ${whereSql}
      `;

      const countRes = await db.query(countSql, params).catch(() => ({ rows: [{ total: 0 }] }));
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT DISTINCT ON (o.created_at, o.id)
               o.id, o.user_id as "userId", o.agent_id as "agentId", o.recipient_phone as "recipientPhone",
               o.network, o.data_amount_mb as "dataAmountMb", o.amount_pesewas as "amountPesewas",
               o.payment_status as "paymentStatus", o.order_status as "orderStatus",
               COALESCE(po.provider_status, o.provider_status, 'UNKNOWN') as "providerStatus",
               o.refund_status as "refundStatus",
               o.created_at as "createdAt", o.updated_at as "updatedAt",
               u.email as "userEmail", COALESCE(u.full_name, 'Customer') as "userName",
               COALESCE(po.provider_name, (SELECT name FROM telecom_providers WHERE is_authoritative = TRUE LIMIT 1), 'DataHouse') as "providerName",
               COALESCE(po.provider_order_id, po.provider_reference) as "providerOrderId"
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT provider_name, provider_order_id, provider_reference, provider_status
          FROM provider_orders
          WHERE order_id = o.id
          ORDER BY created_at DESC
          LIMIT 1
        ) po ON true
        LEFT JOIN payment_transactions p ON o.id = p.order_id
        ${whereSql}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
      `;

      const listRes = await db.query(listSql, [...params, limitNum, offset]).catch(() => ({ rows: [] }));

      return reply.send({
        success: true,
        data: {
          orders: listRes.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 3. GET /admin/orders/:id — Comprehensive Individual Order Dossier
  app.get<{ Params: { id: string } }>(
    '/admin/orders/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const orderId = req.params.id;

      const orderRes = await db.query(
        `SELECT o.id, o.user_id as "userId", o.agent_id as "agentId", o.recipient_phone as "recipientPhone",
                o.network, o.data_amount_mb as "dataAmountMb", o.amount_pesewas as "amountPesewas",
                o.currency, o.payment_status as "paymentStatus", o.order_status as "orderStatus",
                COALESCE(po.provider_status, o.provider_status, 'UNKNOWN') as "providerStatus",
                o.refund_status as "refundStatus",
                o.idempotency_key as "idempotencyKey", o.pricing_snapshot as "pricingSnapshot",
                o.created_at as "createdAt", o.updated_at as "updatedAt"
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT provider_status
           FROM provider_orders
           WHERE order_id = o.id
           ORDER BY created_at DESC
           LIMIT 1
         ) po ON true
         WHERE o.id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order with ID [${orderId}] not found.`);
      }

      const order = orderRes.rows[0];

      // Customer Details
      const userRes = await db.query(
        `SELECT id, email, phone, COALESCE(full_name, name, 'Customer') as "fullName", role, status
         FROM users WHERE id = $1`,
        [order.userId],
      ).catch(() => ({ rows: [] }));

      const customer = userRes.rows[0] || null;

      // Agent Context (if applicable)
      let agentData = null;
      if (order.agentId) {
        const agentRes = await db.query(
          `SELECT a.id, a.store_name as "storeName", a.store_slug as "storeSlug",
                  a.commission_rate as "commissionRate", a.withdrawable_float_pesewas as "floatPesewas"
           FROM agents a WHERE a.id = $1`,
          [order.agentId],
        ).catch(() => ({ rows: [] }));
        agentData = agentRes.rows[0] || null;
      }

      // Provider Order Information
      const providerOrderRes = await db.query(
        `SELECT id, 
                COALESCE(provider_name, (SELECT name FROM telecom_providers WHERE is_authoritative = TRUE LIMIT 1), 'DataHouse') as "providerName",
                provider_order_id as "providerOrderId",
                provider_reference as "providerReference", provider_status as "providerStatus",
                raw_payload as "rawPayload", last_synced_at as "lastSyncedAt",
                created_at as "createdAt"
         FROM provider_orders 
         WHERE order_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      const providerOrder = providerOrderRes.rows[0] ? {
        ...providerOrderRes.rows[0],
        rawPayload: sanitizePayload(providerOrderRes.rows[0].rawPayload),
      } : null;

      // Payment Details
      const paymentRes = await db.query(
        `SELECT id, amount_pesewas as "amountPesewas", payment_status as "paymentStatus",
                provider, reference, created_at as "createdAt"
         FROM payment_transactions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      const payment = paymentRes.rows[0] || null;

      // Refund Details
      const refundRes = await db.query(
        `SELECT id, amount_pesewas as "amountPesewas", reason, status,
                provider_refund_reference as "refundReference", created_at as "createdAt"
         FROM refunds WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      const refund = refundRes.rows[0] || null;

      // Order Events Stream
      const eventsRes = await db.query(
        `SELECT id, event_type as "eventType", actor_type as "actorType",
                actor_id as "actorId", previous_state as "previousState",
                new_state as "newState", metadata, occurred_at as "occurredAt"
         FROM order_events WHERE order_id = $1 ORDER BY occurred_at ASC`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      const events = eventsRes.rows.map((ev) => ({
        ...ev,
        metadata: sanitizePayload(ev.metadata),
      }));

      // DLQ Candidates
      const dlqRes = await db.query(
        `SELECT id, attempt_count as "attemptCount", error_code as "errorCode",
                error_message as "errorMessage", status, created_at as "createdAt"
         FROM provider_dlq WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      const dlq = dlqRes.rows[0] || null;

      return reply.send({
        success: true,
        data: {
          order,
          customer,
          agent: agentData,
          providerOrder,
          payment,
          refund,
          events,
          dlq,
        },
      });
    },
  );

  // 4. POST /admin/orders/:id/reconcile — Trigger Individual Order Reconciliation
  app.post<{ Params: { id: string } }>(
    '/admin/orders/:id/reconcile',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const orderId = req.params.id;

      let singleRecon: any;
      if (typeof (providerReconciliationService as any).reconcileSingleOrder === 'function') {
        try {
          singleRecon = await providerReconciliationService.reconcileSingleOrder(orderId);
        } catch {
          singleRecon = await providerReconciliationService.reconcileStaleOrders(new Date().toISOString(), 1);
        }
      } else {
        singleRecon = await providerReconciliationService.reconcileStaleOrders(new Date().toISOString(), 1);
      }

      if (typeof (providerReconciliationService as any).reconcileStaleOrders === 'function') {
        await providerReconciliationService.reconcileStaleOrders(new Date().toISOString(), 1).catch(() => {});
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ORDER_RECONCILE',
          resourceType: 'orders',
          resourceId: orderId,
          metadata: { singleRecon },
        });
      }

      // Fetch fresh order details
      const updatedOrderRes = await db.query(
        `SELECT o.id, o.order_status as "orderStatus",
                COALESCE(po.provider_status, o.provider_status, 'UNKNOWN') as "providerStatus",
                po.provider_order_id as "providerOrderId", po.provider_reference as "providerReference"
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT provider_status, provider_order_id, provider_reference
           FROM provider_orders
           WHERE order_id = o.id
           ORDER BY created_at DESC
           LIMIT 1
         ) po ON true
         WHERE o.id = $1`,
        [orderId],
      ).catch(() => ({ rows: [] }));

      return reply.send({
        success: true,
        data: {
          ...(typeof singleRecon === 'object' ? singleRecon : { result: singleRecon }),
          order: updatedOrderRes.rows[0] || null,
        },
        message: `Order [${orderId}] status reconciled.`,
      });
    },
  );

  // 5. POST /admin/orders/:id/retry — Controlled Safe Order Retry
  app.post<{ Params: { id: string } }>(
    '/admin/orders/:id/retry',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const orderId = req.params.id;

      const orderRes = await db.query(
        `SELECT id, recipient_phone, network, data_amount_mb, order_status, payment_status
         FROM orders WHERE id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order [${orderId}] not found.`);
      }

      const order = orderRes.rows[0];

      if (order.order_status === 'COMPLETED') {
        throw new BadRequestError('Cannot retry an order that is already COMPLETED.');
      }

      await fulfillmentQueueService.enqueueOrderFulfillment({
        orderId: order.id,
        phoneNumber: order.recipient_phone,
        network: order.network as NetworkProvider,
        dataAmountMb: order.data_amount_mb,
        idempotencyKey: `admin_retry_${order.id}_${Date.now()}`,
        attemptCount: 1,
        correlationId: req.id,
      });

      await db.query(
        `UPDATE orders SET order_status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [orderId],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ORDER_RETRY',
          resourceType: 'orders',
          resourceId: orderId,
          metadata: { recipientPhone: order.recipient_phone, network: order.network },
        });
      }

      return reply.send({
        success: true,
        message: `Order [${orderId}] enqueued for fulfillment retry.`,
      });
    },
  );

  // 6. POST /admin/orders/:id/refund — Issue Double-Entry Financial Refund
  app.post<{ Params: { id: string }; Body: { reason: string; amountPesewas?: number } }>(
    '/admin/orders/:id/refund',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const orderId = req.params.id;
      const { reason, amountPesewas } = req.body || {};

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError('A valid audit reason (min 5 characters) is required for issuing refunds.');
      }

      const orderRes = await db.query(
        `SELECT id, user_id, amount_pesewas, refund_status, order_status FROM orders WHERE id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order [${orderId}] not found.`);
      }

      const order = orderRes.rows[0];

      if (order.refund_status === 'COMPLETED') {
        throw new BadRequestError('Order has already been refunded.');
      }

      const refundAmount = amountPesewas && amountPesewas > 0 ? amountPesewas : Number(order.amount_pesewas);

      // Double-Entry Ledger Post
      if (financialLedgerService) {
        const platformAccountId = '00000000-0000-0000-0000-000000000000';
        await financialLedgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: platformAccountId,
            amountPesewas: refundAmount,
            referenceType: 'ORDER_REFUND',
            referenceId: orderId,
            description: `Admin Order Refund: ${reason}`,
          },
          {
            entryType: LedgerEntryType.CREDIT,
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: order.user_id,
            amountPesewas: refundAmount,
            referenceType: 'ORDER_REFUND',
            referenceId: orderId,
            description: `Admin Order Refund: ${reason}`,
          },
        ]);
      }

      // Record Refund Entry
      await db.query(
        `INSERT INTO refunds (order_id, amount_pesewas, reason, status, provider_refund_reference)
         VALUES ($1, $2, $3, 'COMPLETED', $4)`,
        [orderId, refundAmount, reason, `ref_adm_${Date.now()}`],
      );

      // Update Order Status
      await db.query(
        `UPDATE orders
         SET refund_status = 'COMPLETED', order_status = 'REFUNDED', payment_status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId],
      );

      // Credit user wallet in users table
      await db.query(
        `UPDATE users
         SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
             wallet_balance = ROUND((COALESCE(wallet_balance_pesewas, 0) + $1) / 100.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [refundAmount, order.user_id],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorName: (req.user as any)?.name || (req.user as any)?.fullName || 'Admin',
          actorEmail: req.user?.email,
          actorRole: req.user?.role,
          actorType: 'ADMIN',
          action: 'ORDER_REFUNDED',
          category: AuditCategory.WALLET,
          resourceType: 'orders',
          resourceId: orderId,
          severity: AuditSeverity.HIGH,
          beforeState: {
            orderStatus: order.order_status,
            refundStatus: order.refund_status,
          },
          afterState: {
            orderStatus: 'REFUNDED',
            refundStatus: 'COMPLETED',
            refundAmountPesewas: refundAmount,
          },
          source: AuditSource.WEB,
          service: 'core-api',
          endpoint: req.url,
          httpMethod: 'POST',
          httpStatus: 200,
          description: `Admin refunded GH₵${(refundAmount / 100).toFixed(2)} for order ${orderId} (Reason: ${reason})`,
          metadata: { refundAmountPesewas: refundAmount, reason, targetUserId: order.user_id },
        });
      }

      return reply.send({
        success: true,
        message: `Order [${orderId}] successfully refunded GHS ${(refundAmount / 100).toFixed(2)}.`,
      });
    },
  );

  // 7. POST /admin/orders/export — Async Filtered Dataset Export
  app.post<{
    Body: { format?: 'CSV' | 'JSON'; filter?: any };
  }>(
    '/admin/orders/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { format = 'CSV' } = req.body || {};

      const listRes = await db.query(`
        SELECT o.id, o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
               o.amount_pesewas as "amountPesewas", o.payment_status as "paymentStatus",
               o.order_status as "orderStatus", o.provider_status as "providerStatus",
               o.created_at as "createdAt", u.email as "userEmail"
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 1000
      `);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'EXPORT_ORDERS',
          resourceType: 'orders',
          resourceId: 'batch',
          metadata: { format, count: listRes.rows.length },
        });
      }

      if (format === 'JSON') {
        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="orders_export_${Date.now()}.json"`)
          .send(JSON.stringify(listRes.rows, null, 2));
      }

      const csvRows = [
        ['Order ID', 'Recipient Phone', 'Network', 'Data Size MB', 'Amount (GHS)', 'Payment Status', 'Order Status', 'Provider Status', 'Customer Email', 'Created At'].join(','),
        ...listRes.rows.map((r) => [
          r.id,
          r.recipientPhone,
          r.network,
          r.dataAmountMb,
          (r.amountPesewas / 100).toFixed(2),
          r.paymentStatus,
          r.orderStatus,
          r.providerStatus || 'N/A',
          r.userEmail || 'N/A',
          r.createdAt,
        ].join(',')),
      ].join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="orders_export_${Date.now()}.csv"`)
        .send(csvRows);
    },
  );

  // 8. GET /admin/orders/processing-status — Check whether order processing is paused
  app.get(
    '/admin/orders/processing-status',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      let isPaused = false;
      let pausedAt: string | null = null;
      let pausedBy: string | null = null;
      let reason: string | null = null;
      let pausedCount = 0;

      try {
        const ctrlRes = await db.query(
          `SELECT is_enabled, last_toggled_at, last_toggled_by, last_justification
           FROM emergency_system_controls
           WHERE control_key = 'PAUSE_ORDER_OPERATIONS'
           LIMIT 1`,
        );
        if (ctrlRes.rows.length > 0) {
          isPaused = Boolean(ctrlRes.rows[0].is_enabled);
          pausedAt = ctrlRes.rows[0].last_toggled_at;
          pausedBy = ctrlRes.rows[0].last_toggled_by;
          reason = ctrlRes.rows[0].last_justification;
        }

        const countRes = await db.query(
          `SELECT COUNT(*) as cnt FROM orders WHERE is_paused = true OR order_status = 'PAUSED'`,
        );
        pausedCount = Number(countRes.rows[0]?.cnt || 0);
      } catch (err: any) {
        app.log.warn({ err: err?.message }, '[ADMIN_ORDERS] Error checking processing status');
      }

      return reply.send({
        success: true,
        data: {
          isPaused,
          pausedCount,
          pausedAt,
          pausedBy,
          reason,
        },
      });
    },
  );

  // 9. POST /admin/orders/pause — Pause all order processing, checkouts, and Excel bulk uploads
  app.post<{
    Body: { reason?: string };
  }>(
    '/admin/orders/pause',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (req: FastifyRequest<{ Body: { reason?: string } }>, reply: FastifyReply) => {
      const { reason = 'Order processing paused by platform administrator.' } = req.body || {};

      let affectedOrdersCount = 0;

      try {
        // 1. Activate emergency control
        await db.query(
          `INSERT INTO emergency_system_controls (
             control_key, name, description, is_enabled, last_toggled_by, last_toggled_at, last_justification, updated_at
           ) VALUES (
             'PAUSE_ORDER_OPERATIONS', 'Pause All Order Processes & Activities', 'Platform order processing paused', true, $1, CURRENT_TIMESTAMP, $2, CURRENT_TIMESTAMP
           )
           ON CONFLICT (control_key) DO UPDATE SET
             is_enabled = true,
             last_toggled_by = EXCLUDED.last_toggled_by,
             last_toggled_at = CURRENT_TIMESTAMP,
             last_justification = EXCLUDED.last_justification,
             updated_at = CURRENT_TIMESTAMP`,
          [req.user!.sub, reason.trim()],
        );

        // 2. Sync to platform_feature_flags
        await db.query(
          `UPDATE platform_feature_flags
           SET is_enabled = true, last_toggled_by = $1, last_toggled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE flag_key = 'PAUSE_ORDER_OPERATIONS'`,
          [req.user!.sub],
        ).catch(() => {});

        // 3. Mark all active processing/submitted orders as PAUSED
        const updateRes = await db.query(
          `UPDATE orders
           SET is_paused = true,
               paused_at = CURRENT_TIMESTAMP,
               paused_from_status = order_status,
               order_status = 'PAUSED',
               updated_at = CURRENT_TIMESTAMP
           WHERE order_status IN ('PROCESSING', 'SUBMITTED', 'READY_FOR_FULFILLMENT', 'VALIDATING')`,
        );
        affectedOrdersCount = updateRes.rowCount ?? 0;
      } catch (err: any) {
        app.log.error({ err: err?.message, userId: req.user!.sub }, '[ADMIN_ORDERS_PAUSE] Error pausing orders in database');
      }

      if (auditService) {
        await auditService.logEvent?.({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_ORDER_PROCESSING_PAUSED',
          category: AuditCategory.ADMIN_ACTION,
          severity: AuditSeverity.CRITICAL,
          resourceType: 'orders',
          resourceId: 'global_order_processing',
          reason: reason.trim(),
          result: AuditResult.SUCCESS,
          metadata: { affectedOrdersCount, reason: reason.trim() },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        message: 'All order processes, activities, and bulk uploads have been paused successfully.',
        data: {
          isPaused: true,
          affectedOrdersCount,
          pausedAt: new Date().toISOString(),
        },
      });
    },
  );

  // 10. POST /admin/orders/resume — Resume order operations & re-enqueue held orders
  app.post<{
    Body: { resumePausedOrders?: boolean; reason?: string };
  }>(
    '/admin/orders/resume',
    {
      preHandler: [authHooks.authenticateAdmin],
    },
    async (req: FastifyRequest<{ Body: { resumePausedOrders?: boolean; reason?: string } }>, reply: FastifyReply) => {
      const { resumePausedOrders = true, reason = 'Order processing resumed by platform administrator.' } = req.body || {};

      let resumedOrdersCount = 0;

      try {
        // 1. Deactivate emergency control
        await db.query(
          `UPDATE emergency_system_controls
           SET is_enabled = false,
               last_toggled_by = $1,
               last_toggled_at = CURRENT_TIMESTAMP,
               last_justification = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE control_key = 'PAUSE_ORDER_OPERATIONS'`,
          [req.user!.sub, reason.trim()],
        );

        // 2. Sync to platform_feature_flags
        await db.query(
          `UPDATE platform_feature_flags
           SET is_enabled = false, last_toggled_by = $1, last_toggled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE flag_key = 'PAUSE_ORDER_OPERATIONS'`,
          [req.user!.sub],
        ).catch(() => {});

        // 3. Restore paused orders back to their prior status
        if (resumePausedOrders) {
          const updateRes = await db.query(
            `UPDATE orders
             SET order_status = COALESCE(paused_from_status, 'PROCESSING'),
                 is_paused = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE is_paused = true OR order_status = 'PAUSED'`,
          );
          resumedOrdersCount = updateRes.rowCount ?? 0;
        }
      } catch (err: any) {
        app.log.error({ err: err?.message, userId: req.user!.sub }, '[ADMIN_ORDERS_RESUME] Error resuming orders in database');
      }

      if (auditService) {
        await auditService.logEvent?.({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_ORDER_PROCESSING_RESUMED',
          category: AuditCategory.ADMIN_ACTION,
          severity: AuditSeverity.HIGH,
          resourceType: 'orders',
          resourceId: 'global_order_processing',
          reason: reason.trim(),
          result: AuditResult.SUCCESS,
          metadata: { resumedOrdersCount, resumePausedOrders, reason: reason.trim() },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        message: 'Order processes, activities, and bulk uploads have been resumed successfully.',
        data: {
          isPaused: false,
          resumedOrdersCount,
          resumedAt: new Date().toISOString(),
        },
      });
    },
  );

  // 11. EXPORT PAUSED ORDERS (Excel XLSX / CSV / JSON)
  const handleExportPausedOrders = async (req: FastifyRequest, reply: FastifyReply) => {
    const rawFormat = ((req.query as any)?.format || (req.body as any)?.format || 'XLSX').toString().toUpperCase();
    const format = rawFormat === 'CSV' ? 'CSV' : rawFormat === 'JSON' ? 'JSON' : 'XLSX';

    const listRes = await db.query(`
      SELECT 
        o.id,
        o.public_id as "publicId",
        o.recipient_phone as "recipientPhone",
        o.network,
        o.data_amount_mb as "dataAmountMb",
        o.amount_pesewas as "amountPesewas",
        o.currency,
        o.payment_status as "paymentStatus",
        o.order_status as "orderStatus",
        COALESCE(o.paused_from_status, 'PROCESSING') as "pausedFromStatus",
        o.is_paused as "isPaused",
        o.paused_at as "pausedAt",
        o.created_at as "createdAt",
        o.idempotency_key as "idempotencyKey",
        u.email as "customerEmail",
        u.full_name as "customerName",
        u.phone as "customerPhone",
        a.business_name as "agentBusinessName",
        po.provider_name as "providerName",
        po.provider_reference as "providerReference"
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN LATERAL (
        SELECT provider_name, provider_reference
        FROM provider_orders
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) po ON true
      WHERE o.is_paused = true
         OR o.order_status = 'PAUSED'
         OR (o.paused_from_status IS NOT NULL AND o.paused_from_status = 'PROCESSING')
      ORDER BY o.paused_at DESC NULLS LAST, o.created_at DESC
      LIMIT 10000
    `);

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (auditService) {
      await auditService.logEvent?.({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'ADMIN',
        action: 'EXPORT_PAUSED_PROCESSING_ORDERS',
        category: AuditCategory.ADMIN_ACTION,
        resourceType: 'orders',
        resourceId: 'paused_batch',
        result: AuditResult.SUCCESS,
        metadata: { format, count: listRes.rows.length },
      }).catch(() => {});
    }

    if (format === 'JSON') {
      return reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="paused_processing_orders_${timestampStr}.json"`)
        .send(JSON.stringify(listRes.rows, null, 2));
    }

    if (format === 'CSV') {
      const headers = [
        'Order Public ID',
        'Internal ID',
        'Recipient Phone',
        'Network',
        'Data Size (MB)',
        'Data Size (GB)',
        'Amount (GHS)',
        'Payment Status',
        'Prior Status (Before Pause)',
        'Current Order Status',
        'Time Placed',
        'Time Paused',
        'Customer Name',
        'Customer Email',
        'Agent Business',
        'Telecom Provider',
        'Provider Reference',
        'Idempotency Key',
      ];

      const csvLines = [
        headers.join(','),
        ...listRes.rows.map((r) => [
          `"${r.publicId || ''}"`,
          `"${r.id}"`,
          `"${r.recipientPhone}"`,
          `"${r.network}"`,
          r.dataAmountMb,
          (Number(r.dataAmountMb) / 1024).toFixed(2),
          (Number(r.amountPesewas) / 100).toFixed(2),
          `"${r.paymentStatus}"`,
          `"${r.pausedFromStatus || 'PROCESSING'}"`,
          `"${r.orderStatus}"`,
          `"${r.createdAt}"`,
          `"${r.pausedAt || ''}"`,
          `"${(r.customerName || '').replace(/"/g, '""')}"`,
          `"${r.customerEmail || ''}"`,
          `"${(r.agentBusinessName || '').replace(/"/g, '""')}"`,
          `"${r.providerName || 'N/A'}"`,
          `"${r.providerReference || 'N/A'}"`,
          `"${r.idempotencyKey || ''}"`,
        ].join(',')),
      ];

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="paused_processing_orders_${timestampStr}.csv"`)
        .send(csvLines.join('\n'));
    }

    // Default: Native Excel XLSX Workbook
    const sheetData = listRes.rows.map((r) => ({
      'Order Public ID': r.publicId || r.id,
      'Internal Order ID': r.id,
      'Recipient Phone': r.recipientPhone,
      'Network': r.network,
      'Data Volume (MB)': Number(r.dataAmountMb),
      'Data Volume (GB)': +(Number(r.dataAmountMb) / 1024).toFixed(2),
      'Amount (GHS)': +(Number(r.amountPesewas) / 100).toFixed(2),
      'Payment Status': r.paymentStatus,
      'Prior Status (Before Pause)': r.pausedFromStatus || 'PROCESSING',
      'Current Status': r.orderStatus,
      'Date & Time Placed': r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
      'Date & Time Paused': r.pausedAt ? new Date(r.pausedAt).toLocaleString() : '',
      'Customer Name': r.customerName || 'N/A',
      'Customer Email': r.customerEmail || 'N/A',
      'Agent Business Name': r.agentBusinessName || 'N/A',
      'Telecom Provider': r.providerName || 'DataHouse',
      'Provider Reference': r.providerReference || 'N/A',
      'Idempotency Key': r.idempotencyKey || 'N/A',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 38 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 26 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Paused Processing Orders');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="paused_processing_orders_${timestampStr}.xlsx"`)
      .send(xlsxBuffer);
  };

  app.get('/admin/orders/export-paused', { preHandler: [authHooks.authenticateAdmin] }, handleExportPausedOrders);
  app.post('/admin/orders/export-paused', { preHandler: [authHooks.authenticateAdmin] }, handleExportPausedOrders);
}
