import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminFinanceRoutes } from '../../src/routes/commerce/admin-finance.routes.js';
import { adminReconciliationRoutes } from '../../src/routes/commerce/admin-reconciliation.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { ProviderReconciliationService } from '../../src/core/providers/provider-reconciliation.service.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.8: Finance, Transactions & Reconciliation Control Plane', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockClient: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFinancialLedgerService: FinancialLedgerService;
  let mockProviderReconciliationService: ProviderReconciliationService;

  beforeEach(async () => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };

    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
          return {
            rows: [
              {
                id: 'admin_1',
                uuid: 'admin_1',
                email: 'admin@bytebeacon.com',
                status: 'ACTIVE',
                role: UserRole.SUPER_ADMIN,
              },
            ],
          };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateKey: vi.fn(),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockFinancialLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    mockProviderReconciliationService = {
      reconcileStaleOrders: vi.fn().mockResolvedValue({
        reconciliationId: 'rec_101',
        totalChecked: 15,
        discrepancyCount: 0,
      }),
    } as unknown as ProviderReconciliationService;

    app = Fastify();
    await adminFinanceRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
    });
    await adminReconciliationRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      providerReconciliationService: mockProviderReconciliationService,
    });
    await app.ready();
  });

  it('1. GET /admin/finance/overview should return 12 core authoritative KPI metrics', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('"customerBalanceGhs"')) {
        return { rows: [{ customerBalanceGhs: '120.50', agentBalanceGhs: '450.00', totalFloatGhs: '570.50' }] };
      }
      if (sql.includes('"totalRevenue"')) {
        return { rows: [{ totalRevenue: '500000', totalCommissions: '15000' }] };
      }
      if (sql.includes('"totalDeposits"')) {
        return { rows: [{ totalDeposits: '600000', processingCount: '2', processingAmount: '20000', failedCount: '1', failedAmount: '5000' }] };
      }
      if (sql.includes('"totalWithdrawals"')) {
        return { rows: [{ totalWithdrawals: '50000' }] };
      }
      if (sql.includes('"totalRefunds"')) {
        return { rows: [{ totalRefunds: '10000', pendingRefundsCount: '1', pendingRefundsAmount: '3000' }] };
      }
      if (sql.includes('"unreconciledCount"')) {
        return { rows: [{ unreconciledCount: '0' }] };
      }
      if (sql.includes('financial_ledger')) {
        return { rows: [{ totalDebits: '100000', totalCredits: '100000' }] };
      }
      if (sql.includes('GENERATE_SERIES')) {
        return { rows: [{ date: '2026-08-22', revenuePesewas: '50000', depositsPesewas: '60000', refundsPesewas: '1000' }] };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/finance/overview',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.customerWalletBalancePesewas).toBe(12050);
    expect(body.data.agentWalletBalancePesewas).toBe(45000);
    expect(body.data.totalRevenuePesewas).toBe(500000);
    expect(body.data.ledgerBalanceStatus).toBe('BALANCED');
  });

  it('2. GET /admin/finance/transactions should return paginated transactions with multi-filter search', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('COUNT(*) as total FROM payments')) {
        return { rows: [{ total: '1' }] };
      }
      if (sql.includes('SELECT \n          p.id')) {
        return {
          rows: [
            {
              id: 'pay_1',
              reference: 'PST-123',
              type: 'DATA_PURCHASE',
              status: 'PAID',
              amountPesewas: 1500,
              currency: 'GHS',
              userId: 'usr_1',
              userName: 'Kofi Mensah',
              userEmail: 'kofi@example.com',
              userPhone: '0240001111',
              userRole: 'customer',
              network: 'MTN',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/finance/transactions?search=kofi&status=PAID',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].reference).toBe('PST-123');
  });

  it('3. GET /admin/finance/transactions/:id should return complete financial dossier', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('FROM payments p')) {
        return {
          rows: [
            {
              id: 'pay_1',
              reference: 'PST-123',
              type: 'DATA_PURCHASE',
              status: 'PAID',
              amountPesewas: 2500,
              currency: 'GHS',
              provider: 'PAYSTACK',
              providerReference: 'PST-123',
              userId: 'usr_1',
              userName: 'Kofi Mensah',
              userEmail: 'kofi@example.com',
              orderId: 'ord_1',
              orderPublicId: 'ORD-999',
              network: 'MTN',
              createdAt: new Date().toISOString(),
              paid_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (sql.includes('FROM financial_ledger')) {
        return {
          rows: [
            {
              id: 'led_1',
              transactionId: 'txn_j_1',
              entryType: 'DEBIT',
              accountType: 'PLATFORM_ESCROW',
              amountPesewas: 2500,
            },
            {
              id: 'led_2',
              transactionId: 'txn_j_1',
              entryType: 'CREDIT',
              accountType: 'CUSTOMER_WALLET',
              amountPesewas: 2500,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/finance/transactions/pay_1',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.financialMovement.ledgerLines).toHaveLength(2);
    expect(body.data.relatedOrder.publicId).toBe('ORD-999');
  });

  it('4. GET /admin/finance/ledger should enforce continuous double-entry invariant verification', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('COUNT(*) as total FROM financial_ledger')) {
        return { rows: [{ total: '2' }] };
      }
      if (sql.includes('FROM financial_ledger\n        WHERE')) {
        return {
          rows: [
            {
              id: 'led_1',
              transactionId: 'txn_1',
              entryType: 'DEBIT',
              accountType: 'PLATFORM_ESCROW',
              amountPesewas: 5000,
            },
          ],
        };
      }
      if (sql.includes('COALESCE(SUM(CASE WHEN entry_type = \'DEBIT\'')) {
        return { rows: [{ totalDebits: '5000', totalCredits: '5000' }] };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/finance/ledger',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.isBalanced).toBe(true);
    expect(body.data.status).toBe('BALANCED');
  });

  it('5. GET /admin/finance/ledger/anomalies should identify unbalanced journal transactions', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('HAVING COALESCE(SUM(CASE WHEN entry_type = \'DEBIT\'')) {
        return {
          rows: [
            {
              transactionId: 'bad_j_1',
              totalDebits: '5000',
              totalCredits: '4000',
              referenceType: 'PAYMENT',
              referenceId: 'pay_bad',
              detectedAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/finance/ledger/anomalies',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.anomaliesCount).toBe(1);
    expect(body.data.anomalies[0].discrepancyPesewas).toBe(1000);
  });

  it('6. POST /admin/finance/refunds/:id/action should execute balanced ledger reversal', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('FROM refunds r')) {
        return {
          rows: [
            {
              id: 'ref_1',
              order_id: 'ord_1',
              amount_pesewas: 3000,
              status: 'PENDING',
              risk_level: 'STANDARD',
              user_id: 'usr_1',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/finance/refunds/ref_1/action',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: { action: 'APPROVE', reason: 'Customer requested cancellation' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockFinancialLedgerService.recordJournalEntries).toHaveBeenCalled();
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_REFUND_APPROVED' }),
    );
  });

  it('7. POST /admin/finance/adjustments/request should queue float adjustment for Super Admin review', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('SELECT uuid, full_name, email FROM users WHERE uuid = $1')) {
        return { rows: [{ uuid: 'usr_target_1', full_name: 'Target Customer', email: 'target@example.com' }] };
      }
      if (sql.includes('INSERT INTO financial_adjustments')) {
        return {
          rows: [
            {
              id: 'adj_1',
              adjustmentNumber: 'ADJ-123456',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/finance/adjustments/request',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: {
        userId: 'usr_target_1',
        amountPesewas: 10000,
        direction: 'CREDIT',
        reason: 'Customer goodwill voucher compensation',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PENDING');
  });

  it('8. POST /admin/finance/adjustments/:id/action should execute ledger voucher on Super Admin approval', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('FROM financial_adjustments WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'adj_1',
              user_id: 'usr_target_1',
              amount_pesewas: 10000,
              direction: 'CREDIT',
              reason: 'Goodwill compensation',
              status: 'PENDING',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/finance/adjustments/adj_1/action',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: { action: 'APPROVE', reason: 'Verified by Super Admin' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockFinancialLedgerService.recordJournalEntries).toHaveBeenCalled();
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_FLOAT_ADJUSTMENT_APPROVED' }),
    );
  });

  it('9. PUT /admin/finance/safety-controls should update emergency kill switches with audit logging', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/admin/finance/safety-controls',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: {
        settings: {
          emergencyPaymentsDisabled: true,
          globalMaintenanceMode: false,
          maxSingleTransactionPesewas: 1000000,
        },
        reason: 'Emergency gateway maintenance and upgrade',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_FINANCIAL_SAFETY_CONTROLS_UPDATED' }),
    );
  });

  it('10. POST /admin/finance/reprocess/preview and execute should validate and retry failed orders', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('FROM provider_dlq dlq')) {
        return {
          rows: [
            {
              id: 'dlq_1',
              orderId: 'ord_fail_1',
              publicId: 'ORD-FAIL-1',
              recipientPhone: '0241112233',
              network: 'MTN',
              amountPesewas: 1000,
              failureClass: 'TRANSIENT_NETWORK',
              eligibleForRetry: true,
              attemptCount: 1,
            },
          ],
        };
      }
      if (sql.includes('SELECT id, order_id, failure_class')) {
        return {
          rows: [
            { id: 'dlq_1', order_id: 'ord_fail_1', failure_class: 'TRANSIENT_NETWORK', attempt_count: 1 },
          ],
        };
      }
      return { rows: [] };
    });

    const previewRes = await app.inject({
      method: 'POST',
      url: '/admin/finance/reprocess/preview',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(previewRes.statusCode).toBe(200);
    const previewBody = JSON.parse(previewRes.body);
    expect(previewBody.data.eligibleCount).toBe(1);

    const execRes = await app.inject({
      method: 'POST',
      url: '/admin/finance/reprocess/execute',
      headers: { authorization: 'Bearer valid_admin_token' },
      payload: { reprocessAllEligible: true, reason: 'Telco timeout resolved' },
    });

    expect(execRes.statusCode).toBe(200);
    const execBody = JSON.parse(execRes.body);
    expect(execBody.data.reprocessedCount).toBe(1);
  });

  it('11. GET /admin/reconciliation/dashboard and trigger audits should verify cross-system integrity', async () => {
    (mockDb.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users WHERE uuid = $1')) {
        return { rows: [{ id: 'admin_1', uuid: 'admin_1', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }] };
      }
      if (sql.includes('FROM payments')) {
        return { rows: [{ totalPayments: '100', matchedPayments: '99', failedPayments: '1', discrepancyPesewas: '500' }] };
      }
      if (sql.includes('FROM provider_orders')) {
        return { rows: [{ totalCarrierOrders: '50', matchedCarrier: '50', mismatchedCarrier: '0' }] };
      }
      if (sql.includes('FROM financial_ledger')) {
        return { rows: [{ totalJournals: '100', totalDebits: '200000', totalCredits: '200000' }] };
      }
      if (sql.includes('FROM reconciliation_cases')) {
        return { rows: [{ openCases: '1', criticalCases: '0' }] };
      }
      return { rows: [] };
    });

    const dashRes = await app.inject({
      method: 'GET',
      url: '/admin/reconciliation/dashboard',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(dashRes.statusCode).toBe(200);
    const dashBody = JSON.parse(dashRes.body);
    expect(dashBody.data.paystackMetrics.matchRatePercent).toBe(99);
    expect(dashBody.data.ledgerMetrics.integrityPercent).toBe(100);

    const auditRes = await app.inject({
      method: 'POST',
      url: '/admin/reconciliation/trigger/ledger',
      headers: { authorization: 'Bearer valid_admin_token' },
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = JSON.parse(auditRes.body);
    expect(auditBody.data.isBalanced).toBe(true);
  });
});
