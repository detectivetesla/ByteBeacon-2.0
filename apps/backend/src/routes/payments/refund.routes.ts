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

  const getRefundsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.sub;
    const role = req.user!.role as UserRole;
    const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

    // Self-heal table schema if columns are absent
    try {
      await deps.db.query(`
        ALTER TABLE refunds ADD COLUMN IF NOT EXISTS public_id VARCHAR(64);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30) DEFAULT 'NONE';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDING';
      `);
    } catch (e: any) {
      req.log.warn({ err: e?.message }, '[REFUND_SCHEMA] Schema self-heal notice (non-fatal)');
    }

    // Resolve agent identity and associated store IDs
    let agentId: string | null = null;
    let storeIds: string[] = [];
    if (!isAdmin) {
      const agentRes = await deps.db
        .query(
          `SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1 LIMIT 1`,
          [userId],
        )
        .catch(() => ({ rows: [] }));

      if (agentRes.rows.length > 0) {
        agentId = agentRes.rows[0].id;
        const linkedUserId = agentRes.rows[0].user_id;

        const storesRes = await deps.db
          .query(
            `SELECT id::text FROM stores WHERE agent_id::text = $1 OR user_id::text = $1 OR user_id::text = $2`,
            [agentId, linkedUserId || userId],
          )
          .catch(() => ({ rows: [] }));

        storeIds = (storesRes.rows || []).map((s: any) => s.id);
      }
    }

    // Build scoped query
    let userFilterSql: string;
    let queryParams: any[];

    if (isAdmin) {
      userFilterSql = '1=1';
      queryParams = [];
    } else if (agentId) {
      queryParams = [agentId, userId];
      if (storeIds.length > 0) {
        queryParams.push(storeIds);
        userFilterSql = `(o.agent_id::text = $1 OR o.user_id::text = $2 OR o.store_id::text = ANY($3::text[]))`;
      } else {
        userFilterSql = `(o.agent_id::text = $1 OR o.user_id::text = $2)`;
      }
    } else {
      userFilterSql = `o.user_id::text = $1`;
      queryParams = [userId];
    }

    const query = `
      WITH refund_entries AS (
        SELECT 
          r.id::text as id,
          COALESCE(r.public_id, 'ref_' || substr(md5(r.id::text), 1, 14)) as "publicId",
          o.id::text as "orderId",
          COALESCE(o.public_id, 'ord_' || substr(md5(o.id::text), 1, 14)) as "orderPublicId",
          r.amount_pesewas as "amountPesewas",
          COALESCE(r.reason, o.failure_reason, 'Automated order failure refund') as reason,
          UPPER(COALESCE(r.status, 'COMPLETED')) as status,
          r.created_at as "requestedAt",
          r.updated_at as "processedAt",
          COALESCE(p.payment_method, 'WALLET') as "paymentMethod",
          COALESCE(p.provider, 'WALLET') as "paymentProvider"
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        LEFT JOIN payments p ON r.payment_id = p.id
        WHERE ${userFilterSql}

        UNION ALL

        SELECT
          o.id::text as id,
          ('ref_' || substr(md5(o.id::text), 1, 14)) as "publicId",
          o.id::text as "orderId",
          COALESCE(o.public_id, 'ord_' || substr(md5(o.id::text), 1, 14)) as "orderPublicId",
          o.amount_pesewas as "amountPesewas",
          COALESCE(o.failure_reason, 'Automated order failure refund') as reason,
          CASE
            WHEN UPPER(COALESCE(o.refund_status, '')) IN ('COMPLETED', 'REFUNDED') OR UPPER(COALESCE(o.payment_status, '')) = 'REFUNDED' THEN 'COMPLETED'
            WHEN UPPER(COALESCE(o.refund_status, '')) IN ('PROCESSING') THEN 'PROCESSING'
            WHEN UPPER(COALESCE(o.refund_status, '')) IN ('PENDING', 'REQUESTED') THEN 'PENDING'
            WHEN UPPER(COALESCE(o.order_status, '')) = 'FAILED' AND UPPER(COALESCE(o.payment_status, '')) IN ('PAID', 'SUCCESS', 'COMPLETED') THEN 'PENDING'
            ELSE 'COMPLETED'
          END as status,
          o.updated_at as "requestedAt",
          o.updated_at as "processedAt",
          COALESCE(p.payment_method, 'WALLET') as "paymentMethod",
          COALESCE(p.provider, 'WALLET') as "paymentProvider"
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE ${userFilterSql}
          AND (
            UPPER(COALESCE(o.refund_status, '')) IN ('COMPLETED', 'REFUNDED', 'PENDING', 'PROCESSING', 'REQUESTED')
            OR UPPER(COALESCE(o.payment_status, '')) = 'REFUNDED'
            OR (UPPER(COALESCE(o.order_status, '')) = 'FAILED' AND UPPER(COALESCE(o.payment_status, '')) IN ('PAID', 'SUCCESS', 'COMPLETED'))
          )
          AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id)
      )
      SELECT DISTINCT ON ("publicId") *
      FROM refund_entries
      ORDER BY "publicId", "requestedAt" DESC
    `;

    const res = await deps.db.query(query, queryParams).catch((err) => {
      req.log.warn({ err: err?.message }, '[REFUND_ROUTES] Failed to query refunds list');
      return { rows: [] };
    });

    const records = (res.rows || []).map((row: any) => {
      // Map payment method
      let method: 'Wallet' | 'Mobile Money' | 'Paystack' | 'Card' | 'Bank Transfer' = 'Wallet';
      const rawMethod = String(row.paymentMethod || row.paymentProvider || '').toUpperCase();
      if (rawMethod.includes('PAYSTACK')) {
        method = 'Paystack';
      } else if (
        rawMethod.includes('MOMO') ||
        rawMethod.includes('MOBILE') ||
        rawMethod.includes('HUBTEL') ||
        rawMethod.includes('MTN') ||
        rawMethod.includes('TELECEL')
      ) {
        method = 'Mobile Money';
      } else if (rawMethod.includes('CARD') || rawMethod.includes('VISA') || rawMethod.includes('MASTERCARD')) {
        method = 'Card';
      } else if (rawMethod.includes('BANK')) {
        method = 'Bank Transfer';
      } else {
        method = 'Wallet';
      }

      // Map status
      let status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Rejected' = 'Completed';
      const rawStatus = String(row.status || '').toUpperCase();
      if (rawStatus === 'PENDING' || rawStatus === 'REQUESTED') {
        status = 'Pending';
      } else if (rawStatus === 'PROCESSING') {
        status = 'Processing';
      } else if (rawStatus === 'FAILED') {
        status = 'Failed';
      } else if (rawStatus === 'REJECTED') {
        status = 'Rejected';
      } else {
        status = 'Completed';
      }

      const reqDate = row.requestedAt ? new Date(row.requestedAt) : new Date();
      const procDate = row.processedAt ? new Date(row.processedAt) : reqDate;
      const formattedReqTime = reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedProcTime = procDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isCompleted = status === 'Completed';

      return {
        id: row.publicId || row.id,
        orderId: row.orderPublicId || row.orderId,
        amountPesewas: Number(row.amountPesewas || 0),
        paymentMethod: method,
        reason: row.reason || 'Automated fulfillment failure refund',
        status,
        requestedAt: reqDate.toISOString(),
        processedAt: procDate.toISOString(),
        rawDate: reqDate.toISOString(),
        timeline: [
          { stage: 'Order Failed & Refund Requested', time: formattedReqTime, completed: true },
          { stage: 'Automated Refund Engine Processing', time: formattedReqTime, completed: true },
          { stage: 'Wallet Credited Successfully', time: formattedProcTime, completed: isCompleted },
        ],
      };
    });

    return reply.send({
      success: true,
      data: records,
      refunds: records,
    });
  };

  app.get('/payments/refunds', { preHandler: [authHooks.authenticate] }, getRefundsHandler);
  app.get('/refunds', { preHandler: [authHooks.authenticate] }, getRefundsHandler);
  app.get('/agent/refunds', { preHandler: [authHooks.authenticate] }, getRefundsHandler);
  app.get('/agents/refunds', { preHandler: [authHooks.authenticate] }, getRefundsHandler);
  app.get('/agent/refund-reports', { preHandler: [authHooks.authenticate] }, getRefundsHandler);
}

