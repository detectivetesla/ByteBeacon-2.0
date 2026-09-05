/**
 * DataHouse API Request and Response Types
 * Authoritative schemas for DataHouse Telecom Gateway Integration.
 */

export interface DataHouseApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface DataHouseApiErrorDetail {
  code: string;
  message: string;
}

export interface DataHouseApiErrorResponse {
  success: false;
  error: DataHouseApiErrorDetail;
  meta?: {
    correlationId?: string;
  };
}

export interface DataHouseAgentUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface DataHouseAgentProfile {
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
  user: DataHouseAgentUser;
  createdAt: string;
  [key: string]: unknown;
}

export interface DataHouseSubmitOrderRequest {
  bundleId?: string;
  phoneNumber: string;
  idempotencyKey: string;
  email?: string;
  volume?: number;
  dataAmountMb?: number;
  network?: string;
  [key: string]: unknown;
}

export interface DataHouseSubmitOrderResponse {
  id?: string;
  publicId?: string;
  order_id?: string;
  orderId?: string;
  referenceCode?: string;
  reference?: string;
  idempotencyKey?: string;
  userId?: string;
  agentId?: string;
  channel?: string;
  bundleId?: string;
  amount?: string | number;
  price?: number;
  network?: string;
  bundleType?: string;
  groupSizeGb?: string | number;
  phoneNumber?: string;
  recipient?: string;
  dataSizeGb?: number;
  email?: string;
  status: string;
  isSandbox?: boolean;
  createdAt?: string;
  created_at?: string;
  correlationId?: string;
  message?: string;
  [key: string]: unknown;
}

export interface DataHouseBulkRecipientItem {
  phoneNumber: string;
  dataSizeGb?: number;
  bundleId?: string;
}

export interface DataHouseBulkOrderRequest {
  network: string;
  recipients: DataHouseBulkRecipientItem[];
  idempotencyKey: string;
  confirmedPorted?: string[];
  onUnvalidated?: 'set_aside' | 'reject';
}

export interface DataHouseBulkChildOrder {
  id: string;
  publicId: string;
  referenceCode: string;
  sizeGb: number;
  beneficiaryCount: number;
  amount: string;
  status: string;
}

export interface DataHouseBulkOrderResponse {
  id?: string; // the submission id (sub_01J...)
  submissionId?: string;
  batchId?: string;
  referenceCode?: string; // BLK-7GH2K9ABCDEF
  network: string;
  amount?: string | number;
  status: string;
  createdAt?: string;
  created_at?: string;
  beneficiaryCount?: number;
  groupCount?: number;
  totalRecipients?: number;
  acceptedRecipients?: number;
  queuedRecipients?: number;
  rejectedRecipients?: number;
  orders?: DataHouseBulkChildOrder[];
  blocked?: string[];
  correlationId?: string;
  details?: unknown[];
  [key: string]: unknown;
}

export interface DataHouseOrderDeliveryStats {
  approved: number;
  pending: number;
  failed: number;
  total: number;
}

export interface DataHouseOrderBeneficiaryItem {
  id: string;
  phoneNumber: string;
  dataVolumeGb: string;
  amount: string;
  network: string;
  status: string;
  isPorted: boolean;
}

export interface DataHouseOrderStatusResponse {
  id: string;
  publicId?: string;
  order_id?: string;
  referenceCode?: string;
  reference?: string;
  status: string;
  paymentStatus?: string;
  network: string;
  phoneNumber?: string;
  recipient?: string;
  dataSizeGb?: number;
  groupSizeGb?: number;
  amount?: string | number;
  price?: number;
  submissionId?: string | null;
  createdAt?: string;
  created_at?: string;
  completedAt?: string;
  completed_at?: string;
  updatedAt?: string;
  updated_at?: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  paymentSplit?: {
    fromMain: number;
    fromOverdraft: number;
  } | null;
  beneficiaryCount?: number;
  totalDataGb?: number;
  delivery?: DataHouseOrderDeliveryStats;
  beneficiaries?: DataHouseOrderBeneficiaryItem[];
  error?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
}

export interface DataHouseBundleItem {
  id: string;
  name: string;
  network: string;
  dataSizeGb?: number;
  dataVolume?: string;
  bundleType?: string;
  price?: number | string;
  amount?: number | string;
  agentPrice?: number | string;
  agentAmount?: number | string;
  validityDays?: number;
  validity?: string | number;
  is_active?: boolean;
  isActive?: boolean;
  type?: string;
  [key: string]: unknown;
}

export interface DataHouseBundlesResponse {
  data?: DataHouseBundleItem[] | { data: DataHouseBundleItem[]; meta?: { page?: number; limit?: number; total?: number } };
  bundles?: DataHouseBundleItem[];
  items?: DataHouseBundleItem[];
  total?: number;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface DataHousePublicPrecheckRequest {
  network: string;
  phoneNumbers: string[];
}

export interface DataHousePrecheckRequest {
  network: string;
  phoneNumbers: string[];
  record?: boolean;
}

export interface DataHousePrecheckItem {
  phoneNumber?: string;
  phone?: string;
  msisdn?: string;
  normalized?: string;
  isKnown?: boolean;
  known?: boolean;
  isValid?: boolean;
  valid?: boolean;
  status?: string;
  accountName?: string;
  network?: string;
  message?: string;
  [key: string]: unknown;
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

export interface DataHousePrecheckResponse {
  network: string;
  enforced?: boolean;
  sandbox?: boolean;
  recorded?: boolean;
  reason?: string;
  summary?: DataHousePrecheckSummary;
  unknown?: string[];
  results?: DataHousePrecheckItem[];
  data?: DataHousePrecheckItem[];
  [key: string]: unknown;
}

export interface DataHouseBeneficiaryStatusItem {
  msisdn: string;
  network: string;
  status: string;
  attemptCount: number;
  lastBundleSizeGb?: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  submittedAt?: string | null;
  resolvedAt?: string | null;
}

export interface DataHouseBeneficiariesListResponse {
  data?: DataHouseBeneficiaryStatusItem[] | { data: DataHouseBeneficiaryStatusItem[]; meta?: { page?: number; limit?: number; total?: number } };
  items?: DataHouseBeneficiaryStatusItem[];
  results?: DataHouseBeneficiaryStatusItem[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface DataHouseWalletBalanceResponse {
  balance?: number;
  currency?: string;
  overdraftLimit?: number;
  overdraftUsed?: number;
  overdraftAvailable?: number;
  overdraftActive?: boolean;
  availableToSpend?: number;
  [key: string]: unknown;
}

export interface DataHouseWalletLedgerEntry {
  id: string;
  walletId?: string;
  transactionId?: string;
  direction?: 'debit' | 'credit' | string;
  type?: string;
  amount: string | number;
  balanceAfter?: string | number;
  balanceBefore?: string | number;
  category?: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  narration?: string;
  source?: 'main_balance' | 'overdraft' | string | null;
  reference?: string;
  orderId?: string;
  order_id?: string;
  createdAt?: string;
  created_at?: string;
}

export interface DataHouseWalletLedgerResponse {
  data?: DataHouseWalletLedgerEntry[] | { data: DataHouseWalletLedgerEntry[]; meta?: { page?: number; limit?: number; total?: number } };
  ledger?: DataHouseWalletLedgerEntry[];
  items?: DataHouseWalletLedgerEntry[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface DataHouseWebhookSubscription {
  id: string;
  agentId?: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface DataHouseWebhookCreateRequest {
  url: string;
  events: string[];
}

export interface DataHouseWebhookCreateResponse extends DataHouseWebhookSubscription {
  signingSecret: string;
}

export interface DataHouseWebhookPayload {
  id?: string;
  eventId?: string;
  event_id?: string;
  type: string;
  timestamp?: number | string;
  created_at?: string;
  createdAt?: string;
  data: {
    id?: string;
    order_id?: string;
    orderId?: string;
    reference?: string;
    reference_code?: string;
    referenceCode?: string;
    status: string;
    network?: string;
    phone_number?: string;
    phoneNumber?: string;
    recipient?: string;
    dataSizeGb?: number;
    bundle_type?: string;
    bundleType?: string;
    amount?: string | number;
    provider_reference?: string;
    error_message?: string;
    error?: string;
    refunded?: boolean;
    wallet_id?: string;
    ledger_entry_id?: string;
    direction?: string;
    balance_after?: string | number;
    category?: string;
    reference_type?: string;
    reference_id?: string;
    description?: string;
    occurred_at?: string;
    completedAt?: string;
    completed_at?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DataHouseApiAccessStatus {
  access_granted: boolean;
  paid_at?: string | null;
  fee_required: boolean;
  fee_amount?: string | number | null;
  fee_label?: string | null;
  fee_description?: string | null;
  [key: string]: unknown;
}

export interface DataHouseApiAccessPaymentInitiation {
  access_granted: boolean;
  authorizationUrl?: string;
  reference?: string;
  [key: string]: unknown;
}
