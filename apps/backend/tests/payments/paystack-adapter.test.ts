import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaystackAdapter } from '../../src/core/payments/paystack.adapter.js';
import { Currency, PaymentMethod } from '@bytebeacon/shared';
import crypto from 'node:crypto';

describe('PaystackAdapter Test Suite', () => {
  const secretKey = 'sk_test_mock_secret_key_123';
  let adapter: PaystackAdapter;

  beforeEach(() => {
    adapter = new PaystackAdapter({ secretKey });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Payment Initialization', () => {
    it('should submit correct payload to Paystack with minor unit integer pesewas', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/pst_auth_123',
            access_code: 'code_123',
            reference: 'pst_ord_1_abc123',
          },
        }),
      } as any);

      const result = await adapter.initializePayment({
        orderId: 'ord_1',
        email: 'customer@bytebeacon.com',
        amountPesewas: 4800, // GH₵ 48.00
        currency: Currency.GHS,
        paymentMethod: PaymentMethod.MOMO,
        callbackUrl: 'https://bytebeacon.com/checkout/callback',
      });

      expect(result.provider).toBe('PAYSTACK');
      expect(result.authorizationUrl).toBe('https://checkout.paystack.com/pst_auth_123');
      expect(result.providerReference).toBe('pst_ord_1_abc123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"amount":4800'),
        }),
      );
    });
  });

  describe('Payment Verification', () => {
    it('should verify successful transaction and parse amount in pesewas', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Verification successful',
          data: {
            status: 'success',
            amount: 4800,
            currency: 'GHS',
            paid_at: '2026-08-17T12:00:00Z',
            channel: 'mobile_money',
            gateway_response: 'Successful',
            authorization: {
              authorization_code: 'AUTH_code_123',
            },
          },
        }),
      } as any);

      const result = await adapter.verifyPayment('pst_ord_1_abc123');

      expect(result.status).toBe('SUCCESS');
      expect(result.amountPesewas).toBe(4800);
      expect(result.channel).toBe('mobile_money');
    });
  });

  describe('Webhook Cryptographic Signature Verification', () => {
    it('should return true for valid HMAC SHA-512 signature', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'pst_123' } });
      const validSignature = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');

      const isValid = adapter.verifyWebhookSignature(payload, validSignature);
      expect(isValid).toBe(true);
    });

    it('should return false for forged or mismatched signature', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'pst_123' } });
      const forgedSignature = 'forged_hex_signature_abcdef123456';

      const isValid = adapter.verifyWebhookSignature(payload, forgedSignature);
      expect(isValid).toBe(false);
    });
  });
});
