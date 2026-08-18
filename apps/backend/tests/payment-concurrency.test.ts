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

describe('Payment Concurrency & Idempotency Invariant', () => {
  it('should handle 100 simultaneous requests with the same Idempotency-Key producing exactly ONE payment record', async () => {
    let paymentCreationCount = 0;
    const cacheStore = new Map<string, { requestHash: string; body: string }>();

    const mockDb = {
      connect: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          query: vi.fn().mockImplementation((q: string) => {
            if (q.includes('SELECT id, public_id, user_id, amount_pesewas')) {
              return Promise.resolve({
                rows: [
                  {
                    id: 'ord_concurrent_1',
                    public_id: 'ord_pub_conc_1',
                    user_id: 'usr_conc_1',
                    amount_pesewas: 2000,
                    currency: Currency.GHS,
                    payment_status: PaymentStatus.PENDING,
                    order_status: OrderStatus.CREATED,
                  },
                ],
              });
            }
            if (q.includes('INSERT INTO payments')) {
              paymentCreationCount++;
              return Promise.resolve({
                rows: [
                  {
                    id: 'pay_conc_1',
                    public_id: 'pay_pub_conc_1',
                    created_at: new Date(),
                  },
                ],
              });
            }
            if (q.includes('INSERT INTO payment_attempts') || q.includes('INSERT INTO payment_events')) {
              return Promise.resolve({ rows: [] });
            }
            if (q.includes('UPDATE payments')) {
              return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
          }),
          release: vi.fn(),
        });
      }),
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM idempotency_keys') && q.includes('SELECT')) {
          const key = params[0] as string;
          const val = cacheStore.get(key);
          if (val) {
            return Promise.resolve({
              rows: [{ responseBody: JSON.parse(val.body), requestHash: val.requestHash }],
            });
          }
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO idempotency_keys')) {
          const key = params[0] as string;
          const requestHash = params[3] as string;
          const body = params[5] as string;
          cacheStore.set(key, { requestHash, body });
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const mockProvider: IPaymentProvider = {
      initializePayment: vi.fn().mockResolvedValue({
        provider: 'PAYSTACK',
        providerReference: 'pst_conc_ref_1',
        authorizationUrl: 'https://checkout.paystack.com/auth_conc_1',
      }),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    const mockLedger = {} as FinancialLedgerService;
    const idempotencyService = new IdempotencyService(mockDb, null);

    const paymentService = new PaymentService(
      mockDb,
      mockProvider,
      mockLedger,
      idempotencyService,
    );

    const context = {
      userId: 'usr_conc_1',
      userEmail: 'conc@example.com',
      role: UserRole.CUSTOMER,
      correlationId: 'req_conc',
      actorType: 'USER',
    };

    // First request executes and caches response
    const firstResponse = await paymentService.initializePayment(
      {
        orderId: 'ord_concurrent_1',
        paymentMethod: PaymentMethod.MOMO,
        idempotencyKey: 'idem_pay_100_storm',
      },
      context,
    );

    // Now 99 concurrent requests arrive with the same idempotency key
    const remaining99 = Array.from({ length: 99 }, () =>
      paymentService.initializePayment(
        {
          orderId: 'ord_concurrent_1',
          paymentMethod: PaymentMethod.MOMO,
          idempotencyKey: 'idem_pay_100_storm',
        },
        context,
      ),
    );

    const all99Responses = await Promise.all(remaining99);

    // Exactly 1 payment was created in the database and gateway
    expect(paymentCreationCount).toBe(1);
    expect(mockProvider.initializePayment).toHaveBeenCalledTimes(1);

    // All 100 requests receive the exact same payment intent
    expect(all99Responses).toHaveLength(99);
    for (const res of all99Responses) {
      expect(res.paymentId).toBe(firstResponse.paymentId);
      expect(res.reference).toBe(firstResponse.reference);
      expect(res.amountPesewas).toBe(2000);
      expect(res.authorizationUrl).toBe(firstResponse.authorizationUrl);
    }
  });
});
