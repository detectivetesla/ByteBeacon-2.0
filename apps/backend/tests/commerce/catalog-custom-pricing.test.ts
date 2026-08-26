import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { catalogRoutes } from '../../src/routes/commerce/catalog.routes.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import type pg from 'pg';

describe('Catalog Custom Pricing Resolution Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let catalogService: CatalogService;
  let tokenService: TokenService;

  const mockProduct = {
    id: 'prod-mtn-10gb',
    sku: 'BB-MTN-10GB',
    network: 'MTN',
    name: 'MTN 10GB Data Plan',
    dataAmountMb: 10240,
    validityDays: 30,
    validityDesc: '30 Days',
    basePricePesewas: 5000,
    agentPricePesewas: 4500,
    agentMinPricePesewas: 4000,
    agentMaxPricePesewas: 6000,
    storePricePesewas: 4800,
    providerPricePesewas: 3800,
    providerName: 'DataHouse',
    status: 'ACTIVE',
    isActive: true,
    availableForCustomer: true,
    availableForAgent: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM catalog_products cp')) {
          // If query has user_pricing join for custom customer
          if (params?.includes('usr-custom-customer')) {
            return Promise.resolve({
              rows: [
                {
                  ...mockProduct,
                  userCustomPricePesewas: 4200, // Custom special rate for customer
                  agentCustomPricePesewas: null,
                },
              ],
            });
          }
          // If query has agent_pricing join for custom agent
          if (params?.includes('usr-custom-agent')) {
            return Promise.resolve({
              rows: [
                {
                  ...mockProduct,
                  userCustomPricePesewas: null,
                  agentCustomPricePesewas: 3900, // Custom special wholesale rate for agent
                },
              ],
            });
          }
          // Default public anonymous catalog
          return Promise.resolve({
            rows: [
              {
                ...mockProduct,
                userCustomPricePesewas: null,
                agentCustomPricePesewas: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    catalogService = new CatalogService(mockDb);
    tokenService = new TokenService('test-jwt-secret-key-that-is-at-least-32-chars-long', 900);

    app = Fastify({ logger: false });
    await catalogRoutes(app, { catalogService, tokenService });
    await app.ready();
  });

  it('1. Returns standard base retail pricing for anonymous unauthenticated visitors', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/bundles?network=MTN',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].basePricePesewas).toBe(5000);
    expect(body.data[0].effectivePricePesewas).toBe(5000);
    expect(body.data[0].customPricePesewas).toBeNull();
  });

  it('2. Returns customized individual price for authenticated customer with user_pricing override', async () => {
    const customerToken = tokenService.signAccessToken({
      sub: 'usr-custom-customer',
      email: 'customer@bytebeacon.com',
      role: 'customer' as any,
      domain: 'CUSTOMER' as any,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/bundles?network=MTN',
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    // Custom price override should reflect in effectivePricePesewas and basePricePesewas
    expect(body.data[0].customPricePesewas).toBe(4200);
    expect(body.data[0].effectivePricePesewas).toBe(4200);
    expect(body.data[0].basePricePesewas).toBe(4200);
  });

  it('3. Returns customized wholesale price for authenticated agent with agent_pricing override', async () => {
    const agentToken = tokenService.signAccessToken({
      sub: 'usr-custom-agent',
      email: 'agent@bytebeacon.com',
      role: 'agent' as any,
      domain: 'AGENT' as any,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/bundles?network=MTN&channel=AGENT',
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    // Custom wholesale override should reflect in effectivePricePesewas and agentPricePesewas
    expect(body.data[0].customPricePesewas).toBe(3900);
    expect(body.data[0].effectivePricePesewas).toBe(3900);
    expect(body.data[0].agentPricePesewas).toBe(3900);
  });

  it('4. Resolves custom pricing when querying bundle by ID', async () => {
    const customerToken = tokenService.signAccessToken({
      sub: 'usr-custom-customer',
      email: 'customer@bytebeacon.com',
      role: 'customer' as any,
      domain: 'CUSTOMER' as any,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/bundles/prod-mtn-10gb',
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('prod-mtn-10gb');
    expect(body.data.effectivePricePesewas).toBe(4200);
    expect(body.data.basePricePesewas).toBe(4200);
  });
});
