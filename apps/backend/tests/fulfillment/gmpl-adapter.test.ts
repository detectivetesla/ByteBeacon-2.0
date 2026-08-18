import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GmplClient } from '../../src/core/providers/gmpl/gmpl.client.js';
import { GmplAdapter } from '../../src/core/providers/gmpl/gmpl.adapter.js';
import {
  GmplAuthError,
  GmplRateLimitError,
  GmplRejectionError,
  GmplTimeoutError,
  GmplNetworkError,
} from '../../src/core/providers/gmpl/gmpl.errors.js';
import { NetworkProvider, ProviderStatus } from '@bytebeacon/shared';
import crypto from 'node:crypto';

describe('GMPL Client & Adapter Integration', () => {
  const config = {
    baseUrl: 'https://mock.gmpl.telecom.test',
    apiKey: 'gmpl_test_key_123',
    apiSecret: 'gmpl_test_secret_456',
    timeoutMs: 1000,
  };

  let client: GmplClient;
  let adapter: GmplAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new GmplClient(config);
    adapter = new GmplAdapter(client);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should successfully submit telecom order and map response to domain model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'ACCEPTED',
          order_id: 'gmpl_ord_98765',
          reference: 'pst_sub_ord_1',
          created_at: new Date().toISOString(),
        }),
    });

    const result = await adapter.submitOrder({
      orderId: 'ord_1',
      clientReference: 'pst_sub_ord_1',
      network: NetworkProvider.MTN,
      recipientPhone: '0241234567',
      dataAmountMb: 2048,
      idempotencyKey: 'pst_sub_ord_1',
    });

    expect(result.providerOrderId).toBe('gmpl_ord_98765');
    expect(result.providerReference).toBe('pst_sub_ord_1');
    expect(result.providerStatus).toBe(ProviderStatus.RECEIVED);
  });

  it('should throw GmplAuthError on HTTP 401/403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid API credentials' }),
    });

    await expect(
      adapter.submitOrder({
        orderId: 'ord_1',
        clientReference: 'ref_1',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 1000,
        idempotencyKey: 'idem_1',
      }),
    ).rejects.toThrow(GmplAuthError);
  });

  it('should throw GmplRateLimitError on HTTP 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
    });

    await expect(
      adapter.submitOrder({
        orderId: 'ord_1',
        clientReference: 'ref_1',
        network: NetworkProvider.TELECEL,
        recipientPhone: '0201234567',
        dataAmountMb: 1000,
        idempotencyKey: 'idem_1',
      }),
    ).rejects.toThrow(GmplRateLimitError);
  });

  it('should throw GmplRejectionError on permanent provider rejection (HTTP 422)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: 'MSISDN not provisioned', error_code: 'INVALID_RECIPIENT' }),
    });

    await expect(
      adapter.submitOrder({
        orderId: 'ord_1',
        clientReference: 'ref_1',
        network: NetworkProvider.AIRTELTIGO,
        recipientPhone: '0261234567',
        dataAmountMb: 1000,
        idempotencyKey: 'idem_1',
      }),
    ).rejects.toThrow(GmplRejectionError);
  });

  it('should throw GmplTimeoutError when provider times out', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      adapter.submitOrder({
        orderId: 'ord_1',
        clientReference: 'ref_1',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 1000,
        idempotencyKey: 'idem_1',
      }),
    ).rejects.toThrow(GmplTimeoutError);
  });

  it('should throw GmplNetworkError on connection reset / network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET connection reset by peer'));

    await expect(
      adapter.submitOrder({
        orderId: 'ord_1',
        clientReference: 'ref_1',
        network: NetworkProvider.MTN,
        recipientPhone: '0241234567',
        dataAmountMb: 1000,
        idempotencyKey: 'idem_1',
      }),
    ).rejects.toThrow(GmplNetworkError);
  });

  it('should cryptographically verify webhook HMAC signature', () => {
    const rawBody = JSON.stringify({ event: 'order.completed', timestamp: '2026-08-14T12:00:00Z' });
    const validSignature = crypto
      .createHmac('sha256', config.apiSecret)
      .update(Buffer.from(rawBody, 'utf-8'))
      .digest('hex');

    expect(client.verifyWebhookSignature(rawBody, validSignature)).toBe(true);
    expect(client.verifyWebhookSignature(rawBody, 'forged_invalid_signature_hex')).toBe(false);
  });
});
