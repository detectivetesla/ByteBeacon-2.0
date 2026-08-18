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

export interface DataHouseBundleDto {
  id: string;
  name: string;
  network: NetworkProvider;
  dataSizeGb: number;
  dataAmountMb: number;
  pricePesewas: number;
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

export interface SubmitBulkOrderResult {
  providerOrderId: string;
  providerReference: string;
  network: NetworkProvider;
  totalRecipients: number;
  acceptedRecipients: number;
  queuedRecipients: number;
  rejectedRecipients: number;
  providerStatus: ProviderStatus;
  rawResponse?: Record<string, unknown>;
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
  summary: {
    total?: number;
    known?: number;
    unknown?: number;
    valid?: number;
    invalid?: number;
    recorded?: number;
  };
  unknown: string[];
  results: Array<{
    phoneNumber: string;
    isKnown: boolean;
    isValid: boolean;
    status?: string;
    accountName?: string;
    network?: string;
    message?: string;
  }>;
  rawResponse?: Record<string, unknown>;
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
  transactionId?: string;
  type: string;
  amountPesewas: number;
  amountGhs: number;
  balanceBeforePesewas?: number;
  balanceAfterPesewas?: number;
  description: string;
  reference?: string;
  createdAt: string;
}

export interface DataHouseWalletLedgerDto {
  entries: DataHouseWalletLedgerEntryDto[];
  total: number;
  page: number;
  limit: number;
}
