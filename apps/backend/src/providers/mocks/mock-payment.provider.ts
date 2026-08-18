import {
  Currency,
  ProviderHealth,
} from '@bytebeacon/shared';
import {
  IPaymentProvider,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  InitiateRefundInput,
  InitiateRefundResult,
} from '../../core/payments/payment-provider.interface.js';
import { logger } from '../../core/logging/logger.js';

/**
 * MockPaymentProvider for testing and local development only.
 * MUST NOT be activated in production.
 */
export class MockPaymentProvider implements IPaymentProvider {
  public readonly providerName = 'MOCK_PAYMENT_PROVIDER (NON-PRODUCTION)';

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PROVIDERS !== 'true') {
      throw new Error('FATAL SECURITY INVARIANT: MockPaymentProvider cannot be initialized in production environment.');
    }
    logger.warn('MockPaymentProvider initialized. This provider is for local/test use only.');
  }

  public async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = `mock_ref_${input.orderId}_${Date.now()}`;
    return {
      provider: 'MOCK',
      providerReference: reference,
      authorizationUrl: `https://checkout.bytebeacon.dev/mock-pay/${reference}`,
      accessCode: `mock_code_${Date.now()}`,
    };
  }

  public async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    return {
      provider: 'MOCK',
      providerReference,
      status: 'SUCCESS',
      amountPesewas: 5000,
      currency: Currency.GHS,
      paidAt: new Date(),
      channel: 'mobile_money',
    };
  }

  public async initiateRefund(input: InitiateRefundInput): Promise<InitiateRefundResult> {
    return {
      provider: 'MOCK',
      providerRefundReference: `mock_rf_${Date.now()}`,
      status: 'SUCCESS',
      amountPesewas: input.amountPesewas,
    };
  }

  public verifyWebhookSignature(_payload: string | Buffer, signature: string): boolean {
    return signature === 'mock-valid-signature';
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      providerName: 'MockPaymentProvider',
      status: 'UP',
      latencyMs: 1,
    };
  }
}
