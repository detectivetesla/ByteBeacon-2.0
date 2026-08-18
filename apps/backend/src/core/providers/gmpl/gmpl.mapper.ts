import {
  SubmitOrderInput,
  SubmitOrderResult,
  ProviderOrderStatus,
  BeneficiaryValidationResult,
  NetworkProvider,
  ProviderStatus,
} from '@bytebeacon/shared';
import {
  GmplSubmitRequest,
  GmplSubmitResponse,
  GmplStatusResponse,
  GmplBeneficiaryResponse,
} from './gmpl.types.js';

export class GmplMapper {
  public static toGmplSubmitRequest(input: SubmitOrderInput): GmplSubmitRequest {
    return {
      client_reference: input.clientReference,
      network: input.network,
      recipient_msisdn: input.recipientPhone,
      package_size_mb: input.dataAmountMb,
      idempotency_key: input.idempotencyKey,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    };
  }

  public static toSubmitOrderResult(resp: GmplSubmitResponse): SubmitOrderResult {
    const status = resp.status === 'ACCEPTED' ? ProviderStatus.RECEIVED : ProviderStatus.REJECTED;
    return {
      providerOrderId: resp.order_id,
      providerReference: resp.reference,
      providerStatus: status,
      acceptedAt: resp.created_at || new Date().toISOString(),
      rawResponse: resp as unknown as Record<string, unknown>,
    };
  }

  public static toProviderOrderStatus(resp: GmplStatusResponse): ProviderOrderStatus {
    return {
      providerOrderId: resp.order_id,
      providerReference: resp.reference,
      providerStatus: this.mapProviderStatus(resp.status),
      completedAt: resp.completed_at || null,
      errorMessage: resp.error_message || null,
      rawResponse: resp as unknown as Record<string, unknown>,
    };
  }

  public static toBeneficiaryResult(resp: GmplBeneficiaryResponse): BeneficiaryValidationResult {
    return {
      isValid: resp.status === 'VALID',
      network: resp.network as NetworkProvider,
      accountName: resp.account_name,
      rawResponse: resp as unknown as Record<string, unknown>,
    };
  }

  public static mapProviderStatus(rawStatus: string): ProviderStatus {
    switch (rawStatus?.toUpperCase()) {
      case 'RECEIVED':
      case 'PENDING':
        return ProviderStatus.RECEIVED;
      case 'PROCESSING':
        return ProviderStatus.PROCESSING;
      case 'COMPLETED':
      case 'SUCCESS':
        return ProviderStatus.COMPLETED;
      case 'FAILED':
        return ProviderStatus.FAILED;
      case 'REJECTED':
        return ProviderStatus.REJECTED;
      default:
        return ProviderStatus.UNKNOWN;
    }
  }
}
