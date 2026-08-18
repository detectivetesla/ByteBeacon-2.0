import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { storeRoutes } from '../../src/routes/commerce/store.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Store & Custom Catalog Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockPaymentProvider: IPaymentProvider;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_agent_1', status: 'ACTIVE', role: 'agent' }],
          });
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_uuid_1' }],
          });
        }
        if (sql.includes('FROM stores WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'str_123',
                agentId: 'agt_uuid_1',
                userId: 'usr_agent_1',
                storeName: 'FastData Reseller',
                slug: 'fastdata',
                paymentStatus: 'PAID',
                approvalStatus: 'APPROVED',
                storeStatus: 'ACTIVE',
                activationFeePesewas: 15000,
                primaryColor: '#0066FF',
                accentColor: '#10B981',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (sql.includes('FROM stores WHERE slug = $1 AND user_id != $2')) {
          return Promise.resolve({ rows: [] }); // No slug collision
        }
        if (sql.includes('INSERT INTO stores')) {
          return Promise.resolve({
            rows: [
              {
                id: 'str_new_1',
                agentId: 'agt_uuid_1',
                userId: 'usr_agent_1',
                storeName: params?.[2] || 'New Store',
                slug: params?.[3] || 'new-store',
                paymentStatus: 'PAYMENT_REQUIRED',
                approvalStatus: 'NOT_SUBMITTED',
                storeStatus: 'INACTIVE',
                activationFeePesewas: 15000,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (sql.includes('FROM stores WHERE slug = $1 AND store_status =')) {
          return Promise.resolve({
            rows: [
              {
                id: 'str_123',
                storeName: 'FastData Reseller',
                slug: 'fastdata',
                tagline: 'Best data deals',
                primaryColor: '#0066FF',
                accentColor: '#10B981',
              },
            ],
          });
        }
        if (sql.includes('FROM store_products sp') && sql.includes('retailPricePesewas')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sp_1',
                name: 'MTN 10GB',
                network: 'MTN',
                dataAmountMb: 10240,
                validityDays: 30,
                retailPricePesewas: 4800, // 4500 base + 300 markup
              },
            ],
          });
        }
        if (sql.includes('UPDATE store_products')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sp_1',
                markupPesewas: 400,
                isAvailable: true,
                isVisible: true,
              },
            ],
          });
        }
        if (sql.includes("UPDATE stores SET payment_status = 'PAID'")) {
          return Promise.resolve({
            rows: [
              {
                id: 'str_123',
                storeName: 'FastData Reseller',
                paymentStatus: 'PAID',
                approvalStatus: 'AWAITING_APPROVAL',
                storeStatus: 'INACTIVE',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_agent_1',
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;
    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockPaymentProvider = {
      initializePayment: vi.fn(),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    app = Fastify();
    await app.register(storeRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      paymentProvider: mockPaymentProvider,
    });
  });

  describe('Store Entitlement & Configuration', () => {
    it('GET /stores/me should return active entitlement for approved and paid store', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/stores/me',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.hasStore).toBe(true);
      expect(json.data.isEntitled).toBe(true);
      expect(json.data.store.slug).toBe('fastdata');
    });
  });

  describe('Custom Product Markup Operations', () => {
    it('PUT /stores/my-store/products/:id should update reseller margin', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/stores/my-store/products/sp_1',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          markupPesewas: 400, // GH₵ 4.00 profit margin
          isAvailable: true,
          isVisible: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.markupPesewas).toBe(400);
    });
  });

  describe('Public Storefront Resolution', () => {
    it('GET /stores/public/:slug should return public catalog with computed retail prices', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/stores/public/fastdata',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.store.storeName).toBe('FastData Reseller');
      expect(json.data.products).toHaveLength(1);
      expect(json.data.products[0].retailPricePesewas).toBe(4800);
    });
  });
});
