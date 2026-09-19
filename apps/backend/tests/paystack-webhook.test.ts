import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { PaymentWebhookService } from '../src/core/payments/payment-webhook.service.js';
import { PaystackAdapter } from '../src/core/payments/paystack.adapter.js';
import { PaymentService } from '../src/core/payments/payment.service.js';
import { UnauthorizedError } from '../src/core/errors/app-error.js';
import type pg from 'pg';
import type { Redis } from 'ioredis';

describe('Paystack Webhook Security & Durable Deduplication', () => {
  const secretKey = 'sk_test_paystack_secret_key_1234567890';
  const adapter = new PaystackAdapter({ secretKey });

  it('should accept valid HMAC-SHA512 signed payload and reject forged signature', async () => {
    const rawPayload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 123456,
        reference: 'pst_ref_valid_1',
        amount: 5000,
        currency: 'GHS',
        status: 'success',
      },
    });

    const validSignature = crypto
      .createHmac('sha512', secretKey)
      .update(Buffer.from(rawPayload, 'utf-8'))
      .digest('hex');

    const isValid = adapter.verifyWebhookSignature(rawPayload, validSignature);
    expect(isValid).toBe(true);

    const isInvalid = adapter.verifyWebhookSignature(rawPayload, 'forged_fake_signature');
    expect(isInvalid).toBe(false);
  });

  it('should reject forged webhook delivery with UnauthorizedError in service', async () => {
    const mockDb = {} as pg.Pool;
    const mockPaymentService = {} as PaymentService;

    const webhookService = new PaymentWebhookService(mockDb, null, adapter, mockPaymentService);

    await expect(
      webhookService.handlePaystackWebhook('{}', 'invalid_sig', 'req_forged'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should durably deduplicate webhook events via PostgreSQL and Redis', async () => {
    const recordedEvents = new Set<string>();
    const processSuccessfulPaymentMock = vi.fn().mockResolvedValue({ alreadyProcessed: false });

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
          if (q.includes('FROM payments')) {
            return Promise.resolve({
              rows: [{ id: 'pay_1', order_id: 'ord_1', user_id: 'usr_1', amount_pesewas: 5000, status: 'PENDING' }],
            });
          }
          if (q.includes('SELECT id FROM payment_events')) {
            const eventId = params[0] as string;
            if (recordedEvents.has(eventId)) {
              return Promise.resolve({ rows: [{ id: 'existing_evt' }] });
            }
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('INSERT INTO payment_events')) {
            const eventId = params[1] as string;
            recordedEvents.add(eventId);
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const mockRedis = {
      set: vi.fn().mockImplementation((_key: string, _val: string, _ex: string, _ttl: number, _nx: string) => {
        return Promise.resolve('OK');
      }),
    } as unknown as Redis;

    const mockPaymentService = {
      processSuccessfulPayment: processSuccessfulPaymentMock,
    } as unknown as PaymentService;

    const webhookService = new PaymentWebhookService(
      mockDb,
      mockRedis,
      adapter,
      mockPaymentService,
    );

    const payload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 99999,
        reference: 'pst_ref_dedup_1',
        amount: 5000,
        currency: 'GHS',
        status: 'success',
      },
    });

    const validSig = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');

    // 1st delivery -> PROCESSED
    const res1 = await webhookService.handlePaystackWebhook(payload, validSig, 'req_1');
    expect(res1.status).toBe('PROCESSED');
    expect(processSuccessfulPaymentMock).toHaveBeenCalledTimes(1);

    // 2nd delivery (duplicate delivery storm) -> DUPLICATE dropped
    const res2 = await webhookService.handlePaystackWebhook(payload, validSig, 'req_2');
    expect(res2.status).toBe('DUPLICATE');
    expect(processSuccessfulPaymentMock).toHaveBeenCalledTimes(1); // Not called again!
  });

  it('should route WALLET_TOPUP charge.success events to processSuccessfulWalletTopup', async () => {
    const processSuccessfulWalletTopupMock = vi.fn().mockResolvedValue({ alreadyProcessed: false, newBalancePesewas: 10000 });
    const processSuccessfulPaymentMock = vi.fn();

    const mockDb = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((q: string) => {
          if (q.includes('FROM payments')) {
            return Promise.resolve({
              rows: [{
                id: 'pay_topup_1',
                order_id: null,
                user_id: 'usr_topup_1',
                amount_pesewas: 5000,
                status: 'PENDING',
                metadata: { type: 'WALLET_TOPUP', userId: 'usr_topup_1' },
              }],
            });
          }
          if (q.includes('SELECT id FROM payment_events')) {
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('INSERT INTO payment_events')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis;

    const mockPaymentService = {
      processSuccessfulPayment: processSuccessfulPaymentMock,
      processSuccessfulWalletTopup: processSuccessfulWalletTopupMock,
    } as unknown as PaymentService;

    const webhookService = new PaymentWebhookService(
      mockDb,
      mockRedis,
      adapter,
      mockPaymentService,
    );

    const payload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 88888,
        reference: 'pst_topup_webhook_ref',
        amount: 5000,
        currency: 'GHS',
        status: 'success',
        metadata: {
          type: 'WALLET_TOPUP',
          userId: 'usr_topup_1',
        },
      },
    });

    const validSig = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
    const res = await webhookService.handlePaystackWebhook(payload, validSig, 'req_topup_1');

    expect(res.status).toBe('PROCESSED');
    expect(processSuccessfulWalletTopupMock).toHaveBeenCalledTimes(1);
    expect(processSuccessfulPaymentMock).not.toHaveBeenCalled();
  });

  it('should credit exactly 1000 pesewas to user wallet when 1030 pesewas (10 GHS + 3% fee) is paid via Paystack', async () => {
    let creditedAmountPesewas = 0;
    let ledgerDebitedPesewas = 0;
    let ledgerCreditedPesewas = 0;
    let updatedPaymentStatus = '';

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params?: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
          return Promise.resolve();
        }
        if (q.includes('FROM payments') && q.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [{
              id: 'pay_topup_10ghs',
              order_id: null,
              user_id: 'usr_10ghs',
              amount_pesewas: 1030,
              currency: 'GHS',
              status: 'PENDING',
              provider_reference: 'pst_topup_ref_10',
              metadata: {
                type: 'WALLET_TOPUP',
                userId: 'usr_10ghs',
                creditAmountPesewas: 1000,
                feePesewas: 30,
                totalPayablePesewas: 1030,
              },
            }],
          });
        }
        if (q.includes('SELECT wallet_balance_pesewas') && q.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 500, wallet_balance: 5.00 }],
          });
        }
        if (q.includes('UPDATE users')) {
          creditedAmountPesewas = (params?.[0] as number) - 500;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE payments')) {
          updatedPaymentStatus = params?.[0] as string;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO payment_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    const mockLedgerService = {
      recordJournalEntries: vi.fn().mockImplementation((_client: unknown, entries: any[]) => {
        ledgerDebitedPesewas = entries[0].amountPesewas;
        ledgerCreditedPesewas = entries[1].amountPesewas;
        return Promise.resolve();
      }),
    };

    const paymentService = new PaymentService(
      mockDb,
      adapter,
      mockLedgerService as any,
      {} as any,
    );

    const result = await paymentService.processSuccessfulWalletTopup(
      'pay_topup_10ghs',
      'pst_topup_ref_10',
      { amountPesewas: 1030 },
      'corr_10ghs',
    );

    expect(result.alreadyProcessed).toBe(false);
    expect(result.newBalancePesewas).toBe(1500); // 500 initial + 1000 deposit
    expect(creditedAmountPesewas).toBe(1000); // exactly 10.00 GHS deposited
    expect(ledgerDebitedPesewas).toBe(1000); // Platform escrow debited base 10.00 GHS
    expect(ledgerCreditedPesewas).toBe(1000); // Customer wallet credited base 10.00 GHS
    expect(updatedPaymentStatus).toBe('PAID');
  });

  it('should credit exactly 1700 pesewas when 1751 pesewas (17 GHS + 3% fee) is paid and self-heal if metadata is absent', async () => {
    let creditedAmountPesewas = 0;

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params?: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
          return Promise.resolve();
        }
        if (q.includes('FROM payments') && q.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [{
              id: 'pay_topup_17ghs',
              order_id: null,
              user_id: 'usr_17ghs',
              amount_pesewas: 1751,
              currency: 'GHS',
              status: 'PENDING',
              provider_reference: 'pst_topup_ref_17',
              metadata: null, // Test self-healing fallback when metadata is missing!
            }],
          });
        }
        if (q.includes('SELECT wallet_balance_pesewas') && q.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 0, wallet_balance: 0 }],
          });
        }
        if (q.includes('UPDATE users')) {
          creditedAmountPesewas = params?.[0] as number;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE payments') || q.includes('INSERT INTO payment_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    const mockLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue(undefined),
    };

    const paymentService = new PaymentService(
      mockDb,
      adapter,
      mockLedgerService as any,
      {} as any,
    );

    const result = await paymentService.processSuccessfulWalletTopup(
      'pay_topup_17ghs',
      'pst_topup_ref_17',
      { amountPesewas: 1751 },
      'corr_17ghs',
    );

    expect(result.newBalancePesewas).toBe(1700); // 1700 pesewas = 17.00 GHS (1751 / 1.03 rounded)
    expect(creditedAmountPesewas).toBe(1700);
  });
});
