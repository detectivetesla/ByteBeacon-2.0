import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentWebhookService, PaystackWebhookPayload } from '../../src/core/payments/payment-webhook.service.js';
import { IPaymentProvider } from '../../src/core/payments/payment-provider.interface.js';
import { PaymentService } from '../../src/core/payments/payment.service.js';
import { UnauthorizedError } from '../../src/core/errors/app-error.js';
import type pg from 'pg';

describe('Phase 8.6: Paystack Gateway & Webhook Signature Replay Suite', () => {
  let webhookService: PaymentWebhookService;
  let mockDb: pg.Pool;
  let mockClient: pg.PoolClient;
  let mockPaymentProvider: IPaymentProvider;
  let mockPaymentService: PaymentService;

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM payments WHERE provider_reference = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_123',
                order_id: 'ord_123',
                user_id: 'usr_1',
                amount_pesewas: '5000',
                status: 'PENDING',
              },
            ],
          });
        }
        if (sql.includes('UPDATE payments SET status = $1') || sql.includes('INSERT INTO payment_events')) {
          return Promise.resolve({ rows: [{ id: 'updated_row' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    } as unknown as pg.PoolClient;

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    } as unknown as pg.Pool;

    mockPaymentProvider = {
      verifyWebhookSignature: vi.fn().mockImplementation((_rawBody: any, signature: string) => {
        return signature === 'valid_hmac_sha512_signature';
      }),
      initializePayment: vi.fn(),
      verifyPayment: vi.fn(),
      initiateRefund: vi.fn(),
    };

    mockPaymentService = {
      processSuccessfulPayment: vi.fn().mockResolvedValue(undefined),
    } as unknown as PaymentService;

    webhookService = new PaymentWebhookService(mockDb, null, mockPaymentProvider, mockPaymentService);
  });

  describe('HMAC-SHA512 Cryptographic Signature Verification', () => {
    it('should successfully process webhook with authentic Paystack signature', async () => {
      const payload: PaystackWebhookPayload = {
        event: 'charge.success',
        data: {
          id: 998877,
          reference: 'pstk_ref_123',
          amount: 5000,
          currency: 'GHS',
          status: 'success',
          metadata: { paymentId: 'pay_123', orderId: 'ord_123' },
        },
      };

      const result = await webhookService.handlePaystackWebhook(
        JSON.stringify(payload),
        'valid_hmac_sha512_signature',
        'corr_1',
      );

      expect(result.status).toBe('PROCESSED');
      expect(mockPaymentService.processSuccessfulPayment).toHaveBeenCalledWith(
        'pay_123',
        'pstk_ref_123',
        expect.objectContaining({
          amountPesewas: 5000,
        }),
        'corr_1',
      );
    });

    it('should throw UnauthorizedError when signature is forged or invalid', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'pstk_fake' } });

      await expect(
        webhookService.handlePaystackWebhook(payload, 'forged_fake_signature', 'corr_2'),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('Replay Attack & Duplicate Webhook Rejection', () => {
    it('should drop duplicate webhook if event was already recorded in payment_events', async () => {
      (mockClient.query as any).mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM payments WHERE provider_reference = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay_123',
                order_id: 'ord_123',
                user_id: 'usr_1',
                amount_pesewas: '5000',
                status: 'PAID',
              },
            ],
          });
        }
        if (sql.includes('FROM payment_events WHERE provider = $1 AND provider_event_id = $2') || sql.includes("FROM payment_events WHERE provider = 'PAYSTACK'")) {
          return Promise.resolve({
            rows: [{ id: 'evt_existing_123' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const payload: PaystackWebhookPayload = {
        event: 'charge.success',
        data: {
          id: 998877,
          reference: 'pstk_ref_123',
          amount: 5000,
          currency: 'GHS',
          status: 'success',
        },
      };

      const result = await webhookService.handlePaystackWebhook(
        JSON.stringify(payload),
        'valid_hmac_sha512_signature',
        'corr_3',
      );

      expect(result.status).toBe('DUPLICATE');
      expect(mockPaymentService.processSuccessfulPayment).not.toHaveBeenCalled();
    });
  });

  describe('Unverified / Mismatched Payment Security', () => {
    it('should ignore webhook if referenced payment does not exist in database', async () => {
      (mockClient.query as any).mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM payments WHERE provider_reference = $1')) {
          return Promise.resolve({ rows: [] }); // Not found
        }
        return Promise.resolve({ rows: [] });
      });

      const payload: PaystackWebhookPayload = {
        event: 'charge.success',
        data: {
          reference: 'pstk_unknown_ref',
          amount: 5000,
          currency: 'GHS',
          status: 'success',
        },
      };

      const result = await webhookService.handlePaystackWebhook(
        JSON.stringify(payload),
        'valid_hmac_sha512_signature',
        'corr_4',
      );

      expect(result.status).toBe('IGNORED');
      expect(result.message).toBe('Payment record not found');
    });
  });
});
