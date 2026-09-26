import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { NetworkProvider, OrderStatus, PaymentStatus, RefundStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Batch Orders Suite (POST /agent/orders & POST /agent/orders/batch)', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockOrderService: Partial<OrderService>;

  beforeEach(async () => {
    mockDb = {
      connect: vi.fn().mockReturnValue({
        query: vi.fn().mockImplementation((query: string) => {
          const sql = query.replace(/\s+/g, ' ');
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
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
            rows: [{ id: 'usr_agent_test', status: 'ACTIVE', role: 'agent' }],
          });
        }

        if (sql.includes('FROM agents WHERE id = $1 OR user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_batch_test', userId: 'usr_agent_test' }],
          });
        }

        if (sql.includes('FROM beneficiary_validation') || sql.includes('FROM pending_beneficiary_approvals')) {
          return Promise.resolve({
            rows: [{ phone_number: '0241234567' }, { dummy: 1 }],
          });
        }

        if (sql.includes('FROM catalog_products WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: params?.[0] || 'bundle-1', data_amount_mb: 2048 }],
          });
        }

        if (sql.includes('FROM api_usage_metrics')) {
          return Promise.resolve({ rows: [] });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn(),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateApiKey: vi.fn().mockImplementation(async (key: string) => {
        if (key.startsWith('ak_test_')) {
          return {
            isValid: true,
            isSandbox: true,
            keyId: 'key_sbx_1',
            userId: 'usr_agent_test',
            agentId: 'agt_batch_test',
            environment: 'SANDBOX',
            permissions: ['orders:create', 'orders:read'],
          };
        }
        if (key.startsWith('ak_live_')) {
          return {
            isValid: true,
            isSandbox: false,
            keyId: 'key_live_1',
            userId: 'usr_agent_test',
            agentId: 'agt_batch_test',
            environment: 'PRODUCTION',
            permissions: ['orders:create', 'orders:read'],
          };
        }
        return { isValid: false, permissions: [] };
      }),
      recordKeyUsage: vi.fn(),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockResolvedValue(true),
    } as unknown as RbacService;

    let counter = 1;
    mockOrderService = {
      createOrder: vi.fn().mockImplementation(async (input: any) => {
        const id = `ord_batch_${counter++}`;
        return {
          order: {
            id,
            publicId: `ord_pub_${id}`,
            userId: 'usr_agent_test',
            agentId: 'agt_batch_test',
            recipientPhone: input.recipientPhone,
            network: NetworkProvider.MTN,
            dataAmountMb: 2048,
            amountPesewas: 840,
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.READY_FOR_FULFILLMENT,
            refundStatus: RefundStatus.NONE,
            createdAt: new Date().toISOString(),
          },
          isIdempotentReplay: false,
        };
      }),
    };

    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      orderService: mockOrderService as OrderService,
    });
  });

  describe('Concurrent Batch Orders via Array Payload: POST /agent/orders', () => {
    it('accepts an array of orders and processes all items concurrently in sandbox', async () => {
      const payload = [
        {
          bundleId: 'bundle-2gb',
          phoneNumber: '0241112222',
          idempotencyKey: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        },
        {
          bundleId: 'bundle-2gb',
          phoneNumber: '0553334444',
          idempotencyKey: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
        },
        {
          bundleId: 'bundle-2gb',
          phoneNumber: '0245556666',
        },
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: {
          'x-api-key': 'ak_test_sandbox_batch_key',
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.batch).toBe(true);
      expect(json.data.total).toBe(3);
      expect(json.data.successfulCount).toBe(3);
      expect(json.data.failedCount).toBe(0);
      expect(json.data.orders).toHaveLength(3);
      expect(json.data.orders[0].referenceCode).toMatch(/^SBX-/);
    });

    it('processes live batch concurrently and handles partial failures without aborting other orders', async () => {
      const payload = [
        {
          bundleId: 'bundle-2gb',
          phoneNumber: '0241112222',
        },
        {
          bundleId: 'bundle-2gb',
          phoneNumber: 'invalid-phone-number',
        },
        {
          bundleId: 'bundle-2gb',
          phoneNumber: '0243334444',
        },
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: {
          'x-api-key': 'ak_live_valid_key',
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.batch).toBe(true);
      expect(json.data.total).toBe(3);
      expect(json.data.successfulCount).toBe(2);
      expect(json.data.failedCount).toBe(1);
      expect(json.data.orders).toHaveLength(2);
      expect(json.data.failures).toHaveLength(1);
      expect(json.data.failures[0].index).toBe(1);
      expect(json.data.failures[0].error).toContain('not a Ghanaian MSISDN');
    });
  });

  describe('Batch Aliases: POST /agent/orders/batch & POST /agent/orders/multi', () => {
    it('accepts { orders: [...] } object on /agent/orders/batch', async () => {
      const payload = {
        orders: [
          { bundleId: 'bundle-2gb', phoneNumber: '0241112222' },
          { bundleId: 'bundle-2gb', phoneNumber: '0242223333' },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/batch',
        headers: {
          'x-api-key': 'ak_live_valid_key',
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.batch).toBe(true);
      expect(json.data.successfulCount).toBe(2);
      expect(json.data.orders).toHaveLength(2);
    });

    it('accepts { items: [...] } on /agent/orders/multi', async () => {
      const payload = {
        items: [
          { bundleId: 'bundle-2gb', phoneNumber: '0249998888' },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders/multi',
        headers: {
          'x-api-key': 'ak_live_valid_key',
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.batch).toBe(true);
      expect(json.data.successfulCount).toBe(1);
    });
  });
});
