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

  // 1. GET /admin/pending-approvals/stats — Beneficiary & Order Approval Statistics Counters
  app.get(
    '/admin/pending-approvals/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      // Unified stats query across orders, pending_beneficiary_approvals, and beneficiary_validation
      const unifiedStatsSql = `
        WITH unified_stats AS (
          SELECT 
            o.id::text as id,
            o.recipient_phone as "phone_number",
            o.network,
            CASE 
              WHEN o.order_status IN ('AWAITING_APPROVAL', 'PENDING') THEN 'PENDING'
              WHEN o.order_status = 'COMPLETED' THEN 'VALID'
              WHEN o.order_status = 'FAILED' THEN 'INVALID'
              ELSE 'PENDING'
            END as "validation_status",
            o.created_at,
            jsonb_build_object(
              'orderId', o.id,
              'channel', COALESCE(o.channel, 'Direct Order'),
              'detectedFrom', CASE WHEN o.agent_id IS NOT NULL THEN 'Agent Order' ELSE 'Customer Order' END,
              'isOrder', true
            ) as "provider_response_metadata"
          FROM orders o
          WHERE o.order_status = 'AWAITING_APPROVAL' 
             OR (o.network = 'MTN' AND o.order_status = 'PENDING')

          UNION ALL

          SELECT
            p.id::text as id,
            p.phone_number,
            p.network,
            CASE 
              WHEN p.status = 'APPROVED' THEN 'VALID'
              WHEN p.status = 'REJECTED' THEN 'INVALID'
              ELSE 'PENDING'
            END as "validation_status",
            p.created_at,
            COALESCE(p.metadata, '{}'::jsonb) as "provider_response_metadata"
          FROM pending_beneficiary_approvals p
          WHERE NOT EXISTS (
            SELECT 1 FROM orders o2 
            WHERE o2.recipient_phone = p.phone_number 
              AND (o2.order_status = 'AWAITING_APPROVAL' OR (o2.network = 'MTN' AND o2.order_status = 'PENDING'))
          )

          UNION ALL

          SELECT
            b.id::text as id,
            b.phone_number,
            b.network,
            b.validation_status,
            b.created_at,
            COALESCE(b.provider_response_metadata, '{}'::jsonb) as "provider_response_metadata"
          FROM beneficiary_validation b
          WHERE NOT EXISTS (
            SELECT 1 FROM orders o3 
            WHERE o3.recipient_phone = b.phone_number 
              AND (o3.order_status = 'AWAITING_APPROVAL' OR (o3.network = 'MTN' AND o3.order_status = 'PENDING'))
          )
          AND NOT EXISTS (
            SELECT 1 FROM pending_beneficiary_approvals p2
            WHERE p2.phone_number = b.phone_number AND p2.network = b.network
          )
        )
        SELECT 
          COUNT(CASE WHEN validation_status IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL') THEN 1 END) as "awaitingApproval",
          COUNT(CASE WHEN validation_status IN ('VALID', 'APPROVED') THEN 1 END) as "approvedValid",
          COUNT(CASE WHEN validation_status IN ('VALID', 'APPROVED') AND created_at >= CURRENT_DATE THEN 1 END) as "approvedToday",
          COUNT(CASE WHEN validation_status IN ('INVALID', 'REJECTED') THEN 1 END) as "rejected",
          COUNT(CASE WHEN validation_status = 'PROCESSING' THEN 1 END) as "processing",
          COUNT(CASE WHEN validation_status = 'SYNC_FAILED' THEN 1 END) as "syncFailed",
          COUNT(*) as "totalRegistered",
          COUNT(CASE WHEN (provider_response_metadata->>'channel' ILIKE '%excel%' OR provider_response_metadata->>'detectedFrom' ILIKE '%excel%' OR provider_response_metadata->>'recordedVia' ILIKE '%excel%') THEN 1 END) as "excelPrechecks"
        FROM unified_stats
      `;

      let statsRes: any = await db.query(unifiedStatsSql).catch(async () => {
        // Fallback for isolated beneficiary_validation schema
        return db.query(`
          SELECT 
            COUNT(CASE WHEN validation_status IN ('PENDING', 'VALIDATING', 'PENDING_APPROVAL') THEN 1 END) as "awaitingApproval",
            COUNT(CASE WHEN validation_status IN ('VALID', 'APPROVED') THEN 1 END) as "approvedValid",
            COUNT(CASE WHEN validation_status IN ('VALID', 'APPROVED') AND validated_at >= CURRENT_DATE THEN 1 END) as "approvedToday",
            COUNT(CASE WHEN validation_status IN ('INVALID', 'REJECTED') THEN 1 END) as "rejected",
            COUNT(CASE WHEN validation_status = 'PROCESSING' THEN 1 END) as "processing",
            COUNT(CASE WHEN validation_status = 'SYNC_FAILED' THEN 1 END) as "syncFailed",
            COUNT(*) as "totalRegistered",
            COUNT(CASE WHEN (provider_response_metadata->>'channel' ILIKE '%excel%' OR provider_response_metadata->>'detectedFrom' ILIKE '%excel%' OR provider_response_metadata->>'recordedVia' ILIKE '%excel%') THEN 1 END) as "excelPrechecks"
          FROM beneficiary_validation
        `).catch(() => ({
          rows: [{ awaitingApproval: 0, approvedValid: 0, approvedToday: 0, rejected: 0, processing: 0, syncFailed: 0, totalRegistered: 0, excelPrechecks: 0 }],
        }));
      });

      const affectedRes = await db.query(`
        SELECT COUNT(*) as "affectedOrders" 
        FROM orders 
        WHERE order_status = 'AWAITING_APPROVAL' OR (network = 'MTN' AND order_status = 'PENDING')
      `).catch(() => ({ rows: [{ affectedOrders: 0 }] }));

      const r = statsRes.rows[0] || {};
      const aff = affectedRes.rows[0] || {};

      const awaiting = Number(r.awaitingApproval || 0);
      const appToday = Number(r.approvedToday || 0);
      const appValid = Number(r.approvedValid || appToday);
      const rej = Number(r.rejected || 0);
      const proc = Number(r.processing || 0);
      const syncFail = Number(r.syncFailed || 0);
      const totalReg = Number(r.totalRegistered || (awaiting + appValid + rej + proc));
      const excelChecks = Number(r.excelPrechecks || 0);
      const affOrders = Number(aff.affectedOrders || 0);

      return reply.send({
        success: true,
        data: {
          awaitingApproval: awaiting,
          approvedToday: appToday,
          approvedValid: appValid,
          rejected: rej,
          rejectedInvalid: rej,
          processing: proc,
          inFlightSync: proc,
          syncFailed: syncFail,
          totalRegistered: totalReg,
          excelPrechecks: excelChecks,
          affectedOrders: affOrders,
        },
      });
    },
  );

  // 2. GET /admin/pending-approvals — Multi-Filtered Unified Approvals Directory (Orders + Prechecks)
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      network?: string;
      source?: string;
    };
  }>(
    '/admin/pending-approvals',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { page = '1', limit = '25', search, status, network, source } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10) || 25));
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
          LOWER(COALESCE(b.provider_reference, '')) LIKE $${idx} OR
          LOWER(COALESCE(u.full_name, '')) LIKE $${idx} OR
          LOWER(COALESCE(u.email, '')) LIKE $${idx}
        )`);
        params.push(term);
        idx++;
      }

      if (source && source !== 'ALL') {
        if (source === 'CUSTOMER') {
          whereConditions.push(`(u.role::text = 'customer' OR b.provider_response_metadata->>'detectedFrom' ILIKE '%customer%')`);
        } else if (source === 'AGENT') {
          whereConditions.push(`(u.role::text = 'agent' OR b.provider_response_metadata->>'detectedFrom' ILIKE '%agent%')`);
        } else if (source === 'ORDERS') {
          whereConditions.push(`b.source_type = 'order'`);
        } else if (source === 'EXCEL') {
          whereConditions.push(`(b.provider_response_metadata->>'channel' ILIKE '%excel%' OR b.provider_response_metadata->>'detectedFrom' ILIKE '%excel%' OR b.provider_response_metadata->>'recordedVia' ILIKE '%excel%')`);
        }
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const cteSql = `
        WITH unified_approvals AS (
          -- 1. Pending orders from Customer and Agent systems
          SELECT 
            o.id::text as id,
            o.recipient_phone as "phone_number",
            o.network,
            CASE 
              WHEN o.order_status IN ('AWAITING_APPROVAL', 'PENDING') THEN 'PENDING'
              WHEN o.order_status = 'COMPLETED' THEN 'VALID'
              WHEN o.order_status = 'FAILED' THEN 'INVALID'
              ELSE 'PENDING'
            END as "validation_status",
            COALESCE(o.public_id, 'ORD-DIRECT') as "provider_reference",
            NULL::timestamptz as "validated_at",
            NULL::timestamptz as "expires_at",
            o.created_at,
            ROUND((o.data_amount_mb::numeric / 1024.0), 2) as "last_bundle_size_gb",
            jsonb_build_object(
              'orderId', o.id,
              'publicId', o.public_id,
              'amountPesewas', o.amount_pesewas,
              'orderStatus', o.order_status,
              'paymentStatus', o.payment_status,
              'channel', COALESCE(o.channel, 'Direct Order'),
              'detectedFrom', CASE WHEN o.agent_id IS NOT NULL THEN 'Agent Order' ELSE 'Customer Order' END,
              'isOrder', true
            ) as "provider_response_metadata",
            COALESCE(o.agent_id, o.user_id) as "agent_id",
            COALESCE(o.user_id, o.agent_id) as "user_id",
            1 as "attempt_count",
            'order' as "source_type"
          FROM orders o
          WHERE o.order_status = 'AWAITING_APPROVAL' 
             OR (o.network = 'MTN' AND o.order_status = 'PENDING')

          UNION ALL

          -- 2. Pending beneficiary approvals (from agent or customer prechecks/uploads)
          SELECT
            p.id::text as id,
            p.phone_number,
            p.network,
            CASE 
              WHEN p.status = 'APPROVED' THEN 'VALID'
              WHEN p.status = 'REJECTED' THEN 'INVALID'
              ELSE 'PENDING'
            END as "validation_status",
            COALESCE(p.provider_reference, 'BEN-PRECHECK') as "provider_reference",
            p.resolved_at as "validated_at",
            NULL::timestamptz as "expires_at",
            p.created_at,
            p.last_bundle_size_gb,
            COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
              'detectedFrom', COALESCE(p.detected_from, 'Agent/Customer Precheck'),
              'isOrder', false
            ) as "provider_response_metadata",
            p.agent_id,
            p.agent_id as "user_id",
            COALESCE(p.attempt_count, 1) as "attempt_count",
            'pending_approval' as "source_type"
          FROM pending_beneficiary_approvals p
          WHERE NOT EXISTS (
            SELECT 1 FROM orders o2 
            WHERE o2.recipient_phone = p.phone_number 
              AND (o2.order_status = 'AWAITING_APPROVAL' OR (o2.network = 'MTN' AND o2.order_status = 'PENDING'))
          )

          UNION ALL

          -- 3. Beneficiary validation records (platform-wide registry)
          SELECT
            b.id::text as id,
            b.phone_number,
            b.network,
            b.validation_status,
            b.provider_reference,
            b.validated_at,
            b.expires_at,
            b.created_at,
            b.last_bundle_size_gb,
            COALESCE(b.provider_response_metadata, '{}'::jsonb) as "provider_response_metadata",
            b.agent_id,
            COALESCE(b.user_id, b.agent_id) as "user_id",
            COALESCE(b.attempt_count, 1) as "attempt_count",
            'beneficiary_validation' as "source_type"
          FROM beneficiary_validation b
          WHERE NOT EXISTS (
            SELECT 1 FROM orders o3 
            WHERE o3.recipient_phone = b.phone_number 
              AND (o3.order_status = 'AWAITING_APPROVAL' OR (o3.network = 'MTN' AND o3.order_status = 'PENDING'))
          )
          AND NOT EXISTS (
            SELECT 1 FROM pending_beneficiary_approvals p2
            WHERE p2.phone_number = b.phone_number AND p2.network = b.network
          )
        )
      `;

      let total = 0;
      let listRows: any[] = [];

      try {
        const countSql = `${cteSql} SELECT COUNT(*) as total FROM unified_approvals b LEFT JOIN users u ON (b.user_id = u.id OR b.agent_id = u.id) ${whereSql}`;
        const countRes = await db.query(countSql, params);
        total = parseInt(countRes.rows[0]?.total || '0', 10);

        const listSql = `
          ${cteSql}
          SELECT b.id, b.phone_number as "phoneNumber", b.network,
                 b.validation_status as "status", b.provider_reference as "providerReference",
                 b.validated_at as "validatedAt", b.expires_at as "expiresAt",
                 b.created_at as "createdAt",
                 b.last_bundle_size_gb as "lastBundleSizeGb",
                 b.provider_response_metadata as "metadata",
                 b.agent_id as "agentId",
                 b.source_type as "sourceType",
                 u.full_name as "agentName",
                 u.email as "agentEmail",
                 u.role as "agentRole",
                 GREATEST(COALESCE(b.attempt_count, 1), (SELECT COUNT(*) FROM orders o WHERE o.recipient_phone = b.phone_number)) as "occurrences"
          FROM unified_approvals b
          LEFT JOIN users u ON (b.user_id = u.id OR b.agent_id = u.id)
          ${whereSql}
          ORDER BY b.created_at DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `;
        const listRes = await db.query(listSql, [...params, limitNum, offset]);
        listRows = listRes.rows;
      } catch {
        // Resilient fallback to classic beneficiary_validation table query if CTE not supported
        const fallbackCountSql = `SELECT COUNT(*) as total FROM beneficiary_validation b ${whereSql}`;
        const countRes = await db.query(fallbackCountSql, params).catch(() => ({ rows: [{ total: 0 }] }));
        total = parseInt(countRes.rows[0]?.total || '0', 10);

        const fallbackListSql = `
          SELECT b.id, b.phone_number as "phoneNumber", b.network,
                 b.validation_status as "status", b.provider_reference as "providerReference",
                 b.validated_at as "validatedAt", b.expires_at as "expiresAt",
                 b.created_at as "createdAt",
                 b.last_bundle_size_gb as "lastBundleSizeGb",
                 b.provider_response_metadata as "metadata",
                 b.agent_id as "agentId",
                 'beneficiary_validation' as "sourceType",
                 u.full_name as "agentName",
                 u.email as "agentEmail",
                 u.role as "agentRole",
                 GREATEST(COALESCE(b.attempt_count, 1), (SELECT COUNT(*) FROM orders o WHERE o.recipient_phone = b.phone_number)) as "occurrences"
          FROM beneficiary_validation b
          LEFT JOIN users u ON (b.agent_id = u.id OR b.user_id = u.id)
          ${whereSql}
          ORDER BY b.created_at DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `;
        const listRes = await db.query(fallbackListSql, [...params, limitNum, offset]).catch(() => ({ rows: [] }));
        listRows = listRes.rows;
      }

      const items = listRows.map((r: any) => {
        const meta = (typeof r.metadata === 'object' && r.metadata) || {};
        let dataSize = meta.dataSize;
        if (!dataSize && r.lastBundleSizeGb) {
          dataSize = `${r.lastBundleSizeGb} GB`;
        }
        if (!dataSize) {
          dataSize = '5 GB';
        }

        const sourceRole = r.agentRole || (meta.userRole) || (r.agentId ? 'agent' : 'customer');
        const detectedFrom = meta.detectedFrom || meta.channel || (r.sourceType === 'order' ? (sourceRole === 'agent' ? 'Agent Order' : 'Customer Order') : (r.agentId ? 'Excel Upload' : 'Excel Precheck'));
        const sourceLabel = r.agentName ? `${r.agentName} (${sourceRole})` : r.agentEmail ? `${r.agentEmail} (${sourceRole})` : (sourceRole === 'agent' ? 'Agent System' : 'Customer Portal');

        return {
          id: r.id,
          phoneNumber: r.phoneNumber,
          network: r.network,
          status: r.status,
          providerReference: r.providerReference,
          validatedAt: r.validatedAt,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          occurrences: Math.max(1, Number(r.occurrences || 1)),
          dataSize,
          detectedFrom,
          sourceRole,
          sourceLabel,
          agentId: r.agentId || meta.agentId || null,
          sourceType: r.sourceType || (meta.isOrder ? 'order' : 'beneficiary_validation'),
          orderId: meta.orderId || (r.sourceType === 'order' ? r.id : undefined),
          publicId: meta.publicId || undefined,
          amountPesewas: meta.amountPesewas ? Number(meta.amountPesewas) : undefined,
          paymentStatus: meta.paymentStatus || undefined,
          isOrder: Boolean(meta.isOrder || r.sourceType === 'order'),
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
    },
  );

  // 3. GET /admin/pending-approvals/:id — Individual Beneficiary & Order Dossier
  app.get<{ Params: { id: string } }>(
    '/admin/pending-approvals/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const id = req.params.id;

      let rawRecord: any = null;

      // 1. Try beneficiary_validation
      const recordRes = await db.query(
        `SELECT b.id, b.phone_number as "phoneNumber", b.network, b.validation_status as "status",
                b.provider_reference as "providerReference", b.validated_at as "validatedAt",
                b.expires_at as "expiresAt", b.created_at as "createdAt",
                b.last_bundle_size_gb as "lastBundleSizeGb",
                b.provider_response_metadata as "metadata",
                b.agent_id as "agentId",
                'beneficiary_validation' as "sourceType",
                u.full_name as "agentName",
                u.email as "agentEmail",
                u.role as "agentRole"
         FROM beneficiary_validation b
         LEFT JOIN users u ON (b.agent_id = u.id OR b.user_id = u.id)
         WHERE b.id = $1`,
        [id],
      ).catch(() => ({ rows: [] }));

      if (recordRes.rows.length > 0) {
        rawRecord = recordRes.rows[0];
      }

      // 2. Try pending_beneficiary_approvals if not found
      if (!rawRecord) {
        const pendingRes = await db.query(
          `SELECT p.id, p.phone_number as "phoneNumber", p.network,
                  CASE WHEN p.status = 'APPROVED' THEN 'VALID' WHEN p.status = 'REJECTED' THEN 'INVALID' ELSE 'PENDING' END as "status",
                  COALESCE(p.provider_reference, 'BEN-PRECHECK') as "providerReference",
                  p.resolved_at as "validatedAt",
                  NULL as "expiresAt",
                  p.created_at as "createdAt",
                  p.last_bundle_size_gb as "lastBundleSizeGb",
                  COALESCE(p.metadata, '{}'::jsonb) as "metadata",
                  p.agent_id as "agentId",
                  'pending_approval' as "sourceType",
                  u.full_name as "agentName",
                  u.email as "agentEmail",
                  u.role as "agentRole"
           FROM pending_beneficiary_approvals p
           LEFT JOIN users u ON p.agent_id = u.id
           WHERE p.id::text = $1`,
          [id],
        ).catch(() => ({ rows: [] }));

        if (pendingRes.rows.length > 0) {
          rawRecord = pendingRes.rows[0];
        }
      }

      // 3. Try orders table if not found
      if (!rawRecord) {
        const orderLookup = await db.query(
          `SELECT o.id, o.recipient_phone as "phoneNumber", o.network,
                  CASE WHEN o.order_status IN ('AWAITING_APPROVAL', 'PENDING') THEN 'PENDING' ELSE o.order_status END as "status",
                  COALESCE(po.provider_reference, o.public_id, 'ORD-DIRECT') as "providerReference",
                  NULL as "validatedAt",
                  NULL as "expiresAt",
                  o.created_at as "createdAt",
                  ROUND((o.data_amount_mb::numeric / 1024.0), 2) as "lastBundleSizeGb",
                  jsonb_build_object(
                    'orderId', o.id,
                    'publicId', o.public_id,
                    'amountPesewas', o.amount_pesewas,
                    'orderStatus', o.order_status,
                    'paymentStatus', o.payment_status,
                    'channel', COALESCE(o.channel, 'Direct Order'),
                    'detectedFrom', CASE WHEN o.agent_id IS NOT NULL THEN 'Agent Order' ELSE 'Customer Order' END,
                    'isOrder', true
                  ) as "metadata",
                  COALESCE(o.agent_id, o.user_id) as "agentId",
                  'order' as "sourceType",
                  u.full_name as "agentName",
                  u.email as "agentEmail",
                  u.role as "agentRole"
           FROM orders o
           LEFT JOIN provider_orders po ON po.order_id = o.id
           LEFT JOIN users u ON (o.user_id = u.id OR o.agent_id = u.id)
           WHERE o.id::text = $1 OR o.public_id = $1`,
          [id],
        ).catch(() => ({ rows: [] }));

        if (orderLookup.rows.length > 0) {
          rawRecord = orderLookup.rows[0];
        }
      }

      if (!rawRecord) {
        throw new NotFoundError(`Beneficiary record [${id}] not found.`);
      }

      const meta = (typeof rawRecord.metadata === 'object' && rawRecord.metadata) || {};
      const dataSize = meta.dataSize || (rawRecord.lastBundleSizeGb ? `${rawRecord.lastBundleSizeGb} GB` : '5 GB');
      const sourceRole = rawRecord.agentRole || meta.userRole || (rawRecord.agentId ? 'agent' : 'customer');
      const detectedFrom = meta.detectedFrom || meta.channel || (rawRecord.sourceType === 'order' ? (sourceRole === 'agent' ? 'Agent Order' : 'Customer Order') : (rawRecord.agentId ? 'Excel Upload' : 'Excel Precheck'));
      const sourceLabel = rawRecord.agentName ? `${rawRecord.agentName} (${sourceRole})` : rawRecord.agentEmail ? `${rawRecord.agentEmail} (${sourceRole})` : (sourceRole === 'agent' ? 'Agent System' : 'Customer Portal');

      const record = {
        ...rawRecord,
        dataSize,
        detectedFrom,
        sourceRole,
        sourceLabel,
        isOrder: Boolean(meta.isOrder || rawRecord.sourceType === 'order'),
        orderId: meta.orderId || (rawRecord.sourceType === 'order' ? rawRecord.id : undefined),
        publicId: meta.publicId || undefined,
        amountPesewas: meta.amountPesewas ? Number(meta.amountPesewas) : undefined,
        paymentStatus: meta.paymentStatus || undefined,
      };

      // Affected Orders for this recipient phone
      const affectedOrdersRes = await db.query(
        `SELECT o.id, o.public_id as "publicId", o.recipient_phone as "recipientPhone", o.network,
                o.data_amount_mb as "dataAmountMb", o.amount_pesewas as "amountPesewas",
                o.order_status as "orderStatus", o.payment_status as "paymentStatus",
                o.created_at as "createdAt",
                COALESCE(u.full_name, 'Customer') as "userName", u.email as "userEmail", u.role as "userRole"
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
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

      // 1. Try beneficiary_validation
      let phone_number: string | null = null;
      let network: string = 'MTN';

      const recordRes = await db.query(
        `SELECT phone_number, network FROM beneficiary_validation WHERE id = $1`,
        [id],
      ).catch(() => ({ rows: [] }));

      if (recordRes.rows.length > 0) {
        phone_number = recordRes.rows[0].phone_number;
        network = recordRes.rows[0].network;
      }

      // 2. Try pending_beneficiary_approvals if not found
      if (!phone_number) {
        const pendingRes = await db.query(
          `SELECT phone_number, network FROM pending_beneficiary_approvals WHERE id::text = $1`,
          [id],
        ).catch(() => ({ rows: [] }));
        if (pendingRes.rows.length > 0) {
          phone_number = pendingRes.rows[0].phone_number;
          network = pendingRes.rows[0].network;
        }
      }

      // 3. Try orders table if not found
      if (!phone_number) {
        const orderRes = await db.query(
          `SELECT recipient_phone as phone_number, network FROM orders WHERE id::text = $1 OR public_id = $1`,
          [id],
        ).catch(() => ({ rows: [] }));
        if (orderRes.rows.length > 0) {
          phone_number = orderRes.rows[0].phone_number;
          network = orderRes.rows[0].network;
        }
      }

      if (!phone_number) {
        throw new NotFoundError(`Beneficiary record [${id}] not found.`);
      }

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

      // Fetch phone numbers across all sources
      const phoneSet = new Map<string, NetworkProvider>();

      const bvRes = await db.query(
        `SELECT phone_number, network FROM beneficiary_validation WHERE id::text = ANY($1)`,
        [ids],
      ).catch(() => ({ rows: [] }));
      for (const r of bvRes.rows) {
        if (r.phone_number) phoneSet.set(r.phone_number, r.network as NetworkProvider);
      }

      const pbaRes = await db.query(
        `SELECT phone_number, network FROM pending_beneficiary_approvals WHERE id::text = ANY($1)`,
        [ids],
      ).catch(() => ({ rows: [] }));
      for (const r of pbaRes.rows) {
        if (r.phone_number && !phoneSet.has(r.phone_number)) {
          phoneSet.set(r.phone_number, r.network as NetworkProvider);
        }
      }

      const ordRes = await db.query(
        `SELECT recipient_phone as phone_number, network FROM orders WHERE id::text = ANY($1) OR public_id = ANY($1)`,
        [ids],
      ).catch(() => ({ rows: [] }));
      for (const r of ordRes.rows) {
        if (r.phone_number && !phoneSet.has(r.phone_number)) {
          phoneSet.set(r.phone_number, r.network as NetworkProvider);
        }
      }

      let syncedCount = 0;
      for (const [phoneNumber, network] of phoneSet.entries()) {
        await beneficiaryService.precheckBeneficiaries({
          phoneNumbers: [phoneNumber],
          network: network || NetworkProvider.MTN,
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

      // Re-evaluate affected orders: release AWAITING_APPROVAL & PENDING MTN orders to fulfillment queue
      const affectedRes = await db.query(
        `SELECT id, recipient_phone, network, data_amount_mb
         FROM orders WHERE recipient_phone = $1`,
        [approved.phoneNumber],
      ).catch(() => ({ rows: [] }));

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
        ).catch(() => {});
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

      // Also mark affected orders with status AWAITING_APPROVAL or PENDING as FAILED
      const affectedRes = await db.query(
        `SELECT id, recipient_phone, network
         FROM orders 
         WHERE (recipient_phone = $1 OR id::text = $2) 
           AND (order_status = 'AWAITING_APPROVAL' OR (network = 'MTN' AND order_status = 'PENDING'))`,
        [rejected.phoneNumber, id],
      ).catch(() => ({ rows: [] }));

      let failedOrdersCount = 0;
      for (const order of affectedRes.rows) {
        await db.query(
          `UPDATE orders 
           SET order_status = 'FAILED', 
               provider_status = 'REJECTED',
               failure_reason = $1,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [reason || 'MTN beneficiary rejected by administrator', order.id],
        ).catch(() => {});
        failedOrdersCount++;
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BENEFICIARY_REJECT',
          resourceType: 'beneficiary_validation',
          resourceId: id,
          metadata: { phoneNumber: rejected.phoneNumber, reason, failedOrdersCount },
        });
      }

      return reply.send({
        success: true,
        data: rejected,
        message: `Beneficiary ${rejected.phoneNumber} marked as rejected. Updated ${failedOrdersCount} orders to FAILED.`,
      });
    },
  );

  // 7. POST /admin/pending-approvals/export — Export Pending Approvals Dataset (Unified)
  app.post(
    '/admin/pending-approvals/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const listSql = `
        WITH unified_export AS (
          SELECT 
            o.recipient_phone as "phoneNumber",
            o.network,
            ROUND((o.data_amount_mb::numeric / 1024.0), 2) as "lastBundleSizeGb",
            CASE 
              WHEN o.order_status IN ('AWAITING_APPROVAL', 'PENDING') THEN 'PENDING'
              ELSE o.order_status 
            END as "status",
            CASE WHEN o.agent_id IS NOT NULL THEN 'Agent Order' ELSE 'Customer Order' END as "detectedFrom",
            COALESCE(o.public_id, 'ORD-DIRECT') as "providerReference",
            NULL::timestamptz as "validatedAt",
            o.created_at as "createdAt",
            COALESCE(o.agent_id, o.user_id) as "agent_id"
          FROM orders o
          WHERE o.order_status = 'AWAITING_APPROVAL' 
             OR (o.network = 'MTN' AND o.order_status = 'PENDING')

          UNION ALL

          SELECT
            p.phone_number as "phoneNumber",
            p.network,
            p.last_bundle_size_gb as "lastBundleSizeGb",
            p.status,
            COALESCE(p.detected_from, 'Agent/Customer Precheck') as "detectedFrom",
            COALESCE(p.provider_reference, 'BEN-PRECHECK') as "providerReference",
            p.resolved_at as "validatedAt",
            p.created_at as "createdAt",
            p.agent_id
          FROM pending_beneficiary_approvals p

          UNION ALL

          SELECT
            b.phone_number as "phoneNumber",
            b.network,
            b.last_bundle_size_gb as "lastBundleSizeGb",
            b.validation_status as "status",
            COALESCE(b.provider_response_metadata->>'detectedFrom', b.provider_response_metadata->>'channel', 'Excel Precheck') as "detectedFrom",
            b.provider_reference as "providerReference",
            b.validated_at as "validatedAt",
            b.created_at as "createdAt",
            b.agent_id
          FROM beneficiary_validation b
        )
        SELECT e."phoneNumber", e.network, e."lastBundleSizeGb", e.status, e."detectedFrom",
               e."providerReference", e."validatedAt", e."createdAt",
               u.full_name as "agentName", u.role as "agentRole", u.email as "agentEmail"
        FROM unified_export e
        LEFT JOIN users u ON e.agent_id = u.id
        ORDER BY e."createdAt" DESC
        LIMIT 2000
      `;

      let listRes = await db.query(listSql).catch(async () => {
        return db.query(`
          SELECT b.phone_number as "phoneNumber", b.network, b.validation_status as "status",
                 b.provider_reference as "providerReference", b.validated_at as "validatedAt",
                 b.created_at as "createdAt", b.last_bundle_size_gb as "lastBundleSizeGb",
                 b.provider_response_metadata as "metadata", b.agent_id as "agentId",
                 u.full_name as "agentName", u.role as "agentRole"
          FROM beneficiary_validation b
          LEFT JOIN users u ON (b.agent_id = u.id OR b.user_id = u.id)
          ORDER BY b.created_at DESC
          LIMIT 1000
        `);
      });

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
        ['Phone Number', 'Network', 'Data Size', 'Status', 'Detected Channel', 'Source System', 'Provider Reference', 'Validated At', 'Created At'].join(','),
        ...listRes.rows.map((r: any) => {
          const dataSize = r.lastBundleSizeGb ? `${r.lastBundleSizeGb} GB` : '5 GB';
          const detectedFrom = r.detectedFrom || 'Excel Precheck';
          const source = r.agentName ? `${r.agentName} (${r.agentRole || 'agent'})` : r.agentEmail ? `${r.agentEmail} (${r.agentRole || 'agent'})` : (r.agentRole === 'agent' ? 'Agent System' : 'Customer Portal');
          return [
            r.phoneNumber,
            r.network,
            `"${dataSize}"`,
            r.status,
            `"${detectedFrom}"`,
            `"${source}"`,
            `"${r.providerReference || 'N/A'}"`,
            r.validatedAt || 'N/A',
            r.createdAt,
          ].join(',');
        }),
      ].join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="pending_approvals_export_${Date.now()}.csv"`)
        .send(csvRows);
    },
  );

  // 8. DELETE /admin/pending-approvals — Delete All Beneficiary Approvals Platform-Wide
  app.delete<{
    Querystring: {
      network?: string;
      status?: string;
    };
  }>(
    '/admin/pending-approvals',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { network, status } = req.query as any;

      const result = await beneficiaryService.deleteAllBeneficiaryApprovals({
        network,
        status,
        role: (req.user as any)?.role || 'ADMIN',
      });

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'DELETE_ALL_BENEFICIARIES',
          resourceType: 'beneficiary_validation',
          resourceId: 'all',
          metadata: { deletedCount: result.count, network, status },
        });
      }

      return reply.send({
        success: true,
        data: result,
      });
    },
  );

  // 9. DELETE /admin/pending-approvals/:id — Delete Single Beneficiary Approval Record
  app.delete<{ Params: { id: string } }>(
    '/admin/pending-approvals/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as any;

      const result = await beneficiaryService.deleteBeneficiaryApproval(
        id,
        undefined,
        (req.user as any)?.role || 'ADMIN',
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'DELETE_BENEFICIARY',
          resourceType: 'beneficiary_validation',
          resourceId: id,
          metadata: { id },
        });
      }

      return reply.send({
        success: true,
        data: result,
      });
    },
  );
}
