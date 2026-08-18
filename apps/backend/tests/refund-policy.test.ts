import { describe, it, expect, vi } from 'vitest';
import { RefundService } from '../src/core/payments/refund.service.js';
import { FinancialLedgerService } from '../src/core/payments/financial-ledger.service.js';
import { IdempotencyService } from '../src/core/commerce/idempotency.service.js';
import { IPaymentProvider } from '../src/core/payments/payment-provider.interface.js';
import {
  Currency,
  PaymentStatus,
  RefundStatus,
  OrderStatus,
  UserRole,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Refund Policy Engine & Idempotent Reversals', () => {
  it('should reject refund request if payment was never captured', async () => {
    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'ord_unpaid',
              user_id: 'usr_1',
              amount_pesewas: 1000,
              payment_status: PaymentStatus.PENDING, // Never captured!
              order_status: OrderStatus.FAILED,
              refund_status: RefundStatus.NONE,
            },
          ],
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const mockProvider = {} as IPaymentProvider;
    const mockLedger = {} as FinancialLedgerService;
    const mockIdempotency = { get: vi.fn().mockResolvedValue(null) } as unknown as IdempotencyService;

    const refundService = new RefundService(mockDb, mockProvider, mockLedger, mockIdempotency);

    await expect(
      refundService.requestRefund(
        { orderId: 'ord_unpaid', reason: 'Failed fulfillment' },
        { userId: 'usr_1', role: UserRole.CUSTOMER, correlationId: 'req_1', actorType: 'USER' },
      ),
    ).rejects.toThrow(/Payment was never captured/);
  });

  it('should process full refund, initiate provider refund, and reverse financial ledger', async () => {
    const ledgerCalls: any[] = [];
    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string) => {
          if (q.includes('FROM orders')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_paid',
                  user_id: 'usr_cust_1',
                  amount_pesewas: 5000,
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
                  id: 'pay_1',
                  provider_reference: 'pst_ref_1',
                  amount_pesewas: 5000,
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
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const mockProvider: IPaymentProvider = {
      initializePayment: vi.fn(),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn().mockResolvedValue({
        provider: 'PAYSTACK',
        providerRefundReference: 'pst_rf_123',
        status: 'SUCCESS',
        amountPesewas: 5000,
      }),
      verifyWebhookSignature: vi.fn(),
    };

    const mockLedger = {
      recordJournalEntries: vi.fn().mockImplementation((_client, entries) => {
        ledgerCalls.push(...entries);
        return Promise.resolve(entries);
      }),
    } as unknown as FinancialLedgerService;

    const mockIdempotency = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyService;

    const refundService = new RefundService(mockDb, mockProvider, mockLedger, mockIdempotency);

    const result = await refundService.requestRefund(
      { orderId: 'ord_paid', reason: 'Fulfillment failed on telco network' },
      { userId: 'usr_cust_1', role: UserRole.CUSTOMER, correlationId: 'req_rf_1', actorType: 'USER' },
    );

    expect(result.id).toBe('ref_1');
    expect(result.amountPesewas).toBe(5000);
    expect(result.status).toBe(RefundStatus.COMPLETED);
    expect(mockProvider.initiateRefund).toHaveBeenCalledTimes(1);

    // Verify Financial Ledger Reversal (DEBIT PLATFORM_ESCROW, CREDIT CUSTOMER_WALLET)
    expect(ledgerCalls).toHaveLength(2);
    expect(ledgerCalls[0].entryType).toBe('DEBIT');
    expect(ledgerCalls[0].accountType).toBe('PLATFORM_ESCROW');
    expect(ledgerCalls[1].entryType).toBe('CREDIT');
    expect(ledgerCalls[1].accountType).toBe('CUSTOMER_WALLET');
    expect(ledgerCalls[0].amountPesewas).toBe(5000);
    expect(ledgerCalls[1].amountPesewas).toBe(5000);
  });
});
