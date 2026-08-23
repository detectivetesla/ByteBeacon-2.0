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
  NetworkProvider,
  DataHouseBundleDto,
  ProviderBundleDto,
  ProviderConnectionTestResult,
  SandboxTransactionTestInput,
  SandboxTransactionTestResult,
} from '@bytebeacon/shared';

export interface ITelecomProvider {
  readonly providerName: string;
  readonly providerSlug?: string;

  getNetworks?(): Promise<NetworkProvider[]>;
  getBundles?(params?: any): Promise<DataHouseBundleDto[] | ProviderBundleDto[]>;
  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  submitBulkOrder?(input: SubmitBulkOrderInput): Promise<SubmitBulkOrderResult>;
  getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus>;
  validateBeneficiary?(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult>;
  precheckBeneficiaries?(input: DataHousePrecheckInput): Promise<DataHousePrecheckResult>;
  getWalletBalance?(): Promise<DataHouseWalletBalanceDto>;
  healthCheck(): Promise<ProviderHealth>;
  testConnection?(environment?: 'SANDBOX' | 'PRODUCTION' | string): Promise<ProviderConnectionTestResult>;
  getCapabilities?(): Promise<Record<string, boolean>>;
  testSandbox?(input: SandboxTransactionTestInput): Promise<SandboxTransactionTestResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}


