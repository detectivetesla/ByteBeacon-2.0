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
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  DataHousePrecheckInput,
  DataHousePrecheckResult,
  DataHouseBundleDto,
  DataHouseWalletBalanceDto,
  DataHouseWalletLedgerDto,
} from '@bytebeacon/shared';
import { DataHouseClient } from './datahouse.client.js';
import { DataHouseMapper } from './datahouse.mapper.js';

export class DataHouseAdapter implements ITelecomProvider {
  public readonly providerName = 'DATAHOUSE';
  private readonly client: DataHouseClient;

  constructor(client: DataHouseClient) {
    this.client = client;
  }

  public async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    const correlationId = (input.metadata?.correlationId as string) || `dh_ord_${input.orderId}`;
    const dhReq = DataHouseMapper.toDataHouseSubmitRequest(input);
    const dhResp = await this.client.submitOrder(dhReq, correlationId);
    return DataHouseMapper.toSubmitOrderResult(dhResp);
  }

  public async submitBulkOrder(input: SubmitBulkOrderInput): Promise<SubmitBulkOrderResult> {
    const correlationId = (input.metadata?.correlationId as string) || `dh_bulk_${Date.now()}`;
    const dhReq = DataHouseMapper.toDataHouseBulkRequest(input);
    const dhResp = await this.client.submitBulkOrder(dhReq, correlationId);
    return DataHouseMapper.toBulkSubmitOrderResult(dhResp, input.network);
  }

  public async getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus> {
    const correlationId = `dh_status_${input.providerReference}`;
    const dhResp = await this.client.getOrderStatus(input.providerReference, correlationId);
    return DataHouseMapper.toProviderOrderStatus(dhResp);
  }

  public async validateBeneficiary(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult> {
    const correlationId = `dh_ben_${input.phoneNumber}`;
    const dhResp = await this.client.precheckBeneficiaries(
      {
        network: input.network,
        phoneNumbers: [input.phoneNumber],
        record: false,
      },
      correlationId,
    );
    return DataHouseMapper.toBeneficiaryResult(dhResp, input.phoneNumber, input.network);
  }

  public async precheckBeneficiaries(input: DataHousePrecheckInput): Promise<DataHousePrecheckResult> {
    const correlationId = `dh_precheck_${Date.now()}`;
    const dhResp = await this.client.precheckBeneficiaries(input, correlationId);
    return DataHouseMapper.toDataHousePrecheckResult(dhResp, input.network);
  }

  public async getBundles(params: {
    network?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<DataHouseBundleDto[]> {
    const dhResp = await this.client.getBundles(params);
    return DataHouseMapper.toDataHouseBundleDtos(dhResp);
  }

  public async getWalletBalance(): Promise<DataHouseWalletBalanceDto> {
    const dhResp = await this.client.getWalletBalance();
    return DataHouseMapper.toWalletBalanceDto(dhResp);
  }

  public async getWalletLedger(): Promise<DataHouseWalletLedgerDto> {
    const dhResp = await this.client.getWalletLedger();
    return DataHouseMapper.toWalletLedgerDto(dhResp);
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
