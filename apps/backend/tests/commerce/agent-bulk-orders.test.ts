import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { bulkOrderRoutes } from '../../src/routes/commerce/bulk-order.routes.js';
import { BulkOrderService } from '../../src/core/commerce/bulk-order.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { RateLimiterService } from '../../src/core/security/rate-limiter.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { UserRole, SecurityDomain, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Bulk Orders Suite (POST /agent/orders/bulk & POST /me/agent/orders/bulk)', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockRateLimiter: RateLimiterService;
  let catalogService: CatalogService;
  let bulkOrderService: BulkOrderService;

  beforeEach(async () => {
    mockDb = {
      connect: vi.fn().mockReturnValue({
        query: vi.fn().mockImplementation((query: string, params?: any[]) => {
          const sql = query.replace(/\s+/g, ' ');
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('SELECT id, agent_price_pesewas')) {
            const dataAmountMb = params?.[1];
            if (dataAmountMb === 2048) {
              return Promise.resolve({
                rows: [{ id: 'prod_2gb', agentPrice: 840, basePrice: 840 }],
              });
            }
            if (dataAmountMb === 5120) {
              return Promise.resolve({
                rows: [{ id: 'prod_5gb', agentPrice: 2100, basePrice: 2100 }],
              });
            }
            return Promise.resolve({
              rows: [{ id: 'prod_generic', agentPrice: 420, basePrice: 420 }],
            });
          }
          if (sql.includes('INSERT INTO orders')) {
            return Promise.resolve({
              rows: [{ id: 'ord_db_uuid_1' }],
            });
          }
          if (sql.includes('INSERT INTO bulk_submissions')) {
            return Promise.resolve({
              rows: [{ id: 'sub_db_uuid_1' }],
            });
          }
          if (sql.includes('INSERT INTO bulk_submission_items') || sql.includes('INSERT INTO provider_orders') || sql.includes('UPDATE users SET wallet_balance')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
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

        if (sql.includes('FROM beneficiary_validation') && sql.includes("network = 'MTN'")) {
          // Return 0201234567 and 0241112222 as known; 0559990000 is unknown
          return Promise.resolve({
            rows: [
              { phone: '0201234567' },
              { phone: '0241112222' },
            ],
          });
        }

        if (sql.includes('FROM orders') && sql.includes("network = 'MTN'")) {
          return Promise.resolve({
            rows: [],
          });
        }

        if (sql.includes('INSERT INTO beneficiary_validation')) {
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
        scopes: ['orders:write', 'orders:read'],
        name: 'agent_live_key',
      })),
      verifyApiKey: vi.fn().mockReturnValue({
        id: 'key_1',
        agentId: 'agt_uuid_1',
        isSandbox: false,
        keyPrefix: 'ak_live',
        scopes: ['orders:write', 'orders:read'],
      }),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockRateLimiter = {
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetSeconds: 60 }),
    } as unknown as RateLimiterService;

    catalogService = {} as unknown as CatalogService;
    bulkOrderService = new BulkOrderService(mockDb, catalogService);

    app = Fastify();
    app.register(multipart);
    app.setErrorHandler(errorHandler);

    await app.register(bulkOrderRoutes, {
      db: mockDb,
      bulkOrderService,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      rateLimiter: mockRateLimiter,
    });
  });

  describe('POST /agent/orders/bulk (JSON x-api-key)', () => {
    it('should place a bulk order auto-split into per-bundle-size child orders with unknown MTN numbers set aside', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
          'content-type': 'application/json',
        },
        payload: {
          network: 'MTN',
          idempotencyKey: '7f4c9a10-3b2e-4d5f-8a1b-2c3d4e5f6a7b',
          recipients: [
            { phoneNumber: '0201234567', dataSizeGb: 5 },
            { phoneNumber: '0241112222', dataSizeGb: 2 },
            { phoneNumber: '0559990000', dataSizeGb: 5 },
          ],
          confirmedPorted: ['0201234567'],
          onUnvalidated: 'set_aside',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(201);
      expect(json.message).toBe('Bulk order placed and queued for processing.');

      const data = json.data;
      expect(data.id).toMatch(/^sub_/);
      expect(data.referenceCode).toMatch(/^BLK-/);
      expect(data.network).toBe('MTN');
      expect(data.status).toBe('received');
      expect(data.beneficiaryCount).toBe(2);
      expect(data.groupCount).toBe(2);
      expect(data.amount).toBe('29.40'); // 8.40 (2GB) + 21.00 (5GB)

      expect(data.orders).toHaveLength(2);
      expect(data.orders[0].sizeGb).toBe(2);
      expect(data.orders[0].beneficiaryCount).toBe(1);
      expect(data.orders[0].amount).toBe('8.40');
      expect(data.orders[0].status).toBe('received');

      expect(data.orders[1].sizeGb).toBe(5);
      expect(data.orders[1].beneficiaryCount).toBe(1);
      expect(data.orders[1].amount).toBe('21.00');
      expect(data.orders[1].status).toBe('received');

      expect(data.blocked).toEqual(['0559990000']);
    });

    it('should reject bulk orders on sandbox API keys with 400 BULK_NOT_ON_SANDBOX', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: {
          'x-api-key': 'ak_test_sandbox_123456',
          'content-type': 'application/json',
        },
        payload: {
          network: 'MTN',
          idempotencyKey: '7f4c9a10-3b2e-4d5f-8a1b-2c3d4e5f6a7b',
          recipients: [{ phoneNumber: '0241112222', dataSizeGb: 2 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('BULK_NOT_ON_SANDBOX');
      expect(json.error.message).toContain('sandbox');
    });

    it('should fail with 422 if onUnvalidated is "reject" and unknown MTN numbers exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
          'content-type': 'application/json',
        },
        payload: {
          network: 'MTN',
          idempotencyKey: '7f4c9a10-3b2e-4d5f-8a1b-2c3d4e5f6a7b',
          recipients: [
            { phoneNumber: '0241112222', dataSizeGb: 2 },
            { phoneNumber: '0559990000', dataSizeGb: 5 },
          ],
          onUnvalidated: 'reject',
        },
      });

      expect(res.statusCode).toBe(422);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('should never block Telecel numbers and place all valid recipients', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
          'content-type': 'application/json',
        },
        payload: {
          network: 'TELECEL',
          idempotencyKey: 'telecel-bulk-001',
          recipients: [
            { phoneNumber: '0201234567', dataSizeGb: 5 },
            { phoneNumber: '0509990000', dataSizeGb: 5 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.network).toBe('TELECEL');
      expect(json.data.beneficiaryCount).toBe(2);
      expect(json.data.groupCount).toBe(1);
      expect(json.data.blocked).toEqual([]);
    });
  });

  describe('POST /me/agent/orders/bulk (JWT Mirror)', () => {
    it('should create bulk order from dashboard JWT request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/me/agent/orders/bulk',
        headers: {
          authorization: 'Bearer valid_jwt_token',
          'content-type': 'application/json',
        },
        payload: {
          network: 'TELECEL',
          idempotencyKey: 'dash-bulk-001',
          recipients: [
            { phoneNumber: '0201234567', dataSizeGb: 5 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Bulk order received and queued for processing.');
      expect(json.data.id).toMatch(/^sub_/);
      expect(json.data.beneficiaryCount).toBe(1);
    });
  });
});
