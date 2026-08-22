import type pg from 'pg';
import {
  NetworkProvider,
  CatalogProductDto,
  CatalogPlanStatus,
  CatalogProviderStatus,
  CatalogPricingMode,
} from '@bytebeacon/shared';
import { NotFoundError } from '../errors/app-error.js';

export interface ListCatalogProductsOptions {
  network?: NetworkProvider;
  channel?: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API';
  status?: CatalogPlanStatus;
}

export class CatalogService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  private mapRowToDto(r: any): CatalogProductDto {
    return {
      id: r.id,
      sku: r.sku,
      network: r.network as NetworkProvider,
      name: r.name,
      dataAmountMb: parseInt(r.dataAmountMb || r.data_amount_mb || '1024', 10),
      validityDays: parseInt(r.validityDays || r.validity_days || '30', 10),
      validityDesc: r.validityDesc || r.validity_desc || `${r.validityDays || r.validity_days || 30} Days`,
      basePricePesewas: parseInt(r.basePricePesewas || r.base_price_pesewas || '0', 10),
      agentPricePesewas: r.agentPricePesewas || r.agent_price_pesewas ? parseInt(r.agentPricePesewas || r.agent_price_pesewas, 10) : null,
      agentMinPricePesewas: r.agentMinPricePesewas || r.agent_min_price_pesewas ? parseInt(r.agentMinPricePesewas || r.agent_min_price_pesewas, 10) : null,
      agentMaxPricePesewas: r.agentMaxPricePesewas || r.agent_max_price_pesewas ? parseInt(r.agentMaxPricePesewas || r.agent_max_price_pesewas, 10) : null,
      storePricePesewas: r.storePricePesewas || r.store_price_pesewas ? parseInt(r.storePricePesewas || r.store_price_pesewas, 10) : null,
      providerPricePesewas: r.providerPricePesewas || r.provider_price_pesewas ? parseInt(r.providerPricePesewas || r.provider_price_pesewas, 10) : 0,
      providerName: r.providerName || r.provider_name || 'DataHouse',
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

    if (typeof optionsOrNetwork === 'string') {
      network = optionsOrNetwork;
    } else if (optionsOrNetwork) {
      network = optionsOrNetwork.network;
      channel = optionsOrNetwork.channel;
      status = optionsOrNetwork.status;
    }

    let query = `
      SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
             validity_days as "validityDays",
             COALESCE(validity_desc, 'Non-Expiry') as "validityDesc",
             base_price_pesewas as "basePricePesewas",
             agent_price_pesewas as "agentPricePesewas",
             agent_min_price_pesewas as "agentMinPricePesewas",
             agent_max_price_pesewas as "agentMaxPricePesewas",
             store_price_pesewas as "storePricePesewas",
             COALESCE(provider_price_pesewas, 0) as "providerPricePesewas",
             COALESCE(provider_name, 'DataHouse') as "providerName",
             provider_plan_id as "providerPlanId",
             provider_plan_code as "providerPlanCode",
             provider_product_code as "providerProductCode",
             COALESCE(pricing_mode, 'FIXED') as "pricingMode",
             COALESCE(markup_value, 0) as "markupValue",
             description,
             COALESCE(category, 'DATA_BUNDLE') as "category",
             COALESCE(status, CASE WHEN is_active THEN 'ACTIVE' ELSE 'DISABLED' END) as "status",
             COALESCE(provider_status, 'AVAILABLE') as "providerStatus",
             COALESCE(available_for_customer, TRUE) as "availableForCustomer",
             COALESCE(available_for_agent, TRUE) as "availableForAgent",
             COALESCE(available_for_store, TRUE) as "availableForStore",
             COALESCE(available_for_api, TRUE) as "availableForApi",
             COALESCE(version, 1) as "version",
             last_synced_at as "lastSyncedAt",
             sync_error as "syncError",
             COALESCE(popular, FALSE) as "popular",
             is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM catalog_products
      WHERE is_active = TRUE
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    } else {
      query += ` AND (status IS NULL OR status = 'ACTIVE')`;
    }

    if (network && network !== ('ALL' as any)) {
      query += ` AND network = $${paramIdx++}`;
      params.push(network);
    }

    if (channel === 'CUSTOMER') {
      query += ' AND (available_for_customer IS NULL OR available_for_customer = TRUE)';
    } else if (channel === 'AGENT') {
      query += ' AND (available_for_agent IS NULL OR available_for_agent = TRUE)';
    } else if (channel === 'STORE') {
      query += ' AND (available_for_store IS NULL OR available_for_store = TRUE)';
    } else if (channel === 'API') {
      query += ' AND (available_for_api IS NULL OR available_for_api = TRUE)';
    }

    query += ' ORDER BY network ASC, data_amount_mb ASC';

    const result = await this.db.query(query, params);
    return result.rows.map((r) => this.mapRowToDto(r));
  }

  public async getProductById(productId: string): Promise<CatalogProductDto> {
    const query = `
      SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
             validity_days as "validityDays",
             COALESCE(validity_desc, 'Non-Expiry') as "validityDesc",
             base_price_pesewas as "basePricePesewas",
             agent_price_pesewas as "agentPricePesewas",
             agent_min_price_pesewas as "agentMinPricePesewas",
             agent_max_price_pesewas as "agentMaxPricePesewas",
             store_price_pesewas as "storePricePesewas",
             COALESCE(provider_price_pesewas, 0) as "providerPricePesewas",
             COALESCE(provider_name, 'DataHouse') as "providerName",
             provider_plan_id as "providerPlanId",
             provider_plan_code as "providerPlanCode",
             provider_product_code as "providerProductCode",
             COALESCE(pricing_mode, 'FIXED') as "pricingMode",
             COALESCE(markup_value, 0) as "markupValue",
             description,
             COALESCE(category, 'DATA_BUNDLE') as "category",
             COALESCE(status, CASE WHEN is_active THEN 'ACTIVE' ELSE 'DISABLED' END) as "status",
             COALESCE(provider_status, 'AVAILABLE') as "providerStatus",
             COALESCE(available_for_customer, TRUE) as "availableForCustomer",
             COALESCE(available_for_agent, TRUE) as "availableForAgent",
             COALESCE(available_for_store, TRUE) as "availableForStore",
             COALESCE(available_for_api, TRUE) as "availableForApi",
             COALESCE(version, 1) as "version",
             last_synced_at as "lastSyncedAt",
             sync_error as "syncError",
             COALESCE(popular, FALSE) as "popular",
             is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM catalog_products
      WHERE id = $1 AND is_active = TRUE
    `;

    const result = await this.db.query(query, [productId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Product '${productId}' not found or inactive in catalog`);
    }

    return this.mapRowToDto(result.rows[0]);
  }
}
