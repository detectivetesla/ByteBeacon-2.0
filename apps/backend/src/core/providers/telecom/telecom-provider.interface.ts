import {
  SubmitOrderInput,
  SubmitOrderResult,
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  GetOrderStatusInput,
  ProviderOrderStatus,
  ValidateBeneficiaryInput,
  BeneficiaryValidationResult,
  DataHousePrecheckInput,
  DataHousePrecheckResult,
  DataHouseWalletBalanceDto,
  ProviderHealth,
} from '@bytebeacon/shared';

export interface ITelecomProvider {
  readonly providerName: string;

  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  submitBulkOrder?(input: SubmitBulkOrderInput): Promise<SubmitBulkOrderResult>;
  getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus>;
  validateBeneficiary?(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult>;
  precheckBeneficiaries?(input: DataHousePrecheckInput): Promise<DataHousePrecheckResult>;
  getWalletBalance?(): Promise<DataHouseWalletBalanceDto>;
  healthCheck(): Promise<ProviderHealth>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}

