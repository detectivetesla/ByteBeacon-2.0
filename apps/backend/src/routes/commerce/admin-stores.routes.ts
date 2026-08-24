import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import {
  AdminStoreStats,
  AdminStoreListItem,
  AdminStoreDetail,
  StoreProductAdminDto,
  UpdateStoreProductsRequest,
  StorePayoutDto,
  StorePayoutActionRequest,
  StoreHealthReportDto,
  ApiResponse,
  StoreStatus,
  LedgerAccountType,
  LedgerEntryType,
  Currency,
} from '@bytebeacon/shared';

export interface AdminStoresRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService: AuditService;
  financialLedgerService?: FinancialLedgerService;
}

export async function adminStoresRoutes(
  app: FastifyInstance,
  deps: AdminStoresRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService, financialLedgerService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper to map DB row to AdminStoreListItem
  const mapStoreRow = (r: any): AdminStoreListItem => {
    return {
      id: r.id,
      agentId: r.agentId || r.agent_id || undefined,
      userId: r.userId || r.user_id,
      storeName: r.storeName || r.store_name || 'Unnamed Store',
      slug: r.slug || '',
      ownerName: r.ownerName || r.owner_name || 'Merchant Owner',
      ownerEmail: r.ownerEmail || r.owner_email || '',
      ownerPhone: r.ownerPhone || r.owner_phone || undefined,
      paymentStatus: r.paymentStatus || r.payment_status || 'NOT_STARTED',
      approvalStatus: (r.approvalStatus || r.approval_status || 'NOT_SUBMITTED').toUpperCase(),
      storeStatus: (r.storeStatus || r.store_status || 'NOT_STARTED').toUpperCase(),
      activationFeePesewas: parseInt(r.activationFeePesewas || r.activation_fee_pesewas || '50000', 10),
      paystackReference: r.paystackReference || r.paystack_reference || undefined,
      totalSalesPesewas: parseInt(r.totalSalesPesewas || r.total_sales_pesewas || '0', 10),
      pendingPayoutPesewas: parseInt(r.pendingPayoutPesewas || r.pending_payout_pesewas || '0', 10),
      productsCount: parseInt(r.productsCount || r.products_count || '0', 10),
      adminNotes: r.adminNotes || r.admin_notes || undefined,
      createdAt: r.createdAt || r.created_at ? new Date(r.createdAt || r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt || r.updated_at ? new Date(r.updatedAt || r.updated_at).toISOString() : new Date().toISOString(),
    };
  };

  // 1. GET STORE STATS (/admin/stores/stats)
  app.get(
    '/admin/stores/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const statsQuery = `
        SELECT
          COUNT(*) as "totalStores",
          COUNT(*) FILTER (WHERE store_status = 'ACTIVE') as "activeStores",
          COUNT(*) FILTER (WHERE approval_status = 'AWAITING_APPROVAL') as "pendingReviewStores",
          COUNT(*) FILTER (WHERE store_status = 'SUSPENDED') as "suspendedStores",
          COUNT(*) FILTER (WHERE approval_status = 'REJECTED') as "rejectedStores",
          COALESCE((
            SELECT COUNT(*) FROM store_payouts WHERE status = 'PENDING'
          ), 0) as "pendingWithdrawalsCount",
          COALESCE((
            SELECT SUM(amount_pesewas) FROM store_payouts WHERE status = 'PENDING'
          ), 0) as "pendingWithdrawalPesewas",
          COALESCE((
            SELECT SUM(amount_pesewas) FROM orders WHERE store_id IS NOT NULL AND payment_status = 'PAID'
          ), 0) as "totalSalesPesewas",
          COALESCE((
            SELECT SUM(amount_pesewas) FROM orders WHERE store_id IS NOT NULL AND payment_status = 'PAID'
          ), 0) as "totalRevenuePesewas",
          COALESCE((
            SELECT SUM(amount_pesewas) FROM store_payouts WHERE status = 'PAID'
          ), 0) as "totalPayoutsPesewas"
        FROM stores
      `;

      const res = await db.query(statsQuery);
      const row = res.rows[0] || {};

      const stats: AdminStoreStats = {
        totalStores: parseInt(row.totalStores || '0', 10),
        activeStores: parseInt(row.activeStores || '0', 10),
        pendingReviewStores: parseInt(row.pendingReviewStores || '0', 10),
        pendingWithdrawalsCount: parseInt(row.pendingWithdrawalsCount || '0', 10),
        pendingWithdrawalPesewas: parseInt(row.pendingWithdrawalPesewas || '0', 10),
        suspendedStores: parseInt(row.suspendedStores || '0', 10),
        rejectedStores: parseInt(row.rejectedStores || '0', 10),
        totalSalesPesewas: parseInt(row.totalSalesPesewas || '0', 10),
        totalRevenuePesewas: parseInt(row.totalRevenuePesewas || '0', 10),
        totalPayoutsPesewas: parseInt(row.totalPayoutsPesewas || '0', 10),
      };

      const response: ApiResponse<AdminStoreStats> = {
        success: true,
        data: stats,
      };

      return reply.send(response);
    },
  );

  // 2. LIST STORES WITH MULTI-FILTERING & SEARCH (/admin/stores)
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
      approval?: string;
      payment?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/stores',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        search,
        status = 'ALL',
        approval = 'ALL',
        payment = 'ALL',
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const params: any[] = [];
      let paramIdx = 1;
      let whereConditions: string[] = ['1=1'];

      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereConditions.push(`(
          LOWER(s.store_name) LIKE $${paramIdx} OR
          LOWER(s.slug) LIKE $${paramIdx} OR
          LOWER(COALESCE(u.full_name, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(u.email, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(u.phone, '')) LIKE $${paramIdx} OR
          s.id::text LIKE $${paramIdx}
        )`);
        params.push(q);
        paramIdx++;
      }

      if (status !== 'ALL') {
        whereConditions.push(`UPPER(s.store_status) = $${paramIdx}`);
        params.push(status.toUpperCase());
        paramIdx++;
      }

      if (approval !== 'ALL') {
        whereConditions.push(`UPPER(s.approval_status) = $${paramIdx}`);
        params.push(approval.toUpperCase());
        paramIdx++;
      }

      if (payment !== 'ALL') {
        whereConditions.push(`UPPER(s.payment_status) = $${paramIdx}`);
        params.push(payment.toUpperCase());
        paramIdx++;
      }

      const whereClause = whereConditions.join(' AND ');

      const countQuery = `
        SELECT COUNT(*) as total
        FROM stores s
        JOIN users u ON s.user_id = u.id
        WHERE ${whereClause}
      `;

      const countRes = await db.query(countQuery, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listQuery = `
        SELECT
          s.id,
          s.agent_id as "agentId",
          s.user_id as "userId",
          s.store_name as "storeName",
          s.slug,
          COALESCE(u.full_name, 'Merchant') as "ownerName",
          u.email as "ownerEmail",
          COALESCE(s.contact_phone, u.phone) as "ownerPhone",
          s.payment_status as "paymentStatus",
          s.approval_status as "approvalStatus",
          s.store_status as "storeStatus",
          s.activation_fee_pesewas as "activationFeePesewas",
          s.paystack_reference as "paystackReference",
          s.admin_notes as "adminNotes",
          COALESCE((SELECT COUNT(*) FROM store_products WHERE store_id = s.id), 0) as "productsCount",
          COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE store_id = s.id AND payment_status = 'PAID'), 0) as "totalSalesPesewas",
          COALESCE((SELECT SUM(amount_pesewas) FROM store_payouts WHERE store_id = s.id AND status = 'PENDING'), 0) as "pendingPayoutPesewas",
          s.created_at as "createdAt",
          s.updated_at as "updatedAt"
        FROM stores s
        JOIN users u ON s.user_id = u.id
        WHERE ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;

      params.push(limitNum, offset);
      const listRes = await db.query(listQuery, params);

      const items = listRes.rows.map(mapStoreRow);

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    },
  );

  // 3. GET STORE DOSSIER (/admin/stores/:id)
  app.get<{ Params: { id: string } }>(
    '/admin/stores/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const storeQuery = `
        SELECT
          s.id,
          s.agent_id as "agentId",
          s.user_id as "userId",
          s.store_name as "storeName",
          s.slug,
          s.tagline,
          s.description,
          s.logo_url as "logoUrl",
          s.banner_url as "bannerUrl",
          s.primary_color as "primaryColor",
          s.accent_color as "accentColor",
          s.contact_email as "contactEmail",
          s.contact_phone as "contactPhone",
          s.contact_whatsapp as "contactWhatsapp",
          COALESCE(u.full_name, 'Merchant') as "ownerName",
          u.email as "ownerEmail",
          COALESCE(s.contact_phone, u.phone) as "ownerPhone",
          s.payment_status as "paymentStatus",
          s.approval_status as "approvalStatus",
          s.store_status as "storeStatus",
          s.activation_fee_pesewas as "activationFeePesewas",
          s.paystack_reference as "paystackReference",
          s.admin_notes as "adminNotes",
          s.created_at as "createdAt",
          s.updated_at as "updatedAt"
        FROM stores s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = $1 OR s.slug = $1
      `;

      const storeRes = await db.query(storeQuery, [id]);
      if (storeRes.rows.length === 0) {
        throw new NotFoundError(`Store not found with identifier '${id}'`);
      }

      const rawStore = storeRes.rows[0];
      const storeItem = mapStoreRow(rawStore);
      const storeId = storeItem.id;

      // 1. Store products with markup cascade
      const productsRes = await db.query(
        `SELECT
          sp.id,
          sp.store_id as "storeId",
          sp.catalog_product_id as "catalogProductId",
          cp.name as "productName",
          cp.sku,
          cp.network,
          cp.data_amount_mb as "dataAmountMb",
          cp.base_price_pesewas as "basePricePesewas",
          COALESCE(cp.agent_price_pesewas, cp.base_price_pesewas) as "agentPricePesewas",
          sp.markup_pesewas as "markupPesewas",
          sp.custom_price_pesewas as "customPricePesewas",
          sp.is_available as "isAvailable",
          sp.is_visible as "isVisible"
        FROM store_products sp
        JOIN catalog_products cp ON sp.catalog_product_id = cp.id
        WHERE sp.store_id = $1
        ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [storeId],
      );

      const products: StoreProductAdminDto[] = productsRes.rows.map((r) => {
        const agentPrice = parseInt(r.agentPricePesewas || '0', 10);
        const markup = parseInt(r.markupPesewas || '0', 10);
        const customPrice = r.customPricePesewas ? parseInt(r.customPricePesewas, 10) : undefined;
        const finalPrice = customPrice !== undefined ? customPrice : agentPrice + markup;

        return {
          id: r.id,
          storeId: r.storeId,
          catalogProductId: r.catalogProductId,
          productName: r.productName,
          sku: r.sku,
          network: r.network,
          dataAmountMb: parseInt(r.dataAmountMb || '0', 10),
          basePricePesewas: parseInt(r.basePricePesewas || '0', 10),
          agentPricePesewas: agentPrice,
          markupPesewas: markup,
          customPricePesewas: customPrice,
          finalCustomerPricePesewas: finalPrice,
          isAvailable: Boolean(r.isAvailable),
          isVisible: Boolean(r.isVisible),
        };
      });

      // 2. Sales metrics
      const salesQuery = `
        SELECT
          COUNT(*) as "totalOrders",
          COUNT(*) FILTER (WHERE order_status = 'COMPLETED') as "completedOrders",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE payment_status = 'PAID'), 0) as "grossSalesPesewas",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE refund_status = 'COMPLETED'), 0) as "refundedPesewas"
        FROM orders
        WHERE store_id = $1
      `;
      const salesRes = await db.query(salesQuery, [storeId]);
      const sr = salesRes.rows[0] || {};
      const grossSales = parseInt(sr.grossSalesPesewas || '0', 10);
      const refunded = parseInt(sr.refundedPesewas || '0', 10);

      // 3. Recent orders
      const ordersRes = await db.query(
        `SELECT id, public_id as "publicId", recipient_phone as "recipientPhone", network,
                data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                order_status as "orderStatus", payment_status as "paymentStatus",
                created_at as "createdAt"
         FROM orders
         WHERE store_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [storeId],
      );

      // 4. Payouts
      const payoutsRes = await db.query(
        `SELECT id, store_id as "storeId", amount_pesewas as "amountPesewas",
                destination_account as "destinationAccount", destination_provider as "destinationProvider",
                status, admin_notes as "adminNotes", reviewed_by as "reviewedBy",
                reviewed_at as "reviewedAt", paid_at as "paidAt",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM store_payouts
         WHERE store_id = $1
         ORDER BY created_at DESC`,
        [storeId],
      ).catch(() => ({ rows: [] }));

      const payouts: StorePayoutDto[] = payoutsRes.rows.map((p) => ({
        id: p.id,
        storeId: p.storeId,
        storeName: storeItem.storeName,
        agentId: storeItem.agentId,
        agentName: storeItem.ownerName,
        amountPesewas: parseInt(p.amountPesewas || '0', 10),
        destinationAccount: p.destinationAccount,
        destinationProvider: p.destinationProvider,
        status: p.status,
        adminNotes: p.adminNotes || undefined,
        reviewedBy: p.reviewedBy || undefined,
        reviewedAt: p.reviewedAt ? new Date(p.reviewedAt).toISOString() : undefined,
        paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : undefined,
        createdAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt).toISOString(),
      }));

      // 5. Health checks
      const issues: string[] = [];
      const catalogSynced = products.length > 0;
      if (!catalogSynced) issues.push('Catalog has no products assigned.');

      const paymentsHealthy = storeItem.paymentStatus === 'PAID';
      if (!paymentsHealthy) issues.push(`Activation payment status is ${storeItem.paymentStatus}.`);

      const ordersHealthy = parseInt(sr.totalOrders || '0', 10) === 0 || parseInt(sr.completedOrders || '0', 10) >= 0;
      const payoutsHealthy = payouts.filter((p) => p.status === 'FAILED').length === 0;
      if (!payoutsHealthy) issues.push('One or more store payouts have failed.');

      const isHealthy = catalogSynced && paymentsHealthy && ordersHealthy && payoutsHealthy && storeItem.storeStatus === 'ACTIVE';

      const health: StoreHealthReportDto = {
        storeId,
        storeStatus: storeItem.storeStatus,
        isHealthy,
        checks: {
          catalogSynced,
          paymentsHealthy,
          ordersHealthy,
          payoutsHealthy,
          apiHealthy: true,
        },
        issues,
      };

      const detail: AdminStoreDetail = {
        store: storeItem,
        branding: {
          tagline: rawStore.tagline || undefined,
          description: rawStore.description || undefined,
          logoUrl: rawStore.logoUrl || undefined,
          bannerUrl: rawStore.bannerUrl || undefined,
          primaryColor: rawStore.primaryColor || '#0066FF',
          accentColor: rawStore.accentColor || '#00E599',
          contactEmail: rawStore.contactEmail || undefined,
          contactPhone: rawStore.contactPhone || undefined,
          contactWhatsapp: rawStore.contactWhatsapp || undefined,
        },
        products,
        salesMetrics: {
          totalOrders: parseInt(sr.totalOrders || '0', 10),
          completedOrders: parseInt(sr.completedOrders || '0', 10),
          grossSalesPesewas: grossSales,
          netMarginPesewas: Math.round(grossSales * 0.05), // Estimated margin
          refundedPesewas: refunded,
        },
        recentOrders: ordersRes.rows,
        payouts,
        health,
      };

      return reply.send({
        success: true,
        data: detail,
      });
    },
  );

  // 4. UPDATE STORE STATUS (/admin/stores/:id/status)
  app.patch<{ Params: { id: string }; Body: { storeStatus: StoreStatus; reason?: string } }>(
    '/admin/stores/:id/status',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { storeStatus, reason } = req.body || {};

      if (!storeStatus) {
        throw new BadRequestError('Valid storeStatus is required.');
      }

      const validStatuses = Object.values(StoreStatus);
      if (!validStatuses.includes(storeStatus)) {
        throw new BadRequestError(`Invalid storeStatus '${storeStatus}'. Must be one of: ${validStatuses.join(', ')}`);
      }

      const storeRes = await db.query(
        `UPDATE stores
         SET store_status = $1,
             admin_notes = COALESCE($2, admin_notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, store_name as "storeName", slug, store_status as "storeStatus"`,
        [storeStatus, reason, id],
      );

      if (storeRes.rows.length === 0) {
        throw new NotFoundError(`Store not found with ID '${id}'`);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_UPDATE_STORE_STATUS',
          resourceType: 'stores',
          resourceId: id,
          metadata: { storeStatus, reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: storeRes.rows[0],
        message: `Store status updated to ${storeStatus}.`,
      });
    },
  );

  // 5. APPROVE STORE APPLICATION (/admin/stores/:id/approve)
  app.post<{ Params: { id: string }; Body: { adminNotes?: string } }>(
    '/admin/stores/:id/approve',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { adminNotes = 'Approved by administrator' } = req.body || {};

      const storeRes = await db.query(
        `UPDATE stores
         SET approval_status = 'APPROVED',
             store_status = 'ACTIVE',
             approved_by = $1,
             approved_at = CURRENT_TIMESTAMP,
             admin_notes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, store_name as "storeName", slug, approval_status as "approvalStatus", store_status as "storeStatus"`,
        [req.user!.sub, adminNotes, id],
      );

      if (storeRes.rows.length === 0) {
        throw new NotFoundError(`Store not found with ID '${id}'`);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_APPROVE_STORE',
          resourceType: 'stores',
          resourceId: id,
          metadata: { adminNotes },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: storeRes.rows[0],
        message: 'Store application approved and storefront activated successfully.',
      });
    },
  );

  // 6. REJECT STORE APPLICATION (/admin/stores/:id/reject)
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/admin/stores/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { reason } = req.body || {};

      if (!reason || reason.trim().length < 4) {
        throw new BadRequestError('Mandatory rejection reason (min 4 chars) is required.');
      }

      const storeRes = await db.query(
        `UPDATE stores
         SET approval_status = 'REJECTED',
             store_status = 'INACTIVE',
             admin_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, store_name as "storeName", slug, approval_status as "approvalStatus", store_status as "storeStatus"`,
        [reason.trim(), id],
      );

      if (storeRes.rows.length === 0) {
        throw new NotFoundError(`Store not found with ID '${id}'`);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_REJECT_STORE',
          resourceType: 'stores',
          resourceId: id,
          metadata: { reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: storeRes.rows[0],
        message: 'Store application rejected.',
      });
    },
  );

  // 7. GET STORE PRODUCTS & MARKUP RULES (/admin/stores/:id/products)
  app.get<{ Params: { id: string } }>(
    '/admin/stores/:id/products',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const productsRes = await db.query(
        `SELECT
          sp.id,
          sp.store_id as "storeId",
          sp.catalog_product_id as "catalogProductId",
          cp.name as "productName",
          cp.sku,
          cp.network,
          cp.data_amount_mb as "dataAmountMb",
          cp.base_price_pesewas as "basePricePesewas",
          COALESCE(cp.agent_price_pesewas, cp.base_price_pesewas) as "agentPricePesewas",
          sp.markup_pesewas as "markupPesewas",
          sp.custom_price_pesewas as "customPricePesewas",
          sp.is_available as "isAvailable",
          sp.is_visible as "isVisible"
        FROM store_products sp
        JOIN catalog_products cp ON sp.catalog_product_id = cp.id
        WHERE sp.store_id = $1
        ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [id],
      );

      const items: StoreProductAdminDto[] = productsRes.rows.map((r) => {
        const agentPrice = parseInt(r.agentPricePesewas || '0', 10);
        const markup = parseInt(r.markupPesewas || '0', 10);
        const customPrice = r.customPricePesewas ? parseInt(r.customPricePesewas, 10) : undefined;
        const finalPrice = customPrice !== undefined ? customPrice : agentPrice + markup;

        return {
          id: r.id,
          storeId: r.storeId,
          catalogProductId: r.catalogProductId,
          productName: r.productName,
          sku: r.sku,
          network: r.network,
          dataAmountMb: parseInt(r.dataAmountMb || '0', 10),
          basePricePesewas: parseInt(r.basePricePesewas || '0', 10),
          agentPricePesewas: agentPrice,
          markupPesewas: markup,
          customPricePesewas: customPrice,
          finalCustomerPricePesewas: finalPrice,
          isAvailable: Boolean(r.isAvailable),
          isVisible: Boolean(r.isVisible),
        };
      });

      return reply.send({
        success: true,
        data: items,
      });
    },
  );

  // 8. UPDATE STORE PRODUCTS & MARKUP RULES (/admin/stores/:id/products)
  app.put<{ Params: { id: string }; Body: UpdateStoreProductsRequest }>(
    '/admin/stores/:id/products',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { products } = req.body || {};

      if (!products || !Array.isArray(products)) {
        throw new BadRequestError('Products array is required.');
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        for (const item of products) {
          await client.query(
            `INSERT INTO store_products (
               store_id, catalog_product_id, markup_pesewas, custom_price_pesewas,
               is_available, is_visible, updated_at
             )
             VALUES ($1, $2, COALESCE($3, 0), $4, COALESCE($5, TRUE), COALESCE($6, TRUE), CURRENT_TIMESTAMP)
             ON CONFLICT (store_id, catalog_product_id)
             DO UPDATE SET
               markup_pesewas = COALESCE(EXCLUDED.markup_pesewas, store_products.markup_pesewas),
               custom_price_pesewas = EXCLUDED.custom_price_pesewas,
               is_available = COALESCE(EXCLUDED.is_available, store_products.is_available),
               is_visible = COALESCE(EXCLUDED.is_visible, store_products.is_visible),
               updated_at = CURRENT_TIMESTAMP`,
            [id, item.catalogProductId, item.markupPesewas, item.customPricePesewas, item.isAvailable, item.isVisible],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_UPDATE_STORE_PRODUCTS',
          resourceType: 'stores',
          resourceId: id,
          metadata: { productsCount: products.length },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: 'Store products and pricing markups updated successfully.',
      });
    },
  );

  // 9. STORE PAYOUT ACTION (/admin/stores/:id/payouts/:payoutId/action)
  app.post<{
    Params: { id: string; payoutId: string };
    Body: StorePayoutActionRequest;
  }>(
    '/admin/stores/:id/payouts/:payoutId/action',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id, payoutId } = req.params;
      const { action, reason } = req.body || {};

      if (!action || !reason || reason.trim().length < 4) {
        throw new BadRequestError('Action (APPROVE/REJECT/HOLD/RELEASE) and mandatory reason (min 4 chars) are required.');
      }

      let newStatus: string;
      if (action === 'APPROVE' || action === 'RELEASE') {
        newStatus = 'PAID';
      } else if (action === 'REJECT') {
        newStatus = 'REJECTED';
      } else if (action === 'HOLD') {
        newStatus = 'HELD';
      } else {
        throw new BadRequestError(`Unknown payout action '${action}'.`);
      }

      const payoutRes = await db.query(
        `UPDATE store_payouts
         SET status = $1,
             admin_notes = $2,
             reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP,
             paid_at = CASE WHEN $1 = 'PAID' THEN CURRENT_TIMESTAMP ELSE paid_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND store_id = $5
         RETURNING id, store_id as "storeId", amount_pesewas as "amountPesewas", status, destination_account as "destinationAccount"`,
        [newStatus, reason.trim(), req.user!.sub, payoutId, id],
      );

      if (payoutRes.rows.length === 0) {
        throw new NotFoundError(`Payout not found with ID '${payoutId}' for store '${id}'`);
      }

      const payout = payoutRes.rows[0];

      // If approved, post double-entry ledger entry
      if (newStatus === 'PAID' && financialLedgerService) {
        await financialLedgerService.recordJournalEntries(db, [
          {
            accountType: LedgerAccountType.PLATFORM_ESCROW,
            accountId: 'PLATFORM_RESERVE',
            entryType: LedgerEntryType.DEBIT,
            amountPesewas: parseInt(payout.amountPesewas, 10),
            currency: Currency.GHS,
            referenceType: 'MERCHANT_PAYOUT',
            referenceId: payoutId,
            description: `Merchant Payout to ${payout.destinationAccount}: ${reason}`,
          },
          {
            accountType: LedgerAccountType.CUSTOMER_WALLET,
            accountId: id,
            entryType: LedgerEntryType.CREDIT,
            amountPesewas: parseInt(payout.amountPesewas, 10),
            currency: Currency.GHS,
            referenceType: 'MERCHANT_PAYOUT',
            referenceId: payoutId,
            description: `Merchant Payout Settlement: ${reason}`,
          },
        ]);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_STORE_PAYOUT_ACTION',
          resourceType: 'store_payouts',
          resourceId: payoutId,
          metadata: { storeId: id, action, newStatus, reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: payout,
        message: `Store payout ${action.toLowerCase()}ed successfully.`,
      });
    },
  );

  // 10. EXPORT STORES (/admin/stores/export)
  app.post<{ Body: { format?: 'csv' | 'json'; status?: string } }>(
    '/admin/stores/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { format = 'csv', status = 'ALL' } = req.body || {};

      let query = `
        SELECT
          s.id as "storeId",
          s.store_name as "storeName",
          s.slug,
          u.full_name as "ownerName",
          u.email as "ownerEmail",
          COALESCE(s.contact_phone, u.phone) as "phone",
          s.store_status as "storeStatus",
          s.approval_status as "approvalStatus",
          s.payment_status as "paymentStatus",
          COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE store_id = s.id AND payment_status = 'PAID'), 0) / 100.0 as "salesGhs",
          s.created_at as "createdAt"
        FROM stores s
        JOIN users u ON s.user_id = u.id
      `;

      const params: any[] = [];
      if (status !== 'ALL') {
        query += ' WHERE UPPER(s.store_status) = $1';
        params.push(status.toUpperCase());
      }
      query += ' ORDER BY s.created_at DESC';

      const res = await db.query(query, params);

      if (format === 'csv') {
        const headers = ['Store ID', 'Store Name', 'Slug', 'Owner Name', 'Owner Email', 'Phone', 'Store Status', 'Approval Status', 'Payment Status', 'Sales GHS', 'Created At'];
        const rows = res.rows.map((r) => [
          `"${r.storeId}"`,
          `"${(r.storeName || '').replace(/"/g, '""')}"`,
          `"${r.slug}"`,
          `"${(r.ownerName || '').replace(/"/g, '""')}"`,
          `"${r.email || ''}"`,
          `"${r.phone || ''}"`,
          `"${r.storeStatus}"`,
          `"${r.approvalStatus}"`,
          `"${r.paymentStatus}"`,
          (Number(r.salesGhs) || 0).toFixed(2),
          `"${r.createdAt ? new Date(r.createdAt).toISOString() : ''}"`,
        ]);

        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="bytebeacon-stores-${Date.now()}.csv"`);
        return reply.send(csvContent);
      }

      return reply.send({
        success: true,
        data: res.rows,
      });
    },
  );
}
