import {
  SubmitOrderInput,
  SubmitOrderResult,
  SubmitBulkOrderInput,
  SubmitBulkOrderResult,
  GetOrderStatusInput,
  ProviderOrderStatus,
  ValidateBeneficiaryInput,
  BeneficiaryValidationResult,
  DataHouseAgentProfileDto,
  DataHousePrecheckInput,
  DataHousePrecheckResult,
  DataHousePublicPrecheckInput,
  DataHouseBeneficiaryStatusListDto,
  DataHouseOrderDetailsDto,
  DataHouseOrdersListDto,
  DataHouseWalletBalanceDto,
  DataHouseWalletLedgerDto,
  DataHouseWebhookSubscriptionDto,
  DataHouseWebhookCreateInputDto,
  DataHouseWebhookCreateResultDto,
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
  getAgentProfile?(): Promise<DataHouseAgentProfileDto>;
  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  submitBulkOrder?(input: SubmitBulkOrderInput): Promise<SubmitBulkOrderResult>;
  getOrderStatus(input: GetOrderStatusInput): Promise<ProviderOrderStatus>;
  getOrderDetails?(orderIdOrReference: string): Promise<DataHouseOrderDetailsDto>;
  listOrders?(params?: any): Promise<DataHouseOrdersListDto>;
  validateBeneficiary?(input: ValidateBeneficiaryInput): Promise<BeneficiaryValidationResult>;
  precheckBeneficiaries?(input: DataHousePrecheckInput): Promise<DataHousePrecheckResult>;
  precheckPublicBeneficiaries?(input: DataHousePublicPrecheckInput): Promise<DataHousePrecheckResult>;
  listBeneficiaries?(params?: any): Promise<DataHouseBeneficiaryStatusListDto>;
  getWalletBalance?(): Promise<DataHouseWalletBalanceDto>;
  getWalletLedger?(): Promise<DataHouseWalletLedgerDto>;
  createWebhookSubscription?(input: DataHouseWebhookCreateInputDto): Promise<DataHouseWebhookCreateResultDto>;
  listWebhookSubscriptions?(): Promise<DataHouseWebhookSubscriptionDto[]>;
  rotateWebhookSecret?(subscriptionId: string): Promise<DataHouseWebhookCreateResultDto>;
  deleteWebhookSubscription?(subscriptionId: string): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
  testConnection?(environment?: 'SANDBOX' | 'PRODUCTION' | string): Promise<ProviderConnectionTestResult>;
  getCapabilities?(): Promise<Record<string, boolean>>;
  testSandbox?(input: SandboxTransactionTestInput): Promise<SandboxTransactionTestResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}



