import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Orders List & Lookup API Suite (GET /agent/orders & GET /agent/orders/:id)', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let orderService: OrderService;
  let catalogService: CatalogService;
  let idempotencyService: IdempotencyService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_agent_1', status: 'ACTIVE', role: 'agent' }],
          });
        }

        if (sql.includes('FROM agents WHERE id = $1 OR user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_uuid_1', userId: 'usr_agent_1' }],
          });
        }

        if (sql.includes('SELECT COUNT(*) as total FROM orders o')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        if (sql.includes('SELECT o.id, o.public_id as "publicId"') && sql.includes('ORDER BY o.created_at DESC')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_uuid_1',
                publicId: 'ord_01J8ABCDEF123456',
                recipientPhone: '0241234567',
                network: 'MTN',
                dataAmountMb: 5120,
                amountPesewas: '2100',
                currency: 'GHS',
                paymentStatus: 'PAID',
                orderStatus: 'COMPLETED',
                providerStatus: 'COMPLETED',
                createdAt: '2026-07-07T12:00:00.000Z',
                updatedAt: '2026-07-07T12:05:00.000Z',
                providerReference: 'TXN-7GH2K9',
                submissionId: null,
              },
            ],
          });
        }

        if (sql.includes('SELECT o.id, o.public_id as "publicId"') && sql.includes('provider_reference = $1')) {
          const searchVal = params?.[0];
          if (searchVal === 'ord_01J8ABCDEF123456' || searchVal === 'TXN-7GH2K9') {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_uuid_1',
                  publicId: 'ord_01J8ABCDEF123456',
                  userId: 'usr_agent_1',
                  agentId: 'agt_uuid_1',
                  recipientPhone: '0241234567',
                  network: 'MTN',
                  dataAmountMb: 5120,
                  amountPesewas: '2100',
                  currency: 'GHS',
                  pricingSnapshot: {},
                  paymentStatus: 'PAID',
                  orderStatus: 'COMPLETED',
                  providerStatus: 'COMPLETED',
                  createdAt: '2026-07-07T12:00:00.000Z',
                  updatedAt: '2026-07-07T12:05:00.000Z',
                  providerReference: 'TXN-7GH2K9',
                  submissionId: null,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_agent_1',
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.AGENT,
        status: 'ACTIVE',
        sessionId: 'sess_agent_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateApiKey: vi.fn().mockImplementation((rawKey: string) => ({
        id: 'key_1',
        agentId: 'agt_uuid_1',
        isSandbox: rawKey.startsWith('ak_test_'),
        keyPrefix: rawKey.slice(0, 7),
        scopes: ['orders:read'],
        name: 'agent_key',
      })),
      verifyApiKey: vi.fn().mockReturnValue({
        id: 'key_1',
        agentId: 'agt_uuid_1',
        isSandbox: false,
        keyPrefix: 'ak_live',
        scopes: ['orders:read'],
      }),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    catalogService = {} as unknown as CatalogService;
    idempotencyService = {} as unknown as IdempotencyService;
    orderService = new OrderService(mockDb, catalogService, idempotencyService);

    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(agentRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      orderService,
    });
  });

  describe('GET /agent/orders', () => {
    it('should list agent orders (newest first) with delivery tally and empty beneficiaries array via x-api-key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/orders?status=received&network=MTN&paymentStatus=paid&page=1&limit=30',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(200);
      expect(json.message).toBe('Success');
      expect(json.data.data).toHaveLength(1);

      const order = json.data.data[0];
      expect(order.id).toBe('ord_01J8ABCDEF123456');
      expect(order.referenceCode).toBe('TXN-7GH2K9');
      expect(order.network).toBe('MTN');
      expect(order.status).toBe('approved');
      expect(order.paymentStatus).toBe('paid');
      expect(order.amount).toBe('21.00');
      expect(order.groupSizeGb).toBe(5);
      expect(order.submissionId).toBeNull();
      expect(order.beneficiaryCount).toBe(1);
      expect(order.totalDataGb).toBe(5);
      expect(order.delivery).toEqual({
        approved: 1,
        pending: 0,
        failed: 0,
        total: 1,
      });
      expect(order.beneficiaries).toEqual([]);

      expect(json.data.meta).toEqual({
        page: 1,
        limit: 30,
        total: 1,
        totalPages: 1,
      });
    });

    it('should allow listing via Bearer authorization token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/orders',
        headers: {
          authorization: 'Bearer valid_jwt_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.data).toBeDefined();
    });
  });

  describe('GET /agent/orders/:id', () => {
    it('should look up an order by publicId and return full recipient list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/orders/ord_01J8ABCDEF123456',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(200);
      expect(json.message).toBe('Success');

      const order = json.data;
      expect(order.id).toBe('ord_01J8ABCDEF123456');
      expect(order.referenceCode).toBe('TXN-7GH2K9');
      expect(order.network).toBe('MTN');
      expect(order.status).toBe('approved');
      expect(order.paymentStatus).toBe('paid');
      expect(order.amount).toBe('21.00');
      expect(order.groupSizeGb).toBe(5);
      expect(order.delivery).toEqual({
        approved: 1,
        pending: 0,
        failed: 0,
        total: 1,
      });
      expect(order.beneficiaries).toHaveLength(1);
      expect(order.beneficiaries[0]).toEqual({
        id: expect.stringMatching(/^ben_/),
        phoneNumber: '0241234567',
        dataVolumeGb: '5.00',
        amount: '21.00',
        network: 'MTN',
        status: 'approved',
        isPorted: false,
      });
    });

    it('should return 404 for unknown order ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agent/orders/ord_unknown_999',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
        },
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});
