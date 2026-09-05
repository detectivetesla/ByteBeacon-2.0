import type pg from 'pg';
import {
  NetworkProvider,
  CatalogProductDto,
  CatalogPlanStatus,
  CatalogProviderStatus,
  CatalogPricingMode,
} from '@bytebeacon/shared';
import { BundleNotFoundError, BundleInactiveError } from '../errors/app-error.js';

export interface ListCatalogProductsOptions {
  network?: NetworkProvider;
  channel?: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API';
  status?: CatalogPlanStatus;
  userId?: string;
  role?: string;
}

export class CatalogService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  private mapRowToDto(r: any, options?: { channel?: string; role?: string }): CatalogProductDto {
    let basePrice = parseInt(r.basePricePesewas || r.base_price_pesewas || '0', 10);
    let agentPrice = r.agentPricePesewas || r.agent_price_pesewas ? parseInt(r.agentPricePesewas || r.agent_price_pesewas, 10) : null;

    const userCustomPrice = r.userCustomPricePesewas !== undefined && r.userCustomPricePesewas !== null
      ? parseInt(r.userCustomPricePesewas, 10)
      : null;
    const agentCustomPrice = r.agentCustomPricePesewas !== undefined && r.agentCustomPricePesewas !== null
      ? parseInt(r.agentCustomPricePesewas, 10)
      : null;

    const customPrice = userCustomPrice ?? agentCustomPrice ?? null;
    const isAgent = options?.channel === 'AGENT' || options?.role === 'agent';

    let effectivePrice = basePrice;
    if (customPrice !== null && customPrice > 0) {
      effectivePrice = customPrice;
      basePrice = customPrice;
      if (isAgent) {
        agentPrice = customPrice;
      }
    } else if (isAgent && agentPrice !== null) {
      effectivePrice = agentPrice;
    }

    return {
      id: r.id,
      sku: r.sku,
      network: r.network as NetworkProvider,
      name: r.name,
      dataAmountMb: parseInt(r.dataAmountMb || r.data_amount_mb || '1024', 10),
      validityDays: parseInt(r.validityDays || r.validity_days || '30', 10),
      validityDesc: r.validityDesc || r.validity_desc || `${r.validityDays || r.validity_days || 30} Days`,
      basePricePesewas: basePrice,
      agentPricePesewas: agentPrice,
      customPricePesewas: customPrice,
      effectivePricePesewas: effectivePrice,
      agentMinPricePesewas: r.agentMinPricePesewas || r.agent_min_price_pesewas ? parseInt(r.agentMinPricePesewas || r.agent_min_price_pesewas, 10) : null,
      agentMaxPricePesewas: r.agentMaxPricePesewas || r.agent_max_price_pesewas ? parseInt(r.agentMaxPricePesewas || r.agent_max_price_pesewas, 10) : null,
      storePricePesewas: r.storePricePesewas || r.store_price_pesewas ? parseInt(r.storePricePesewas || r.store_price_pesewas, 10) : null,
      providerPricePesewas: r.providerPricePesewas || r.provider_price_pesewas ? parseInt(r.providerPricePesewas || r.provider_price_pesewas, 10) : 0,
      providerName: r.providerName || r.provider_name || 'Portal-02',
      providerPlanId: r.providerPlanId || r.provider_plan_id || null,
      providerPlanCode: r.providerPlanCode || r.provider_plan_code || null,
      providerProductCode: r.providerProductCode || r.provider_product_code || null,
      pricingMode: (r.pricingMode || r.pricing_mode as CatalogPricingMode) || CatalogPricingMode.FIXED,
      markupValue: r.markupValue || r.markup_value ? parseFloat(r.markupValue || r.markup_value) : 0,
      description: r.description || null,
      category: r.category || 'DATA_BUNDLE',
      status: (r.status as CatalogPlanStatus) || (r.isActive ?? r.is_active ? CatalogPlanStatus.ACTIVE : CatalogPlanStatus.DISABLED),
      providerStatus: (r.providerStatus || r.provider_status as CatalogProviderStatus) || CatalogProviderStatus.AVAILABLE,
      availableForCustomer: r.availableForCustomer !== undefined ? Boolean(r.availableForCustomer) : (r.available_for_customer !== undefined ? Boolean(r.available_for_customer) : true),
      availableForAgent: r.availableForAgent !== undefined ? Boolean(r.availableForAgent) : (r.available_for_agent !== undefined ? Boolean(r.available_for_agent) : true),
      availableForStore: r.availableForStore !== undefined ? Boolean(r.availableForStore) : (r.available_for_store !== undefined ? Boolean(r.available_for_store) : true),
      availableForApi: r.availableForApi !== undefined ? Boolean(r.availableForApi) : (r.available_for_api !== undefined ? Boolean(r.available_for_api) : true),
      version: r.version ? parseInt(r.version, 10) : 1,
      lastSyncedAt: r.lastSyncedAt || r.last_synced_at ? new Date(r.lastSyncedAt || r.last_synced_at).toISOString() : null,
      syncError: r.syncError || r.sync_error || null,
      popular: Boolean(r.popular),
      isActive: Boolean(r.isActive ?? r.is_active),
      createdAt: r.createdAt || r.created_at ? new Date(r.createdAt || r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt || r.updated_at ? new Date(r.updatedAt || r.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  public async listActiveProducts(optionsOrNetwork?: NetworkProvider | ListCatalogProductsOptions): Promise<CatalogProductDto[]> {
    let network: NetworkProvider | undefined;
    let channel: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' | undefined;
    let status: CatalogPlanStatus | undefined;
    let userId: string | undefined;
    let role: string | undefined;

    if (typeof optionsOrNetwork === 'string') {
      network = optionsOrNetwork;
    } else if (optionsOrNetwork) {
      network = optionsOrNetwork.network;
      channel = optionsOrNetwork.channel;
      status = optionsOrNetwork.status;
      userId = optionsOrNetwork.userId;
      role = optionsOrNetwork.role;
    }

    const params: unknown[] = [];
    let paramIdx = 1;

    let userPricingJoin = '';
    let agentPricingJoin = '';
    let customPriceCols = 'NULL as "userCustomPricePesewas", NULL as "agentCustomPricePesewas"';

    if (userId) {
      userPricingJoin = `LEFT JOIN user_pricing up ON up.product_id = cp.id AND up.user_id = $${paramIdx} AND up.is_active = TRUE`;
      agentPricingJoin = `LEFT JOIN agent_pricing ap ON ap.product_id = cp.id AND (ap.agent_id = $${paramIdx} OR ap.agent_id IN (SELECT a.id FROM agents a WHERE a.user_id = $${paramIdx})) AND ap.is_active = TRUE`;
      customPriceCols = 'up.custom_price_pesewas as "userCustomPricePesewas", ap.custom_price_pesewas as "agentCustomPricePesewas"';
      params.push(userId);
      paramIdx++;
    }

    let query = `
      SELECT cp.id, cp.sku, cp.network, cp.name, cp.data_amount_mb as "dataAmountMb",
             cp.validity_days as "validityDays",
             COALESCE(cp.validity_desc, 'Non-Expiry') as "validityDesc",
             cp.base_price_pesewas as "basePricePesewas",
             cp.agent_price_pesewas as "agentPricePesewas",
             cp.agent_min_price_pesewas as "agentMinPricePesewas",
             cp.agent_max_price_pesewas as "agentMaxPricePesewas",
             cp.store_price_pesewas as "storePricePesewas",
             COALESCE(cp.provider_price_pesewas, 0) as "providerPricePesewas",
             COALESCE(cp.provider_name, 'Portal-02') as "providerName",
             cp.provider_plan_id as "providerPlanId",
             cp.provider_plan_code as "providerPlanCode",
             cp.provider_product_code as "providerProductCode",
             COALESCE(cp.pricing_mode, 'FIXED') as "pricingMode",
             COALESCE(cp.markup_value, 0) as "markupValue",
             cp.description,
             COALESCE(cp.category, 'DATA_BUNDLE') as "category",
             COALESCE(cp.status, CASE WHEN cp.is_active THEN 'ACTIVE' ELSE 'DISABLED' END) as "status",
             COALESCE(cp.provider_status, 'AVAILABLE') as "providerStatus",
             COALESCE(cp.available_for_customer, TRUE) as "availableForCustomer",
             COALESCE(cp.available_for_agent, TRUE) as "availableForAgent",
             COALESCE(cp.available_for_store, TRUE) as "availableForStore",
             COALESCE(cp.available_for_api, TRUE) as "availableForApi",
             COALESCE(cp.version, 1) as "version",
             cp.last_synced_at as "lastSyncedAt",
             cp.sync_error as "syncError",
             COALESCE(cp.popular, FALSE) as "popular",
             cp.is_active as "isActive",
             cp.created_at as "createdAt", cp.updated_at as "updatedAt",
             ${customPriceCols}
      FROM catalog_products cp
      ${userPricingJoin}
      ${agentPricingJoin}
      WHERE cp.is_active = TRUE
    `;

    if (status) {
      query += ` AND cp.status = $${paramIdx++}`;
      params.push(status);
    } else {
      query += ` AND (cp.status IS NULL OR cp.status = 'ACTIVE')`;
    }

    if (network && network !== ('ALL' as any)) {
      query += ` AND cp.network = $${paramIdx++}`;
      params.push(network);
    }

    if (channel === 'CUSTOMER') {
      query += ' AND (cp.available_for_customer IS NULL OR cp.available_for_customer = TRUE)';
    } else if (channel === 'AGENT') {
      query += ' AND (cp.available_for_agent IS NULL OR cp.available_for_agent = TRUE)';
    } else if (channel === 'STORE') {
      query += ' AND (cp.available_for_store IS NULL OR cp.available_for_store = TRUE)';
    } else if (channel === 'API') {
      query += ' AND (cp.available_for_api IS NULL OR cp.available_for_api = TRUE)';
    }

    query += ' ORDER BY cp.network ASC, cp.data_amount_mb ASC';

    try {
      const result = await this.db.query(query, params);
      return (result?.rows || []).map((r) => this.mapRowToDto(r, { channel, role }));
    } catch {
      // Fallback query if joins fail on un-migrated tables
      const fallbackQuery = `SELECT * FROM catalog_products WHERE is_active = TRUE ORDER BY network ASC, data_amount_mb ASC`;
      const fallbackRes = await this.db.query(fallbackQuery).catch(() => ({ rows: [] }));
      return (fallbackRes?.rows || []).map((r) => this.mapRowToDto(r, { channel, role }));
    }
  }

  public async getProductById(
    productId: string,
    options?: { userId?: string; role?: string; channel?: string },
  ): Promise<CatalogProductDto> {
    const params: unknown[] = [productId];
    let userPricingJoin = '';
    let agentPricingJoin = '';
    let customPriceCols = 'NULL as "userCustomPricePesewas", NULL as "agentCustomPricePesewas"';

    if (options?.userId) {
      userPricingJoin = `LEFT JOIN user_pricing up ON up.product_id = cp.id AND up.user_id = $2 AND up.is_active = TRUE`;
      agentPricingJoin = `LEFT JOIN agent_pricing ap ON ap.product_id = cp.id AND (ap.agent_id = $2 OR ap.agent_id IN (SELECT a.id FROM agents a WHERE a.user_id = $2)) AND ap.is_active = TRUE`;
      customPriceCols = 'up.custom_price_pesewas as "userCustomPricePesewas", ap.custom_price_pesewas as "agentCustomPricePesewas"';
      params.push(options.userId);
    }

    const query = `
      SELECT cp.id, cp.sku, cp.network, cp.name, cp.data_amount_mb as "dataAmountMb",
             cp.validity_days as "validityDays",
             COALESCE(cp.validity_desc, 'Non-Expiry') as "validityDesc",
             cp.base_price_pesewas as "basePricePesewas",
             cp.agent_price_pesewas as "agentPricePesewas",
             cp.agent_min_price_pesewas as "agentMinPricePesewas",
             cp.agent_max_price_pesewas as "agentMaxPricePesewas",
             cp.store_price_pesewas as "storePricePesewas",
             COALESCE(cp.provider_price_pesewas, 0) as "providerPricePesewas",
             COALESCE(cp.provider_name, 'Portal-02') as "providerName",
             cp.provider_plan_id as "providerPlanId",
             cp.provider_plan_code as "providerPlanCode",
             cp.provider_product_code as "providerProductCode",
             COALESCE(cp.pricing_mode, 'FIXED') as "pricingMode",
             COALESCE(cp.markup_value, 0) as "markupValue",
             cp.description,
             COALESCE(cp.category, 'DATA_BUNDLE') as "category",
             COALESCE(cp.status, CASE WHEN cp.is_active THEN 'ACTIVE' ELSE 'DISABLED' END) as "status",
             COALESCE(cp.provider_status, 'AVAILABLE') as "providerStatus",
             COALESCE(cp.available_for_customer, TRUE) as "availableForCustomer",
             COALESCE(cp.available_for_agent, TRUE) as "availableForAgent",
             COALESCE(cp.available_for_store, TRUE) as "availableForStore",
             COALESCE(cp.available_for_api, TRUE) as "availableForApi",
             COALESCE(cp.version, 1) as "version",
             cp.last_synced_at as "lastSyncedAt",
             cp.sync_error as "syncError",
             COALESCE(cp.popular, FALSE) as "popular",
             cp.is_active as "isActive",
             cp.created_at as "createdAt", cp.updated_at as "updatedAt",
             ${customPriceCols}
      FROM catalog_products cp
      ${userPricingJoin}
      ${agentPricingJoin}
      WHERE (cp.id::text = $1 OR cp.sku = $1 OR cp.provider_plan_id = $1 OR cp.provider_plan_code = $1 OR cp.provider_product_code = $1)
    `;

    const result = await this.db.query(query, params).catch(() => ({ rows: [] }));
    if (!result?.rows || result.rows.length === 0) {
      // Fallback query if joins failed on un-migrated tables
      const fallback = await this.db
        .query(
          `SELECT * FROM catalog_products WHERE (id::text = $1 OR sku = $1 OR provider_plan_id = $1 OR provider_plan_code = $1 OR provider_product_code = $1) LIMIT 1`,
          [productId],
        )
        .catch(() => ({ rows: [] }));

      if (!fallback?.rows || fallback.rows.length === 0) {
        throw new BundleNotFoundError(`Bundle '${productId}' not found in catalog`);
      }
      const raw = fallback.rows[0];
      if (raw.is_active === false || raw.status === 'DISABLED' || raw.status === 'INACTIVE') {
        throw new BundleInactiveError(`Requested bundle is currently inactive`);
      }
      return this.mapRowToDto(raw, options);
    }

    const row = result.rows[0];
    if (row.isActive === false || row.status === 'DISABLED' || row.status === 'INACTIVE') {
      throw new BundleInactiveError(`Requested bundle is currently inactive`);
    }

    return this.mapRowToDto(row, options);
  }
}
