import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminCatalogRoutes } from '../../src/routes/commerce/admin-catalog.routes.js';
import { catalogRoutes } from '../../src/routes/commerce/catalog.routes.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import {
  UserRole,
  SecurityDomain,
  NetworkProvider,
  CatalogPlanStatus,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.6: Data Plan & Catalog Management Control Plane', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockCatalogService: CatalogService;
  let mockTelecomProvider: ITelecomProvider;

  const mockPlanRow = {
    id: 'prod_101',
    sku: 'MTN-5GB-NE',
    network: 'MTN',
    name: '5GB Non-Expiry',
    data_amount_mb: 5120,
    validity_days: 30,
    validity_desc: 'Non-Expiry',
    provider_price_pesewas: '1750',
    base_price_pesewas: '2800',
    agent_price_pesewas: '1900',
    agent_min_price_pesewas: '1800',
    agent_max_price_pesewas: '2750',
    store_price_pesewas: '2200',
    provider_name: 'DataHouse',
    provider_plan_id: 'dh_mtn_5gb',
    provider_plan_code: null,
    provider_product_code: null,
    pricing_mode: 'FIXED',
    markup_value: '0',
    description: 'High speed MTN 5GB non-expiry bundle',
    category: 'DATA_BUNDLE',
    status: 'ACTIVE',
    provider_status: 'AVAILABLE',
    available_for_customer: true,
    available_for_agent: true,
    available_for_store: true,
    available_for_api: true,
    version: 1,
    last_synced_at: new Date().toISOString(),
    sync_error: null,
    popular: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
          });
        }

        if (sql.includes('COUNT(*) as "totalPlans"') && sql.includes('FROM catalog_products')) {
          return Promise.resolve({
            rows: [{
              totalPlans: '15',
              activePlans: '12',
              disabledPlans: '3',
              customerPlans: '12',
              agentPlans: '12',
              storePlans: '12',
              providerSynced: '14',
              syncIssues: '1',
            }],
          });
        }

        if (sql.includes('SELECT COUNT(*) as total FROM catalog_products')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        if (sql.includes('SELECT') && sql.includes('FROM catalog_products') && sql.includes('WHERE id = $1')) {
          return Promise.resolve({
            rows: [mockPlanRow],
          });
        }

        if (sql.includes('SELECT') && sql.includes('FROM catalog_products')) {
          return Promise.resolve({
            rows: [mockPlanRow],
          });
        }

        if (sql.includes('COUNT(*) as "lifetimeOrders"') && sql.includes('FROM orders')) {
          return Promise.resolve({
            rows: [{
              lifetimeOrders: '50',
              lifetimeRevenuePesewas: '140000',
              todayOrders: '4',
              todayRevenuePesewas: '11200',
              last7DaysOrders: '18',
              last7DaysRevenuePesewas: '50400',
              last30DaysOrders: '45',
              last30DaysRevenuePesewas: '126000',
              last90DaysOrders: '50',
              successfulOrders: '48',
              failedOrders: '1',
              refundedOrders: '1',
            }],
          });
        }

        if (sql.includes('FROM catalog_price_history')) {
          return Promise.resolve({
            rows: [{
              id: 'cph_1',
              product_id: 'prod_101',
              changed_by: 'usr_admin_1',
              changedByName: 'Super Admin',
              change_type: 'MANUAL_EDIT',
              previous_provider_price_pesewas: '1700',
              new_provider_price_pesewas: '1750',
              previous_base_price_pesewas: '2700',
              new_base_price_pesewas: '2800',
              reason: 'DataHouse cost adjustment',
              created_at: new Date().toISOString(),
            }],
          });
        }

        if (sql.includes('INSERT INTO catalog_products')) {
          return Promise.resolve({
            rows: [{ ...mockPlanRow, id: 'prod_new_1', name: params?.[2] || 'New Plan' }],
          });
        }

        if (sql.includes('UPDATE catalog_products')) {
          return Promise.resolve({
            rows: [{ ...mockPlanRow, ...params }],
            rowCount: 1,
          });
        }

        if (sql.includes('FROM provider_catalog_sync_batches')) {
          return Promise.resolve({
            rows: [{
              id: 'sync_batch_1',
              provider_name: 'DataHouse',
              initiated_by: 'usr_admin_1',
              total_provider_plans: '15',
              matched_plans: '14',
              new_plans_count: '1',
              changed_plans_count: '0',
              removed_plans_count: '0',
              discrepancy_count: '1',
              status: 'PENDING_REVIEW',
              created_at: new Date().toISOString(),
            }],
          });
        }

        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      connect: vi.fn().mockImplementation(() => ({
        query: vi.fn().mockImplementation((query: string) => {
          if (query.includes('INSERT INTO provider_catalog_sync_batches')) {
            return Promise.resolve({
              rows: [{ id: 'sync_batch_1', status: 'PENDING_REVIEW' }],
            });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        }),
        release: vi.fn(),
      })),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      authenticate: vi.fn().mockResolvedValue(null),
    } as unknown as ApiKeyService;

    mockRbacService = {
      validateRoleAccess: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockCatalogService = new CatalogService(mockDb);

    mockTelecomProvider = {
      providerName: 'DataHouse',
      purchaseBundle: vi.fn(),
      checkStatus: vi.fn(),
      checkBalance: vi.fn(),
      getBundles: vi.fn().mockResolvedValue([
        { id: 'dh_mtn_5gb', network: 'MTN', name: '5GB Non-Expiry', dataAmountMb: 5120, pricePesewas: 1750 },
        { id: 'dh_mtn_100gb', network: 'MTN', name: '100GB Non-Expiry', dataAmountMb: 102400, pricePesewas: 32000 },
      ]),
    } as unknown as ITelecomProvider;

    app = Fastify({ logger: false });

    await adminCatalogRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      catalogService: mockCatalogService,
      telecomProvider: mockTelecomProvider,
    });

    await catalogRoutes(app, {
      catalogService: mockCatalogService,
    });

    await app.ready();
  });

  it('1. GET /admin/catalog/stats should return all 8 KPI summary metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/catalog/stats',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalPlans).toBe(15);
    expect(body.data.activePlans).toBe(12);
    expect(body.data.disabledPlans).toBe(3);
    expect(body.data.customerPlans).toBe(12);
    expect(body.data.agentPlans).toBe(12);
    expect(body.data.storePlans).toBe(12);
    expect(body.data.providerSynced).toBe(14);
    expect(body.data.syncIssues).toBe(1);
  });

  it('2. GET /admin/catalog/plans should return filtered, paginated catalog with calculated margins', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/catalog/plans?network=MTN&status=ACTIVE',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(1);
    const plan = body.data.items[0];
    expect(plan.sku).toBe('MTN-5GB-NE');
    expect(plan.basePricePesewas).toBe(2800);
    expect(plan.providerPricePesewas).toBe(1750);
    expect(plan.customerMarginPesewas).toBe(1050);
    expect(plan.customerMarginPct).toBe(37.5);
  });

  it('3. GET /admin/catalog/plans/:id should return complete plan dossier with analytics and price history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/catalog/plans/prod_101',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('prod_101');
    expect(body.data.analytics.lifetimeOrders).toBe(50);
    expect(body.data.analytics.successfulOrders).toBe(48);
    expect(body.data.analytics.successRatePct).toBe(96);
    expect(body.data.priceHistory.length).toBeGreaterThan(0);
  });

  it('4. POST /admin/catalog/plans should validate inputs and create new catalog plan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/catalog/plans',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        name: '15GB Non-Expiry',
        network: NetworkProvider.MTN,
        dataAmountMb: 15360,
        validityDays: 30,
        providerPricePesewas: 5000,
        basePricePesewas: 7500,
        agentPricePesewas: 5500,
        storePricePesewas: 6500,
        providerPlanId: 'dh_mtn_15gb',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_CREATED' }),
    );
  });

  it('5. PUT /admin/catalog/plans/:id should update plan and record price changes', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/catalog/plans/prod_101',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        name: '5GB Non-Expiry Promo',
        basePricePesewas: 2700,
        changeReason: 'Promotional discount',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_PRICE_CHANGED' }),
    );
  });

  it('6. PATCH /admin/catalog/plans/:id/status should update plan status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/catalog/plans/prod_101/status',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        status: CatalogPlanStatus.DISABLED,
        reason: 'Temporary network maintenance',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_DISABLED' }),
    );
  });

  it('7. POST /admin/catalog/plans/bulk-pricing/preview should preview formula price adjustments and revenue delta', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/catalog/plans/bulk-pricing/preview',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        network: NetworkProvider.MTN,
        customerMarkupPercent: 10,
        agentMarkupPercent: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.affectedPlansCount).toBe(1);
    expect(body.data.plans[0].newBasePricePesewas).toBe(3080); // 2800 * 1.10
  });

  it('8. POST /admin/catalog/sync should diff provider catalog and identify discrepancies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/catalog/sync',
      headers: { authorization: 'Bearer admin_token' },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalProviderPlans).toBe(2);
    expect(body.data.discrepancyCount).toBe(1);
    expect(body.data.items[0].changeType).toBe('NEW_PLAN');
  });

  it('9. GET /catalog/bundles should be available for customer purchase channels', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/bundles?network=MTN',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('5GB Non-Expiry');
  });

  it('10. POST /admin/catalog/export should export catalog as JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/catalog/export',
      headers: { authorization: 'Bearer admin_token' },
      payload: { format: 'json' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('11. DELETE /admin/catalog/plans/:id should delete / archive data plan', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/catalog/plans/prod_101',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('12. POST /admin/catalog/plans/bulk with action DELETE should delete plans in batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/catalog/plans/bulk',
      headers: { authorization: 'Bearer admin_token' },
      payload: { planIds: ['prod_101'], action: 'DELETE' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.affectedCount).toBe(1);
  });
});
