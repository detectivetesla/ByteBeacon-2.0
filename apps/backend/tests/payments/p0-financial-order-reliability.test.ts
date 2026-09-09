import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelecomProviderRegistry } from '../../src/core/providers/telecom-provider.registry.js';
import { RefundService } from '../../src/core/payments/refund.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import {
  Currency,
  NetworkProvider,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('P0 Financial & Order Reliability Test Suite', () => {
  describe('1. Dynamic Telecom Provider Switching & Carrier Routing', () => {
    it('should immediately update primary carrier routing for all networks when active provider is switched', () => {
      const mockDhProvider: ITelecomProvider = {
        providerName: 'DataHouse',
        submitOrder: vi.fn(),
        getOrderStatus: vi.fn(),
        validateBeneficiary: vi.fn(),
        getHealth: vi.fn(),
      };

      const mockGmplProvider: ITelecomProvider = {
        providerName: 'GMPL',
        submitOrder: vi.fn(),
        getOrderStatus: vi.fn(),
        validateBeneficiary: vi.fn(),
        getHealth: vi.fn(),
      };

      const mockPortal02Provider: ITelecomProvider = {
        providerName: 'Portal-02',
        submitOrder: vi.fn(),
        getOrderStatus: vi.fn(),
        validateBeneficiary: vi.fn(),
        getHealth: vi.fn(),
      };

      const registry = new TelecomProviderRegistry();
      registry.registerProvider('DataHouse', mockDhProvider, { isAuthoritative: true });
      registry.registerProvider('GMPL', mockGmplProvider, { isAuthoritative: false });
      registry.registerProvider('Portal-02', mockPortal02Provider, { isAuthoritative: false });

      // Initially, active provider is DataHouse
      expect(registry.providerName).toBe('DataHouse');
      expect(registry.getProviderForNetwork(NetworkProvider.MTN).providerName).toBe('DataHouse');

      // Admin switches authoritative provider to Portal-02
      registry.setActiveProvider('Portal-02');

      // Carrier routing for MTN, TELECEL, AIRTELTIGO must immediately route to Portal-02
      expect(registry.providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.MTN).providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.TELECEL).providerName).toBe('Portal-02');
      expect(registry.getProviderForNetwork(NetworkProvider.AIRTELTIGO).providerName).toBe('Portal-02');

      // Admin switches to GMPL
      registry.setActiveProvider('GMPL');
      expect(registry.providerName).toBe('GMPL');
      expect(registry.getProviderForNetwork(NetworkProvider.MTN).providerName).toBe('GMPL');
    });
  });

  describe('2. Automated Failure Refund & Double-Entry Financial Ledger', () => {
    let mockClient: any;
    let mockDb: pg.Pool;
    let mockLedgerService: FinancialLedgerService;
    let mockPaymentProvider: IPaymentProvider;
    let mockIdempotencyService: IdempotencyService;
    let ledgerEntries: any[];

    beforeEach(() => {
      ledgerEntries = [];
      mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockDb = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn(),
      } as unknown as pg.Pool;

      mockLedgerService = {
        recordJournalEntries: vi.fn().mockImplementation((_client, entries) => {
          ledgerEntries.push(...entries);
          return Promise.resolve(entries);
        }),
      } as unknown as FinancialLedgerService;

      mockPaymentProvider = {
        initializePayment: vi.fn(),
        verifyPayment: vi.fn(),
        initiateRefund: vi.fn(),
        verifyWebhookSignature: vi.fn(),
      };

      mockIdempotencyService = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      } as unknown as IdempotencyService;
    });

    it('should atomically refund debited wallet, write balanced double-entry lines, and be idempotent', async () => {
      let userBalance = 5000;
      let orderStatus = OrderStatus.READY_FOR_FULFILLMENT;
      let paymentStatus = PaymentStatus.PAID;
      let refundStatus = RefundStatus.NONE;
      const insertedRefunds: any[] = [];

      mockClient.query.mockImplementation((q: string, params?: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('FROM orders') && q.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_p0_fail',
                public_id: 'ord_p0_pub',
                user_id: 'usr_p0',
                amount_pesewas: 2500, // GH₵ 25.00
                currency: Currency.GHS,
                payment_status: paymentStatus,
                order_status: orderStatus,
                refund_status: refundStatus,
              },
            ],
          });
        }
        if (q.includes('FROM payments')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_p0',
                provider: 'WALLET',
                payment_method: 'WALLET',
                provider_reference: 'pst_wal_p0',
                amount_pesewas: 2500,
                currency: Currency.GHS,
                status: paymentStatus,
              },
            ],
          });
        }
        if (q.includes('FROM refunds WHERE')) {
          return Promise.resolve({ rows: insertedRefunds });
        }
        if (q.includes('INSERT INTO refunds')) {
          const row = {
            id: 'ref_p0_1',
            public_id: 'ref_p0_pub_1',
            created_at: new Date(),
            updated_at: new Date(),
          };
          insertedRefunds.push(row);
          return Promise.resolve({ rows: [row] });
        }
        if (q.includes('UPDATE payments SET status')) {
          paymentStatus = PaymentStatus.REFUNDED;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('UPDATE orders')) {
          refundStatus = RefundStatus.COMPLETED;
          orderStatus = OrderStatus.FAILED;
          paymentStatus = PaymentStatus.REFUNDED;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('UPDATE users')) {
          userBalance += params![0];
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('SELECT wallet_balance_pesewas')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: userBalance, wallet_balance: (userBalance / 100).toFixed(2) }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const refundService = new RefundService(
        mockDb,
        mockPaymentProvider,
        mockLedgerService,
        mockIdempotencyService,
      );

      // 1. Initial refund execution on failure
      const result = await refundService.executeAutomatedOrderRefund(
        'ord_p0_fail',
        'Provider terminal rejection',
        'corr_p0',
      );

      expect(result.success).toBe(true);
      expect(result.amountRefundedPesewas).toBe(2500);
      expect(userBalance).toBe(7500); // 5000 + 2500
      expect(orderStatus).toBe(OrderStatus.FAILED);
      expect(paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(refundStatus).toBe(RefundStatus.COMPLETED);
      expect(insertedRefunds).toHaveLength(1);

      // 2. Verify double-entry ledger balance: Total Debits == Total Credits
      expect(ledgerEntries).toHaveLength(2);
      const debitEntry = ledgerEntries.find((e) => e.entryType === 'DEBIT');
      const creditEntry = ledgerEntries.find((e) => e.entryType === 'CREDIT');

      expect(debitEntry).toBeDefined();
      expect(debitEntry.accountType).toBe('PLATFORM_ESCROW');
      expect(debitEntry.amountPesewas).toBe(2500);

      expect(creditEntry).toBeDefined();
      expect(creditEntry.accountType).toBe('CUSTOMER_WALLET');
      expect(creditEntry.accountId).toBe('usr_p0');
      expect(creditEntry.amountPesewas).toBe(2500);

      expect(debitEntry.amountPesewas).toBe(creditEntry.amountPesewas);

      // 3. Re-running refund must be an idempotent no-op with no extra balance addition
      const secondCall = await refundService.executeAutomatedOrderRefund(
        'ord_p0_fail',
        'Provider terminal rejection retry',
        'corr_p0_retry',
      );

      expect(secondCall.success).toBe(true);
      expect(secondCall.alreadyRefunded).toBe(true);
      expect(userBalance).toBe(7500); // Balance unchanged
      expect(ledgerEntries).toHaveLength(2); // No extra ledger entries
    });
  });

  describe('3. Authoritative Revenue Formula Verification', () => {
    it('should strictly exclude FAILED, CANCELLED, and REFUNDED orders from net revenue', () => {
      const orders = [
        { id: '1', order_status: 'COMPLETED', payment_status: 'PAID', refund_status: 'NONE', amount_pesewas: 1000 },
        { id: '2', order_status: 'DELIVERED', payment_status: 'PAID', refund_status: 'NONE', amount_pesewas: 1500 },
        { id: '3', order_status: 'FAILED', payment_status: 'PAID', refund_status: 'COMPLETED', amount_pesewas: 2000 }, // Failed & refunded
        { id: '4', order_status: 'FAILED', payment_status: 'REFUNDED', refund_status: 'COMPLETED', amount_pesewas: 800 },
        { id: '5', order_status: 'CANCELLED', payment_status: 'PAID', refund_status: 'NONE', amount_pesewas: 500 },
        { id: '6', order_status: 'PENDING', payment_status: 'PAID', refund_status: 'NONE', amount_pesewas: 3000 },
        { id: '7', order_status: 'PROCESSING', payment_status: 'PAID', refund_status: 'NONE', amount_pesewas: 1200 },
      ];

      // Authoritative Net Revenue SQL filter:
      // WHERE order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'
      const netRevenue = orders
        .filter(
          (o) =>
            ['COMPLETED', 'DELIVERED'].includes(o.order_status) &&
            o.payment_status === 'PAID' &&
            o.refund_status !== 'COMPLETED',
        )
        .reduce((sum, o) => sum + o.amount_pesewas, 0);

      // Only orders 1 (1000) and 2 (1500) must be included = 2500 pesewas (GH₵ 25.00)
      expect(netRevenue).toBe(2500);

      // Ensure that naive sum (which included failed, cancelled, and pending orders) is rejected
      const naiveSum = orders.reduce((sum, o) => sum + o.amount_pesewas, 0);
      expect(naiveSum).toBe(10000);
      expect(netRevenue).not.toBe(naiveSum);
    });
  });
});
