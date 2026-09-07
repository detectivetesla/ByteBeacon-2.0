import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { bulkOrderRoutes } from '../../src/routes/commerce/bulk-order.routes.js';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { BulkOrderService } from '../../src/core/commerce/bulk-order.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { RateLimiterService } from '../../src/core/security/rate-limiter.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { OrderStateMachine } from '../../src/core/commerce/order-state-machine.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { UserRole, SecurityDomain, NetworkProvider } from '@bytebeacon/shared';

describe('DataHouse Specification Suite: Idempotency & Order Lifecycle', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockRateLimiter: RateLimiterService;
  let catalogService: CatalogService;
  let idempotencyService: IdempotencyService;
  let orderService: OrderService;
  let bulkOrderService: BulkOrderService;
  let ledgerService: FinancialLedgerService;

  let inMemoryIdempotencyStore: Map<string, { requestHash: string; status: number; body: unknown; expiresAt: Date }>;
  let walletDebitCount: number;

  beforeEach(async () => {
    inMemoryIdempotencyStore = new Map();
    walletDebitCount = 0;

    const agentUserId = 'usr_agent_idem_1';
    const agentId = 'agt_uuid_idem_1';

    mockDb = {
      connect: vi.fn().mockReturnValue({
        query: vi.fn().mockImplementation((query: string, params?: any[]) => {
          const sql = query.replace(/\s+/g, ' ');
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
            return Promise.resolve({ rows: [] });
          }

          if (sql.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
            return Promise.resolve({
              rows: [{ wallet_balance_pesewas: 100000, wallet_balance: '1000.00' }],
            });
          }

          if (sql.includes('UPDATE users') && sql.includes('wallet_balance_pesewas')) {
            walletDebitCount++;
            return Promise.resolve({ rows: [] });
          }

          if (sql.includes('SELECT id, agent_price_pesewas')) {
            return Promise.resolve({
              rows: [{ id: 'bnd_mtn_5gb', agentPrice: 2100, basePrice: 2100 }],
            });
          }

          if (sql.includes('INSERT INTO orders')) {
            const orderId = 'ord_db_' + Date.now();
            let pricingSnapshot = {};
            try {
              if (params?.[8] && typeof params[8] === 'string') pricingSnapshot = JSON.parse(params[8]);
              else if (params?.[9] && typeof params[9] === 'string') pricingSnapshot = JSON.parse(params[9]);
            } catch {}
            return Promise.resolve({
              rows: [
                {
                  id: orderId,
                  publicId: 'ord_pub_' + Date.now(),
                  userId: agentUserId,
                  agentId: agentId,
                  productId: params?.[3] || 'bnd_mtn_5gb',
                  recipientPhone: params?.[4] || '0241234567',
                  network: params?.[5] || 'MTN',
                  dataAmountMb: params?.[6] || 5120,
                  amountPesewas: params?.[7] || 2100,
                  currency: 'GHS',
                  pricingSnapshot,
                  paymentStatus: 'PAID',
                  orderStatus: 'READY_FOR_FULFILLMENT',
                  providerStatus: 'UNKNOWN',
                  refundStatus: 'NONE',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
            });
          }

          if (sql.includes('INSERT INTO bulk_submissions')) {
            return Promise.resolve({
              rows: [{ id: 'sub_db_uuid_100' }],
            });
          }

          if (sql.includes('INSERT INTO idempotency_keys')) {
            const [key, uId, endpoint, reqHash, status, body] = params || [];
            inMemoryIdempotencyStore.set(uId + ':' + key, {
              requestHash: reqHash,
              status,
              body: typeof body === 'string' ? JSON.parse(body) : body,
              expiresAt: new Date(Date.now() + 86400000),
            });
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
            rows: [{ id: agentUserId, status: 'ACTIVE', role: 'agent' }],
          });
        }

        if (sql.includes('FROM agents WHERE id = $1 OR user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: agentId, userId: agentUserId }],
          });
        }

        if (sql.includes('FROM catalog_products WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'bnd_mtn_5gb',
                name: 'MTN 5GB Bundle',
                network: 'MTN',
                dataAmountMb: 5120,
                basePricePesewas: 2100,
                agentPricePesewas: 2100,
                isActive: true,
                status: 'ACTIVE',
              },
            ],
          });
        }

        if (sql.includes('SELECT 1 FROM beneficiary_validation') || sql.includes('FROM beneficiary_validation')) {
          return Promise.resolve({
            rows: [{ phone: '0241234567', phone_number: '0241234567' }],
          });
        }

        if (sql.includes('FROM idempotency_keys')) {
          const key = params?.[0];
          const uId = params?.[1];
          const found = inMemoryIdempotencyStore.get(uId + ':' + key);
          if (found) {
            return Promise.resolve({
              rows: [
                {
                  responseStatus: found.status,
                  responseBody: found.body,
                  requestHash: found.requestHash,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('FROM agent_webhooks')) {
          return Promise.resolve({
            rows: [
              {
                id: 'wh_1',
                agent_id: agentId,
                url: 'https://webhook.site/test',
                signing_secret: 'sec_wh_123456',
                events: ['*'],
                status: 'ACTIVE',
              },
            ],
          });
        }

        if (sql.includes('INSERT INTO webhook_delivery_logs')) {
          return Promise.resolve({ rows: [] });
        }

        return Promise.resolve({ rows: [] });
      }),
    };

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: agentUserId,
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.AGENT,
        status: 'ACTIVE',
        sessionId: 'sess_agent_idem_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateApiKey: vi.fn().mockReturnValue({
        id: 'key_1',
        agentId,
        isSandbox: false,
        keyPrefix: 'ak_live',
        scopes: ['orders:write', 'orders:read'],
        name: 'live_key',
      }),
      verifyApiKey: vi.fn().mockReturnValue({
        id: 'key_1',
        agentId,
        isSandbox: false,
        keyPrefix: 'ak_live',
        scopes: ['orders:write', 'orders:read'],
      }),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockRateLimiter = {
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 100, resetSeconds: 60 }),
    } as unknown as RateLimiterService;

    catalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'bnd_mtn_5gb',
        sku: 'MTN-5GB',
        name: 'MTN 5GB Bundle',
        network: NetworkProvider.MTN,
        dataAmountMb: 5120,
        basePricePesewas: 2100,
        agentPricePesewas: 2100,
        isActive: true,
        status: 'ACTIVE',
      }),
    } as unknown as CatalogService;

    idempotencyService = new IdempotencyService(mockDb, null);
    ledgerService = new FinancialLedgerService(mockDb);

    orderService = new OrderService(mockDb, catalogService, idempotencyService, ledgerService);
    bulkOrderService = new BulkOrderService(mockDb, catalogService, ledgerService, undefined, undefined, idempotencyService);

    app = Fastify();
    app.setErrorHandler(errorHandler);

    await app.register(agentRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService,
      orderService,
    });

    await app.register(bulkOrderRoutes, {
      db: mockDb,
      bulkOrderService,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      rateLimiter: mockRateLimiter,
    });
  });

  describe('Part 1: Single Order Idempotency (POST /agent/orders)', () => {
    it('rejects missing or non-UUID v4 idempotencyKey with HTTP 400', async () => {
      const resMissing = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          bundleId: 'bnd_mtn_5gb',
          phoneNumber: '0241234567',
        },
      });
      expect(resMissing.statusCode).toBe(400);
      expect(JSON.parse(resMissing.body).error.message).toContain('UUID v4');

      const resInvalid = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          bundleId: 'bnd_mtn_5gb',
          phoneNumber: '0241234567',
          idempotencyKey: 'not-a-valid-uuid-v4',
        },
      });
      expect(resInvalid.statusCode).toBe(400);
      expect(JSON.parse(resInvalid.body).error.message).toContain('UUID v4');
    });

    it('creates fresh order on valid UUID v4 key and debits wallet once', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const res = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          bundleId: 'bnd_mtn_5gb',
          phoneNumber: '0241234567',
          idempotencyKey: validUuid,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.idempotencyKey).toBe(validUuid);
      expect(json.data.status).toBe('received');
      expect(walletDebitCount).toBe(1);
    });

    it('returns existing order on identical retry within 24h without double debit', async () => {
      const validUuid = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
      const payload = {
        bundleId: 'bnd_mtn_5gb',
        phoneNumber: '0241234567',
        idempotencyKey: validUuid,
      };

      // 1. Initial attempt
      const res1 = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload,
      });
      expect(res1.statusCode).toBe(201);
      expect(walletDebitCount).toBe(1);
      const data1 = JSON.parse(res1.body).data;

      // 2. Replay with identical key and body
      const res2 = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      const data2 = JSON.parse(res2.body).data;

      // Order matches, no double debit occurred
      expect(data2.publicId).toBe(data1.publicId);
      expect(walletDebitCount).toBe(1);
    });

    it('rejects same idempotencyKey with different body with HTTP 400', async () => {
      const validUuid = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';

      // 1. Initial attempt
      await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          bundleId: 'bnd_mtn_5gb',
          phoneNumber: '0241234567',
          idempotencyKey: validUuid,
        },
      });

      // 2. Replay attempt with same key but different phoneNumber
      const resCollision = await app.inject({
        method: 'POST',
        url: '/agent/orders',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          bundleId: 'bnd_mtn_5gb',
          phoneNumber: '0249998888',
          idempotencyKey: validUuid,
        },
      });

      expect(resCollision.statusCode).toBe(400);
      const errJson = JSON.parse(resCollision.body);
      expect(errJson.error.message).toContain('Idempotency key collision');
    });
  });

  describe('Part 2: Bulk Order Idempotency (POST /agent/orders/bulk)', () => {
    it('strictly enforces 8-36 character key length for bulk orders with HTTP 400', async () => {
      // Too short (<8)
      const resShort = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          network: 'MTN',
          recipients: [{ phoneNumber: '0241234567', dataSizeGb: 5 }],
          idempotencyKey: 'short',
        },
      });
      expect(resShort.statusCode).toBe(400);
      expect(JSON.parse(resShort.body).error.message).toContain('between 8 and 36 characters');

      // Too long (>36)
      const resLong = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          network: 'MTN',
          recipients: [{ phoneNumber: '0241234567', dataSizeGb: 5 }],
          idempotencyKey: 'a'.repeat(37),
        },
      });
      expect(resLong.statusCode).toBe(400);
      expect(JSON.parse(resLong.body).error.message).toContain('between 8 and 36 characters');
    });

    it('places bulk order with valid key (8-36 chars) and returns cached order on replay without double debit', async () => {
      const bulkKey = 'bulk-order-key-12345';
      const payload = {
        network: 'MTN',
        recipients: [{ phoneNumber: '0241234567', dataSizeGb: 5 }],
        idempotencyKey: bulkKey,
      };

      // 1. Initial attempt
      const res1 = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload,
      });
      expect(res1.statusCode).toBe(201);
      const json1 = JSON.parse(res1.body).data;
      expect(json1.status).toBe('received');
      expect(walletDebitCount).toBe(1);

      // 2. Replay with identical key + body
      const res2 = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload,
      });
      expect(res2.statusCode).toBe(201);
      const json2 = JSON.parse(res2.body).data;
      expect(json2.id).toBe(json1.id);
      expect(json2.referenceCode).toBe(json1.referenceCode);
      expect(walletDebitCount).toBe(1); // No second debit
    });

    it('rejects bulk order with same key but different body with HTTP 400', async () => {
      const bulkKey = 'bulk-collision-key-999';

      // 1. Initial attempt
      await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          network: 'MTN',
          recipients: [{ phoneNumber: '0241234567', dataSizeGb: 5 }],
          idempotencyKey: bulkKey,
        },
      });

      // 2. Collision attempt with different recipient list
      const resCollision = await app.inject({
        method: 'POST',
        url: '/agent/orders/bulk',
        headers: { 'x-api-key': 'ak_live_valid' },
        payload: {
          network: 'MTN',
          recipients: [{ phoneNumber: '0241234567', dataSizeGb: 2 }],
          idempotencyKey: bulkKey,
        },
      });

      expect(resCollision.statusCode).toBe(400);
      expect(JSON.parse(resCollision.body).error.message).toContain('Idempotency key collision');
    });
  });

  describe('Part 3: Order Lifecycle FSM & Webhooks', () => {
    it('verifies happy path state transitions: received -> processing -> delivered/approved', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('received', 'processing')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'delivered')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'approved')).toBe(true);

      const eventsDelivered = OrderStateMachine.getWebhookEventsForLifecycle('delivered', { isAuto: true });
      expect(eventsDelivered).toContain('order.approved');
      expect(eventsDelivered).toContain('purchase.success');
    });

    it('verifies failure & refund path: processing -> could_not_deliver/rejected -> refunded', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'could_not_deliver')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'rejected')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('could_not_deliver', 'refunded')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('rejected', 'refunded')).toBe(true);

      const eventsRejected = OrderStateMachine.getWebhookEventsForLifecycle('could_not_deliver', { isAuto: true });
      expect(eventsRejected).toContain('order.rejected');
      expect(eventsRejected).toContain('purchase.failed');

      const eventsRefunded = OrderStateMachine.getWebhookEventsForLifecycle('refunded');
      expect(eventsRefunded).toContain('wallet.updated');
    });

    it('verifies mixed batch transition to partially_approved', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'partially_approved')).toBe(true);

      const eventsMixed = OrderStateMachine.getWebhookEventsForLifecycle('partially_approved');
      expect(eventsMixed).toContain('order.partially_approved');
      expect(eventsMixed).toContain('wallet.updated');
    });
  });
});
