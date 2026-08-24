import { NetworkProvider, ProviderStatus } from '../enums/index.js';

/**
 * Provider Result contracts for external integrations.
 */

export interface ProviderSuccessResult<T> {
  success: true;
  data: T;
  providerTransactionId?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ProviderErrorResult {
  success: false;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  rawResponse?: Record<string, unknown>;
}

export type ProviderResult<T> = ProviderSuccessResult<T> | ProviderErrorResult;

export enum ProviderExecutionMode {
  LIVE = 'LIVE',
  MOCK = 'MOCK',
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface SubmitOrderInput {
  orderId: string;
  clientReference: string;
  network: NetworkProvider;
  recipientPhone: string;
  dataAmountMb: number;
  idempotencyKey: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitOrderResult {
  providerOrderId: string;
  providerReference: string;
  providerStatus: ProviderStatus;
  acceptedAt: string;
  rawResponse?: Record<string, unknown>;
}

export interface GetOrderStatusInput {
  providerReference: string;
  orderId?: string;
}

export interface ProviderOrderStatus {
  providerOrderId: string;
  providerReference: string;
  providerStatus: ProviderStatus;
  completedAt?: string | null;
  errorMessage?: string | null;
  rawResponse?: Record<string, unknown>;
}

export interface ValidateBeneficiaryInput {
  phoneNumber: string;
  network: NetworkProvider;
}

export interface BeneficiaryValidationResult {
  isValid: boolean;
  network: NetworkProvider;
  accountName?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ProviderHealth {
  providerName: string;
  status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs: number;
  message?: string;
}

export interface IntegrationHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  integrations: {
    datahouse: ProviderHealth;
    gmpl?: ProviderHealth;
    paystack: ProviderHealth;
    redis: { status: 'UP' | 'DOWN'; latencyMs: number };
    database: { status: 'UP' | 'DOWN'; latencyMs: number };
  };
  timestamp: string;
}

export interface DlqEntryDto {
  id: string;
  orderId: string;
  provider: string;
  jobId: string;
  attemptCount: number;
  errorCode: string;
  errorMessage: string;
  requestReference: string;
  correlationId: string;
  firstFailedAt: string;
  lastFailedAt: string;
  failureClass: 'RETRYABLE_EXHAUSTED' | 'PERMANENT_REJECTION' | 'MALFORMED_REQUEST';
  status: 'PENDING_REVIEW' | 'REPLAYED' | 'DISCARDED';
}

// --- DataHouse Specific Extended Contracts ---

export interface DataHouseAgentUserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface DataHouseAgentProfileDto {
  id: string;
  publicId: string;
  businessName: string;
  businessPhone: string;
  address: string;
  tier: string;
  status: string;
  pricePerGb: string;
  apiAccessStatus: string;
  apiAccessPaidAt?: string | null;
  registrationFeePaidAt?: string | null;
  userId: string;
  user: DataHouseAgentUserDto;
  createdAt: string;
  raw?: Record<string, unknown>;
}

export interface DataHouseBundleDto {
  id: string;
  name: string;
  network: NetworkProvider;
  dataSizeGb: number;
  dataAmountMb: number;
  pricePesewas: number;
  agentPricePesewas?: number;
  agentAmountGhs?: number;
  amountGhs?: number;
  validityDays: number;
  isActive: boolean;
  type: string;
  raw?: Record<string, unknown>;
}

export interface DataHouseRecipientInput {
  phoneNumber: string;
  dataSizeGb?: number;
  bundleId?: string;
}

export interface SubmitBulkOrderInput {
  network: NetworkProvider;
  recipients: DataHouseRecipientInput[];
  idempotencyKey?: string;
  confirmedPorted?: string[];
  onUnvalidated?: 'set_aside' | 'reject';
  metadata?: Record<string, unknown>;
}

export interface DataHouseChildOrderDto {
  id: string;
  publicId: string;
  referenceCode: string;
  sizeGb: number;
  beneficiaryCount: number;
  amount: string;
  status: string;
}

export interface SubmitBulkOrderResult {
  providerOrderId: string; // submission receipt id (sub_...)
  providerReference: string; // BLK-...
  network: NetworkProvider;
  totalRecipients: number;
  acceptedRecipients: number;
  queuedRecipients: number;
  rejectedRecipients: number;
  providerStatus: ProviderStatus;
  groupCount?: number;
  orders?: DataHouseChildOrderDto[];
  blocked?: string[];
  rawResponse?: Record<string, unknown>;
}

export interface DataHousePublicPrecheckInput {
  network: NetworkProvider;
  phoneNumbers: string[];
}

export interface DataHousePrecheckItemResult {
  phoneNumber: string;
  phone?: string;
  normalized?: string;
  isKnown: boolean;
  isValid: boolean;
  status?: string;
  accountName?: string;
  network?: string;
  message?: string;
}

export interface DataHousePrecheckSummary {
  requested?: number;
  unique?: number;
  valid?: number;
  invalid?: number;
  known?: number;
  unknown?: number;
  total?: number;
  recorded?: number;
}

export interface DataHousePrecheckInput {
  network: NetworkProvider;
  phoneNumbers: string[];
  record?: boolean;
}

export interface DataHousePrecheckResult {
  network: NetworkProvider;
  enforced: boolean;
  sandbox: boolean;
  recorded: boolean;
  reason?: string;
  summary: DataHousePrecheckSummary;
  unknown: string[];
  results: DataHousePrecheckItemResult[];
  rawResponse?: Record<string, unknown>;
}

export interface DataHouseBeneficiaryStatusItemDto {
  msisdn: string;
  network: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | string;
  attemptCount: number;
  lastBundleSizeGb?: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  submittedAt?: string | null;
  resolvedAt?: string | null;
}

export interface DataHouseBeneficiaryStatusListDto {
  items: DataHouseBeneficiaryStatusItemDto[];
  page: number;
  limit: number;
  total: number;
}

export interface DataHouseOrderDeliveryStatsDto {
  approved: number;
  pending: number;
  failed: number;
  total: number;
}

export interface DataHousePaymentSplitDto {
  fromMain: number;
  fromOverdraft: number;
}

export interface DataHouseOrderBeneficiaryDto {
  id: string;
  phoneNumber: string;
  dataVolumeGb: string;
  amount: string;
  network: string;
  status: string;
  isPorted: boolean;
}

export interface DataHouseOrderDetailsDto {
  id: string;
  referenceCode: string;
  network: string;
  status: string;
  paymentStatus: string;
  amount: string;
  groupSizeGb: number;
  submissionId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  paymentSplit?: DataHousePaymentSplitDto | null;
  beneficiaryCount: number;
  totalDataGb: number;
  delivery: DataHouseOrderDeliveryStatsDto;
  beneficiaries: DataHouseOrderBeneficiaryDto[];
  rawResponse?: Record<string, unknown>;
}

export interface DataHouseOrderListItemDto {
  id: string;
  referenceCode: string;
  network: string;
  status: string;
  paymentStatus: string;
  amount: string;
  groupSizeGb: number;
  submissionId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  beneficiaryCount: number;
  totalDataGb: number;
  delivery: DataHouseOrderDeliveryStatsDto;
  beneficiaries: never[];
}

export interface DataHouseOrdersListDto {
  orders: DataHouseOrderListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export interface DataHouseWalletBalanceDto {
  balancePesewas: number;
  balanceGhs: number;
  currency: string;
  overdraftLimitPesewas: number;
  overdraftUsedPesewas: number;
  overdraftAvailablePesewas: number;
  overdraftActive: boolean;
  availableToSpendPesewas: number;
  availableToSpendGhs: number;
  raw?: Record<string, unknown>;
}

export interface DataHouseWalletLedgerEntryDto {
  id: string;
  walletId?: string;
  transactionId?: string;
  direction?: 'debit' | 'credit' | string;
  type: string;
  amountPesewas: number;
  amountGhs: number;
  balanceBeforePesewas?: number;
  balanceAfterPesewas?: number;
  category?: string;
  referenceType?: string;
  referenceId?: string;
  description: string;
  source?: 'main_balance' | 'overdraft' | string | null;
  reference?: string;
  createdAt: string;
}

export interface DataHouseWalletLedgerDto {
  entries: DataHouseWalletLedgerEntryDto[];
  total: number;
  page: number;
  limit: number;
}

export interface DataHouseWebhookSubscriptionDto {
  id: string;
  agentId?: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface DataHouseWebhookCreateInputDto {
  url: string;
  events: string[];
}

export interface DataHouseWebhookCreateResultDto extends DataHouseWebhookSubscriptionDto {
  signingSecret: string;
}

// =========================================================================
// Phase 11.9 Provider Diagnostic & Capability Contracts
// =========================================================================

export interface ProviderConnectionTestStep {
  name: string; // 'DNS Resolution' | 'TLS Connection' | 'Endpoint Reachability' | 'Authentication' | 'Provider Health'
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  latencyMs: number;
  details?: string;
  httpStatus?: number;
}

export interface ProviderConnectionTestResult {
  providerId: string;
  providerName: string;
  environment: 'SANDBOX' | 'PRODUCTION' | string;
  result: 'PASSED' | 'FAILED' | 'DEGRADED';
  totalLatencyMs: number;
  steps: ProviderConnectionTestStep[];
  httpStatus?: number;
  errorCategory?: string; // 'NONE' | 'AUTHENTICATION_FAILURE' | 'DNS_FAILURE' | 'TLS_FAILURE' | 'ENDPOINT_UNREACHABLE' | 'TIMEOUT' | 'UNKNOWN'
  errorMessage?: string;
  timestamp: string;
}

export interface ProviderCapabilityTestResult {
  providerId: string;
  providerName: string;
  capabilities: Record<string, { supported: boolean; details?: string }>;
  timestamp: string;
}

export interface SandboxTransactionTestInput {
  providerId?: string;
  providerName?: string;
  network: NetworkProvider;
  recipientPhone: string;
  dataAmountMb: number;
  bundleName?: string;
}

export interface SandboxTransactionTestResult {
  providerId: string;
  providerName: string;
  providerReference: string;
  network: NetworkProvider;
  recipientPhone: string;
  dataAmountMb: number;
  durationMs: number;
  result: 'PASSED' | 'FAILED';
  steps: Array<{
    step: string;
    status: 'PASSED' | 'FAILED';
    latencyMs: number;
    details?: string;
  }>;
  responsePayload?: Record<string, unknown>;
  timestamp: string;
}

export interface ProviderBundleDto {
  id: string;
  name: string;
  network: NetworkProvider;
  dataAmountMb: number;
  dataSizeGb?: number;
  pricePesewas: number;
  validityDays: number;
  isActive: boolean;
  type?: string;
}

