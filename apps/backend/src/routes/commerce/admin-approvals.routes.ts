import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { FulfillmentQueueService } from '../../core/providers/fulfillment-queue.service.js';
import { BeneficiaryService } from '../../core/commerce/beneficiary.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { NetworkProvider } from '@bytebeacon/shared';

export interface AdminApprovalsRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  fulfillmentQueueService: FulfillmentQueueService;
  beneficiaryService: BeneficiaryService;
}

export async function adminApprovalsRoutes(
  app: FastifyInstance,
  deps: AdminApprovalsRouteDependencies,
) {
  const {
    db,
    tokenService,
    apiKeyService,
    rbacService,
    auditService,
    fulfillmentQueueService,
    beneficiaryService,
  } = deps;

  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Phone Normalization Helper (Ghana 024XXXXXXX <-> 23324XXXXXXX)
  const normalizeGhanaPhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('233') && clean.length === 12) {
      return '0' + clean.slice(3);
    }
    return clean;
  };

  // 1. GET /admin/pending-approvals/stats — Beneficiary Approval Statistics Counters
  app.get(
    '/admin/pending-approvals/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const statsRes = await db.query(`
        SELECT 
          COUNT(CASE WHEN validation_status IN ('PENDING', 'VALIDATING') THEN 1 END) as "awaitingApproval",
          COUNT(CASE WHEN validation_status = 'VALID' AND validated_at >= CURRENT_DATE THEN 1 END) as "approvedToday",
          COUNT(CASE WHEN validation_status = 'INVALID' THEN 1 END) as "rejected",
          COUNT(CASE WHEN validation_status = 'PROCESSING' THEN 1 END) as "processing",
          COUNT(CASE WHEN validation_status = 'SYNC_FAILED' THEN 1 END) as "syncFailed"
        FROM beneficiary_validation
      `).catch(() => ({
        rows: [{ awaitingApproval: 0, approvedToday: 0, rejected: 0, processing: 0, syncFailed: 0 }],
      }));

      const affectedRes = await db.query(`
        SELECT COUNT(*) as "affectedOrders" FROM orders WHERE order_status = 'AWAITING_APPROVAL'
      `).catch(() => ({ rows: [{ affectedOrders: 0 }] }));

      const r = statsRes.rows[0] || {};
      const aff = affectedRes.rows[0] || {};

      return reply.send({
        success: true,
        data: {
          awaitingApproval: Number(r.awaitingApproval || 0),
          approvedToday: Number(r.approvedToday || 0),
          rejected: Number(r.rejected || 0),
          processing: Number(r.processing || 0),
          syncFailed: Number(r.syncFailed || 0),
          affectedOrders: Number(aff.affectedOrders || 0),
        },
      });
    },
  );

  // 2. GET /admin/pending-approvals — Multi-Filtered Beneficiary Approvals Directory
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      network?: string;
    };
  }>(
    '/admin/pending-approvals',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { page = '1', limit = '25', search, status, network } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (status && status !== 'ALL') {
        whereConditions.push(`b.validation_status = $${idx}`);
        params.push(status);
        idx++;
      }

      if (network && network !== 'ALL') {
        whereConditions.push(`b.network = $${idx}`);
        params.push(network);
        idx++;
      }

      if (search && search.trim() !== '') {
        const norm = normalizeGhanaPhone(search.trim());
        const term = `%${norm}%`;
        whereConditions.push(`(
          b.phone_number LIKE $${idx} OR
          LOWER(COALESCE(b.provider_reference, '')) LIKE $${idx}
        )`);
        params.push(term);
        idx++;
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM beneficiary_validation b ${whereSql}`;
      const countRes = await db.query(countSql, params).catch(() => ({ rows: [{ total: 0 }] }));
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT b.id, b.phone_number as "phoneNumber", b.network,
               b.validation_status as "status", b.provider_reference as "providerReference",
               b.validated_at as "validatedAt", b.expires_at as "expiresAt",
               b.created_at as "createdAt",
               (SELECT COUNT(*) FROM orders o WHERE o.recipient_phone = b.phone_number) as "occurrences"
        FROM beneficiary_validation b
        ${whereSql}
        ORDER BY b.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `;

      const listRes = await db.query(listSql, [...params, limitNum, offset]).catch(() => ({ rows: [] }));

      return reply.send({
        success: true,
        data: {
          items: listRes.rows,
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

  // 3. GET /admin/pending-approvals/:id — Individual Beneficiary Dossier
  app.get<{ Params: { id: string } }>(
    '/admin/pending-approvals/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const id = req.params.id;

      const recordRes = await db.query(
        `SELECT id, phone_number as "phoneNumber", network, validation_status as "status",
                provider_reference as "providerReference", validated_at as "validatedAt",
                expires_at as "expiresAt", created_at as "createdAt"
         FROM beneficiary_validation WHERE id = $1`,
        [id],
      );

      if (recordRes.rows.length === 0) {
        throw new NotFoundError(`Beneficiary record [${id}] not found.`);
      }

      const record = recordRes.rows[0];

      // Affected Orders
      const affectedOrdersRes = await db.query(
        `SELECT o.id, o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
                o.amount_pesewas as "amountPesewas", o.order_status as "orderStatus", o.created_at as "createdAt",
                COALESCE(u.full_name, u.name, 'Customer') as "userName", u.email as "userEmail"
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.uuid
         WHERE o.recipient_phone = $1
         ORDER BY o.created_at DESC LIMIT 20`,
        [record.phoneNumber],
      ).catch(() => ({ rows: [] }));

      return reply.send({
        success: true,
        data: {
          record,
          affectedOrders: affectedOrdersRes.rows,
        },
      });
    },
  );

  // 4. POST /admin/pending-approvals/:id/sync — Background Beneficiary Sync
  app.post<{ Params: { id: string } }>(
    '/admin/pending-approvals/:id/sync',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const id = req.params.id;

      const recordRes = await db.query(
        `SELECT phone_number, network FROM beneficiary_validation WHERE id = $1`,
        [id],
      );

      if (recordRes.rows.length === 0) {
        throw new NotFoundError(`Beneficiary record [${id}] not found.`);
      }

      const { phone_number, network } = recordRes.rows[0];

      // Execute precheck via BeneficiaryService
      const precheck = await beneficiaryService.precheckBeneficiaries({
        phoneNumbers: [phone_number],
        network: network as NetworkProvider,
        record: true,
      });

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BENEFICIARY_SYNC',
          resourceType: 'beneficiary_validation',
          resourceId: id,
          metadata: { phoneNumber: phone_number, precheck },
        });
      }

      return reply.send({
        success: true,
        data: precheck,
        message: `Beneficiary synchronization triggered for ${phone_number}.`,
      });
    },
  );

  // 5. POST /admin/pending-approvals/bulk-sync — Batch Beneficiary Sync
  app.post<{ Body: { ids: string[] } }>(
    '/admin/pending-approvals/bulk-sync',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { ids = [] } = req.body || {};

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('Array of beneficiary record IDs is required.');
      }

      const recordsRes = await db.query(
        `SELECT id, phone_number, network FROM beneficiary_validation WHERE id = ANY($1)`,
        [ids],
      );

      let syncedCount = 0;
      for (const row of recordsRes.rows) {
        await beneficiaryService.precheckBeneficiaries({
          phoneNumbers: [row.phone_number],
          network: row.network as NetworkProvider,
          record: true,
        });
        syncedCount++;
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BENEFICIARY_BULK_SYNC',
          resourceType: 'beneficiary_validation',
          resourceId: 'batch',
          metadata: { syncedCount },
        });
      }

      return reply.send({
        success: true,
        data: { syncedCount },
        message: `Successfully synchronized ${syncedCount} beneficiary numbers.`,
      });
    },
  );

  // 6. POST /admin/pending-approvals/:id/approve & REJECT
  app.post<{ Params: { id: string } }>(
    '/admin/pending-approvals/:id/approve',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const id = req.params.id;
      const approved = await beneficiaryService.approveBeneficiary(id);

      // Re-evaluate affected orders: release AWAITING_APPROVAL orders to fulfillment queue
      const affectedRes = await db.query(
        `SELECT id, recipient_phone, network, data_amount_mb
         FROM orders WHERE recipient_phone = $1 AND order_status = 'AWAITING_APPROVAL'`,
        [approved.phoneNumber],
      );

      let enqueuedCount = 0;
      for (const order of affectedRes.rows) {
        await fulfillmentQueueService.enqueueOrderFulfillment({
          orderId: order.id,
          phoneNumber: order.recipient_phone,
          network: order.network as NetworkProvider,
          dataAmountMb: order.data_amount_mb,
          idempotencyKey: `auto_release_${order.id}_${Date.now()}`,
          attemptCount: 1,
          correlationId: req.id,
        });

        await db.query(
          `UPDATE orders SET order_status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [order.id],
        );
        enqueuedCount++;
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BENEFICIARY_APPROVE',
          resourceType: 'beneficiary_validation',
          resourceId: id,
          metadata: { phoneNumber: approved.phoneNumber, enqueuedOrders: enqueuedCount },
        });
      }

      return reply.send({
        success: true,
        data: { approved, enqueuedOrders: enqueuedCount },
        message: `Beneficiary approved. Released ${enqueuedCount} blocked orders for fulfillment.`,
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/admin/pending-approvals/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const id = req.params.id;
      const { reason } = req.body || {};

      const rejected = await beneficiaryService.rejectBeneficiary(id);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BENEFICIARY_REJECT',
          resourceType: 'beneficiary_validation',
          resourceId: id,
          metadata: { phoneNumber: rejected.phoneNumber, reason },
        });
      }

      return reply.send({
        success: true,
        data: rejected,
        message: `Beneficiary ${rejected.phoneNumber} marked as rejected.`,
      });
    },
  );

  // 7. POST /admin/pending-approvals/export — Export Pending Approvals Dataset
  app.post(
    '/admin/pending-approvals/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const listRes = await db.query(`
        SELECT phone_number as "phoneNumber", network, validation_status as "status",
               provider_reference as "providerReference", validated_at as "validatedAt",
               created_at as "createdAt"
        FROM beneficiary_validation
        ORDER BY created_at DESC
        LIMIT 1000
      `);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'EXPORT_BENEFICIARIES',
          resourceType: 'beneficiary_validation',
          resourceId: 'batch',
          metadata: { count: listRes.rows.length },
        });
      }

      const csvRows = [
        ['Phone Number', 'Network', 'Status', 'Provider Reference', 'Validated At', 'Created At'].join(','),
        ...listRes.rows.map((r) => [
          r.phoneNumber,
          r.network,
          r.status,
          r.providerReference || 'N/A',
          r.validatedAt || 'N/A',
          r.createdAt,
        ].join(',')),
      ].join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="pending_approvals_export_${Date.now()}.csv"`)
        .send(csvRows);
    },
  );
}
