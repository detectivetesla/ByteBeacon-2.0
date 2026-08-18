import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../src/core/payments/payment.service.js';
import { FinancialLedgerService } from '../src/core/payments/financial-ledger.service.js';
import { IdempotencyService } from '../src/core/commerce/idempotency.service.js';
import { IPaymentProvider } from '../src/core/payments/payment-provider.interface.js';
import {
  Currency,
  PaymentStatus,
  OrderStatus,
  PaymentMethod,
  UserRole,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Payment Lifecycle & Order Transition Boundary', () => {
  it('should initialize payment from persisted order and transition to READY_FOR_FULFILLMENT on success (never COMPLETED)', async () => {
    let orderPaymentStatus = PaymentStatus.PENDING;
    let orderStatus = OrderStatus.CREATED;
    const ledgerCalls: any[] = [];

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
          if (q.includes('SELECT id, public_id, user_id, amount_pesewas')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_123',
                  public_id: 'ord_pub_123',
                  user_id: 'usr_cust_1',
                  amount_pesewas: 1000, // 10.00 GHS
                  currency: Currency.GHS,
                  payment_status: orderPaymentStatus,
                  order_status: orderStatus,
                },
              ],
            });
          }
          if (q.includes('INSERT INTO payments')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'pay_uuid_1',
                  public_id: 'pay_pub_1',
                  created_at: new Date(),
                },
              ],
            });
          }
          if (q.includes('SELECT id, order_id, user_id, amount_pesewas, currency, status')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'pay_uuid_1',
                  order_id: 'ord_123',
                  user_id: 'usr_cust_1',
                  amount_pesewas: 1000,
                  currency: Currency.GHS,
                  status: PaymentStatus.PENDING,
                  provider_reference: 'pst_ref_123',
                },
              ],
            });
          }
          if (q.includes('UPDATE orders')) {
            orderPaymentStatus = params[0] as PaymentStatus;
            orderStatus = params[1] as OrderStatus;
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as pg.Pool;

    const mockProvider: IPaymentProvider = {
      initializePayment: vi.fn().mockResolvedValue({
        provider: 'PAYSTACK',
        providerReference: 'pst_ref_123',
        authorizationUrl: 'https://checkout.paystack.com/auth_123',
      }),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    const mockLedgerService = {
      recordJournalEntries: vi.fn().mockImplementation((_client, entries) => {
        ledgerCalls.push(...entries);
        return Promise.resolve(entries);
      }),
      getAccountBalance: vi.fn(),
      getEntriesByReference: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    const mockIdempotencyService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyService;

    const paymentService = new PaymentService(
      mockDb,
      mockProvider,
      mockLedgerService,
      mockIdempotencyService,
    );

    // 1. Initialize Payment
    const intent = await paymentService.initializePayment(
      {
        orderId: 'ord_123',
        paymentMethod: PaymentMethod.MOMO,
      },
      {
        userId: 'usr_cust_1',
        userEmail: 'cust@example.com',
        role: UserRole.CUSTOMER,
        correlationId: 'req_1',
        actorType: 'USER',
      },
    );

    expect(intent.paymentId).toBe('pay_uuid_1');
    expect(intent.amountPesewas).toBe(1000); // Strict integer minor units from order
    expect(intent.status).toBe(PaymentStatus.PENDING);
    expect(intent.authorizationUrl).toBe('https://checkout.paystack.com/auth_123');

    // 2. Process Successful Payment (Simulating verified charge.success)
    const processResult = await paymentService.processSuccessfulPayment(
      'pay_uuid_1',
      'pst_ref_123',
      {
        amountPesewas: 1000,
        channel: 'mobile_money',
        authorizationCode: 'AUTH_CODE_1',
        paidAt: new Date(),
      },
      'req_webhook_1',
    );

    expect(processResult.alreadyProcessed).toBe(false);

    // 3. Verify Order Status is READY_FOR_FULFILLMENT (NEVER COMPLETED!)
    expect(orderPaymentStatus).toBe(PaymentStatus.PAID);
    expect(orderStatus).toBe(OrderStatus.READY_FOR_FULFILLMENT);
    expect(orderStatus).not.toBe(OrderStatus.COMPLETED);

    // 4. Verify Double-Entry Ledger Journal Entries
    expect(ledgerCalls).toHaveLength(2);
    expect(ledgerCalls[0].entryType).toBe('DEBIT');
    expect(ledgerCalls[0].accountId).toBe('usr_cust_1');
    expect(ledgerCalls[1].entryType).toBe('CREDIT');
    expect(ledgerCalls[0].amountPesewas).toBe(1000);
    expect(ledgerCalls[1].amountPesewas).toBe(1000);
  });

  it('should prevent cross-tenant payment initialization', async () => {
    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'ord_999',
              user_id: 'usr_tenant_A',
              amount_pesewas: 1000,
              currency: Currency.GHS,
              payment_status: PaymentStatus.PENDING,
              order_status: OrderStatus.CREATED,
            },
          ],
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const mockProvider = {} as IPaymentProvider;
    const mockLedger = {} as FinancialLedgerService;
    const mockIdempotency = { get: vi.fn().mockResolvedValue(null) } as unknown as IdempotencyService;

    const paymentService = new PaymentService(mockDb, mockProvider, mockLedger, mockIdempotency);

    await expect(
      paymentService.initializePayment(
        { orderId: 'ord_999', paymentMethod: PaymentMethod.MOMO },
        {
          userId: 'usr_tenant_B', // Different tenant!
          userEmail: 'b@example.com',
          role: UserRole.CUSTOMER,
          correlationId: 'req_cross',
          actorType: 'USER',
        },
      ),
    ).rejects.toThrow(/You do not have permission/);
  });
});
