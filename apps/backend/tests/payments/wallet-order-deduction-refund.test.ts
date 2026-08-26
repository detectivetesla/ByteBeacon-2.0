import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../../src/core/commerce/order.service.js';
import { PaymentService } from '../../src/core/payments/payment.service.js';
import { BulkOrderService } from '../../src/core/commerce/bulk-order.service.js';
import { RefundService } from '../../src/core/payments/refund.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { CatalogService } from '../../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../../src/core/commerce/idempotency.service.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import {
  Currency,
  NetworkProvider,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  UserRole,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Wallet Deduction & Refund End-to-End Suite', () => {
  let mockClient: any;
  let mockDb: pg.Pool;
  let mockCatalogService: CatalogService;
  let mockIdempotencyService: IdempotencyService;
  let mockLedgerService: FinancialLedgerService;
  let mockPaymentProvider: IPaymentProvider;
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

    mockCatalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_1',
        name: 'MTN 1GB',
        network: NetworkProvider.MTN,
        dataAmountMb: 1024,
        basePricePesewas: 500, // GH₵ 5.00
        isActive: true,
      }),
    } as unknown as CatalogService;

    mockIdempotencyService = {
      computeHash: vi.fn().mockReturnValue('hash_123'),
      getExistingResponse: vi.fn().mockResolvedValue(null),
      saveResponse: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyService;

    mockLedgerService = {
      recordJournalEntries: vi.fn().mockImplementation((_client, entries) => {
        ledgerEntries.push(...entries);
        return Promise.resolve(entries);
      }),
      getAccountBalance: vi.fn().mockResolvedValue({ balancePesewas: 1000 }),
    } as unknown as FinancialLedgerService;

    mockPaymentProvider = {
      initializePayment: vi.fn(),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };
  });

  describe('1. Single Order Placement with Wallet Payment', () => {
    it('should successfully deduct wallet balance, mark order PAID/READY_FOR_FULFILLMENT and record ledger entries', async () => {
      let userBalancePesewas = 2000; // GH₵ 20.00
      const queryHistory: string[] = [];

      mockClient.query.mockImplementation((q: string, params?: any[]) => {
        queryHistory.push(q);
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('SELECT custom_price_pesewas FROM user_pricing')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('SELECT custom_price_pesewas FROM agent_pricing')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: userBalancePesewas, wallet_balance: (userBalancePesewas / 100).toFixed(2) }],
          });
        }
        if (q.includes('UPDATE users')) {
          const deduct = params![0];
          userBalancePesewas -= deduct;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('INSERT INTO orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_uuid_1',
                publicId: 'ord_pub_1',
                userId: 'usr_1',
                agentId: null,
                productId: 'prod_1',
                recipientPhone: '0241234567',
                network: NetworkProvider.MTN,
                dataAmountMb: 1024,
                amountPesewas: 500,
                currency: Currency.GHS,
                pricingSnapshot: {},
                paymentStatus: PaymentStatus.PAID,
                orderStatus: OrderStatus.READY_FOR_FULFILLMENT,
                providerStatus: 'UNKNOWN',
                refundStatus: RefundStatus.NONE,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO order_items') || q.includes('INSERT INTO provider_orders')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO order_events')) {
          return Promise.resolve({
            rows: [
              {
                id: 'evt_1',
                eventType: 'ORDER_CREATED',
                correlationId: 'corr_1',
                actorId: 'usr_1',
                actorType: 'CUSTOMER',
                previousState: null,
                newState: { orderStatus: OrderStatus.READY_FOR_FULFILLMENT, paymentStatus: PaymentStatus.PAID },
                metadata: {},
                occurredAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO payments')) {
          return Promise.resolve({
            rows: [{ id: 'pay_uuid_1', publicId: 'pay_pub_1', createdAt: new Date() }],
          });
        }
        if (q.includes('INSERT INTO payment_attempts') || q.includes('INSERT INTO payment_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderService = new OrderService(
        mockDb,
        mockCatalogService,
        mockIdempotencyService,
        mockLedgerService,
      );

      const result = await orderService.createOrder(
        {
          productId: 'prod_1',
          recipientPhone: '0241234567',
          paymentMethod: PaymentMethod.WALLET,
        },
        {
          userId: 'usr_1',
          correlationId: 'req_order_1',
          actorType: 'CUSTOMER',
        },
      );

      expect(result.order.paymentStatus).toBe(PaymentStatus.PAID);
      expect(result.order.orderStatus).toBe(OrderStatus.READY_FOR_FULFILLMENT);
      expect(result.order.amountPesewas).toBe(500);

      // Verify wallet deduction
      expect(userBalancePesewas).toBe(1500); // 2000 - 500

      // Verify Double-Entry Journal Recording
      expect(mockLedgerService.recordJournalEntries).toHaveBeenCalledTimes(1);
      expect(ledgerEntries).toHaveLength(2);
      expect(ledgerEntries[0]).toMatchObject({
        entryType: 'DEBIT',
        accountType: 'CUSTOMER_WALLET',
        accountId: 'usr_1',
        amountPesewas: 500,
      });
      expect(ledgerEntries[1]).toMatchObject({
        entryType: 'CREDIT',
        accountType: 'PLATFORM_ESCROW',
        amountPesewas: 500,
      });
    });

    it('should reject order creation if user has insufficient wallet balance', async () => {
      mockClient.query.mockImplementation((q: string) => {
        if (q === 'BEGIN' || q === 'ROLLBACK') return Promise.resolve({ rows: [] });
        if (q.includes('SELECT custom_price_pesewas FROM user_pricing')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT custom_price_pesewas FROM agent_pricing')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 200, wallet_balance: '2.00' }], // Only 200 pesewas, need 500
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const orderService = new OrderService(
        mockDb,
        mockCatalogService,
        mockIdempotencyService,
        mockLedgerService,
      );

      await expect(
        orderService.createOrder(
          {
            productId: 'prod_1',
            recipientPhone: '0241234567',
            paymentMethod: PaymentMethod.WALLET,
          },
          {
            userId: 'usr_1',
            correlationId: 'req_order_2',
            actorType: 'CUSTOMER',
          },
        ),
      ).rejects.toThrow(/Insufficient wallet balance/);
    });
  });

  describe('2. Payment Initialization with Wallet Payment', () => {
    it('should deduct wallet balance and transition pending order to PAID when paying via wallet', async () => {
      let userBalancePesewas = 5000;

      mockClient.query.mockImplementation((q: string, params?: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return Promise.resolve({ rows: [] });
        if (q.includes('FROM orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_uuid_2',
                public_id: 'ord_pub_2',
                user_id: 'usr_1',
                amount_pesewas: 1000, // GH₵ 10.00
                currency: Currency.GHS,
                payment_status: PaymentStatus.PENDING,
                order_status: OrderStatus.CREATED,
              },
            ],
          });
        }
        if (q.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: userBalancePesewas, wallet_balance: (userBalancePesewas / 100).toFixed(2) }],
          });
        }
        if (q.includes('UPDATE users')) {
          const deduct = params![0];
          userBalancePesewas -= deduct;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('INSERT INTO payments')) {
          return Promise.resolve({
            rows: [{ id: 'pay_uuid_2', public_id: 'pay_pub_2', created_at: new Date() }],
          });
        }
        if (q.includes('INSERT INTO payment_attempts') || q.includes('INSERT INTO payment_events')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE orders')) {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (q.includes('INSERT INTO order_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const paymentService = new PaymentService(
        mockDb,
        mockPaymentProvider,
        mockLedgerService,
        mockIdempotencyService,
      );

      const intent = await paymentService.initializePayment(
        {
          orderId: 'ord_uuid_2',
          paymentMethod: PaymentMethod.WALLET,
        },
        {
          userId: 'usr_1',
          userEmail: 'user@example.com',
          role: UserRole.CUSTOMER,
          correlationId: 'req_pay_1',
        },
      );

      expect(intent.status).toBe(PaymentStatus.PAID);
      expect(intent.amountPesewas).toBe(1000);
      expect(userBalancePesewas).toBe(4000); // 5000 - 1000

      // Verify double-entry ledger lines
      expect(ledgerEntries).toHaveLength(2);
      expect(ledgerEntries[0]).toMatchObject({
        entryType: 'DEBIT',
        accountType: 'CUSTOMER_WALLET',
        accountId: 'usr_1',
        amountPesewas: 1000,
      });
      expect(ledgerEntries[1]).toMatchObject({
        entryType: 'CREDIT',
        accountType: 'PLATFORM_ESCROW',
        amountPesewas: 1000,
      });
    });
  });

  describe('3. Bulk Order Placement with Wallet', () => {
    it('should deduct wallet and record ledger lines in placeAgentBulkOrder', async () => {
      let agentBalancePesewas = 10000; // GH₵ 100.00

      mockClient.query.mockImplementation((q: string, params?: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return Promise.resolve({ rows: [] });
        if (q.includes('SELECT id, agent_price_pesewas')) {
          return Promise.resolve({
            rows: [{ id: 'prod_mtn_1gb', agentPrice: 420, basePrice: 500 }],
          });
        }
        if (q.includes('SELECT custom_price_pesewas FROM user_pricing')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT ap.custom_price_pesewas FROM agent_pricing')) return Promise.resolve({ rows: [] });
        if (q.includes('INSERT INTO orders')) {
          return Promise.resolve({ rows: [{ id: 'ord_child_1' }] });
        }
        if (q.includes('INSERT INTO provider_orders')) return Promise.resolve({ rows: [] });
        if (q.includes('INSERT INTO bulk_submissions')) {
          return Promise.resolve({ rows: [{ id: 'sub_uuid_1' }] });
        }
        if (q.includes('INSERT INTO bulk_submission_items')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: agentBalancePesewas, wallet_balance: (agentBalancePesewas / 100).toFixed(2) }],
          });
        }
        if (q.includes('UPDATE users')) {
          const deduct = params![0];
          agentBalancePesewas -= deduct;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      (mockDb.query as any).mockImplementation((q: string) => {
        if (q.includes('beneficiary_validation') || q.includes('FROM orders')) {
          return Promise.resolve({
            rows: [{ phone: '0241111111' }, { phone: '0242222222' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bulkOrderService = new BulkOrderService(
        mockDb,
        mockCatalogService,
        mockLedgerService,
      );

      const result = await bulkOrderService.placeAgentBulkOrder({
        agentOrUserId: 'usr_agent_1',
        network: 'MTN',
        recipients: [
          { phoneNumber: '0241111111', dataSizeGb: 1 },
          { phoneNumber: '0242222222', dataSizeGb: 1 },
        ],
        idempotencyKey: 'idemp_bulk_1',
      });

      expect(result.beneficiaryCount).toBe(2);
      expect(result.amount).toBe('8.40'); // 2 * 4.20 = 8.40 GHS = 840 pesewas
      expect(agentBalancePesewas).toBe(9160); // 10000 - 840

      expect(ledgerEntries).toHaveLength(2);
      expect(ledgerEntries[0]).toMatchObject({
        entryType: 'DEBIT',
        accountType: 'CUSTOMER_WALLET',
        accountId: 'usr_agent_1',
        amountPesewas: 840,
      });
      expect(ledgerEntries[1]).toMatchObject({
        entryType: 'CREDIT',
        accountType: 'PLATFORM_ESCROW',
        amountPesewas: 840,
      });
    });
  });

  describe('4. Refund Flow to Wallet', () => {
    it('should credit wallet balance in users table and reverse financial ledger for wallet-paid orders without external gateway calls', async () => {
      let userBalancePesewas = 1000;

      mockClient.query.mockImplementation((q: string, params?: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return Promise.resolve({ rows: [] });
        if (q.includes('FROM orders')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_wallet_paid',
                user_id: 'usr_cust_1',
                amount_pesewas: 500,
                currency: Currency.GHS,
                payment_status: PaymentStatus.PAID,
                order_status: OrderStatus.FAILED,
                refund_status: RefundStatus.NONE,
              },
            ],
          });
        }
        if (q.includes('FROM payments')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_wal_1',
                provider: 'WALLET',
                payment_method: 'WALLET',
                provider_reference: 'pst_wal_ref_1',
                amount_pesewas: 500,
                currency: Currency.GHS,
                status: PaymentStatus.PAID,
              },
            ],
          });
        }
        if (q.includes('FROM refunds')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO refunds')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ref_1',
                public_id: 'ref_pub_1',
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO refund_events') || q.includes('UPDATE payments') || q.includes('UPDATE orders') || q.includes('INSERT INTO order_events')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE users')) {
          const credit = params![0];
          userBalancePesewas += credit;
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const refundService = new RefundService(
        mockDb,
        mockPaymentProvider,
        mockLedgerService,
        mockIdempotencyService,
      );

      const result = await refundService.requestRefund(
        { orderId: 'ord_wallet_paid', reason: 'Fulfillment failed' },
        { userId: 'usr_cust_1', role: UserRole.CUSTOMER, correlationId: 'req_rf_1', actorType: 'USER' },
      );

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(result.amountPesewas).toBe(500);

      // External provider refund must NOT be called for internal wallet payments
      expect(mockPaymentProvider.initiateRefund).not.toHaveBeenCalled();

      // Wallet balance must be credited in users table
      expect(userBalancePesewas).toBe(1500); // 1000 + 500

      // Financial Ledger Reversal: DEBIT PLATFORM_ESCROW, CREDIT CUSTOMER_WALLET
      expect(ledgerEntries).toHaveLength(2);
      expect(ledgerEntries[0]).toMatchObject({
        entryType: 'DEBIT',
        accountType: 'PLATFORM_ESCROW',
        amountPesewas: 500,
      });
      expect(ledgerEntries[1]).toMatchObject({
        entryType: 'CREDIT',
        accountType: 'CUSTOMER_WALLET',
        accountId: 'usr_cust_1',
        amountPesewas: 500,
      });
    });
  });
});
