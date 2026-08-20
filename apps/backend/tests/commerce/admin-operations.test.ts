import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminOperationsRoutes } from '../../src/routes/commerce/admin-operations.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { UserRole, SecurityDomain, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Operations, DLQ Management & Reconciliation Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFulfillmentQueue: FulfillmentQueueService;
  let mockReconciliationService: ProviderReconciliationService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1') || sql.includes('FROM users WHERE uuid = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: 'admin' }],
          });
        }
        if (sql.includes('SELECT COUNT(*) as total FROM provider_dlq')) {
          return Promise.resolve({
            rows: [{ total: '2' }],
          });
        }
        if (sql.includes('FROM provider_dlq') && sql.includes('ORDER BY created_at DESC')) {
          return Promise.resolve({
            rows: [
              {
                id: 'dlq_1',
                orderId: 'ord_123',
                provider: 'DATAHOUSE',
                attemptCount: 5,
                errorCode: 'GATEWAY_TIMEOUT',
                errorMessage: 'Carrier upstream gateway did not respond within 30s',
                status: 'PENDING_REVIEW',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (sql.includes('FROM provider_dlq WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'dlq_1',
                order_id: 'ord_123',
                correlation_id: 'req_123',
              },
            ],
          });
        }
        if (sql.includes('FROM orders WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_123',
                recipient_phone: '0241112233',
                network: NetworkProvider.MTN,
                data_amount_mb: 10240,
              },
            ],
          });
        }
        if (sql.includes('UPDATE provider_dlq SET status =')) {
          return Promise.resolve({
            rows: [{ id: 'dlq_1', status: 'RESOLVED' }],
          });
        }
        if (sql.includes('FROM provider_dlq q JOIN orders o ON q.order_id = o.id')) {
          return Promise.resolve({
            rows: [
              {
                dlqId: 'dlq_1',
                order_id: 'ord_123',
                correlation_id: 'req_123',
                recipient_phone: '0241112233',
                network: NetworkProvider.MTN,
                data_amount_mb: 10240,
              },
            ],
          });
        }
        if (sql.includes('FROM provider_orders')) {
          return Promise.resolve({
            rows: [
              {
                totalOrders: '1420',
                completedOrders: '1420',
                pendingOrders: '0',
                failedOrders: '0',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.ADMIN,
        domain: SecurityDomain.ADMIN,
        status: 'ACTIVE',
        sessionId: 'sess_admin_1',
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

    mockFulfillmentQueue = {
      enqueueOrderFulfillment: vi.fn().mockResolvedValue({ jobId: 'order_ord_123', isEnqueued: true }),
    } as unknown as FulfillmentQueueService;

    mockReconciliationService = {
      reconcileStaleOrders: vi.fn().mockResolvedValue({
        reconciliationId: 'rec_run_999',
        reconciliationDate: new Date().toISOString(),
        totalChecked: 1420,
        matchedCount: 1420,
        discrepancyCount: 0,
        discrepancies: [],
      }),
    } as unknown as ProviderReconciliationService;

    app = Fastify();
    await app.register(adminOperationsRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      fulfillmentQueueService: mockFulfillmentQueue,
      providerReconciliationService: mockReconciliationService,
    });
  });

  describe('Dead Letter Queue (DLQ) Management', () => {
    it('GET /admin/dlq should return paginated list of failed events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq?status=PENDING_REVIEW',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].errorCode).toBe('GATEWAY_TIMEOUT');
    });

    it('POST /admin/dlq/:id/retry should re-enqueue order for fulfillment and resolve DLQ item', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/dlq/dlq_1/retry',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);

      expect(mockFulfillmentQueue.enqueueOrderFulfillment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord_123',
          phoneNumber: '0241112233',
          network: 'MTN',
          dataAmountMb: 10240,
        }),
      );
    });

    it('POST /admin/dlq/replay-all should batch retry all pending DLQ items', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/dlq/replay-all',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.replayedCount).toBe(1);
    });
  });

  describe('Automated Reconciliation Engine', () => {
    it('GET /admin/reconciliation/summary should return settlement match percentage', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/reconciliation/summary',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.settlementMatchPercent).toBe(100);
      expect(json.data.totalChecked).toBe(1420);
    });

    it('POST /admin/reconciliation/trigger should trigger audit run and return summary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/reconciliation/trigger',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.totalChecked).toBe(1420);
      expect(json.data.discrepancyCount).toBe(0);
      expect(mockReconciliationService.reconcileStaleOrders).toHaveBeenCalled();
    });
  });
});
