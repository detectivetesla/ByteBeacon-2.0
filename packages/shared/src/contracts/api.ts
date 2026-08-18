import {
  UserRole,
  UserStatus,
  SecurityDomain,
  ApiKeyEnvironment,
  ApiKeyStatus,
  Permission,
  NetworkProvider,
  Currency,
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  BeneficiaryValidationStatus,
  BulkSubmissionStatus,
  OrderEventType,
  PaymentMethod,
  PaymentChannel,
  LedgerEntryType,
  LedgerAccountType,
  PaymentEventType,
  RefundEventType,
  ReconciliationStatus,
} from '../enums/index.js';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorEnvelope;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Array<{
    field?: string;
    code: string;
    message: string;
  }>;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// --- Auth DTOs ---

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  securityDomain: SecurityDomain;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  walletBalancePesewas: number;
}

export interface AuthResponseData {
  user: UserSummaryDto;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PhoneVerificationRequest {
  code: string;
}

export interface ForgotPasswordRequest {
  emailOrPhone: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminMfaChallengeData {
  mfaRequired: true;
  mfaSessionToken: string;
}

export interface AdminMfaVerifyRequest {
  mfaSessionToken: string;
  totpCode: string;
}

export interface MfaSetupData {
  secret: string;
  qrUri: string;
  recoveryCodes: string[];
}

export interface CreateApiKeyRequest {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  expiresInDays?: number;
}

export interface ApiKeyCreatedDto {
  id: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiKeySummaryDto {
  id: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// --- Commerce & Catalog DTOs ---

export interface CatalogProductDto {
  id: string;
  sku: string;
  network: NetworkProvider;
  name: string;
  dataAmountMb: number;
  validityDays: number;
  basePricePesewas: number;
  agentPricePesewas: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Order DTOs ---

export interface CreateOrderRequest {
  productId: string;
  recipientPhone: string;
  idempotencyKey?: string;
  agentId?: string;
}

export interface OrderPricingSnapshot {
  productId: string;
  sku: string;
  productName: string;
  network: NetworkProvider;
  dataAmountMb: number;
  unitPricePesewas: number;
  currency: Currency;
  snapshotTimestamp: string;
}

export interface ProviderOrderSummaryDto {
  providerName: string;
  providerReference: string | null;
  providerStatus: ProviderStatus;
  lastSyncedAt: string | null;
  lastProviderEventAt: string | null;
  syncVersion: number;
}

export interface OrderEventDto {
  id: string;
  eventType: OrderEventType;
  correlationId: string;
  actorId: string | null;
  actorType: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface OrderSummaryDto {
  id: string;
  publicId: string;
  userId: string;
  agentId: string | null;
  recipientPhone: string;
  network: NetworkProvider;
  dataAmountMb: number;
  amountPesewas: number;
  currency: Currency;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  providerStatus: ProviderStatus;
  refundStatus: RefundStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailsDto extends OrderSummaryDto {
  pricingSnapshot: OrderPricingSnapshot;
  providerOrder: ProviderOrderSummaryDto | null;
  events: OrderEventDto[];
}

// --- Customer-Facing Safe Order DTOs (Provider Anonymity Guaranteed) ---

export type CustomerFacingStatus =
  | 'ORDER_CREATED'
  | 'CHECKING_ORDER'
  | 'READY_TO_PROCESS'
  | 'ORDER_RECEIVED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'UNABLE_TO_COMPLETE'
  | 'CANCELLED';

export interface CustomerOrderDto {
  orderId: string;
  status: CustomerFacingStatus;
  statusLabel: string;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';
  product: {
    name: string;
    network: NetworkProvider;
    volumeDisplay: string;
    validityDisplay: string;
  };
  recipientPhone: string;
  amountPesewas: number;
  amountDisplay: string;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export function toCustomerFacingStatus(orderStatus: OrderStatus, paymentStatus: PaymentStatus): { status: CustomerFacingStatus; statusLabel: string } {
  if (paymentStatus === PaymentStatus.FAILED) {
    return { status: 'UNABLE_TO_COMPLETE', statusLabel: 'Unable to complete payment' };
  }
  if (orderStatus === OrderStatus.COMPLETED) {
    return { status: 'DELIVERED', statusLabel: 'Data delivered' };
  }
  if (orderStatus === OrderStatus.PROCESSING) {
    return { status: 'PROCESSING', statusLabel: 'Processing your order' };
  }
  if (orderStatus === OrderStatus.SUBMITTED) {
    return { status: 'ORDER_RECEIVED', statusLabel: 'Order received' };
  }
  if (orderStatus === OrderStatus.READY_FOR_FULFILLMENT) {
    return { status: 'READY_TO_PROCESS', statusLabel: 'Ready to process' };
  }
  if (orderStatus === OrderStatus.VALIDATING) {
    return { status: 'CHECKING_ORDER', statusLabel: 'Checking order' };
  }
  if (orderStatus === OrderStatus.CANCELLED) {
    return { status: 'CANCELLED', statusLabel: 'Cancelled' };
  }
  if (orderStatus === OrderStatus.FAILED) {
    return { status: 'UNABLE_TO_COMPLETE', statusLabel: 'Unable to complete order' };
  }
  return { status: 'ORDER_CREATED', statusLabel: 'Order created' };
}


// --- Beneficiary DTOs ---

export interface ValidateBeneficiaryRequest {
  phoneNumber: string;
  network: NetworkProvider;
}

export interface BeneficiaryValidationDto {
  id: string;
  phoneNumber: string;
  network: NetworkProvider;
  status: BeneficiaryValidationStatus;
  providerReference: string | null;
  validatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// --- Bulk Orders DTOs ---

export interface BulkSubmissionItemInput {
  recipientPhone: string;
  productId: string;
}

export interface CreateBulkSubmissionRequest {
  name: string;
  items: BulkSubmissionItemInput[];
  idempotencyKey?: string;
}

export interface BulkSubmissionItemDto {
  id: string;
  submissionId: string;
  orderId: string | null;
  recipientPhone: string;
  productId: string;
  amountPesewas: number;
  status: OrderStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface BulkSubmissionSummaryDto {
  id: string;
  userId: string;
  name: string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  totalAmountPesewas: number;
  status: BulkSubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BulkSubmissionDetailsDto extends BulkSubmissionSummaryDto {
  items: BulkSubmissionItemDto[];
}

// --- Agent DTOs ---

export interface ApplyAgentRequest {
  businessName: string;
  slug: string;
  experience?: string;
  reason?: string;
}

export interface AgentProfileDto {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 4 Payment & Financial DTOs ---

export interface InitializePaymentRequest {
  orderId: string;
  paymentMethod: PaymentMethod;
  channel?: PaymentChannel;
  email?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
}

export interface PaymentIntentDto {
  paymentId: string;
  publicId: string;
  orderId: string;
  amountPesewas: number;
  currency: Currency;
  authorizationUrl: string | null;
  reference: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface PaymentAttemptDto {
  id: string;
  paymentId: string;
  attemptNumber: number;
  providerChannel: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface PaymentEventDto {
  id: string;
  paymentId: string;
  eventType: PaymentEventType;
  correlationId: string;
  source: string;
  previousStatus: PaymentStatus | null;
  newStatus: PaymentStatus;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface FinancialLedgerEntryDto {
  id: string;
  entryType: LedgerEntryType;
  accountType: LedgerAccountType;
  accountId: string;
  amountPesewas: number;
  currency: Currency;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface PaymentSummaryDto {
  id: string;
  publicId: string;
  orderId: string;
  userId: string;
  amountPesewas: number;
  currency: Currency;
  provider: string;
  providerReference: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetailsDto extends PaymentSummaryDto {
  attempts: PaymentAttemptDto[];
  events: PaymentEventDto[];
  ledgerEntries: FinancialLedgerEntryDto[];
}

export interface RequestRefundRequest {
  orderId: string;
  paymentId?: string;
  amountPesewas?: number;
  reason: string;
  idempotencyKey?: string;
}

export interface RefundEventDto {
  id: string;
  refundId: string;
  eventType: RefundEventType;
  correlationId: string;
  previousStatus: RefundStatus | null;
  newStatus: RefundStatus;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface RefundDetailsDto {
  id: string;
  publicId: string;
  paymentId: string;
  orderId: string;
  amountPesewas: number;
  reason: string;
  status: RefundStatus;
  providerRefundReference: string | null;
  processedAt: string | null;
  events: RefundEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSummaryDto {
  id: string;
  reconciliationDate: string;
  provider: string;
  totalProviderAmountPesewas: number;
  totalInternalAmountPesewas: number;
  discrepancyPesewas: number;
  status: ReconciliationStatus;
  unmatchedCount: number;
  createdAt: string;
}
