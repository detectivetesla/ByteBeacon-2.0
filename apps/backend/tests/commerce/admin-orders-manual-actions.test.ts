import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminOrdersRoutes } from '../../src/routes/commerce/admin-orders.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { RefundService } from '../../src/core/payments/refund.service.js';
import { UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Orders: Manual Complete and Fail Actions', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFulfillmentQueue: FulfillmentQueueService;
  let mockReconciliationService: ProviderReconciliationService;
  let mockLedgerService: FinancialLedgerService;
  let mockRefundService: RefundService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
          });
        }

        if (sql.includes('FROM orders o WHERE o.id = $1')) {
          const id = params?.[0] || 'ord_test_001';
          return Promise.resolve({
            rows: [
              {
                id,
                userId: 'usr_cust_1',
                agentId: null,
                orderStatus: id === 'ord_failed_01' ? 'FAILED' : 'PROCESSING',
                paymentStatus: 'PAID',
                refundStatus: 'NONE',
                recipientPhone: '0241234567',
                network: 'MTN',
                dataAmountMb: 1024,
                amountPesewas: 1500,
                publicId: 'ORD-TEST-001',
              },
            ],
          });
        }

        if (sql.includes('UPDATE orders') || sql.includes('UPDATE provider_orders')) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }

        if (sql.includes('INSERT INTO order_events')) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }

        if (sql.includes('UPDATE users')) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }

        if (sql.includes('INSERT INTO refunds')) {
          return Promise.resolve({ rowCount: 1, rows: [{ id: 'ref_123' }] });
        }

        if (sql.includes('INSERT INTO financial_ledger')) {
          return Promise.resolve({ rowCount: 2, rows: [] });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        sub: 'usr_admin_1',
        role: UserRole.ADMIN,
        tokenVersion: 1,
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;

    mockRbacService = {
      requireRole: () => async () => {},
      requirePermission: () => async () => {},
    } as unknown as RbacService;

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockFulfillmentQueue = {
      enqueueOrderFulfillment: vi.fn().mockResolvedValue(undefined),
    } as unknown as FulfillmentQueueService;

    mockReconciliationService = {
      reconcileStaleOrders: vi.fn().mockResolvedValue({}),
    } as unknown as ProviderReconciliationService;

    mockLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    mockRefundService = {
      executeAutomatedOrderRefund: vi.fn().mockResolvedValue({
        success: true,
        refundId: 'ref_auto_001',
        amountPesewas: 1500,
      }),
    } as unknown as RefundService;

    app = Fastify();
    await adminOrdersRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      fulfillmentQueueService: mockFulfillmentQueue,
      providerReconciliationService: mockReconciliationService,
      financialLedgerService: mockLedgerService,
      refundService: mockRefundService,
    });
  });

  it('POST /admin/orders/:id/complete marks order as COMPLETED and unpauses it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/complete',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: { reason: 'Order confirmed delivered by carrier' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.orderStatus).toBe('COMPLETED');
    expect(body.data.deliveryStatus).toBe('DELIVERED');
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_MANUALLY_COMPLETED',
        resourceId: 'ord_test_001',
      }),
    );
  });

  it('POST /admin/orders/:id/approve is an alias that also marks order as COMPLETED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/approve',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: { reason: 'Admin approval override' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.orderStatus).toBe('COMPLETED');
  });

  it('POST /admin/orders/:id/fail marks order as FAILED and triggers automated refund for paid order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/fail',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: { reason: 'Telco timeout, bundle could not be delivered' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.orderStatus).toBe('FAILED');
    expect(body.data.refundProcessed).toBe(true);
    expect(mockRefundService.executeAutomatedOrderRefund).toHaveBeenCalledWith(
      'ord_test_001',
      'Telco timeout, bundle could not be delivered',
      expect.any(String),
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_MANUALLY_FAILED',
        resourceId: 'ord_test_001',
      }),
    );
  });
});
