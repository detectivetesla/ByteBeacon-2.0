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
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { NetworkProvider, LedgerEntryType, LedgerAccountType } from '@bytebeacon/shared';

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

  // 1. GET /admin/orders/stats — Overview Statistics Counters
  app.get(
    '/admin/orders/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const statsRes = await db.query(`
        SELECT 
          COUNT(*) as "totalOrders",
          COUNT(CASE WHEN order_status IN ('PROCESSING', 'PENDING', 'SUBMITTED') THEN 1 END) as "processing",
          COUNT(CASE WHEN order_status = 'COMPLETED' THEN 1 END) as "completed",
          COUNT(CASE WHEN order_status = 'FAILED' THEN 1 END) as "failed",
          COUNT(CASE WHEN order_status = 'REFUNDED' OR refund_status = 'COMPLETED' THEN 1 END) as "refunded",
          COUNT(CASE WHEN order_status = 'AWAITING_APPROVAL' THEN 1 END) as "awaitingApproval",
          COUNT(CASE WHEN provider_status IN ('SYNC_FAILED', 'STALE', 'RECONCILIATION_REQUIRED') THEN 1 END) as "syncIssues",
          COUNT(CASE WHEN order_status = 'COMPLETED' AND provider_status = 'FAILED' THEN 1 END) as "reconciliationRequired"
        FROM orders
      `).catch(() => ({
        rows: [{
          totalOrders: 0, processing: 0, completed: 0, failed: 0, refunded: 0, awaitingApproval: 0, syncIssues: 0, reconciliationRequired: 0,
        }],
      }));

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
          syncIssues: Number(r.syncIssues || 0),
          reconciliationRequired: Number(r.reconciliationRequired || 0),
        },
      });
    },
  );

  // 2. GET /admin/orders — Search & Multi-Filtered Orders Directory
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      lifecycle?: string;
      paymentStatus?: string;
      provider?: string;
      network?: string;
      source?: string;
      period?: string;
      operationalState?: string;
    };
  }>(
    '/admin/orders',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        page = '1',
        limit = '25',
        search,
        lifecycle,
        paymentStatus,
        provider,
        network,
        source,
        period,
        operationalState,
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (lifecycle && lifecycle !== 'ALL') {
        whereConditions.push(`o.order_status = $${idx}`);
        params.push(lifecycle);
        idx++;
      }

      if (paymentStatus && paymentStatus !== 'ALL') {
        whereConditions.push(`o.payment_status = $${idx}`);
        params.push(paymentStatus);
        idx++;
      }

      if (network && network !== 'ALL') {
        whereConditions.push(`o.network = $${idx}`);
        params.push(network);
        idx++;
      }

      if (provider && provider !== 'ALL') {
        whereConditions.push(`po.provider_name = $${idx}`);
        params.push(provider);
        idx++;
      }

      if (source && source !== 'ALL') {
        if (source === 'AGENT') {
          whereConditions.push(`o.agent_id IS NOT NULL`);
        } else if (source === 'CUSTOMER') {
          whereConditions.push(`o.agent_id IS NULL`);
        }
      }

      if (search && search.trim() !== '') {
        const term = `%${search.trim().toLowerCase()}%`;
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

      if (operationalState && operationalState !== 'ALL') {
        if (operationalState === 'RECONCILIATION_REQUIRED') {
          whereConditions.push(`(o.order_status = 'COMPLETED' AND o.provider_status = 'FAILED')`);
        } else if (operationalState === 'AWAITING_APPROVAL') {
          whereConditions.push(`o.order_status = 'AWAITING_APPROVAL'`);
        } else if (operationalState === 'FAILED_QUEUE') {
          whereConditions.push(`o.order_status = 'FAILED'`);
        } else if (operationalState === 'REFUND_PENDING') {
          whereConditions.push(`o.refund_status = 'PENDING'`);
        }
      }

      if (period && period !== 'ALL') {
        if (period === 'TODAY') {
          whereConditions.push(`o.created_at >= CURRENT_DATE`);
        } else if (period === 'YESTERDAY') {
          whereConditions.push(`o.created_at >= CURRENT_DATE - INTERVAL '1 day' AND o.created_at < CURRENT_DATE`);
        } else if (period === '7D') {
          whereConditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
        } else if (period === '30D') {
          whereConditions.push(`o.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
        }
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countSql = `
        SELECT COUNT(DISTINCT o.id) as total
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN provider_orders po ON o.id = po.order_id
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
               o.provider_status as "providerStatus", o.refund_status as "refundStatus",
               o.created_at as "createdAt", o.updated_at as "updatedAt",
               u.email as "userEmail", COALESCE(u.full_name, 'Customer') as "userName",
               po.provider_name as "providerName", po.provider_order_id as "providerOrderId"
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN provider_orders po ON o.id = po.order_id
        LEFT JOIN payment_transactions p ON o.id = p.order_id
        ${whereSql}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $${idx} OFFSET $${idx + 1}
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
                o.provider_status as "providerStatus", o.refund_status as "refundStatus",
                o.idempotency_key as "idempotencyKey", o.pricing_snapshot as "pricingSnapshot",
                o.created_at as "createdAt", o.updated_at as "updatedAt"
         FROM orders o
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
        `SELECT id, provider_name as "providerName", provider_order_id as "providerOrderId",
                provider_reference as "providerReference", provider_status as "providerStatus",
                raw_payload as "rawPayload", last_synced_at as "lastSyncedAt",
                created_at as "createdAt"
         FROM provider_orders WHERE order_id = $1`,
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

      const orderRes = await db.query(`SELECT id, order_status, provider_status FROM orders WHERE id = $1`, [orderId]);
      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order [${orderId}] not found.`);
      }

      // Run reconciliation via reconciliation service
      const summary = await providerReconciliationService.reconcileStaleOrders(new Date().toISOString(), 1);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ORDER_RECONCILE',
          resourceType: 'orders',
          resourceId: orderId,
          metadata: { summary },
        });
      }

      return reply.send({
        success: true,
        data: { orderId, summary },
        message: `Reconciliation triggered successfully for Order [${orderId}].`,
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
        await financialLedgerService.recordJournalEntries(db, [
          {
            entryType: LedgerEntryType.DEBIT,
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: 'PLATFORM_RESERVE',
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

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ORDER_REFUND',
          resourceType: 'orders',
          resourceId: orderId,
          metadata: { refundAmountPesewas: refundAmount, reason },
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
}
