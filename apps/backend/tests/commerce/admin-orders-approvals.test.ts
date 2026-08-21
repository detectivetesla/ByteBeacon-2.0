import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminOrdersRoutes } from '../../src/routes/commerce/admin-orders.routes.js';
import { adminApprovalsRoutes } from '../../src/routes/commerce/admin-approvals.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { BeneficiaryService } from '../../src/core/commerce/beneficiary.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { UserRole, SecurityDomain, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.5: Order & Pending Approval Administration Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFulfillmentQueue: FulfillmentQueueService;
  let mockReconciliationService: ProviderReconciliationService;
  let mockBeneficiaryService: BeneficiaryService;
  let mockLedgerService: FinancialLedgerService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
          });
        }

        if (sql.includes('COUNT(*) as "totalOrders"') && sql.includes('FROM orders')) {
          return Promise.resolve({
            rows: [{
              totalOrders: '100',
              processing: '10',
              completed: '80',
              failed: '5',
              refunded: '3',
              awaitingApproval: '2',
              syncIssues: '1',
              reconciliationRequired: '0',
            }],
          });
        }

        if (sql.includes('SELECT COUNT(DISTINCT o.id) as total FROM orders o')) {
          return Promise.resolve({
            rows: [{ total: '2' }],
          });
        }

        if (sql.includes('SELECT DISTINCT ON (o.created_at, o.id)') && sql.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_test_001',
                userId: 'usr_cust_1',
                recipientPhone: '0241234567',
                network: 'MTN',
                dataAmountMb: 5120,
                amountPesewas: 2500,
                paymentStatus: 'PAID',
                orderStatus: 'COMPLETED',
                providerStatus: 'COMPLETED',
                refundStatus: 'NONE',
                createdAt: new Date().toISOString(),
                userEmail: 'yaw@example.com',
                userName: 'Yaw Omao',
              },
            ],
          });
        }

        if (sql.includes('FROM orders') && (sql.includes('WHERE id = $1') || sql.includes('WHERE o.id = $1'))) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_test_001',
                userId: 'usr_cust_1',
                agentId: null,
                recipientPhone: '0241234567',
                network: 'MTN',
                dataAmountMb: 5120,
                amountPesewas: 2500,
                currency: 'GHS',
                paymentStatus: 'PAID',
                orderStatus: 'COMPLETED',
                providerStatus: 'COMPLETED',
                refundStatus: 'NONE',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('FROM provider_orders WHERE order_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_001',
                providerName: 'DataHouse',
                providerOrderId: 'dh_ord_999',
                providerReference: 'ref_dh_999',
                providerStatus: 'COMPLETED',
                rawPayload: { status: 'SUCCESS', network: 'MTN' },
                lastSyncedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('FROM payment_transactions WHERE order_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_001',
                amountPesewas: 2500,
                paymentStatus: 'PAID',
                provider: 'PAYSTACK',
                reference: 'pst_ref_123',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('FROM refunds WHERE order_id = $1')) {
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('FROM order_events WHERE order_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ev_001',
                eventType: 'ORDER_CREATED',
                actorType: 'CUSTOMER',
                actorId: 'usr_cust_1',
                occurredAt: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('FROM provider_dlq WHERE order_id = $1')) {
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('FROM beneficiary_validation WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ben_001',
                phone_number: '0241234567',
                network: 'MTN',
                validation_status: 'PENDING',
                provider_reference: 'dh_ref_123',
                created_at: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('COUNT(CASE WHEN validation_status IN') && sql.includes('FROM beneficiary_validation')) {
          return Promise.resolve({
            rows: [{
              awaitingApproval: '5',
              approvedToday: '12',
              rejected: '1',
              processing: '2',
              syncFailed: '0',
            }],
          });
        }

        if (sql.includes('SELECT COUNT(*) as total FROM beneficiary_validation')) {
          return Promise.resolve({ rows: [{ total: '5' }] });
        }

        if (sql.includes('FROM beneficiary_validation b') && sql.includes('LIMIT')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ben_001',
                phoneNumber: '0241234567',
                network: 'MTN',
                status: 'PENDING',
                occurrences: 3,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        if (sql.includes('UPDATE orders SET order_status =') || sql.includes('UPDATE orders SET refund_status =')) {
          return Promise.resolve({ rows: [{ id: 'ord_test_001' }] });
        }

        if (sql.includes('INSERT INTO refunds')) {
          return Promise.resolve({ rows: [{ id: 'ref_001' }] });
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
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
      canManageTargetUser: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      log: vi.fn().mockResolvedValue({ id: 'aud_1' }),
    } as unknown as AuditService;

    mockFulfillmentQueue = {
      enqueueOrderFulfillment: vi.fn().mockResolvedValue('job_test_123'),
    } as unknown as FulfillmentQueueService;

    mockReconciliationService = {
      reconcileStaleOrders: vi.fn().mockResolvedValue({
        reconciliationId: 'rec_run_01',
        totalChecked: 10,
        discrepancyCount: 0,
        discrepancies: [],
      }),
    } as unknown as ProviderReconciliationService;

    mockBeneficiaryService = {
      precheckBeneficiaries: vi.fn().mockResolvedValue({
        network: NetworkProvider.MTN,
        enforced: true,
        results: [{ phoneNumber: '0241234567', network: NetworkProvider.MTN, isValid: true, isKnown: true }],
      }),
      approveBeneficiary: vi.fn().mockResolvedValue({
        id: 'ben_001',
        phoneNumber: '0241234567',
        network: NetworkProvider.MTN,
        status: 'VALID',
      }),
      rejectBeneficiary: vi.fn().mockResolvedValue({
        id: 'ben_001',
        phoneNumber: '0241234567',
        network: NetworkProvider.MTN,
        status: 'INVALID',
      }),
    } as unknown as BeneficiaryService;

    mockLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

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
    });

    await adminApprovalsRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      fulfillmentQueueService: mockFulfillmentQueue,
      beneficiaryService: mockBeneficiaryService,
    });
  });

  // 1. Order Statistics
  it('GET /admin/orders/stats returns calculated operational counters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/orders/stats',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalOrders).toBe(100);
    expect(body.data.completed).toBe(80);
    expect(body.data.processing).toBe(10);
    expect(body.data.failed).toBe(5);
  });

  // 2. Orders Search & Filtering
  it('GET /admin/orders queries server-side orders with pagination and filtering', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/orders?page=1&limit=25&network=MTN&lifecycle=COMPLETED',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.orders.length).toBe(1);
    expect(body.data.orders[0].recipientPhone).toBe('0241234567');
  });

  // 3. Individual Order Dossier
  it('GET /admin/orders/:id returns comprehensive order dossier with sanitized provider payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/orders/ord_test_001',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.order.id).toBe('ord_test_001');
    expect(body.data.providerOrder.providerName).toBe('DataHouse');
    expect(body.data.payment.provider).toBe('PAYSTACK');
  });

  // 4. Order Reconciliation
  it('POST /admin/orders/:id/reconcile triggers reconciliation and logs audit event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/reconcile',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockReconciliationService.reconcileStaleOrders).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_RECONCILE' }),
    );
  });

  // 5. Order Retry
  it('POST /admin/orders/:id/retry enqueues fulfillment retry to BullMQ queue', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
      const sql = query.replace(/\s+/g, ' ');
      if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
        });
      }
      if (sql.includes('FROM orders WHERE id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: 'ord_test_001',
              recipient_phone: '0241234567',
              network: NetworkProvider.MTN,
              data_amount_mb: 5120,
              order_status: 'FAILED',
              payment_status: 'PAID',
            },
          ],
        });
      }
      if (sql.includes('UPDATE orders SET order_status =')) {
        return Promise.resolve({ rows: [{ id: 'ord_test_001' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/retry',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockFulfillmentQueue.enqueueOrderFulfillment).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_RETRY' }),
    );
  });

  // 6. Double-Entry Order Refund
  it('POST /admin/orders/:id/refund executes double-entry ledger refund and updates status', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
      const sql = query.replace(/\s+/g, ' ');
      if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
        });
      }
      if (sql.includes('FROM orders WHERE id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: 'ord_test_001',
              user_id: 'usr_cust_1',
              amount_pesewas: 2500,
              refund_status: 'NONE',
              order_status: 'FAILED',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO refunds')) {
        return Promise.resolve({ rows: [{ id: 'ref_001' }] });
      }
      if (sql.includes('UPDATE orders SET refund_status =')) {
        return Promise.resolve({ rows: [{ id: 'ord_test_001' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/orders/ord_test_001/refund',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: { reason: 'Carrier permanently failed to deliver bundle' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockLedgerService.recordJournalEntries).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_REFUND' }),
    );
  });

  // 7. Pending MTN Approvals Stats
  it('GET /admin/pending-approvals/stats returns beneficiary validation statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/pending-approvals/stats',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.awaitingApproval).toBe(5);
    expect(body.data.approvedToday).toBe(12);
  });

  // 8. Pending Approvals Listing
  it('GET /admin/pending-approvals lists beneficiaries with normalized search and counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/pending-approvals?search=0241234567&status=PENDING',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].phoneNumber).toBe('0241234567');
  });

  // 9. Beneficiary Sync
  it('POST /admin/pending-approvals/:id/sync triggers background DataHouse precheck', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/pending-approvals/ben_001/sync',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockBeneficiaryService.precheckBeneficiaries).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BENEFICIARY_SYNC' }),
    );
  });

  // 10. Beneficiary Approve & Release Orders
  it('POST /admin/pending-approvals/:id/approve approves beneficiary and enqueues blocked orders', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
      const sql = query.replace(/\s+/g, ' ');
      if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
        });
      }
      if (sql.includes('FROM orders WHERE recipient_phone = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: 'ord_blocked_01',
              recipient_phone: '0241234567',
              network: NetworkProvider.MTN,
              data_amount_mb: 10240,
            },
          ],
        });
      }
      if (sql.includes('UPDATE orders SET order_status =')) {
        return Promise.resolve({ rows: [{ id: 'ord_blocked_01' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/pending-approvals/ben_001/approve',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockBeneficiaryService.approveBeneficiary).toHaveBeenCalledWith('ben_001');
    expect(mockFulfillmentQueue.enqueueOrderFulfillment).toHaveBeenCalled();
  });
});
