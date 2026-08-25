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
    const mockClient = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_uuid_999',
                publicId: params?.[0] || 'ord_sf_test_123',
                userId: 'usr_agent_1',
                agentId: 'agt_uuid_1',
                storeId: 'str_123',
                recipientPhone: params?.[5] || '0244123456',
                network: params?.[6] || 'MTN',
                dataAmountMb: params?.[7] || 10240,
                amountPesewas: params?.[8] || 4800,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO order_items') || sql.includes('INSERT INTO provider_orders') || sql.includes('INSERT INTO order_events') || sql.includes('INSERT INTO payments') || sql.includes('INSERT INTO payment_events') || sql.includes('INSERT INTO financial_ledger_entries') || sql.includes('UPDATE payments') || sql.includes('UPDATE orders')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM payments p JOIN orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_uuid_1',
                orderId: 'ord_uuid_999',
                userId: 'usr_agent_1',
                amountPesewas: 4800,
                paymentStatus: 'PENDING',
                providerReference: 'PST-SF-TEST-1234',
                orderPublicId: 'ord_sf_test_123',
                storeId: 'str_123',
                agentId: 'agt_uuid_1',
                recipientPhone: '0244123456',
                network: 'MTN',
                dataAmountMb: 10240,
                orderAmountPesewas: 4800,
                orderStatus: 'CREATED',
                pricingSnapshot: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1') || sql.includes('FROM users WHERE uuid = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_agent_1', uuid: 'usr_agent_1', status: 'ACTIVE', role: 'agent' }],
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
        if (sql.includes('FROM stores WHERE slug = $1 AND store_status =') || (sql.includes('FROM stores WHERE') && sql.includes("store_status = 'ACTIVE'"))) {
          if (params?.[0] === 'inactive-store' || params?.[0] === 'nonexistent') {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({
            rows: [
              {
                id: 'str_123',
                agentId: 'agt_uuid_1',
                userId: 'usr_agent_1',
                storeName: 'FastData Reseller',
                slug: 'fastdata',
                tagline: 'Best data deals',
                description: 'Fastest automated bundle delivery',
                primaryColor: '#0066FF',
                accentColor: '#10B981',
                contactPhone: '0244123456',
                contactEmail: 'support@fastdata.com',
                contactWhatsapp: '+233244123456',
                storeStatus: 'ACTIVE',
                approvalStatus: 'APPROVED',
              },
            ],
          });
        }
        if (sql.includes('FROM store_products sp') && sql.includes('retailPricePesewas')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sp_1',
                catalogProductId: 'cp_1',
                sku: 'MTN-10GB',
                name: 'MTN 10GB',
                network: 'MTN',
                dataAmountMb: 10240,
                validityDays: 30,
                validityDesc: '30 Days',
                basePricePesewas: 4500,
                markupPesewas: 300,
                retailPricePesewas: 4800, // 4500 base + 300 markup
                popular: true,
              },
            ],
          });
        }
        if (sql.includes('FROM store_products sp') && sql.includes('JOIN catalog_products cp')) {
          return Promise.resolve({
            rows: [
              {
                storeProductId: 'sp_1',
                storeId: 'str_123',
                markupPesewas: 300,
                catalogProductId: 'cp_1',
                sku: 'MTN-10GB',
                name: 'MTN 10GB',
                network: 'MTN',
                dataAmountMb: 10240,
                basePricePesewas: 4500,
                validityDays: 30,
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
      initializePayment: vi.fn().mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/test-auth-url',
        providerReference: 'PST-SF-TEST-1234',
      }),
      verifyPayment: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        amountPesewas: 4800,
      }),
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

    it('GET /stores/my-store should return the store profile alias', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/stores/my-store',
        headers: {
          authorization: 'Bearer valid_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.hasStore).toBe(true);
      expect(json.data.store.storeName).toBe('FastData Reseller');
    });

    it('POST /stores/payment/initialize should initialize store activation payment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/stores/payment/initialize',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          storeName: 'FastData Reseller',
          slug: 'fastdata',
          contactPhone: '0241234567',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.alreadyPaid).toBe(true);
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

  describe('Public Storefront Resolution & Guest Checkout', () => {
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

    it('GET /stores/public/:slug should return 404 for non-existent or inactive store', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/stores/public/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });

    it('POST /stores/public/orders/checkout should create public guest order and initialize Paystack intent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/stores/public/orders/checkout',
        payload: {
          slug: 'fastdata',
          productId: 'sp_1',
          recipientPhone: '0244123456',
          customerEmail: 'customer@example.com',
          channel: 'mobile_money',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.order).toBeDefined();
      expect(json.data.order.network).toBe('MTN');
      expect(json.data.order.amountPesewas).toBe(4800);
      expect(json.data.order.amountGhs).toBe(48.00);
      expect(json.data.payment.authorizationUrl).toBe('https://checkout.paystack.com/test-auth-url');
    });

    it('POST /stores/public/orders/verify should verify payment and transition order to READY_FOR_FULFILLMENT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/stores/public/orders/verify',
        payload: {
          reference: 'PST-SF-TEST-1234',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.orderId).toBe('ord_sf_test_123');
      expect(json.data.paymentStatus).toBe('PAID');
      expect(json.data.status).toBe('READY_TO_PROCESS');
    });
  });
});
