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
});
