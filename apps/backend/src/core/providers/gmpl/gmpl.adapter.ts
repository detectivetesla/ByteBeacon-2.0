import {
  ITelecomProvider,
} from '../telecom/telecom-provider.interface.js';
import {
  SubmitOrderInput,
  SubmitOrderResult,
  GetOrderStatusInput,
  ProviderOrderStatus,
  ValidateBeneficiaryInput,
  BeneficiaryValidationResult,
  ProviderHealth,
} from '@bytebeacon/shared';
import { GmplClient } from './gmpl.client.js';
import { GmplMapper } from './gmpl.mapper.js';

export class GmplAdapter implements ITelecomProvider {
  public readonly providerName = 'GMPL';
  private readonly client: GmplClient;

  constructor(client: GmplClient) {
    this.client = client;
  }

  public async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    const correlationId = (input.metadata?.correlationId as string) || `sub_${input.orderId}`;
    const gmplReq = GmplMapper.toGmplSubmitRequest(input);
    const gmplResp = await this.client.submitOrder(gmplReq, correlationId);
    return GmplMapper.toSubmitOrderResult(gmplResp);
  }

  public async getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus> {
    const correlationId = `status_${input.providerReference}`;
    const gmplResp = await this.client.getOrderStatus(input.providerReference, correlationId);
    return GmplMapper.toProviderOrderStatus(gmplResp);
  }

  public async validateBeneficiary(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult> {
    const correlationId = `ben_${input.phoneNumber}`;
    const gmplResp = await this.client.validateBeneficiary(input.phoneNumber, input.network, correlationId);
    return GmplMapper.toBeneficiaryResult(gmplResp);
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const health = await this.client.checkHealth();
    return {
      providerName: this.providerName,
      status: health.status,
      latencyMs: health.latencyMs,
    };
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    return this.client.verifyWebhookSignature(rawBody, signature);
  }
}
