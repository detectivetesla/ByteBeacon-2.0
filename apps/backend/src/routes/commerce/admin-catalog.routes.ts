import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import crypto from 'node:crypto';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { CatalogService } from '../../core/commerce/catalog.service.js';
import { ITelecomProvider } from '../../core/providers/telecom/telecom-provider.interface.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors/app-error.js';
import {
  NetworkProvider,
  UserRole,
  CatalogPlanStatus,
  CatalogProviderStatus,
  CatalogPricingMode,
  CatalogSyncChangeType,
  CatalogSyncBatchStatus,
  AdminCatalogStats,
  AdminCatalogPlanDetail,
  CreateCatalogPlanRequest,
  UpdateCatalogPlanRequest,
  BulkCatalogActionRequest,
  BulkPricingPreviewRequest,
  BulkPricingPreviewResponse,
  BulkPricingApplyRequest,
  DataHouseBundleDto,
} from '@bytebeacon/shared';

export interface AdminCatalogRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  catalogService: CatalogService;
  telecomProvider: ITelecomProvider;
}

export async function adminCatalogRoutes(
  app: FastifyInstance,
  deps: AdminCatalogRouteDependencies,
) {
  const {
    db,
    tokenService,
    apiKeyService,
    rbacService,
    auditService,
    catalogService: _catalogService,
    telecomProvider,
  } = deps;

  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper to map DB row to Admin Catalog Plan
  const mapCatalogRow = (r: any) => {
    const providerPrice = parseInt(r.providerPricePesewas || r.provider_price_pesewas || '0', 10);
    const basePrice = parseInt(r.basePricePesewas || r.base_price_pesewas || '0', 10);
    const agentPrice = r.agentPricePesewas || r.agent_price_pesewas ? parseInt(r.agentPricePesewas || r.agent_price_pesewas, 10) : null;
    const storePrice = r.storePricePesewas || r.store_price_pesewas ? parseInt(r.storePricePesewas || r.store_price_pesewas, 10) : null;

    const customerMarginPesewas = basePrice - providerPrice;
    const customerMarginPct = basePrice > 0 ? parseFloat(((customerMarginPesewas / basePrice) * 100).toFixed(1)) : 0;

    const agentMarginPesewas = agentPrice ? agentPrice - providerPrice : 0;
    const agentMarginPct = agentPrice && agentPrice > 0 ? parseFloat(((agentMarginPesewas / agentPrice) * 100).toFixed(1)) : 0;

    const storeMarginPesewas = storePrice ? storePrice - (agentPrice || providerPrice) : 0;
    const storeMarginPct = storePrice && storePrice > 0 ? parseFloat(((storeMarginPesewas / storePrice) * 100).toFixed(1)) : 0;

    return {
      id: r.id,
      sku: r.sku,
      network: r.network as NetworkProvider,
      name: r.name,
      dataAmountMb: parseInt(r.dataAmountMb || r.data_amount_mb, 10),
      validityDays: parseInt(r.validityDays || r.validity_days, 10),
      validityDesc: r.validityDesc || r.validity_desc || `${r.validityDays || r.validity_days} Days`,
      basePricePesewas: basePrice,
      agentPricePesewas: agentPrice,
      agentMinPricePesewas: r.agentMinPricePesewas || r.agent_min_price_pesewas ? parseInt(r.agentMinPricePesewas || r.agent_min_price_pesewas, 10) : null,
      agentMaxPricePesewas: r.agentMaxPricePesewas || r.agent_max_price_pesewas ? parseInt(r.agentMaxPricePesewas || r.agent_max_price_pesewas, 10) : null,
      storePricePesewas: storePrice,
      providerPricePesewas: providerPrice,
      providerName: r.providerName || r.provider_name || 'DataHouse',
      providerPlanId: r.providerPlanId || r.provider_plan_id || null,
      providerPlanCode: r.providerPlanCode || r.provider_plan_code || null,
      providerProductCode: r.providerProductCode || r.provider_product_code || null,
      pricingMode: (r.pricingMode || r.pricing_mode || 'FIXED') as CatalogPricingMode,
      markupValue: r.markupValue || r.markup_value ? parseFloat(r.markupValue || r.markup_value) : 0,
      description: r.description || null,
      category: r.category || 'DATA_BUNDLE',
      status: (r.status as CatalogPlanStatus) || (r.is_active ? CatalogPlanStatus.ACTIVE : CatalogPlanStatus.DISABLED),
      providerStatus: (r.providerStatus || r.provider_status || 'AVAILABLE') as CatalogProviderStatus,
      availableForCustomer: r.availableForCustomer !== undefined ? Boolean(r.availableForCustomer) : (r.available_for_customer !== undefined ? Boolean(r.available_for_customer) : true),
      availableForAgent: r.availableForAgent !== undefined ? Boolean(r.availableForAgent) : (r.available_for_agent !== undefined ? Boolean(r.available_for_agent) : true),
      availableForStore: r.availableForStore !== undefined ? Boolean(r.availableForStore) : (r.available_for_store !== undefined ? Boolean(r.available_for_store) : true),
      availableForApi: r.availableForApi !== undefined ? Boolean(r.availableForApi) : (r.available_for_api !== undefined ? Boolean(r.available_for_api) : true),
      version: r.version ? parseInt(r.version, 10) : 1,
      lastSyncedAt: r.lastSyncedAt || r.last_synced_at ? new Date(r.lastSyncedAt || r.last_synced_at).toISOString() : null,
      syncError: r.syncError || r.sync_error || null,
      popular: Boolean(r.popular),
      isActive: Boolean(r.is_active ?? r.isActive),
      customerMarginPesewas,
      customerMarginPct,
      agentMarginPesewas,
      agentMarginPct,
      storeMarginPesewas,
      storeMarginPct,
      createdAt: new Date(r.created_at || r.createdAt).toISOString(),
      updatedAt: new Date(r.updated_at || r.updatedAt).toISOString(),
    };
  };

  // 1. GET /admin/catalog/stats — Summary KPI Counters
  app.get(
    '/admin/catalog/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const statsQuery = `
        SELECT
          COUNT(*) as "totalPlans",
          COUNT(*) FILTER (WHERE (status = 'ACTIVE' OR (status IS NULL AND is_active = TRUE)) AND is_active = TRUE) as "activePlans",
          COUNT(*) FILTER (WHERE status = 'DISABLED' OR status = 'ARCHIVED' OR is_active = FALSE) as "disabledPlans",
          COUNT(*) FILTER (WHERE COALESCE(available_for_customer, TRUE) = TRUE AND is_active = TRUE) as "customerPlans",
          COUNT(*) FILTER (WHERE COALESCE(available_for_agent, TRUE) = TRUE AND is_active = TRUE) as "agentPlans",
          COUNT(*) FILTER (WHERE COALESCE(available_for_store, TRUE) = TRUE AND is_active = TRUE) as "storePlans",
          COUNT(*) FILTER (WHERE COALESCE(provider_status, 'AVAILABLE') = 'AVAILABLE' AND sync_error IS NULL) as "providerSynced",
          COUNT(*) FILTER (WHERE provider_status = 'SYNC_ERROR' OR sync_error IS NOT NULL OR provider_status = 'PROVIDER_REMOVED') as "syncIssues"
        FROM catalog_products
      `;

      const result = await db.query(statsQuery).catch(() => ({
        rows: [{
          totalPlans: '0',
          activePlans: '0',
          disabledPlans: '0',
          customerPlans: '0',
          agentPlans: '0',
          storePlans: '0',
          providerSynced: '0',
          syncIssues: '0',
        }],
      }));

      const row = result.rows[0];
      const stats: AdminCatalogStats = {
        totalPlans: parseInt(row.totalPlans || '0', 10),
        activePlans: parseInt(row.activePlans || '0', 10),
        disabledPlans: parseInt(row.disabledPlans || '0', 10),
        customerPlans: parseInt(row.customerPlans || '0', 10),
        agentPlans: parseInt(row.agentPlans || '0', 10),
        storePlans: parseInt(row.storePlans || '0', 10),
        providerSynced: parseInt(row.providerSynced || '0', 10),
        syncIssues: parseInt(row.syncIssues || '0', 10),
      };

      return reply.send({
        success: true,
        data: stats,
      });
    },
  );

  // 2. GET /admin/catalog/plans — Multi-Filter & Search Table
  app.get<{
    Querystring: {
      search?: string;
      network?: string;
      provider?: string;
      status?: string;
      providerStatus?: string;
      customerAvailability?: string;
      agentAvailability?: string;
      storeAvailability?: string;
      apiAvailability?: string;
      minPrice?: string;
      maxPrice?: string;
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: string;
    };
  }>(
    '/admin/catalog/plans',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        search,
        network,
        provider,
        status,
        providerStatus,
        customerAvailability,
        agentAvailability,
        storeAvailability,
        apiAvailability,
        minPrice,
        maxPrice,
        page = '1',
        limit = '20',
        sortBy = 'network',
        sortOrder = 'ASC',
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereConditions.push(`(
          name ILIKE $${paramIdx} OR
          sku ILIKE $${paramIdx} OR
          provider_plan_id ILIKE $${paramIdx} OR
          provider_plan_code ILIKE $${paramIdx} OR
          network ILIKE $${paramIdx} OR
          COALESCE(description, '') ILIKE $${paramIdx}
        )`);
        queryParams.push(term);
        paramIdx++;
      }

      if (network && network !== 'ALL') {
        whereConditions.push(`network = $${paramIdx}`);
        queryParams.push(network.toUpperCase());
        paramIdx++;
      }

      if (provider && provider !== 'ALL') {
        whereConditions.push(`provider_name ILIKE $${paramIdx}`);
        queryParams.push(provider);
        paramIdx++;
      }

      if (status && status !== 'ALL') {
        whereConditions.push(`status = $${paramIdx}`);
        queryParams.push(status);
        paramIdx++;
      }

      if (providerStatus && providerStatus !== 'ALL') {
        whereConditions.push(`provider_status = $${paramIdx}`);
        queryParams.push(providerStatus);
        paramIdx++;
      }

      if (customerAvailability && customerAvailability !== 'ALL') {
        whereConditions.push(`available_for_customer = $${paramIdx}`);
        queryParams.push(customerAvailability === 'AVAILABLE' || customerAvailability === 'true');
        paramIdx++;
      }

      if (agentAvailability && agentAvailability !== 'ALL') {
        whereConditions.push(`available_for_agent = $${paramIdx}`);
        queryParams.push(agentAvailability === 'AVAILABLE' || agentAvailability === 'true');
        paramIdx++;
      }

      if (storeAvailability && storeAvailability !== 'ALL') {
        whereConditions.push(`available_for_store = $${paramIdx}`);
        queryParams.push(storeAvailability === 'AVAILABLE' || storeAvailability === 'true');
        paramIdx++;
      }

      if (apiAvailability && apiAvailability !== 'ALL') {
        whereConditions.push(`available_for_api = $${paramIdx}`);
        queryParams.push(apiAvailability === 'AVAILABLE' || apiAvailability === 'true');
        paramIdx++;
      }

      if (minPrice) {
        const minPesewas = Math.round(parseFloat(minPrice) * 100);
        if (!isNaN(minPesewas)) {
          whereConditions.push(`base_price_pesewas >= $${paramIdx}`);
          queryParams.push(minPesewas);
          paramIdx++;
        }
      }

      if (maxPrice) {
        const maxPesewas = Math.round(parseFloat(maxPrice) * 100);
        if (!isNaN(maxPesewas)) {
          whereConditions.push(`base_price_pesewas <= $${paramIdx}`);
          queryParams.push(maxPesewas);
          paramIdx++;
        }
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM catalog_products ${whereSql}`;
      const countRes = await db.query(countSql, queryParams).catch(() => ({ rows: [{ total: '0' }] }));
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const validSortColumns: Record<string, string> = {
        network: 'network',
        name: 'name',
        dataAmountMb: 'data_amount_mb',
        basePricePesewas: 'base_price_pesewas',
        agentPricePesewas: 'agent_price_pesewas',
        providerPricePesewas: 'provider_price_pesewas',
        status: 'status',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      };

      const sortCol = validSortColumns[sortBy] || 'network ASC, data_amount_mb';
      const sortDir = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const selectSql = `
        SELECT id, sku, network, name, data_amount_mb, validity_days, validity_desc,
               base_price_pesewas, agent_price_pesewas, agent_min_price_pesewas, agent_max_price_pesewas,
               store_price_pesewas, provider_price_pesewas, provider_name, provider_plan_id,
               provider_plan_code, provider_product_code, pricing_mode, markup_value, description,
               category, status, provider_status, available_for_customer, available_for_agent,
               available_for_store, available_for_api, version, last_synced_at, sync_error, popular,
               is_active, created_at, updated_at
        FROM catalog_products
        ${whereSql}
        ORDER BY ${sortCol} ${sortDir}, id ASC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;

      const listRes = await db.query(selectSql, [...queryParams, limitNum, offset]).catch(() => ({ rows: [] }));
      const items = listRes.rows.map(mapCatalogRow);

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

  // 3. GET /admin/catalog/plans/:id — Individual Plan Dossier & Analytics
  app.get<{ Params: { id: string } }>(
    '/admin/catalog/plans/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const planRes = await db.query(
        'SELECT * FROM catalog_products WHERE id = $1',
        [id],
      );

      if (planRes.rows.length === 0) {
        throw new NotFoundError(`Data plan '${id}' not found in catalog.`);
      }

      const planDto = mapCatalogRow(planRes.rows[0]);

      // Fetch analytics for this plan
      const analyticsQuery = `
        SELECT
          COUNT(*) as "lifetimeOrders",
          COALESCE(SUM(amount_pesewas), 0) as "lifetimeRevenuePesewas",
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as "todayOrders",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE created_at >= CURRENT_DATE), 0) as "todayRevenuePesewas",
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as "last7DaysOrders",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'), 0) as "last7DaysRevenuePesewas",
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as "last30DaysOrders",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0) as "last30DaysRevenuePesewas",
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days') as "last90DaysOrders",
          COUNT(*) FILTER (WHERE order_status = 'COMPLETED') as "successfulOrders",
          COUNT(*) FILTER (WHERE order_status = 'FAILED') as "failedOrders",
          COUNT(*) FILTER (WHERE refund_status = 'COMPLETED') as "refundedOrders"
        FROM orders
        WHERE product_id = $1
      `;

      const analyticsRes = await db.query(analyticsQuery, [id]).catch(() => ({ rows: [{}] }));
      const aRow = analyticsRes.rows[0] || {};
      const lifetimeOrders = parseInt(aRow.lifetimeOrders || '0', 10);
      const successfulOrders = parseInt(aRow.successfulOrders || '0', 10);

      // Price history
      const historyRes = await db.query(
        `SELECT cph.*, u.full_name as "changedByName"
         FROM catalog_price_history cph
         LEFT JOIN users u ON cph.changed_by = u.id
         WHERE cph.product_id = $1
         ORDER BY cph.created_at DESC
         LIMIT 20`,
        [id],
      ).catch(() => ({ rows: [] }));

      const priceHistory = historyRes.rows.map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        changedBy: r.changed_by,
        changedByName: r.changedByName || 'System',
        changeType: r.change_type,
        previousProviderPricePesewas: r.previous_provider_price_pesewas ? parseInt(r.previous_provider_price_pesewas, 10) : null,
        newProviderPricePesewas: r.new_provider_price_pesewas ? parseInt(r.new_provider_price_pesewas, 10) : null,
        previousBasePricePesewas: r.previous_base_price_pesewas ? parseInt(r.previous_base_price_pesewas, 10) : null,
        newBasePricePesewas: r.new_base_price_pesewas ? parseInt(r.new_base_price_pesewas, 10) : null,
        previousAgentPricePesewas: r.previous_agent_price_pesewas ? parseInt(r.previous_agent_price_pesewas, 10) : null,
        newAgentPricePesewas: r.new_agent_price_pesewas ? parseInt(r.new_agent_price_pesewas, 10) : null,
        previousStorePricePesewas: r.previous_store_price_pesewas ? parseInt(r.previous_store_price_pesewas, 10) : null,
        newStorePricePesewas: r.new_store_price_pesewas ? parseInt(r.new_store_price_pesewas, 10) : null,
        reason: r.reason,
        metadata: r.metadata,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      // Recent 10 orders
      const recentOrdersRes = await db.query(
        `SELECT o.id, o.public_id as "publicId", o.recipient_phone as "recipientPhone",
                o.amount_pesewas as "amountPesewas", o.payment_status as "paymentStatus",
                o.order_status as "orderStatus", o.provider_status as "providerStatus",
                o.created_at as "createdAt", u.email as "customerEmail"
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.product_id = $1
         ORDER BY o.created_at DESC
         LIMIT 10`,
        [id],
      ).catch(() => ({ rows: [] }));

      const recentOrders = recentOrdersRes.rows.map((r: any) => ({
        id: r.id,
        publicId: r.publicId,
        customerEmail: r.customerEmail || 'Guest Customer',
        recipientPhone: r.recipientPhone,
        amountPesewas: parseInt(r.amountPesewas, 10),
        paymentStatus: r.paymentStatus,
        orderStatus: r.orderStatus,
        providerStatus: r.providerStatus,
        createdAt: new Date(r.createdAt).toISOString(),
      }));

      const detail: AdminCatalogPlanDetail = {
        ...planDto,
        analytics: {
          todayOrders: parseInt(aRow.todayOrders || '0', 10),
          todayRevenuePesewas: parseInt(aRow.todayRevenuePesewas || '0', 10),
          last7DaysOrders: parseInt(aRow.last7DaysOrders || '0', 10),
          last7DaysRevenuePesewas: parseInt(aRow.last7DaysRevenuePesewas || '0', 10),
          last30DaysOrders: parseInt(aRow.last30DaysOrders || '0', 10),
          last30DaysRevenuePesewas: parseInt(aRow.last30DaysRevenuePesewas || '0', 10),
          last90DaysOrders: parseInt(aRow.last90DaysOrders || '0', 10),
          lifetimeOrders,
          lifetimeRevenuePesewas: parseInt(aRow.lifetimeRevenuePesewas || '0', 10),
          successfulOrders,
          failedOrders: parseInt(aRow.failedOrders || '0', 10),
          refundedOrders: parseInt(aRow.refundedOrders || '0', 10),
          successRatePct: lifetimeOrders > 0 ? parseFloat(((successfulOrders / lifetimeOrders) * 100).toFixed(1)) : 100,
        },
        priceHistory,
        recentOrders,
      };

      return reply.send({
        success: true,
        data: detail,
      });
    },
  );

  // 4. POST /admin/catalog/plans — Create New Data Plan
  app.post<{ Body: CreateCatalogPlanRequest }>(
    '/admin/catalog/plans',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const body = req.body || {};

      if (!body.name || !body.network || !body.dataAmountMb || body.dataAmountMb <= 0) {
        throw new BadRequestError('Name, network, and positive dataAmountMb are required.');
      }

      if (body.basePricePesewas === undefined || body.basePricePesewas <= 0) {
        throw new BadRequestError('Customer retail price (basePricePesewas) must be a positive integer in pesewas.');
      }

      const sku = body.sku?.trim() || `${body.network.toUpperCase()}-${body.dataAmountMb}MB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const providerPrice = body.providerPricePesewas || 0;
      const status = body.status || CatalogPlanStatus.ACTIVE;
      const isActive = status === CatalogPlanStatus.ACTIVE;

      const insertSql = `
        INSERT INTO catalog_products (
          sku, network, name, data_amount_mb, validity_days, validity_desc,
          provider_price_pesewas, base_price_pesewas, agent_price_pesewas,
          agent_min_price_pesewas, agent_max_price_pesewas, store_price_pesewas,
          provider_name, provider_plan_id, provider_plan_code, provider_product_code,
          pricing_mode, markup_value, description, category, status, provider_status,
          available_for_customer, available_for_agent, available_for_store, available_for_api,
          popular, is_active, version
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26,
          $27, $28, 1
        )
        RETURNING *
      `;

      const res = await db.query(insertSql, [
        sku,
        body.network.toUpperCase(),
        body.name.trim(),
        body.dataAmountMb,
        body.validityDays || 30,
        body.validityDesc || `${body.validityDays || 30} Days`,
        providerPrice,
        body.basePricePesewas,
        body.agentPricePesewas || null,
        body.agentMinPricePesewas || null,
        body.agentMaxPricePesewas || null,
        body.storePricePesewas || null,
        body.providerName || 'DataHouse',
        body.providerPlanId || null,
        body.providerPlanCode || null,
        body.providerProductCode || null,
        body.pricingMode || 'FIXED',
        body.markupValue || 0,
        body.description || null,
        body.category || 'DATA_BUNDLE',
        status,
        'AVAILABLE',
        body.availableForCustomer !== undefined ? body.availableForCustomer : true,
        body.availableForAgent !== undefined ? body.availableForAgent : true,
        body.availableForStore !== undefined ? body.availableForStore : true,
        body.availableForApi !== undefined ? body.availableForApi : true,
        body.popular || false,
        isActive,
      ]);

      const newPlan = mapCatalogRow(res.rows[0]);

      // Record initial entry in catalog_price_history
      await db.query(
        `INSERT INTO catalog_price_history (
          product_id, changed_by, change_type,
          new_provider_price_pesewas, new_base_price_pesewas,
          new_agent_price_pesewas, new_store_price_pesewas,
          reason
        ) VALUES ($1, $2, 'INITIAL_IMPORT', $3, $4, $5, $6, 'Initial plan creation')`,
        [
          newPlan.id,
          req.user?.sub || null,
          providerPrice,
          body.basePricePesewas,
          body.agentPricePesewas || null,
          body.storePricePesewas || null,
        ],
      ).catch(() => {});

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'PLAN_CREATED',
          resourceType: 'catalog_products',
          resourceId: newPlan.id,
          metadata: { sku, name: body.name, network: body.network, basePricePesewas: body.basePricePesewas },
        });
      }

      return reply.status(201).send({
        success: true,
        data: newPlan,
        message: `Data plan '${newPlan.name}' created successfully.`,
      });
    },
  );

  // 5. PUT /admin/catalog/plans/:id — Update Plan Details & Pricing
  app.put<{ Params: { id: string }; Body: UpdateCatalogPlanRequest }>(
    '/admin/catalog/plans/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body || {};

      const existingRes = await db.query('SELECT * FROM catalog_products WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) {
        throw new NotFoundError(`Data plan '${id}' not found.`);
      }

      const existing = existingRes.rows[0];

      // Check if price changed
      const priceChanged =
        (body.providerPricePesewas !== undefined && body.providerPricePesewas !== parseInt(existing.provider_price_pesewas || '0', 10)) ||
        (body.basePricePesewas !== undefined && body.basePricePesewas !== parseInt(existing.base_price_pesewas, 10)) ||
        (body.agentPricePesewas !== undefined && body.agentPricePesewas !== (existing.agent_price_pesewas ? parseInt(existing.agent_price_pesewas, 10) : null)) ||
        (body.storePricePesewas !== undefined && body.storePricePesewas !== (existing.store_price_pesewas ? parseInt(existing.store_price_pesewas, 10) : null));

      const newProviderPrice = body.providerPricePesewas !== undefined ? body.providerPricePesewas : parseInt(existing.provider_price_pesewas || '0', 10);
      const newBasePrice = body.basePricePesewas !== undefined ? body.basePricePesewas : parseInt(existing.base_price_pesewas, 10);
      const newAgentPrice = body.agentPricePesewas !== undefined ? body.agentPricePesewas : (existing.agent_price_pesewas ? parseInt(existing.agent_price_pesewas, 10) : null);
      const newStorePrice = body.storePricePesewas !== undefined ? body.storePricePesewas : (existing.store_price_pesewas ? parseInt(existing.store_price_pesewas, 10) : null);
      const newStatus = body.status || existing.status || (existing.is_active ? 'ACTIVE' : 'DISABLED');
      const newIsActive = newStatus === 'ACTIVE';

      const updateSql = `
        UPDATE catalog_products
        SET name = COALESCE($1, name),
            network = COALESCE($2, network),
            data_amount_mb = COALESCE($3, data_amount_mb),
            validity_days = COALESCE($4, validity_days),
            validity_desc = COALESCE($5, validity_desc),
            provider_price_pesewas = $6,
            base_price_pesewas = $7,
            agent_price_pesewas = $8,
            agent_min_price_pesewas = $9,
            agent_max_price_pesewas = $10,
            store_price_pesewas = $11,
            provider_name = COALESCE($12, provider_name),
            provider_plan_id = COALESCE($13, provider_plan_id),
            provider_plan_code = COALESCE($14, provider_plan_code),
            provider_product_code = COALESCE($15, provider_product_code),
            pricing_mode = COALESCE($16, pricing_mode),
            markup_value = COALESCE($17, markup_value),
            description = COALESCE($18, description),
            category = COALESCE($19, category),
            status = $20,
            provider_status = COALESCE($21, provider_status),
            available_for_customer = COALESCE($22, available_for_customer),
            available_for_agent = COALESCE($23, available_for_agent),
            available_for_store = COALESCE($24, available_for_store),
            available_for_api = COALESCE($25, available_for_api),
            popular = COALESCE($26, popular),
            is_active = $27,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $28
        RETURNING *
      `;

      const updateRes = await db.query(updateSql, [
        body.name ? body.name.trim() : null,
        body.network ? body.network.toUpperCase() : null,
        body.dataAmountMb || null,
        body.validityDays || null,
        body.validityDesc || null,
        newProviderPrice,
        newBasePrice,
        newAgentPrice,
        body.agentMinPricePesewas !== undefined ? body.agentMinPricePesewas : (existing.agent_min_price_pesewas ? parseInt(existing.agent_min_price_pesewas, 10) : null),
        body.agentMaxPricePesewas !== undefined ? body.agentMaxPricePesewas : (existing.agent_max_price_pesewas ? parseInt(existing.agent_max_price_pesewas, 10) : null),
        newStorePrice,
        body.providerName || null,
        body.providerPlanId !== undefined ? body.providerPlanId : null,
        body.providerPlanCode !== undefined ? body.providerPlanCode : null,
        body.providerProductCode !== undefined ? body.providerProductCode : null,
        body.pricingMode || null,
        body.markupValue !== undefined ? body.markupValue : null,
        body.description !== undefined ? body.description : null,
        body.category || null,
        newStatus,
        body.providerStatus || null,
        body.availableForCustomer !== undefined ? body.availableForCustomer : null,
        body.availableForAgent !== undefined ? body.availableForAgent : null,
        body.availableForStore !== undefined ? body.availableForStore : null,
        body.availableForApi !== undefined ? body.availableForApi : null,
        body.popular !== undefined ? body.popular : null,
        newIsActive,
        id,
      ]);

      const updatedPlan = mapCatalogRow(updateRes.rows[0]);

      // If price changed, write immutable audit record to catalog_price_history
      if (priceChanged) {
        await db.query(
          `INSERT INTO catalog_price_history (
            product_id, changed_by, change_type,
            previous_provider_price_pesewas, new_provider_price_pesewas,
            previous_base_price_pesewas, new_base_price_pesewas,
            previous_agent_price_pesewas, new_agent_price_pesewas,
            previous_store_price_pesewas, new_store_price_pesewas,
            reason
          ) VALUES ($1, $2, 'MANUAL_EDIT', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            req.user?.sub || null,
            parseInt(existing.provider_price_pesewas || '0', 10),
            newProviderPrice,
            parseInt(existing.base_price_pesewas, 10),
            newBasePrice,
            existing.agent_price_pesewas ? parseInt(existing.agent_price_pesewas, 10) : null,
            newAgentPrice,
            existing.store_price_pesewas ? parseInt(existing.store_price_pesewas, 10) : null,
            newStorePrice,
            body.changeReason || 'Administrative price modification',
          ],
        ).catch(() => {});
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: priceChanged ? 'PLAN_PRICE_CHANGED' : 'PLAN_UPDATED',
          resourceType: 'catalog_products',
          resourceId: id,
          metadata: {
            previousPrices: {
              provider: parseInt(existing.provider_price_pesewas || '0', 10),
              customer: parseInt(existing.base_price_pesewas, 10),
              agent: existing.agent_price_pesewas ? parseInt(existing.agent_price_pesewas, 10) : null,
            },
            newPrices: {
              provider: newProviderPrice,
              customer: newBasePrice,
              agent: newAgentPrice,
            },
            reason: body.changeReason,
          },
        });
      }

      return reply.send({
        success: true,
        data: updatedPlan,
        message: `Data plan '${updatedPlan.name}' updated successfully.`,
      });
    },
  );

  // 6. PATCH /admin/catalog/plans/:id/status — Status Transition (Activate/Disable/Archive/Draft)
  app.patch<{ Params: { id: string }; Body: { status: CatalogPlanStatus; reason?: string } }>(
    '/admin/catalog/plans/:id/status',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { status, reason } = req.body || {};

      if (!status || !Object.values(CatalogPlanStatus).includes(status)) {
        throw new BadRequestError(`Invalid status '${status}'. Must be ACTIVE, DISABLED, ARCHIVED, or DRAFT.`);
      }

      const isActive = status === CatalogPlanStatus.ACTIVE;

      const updateRes = await db.query(
        `UPDATE catalog_products
         SET status = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [status, isActive, id],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError(`Data plan '${id}' not found.`);
      }

      const updated = mapCatalogRow(updateRes.rows[0]);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: status === 'ACTIVE' ? 'PLAN_ENABLED' : (status === 'ARCHIVED' ? 'PLAN_ARCHIVED' : 'PLAN_DISABLED'),
          resourceType: 'catalog_products',
          resourceId: id,
          metadata: { status, reason },
        });
      }

      return reply.send({
        success: true,
        data: updated,
        message: `Plan status updated to ${status}.`,
      });
    },
  );

  // 7. PATCH /admin/catalog/plans/:id/visibility — Toggle Channel Visibility
  app.patch<{
    Params: { id: string };
    Body: {
      availableForCustomer?: boolean;
      availableForAgent?: boolean;
      availableForStore?: boolean;
      availableForApi?: boolean;
    };
  }>(
    '/admin/catalog/plans/:id/visibility',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { availableForCustomer, availableForAgent, availableForStore, availableForApi } = req.body || {};

      const updateRes = await db.query(
        `UPDATE catalog_products
         SET available_for_customer = COALESCE($1, available_for_customer),
             available_for_agent = COALESCE($2, available_for_agent),
             available_for_store = COALESCE($3, available_for_store),
             available_for_api = COALESCE($4, available_for_api),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [availableForCustomer, availableForAgent, availableForStore, availableForApi, id],
      );

      if (updateRes.rows.length === 0) {
        throw new NotFoundError(`Data plan '${id}' not found.`);
      }

      const updated = mapCatalogRow(updateRes.rows[0]);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'PLAN_VISIBILITY_CHANGED',
          resourceType: 'catalog_products',
          resourceId: id,
          metadata: { availableForCustomer, availableForAgent, availableForStore, availableForApi },
        });
      }

      return reply.send({
        success: true,
        data: updated,
        message: `Plan channel visibility updated.`,
      });
    },
  );

  // 8. DELETE /admin/catalog/plans/:id — Delete / Archive Data Plan
  app.delete<{ Params: { id: string } }>(
    '/admin/catalog/plans/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const planRes = await db.query('SELECT * FROM catalog_products WHERE id = $1', [id]);
      if (planRes.rows.length === 0) {
        throw new NotFoundError(`Data plan '${id}' not found.`);
      }
      const plan = planRes.rows[0];

      // Check if orders reference this product
      const orderCheck = await db
        .query('SELECT 1 FROM orders WHERE product_id = $1 LIMIT 1', [id])
        .catch(() => ({ rows: [] }));

      if (orderCheck.rows.length > 0) {
        // If orders reference it, safely soft-delete / archive to protect audit and order integrity
        await db.query(
          "UPDATE catalog_products SET status = 'ARCHIVED', is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [id],
        );
      } else {
        // If no orders reference it, clean up child records and delete
        await db.query('DELETE FROM catalog_price_history WHERE product_id = $1', [id]).catch(() => {});
        await db.query('DELETE FROM agent_pricing WHERE product_id = $1', [id]).catch(() => {});
        await db.query('DELETE FROM store_products WHERE product_id = $1', [id]).catch(() => {});
        await db.query('DELETE FROM catalog_products WHERE id = $1', [id]);
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'PLAN_DELETED',
          resourceType: 'catalog_products',
          resourceId: id,
          metadata: { sku: plan.sku, name: plan.name, network: plan.network, archivedOnly: orderCheck.rows.length > 0 },
        });
      }

      return reply.send({
        success: true,
        message: `Plan '${plan.name}' deleted successfully.`,
      });
    },
  );

  // 9. POST /admin/catalog/plans/bulk — Batch Status and Visibility Actions
  app.post<{ Body: BulkCatalogActionRequest }>(
    '/admin/catalog/plans/bulk',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { planIds = [], action, reason } = req.body || {};

      if (!planIds || planIds.length === 0) {
        throw new BadRequestError('No plan IDs provided.');
      }

      if (action === 'DELETE') {
        // Delete or archive each plan in batch
        let affectedCount = 0;
        for (const planId of planIds) {
          const orderCheck = await db
            .query('SELECT 1 FROM orders WHERE product_id = $1 LIMIT 1', [planId])
            .catch(() => ({ rows: [] }));

          if (orderCheck.rows.length > 0) {
            await db.query(
              "UPDATE catalog_products SET status = 'ARCHIVED', is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
              [planId],
            );
          } else {
            await db.query('DELETE FROM catalog_price_history WHERE product_id = $1', [planId]).catch(() => {});
            await db.query('DELETE FROM agent_pricing WHERE product_id = $1', [planId]).catch(() => {});
            await db.query('DELETE FROM store_products WHERE product_id = $1', [planId]).catch(() => {});
            await db.query('DELETE FROM catalog_products WHERE id = $1', [planId]);
          }
          affectedCount++;
        }

        if (auditService) {
          await auditService.log({
            correlationId: req.id,
            actorId: req.user!.sub,
            actorType: 'ADMIN',
            action: 'BULK_PLAN_DELETED',
            resourceType: 'catalog_products',
            resourceId: `${planIds.length}_plans`,
            metadata: { action: 'DELETE', affectedCount, planIds, reason },
          });
        }

        return reply.send({
          success: true,
          data: { affectedCount },
          message: `Successfully deleted / archived ${affectedCount} plans.`,
        });
      }

      let updateClause = '';
      switch (action) {
        case 'ACTIVATE':
          updateClause = "status = 'ACTIVE', is_active = TRUE";
          break;
        case 'DISABLE':
          updateClause = "status = 'DISABLED', is_active = FALSE";
          break;
        case 'ARCHIVE':
          updateClause = "status = 'ARCHIVED', is_active = FALSE";
          break;
        case 'ENABLE_CUSTOMER':
          updateClause = 'available_for_customer = TRUE';
          break;
        case 'DISABLE_CUSTOMER':
          updateClause = 'available_for_customer = FALSE';
          break;
        case 'ENABLE_AGENT':
          updateClause = 'available_for_agent = TRUE';
          break;
        case 'DISABLE_AGENT':
          updateClause = 'available_for_agent = FALSE';
          break;
        case 'ENABLE_STORE':
          updateClause = 'available_for_store = TRUE';
          break;
        case 'DISABLE_STORE':
          updateClause = 'available_for_store = FALSE';
          break;
        case 'ENABLE_API':
          updateClause = 'available_for_api = TRUE';
          break;
        case 'DISABLE_API':
          updateClause = 'available_for_api = FALSE';
          break;
        default:
          throw new BadRequestError(`Unsupported bulk action '${action}'.`);
      }

      const query = `
        UPDATE catalog_products
        SET ${updateClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
        RETURNING id
      `;

      const result = await db.query(query, [planIds]);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'BULK_PLAN_UPDATE',
          resourceType: 'catalog_products',
          resourceId: `${planIds.length}_plans`,
          metadata: { action, affectedCount: result.rowCount, planIds, reason },
        });
      }

      return reply.send({
        success: true,
        data: {
          affectedCount: result.rowCount,
        },
        message: `Successfully executed ${action} on ${result.rowCount} plans.`,
      });
    },
  );

  // 9. POST /admin/catalog/plans/bulk-pricing/preview — Price Formula Preview & Impact Analysis
  app.post<{ Body: BulkPricingPreviewRequest }>(
    '/admin/catalog/plans/bulk-pricing/preview',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        network,
        planIds,
        customerMarkupPercent,
        agentMarkupPercent,
        storeMarkupPercent,
        customerMarkupPesewas,
        agentMarkupPesewas,
        storeMarkupPesewas,
      } = req.body || {};

      let whereClause = "WHERE status = 'ACTIVE'";
      const params: any[] = [];
      let idx = 1;

      if (network && network !== 'ALL') {
        whereClause += ` AND network = $${idx++}`;
        params.push(network);
      }

      if (planIds && planIds.length > 0) {
        whereClause += ` AND id = ANY($${idx++})`;
        params.push(planIds);
      }

      const sql = `
        SELECT id, name, network, data_amount_mb, provider_price_pesewas,
               base_price_pesewas, agent_price_pesewas, store_price_pesewas
        FROM catalog_products
        ${whereClause}
        ORDER BY network ASC, data_amount_mb ASC
      `;

      const result = await db.query(sql, params);

      let totalDailyRevenueDiffPesewas = 0;
      const plans = result.rows.map((r) => {
        const curProvider = parseInt(r.provider_price_pesewas || '0', 10);
        const curBase = parseInt(r.base_price_pesewas, 10);
        const curAgent = r.agent_price_pesewas ? parseInt(r.agent_price_pesewas, 10) : null;
        const curStore = r.store_price_pesewas ? parseInt(r.store_price_pesewas, 10) : null;

        let newBase = curBase;
        if (customerMarkupPercent !== undefined && customerMarkupPercent !== null) {
          newBase = Math.round(curBase * (1 + customerMarkupPercent / 100));
        } else if (customerMarkupPesewas !== undefined && customerMarkupPesewas !== null) {
          newBase = curBase + customerMarkupPesewas;
        }

        let newAgent = curAgent;
        if (curAgent !== null) {
          if (agentMarkupPercent !== undefined && agentMarkupPercent !== null) {
            newAgent = Math.round(curAgent * (1 + agentMarkupPercent / 100));
          } else if (agentMarkupPesewas !== undefined && agentMarkupPesewas !== null) {
            newAgent = curAgent + agentMarkupPesewas;
          }
        }

        let newStore = curStore;
        if (curStore !== null) {
          if (storeMarkupPercent !== undefined && storeMarkupPercent !== null) {
            newStore = Math.round(curStore * (1 + storeMarkupPercent / 100));
          } else if (storeMarkupPesewas !== undefined && storeMarkupPesewas !== null) {
            newStore = curStore + storeMarkupPesewas;
          }
        }

        const diffPesewas = (newBase - curBase) * 5; // Estimated 5 orders/day avg
        totalDailyRevenueDiffPesewas += diffPesewas;

        return {
          id: r.id,
          name: r.name,
          network: r.network as NetworkProvider,
          dataAmountMb: parseInt(r.data_amount_mb, 10),
          currentProviderPricePesewas: curProvider,
          currentBasePricePesewas: curBase,
          newBasePricePesewas: newBase,
          currentAgentPricePesewas: curAgent,
          newAgentPricePesewas: newAgent,
          currentStorePricePesewas: curStore,
          newStorePricePesewas: newStore,
          estimatedDailyRevenueDiffPesewas: diffPesewas,
        };
      });

      const response: BulkPricingPreviewResponse = {
        affectedPlansCount: plans.length,
        totalDailyRevenueDiffPesewas,
        plans,
      };

      return reply.send({
        success: true,
        data: response,
      });
    },
  );

  // 10. POST /admin/catalog/plans/bulk-pricing/apply — Execute Bulk Price Updates
  app.post<{ Body: BulkPricingApplyRequest }>(
    '/admin/catalog/plans/bulk-pricing/apply',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { reason, ...previewInput } = req.body || {};

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError('A mandatory reason of at least 5 characters is required for bulk price updates.');
      }

      // 1. Calculate impacted plans
      let whereClause = "WHERE status = 'ACTIVE'";
      const params: any[] = [];
      let idx = 1;

      if (previewInput.network && previewInput.network !== 'ALL') {
        whereClause += ` AND network = $${idx++}`;
        params.push(previewInput.network);
      }

      if (previewInput.planIds && previewInput.planIds.length > 0) {
        whereClause += ` AND id = ANY($${idx++})`;
        params.push(previewInput.planIds);
      }

      const sql = `
        SELECT id, name, network, data_amount_mb, provider_price_pesewas,
               base_price_pesewas, agent_price_pesewas, store_price_pesewas
        FROM catalog_products
        ${whereClause}
      `;

      const result = await db.query(sql, params);
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        let updatedCount = 0;
        for (const r of result.rows) {
          const curProvider = parseInt(r.provider_price_pesewas || '0', 10);
          const curBase = parseInt(r.base_price_pesewas, 10);
          const curAgent = r.agent_price_pesewas ? parseInt(r.agent_price_pesewas, 10) : null;
          const curStore = r.store_price_pesewas ? parseInt(r.store_price_pesewas, 10) : null;

          let newBase = curBase;
          if (previewInput.customerMarkupPercent !== undefined && previewInput.customerMarkupPercent !== null) {
            newBase = Math.round(curBase * (1 + previewInput.customerMarkupPercent / 100));
          } else if (previewInput.customerMarkupPesewas !== undefined && previewInput.customerMarkupPesewas !== null) {
            newBase = curBase + previewInput.customerMarkupPesewas;
          }

          let newAgent = curAgent;
          if (curAgent !== null) {
            if (previewInput.agentMarkupPercent !== undefined && previewInput.agentMarkupPercent !== null) {
              newAgent = Math.round(curAgent * (1 + previewInput.agentMarkupPercent / 100));
            } else if (previewInput.agentMarkupPesewas !== undefined && previewInput.agentMarkupPesewas !== null) {
              newAgent = curAgent + previewInput.agentMarkupPesewas;
            }
          }

          let newStore = curStore;
          if (curStore !== null) {
            if (previewInput.storeMarkupPercent !== undefined && previewInput.storeMarkupPercent !== null) {
              newStore = Math.round(curStore * (1 + previewInput.storeMarkupPercent / 100));
            } else if (previewInput.storeMarkupPesewas !== undefined && previewInput.storeMarkupPesewas !== null) {
              newStore = curStore + previewInput.storeMarkupPesewas;
            }
          }

          await client.query(
            `UPDATE catalog_products
             SET base_price_pesewas = $1,
                 agent_price_pesewas = $2,
                 store_price_pesewas = $3,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [newBase, newAgent, newStore, r.id],
          );

          await client.query(
            `INSERT INTO catalog_price_history (
              product_id, changed_by, change_type,
              previous_provider_price_pesewas, new_provider_price_pesewas,
              previous_base_price_pesewas, new_base_price_pesewas,
              previous_agent_price_pesewas, new_agent_price_pesewas,
              previous_store_price_pesewas, new_store_price_pesewas,
              reason
            ) VALUES ($1, $2, 'BULK_UPDATE', $3, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              r.id,
              req.user?.sub || null,
              curProvider,
              curBase,
              newBase,
              curAgent,
              newAgent,
              curStore,
              newStore,
              reason,
            ],
          );

          updatedCount++;
        }

        await client.query('COMMIT');

        if (auditService) {
          await auditService.log({
            correlationId: req.id,
            actorId: req.user!.sub,
            actorType: 'ADMIN',
            action: 'BULK_PLAN_UPDATE',
            resourceType: 'catalog_products',
            resourceId: `${updatedCount}_plans`,
            metadata: { type: 'BULK_PRICING', updatedCount, reason, previewInput },
          });
        }

        return reply.send({
          success: true,
          data: {
            updatedCount,
          },
          message: `Successfully applied bulk pricing to ${updatedCount} plans.`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // 11. POST /admin/catalog/sync — Trigger DataHouse Provider Catalog Sync
  app.post<{ Body: { autoApply?: boolean; network?: string } }>(
    '/admin/catalog/sync',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { autoApply = false, network } = req.body || {};

      // 1. Fetch provider bundles via telecomProvider
      let providerBundles: DataHouseBundleDto[] = [];
      try {
        if ((telecomProvider as any).getBundles) {
          providerBundles = await (telecomProvider as any).getBundles({ network });
        } else {
          // Fallback probe from active provider
          providerBundles = [];
        }
      } catch (err: any) {
        return reply.status(502).send({
          success: false,
          error: {
            code: 'PROVIDER_SYNC_FAILED',
            message: `Failed to fetch provider catalog from DataHouse: ${err.message}`,
          },
        });
      }

      // 2. Fetch existing catalog products
      const localPlansRes = await db.query('SELECT * FROM catalog_products');
      const localPlans = localPlansRes.rows;

      // 3. Diff and detect discrepancies
      let matchedPlans = 0;
      let newPlansCount = 0;
      let changedPlansCount = 0;
      let removedPlansCount = 0;

      const diffItems: Array<{
        catalogProductId: string | null;
        providerPlanId: string;
        changeType: CatalogSyncChangeType;
        network: string;
        planName: string;
        dataAmountMb: number;
        currentProviderPricePesewas: number | null;
        newProviderPricePesewas: number;
        currentCustomerPricePesewas: number | null;
        proposedCustomerPricePesewas: number | null;
      }> = [];

      for (const pBundle of providerBundles) {
        const localMatch = localPlans.find(
          (lp) =>
            lp.provider_plan_id === pBundle.id ||
            (lp.network === pBundle.network && lp.data_amount_mb === pBundle.dataAmountMb),
        );

        if (!localMatch) {
          newPlansCount++;
          const proposedCustomerPrice = Math.round(pBundle.pricePesewas * 1.35); // 35% margin default
          diffItems.push({
            catalogProductId: null,
            providerPlanId: pBundle.id,
            changeType: CatalogSyncChangeType.NEW_PLAN,
            network: pBundle.network,
            planName: pBundle.name,
            dataAmountMb: pBundle.dataAmountMb,
            currentProviderPricePesewas: null,
            newProviderPricePesewas: pBundle.pricePesewas,
            currentCustomerPricePesewas: null,
            proposedCustomerPricePesewas: proposedCustomerPrice,
          });
        } else {
          matchedPlans++;
          const curProvPrice = parseInt(localMatch.provider_price_pesewas || '0', 10);
          const curBasePrice = parseInt(localMatch.base_price_pesewas, 10);

          if (curProvPrice !== pBundle.pricePesewas) {
            changedPlansCount++;
            diffItems.push({
              catalogProductId: localMatch.id,
              providerPlanId: pBundle.id,
              changeType: CatalogSyncChangeType.PRICE_CHANGE,
              network: pBundle.network,
              planName: pBundle.name,
              dataAmountMb: pBundle.dataAmountMb,
              currentProviderPricePesewas: curProvPrice,
              newProviderPricePesewas: pBundle.pricePesewas,
              currentCustomerPricePesewas: curBasePrice,
              proposedCustomerPricePesewas: Math.round(pBundle.pricePesewas * 1.35),
            });
          }
        }
      }

      // Check for removed plans (in local but missing in provider payload)
      if (providerBundles.length > 0) {
        for (const lp of localPlans) {
          if (lp.provider_plan_id && !providerBundles.some((pb) => pb.id === lp.provider_plan_id)) {
            removedPlansCount++;
            diffItems.push({
              catalogProductId: lp.id,
              providerPlanId: lp.provider_plan_id,
              changeType: CatalogSyncChangeType.REMOVED_PLAN,
              network: lp.network,
              planName: lp.name,
              dataAmountMb: parseInt(lp.data_amount_mb, 10),
              currentProviderPricePesewas: parseInt(lp.provider_price_pesewas || '0', 10),
              newProviderPricePesewas: 0,
              currentCustomerPricePesewas: parseInt(lp.base_price_pesewas, 10),
              proposedCustomerPricePesewas: null,
            });
          }
        }
      }

      const discrepancyCount = newPlansCount + changedPlansCount + removedPlansCount;

      // 4. Record batch in database
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const batchRes = await client.query(
          `INSERT INTO provider_catalog_sync_batches (
            provider_name, initiated_by, total_provider_plans, matched_plans,
            new_plans_count, changed_plans_count, removed_plans_count,
            discrepancy_count, status, applied_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            'DataHouse',
            req.user?.sub || null,
            providerBundles.length,
            matchedPlans,
            newPlansCount,
            changedPlansCount,
            removedPlansCount,
            discrepancyCount,
            autoApply ? 'APPLIED' : (discrepancyCount > 0 ? 'PENDING_REVIEW' : 'APPLIED'),
            autoApply || discrepancyCount === 0 ? new Date() : null,
          ],
        );

        const batch = batchRes.rows[0];

        for (const item of diffItems) {
          await client.query(
            `INSERT INTO provider_catalog_sync_items (
              batch_id, catalog_product_id, provider_plan_id, change_type,
              network, plan_name, data_amount_mb, current_provider_price_pesewas,
              new_provider_price_pesewas, current_customer_price_pesewas,
              proposed_customer_price_pesewas, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              batch.id,
              item.catalogProductId,
              item.providerPlanId,
              item.changeType,
              item.network,
              item.planName,
              item.dataAmountMb,
              item.currentProviderPricePesewas,
              item.newProviderPricePesewas,
              item.currentCustomerPricePesewas,
              item.proposedCustomerPricePesewas,
              autoApply ? 'ACCEPTED' : 'PENDING',
            ],
          );
        }

        // If autoApply or no discrepancies, update catalog provider status & last_synced_at
        await client.query(
          `UPDATE catalog_products
           SET last_synced_at = CURRENT_TIMESTAMP,
               provider_status = 'AVAILABLE',
               sync_error = NULL
           WHERE provider_name = 'DataHouse'`,
        );

        await client.query('COMMIT');

        if (auditService) {
          await auditService.log({
            correlationId: req.id,
            actorId: req.user!.sub,
            actorType: 'ADMIN',
            action: 'PLAN_SYNC_COMPLETED',
            resourceType: 'provider_catalog_sync_batches',
            resourceId: batch.id,
            metadata: {
              totalProviderPlans: providerBundles.length,
              matchedPlans,
              newPlansCount,
              changedPlansCount,
              removedPlansCount,
              discrepancyCount,
              autoApply,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            batchId: batch.id,
            totalProviderPlans: providerBundles.length,
            matchedPlans,
            newPlansCount,
            changedPlansCount,
            removedPlansCount,
            discrepancyCount,
            status: batch.status,
            items: diffItems,
          },
          message: `Provider synchronization complete. ${discrepancyCount} discrepancies detected across ${providerBundles.length} provider plans.`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // 12. GET /admin/catalog/sync/batches — List Sync Batches
  app.get(
    '/admin/catalog/sync/batches',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const res = await db.query(
        `SELECT b.*, u.full_name as "initiatedByName"
         FROM provider_catalog_sync_batches b
         LEFT JOIN users u ON b.initiated_by = u.id
         ORDER BY b.created_at DESC
         LIMIT 20`,
      ).catch(() => ({ rows: [] }));

      const batches = res.rows.map((r: any) => ({
        id: r.id,
        providerName: r.provider_name,
        initiatedBy: r.initiated_by,
        initiatedByName: r.initiatedByName || 'System',
        totalProviderPlans: parseInt(r.total_provider_plans || '0', 10),
        matchedPlans: parseInt(r.matched_plans || '0', 10),
        newPlansCount: parseInt(r.new_plans_count || '0', 10),
        changedPlansCount: parseInt(r.changed_plans_count || '0', 10),
        removedPlansCount: parseInt(r.removed_plans_count || '0', 10),
        discrepancyCount: parseInt(r.discrepancy_count || '0', 10),
        status: r.status as CatalogSyncBatchStatus,
        appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return reply.send({
        success: true,
        data: batches,
      });
    },
  );

  // 13. GET /admin/catalog/sync/batches/:id — Sync Batch Detail & Diffs
  app.get<{ Params: { id: string } }>(
    '/admin/catalog/sync/batches/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const batchRes = await db.query(
        'SELECT * FROM provider_catalog_sync_batches WHERE id = $1',
        [id],
      );

      if (batchRes.rows.length === 0) {
        throw new NotFoundError(`Sync batch '${id}' not found.`);
      }

      const batch = batchRes.rows[0];
      const itemsRes = await db.query(
        'SELECT * FROM provider_catalog_sync_items WHERE batch_id = $1 ORDER BY created_at ASC',
        [id],
      );

      const items = itemsRes.rows.map((r: any) => ({
        id: r.id,
        batchId: r.batch_id,
        catalogProductId: r.catalog_product_id,
        providerPlanId: r.provider_plan_id,
        changeType: r.change_type as CatalogSyncChangeType,
        network: r.network,
        planName: r.plan_name,
        dataAmountMb: parseInt(r.data_amount_mb, 10),
        currentProviderPricePesewas: r.current_provider_price_pesewas ? parseInt(r.current_provider_price_pesewas, 10) : null,
        newProviderPricePesewas: parseInt(r.new_provider_price_pesewas, 10),
        currentCustomerPricePesewas: r.current_customer_price_pesewas ? parseInt(r.current_customer_price_pesewas, 10) : null,
        proposedCustomerPricePesewas: r.proposed_customer_price_pesewas ? parseInt(r.proposed_customer_price_pesewas, 10) : null,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return reply.send({
        success: true,
        data: {
          id: batch.id,
          providerName: batch.provider_name,
          initiatedBy: batch.initiated_by,
          totalProviderPlans: parseInt(batch.total_provider_plans || '0', 10),
          matchedPlans: parseInt(batch.matched_plans || '0', 10),
          newPlansCount: parseInt(batch.new_plans_count || '0', 10),
          changedPlansCount: parseInt(batch.changed_plans_count || '0', 10),
          removedPlansCount: parseInt(batch.removed_plans_count || '0', 10),
          discrepancyCount: parseInt(batch.discrepancy_count || '0', 10),
          status: batch.status,
          appliedAt: batch.applied_at ? new Date(batch.applied_at).toISOString() : null,
          createdAt: new Date(batch.created_at).toISOString(),
          items,
        },
      });
    },
  );

  // 14. POST /admin/catalog/sync/batches/:id/apply — Accept and Apply Sync Diff
  app.post<{ Params: { id: string }; Body: { itemIds?: string[] } }>(
    '/admin/catalog/sync/batches/:id/apply',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { itemIds } = req.body || {};

      if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Only Administrators can apply provider catalog sync updates.');
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        let itemFilter = 'WHERE batch_id = $1';
        const params: any[] = [id];
        if (itemIds && itemIds.length > 0) {
          itemFilter += ' AND id = ANY($2)';
          params.push(itemIds);
        }

        const itemsRes = await client.query(`SELECT * FROM provider_catalog_sync_items ${itemFilter}`, params);
        let appliedCount = 0;

        for (const item of itemsRes.rows) {
          if (item.change_type === CatalogSyncChangeType.PRICE_CHANGE && item.catalog_product_id) {
            await client.query(
              `UPDATE catalog_products
               SET provider_price_pesewas = $1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [item.new_provider_price_pesewas, item.catalog_product_id],
            );
          } else if (item.change_type === CatalogSyncChangeType.NEW_PLAN) {
            const sku = `${item.network.toUpperCase()}-${item.data_amount_mb}MB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            await client.query(
              `INSERT INTO catalog_products (
                sku, network, name, data_amount_mb, validity_days, validity_desc,
                provider_price_pesewas, base_price_pesewas, agent_price_pesewas,
                provider_name, provider_plan_id, is_active, status, provider_status
              ) VALUES ($1, $2, $3, $4, 30, 'Non-Expiry', $5, $6, $7, 'DataHouse', $8, TRUE, 'ACTIVE', 'AVAILABLE')
              ON CONFLICT (sku) DO NOTHING`,
              [
                sku,
                item.network,
                item.plan_name,
                item.data_amount_mb,
                item.new_provider_price_pesewas,
                item.proposed_customer_price_pesewas || Math.round(item.new_provider_price_pesewas * 1.35),
                Math.round(item.new_provider_price_pesewas * 1.15),
                item.provider_plan_id,
              ],
            );
          } else if (item.change_type === CatalogSyncChangeType.REMOVED_PLAN && item.catalog_product_id) {
            await client.query(
              `UPDATE catalog_products
               SET provider_status = 'PROVIDER_REMOVED',
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [item.catalog_product_id],
            );
          }

          await client.query(
            `UPDATE provider_catalog_sync_items
             SET status = 'ACCEPTED', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [req.user?.sub || null, item.id],
          );
          appliedCount++;
        }

        await client.query(
          `UPDATE provider_catalog_sync_batches
           SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id],
        );

        await client.query('COMMIT');

        if (auditService) {
          await auditService.log({
            correlationId: req.id,
            actorId: req.user!.sub,
            actorType: 'ADMIN',
            action: 'PLAN_SYNC_COMPLETED',
            resourceType: 'provider_catalog_sync_batches',
            resourceId: id,
            metadata: { appliedCount, itemIds },
          });
        }

        return reply.send({
          success: true,
          data: { appliedCount },
          message: `Applied ${appliedCount} provider catalog projections to ByteBeacon.`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // 15. POST /admin/catalog/sync/batches/:id/reject — Reject Sync Diff
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/admin/catalog/sync/batches/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { reason } = req.body || {};

      await db.query(
        `UPDATE provider_catalog_sync_batches
         SET status = 'REJECTED'
         WHERE id = $1`,
        [id],
      );

      await db.query(
        `UPDATE provider_catalog_sync_items
         SET status = 'REJECTED', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
         WHERE batch_id = $2`,
        [req.user?.sub || null, id],
      );

      return reply.send({
        success: true,
        message: `Provider sync batch rejected. Reason: ${reason || 'Administrative rejection'}`,
      });
    },
  );

  // 16. GET /admin/catalog/plans/:id/orders — Paginated Historical Orders for Plan
  app.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>(
    '/admin/catalog/plans/:id/orders',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { page = '1', limit = '20' } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const countRes = await db.query('SELECT COUNT(*) as total FROM orders WHERE product_id = $1', [id]);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listRes = await db.query(
        `SELECT o.id, o.public_id as "publicId", o.recipient_phone as "recipientPhone",
                o.amount_pesewas as "amountPesewas", o.payment_status as "paymentStatus",
                o.order_status as "orderStatus", o.provider_status as "providerStatus",
                o.created_at as "createdAt", u.email as "customerEmail", u.full_name as "customerName"
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.product_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limitNum, offset],
      );

      return reply.send({
        success: true,
        data: {
          items: listRes.rows.map((r) => ({
            id: r.id,
            publicId: r.publicId,
            customerEmail: r.customerEmail || 'Guest',
            customerName: r.customerName || 'Customer',
            recipientPhone: r.recipientPhone,
            amountPesewas: parseInt(r.amountPesewas, 10),
            paymentStatus: r.paymentStatus,
            orderStatus: r.orderStatus,
            providerStatus: r.providerStatus,
            createdAt: new Date(r.createdAt).toISOString(),
          })),
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

  // 17. GET /admin/catalog/plans/:id/price-history — Price History Trail
  app.get<{ Params: { id: string } }>(
    '/admin/catalog/plans/:id/price-history',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const res = await db.query(
        `SELECT cph.*, u.full_name as "changedByName"
         FROM catalog_price_history cph
         LEFT JOIN users u ON cph.changed_by = u.id
         WHERE cph.product_id = $1
         ORDER BY cph.created_at DESC`,
        [id],
      );

      const items = res.rows.map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        changedBy: r.changed_by,
        changedByName: r.changedByName || 'System',
        changeType: r.change_type,
        previousProviderPricePesewas: r.previous_provider_price_pesewas ? parseInt(r.previous_provider_price_pesewas, 10) : null,
        newProviderPricePesewas: r.new_provider_price_pesewas ? parseInt(r.new_provider_price_pesewas, 10) : null,
        previousBasePricePesewas: r.previous_base_price_pesewas ? parseInt(r.previous_base_price_pesewas, 10) : null,
        newBasePricePesewas: r.new_base_price_pesewas ? parseInt(r.new_base_price_pesewas, 10) : null,
        previousAgentPricePesewas: r.previous_agent_price_pesewas ? parseInt(r.previous_agent_price_pesewas, 10) : null,
        newAgentPricePesewas: r.new_agent_price_pesewas ? parseInt(r.new_agent_price_pesewas, 10) : null,
        previousStorePricePesewas: r.previous_store_price_pesewas ? parseInt(r.previous_store_price_pesewas, 10) : null,
        newStorePricePesewas: r.new_store_price_pesewas ? parseInt(r.new_store_price_pesewas, 10) : null,
        reason: r.reason,
        metadata: r.metadata,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return reply.send({
        success: true,
        data: items,
      });
    },
  );

  // 18. POST /admin/catalog/export — Export Catalog in CSV or JSON
  app.post<{
    Body: {
      format: 'csv' | 'json';
      network?: string;
      status?: string;
    };
  }>(
    '/admin/catalog/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { format = 'csv', network, status } = req.body || {};

      let whereClause = '';
      const params: any[] = [];
      let idx = 1;

      if (network && network !== 'ALL') {
        whereClause += ` WHERE network = $${idx++}`;
        params.push(network);
      }

      if (status && status !== 'ALL') {
        whereClause += whereClause ? ` AND status = $${idx++}` : ` WHERE status = $${idx++}`;
        params.push(status);
      }

      const res = await db.query(
        `SELECT id, sku, network, name, data_amount_mb, validity_desc,
                provider_price_pesewas, base_price_pesewas, agent_price_pesewas,
                store_price_pesewas, status, provider_status, provider_name,
                available_for_customer, available_for_agent, available_for_store,
                available_for_api, created_at, updated_at
         FROM catalog_products
         ${whereClause}
         ORDER BY network ASC, data_amount_mb ASC`,
        params,
      );

      const items = res.rows.map(mapCatalogRow);

      if (format === 'json') {
        return reply
          .header('Content-Disposition', 'attachment; filename="bytebeacon-catalog.json"')
          .type('application/json')
          .send(items);
      }

      // CSV export
      const headers = [
        'ID', 'SKU', 'Network', 'Name', 'Data (MB)', 'Validity',
        'Provider Price (GHS)', 'Customer Price (GHS)', 'Agent Price (GHS)', 'Store Price (GHS)',
        'Customer Margin (GHS)', 'Customer Margin (%)', 'Status', 'Provider Status',
        'Customer Channel', 'Agent Channel', 'Store Channel', 'API Channel', 'Created At'
      ];

      const csvRows = [
        headers.join(','),
        ...items.map((p) => [
          `"${p.id}"`,
          `"${p.sku}"`,
          `"${p.network}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          p.dataAmountMb,
          `"${p.validityDesc}"`,
          (p.providerPricePesewas / 100).toFixed(2),
          (p.basePricePesewas / 100).toFixed(2),
          p.agentPricePesewas ? (p.agentPricePesewas / 100).toFixed(2) : 'N/A',
          p.storePricePesewas ? (p.storePricePesewas / 100).toFixed(2) : 'N/A',
          (p.customerMarginPesewas / 100).toFixed(2),
          `${p.customerMarginPct}%`,
          `"${p.status}"`,
          `"${p.providerStatus}"`,
          p.availableForCustomer ? 'YES' : 'NO',
          p.availableForAgent ? 'YES' : 'NO',
          p.availableForStore ? 'YES' : 'NO',
          p.availableForApi ? 'YES' : 'NO',
          `"${p.createdAt}"`,
        ].join(',')),
      ].join('\n');

      return reply
        .header('Content-Disposition', 'attachment; filename="bytebeacon-catalog.csv"')
        .type('text/csv')
        .send(csvRows);
    },
  );
}
