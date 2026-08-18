/**
 * DataHouse API Request and Response Types
 * Authoritative schemas for DataHouse Telecom Gateway Integration.
 */

export interface DataHouseSubmitOrderRequest {
  bundleId: string;
  phoneNumber: string;
  idempotencyKey: string;
  email?: string;
}

export interface DataHouseSubmitOrderResponse {
  id?: string;
  order_id?: string;
  orderId?: string;
  referenceCode?: string;
  reference?: string;
  status: string;
  network?: string;
  recipient?: string;
  phoneNumber?: string;
  dataSizeGb?: number;
  amount?: number;
  price?: number;
  created_at?: string;
  createdAt?: string;
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

export interface DataHouseBulkOrderResponse {
  id?: string;
  batchId?: string;
  network: string;
  status: string;
  totalRecipients?: number;
  acceptedRecipients?: number;
  queuedRecipients?: number;
  rejectedRecipients?: number;
  created_at?: string;
  correlationId?: string;
  details?: unknown[];
  [key: string]: unknown;
}

export interface DataHouseOrderStatusResponse {
  id: string;
  order_id?: string;
  referenceCode?: string;
  reference?: string;
  status: string;
  network: string;
  phoneNumber: string;
  recipient?: string;
  dataSizeGb?: number;
  amount?: number;
  price?: number;
  created_at?: string;
  completed_at?: string;
  updated_at?: string;
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
  price: number;
  agentPrice?: number;
  validityDays?: number;
  validity?: string | number;
  is_active?: boolean;
  isActive?: boolean;
  type?: string;
  [key: string]: unknown;
}

export interface DataHouseBundlesResponse {
  data?: DataHouseBundleItem[];
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

export interface DataHousePrecheckRequest {
  network: string;
  phoneNumbers: string[];
  record?: boolean;
}

export interface DataHousePrecheckItem {
  phoneNumber?: string;
  msisdn?: string;
  phone?: string;
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

export interface DataHousePrecheckResponse {
  network: string;
  enforced?: boolean;
  sandbox?: boolean;
  recorded?: boolean;
  summary?: {
    total?: number;
    known?: number;
    unknown?: number;
    valid?: number;
    invalid?: number;
    recorded?: number;
  };
  unknown?: string[];
  results?: DataHousePrecheckItem[];
  data?: DataHousePrecheckItem[];
  [key: string]: unknown;
}

export interface DataHouseBeneficiariesListResponse {
  data?: unknown[];
  items?: unknown[];
  results?: unknown[];
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

export interface DataHouseWalletLedgerResponse {
  data?: unknown[];
  ledger?: unknown[];
  items?: unknown[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface DataHouseWebhookPayload {
  id?: string;
  eventId?: string;
  event_id?: string;
  type: string;
  timestamp?: number | string;
  data: {
    id?: string;
    orderId?: string;
    order_id?: string;
    referenceCode?: string;
    reference?: string;
    status: string;
    network?: string;
    phoneNumber?: string;
    recipient?: string;
    dataSizeGb?: number;
    amount?: number;
    completedAt?: string;
    completed_at?: string;
    error?: string;
    errorMessage?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
