import {
  SubmitOrderInput,
  SubmitOrderResult,
  GetOrderStatusInput,
  ProviderOrderStatus,
  ValidateBeneficiaryInput,
  BeneficiaryValidationResult,
  ProviderHealth,
  ProviderStatus,
} from '@bytebeacon/shared';
import { ITelecomProvider } from '../../core/providers/telecom/telecom-provider.interface.js';
import { logger } from '../../core/logging/logger.js';

/**
 * MockTelecomProvider for testing and local contract verification only.
 * MUST NOT be activated in production.
 */
export class MockTelecomProvider implements ITelecomProvider {
  public readonly providerName = 'MOCK_TELECOM_PROVIDER (GENERIC TEST DOUBLE)';

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PROVIDERS !== 'true') {
      throw new Error('FATAL SECURITY INVARIANT: MockTelecomProvider cannot be initialized in production environment.');
    }
    logger.warn('MockTelecomProvider initialized for local/test double use only.');
  }

  public async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    return {
      providerOrderId: `mock_gmpl_${Date.now()}`,
      providerReference: input.clientReference,
      providerStatus: ProviderStatus.RECEIVED,
      acceptedAt: new Date().toISOString(),
    };
  }

  public async getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus> {
    return {
      providerOrderId: `mock_gmpl_123`,
      providerReference: input.providerReference,
      providerStatus: ProviderStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    };
  }

  public async validateBeneficiary(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult> {
    return {
      isValid: true,
      network: input.network,
      accountName: 'Test Beneficiary Account',
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      providerName: 'MockTelecomProvider',
      status: 'UP',
      latencyMs: 1,
    };
  }

  public verifyWebhookSignature(_payload: string | Buffer, signature: string): boolean {
    return signature === 'mock-telco-signature';
  }
}
