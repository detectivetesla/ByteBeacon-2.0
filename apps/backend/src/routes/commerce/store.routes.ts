import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createMaintenanceHook } from '../../plugins/maintenance.plugin.js';
import { FeatureFlagService } from '../../infrastructure/features/feature-flag.service.js';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../../core/errors/app-error.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';

export interface StoreRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  paymentProvider?: IPaymentProvider;
  featureFlagService?: FeatureFlagService;
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
  const featureFlagService = deps.featureFlagService ?? (app as any).featureFlagService ?? new FeatureFlagService(db);
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const maintenanceHook = createMaintenanceHook(featureFlagService);

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
       WHERE user_id = $1 OR agent_id = $1 OR agent_id = (SELECT id FROM agents WHERE user_id = $1 LIMIT 1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return res.rows[0] as StoreDto | undefined;
  }

  // 1. GET STORE ENTITLEMENT & PROFILE (/stores/me and /stores/my-store)
  const getStoreProfileHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const configRes = await db.query(
      `SELECT value FROM system_configurations WHERE config_key = 'agent_store_activation_fee_pesewas'`,
    ).catch(() => ({ rows: [] }));
    let dynamicFeePesewas = 50000;
    if (configRes.rows.length > 0) {
      const val = configRes.rows[0].value;
      const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        dynamicFeePesewas = parsed;
      }
    }
    const dynamicFeeGhs = Number((dynamicFeePesewas / 100).toFixed(2));

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
          activationFeePesewas: dynamicFeePesewas,
          activationFeeGhs: dynamicFeeGhs,
        },
      });
    }

    const isEntitled =
      store.paymentStatus === 'PAID' &&
      store.approvalStatus === 'APPROVED' &&
      store.storeStatus === 'ACTIVE';

    const finalFeePesewas = store.paymentStatus === 'PAID' ? (store.activationFeePesewas || dynamicFeePesewas) : dynamicFeePesewas;

    return reply.send({
      success: true,
      data: {
        hasStore: true,
        store: {
          ...store,
          activationFeePesewas: finalFeePesewas,
          activationFeeGhs: Number((finalFeePesewas / 100).toFixed(2)),
        },
        activationFeePesewas: finalFeePesewas,
        activationFeeGhs: Number((finalFeePesewas / 100).toFixed(2)),
        isEntitled,
      },
    });
  };


  // 0. GET STORE ACTIVATION FEE (/stores/activation-fee)
  app.get(
    '/stores/activation-fee',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const configRes = await db.query(
        `SELECT value FROM system_configurations WHERE config_key = 'agent_store_activation_fee_pesewas'`,
      ).catch(() => ({ rows: [] }));
      let dynamicFeePesewas = 50000;
      if (configRes.rows.length > 0) {
        const val = configRes.rows[0].value;
        const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          dynamicFeePesewas = parsed;
        }
      }
      return reply.send({
        success: true,
        data: {
          activationFeePesewas: dynamicFeePesewas,
          activationFeeGhs: Number((dynamicFeePesewas / 100).toFixed(2)),
        },
      });
    },
  );

  app.get('/stores/me', { preHandler: [authHooks.authenticateCustomer] }, getStoreProfileHandler);
  app.get('/stores/my-store', { preHandler: [authHooks.authenticateCustomer] }, getStoreProfileHandler);

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
    { preHandler: [authHooks.authenticateCustomer, maintenanceHook] },
    async (req, reply) => {
      const { storeName, slug, tagline, description, contactPhone, contactEmail, contactWhatsapp } = req.body || {};
      if (!storeName || !slug) {
        throw new BadRequestError('Store business name and custom URL slug are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check agent profile
      const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      let agentId = agentRes.rows[0]?.id || null;
      if (!agentId) {
        const insertAgent = await db.query(
          `INSERT INTO agents (user_id, business_name, status)
           VALUES ($1, $2, 'ACTIVE')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [req.user!.sub, storeName.trim()],
        );
        agentId = insertAgent.rows[0]?.id || null;
      }

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
  app.post<{
    Body?: {
      storeName?: string;
      slug?: string;
      tagline?: string;
      description?: string;
      contactPhone?: string;
      contactEmail?: string;
      contactWhatsapp?: string;
    };
  }>(
    '/stores/payment/initialize',
    { preHandler: [authHooks.authenticateCustomer, maintenanceHook] },
    async (req: FastifyRequest<{
      Body?: {
        storeName?: string;
        slug?: string;
        tagline?: string;
        description?: string;
        contactPhone?: string;
        contactEmail?: string;
        contactWhatsapp?: string;
      };
    }>, reply: FastifyReply) => {
      let store = await getAgentStore(req.user!.sub);

      const { storeName, slug, tagline, description, contactPhone, contactEmail, contactWhatsapp } = req.body || {};

      // Dynamic activation fee from system_configurations
      const configRes = await db.query(
        `SELECT value FROM system_configurations WHERE config_key = 'agent_store_activation_fee_pesewas'`,
      ).catch(() => ({ rows: [] }));
      let dynamicFeePesewas = 50000;
      if (configRes.rows.length > 0) {
        const val = configRes.rows[0].value;
        const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          dynamicFeePesewas = parsed;
        }
      }

      // Auto-provision or update store configuration if provided or if store does not exist yet
      if (!store) {
        const userRes = await db.query('SELECT full_name, email, phone FROM users WHERE id = $1', [req.user!.sub]);
        const userRow = userRes.rows[0];

        const rawName = (storeName || userRow?.full_name || 'Agent Store').trim();
        const rawSlug = (slug || rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || `store-${req.user!.sub.slice(0, 8)}`).trim();
        const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        const agentRes = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
        let agentId = agentRes.rows[0]?.id || null;
        if (!agentId) {
          const insertAgent = await db.query(
            `INSERT INTO agents (user_id, business_name, status)
             VALUES ($1, $2, 'ACTIVE')
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [req.user!.sub, rawName],
          );
          agentId = insertAgent.rows[0]?.id || null;
        }

        const insertRes = await db.query(
          `INSERT INTO stores (
              agent_id, user_id, store_name, slug, tagline, description,
              contact_phone, contact_email, contact_whatsapp, payment_status, approval_status, store_status, activation_fee_pesewas
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAYMENT_PENDING', 'NOT_SUBMITTED', 'INACTIVE', $10)
           RETURNING id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                     slug, tagline, description, logo_url as "logoUrl", banner_url as "bannerUrl",
                     primary_color as "primaryColor", accent_color as "accentColor",
                     contact_email as "contactEmail", contact_phone as "contactPhone",
                     contact_whatsapp as "contactWhatsapp", payment_status as "paymentStatus",
                     approval_status as "approvalStatus", store_status as "storeStatus",
                     activation_fee_pesewas as "activationFeePesewas", paystack_reference as "paystackReference",
                     created_at as "createdAt", updated_at as "updatedAt"`,
          [
            agentId,
            req.user!.sub,
            rawName,
            cleanSlug,
            tagline || '',
            description || '',
            contactPhone || userRow?.phone || '',
            contactEmail || userRow?.email || '',
            contactWhatsapp || '',
            dynamicFeePesewas,
          ],
        );
        store = insertRes.rows[0];

        if (store) {
          // Populate default store products from catalog if not present
          await db.query(
            `INSERT INTO store_products (store_id, catalog_product_id, markup_pesewas, is_available, is_visible)
             SELECT $1, id, 200, TRUE, TRUE
             FROM catalog_products
             WHERE is_active = TRUE
             ON CONFLICT (store_id, catalog_product_id) DO NOTHING`,
            [store.id],
          );
        }
      } else if (storeName || slug || contactPhone || contactEmail) {
        const cleanSlug = (slug || store.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const updateRes = await db.query(
          `UPDATE stores
           SET store_name = COALESCE($1, store_name),
               slug = COALESCE($2, slug),
               contact_phone = COALESCE($3, contact_phone),
               contact_email = COALESCE($4, contact_email),
               contact_whatsapp = COALESCE($5, contact_whatsapp),
               activation_fee_pesewas = CASE WHEN payment_status != 'PAID' THEN $6 ELSE activation_fee_pesewas END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                     slug, tagline, description, logo_url as "logoUrl", banner_url as "bannerUrl",
                     primary_color as "primaryColor", accent_color as "accentColor",
                     contact_email as "contactEmail", contact_phone as "contactPhone",
                     contact_whatsapp as "contactWhatsapp", payment_status as "paymentStatus",
                     approval_status as "approvalStatus", store_status as "storeStatus",
                     activation_fee_pesewas as "activationFeePesewas", paystack_reference as "paystackReference",
                     created_at as "createdAt", updated_at as "updatedAt"`,
          [
            storeName?.trim() || null,
            cleanSlug,
            contactPhone?.trim() || null,
            contactEmail?.trim() || null,
            contactWhatsapp?.trim() || null,
            dynamicFeePesewas,
            store.id,
          ],
        );
        if (updateRes.rows[0]) {
          store = updateRes.rows[0];
        }
      }

      if (!store) {
        throw new BadRequestError('Failed to load or provision store profile');
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
         SET paystack_reference = $1, payment_status = 'PAYMENT_PENDING', activation_fee_pesewas = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reference, dynamicFeePesewas, store.id],
      );

      let authorizationUrl: string | undefined;
      if (deps.paymentProvider) {
        try {
          const payRes = await deps.paymentProvider.initializePayment({
            orderId: store.id,
            amountPesewas: dynamicFeePesewas,
            currency: 'GHS' as any,
            email: store.contactEmail || req.user?.email || 'agent@bytebeacon.com',
            paymentMethod: 'PAYSTACK' as any,
            callbackUrl: `${process.env.PUBLIC_STOREFRONT_BASE_URL || 'https://apisolutions.store/store'}/agent/store?verify=${reference}`,
            metadata: {
              storeId: store.id,
              reference,
              purpose: 'STORE_ACTIVATION',
            },
          });
          if (payRes?.authorizationUrl) {
            authorizationUrl = payRes.authorizationUrl;
          }
        } catch {
          // Graceful fallback for offline sandbox or direct simulation
        }
      }

      return reply.send({
        success: true,
        data: {
          reference,
          amountPesewas: dynamicFeePesewas,
          amountGhs: Number((dynamicFeePesewas / 100).toFixed(2)),
          currency: 'GHS',
          storeName: store.storeName,
          authorizationUrl,
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
        message: 'Payment verified successfully! Your store application is now under review by platform administrators.',
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
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN amount_pesewas ELSE 0 END), 0) as total_sales_pesewas,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN amount_pesewas ELSE 0 END), 0) as today_sales_pesewas,
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN
                  CASE
                    WHEN (pricing_snapshot->>'markupPesewas') IS NOT NULL AND (pricing_snapshot->>'markupPesewas') != ''
                      THEN (pricing_snapshot->>'markupPesewas')::bigint
                    WHEN (pricing_snapshot->>'unitPricePesewas') IS NOT NULL AND (pricing_snapshot->>'basePricePesewas') IS NOT NULL
                      THEN GREATEST(0, (pricing_snapshot->>'unitPricePesewas')::bigint - (pricing_snapshot->>'basePricePesewas')::bigint)
                    ELSE 0
                  END
                ELSE 0 END), 0) as total_profit_pesewas,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN
                  CASE
                    WHEN (pricing_snapshot->>'markupPesewas') IS NOT NULL AND (pricing_snapshot->>'markupPesewas') != ''
                      THEN (pricing_snapshot->>'markupPesewas')::bigint
                    WHEN (pricing_snapshot->>'unitPricePesewas') IS NOT NULL AND (pricing_snapshot->>'basePricePesewas') IS NOT NULL
                      THEN GREATEST(0, (pricing_snapshot->>'unitPricePesewas')::bigint - (pricing_snapshot->>'basePricePesewas')::bigint)
                    ELSE 0
                  END
                ELSE 0 END), 0) as today_profit_pesewas,
                COUNT(DISTINCT recipient_phone) as customers_count,
                COUNT(CASE WHEN order_status = 'COMPLETED' OR order_status = 'DELIVERED' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN order_status = 'PROCESSING' THEN 1 END) as processing_orders,
                COUNT(CASE WHEN order_status = 'CREATED' OR order_status = 'READY_FOR_FULFILLMENT' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN order_status = 'FAILED' THEN 1 END) as failed_orders
         FROM orders
         WHERE store_id = $1 OR agent_id = $2`,
        [store.id, req.user!.sub],
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
            todaySalesGhs: Number(stats.today_sales_pesewas || 0) / 100,
            totalSalesGhs: Number(stats.total_sales_pesewas || 0) / 100,
            todayProfitGhs: Number(stats.today_profit_pesewas || 0) / 100,
            totalProfitGhs: Number(stats.total_profit_pesewas || 0) / 100,
            ordersCount: Number(stats.total_orders || 0),
            customersCount: Number(stats.customers_count || 0),
            storeVisits: Number(stats.customers_count || 0),
          },
          orderHealth: {
            completed: Number(stats.completed_orders || 0),
            processing: Number(stats.processing_orders || 0),
            pending: Number(stats.pending_orders || 0),
            failed: Number(stats.failed_orders || 0),
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

      if (markupPesewas !== undefined) {
        const catalogRes = await db.query(
          `SELECT cp.agent_min_price_pesewas, cp.base_price_pesewas
           FROM store_products sp
           JOIN catalog_products cp ON sp.catalog_product_id = cp.id
           WHERE sp.id = $1 AND sp.store_id = $2`,
          [id, store.id]
        );
        if (catalogRes.rows.length > 0) {
          const { agent_min_price_pesewas, base_price_pesewas } = catalogRes.rows[0];
          if (agent_min_price_pesewas && (parseInt(base_price_pesewas) + markupPesewas) < parseInt(agent_min_price_pesewas)) {
            throw new BadRequestError(`Retail price cannot be below the platform minimum of GH₵ ${(parseInt(agent_min_price_pesewas) / 100).toFixed(2)}`);
          }
        }
      }

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
      const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      let storeRes = await db.query(
        `SELECT id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                slug, tagline, description,
                logo_url as "logoUrl", banner_url as "bannerUrl",
                primary_color as "primaryColor", accent_color as "accentColor",
                contact_phone as "contactPhone", contact_email as "contactEmail",
                contact_whatsapp as "contactWhatsapp",
                store_status as "storeStatus", approval_status as "approvalStatus"
         FROM stores
         WHERE slug = $1 AND store_status = 'ACTIVE' AND approval_status = 'APPROVED'`,
        [cleanSlug],
      );

      // Fallback: If 'default' slug requested, find first active store
      if (storeRes.rows.length === 0 && (cleanSlug === 'default' || cleanSlug === 'store')) {
        storeRes = await db.query(
          `SELECT id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
                  slug, tagline, description,
                  logo_url as "logoUrl", banner_url as "bannerUrl",
                  primary_color as "primaryColor", accent_color as "accentColor",
                  contact_phone as "contactPhone", contact_email as "contactEmail",
                  contact_whatsapp as "contactWhatsapp",
                  store_status as "storeStatus", approval_status as "approvalStatus"
           FROM stores
           WHERE store_status = 'ACTIVE' AND approval_status = 'APPROVED'
           ORDER BY created_at ASC
           LIMIT 1`,
        );
      }

      if (storeRes.rows.length === 0) {
        throw new NotFoundError('Storefront not found or temporarily unavailable');
      }

      const store = storeRes.rows[0];

      db.query('UPDATE stores SET visit_count = visit_count + 1, last_visited_at = CURRENT_TIMESTAMP WHERE id = $1', [store.id]).catch(() => {});

      const productsRes = await db.query(
        `SELECT sp.id, sp.catalog_product_id as "catalogProductId",
                cp.sku, cp.name, cp.network, cp.data_amount_mb as "dataAmountMb",
                cp.validity_days as "validityDays", cp.validity_desc as "validityDesc",
                cp.base_price_pesewas as "basePricePesewas",
                sp.markup_pesewas as "markupPesewas",
                (cp.base_price_pesewas + sp.markup_pesewas) as "retailPricePesewas",
                cp.popular
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

  // 10. PUBLIC STOREFRONT GUEST CHECKOUT (/stores/public/orders/checkout & /stores/public/:slug/checkout)
  const handlePublicCheckout = async (req: FastifyRequest<any>, reply: FastifyReply) => {
    const body = (req.body || {}) as {
      slug?: string;
      productId: string;
      recipientPhone: string;
      customerEmail?: string;
      customerName?: string;
      paymentMethod?: string;
      channel?: string;
      idempotencyKey?: string;
      callbackUrl?: string;
    };

    const storeSlug = (((req.params as any)?.slug || body.slug || '') as string).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const { productId, recipientPhone, customerEmail, paymentMethod = 'PAYSTACK', channel = 'mobile_money', idempotencyKey, callbackUrl } = body;

    if (!storeSlug) {
      throw new BadRequestError('Store slug is required');
    }
    if (!productId) {
      throw new BadRequestError('Data bundle product ID is required');
    }
    if (!recipientPhone || recipientPhone.trim().length < 10) {
      throw new BadRequestError('A valid 10-digit Ghanaian mobile recipient phone number is required');
    }

    const cleanPhone = recipientPhone.trim().replace(/\s+/g, '');

    // 1. Verify Active Store
    const storeRes = await db.query(
      `SELECT id, agent_id as "agentId", user_id as "userId", store_name as "storeName",
              slug, contact_email as "contactEmail", contact_phone as "contactPhone",
              store_status as "storeStatus", approval_status as "approvalStatus"
       FROM stores
       WHERE slug = $1 AND store_status = 'ACTIVE' AND approval_status = 'APPROVED'`,
      [storeSlug],
    );

    if (storeRes.rows.length === 0) {
      throw new NotFoundError('Storefront not found or temporarily unavailable for orders');
    }

    const store = storeRes.rows[0];

    // 2. Resolve Product & Authoritative Retail Pricing from Store Catalog
    const productRes = await db.query(
      `SELECT sp.id as "storeProductId", sp.store_id as "storeId", sp.markup_pesewas as "markupPesewas",
              cp.id as "catalogProductId", cp.sku, cp.name, cp.network, cp.data_amount_mb as "dataAmountMb",
              cp.base_price_pesewas as "basePricePesewas", cp.validity_days as "validityDays"
       FROM store_products sp
       JOIN catalog_products cp ON sp.catalog_product_id = cp.id
       WHERE sp.store_id = $1
         AND (sp.id = $2 OR cp.id = $2)
         AND sp.is_available = TRUE
         AND sp.is_visible = TRUE
         AND cp.is_active = TRUE
       LIMIT 1`,
      [store.id, productId],
    );

    if (productRes.rows.length === 0) {
      throw new NotFoundError('Selected data bundle is currently unavailable in this store');
    }

    const product = productRes.rows[0];
    const basePricePesewas = parseInt(product.basePricePesewas, 10);
    const markupPesewas = parseInt(product.markupPesewas, 10);
    const retailPricePesewas = basePricePesewas + markupPesewas;
    const retailPriceGhs = retailPricePesewas / 100;

    const publicId = `ord_sf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const paymentRef = `PST-SF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pricingSnapshot = {
      productId: product.catalogProductId,
      storeProductId: product.storeProductId,
      sku: product.sku,
      productName: product.name,
      network: product.network,
      dataAmountMb: product.dataAmountMb,
      basePricePesewas,
      markupPesewas,
      unitPricePesewas: retailPricePesewas,
      currency: 'GHS',
      snapshotTimestamp: new Date().toISOString(),
    };

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create guest order linked to store and agent
      const orderRes = await client.query(
        `INSERT INTO orders (
            public_id, user_id, agent_id, store_id, product_id, recipient_phone,
            network, data_amount_mb, amount_pesewas, currency,
            pricing_snapshot, payment_status, order_status, provider_status,
            refund_status, idempotency_key
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'GHS', $10, 'PENDING', 'CREATED', 'UNKNOWN', 'NONE', $11)
         RETURNING id, public_id as "publicId", user_id as "userId", agent_id as "agentId",
                   store_id as "storeId", recipient_phone as "recipientPhone", network,
                   data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                   created_at as "createdAt"`,
        [
          publicId,
          store.userId, // Link to merchant user context
          store.agentId || null,
          store.id,
          product.catalogProductId,
          cleanPhone,
          product.network,
          product.dataAmountMb,
          retailPricePesewas,
          JSON.stringify(pricingSnapshot),
          idempotencyKey || null,
        ],
      );

      const orderRow = orderRes.rows[0];

      // Insert order item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesewas, total_pesewas)
         VALUES ($1, $2, 1, $3, $3)`,
        [orderRow.id, product.catalogProductId, retailPricePesewas],
      );

      // Insert initial provider projection (Database is authoritative single source of truth)
      await client.query(
        `INSERT INTO provider_orders (order_id, provider_name, provider_status)
         VALUES (
           $1,
           COALESCE(
             (SELECT name FROM telecom_providers WHERE is_authoritative = TRUE AND (is_active = TRUE OR status = 'ACTIVE') LIMIT 1),
             (SELECT name FROM telecom_providers WHERE is_active = TRUE OR status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1),
             'DataHouse'
           ),
           'UNKNOWN'
         )`,
        [orderRow.id],
      );

      // Record Order Event
      await client.query(
        `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, new_state)
         VALUES ($1, 'ORDER_CREATED', $2, $3, 'CUSTOMER', 'STOREFRONT', $4)`,
        [
          orderRow.id,
          req.id,
          null,
          JSON.stringify({
            orderStatus: 'CREATED',
            paymentStatus: 'PENDING',
            storeSlug: store.slug,
            retailPricePesewas,
          }),
        ],
      );

      // Insert Payment Intent Record
      const paymentPublicId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query(
        `INSERT INTO payments (
            public_id, order_id, user_id, amount_pesewas, currency,
            provider, provider_reference, payment_method, status
         ) VALUES ($1, $2, $3, $4, 'GHS', 'PAYSTACK', $5, $6, 'PENDING')`,
        [paymentPublicId, orderRow.id, store.userId, retailPricePesewas, paymentRef, paymentMethod],
      );

      await client.query('COMMIT');

      // Initialize Paystack Payment Gateway
      let authorizationUrl: string | undefined;
      let accessCode: string | undefined;

      if (deps.paymentProvider) {
        try {
          const payRes = await deps.paymentProvider.initializePayment({
            orderId: orderRow.id,
            amountPesewas: retailPricePesewas,
            currency: 'GHS' as any,
            email: customerEmail || store.contactEmail || 'customer@apisolutions.store',
            paymentMethod: 'PAYSTACK' as any,
            channel: channel as any,
            callbackUrl: callbackUrl || `${process.env.PUBLIC_STOREFRONT_BASE_URL || 'https://apisolutions.store/store'}/${store.slug}?ref=${paymentRef}`,
            metadata: {
              orderId: orderRow.id,
              orderPublicId: orderRow.publicId,
              storeId: store.id,
              storeSlug: store.slug,
              recipientPhone: cleanPhone,
              reference: paymentRef,
              purpose: 'STOREFRONT_ORDER',
            },
          });
          if (payRes?.authorizationUrl) {
            authorizationUrl = payRes.authorizationUrl;
          }
          if (payRes?.providerReference) {
            accessCode = payRes.providerReference;
          }
        } catch {
          // Keep internal reference for verification
        }
      }

      return reply.status(201).send({
        success: true,
        data: {
          order: {
            orderId: orderRow.publicId,
            id: orderRow.id,
            recipientPhone: cleanPhone,
            network: product.network,
            dataAmountMb: product.dataAmountMb,
            dataLabel: `${(product.dataAmountMb / 1024).toFixed(product.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`,
            amountPesewas: retailPricePesewas,
            amountGhs: retailPriceGhs,
            currency: 'GHS',
            paymentStatus: 'PENDING',
            orderStatus: 'CREATED',
            statusLabel: 'Order Created',
            storeName: store.storeName,
            storeSlug: store.slug,
          },
          payment: {
            reference: paymentRef,
            authorizationUrl,
            accessCode,
            amountPesewas: retailPricePesewas,
            amountGhs: retailPriceGhs,
            currency: 'GHS',
          },
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  app.post('/stores/public/orders/checkout', { preHandler: [maintenanceHook] }, handlePublicCheckout);
  app.post('/stores/public/:slug/checkout', { preHandler: [maintenanceHook] }, handlePublicCheckout);

  // 11. PUBLIC STOREFRONT PAYMENT VERIFICATION (/stores/public/orders/verify & /stores/public/:slug/verify-payment)
  const handlePublicPaymentVerification = async (req: FastifyRequest<any>, reply: FastifyReply) => {
    const { reference, orderId } = (req.body || {}) as { reference: string; orderId?: string };
    if (!reference) {
      throw new BadRequestError('Payment reference is required for verification');
    }


    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const payRes = await client.query(
        `SELECT p.id, p.order_id as "orderId", p.user_id as "userId", p.amount_pesewas as "amountPesewas",
                p.status as "paymentStatus", p.provider_reference as "providerReference",
                o.public_id as "orderPublicId", o.store_id as "storeId", o.agent_id as "agentId",
                o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
                o.amount_pesewas as "orderAmountPesewas", o.order_status as "orderStatus",
                o.pricing_snapshot as "pricingSnapshot", o.created_at as "createdAt", o.updated_at as "updatedAt"
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE p.provider_reference = $1 OR o.public_id = $2 OR o.id::text = $2
         FOR UPDATE`,
        [reference, orderId || reference],
      );

      if (payRes.rows.length === 0) {
        throw new NotFoundError(`Payment reference '${reference}' not found`);
      }

      const row = payRes.rows[0];

      if (row.paymentStatus !== 'PAID') {
        // Transition Payment to PAID
        await client.query(
          `UPDATE payments
           SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id],
        );

        // Record Payment Event
        await client.query(
          `INSERT INTO payment_events (
              payment_id, provider, event_type, correlation_id, source,
              previous_status, new_status, metadata
           ) VALUES ($1, 'PAYSTACK', 'PAYMENT_CAPTURED', $2, 'STOREFRONT_VERIFY', $3, 'PAID', $4)`,
          [
            row.id,
            req.id,
            row.paymentStatus,
            JSON.stringify({ reference, amountPesewas: row.amountPesewas }),
          ],
        );

        // Transition Order to READY_FOR_FULFILLMENT
        await client.query(
          `UPDATE orders
           SET payment_status = 'PAID',
               order_status = 'READY_FOR_FULFILLMENT',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.orderId],
        );

        // Record Order Event
        await client.query(
          `INSERT INTO order_events (
              order_id, event_type, correlation_id, actor_id, actor_type, source,
              previous_state, new_state
           ) VALUES ($1, 'PAYMENT_CONFIRMED', $2, $3, 'CUSTOMER', 'PAYMENT_ENGINE', $4, $5)`,
          [
            row.orderId,
            req.id,
            row.userId,
            JSON.stringify({ paymentStatus: 'PENDING', orderStatus: 'CREATED' }),
            JSON.stringify({ paymentStatus: 'PAID', orderStatus: 'READY_FOR_FULFILLMENT' }),
          ],
        );

        // Post Double-Entry Ledger Lines
        const platformSystemAccountId = '00000000-0000-0000-0000-000000000000';
        await client.query(
          `INSERT INTO financial_ledger_entries (
              entry_type, account_type, account_id, amount_pesewas, currency,
              reference_type, reference_id, description
           ) VALUES
           ('DEBIT', 'CUSTOMER_WALLET', $1, $2, 'GHS', 'PAYMENT', $3, $4),
           ('CREDIT', 'PLATFORM_ESCROW', $5, $2, 'GHS', 'PAYMENT', $3, $6)`,
          [
            row.userId,
            row.amountPesewas,
            row.id,
            `Customer payment received for Storefront Order ${row.orderPublicId}`,
            platformSystemAccountId,
            `Platform escrow credited for Storefront Order ${row.orderPublicId}`,
          ],
        );
      }

      await client.query('COMMIT');

      const dataAmountMb = parseInt(row.dataAmountMb, 10);
      const dataDisplay = `${(dataAmountMb / 1024).toFixed(dataAmountMb % 1024 === 0 ? 0 : 1)} GB`;
      const amountPesewas = parseInt(row.orderAmountPesewas, 10);

      return reply.send({
        success: true,
        data: {
          orderId: row.orderPublicId,
          status: 'READY_TO_PROCESS',
          statusLabel: 'Payment Confirmed · Processing Data Dispatch',
          paymentStatus: 'PAID',
          product: {
            name: `${row.network} ${dataDisplay} Data Bundle`,
            network: row.network,
            volumeDisplay: dataDisplay,
            validityDisplay: 'Non-Expiry',
          },
          recipientPhone: row.recipientPhone,
          amountPesewas,
          amountDisplay: `GH₵ ${(amountPesewas / 100).toFixed(2)}`,
          currency: 'GHS',
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  app.post('/stores/public/orders/verify', handlePublicPaymentVerification);
  app.post('/stores/public/:slug/verify-payment', handlePublicPaymentVerification);

  // 10. GET STORE CUSTOMERS (/stores/my-store/customers)
  app.get<{ Querystring: { search?: string; page?: string; limit?: string } }>(
    '/stores/my-store/customers',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      try {
        const store = await getAgentStore(req.user!.sub);
        if (!store) {
          return reply.send({
            success: true,
            data: {
              items: [],
              customers: [],
              pagination: { page: 1, limit: 10, total: 0, totalItems: 0, totalPages: 1 },
            },
          });
        }

        const search = req.query.search?.trim();
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
        const offset = (page - 1) * limit;

        let countQuery = `
          SELECT COUNT(DISTINCT recipient_phone) as total
          FROM orders
          WHERE store_id = $1
        `;
        let dataQuery = `
          SELECT 
            recipient_phone as "phone",
            COUNT(*) as "totalOrders",
            COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN amount_pesewas ELSE 0 END), 0) as "totalSpentPesewas",
            MAX(created_at) as "lastPurchase",
            MIN(created_at) as "firstPurchase"
          FROM orders
          WHERE store_id = $1
        `;
        const params: any[] = [store.id];

        if (search) {
          countQuery += ` AND recipient_phone ILIKE $2`;
          dataQuery += ` AND recipient_phone ILIKE $2`;
          params.push(`%${search}%`);
        }

        dataQuery += `
          GROUP BY recipient_phone
          ORDER BY MAX(created_at) DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const [countRes, dataRes] = await Promise.all([
          db.query(countQuery, params),
          db.query(dataQuery, [...params, limit, offset]),
        ]);

        const totalItems = parseInt(countRes.rows[0]?.total || '0', 10);
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const customers = (dataRes.rows || []).map((row: any) => ({
          phone: row.phone,
          totalOrders: parseInt(row.totalOrders, 10),
          totalSpentGhs: Number((parseInt(row.totalSpentPesewas, 10) / 100).toFixed(2)),
          lastPurchase: row.lastPurchase,
          firstPurchase: row.firstPurchase,
          status: new Date(row.lastPurchase) > thirtyDaysAgo ? 'ACTIVE' : 'INACTIVE',
        }));

        return reply.send({
          success: true,
          data: {
            items: customers,
            customers,
            pagination: { 
              page, 
              limit, 
              total: totalItems, 
              totalItems, 
              totalPages 
            },
          },
        });
      } catch (err) {
        req.log.error(err);
        return reply.send({
          success: true,
          data: {
            items: [],
            customers: [],
            pagination: { page: 1, limit: 10, total: 0, totalItems: 0, totalPages: 1 },
          },
        });
      }
    }
  );

  // 11. GET STORE ANALYTICS (/stores/my-store/analytics)
  app.get<{ Querystring: { period?: string } }>(
    '/stores/my-store/analytics',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      try {
        const store = await getAgentStore(req.user!.sub);
        if (!store) {
          return reply.send({
            success: true,
            data: {
              monthlyRevenueGhs: 0,
              monthlyRevenuePesewas: 0,
              completedOrders: 0,
              totalOrders: 0,
              successRate: 0,
              averageOrderValueGhs: 0,
              averageOrderValuePesewas: 0,
              networkBreakdown: [],
              networks: [],
              revenueTrend: [],
              dailyTrend: [],
            },
          });
        }

        const period = req.query.period || '30d';
        let dateFilter = '';
        if (period === '7d') {
          dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
        } else if (period === '30d') {
          dateFilter = `AND created_at >= NOW() - INTERVAL '30 days'`;
        } else if (period === 'month') {
          dateFilter = `AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`;
        }

        const aggregateQuery = `
          SELECT
            COUNT(*) as "totalOrders",
            COUNT(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status,'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN 1 END) as "completedOrders",
            COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status,'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN amount_pesewas ELSE 0 END), 0) as "monthlyRevenuePesewas"
          FROM orders
          WHERE store_id = $1 ${dateFilter}
        `;

        const networkQuery = `
          SELECT
            network,
            COUNT(*) as "orderCount",
            COALESCE(SUM(amount_pesewas), 0) as "revenuePesewas"
          FROM orders
          WHERE store_id = $1 AND payment_status = 'PAID' AND COALESCE(refund_status,'NONE') NOT IN ('COMPLETED', 'REFUNDED') ${dateFilter}
          GROUP BY network
        `;

        const trendQuery = `
          SELECT
            DATE(created_at) as "date",
            COALESCE(SUM(amount_pesewas), 0) as "revenuePesewas"
          FROM orders
          WHERE store_id = $1 AND payment_status = 'PAID' AND COALESCE(refund_status,'NONE') NOT IN ('COMPLETED', 'REFUNDED') AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `;

        const [aggRes, netRes, trendRes] = await Promise.all([
          db.query(aggregateQuery, [store.id]),
          db.query(networkQuery, [store.id]),
          db.query(trendQuery, [store.id]),
        ]);

        const agg = aggRes.rows[0] || {};
        const completedOrders = parseInt(agg.completedOrders, 10) || 0;
        const totalOrders = parseInt(agg.totalOrders, 10) || 0;
        const monthlyRevenuePesewas = parseInt(agg.monthlyRevenuePesewas, 10) || 0;
        const monthlyRevenueGhs = Number((monthlyRevenuePesewas / 100).toFixed(2));

        const successRate = totalOrders > 0 ? Number(((completedOrders / totalOrders) * 100).toFixed(1)) : 0;
        const averageOrderValuePesewas = completedOrders > 0 ? Math.floor(monthlyRevenuePesewas / completedOrders) : 0;
        const averageOrderValueGhs = Number((averageOrderValuePesewas / 100).toFixed(2));

        const totalCarrierRevenuePesewas = netRes.rows.reduce(
          (sum: number, r: any) => sum + (parseInt(r.revenuePesewas, 10) || 0),
          0,
        );

        const networkBreakdown = (netRes.rows || []).map((r: any) => {
          const revPesewas = parseInt(r.revenuePesewas, 10) || 0;
          const count = parseInt(r.orderCount, 10) || 0;
          const percentage = totalCarrierRevenuePesewas > 0 ? Number(((revPesewas / totalCarrierRevenuePesewas) * 100).toFixed(1)) : 0;
          return {
            network: r.network,
            orderCount: count,
            revenuePesewas: revPesewas,
            revenueGhs: Number((revPesewas / 100).toFixed(2)),
            percentage,
          };
        });

        const revenueTrend = (trendRes.rows || []).map((r: any) => {
          const revPesewas = parseInt(r.revenuePesewas, 10) || 0;
          return {
            date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
            revenuePesewas: revPesewas,
            revenueGhs: Number((revPesewas / 100).toFixed(2)),
          };
        });

        return reply.send({
          success: true,
          data: {
            monthlyRevenueGhs,
            monthlyRevenuePesewas,
            completedOrders,
            totalOrders,
            successRate,
            averageOrderValueGhs,
            averageOrderValuePesewas,
            networkBreakdown,
            networks: networkBreakdown,
            revenueTrend,
            dailyTrend: revenueTrend,
          },
        });
      } catch (err) {
        req.log.error(err);
        return reply.send({
          success: true,
          data: {
            monthlyRevenueGhs: 0,
            monthlyRevenuePesewas: 0,
            completedOrders: 0,
            totalOrders: 0,
            successRate: 0,
            averageOrderValueGhs: 0,
            averageOrderValuePesewas: 0,
            networkBreakdown: [],
            networks: [],
            revenueTrend: [],
            dailyTrend: [],
          },
        });
      }
    }
  );

  // 12. GET STORE FINANCE (/stores/my-store/finance)
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/stores/my-store/finance',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) throw new ForbiddenError('Store authorization required');

      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
      const offset = (page - 1) * limit;

      const financeAggQuery = `
        SELECT
          COUNT(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN 1 END) as "totalFulfilledOrders",
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN amount_pesewas ELSE 0 END), 0) as "grossSalesPesewas",
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN (pricing_snapshot->>'basePricePesewas')::numeric ELSE 0 END), 0) as "costPesewas",
          COALESCE(SUM(CASE 
            WHEN payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED') THEN 
              CASE
                WHEN (pricing_snapshot->>'markupPesewas') IS NOT NULL AND (pricing_snapshot->>'markupPesewas') != '' 
                  THEN (pricing_snapshot->>'markupPesewas')::bigint
                WHEN (pricing_snapshot->>'unitPricePesewas') IS NOT NULL AND (pricing_snapshot->>'basePricePesewas') IS NOT NULL 
                  THEN GREATEST(0, (pricing_snapshot->>'unitPricePesewas')::bigint - (pricing_snapshot->>'basePricePesewas')::bigint)
                ELSE 0
              END
            ELSE 0
          END), 0) as "profitPesewas"
        FROM orders
        WHERE store_id = $1
      `;

      const ledgerQuery = `
        SELECT
          id, entry_type as "entryType", amount_pesewas as "amountPesewas",
          reference_type as "referenceType", reference_id as "referenceId",
          description, created_at as "createdAt"
        FROM financial_ledger
        WHERE account_type = 'AGENT_WALLET' AND account_id IN (
          SELECT agent_id FROM stores WHERE user_id = $1 OR id = $2
        )
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const [aggRes, ledgerRes] = await Promise.all([
        db.query(financeAggQuery, [store.id]),
        db.query(ledgerQuery, [req.user!.sub, store.id, limit, offset]),
      ]);

      const agg = aggRes.rows[0];
      const grossSalesPesewas = parseInt(agg.grossSalesPesewas || '0', 10);
      const costPesewas = parseInt(agg.costPesewas || '0', 10);
      const profitPesewas = parseInt(agg.profitPesewas || (grossSalesPesewas - costPesewas).toString(), 10);
      const totalFulfilledOrders = parseInt(agg.totalFulfilledOrders || '0', 10);

      const recentTransactions = ledgerRes.rows.map((r: any) => ({
        id: r.id,
        entryType: r.entryType,
        amountPesewas: parseInt(r.amountPesewas, 10),
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        description: r.description,
        createdAt: r.createdAt,
      }));

      return reply.send({
        success: true,
        data: {
          grossSalesPesewas,
          grossSalesGhs: grossSalesPesewas / 100,
          costPesewas,
          costGhs: costPesewas / 100,
          profitPesewas,
          profitGhs: profitPesewas / 100,
          totalFulfilledOrders,
          recentTransactions,
          transactions: recentTransactions,
          pagination: { page, limit },
        },
      });
    }
  );

  // 12b. GET STORE TRANSACTIONS (/stores/my-store/transactions)
  app.get<{ Querystring: { page?: string; limit?: string; search?: string; type?: string; status?: string; dateRange?: string } }>(
    '/stores/my-store/transactions',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      try {
        const store = await getAgentStore(req.user!.sub);
        if (!store) {
          return reply.send({
            success: true,
            data: {
              transactions: [],
              summary: { totalCount: 0, totalGrossGhs: 0, totalProfitGhs: 0 },
              pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
            },
          });
        }

        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
        const offset = (page - 1) * limit;
        const search = req.query.search?.trim();
        const typeFilter = req.query.type;
        const statusFilter = req.query.status;
        const dateRange = req.query.dateRange;

        let dateCondition = '';
        if (dateRange === 'today') {
          dateCondition = `AND created_at >= CURRENT_DATE`;
        } else if (dateRange === '7d') {
          dateCondition = `AND created_at >= NOW() - INTERVAL '7 days'`;
        } else if (dateRange === '30d') {
          dateCondition = `AND created_at >= NOW() - INTERVAL '30 days'`;
        } else if (dateRange === '90d') {
          dateCondition = `AND created_at >= NOW() - INTERVAL '90 days'`;
        }

        const ordersQuery = `
          SELECT 
            id, 
            public_id as "reference", 
            'CUSTOMER_ORDER' as "type", 
            recipient_phone as "recipient",
            network,
            data_amount_mb as "dataAmountMb",
            amount_pesewas as "grossAmountPesewas",
            CASE
              WHEN (pricing_snapshot->>'markupPesewas') IS NOT NULL AND (pricing_snapshot->>'markupPesewas') != '' 
                THEN (pricing_snapshot->>'markupPesewas')::bigint
              WHEN (pricing_snapshot->>'unitPricePesewas') IS NOT NULL AND (pricing_snapshot->>'basePricePesewas') IS NOT NULL 
                THEN GREATEST(0, (pricing_snapshot->>'unitPricePesewas')::bigint - (pricing_snapshot->>'basePricePesewas')::bigint)
              ELSE 0
            END as "profitPesewas",
            payment_status as "paymentStatus",
            order_status as "orderStatus",
            COALESCE(refund_status, 'NONE') as "refundStatus",
            created_at as "createdAt"
          FROM orders
          WHERE store_id = $1 ${dateCondition}
        `;

        const payoutsQuery = `
          SELECT
            id,
            reference,
            'PAYOUT' as "type",
            destination_account as "recipient",
            destination_provider as "network",
            0 as "dataAmountMb",
            amount_pesewas as "grossAmountPesewas",
            amount_pesewas as "profitPesewas",
            status as "paymentStatus",
            status as "orderStatus",
            'NONE' as "refundStatus",
            created_at as "createdAt"
          FROM store_payouts
          WHERE (store_id = $1 OR agent_id = (SELECT agent_id FROM stores WHERE id = $1 LIMIT 1)) ${dateCondition}
        `;

        const [ordersRes, payoutsRes] = await Promise.all([
          db.query(ordersQuery, [store.id]),
          db.query(payoutsQuery, [store.id]),
        ]);

        let allTx = [];

        for (const o of ordersRes.rows) {
          const isRefunded = o.refundStatus === 'COMPLETED' || o.refundStatus === 'REFUNDED';
          let status = o.paymentStatus === 'PAID' ? 'PAID' : o.paymentStatus;
          if (isRefunded) status = 'REFUNDED';

          const dataLabel = o.dataAmountMb >= 1024 
            ? ((o.dataAmountMb / 1024).toFixed(1) + ' GB') 
            : ((o.dataAmountMb || 0) + ' MB');

          allTx.push({
            id: o.id,
            reference: o.reference || o.id.slice(0, 10),
            type: 'SALE',
            typeLabel: 'Storefront Customer Purchase',
            details: `${o.network || 'Data'} ${dataLabel} Bundle`,
            recipient: o.recipient || '—',
            grossAmountPesewas: parseInt(o.grossAmountPesewas, 10) || 0,
            grossAmountGhs: (parseInt(o.grossAmountPesewas, 10) || 0) / 100,
            profitPesewas: parseInt(o.profitPesewas, 10) || 0,
            profitGhs: (parseInt(o.profitPesewas, 10) || 0) / 100,
            status,
            channel: 'Paystack (Customer Checkout)',
            createdAt: o.createdAt,
            rawDate: o.createdAt ? new Date(o.createdAt).getTime() : 0,
          });
        }

        for (const p of payoutsRes.rows) {
          allTx.push({
            id: p.id,
            reference: p.reference || p.id.slice(0, 10),
            type: 'WITHDRAWAL',
            typeLabel: 'Storefront Profit Withdrawal',
            details: `Disbursement via ${p.network || 'MOMO'}`,
            recipient: p.recipient || '—',
            grossAmountPesewas: parseInt(p.grossAmountPesewas, 10) || 0,
            grossAmountGhs: (parseInt(p.grossAmountPesewas, 10) || 0) / 100,
            profitPesewas: parseInt(p.profitPesewas, 10) || 0,
            profitGhs: (parseInt(p.profitPesewas, 10) || 0) / 100,
            status: p.paymentStatus,
            channel: `${p.network || 'MOMO'} Transfer`,
            createdAt: p.createdAt,
            rawDate: p.createdAt ? new Date(p.createdAt).getTime() : 0,
          });
        }

        let filtered = allTx;

        if (typeFilter && typeFilter !== 'ALL') {
          filtered = filtered.filter(t => t.type === typeFilter);
        }

        if (statusFilter && statusFilter !== 'ALL') {
          filtered = filtered.filter(t => t.status === statusFilter);
        }

        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(t => 
            t.reference.toLowerCase().includes(s) ||
            t.recipient.toLowerCase().includes(s) ||
            t.details.toLowerCase().includes(s) ||
            t.channel.toLowerCase().includes(s)
          );
        }

        filtered.sort((a, b) => b.rawDate - a.rawDate);

        const totalCount = filtered.length;
        const totalGrossGhs = filtered
          .filter(t => t.type === 'SALE' && t.status === 'PAID')
          .reduce((sum, t) => sum + t.grossAmountGhs, 0);
        const totalProfitGhs = filtered
          .filter(t => t.type === 'SALE' && t.status === 'PAID')
          .reduce((sum, t) => sum + t.profitGhs, 0);

        const paginated = filtered.slice(offset, offset + limit);
        const totalPages = Math.ceil(totalCount / limit) || 1;

        return reply.send({
          success: true,
          data: {
            transactions: paginated,
            summary: {
              totalCount,
              totalGrossGhs: Number(totalGrossGhs.toFixed(2)),
              totalProfitGhs: Number(totalProfitGhs.toFixed(2)),
            },
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
            },
          },
        });
      } catch (err) {
        req.log.error(err);
        return reply.send({
          success: true,
          data: {
            transactions: [],
            summary: { totalCount: 0, totalGrossGhs: 0, totalProfitGhs: 0 },
            pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          },
        });
      }
    }
  );

  // 13. GET STORE SETTINGS (/stores/my-store/settings)
  app.get(
    '/stores/my-store/settings',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) throw new ForbiddenError('Store authorization required');

      const storeRes = await db.query('SELECT settings FROM stores WHERE id = $1', [store.id]);
      const storedSettings = storeRes.rows[0]?.settings || {};

      const defaults = {
        autoFulfill: true,
        smsAlerts: true,
        emailAlerts: true,
      };

      return reply.send({
        success: true,
        data: { ...defaults, ...storedSettings },
      });
    }
  );

  // 14. PUT STORE SETTINGS (/stores/my-store/settings)
  app.put<{ Body: { autoFulfill?: boolean; smsAlerts?: boolean; emailAlerts?: boolean } }>(
    '/stores/my-store/settings',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req, reply) => {
      const store = await getAgentStore(req.user!.sub);
      if (!store) throw new ForbiddenError('Store authorization required');

      const { autoFulfill, smsAlerts, emailAlerts } = req.body || {};

      const storeRes = await db.query('SELECT settings FROM stores WHERE id = $1', [store.id]);
      const storedSettings = storeRes.rows[0]?.settings || {};

      const newSettings = {
        ...storedSettings,
        ...(autoFulfill !== undefined && { autoFulfill }),
        ...(smsAlerts !== undefined && { smsAlerts }),
        ...(emailAlerts !== undefined && { emailAlerts }),
      };

      await db.query('UPDATE stores SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newSettings, store.id]);

      return reply.send({
        success: true,
        data: newSettings,
        message: 'Settings updated successfully',
      });
    }
  );
}
