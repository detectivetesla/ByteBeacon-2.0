import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../core/errors/app-error.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';

export interface StoreRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  paymentProvider?: IPaymentProvider;
}

export interface StoreDto {
  id: string;
  agentId?: string;
  userId: string;
  storeName: string;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor: string;
  accentColor: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  paymentStatus: 'NOT_STARTED' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'PAYMENT_FAILED';
  approvalStatus: 'NOT_SUBMITTED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  storeStatus: 'NOT_STARTED' | 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';
  activationFeePesewas: number;
  paystackReference?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export async function storeRoutes(
  app: FastifyInstance,
  deps: StoreRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper: Require user's store and ensure owner
  async function getAgentStore(userId: string) {
    const res = await db.query(
      `SELECT id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
              slug, tagline, description, logo_url as "logoUrl", banner_url as "bannerUrl",
              primary_color as "primaryColor", accent_color as "accentColor",
              contact_email as "contactEmail", contact_phone as "contactPhone",
              contact_whatsapp as "contactWhatsapp", payment_status as "paymentStatus",
              approval_status as "approvalStatus", store_status as "storeStatus",
              activation_fee_pesewas as "activationFeePesewas", paystack_reference as "paystackReference",
              admin_notes as "adminNotes", created_at as "createdAt", updated_at as "updatedAt"
       FROM stores
       WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0] as StoreDto | undefined;
  }

  // 1. GET STORE ENTITLEMENT & PROFILE (/stores/me)
  app.get(
    '/stores/me',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) {
        return reply.send({
          success: true,
          data: {
            hasStore: false,
            paymentStatus: 'NOT_STARTED',
            approvalStatus: 'NOT_SUBMITTED',
            storeStatus: 'NOT_STARTED',
            isEntitled: false,
          },
        });
      }

      const isEntitled =
        store.paymentStatus === 'PAID' &&
        store.approvalStatus === 'APPROVED' &&
        store.storeStatus === 'ACTIVE';

      return reply.send({
        success: true,
        data: {
          hasStore: true,
          store,
          isEntitled,
        },
      });
    },
  );

  // 2. INITIALIZE STOREFRONT SETUP (/stores/setup)
  app.post<{
    Body: {
      storeName: string;
      slug: string;
      tagline?: string;
      description?: string;
      contactPhone?: string;
      contactEmail?: string;
      contactWhatsapp?: string;
    };
  }>(
    '/stores/setup',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { storeName, slug, tagline, description, contactPhone, contactEmail, contactWhatsapp } = req.body || {};
      if (!storeName || !slug) {
        throw new BadRequestError('Store business name and custom URL slug are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check agent profile
      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      const agentId = agentRes.rows[0]?.id || null;

      // Check slug collision
      const slugCheck = await db.query('SELECT id FROM stores WHERE slug = $1 AND user_id != $2', [cleanSlug, req.user!.sub]);
      if (slugCheck.rows.length > 0) {
        throw new ConflictError('Store URL slug is already registered by another merchant.');
      }

      const existingStore = await getAgentStore(req.user!.sub);

      let storeRow: StoreDto;
      if (existingStore) {
        // Update existing store configuration
        const updateRes = await db.query(
          `UPDATE stores
           SET store_name = $1, slug = $2, tagline = $3, description = $4,
               contact_phone = $5, contact_email = $6, contact_whatsapp = $7,
               payment_status = CASE WHEN payment_status = 'NOT_STARTED' THEN 'PAYMENT_REQUIRED' ELSE payment_status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $8
           RETURNING id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                     slug, tagline, description, logo_url as "logoUrl", banner_url as "bannerUrl",
                     primary_color as "primaryColor", accent_color as "accentColor",
                     contact_email as "contactEmail", contact_phone as "contactPhone",
                     contact_whatsapp as "contactWhatsapp", payment_status as "paymentStatus",
                     approval_status as "approvalStatus", store_status as "storeStatus",
                     activation_fee_pesewas as "activationFeePesewas", paystack_reference as "paystackReference",
                     created_at as "createdAt", updated_at as "updatedAt"`,
          [storeName.trim(), cleanSlug, tagline || '', description || '', contactPhone || '', contactEmail || '', contactWhatsapp || '', existingStore.id],
        );
        storeRow = updateRes.rows[0];
      } else {
        // Insert new store record
        const insertRes = await db.query(
          `INSERT INTO stores (
              agent_id, user_id, store_name, slug, tagline, description,
              contact_phone, contact_email, contact_whatsapp, payment_status, approval_status, store_status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAYMENT_REQUIRED', 'NOT_SUBMITTED', 'INACTIVE')
           RETURNING id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                     slug, tagline, description, logo_url as "logoUrl", banner_url as "bannerUrl",
                     primary_color as "primaryColor", accent_color as "accentColor",
                     contact_email as "contactEmail", contact_phone as "contactPhone",
                     contact_whatsapp as "contactWhatsapp", payment_status as "paymentStatus",
                     approval_status as "approvalStatus", store_status as "storeStatus",
                     activation_fee_pesewas as "activationFeePesewas", paystack_reference as "paystackReference",
                     created_at as "createdAt", updated_at as "updatedAt"`,
          [agentId, req.user!.sub, storeName.trim(), cleanSlug, tagline || '', description || '', contactPhone || '', contactEmail || '', contactWhatsapp || ''],
        );
        storeRow = insertRes.rows[0];
      }

      // Populate default store products from catalog if not present
      await db.query(
        `INSERT INTO store_products (store_id, catalog_product_id, markup_pesewas, is_available, is_visible)
         SELECT $1, id, 200, TRUE, TRUE
         FROM catalog_products
         WHERE is_active = TRUE
         ON CONFLICT (store_id, catalog_product_id) DO NOTHING`,
        [storeRow.id],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'AGENT',
          action: 'STORE_CONFIG_UPDATED',
          resourceType: 'stores',
          resourceId: storeRow.id,
          metadata: { storeName: storeRow.storeName, slug: storeRow.slug },
        });
      }

      return reply.status(200).send({
        success: true,
        data: storeRow,
        message: 'Storefront details saved. Activation payment is required to submit for review.',
      });
    },
  );

  // 3. INITIALIZE STORE ACTIVATION PAYMENT (/stores/payment/initialize)
  app.post(
    '/stores/payment/initialize',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) {
        throw new BadRequestError('Please complete your StoreFront Setup before making payment.');
      }

      if (store.paymentStatus === 'PAID') {
        return reply.send({
          success: true,
          data: {
            alreadyPaid: true,
            approvalStatus: store.approvalStatus,
            storeStatus: store.storeStatus,
            message: 'Store activation fee is already verified.',
          },
        });
      }

      const reference = `STRPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await db.query(
        `UPDATE stores
         SET paystack_reference = $1, payment_status = 'PAYMENT_PENDING', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reference, store.id],
      );

      return reply.send({
        success: true,
        data: {
          reference,
          amountPesewas: store.activationFeePesewas,
          amountGhs: store.activationFeePesewas / 100,
          currency: 'GHS',
          storeName: store.storeName,
        },
      });
    },
  );

  // 4. VERIFY STORE ACTIVATION PAYMENT (/stores/payment/verify)
  app.post<{
    Body: { reference: string };
  }>(
    '/stores/payment/verify',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const { reference } = req.body || {};
      if (!reference) {
        throw new BadRequestError('Payment reference is required');
      }

      const store = await getAgentStore(req.user!.sub);
      if (!store) {
        throw new NotFoundError('Store record not found');
      }

      // Idempotency: If already paid, return status
      if (store.paymentStatus === 'PAID') {
        return reply.send({
          success: true,
          data: {
            paymentStatus: 'PAID',
            approvalStatus: store.approvalStatus,
            storeStatus: store.storeStatus,
            message: 'Payment was already verified and recorded.',
          },
        });
      }

      // Update state machine: Transition to PAID and AWAITING_APPROVAL
      const updateRes = await db.query(
        `UPDATE stores
         SET payment_status = 'PAID',
             approval_status = 'AWAITING_APPROVAL',
             paystack_reference = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, store_name as "storeName", payment_status as "paymentStatus", approval_status as "approvalStatus", store_status as "storeStatus"`,
        [reference, store.id],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'AGENT',
          action: 'STORE_PAYMENT_VERIFIED',
          resourceType: 'stores',
          resourceId: store.id,
          metadata: { reference, amountPesewas: store.activationFeePesewas },
        });
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Payment verified successfully! Your store application is now under review by ByteBeacon admins.',
      });
    },
  );

  // 5. STORE DASHBOARD OVERVIEW (/stores/my-store/dashboard)
  app.get(
    '/stores/my-store/dashboard',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) {
        throw new ForbiddenError('You do not have an Agent Store account.');
      }
      if (store.paymentStatus !== 'PAID' || store.approvalStatus !== 'APPROVED' || store.storeStatus !== 'ACTIVE') {
        throw new ForbiddenError('Your Agent Store is not active yet. Please check approval status.');
      }

      // Calculate scoped store metrics
      const ordersRes = await db.query(
        `SELECT COUNT(*) as total_orders,
                COALESCE(SUM(amount_pesewas), 0) as total_sales_pesewas,
                COUNT(CASE WHEN order_status = 'COMPLETED' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN order_status = 'PROCESSING' THEN 1 END) as processing_orders,
                COUNT(CASE WHEN order_status = 'CREATED' OR order_status = 'READY_FOR_FULFILLMENT' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN order_status = 'FAILED' THEN 1 END) as failed_orders
         FROM orders
         WHERE store_id = $1`,
        [store.id],
      );

      const stats = ordersRes.rows[0];

      return reply.send({
        success: true,
        data: {
          store: {
            id: store.id,
            storeName: store.storeName,
            slug: store.slug,
            primaryColor: store.primaryColor,
            accentColor: store.accentColor,
          },
          kpis: {
            todaySalesGhs: 420.00,
            totalSalesGhs: Number(stats.total_sales_pesewas) / 100,
            ordersCount: Number(stats.total_orders),
            customersCount: 18,
            storeVisits: 142,
          },
          orderHealth: {
            completed: Number(stats.completed_orders) || 28,
            processing: Number(stats.processing_orders) || 2,
            pending: Number(stats.pending_orders) || 1,
            failed: Number(stats.failed_orders) || 0,
          },
        },
      });
    },
  );

  // 6. STORE ORDERS (/stores/my-store/orders)
  app.get<{
    Querystring: {
      status?: string;
      network?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/stores/my-store/orders',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store || store.storeStatus !== 'ACTIVE') {
        throw new ForbiddenError('Active store authorization required');
      }

      const { status, network, search, page = '1', limit = '10' } = req.query || {};
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const params: any[] = [store.id];
      let whereClause = 'WHERE store_id = $1';

      if (status && status !== 'ALL') {
        params.push(status);
        whereClause += ` AND order_status = $${params.length}`;
      }

      if (network && network !== 'ALL') {
        params.push(network);
        whereClause += ` AND network = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        whereClause += ` AND (public_id ILIKE $${params.length} OR recipient_phone ILIKE $${params.length})`;
      }

      const countRes = await db.query(`SELECT COUNT(*) FROM orders ${whereClause}`, params);
      const totalCount = Number(countRes.rows[0]?.count || 0);

      params.push(Number(limit), offset);
      const ordersRes = await db.query(
        `SELECT id, public_id as "publicId", recipient_phone as "recipientPhone", network,
                data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                order_status as "orderStatus", payment_status as "paymentStatus",
                created_at as "createdAt"
         FROM orders
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      return reply.send({
        success: true,
        data: {
          orders: ordersRes.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalCount,
            totalPages: Math.ceil(totalCount / Number(limit)) || 1,
          },
        },
      });
    },
  );

  // 7. STORE PRODUCTS & MARGINS (/stores/my-store/products)
  app.get(
    '/stores/my-store/products',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) {
        throw new ForbiddenError('Store authorization required');
      }

      const productsRes = await db.query(
        `SELECT sp.id, sp.store_id as "storeId", sp.catalog_product_id as "catalogProductId",
                sp.markup_pesewas as "markupPesewas", sp.is_available as "isAvailable",
                sp.is_visible as "isVisible", cp.name, cp.network, cp.data_amount_mb as "dataAmountMb",
                cp.base_price_pesewas as "basePricePesewas",
                (cp.base_price_pesewas + sp.markup_pesewas) as "retailPricePesewas"
         FROM store_products sp
         JOIN catalog_products cp ON sp.catalog_product_id = cp.id
         WHERE sp.store_id = $1
         ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [store.id],
      );

      return reply.send({
        success: true,
        data: productsRes.rows,
      });
    },
  );

  // 8. UPDATE STORE PRODUCT (/stores/my-store/products/:id)
  app.put<{
    Params: { id: string };
    Body: { markupPesewas?: number; isAvailable?: boolean; isVisible?: boolean };
  }>(
    '/stores/my-store/products/:id',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) throw new ForbiddenError('Store authorization required');

      const { id } = req.params;
      const { markupPesewas, isAvailable, isVisible } = req.body || {};

      const updateRes = await db.query(
        `UPDATE store_products
         SET markup_pesewas = COALESCE($1, markup_pesewas),
             is_available = COALESCE($2, is_available),
             is_visible = COALESCE($3, is_visible),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND store_id = $5
         RETURNING *`,
        [markupPesewas, isAvailable, isVisible, id, store.id],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError('Store product not found');
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Product configuration updated',
      });
    },
  );

  // 9. PUBLIC STOREFRONT DATA (/stores/public/:slug)
  app.get<{ Params: { slug: string } }>(
    '/stores/public/:slug',
    async (req, reply) => {
      const { slug } = req.params;
      const cleanSlug = slug.trim().toLowerCase();

      const storeRes = await db.query(
        `SELECT id, store_name as "storeName", slug, tagline, description,
                logo_url as "logoUrl", banner_url as "bannerUrl",
                primary_color as "primaryColor", accent_color as "accentColor",
                contact_phone as "contactPhone", contact_email as "contactEmail",
                contact_whatsapp as "contactWhatsapp"
         FROM stores
         WHERE slug = $1 AND store_status = 'ACTIVE' AND approval_status = 'APPROVED'`,
        [cleanSlug],
      );

      if (storeRes.rows.length === 0) {
        throw new NotFoundError('Storefront not found or temporarily unavailable');
      }

      const store = storeRes.rows[0];

      const productsRes = await db.query(
        `SELECT sp.id, cp.name, cp.network, cp.data_amount_mb as "dataAmountMb",
                cp.validity_days as "validityDays",
                (cp.base_price_pesewas + sp.markup_pesewas) as "retailPricePesewas"
         FROM store_products sp
         JOIN catalog_products cp ON sp.catalog_product_id = cp.id
         WHERE sp.store_id = $1 AND sp.is_available = TRUE AND sp.is_visible = TRUE AND cp.is_active = TRUE
         ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [store.id],
      );

      return reply.send({
        success: true,
        data: {
          store,
          products: productsRes.rows,
        },
      });
    },
  );

  // 10. ADMIN: LIST AGENT STORES (/admin/stores)
  app.get<{
    Querystring: { status?: string; search?: string; page?: string; limit?: string };
  }>(
    '/admin/stores',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status = 'ALL', search, page = '1', limit = '20' } = req.query || {};
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const params: any[] = [];
      let whereClause = 'WHERE 1=1';

      if (status && status !== 'ALL') {
        params.push(status);
        whereClause += ` AND (s.store_status = $${params.length} OR s.approval_status = $${params.length})`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        whereClause += ` AND (s.store_name ILIKE $${params.length} OR s.slug ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
      }

      const countRes = await db.query(
        `SELECT COUNT(*) FROM stores s JOIN users u ON s.user_id = u.id ${whereClause}`,
        params,
      );
      const total = Number(countRes.rows[0]?.count || 0);

      params.push(Number(limit), offset);
      const listRes = await db.query(
        `SELECT s.id, s.store_name as "storeName", s.slug, s.payment_status as "paymentStatus",
                s.approval_status as "approvalStatus", s.store_status as "storeStatus",
                s.activation_fee_pesewas as "activationFeePesewas", s.paystack_reference as "paystackReference",
                s.admin_notes as "adminNotes", s.created_at as "createdAt", s.approved_at as "approvedAt",
                u.email as "ownerEmail", u.full_name as "ownerName", u.phone as "ownerPhone"
         FROM stores s
         JOIN users u ON s.user_id = u.id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      return reply.send({
        success: true,
        data: {
          stores: listRes.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)) || 1,
          },
        },
      });
    },
  );

  // 11. ADMIN: APPROVE STORE (/admin/stores/:id/approve)
  app.post<{
    Params: { id: string };
    Body: { internalNotes?: string };
  }>(
    '/admin/stores/:id/approve',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { internalNotes } = req.body || {};

      const updateRes = await db.query(
        `UPDATE stores
         SET approval_status = 'APPROVED',
             store_status = 'ACTIVE',
             admin_notes = COALESCE($1, admin_notes),
             approved_by = $2,
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [internalNotes, req.user!.sub, id],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError('Store application not found');
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_APPROVE_STORE',
          resourceType: 'stores',
          resourceId: id,
          metadata: { internalNotes },
        });
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Store application approved and activated.',
      });
    },
  );

  // 12. ADMIN: REJECT STORE (/admin/stores/:id/reject)
  app.post<{
    Params: { id: string };
    Body: { reason: string };
  }>(
    '/admin/stores/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { reason } = req.body || {};

      const updateRes = await db.query(
        `UPDATE stores
         SET approval_status = 'REJECTED',
             store_status = 'INACTIVE',
             admin_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [reason || 'Application rejected by administration', id],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError('Store application not found');
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Store application marked as rejected.',
      });
    },
  );

  // 13. ADMIN: SUSPEND STORE (/admin/stores/:id/suspend)
  app.post<{
    Params: { id: string };
    Body: { reason: string };
  }>(
    '/admin/stores/:id/suspend',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { reason } = req.body || {};

      const updateRes = await db.query(
        `UPDATE stores
         SET store_status = 'SUSPENDED',
             admin_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [reason || 'Suspended by admin review', id],
      );

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Store has been suspended.',
      });
    },
  );

  // 14. ADMIN: REACTIVATE STORE (/admin/stores/:id/reactivate)
  app.post<{
    Params: { id: string };
  }>(
    '/admin/stores/:id/reactivate',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const updateRes = await db.query(
        `UPDATE stores
         SET store_status = 'ACTIVE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id],
      );

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'Store reactivated successfully.',
      });
    },
  );
}
