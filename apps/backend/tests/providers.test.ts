import { describe, it, expect } from 'vitest';
import { Currency, NetworkProvider, PaymentMethod, ProviderStatus } from '@bytebeacon/shared';
import { MockPaymentProvider } from '../src/providers/mocks/mock-payment.provider.js';
import { MockTelecomProvider } from '../src/providers/mocks/mock-telecom.provider.js';
import { MockNotificationProvider } from '../src/providers/mocks/mock-notification.provider.js';

describe('Provider Abstractions and Isolation', () => {
  it('MockPaymentProvider should fulfill IPaymentProvider contract', async () => {
    const provider = new MockPaymentProvider();
    expect(provider.providerName).toContain('MOCK');

    const initResult = await provider.initializePayment({
      orderId: 'ord_123',
      amountPesewas: 1000,
      currency: Currency.GHS,
      email: 'test@example.com',
      paymentMethod: PaymentMethod.MOMO,
    });

    expect(initResult.provider).toBe('MOCK');
    expect(initResult.providerReference).toBeDefined();
    expect(initResult.authorizationUrl).toContain('mock-pay');

    const verifyResult = await provider.verifyPayment('ref_123');
    expect(verifyResult.status).toBe('SUCCESS');
    expect(verifyResult.amountPesewas).toBe(5000);

    const validSig = provider.verifyWebhookSignature('payload', 'mock-valid-signature');
    expect(validSig).toBe(true);
  });

  it('MockTelecomProvider should fulfill ITelecomProvider contract', async () => {
    const provider = new MockTelecomProvider();
    expect(provider.providerName).toContain('MOCK');

    const submitResult = await provider.submitOrder({
      orderId: 'ord_123',
      clientReference: 'telco_ref_1',
      network: NetworkProvider.MTN,
      recipientPhone: '0241234567',
      dataAmountMb: 1000,
      idempotencyKey: 'pst_sub_ord_123',
    });

    expect(submitResult.providerStatus).toBe(ProviderStatus.RECEIVED);
    expect(submitResult.providerReference).toBe('telco_ref_1');

    const statusResult = await provider.getOrderStatus({ providerReference: 'telco_ref_1' });
    expect(statusResult.providerStatus).toBe(ProviderStatus.COMPLETED);
    expect(statusResult.completedAt).toBeDefined();
  });

  it('MockNotificationProvider should fulfill INotificationProvider contract', async () => {
    const provider = new MockNotificationProvider();
    const result = await provider.sendNotification({
      recipient: '0241234567',
      channel: 'SMS',
      message: 'Test message',
    });

    expect(result.success).toBe(true);
  });
});
