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
  CatalogPlanStatus,
  CatalogProviderStatus,
  CatalogPricingMode,
  CatalogSyncChangeType,
  CatalogSyncBatchStatus,
  AgentAccountStatus,
  StoreStatus,
  StoreApprovalStatus,
  StorePayoutStatus,
  TransactionType,
  TransactionStatus,
  ReconciliationSeverity,
  ReconciliationSource,
  ReconciliationCaseStatus,
  FinancialAdjustmentStatus,
  RefundAdminStatus,
  LedgerAnomalySeverity,
  ApiSecurityEventType,
  ApiSecuritySeverity,
  WebhookEvent,
  WebhookStatus,
  ProviderAuthType,
  ProviderHealthStatus,
  RateLimitTier,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationDeliveryStatus,
  CommunicationTargetType,
  CampaignStatus,
  TemplateStatus,
  NotificationCategory,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  SecurityIncidentStatus,
  SecurityHealthStatus,
  ConfigRiskLevel,
  ConfigScope,
  ConfigCategory,
  FeatureFlagTargetRole,
  ConfigurationHealthStatus,
  PermissionCategory,
  AdminSubRole,
  NotificationSeverity,
  NotificationType,
  AlertStatus,
  AlertSource,
  NotificationRuleStatus,
  TelecomProviderType,
  TelecomProviderStatus,
  TelecomEnvironment,
  ProviderAuthMethod,
  ProviderCapabilityType,
  ProviderTestType,
  ProviderIncidentStatus,
  ProviderIncidentSeverity,
  NetworkProviderMappingRole,
  ConnectionDiagnosticCategory,
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
  validityDesc?: string;
  basePricePesewas: number;
  agentPricePesewas: number | null;
  customPricePesewas?: number | null;
  effectivePricePesewas?: number;
  agentMinPricePesewas?: number | null;
  agentMaxPricePesewas?: number | null;
  storePricePesewas?: number | null;
  providerPricePesewas?: number;
  providerName?: string;
  providerPlanId?: string | null;
  providerPlanCode?: string | null;
  providerProductCode?: string | null;
  pricingMode?: CatalogPricingMode;
  markupValue?: number;
  description?: string | null;
  category?: string;
  status?: CatalogPlanStatus;
  providerStatus?: CatalogProviderStatus;
  availableForCustomer?: boolean;
  availableForAgent?: boolean;
  availableForStore?: boolean;
  availableForApi?: boolean;
  version?: number;
  lastSyncedAt?: string | null;
  syncError?: string | null;
  popular?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCatalogStats {
  totalPlans: number;
  activePlans: number;
  disabledPlans: number;
  customerPlans: number;
  agentPlans: number;
  storePlans: number;
  providerSynced: number;
  syncIssues: number;
}

export interface CatalogPriceHistoryDto {
  id: string;
  productId: string;
  changedBy: string | null;
  changedByName?: string | null;
  changeType: string;
  previousProviderPricePesewas: number | null;
  newProviderPricePesewas: number | null;
  previousBasePricePesewas: number | null;
  newBasePricePesewas: number | null;
  previousAgentPricePesewas: number | null;
  newAgentPricePesewas: number | null;
  previousStorePricePesewas: number | null;
  newStorePricePesewas: number | null;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminCatalogPlanDetail extends CatalogProductDto {
  customerMarginPesewas: number;
  customerMarginPct: number;
  agentMarginPesewas: number;
  agentMarginPct: number;
  storeMarginPesewas: number;
  storeMarginPct: number;
  analytics: {
    todayOrders: number;
    todayRevenuePesewas: number;
    last7DaysOrders: number;
    last7DaysRevenuePesewas: number;
    last30DaysOrders: number;
    last30DaysRevenuePesewas: number;
    last90DaysOrders: number;
    lifetimeOrders: number;
    lifetimeRevenuePesewas: number;
    successfulOrders: number;
    failedOrders: number;
    refundedOrders: number;
    successRatePct: number;
  };
  priceHistory: CatalogPriceHistoryDto[];
  recentOrders: Array<{
    id: string;
    publicId: string;
    customerEmail?: string;
    recipientPhone: string;
    amountPesewas: number;
    paymentStatus: string;
    orderStatus: string;
    providerStatus: string;
    createdAt: string;
  }>;
}

export interface CreateCatalogPlanRequest {
  name: string;
  network: NetworkProvider;
  providerName?: string;
  providerPlanId?: string;
  providerPlanCode?: string;
  providerProductCode?: string;
  dataAmountMb: number;
  validityDays?: number;
  validityDesc?: string;
  providerPricePesewas: number;
  basePricePesewas: number; // Customer retail price
  agentPricePesewas?: number;
  agentMinPricePesewas?: number;
  agentMaxPricePesewas?: number;
  storePricePesewas?: number;
  pricingMode?: CatalogPricingMode;
  markupValue?: number;
  description?: string;
  category?: string;
  sku?: string;
  status?: CatalogPlanStatus;
  availableForCustomer?: boolean;
  availableForAgent?: boolean;
  availableForStore?: boolean;
  availableForApi?: boolean;
  popular?: boolean;
}

export interface UpdateCatalogPlanRequest {
  name?: string;
  network?: NetworkProvider;
  providerName?: string;
  providerPlanId?: string;
  providerPlanCode?: string;
  providerProductCode?: string;
  dataAmountMb?: number;
  validityDays?: number;
  validityDesc?: string;
  providerPricePesewas?: number;
  basePricePesewas?: number;
  agentPricePesewas?: number;
  agentMinPricePesewas?: number;
  agentMaxPricePesewas?: number;
  storePricePesewas?: number;
  pricingMode?: CatalogPricingMode;
  markupValue?: number;
  description?: string;
  category?: string;
  sku?: string;
  status?: CatalogPlanStatus;
  providerStatus?: CatalogProviderStatus;
  availableForCustomer?: boolean;
  availableForAgent?: boolean;
  availableForStore?: boolean;
  availableForApi?: boolean;
  popular?: boolean;
  changeReason?: string;
}

export interface BulkCatalogActionRequest {
  planIds: string[];
  action:
    | 'ACTIVATE'
    | 'DISABLE'
    | 'ARCHIVE'
    | 'DELETE'
    | 'ENABLE_CUSTOMER'
    | 'DISABLE_CUSTOMER'
    | 'ENABLE_AGENT'
    | 'DISABLE_AGENT'
    | 'ENABLE_STORE'
    | 'DISABLE_STORE'
    | 'ENABLE_API'
    | 'DISABLE_API';
  reason?: string;
}

export interface BulkPricingPreviewRequest {
  network?: NetworkProvider | 'ALL';
  planIds?: string[];
  customerMarkupPercent?: number;
  agentMarkupPercent?: number;
  storeMarkupPercent?: number;
  customerMarkupPesewas?: number;
  agentMarkupPesewas?: number;
  storeMarkupPesewas?: number;
}

export interface BulkPricingPlanImpact {
  id: string;
  name: string;
  network: NetworkProvider;
  dataAmountMb: number;
  currentProviderPricePesewas: number;
  currentBasePricePesewas: number;
  newBasePricePesewas: number;
  currentAgentPricePesewas: number | null;
  newAgentPricePesewas: number | null;
  currentStorePricePesewas: number | null;
  newStorePricePesewas: number | null;
  estimatedDailyRevenueDiffPesewas: number;
}

export interface BulkPricingPreviewResponse {
  affectedPlansCount: number;
  totalDailyRevenueDiffPesewas: number;
  plans: BulkPricingPlanImpact[];
}

export interface BulkPricingApplyRequest extends BulkPricingPreviewRequest {
  reason: string;
}

export interface ProviderCatalogSyncItemDto {
  id: string;
  batchId: string;
  catalogProductId?: string | null;
  providerPlanId: string;
  changeType: CatalogSyncChangeType;
  network: string;
  planName: string;
  dataAmountMb: number;
  currentProviderPricePesewas?: number | null;
  newProviderPricePesewas: number;
  currentCustomerPricePesewas?: number | null;
  proposedCustomerPricePesewas?: number | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface ProviderCatalogSyncBatchDto {
  id: string;
  providerName: string;
  initiatedBy?: string | null;
  totalProviderPlans: number;
  matchedPlans: number;
  newPlansCount: number;
  changedPlansCount: number;
  removedPlansCount: number;
  discrepancyCount: number;
  status: CatalogSyncBatchStatus;
  appliedAt?: string | null;
  createdAt: string;
  items?: ProviderCatalogSyncItemDto[];
}


// --- Order DTOs ---

export interface CreateOrderRequest {
  productId: string;
  recipientPhone: string;
  idempotencyKey?: string;
  agentId?: string;
  paymentMethod?: PaymentMethod | string;
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
  paymentMethod?: PaymentMethod | string;
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

// --- Phase 11.7 Agent & Store Administration Contracts ---

export interface AdminAgentStats {
  totalAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  pendingAgents: number;
  agentsWithStores: number;
  agentsWithApi: number;
  totalWalletFloatPesewas: number;
  totalRevenuePesewas: number;
}

export interface AdminAgentListItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  businessName: string;
  slug: string;
  status: AgentAccountStatus | string;
  storeStatus: StoreStatus | string;
  hasStore: boolean;
  storeName?: string;
  storeSlug?: string;
  apiEnabled: boolean;
  activeKeysCount: number;
  walletBalancePesewas: number;
  ordersCount: number;
  revenuePesewas: number;
  subAgentsCount: number;
  agentTier: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface AgentCustomPricingItemDto {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  network: NetworkProvider;
  dataAmountMb: number;
  defaultAgentPricePesewas: number;
  basePricePesewas: number;
  customPricePesewas: number | null;
  effectivePricePesewas: number;
  isActive: boolean;
  updatedAt?: string;
}

export interface UpdateAgentPricingRequest {
  pricing: Array<{
    productId: string;
    customPricePesewas: number | null;
  }>;
}

export interface UserCustomPricingItemDto {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  network: NetworkProvider;
  dataAmountMb: number;
  defaultAgentPricePesewas: number;
  basePricePesewas: number;
  customPricePesewas: number | null;
  effectivePricePesewas: number;
  isActive: boolean;
  updatedAt?: string;
}

export interface UpdateUserPricingRequest {
  pricing: Array<{
    productId: string;
    customPricePesewas: number | null;
    isActive?: boolean;
  }>;
}

export interface UpdateUserProductPricingRequest {
  customPricePesewas: number | null;
  isActive?: boolean;
}

export interface AgentSubAgentSummaryDto {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  businessName: string;
  status: string;
  walletBalancePesewas: number;
  ordersCount: number;
  revenuePesewas: number;
  createdAt: string;
}

export interface AgentCustomerSummaryDto {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  phone?: string;
  ordersCount: number;
  spentPesewas: number;
  lastOrderDate?: string;
  createdAt: string;
}

export interface AdminAgentDetail {
  agent: AdminAgentListItem;
  wallet: {
    balancePesewas: number;
    ledgerBalancePesewas: number;
    totalDepositsPesewas: number;
    totalSpentPesewas: number;
    totalRevenuePesewas: number;
    totalWithdrawalsPesewas: number;
    totalRefundsPesewas: number;
  };
  ordersSummary: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    refunded: number;
  };
  apiSummary: {
    enabled: boolean;
    activeKeys: number;
    totalRequests30d: number;
    successRate: number;
    lastRequestAt?: string;
  };
  storeSummary?: {
    id: string;
    storeName: string;
    slug: string;
    storeStatus: string;
    approvalStatus: string;
    totalSalesPesewas: number;
    productsCount: number;
    tagline?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    primaryColor?: string;
    accentColor?: string;
    activationFeePesewas?: number;
    paymentStatus?: string;
  };

  subAgents: AgentSubAgentSummaryDto[];
  customers: AgentCustomerSummaryDto[];
  customPricing: AgentCustomPricingItemDto[];
  recentOrders: any[];
  auditLogs: any[];
}

export interface CreateAgentAdminRequest {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  slug: string;
  agentTier?: string;
  initialPassword?: string;
  enableApiAccess?: boolean;
}

export interface UpdateAgentAdminRequest {
  fullName?: string;
  phone?: string;
  businessName?: string;
  slug?: string;
  agentTier?: string;
  commissionRate?: number;
  enableApiAccess?: boolean;
}

export interface UpdateAgentStatusRequest {
  status: AgentAccountStatus;
  reason: string;
}

export interface AdminStoreStats {
  totalStores: number;
  activeStores: number;
  pendingReviewStores: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalPesewas: number;
  suspendedStores: number;
  rejectedStores: number;
  totalSalesPesewas: number;
  totalRevenuePesewas: number;
  totalPayoutsPesewas: number;
}

export interface AdminStoreListItem {
  id: string;
  agentId?: string;
  userId: string;
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  paymentStatus: string;
  approvalStatus: StoreApprovalStatus | string;
  storeStatus: StoreStatus | string;
  activationFeePesewas: number;
  paystackReference?: string;
  totalSalesPesewas: number;
  pendingPayoutPesewas: number;
  productsCount: number;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductAdminDto {
  id: string;
  storeId: string;
  catalogProductId: string;
  productName: string;
  sku: string;
  network: NetworkProvider;
  dataAmountMb: number;
  basePricePesewas: number;
  agentPricePesewas: number;
  markupPesewas: number;
  customPricePesewas?: number;
  finalCustomerPricePesewas: number;
  isAvailable: boolean;
  isVisible: boolean;
}

export interface UpdateStoreProductsRequest {
  products: Array<{
    catalogProductId: string;
    markupPesewas?: number;
    customPricePesewas?: number;
    isAvailable?: boolean;
    isVisible?: boolean;
  }>;
}

export interface StorePayoutDto {
  id: string;
  storeId: string;
  storeName: string;
  agentId?: string;
  agentName?: string;
  amountPesewas: number;
  destinationAccount: string;
  destinationProvider: string;
  status: StorePayoutStatus | string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorePayoutActionRequest {
  action: 'APPROVE' | 'REJECT' | 'HOLD' | 'RELEASE';
  reason: string;
}

export interface StoreHealthReportDto {
  storeId: string;
  storeStatus: string;
  isHealthy: boolean;
  checks: {
    catalogSynced: boolean;
    paymentsHealthy: boolean;
    ordersHealthy: boolean;
    payoutsHealthy: boolean;
    apiHealthy: boolean;
  };
  issues: string[];
}

export interface AdminStoreDetail {
  store: AdminStoreListItem;
  branding: {
    tagline?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    primaryColor: string;
    accentColor: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
  };
  products: StoreProductAdminDto[];
  salesMetrics: {
    totalOrders: number;
    completedOrders: number;
    grossSalesPesewas: number;
    netMarginPesewas: number;
    refundedPesewas: number;
  };
  recentOrders: any[];
  payouts: StorePayoutDto[];
  health: StoreHealthReportDto;
}

// --- Phase 11.8 Finance, Transactions & Reconciliation DTOs ---

export interface AdminFinanceStats {
  totalPlatformBalancePesewas: number;
  customerWalletBalancePesewas: number;
  agentWalletBalancePesewas: number;
  totalDepositsPesewas: number;
  totalWithdrawalsPesewas: number;
  totalRevenuePesewas: number;
  totalCommissionsPesewas: number;
  totalRefundsPesewas: number;
  pendingRefundsCount: number;
  pendingRefundsPesewas: number;
  processingPaymentsCount: number;
  processingPaymentsPesewas: number;
  failedPaymentsCount: number;
  failedPaymentsPesewas: number;
  unreconciledEventsCount: number;
  ledgerBalanceStatus: 'BALANCED' | 'ANOMALY_DETECTED';
  recentDailyTrend: Array<{
    date: string;
    revenuePesewas: number;
    depositsPesewas: number;
    refundsPesewas: number;
  }>;
}

export interface AdminTransactionListItem {
  id: string;
  reference: string;
  type: TransactionType | string;
  status: TransactionStatus | string;
  amountPesewas: number;
  currency: Currency | string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  orderId?: string | null;
  paymentId?: string | null;
  providerReference?: string | null;
  network?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface AdminTransactionFilterQuery {
  search?: string;
  status?: string;
  type?: string;
  role?: string;
  network?: string;
  minAmountPesewas?: number;
  maxAmountPesewas?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface AdminTransactionDetailDto {
  transaction: AdminTransactionListItem;
  financialMovement: {
    ledgerJournalId?: string;
    debitAccount: string;
    creditAccount: string;
    debitAmountPesewas: number;
    creditAmountPesewas: number;
    balanceBeforePesewas?: number;
    balanceAfterPesewas?: number;
    ledgerLines: FinancialLedgerEntryDto[];
  };
  externalPayment?: {
    provider: string;
    providerReference?: string;
    paymentStatus: string;
    verificationStatus: string;
    webhookStatus?: string;
    webhookEventId?: string;
    verifiedAt?: string;
    rawMetadata?: any;
  };
  relatedOrder?: {
    id: string;
    publicId: string;
    productName?: string;
    dataAmountMb?: number;
    network?: string;
    recipientPhone?: string;
    orderStatus?: string;
    fulfillmentStatus?: string;
  };
  auditTrail: Array<{
    actorId: string;
    actorType: string;
    action: string;
    timestamp: string;
    ipAddress?: string;
    metadata?: any;
  }>;
}

export interface AdminLedgerAnomalyDto {
  transactionId: string;
  referenceType: string;
  referenceId: string;
  totalDebitsPesewas: number;
  totalCreditsPesewas: number;
  discrepancyPesewas: number;
  severity: LedgerAnomalySeverity | string;
  detectedAt: string;
  affectedAccounts: string[];
  journalLines: FinancialLedgerEntryDto[];
}

export interface ReconciliationDashboardDto {
  lastReconciliation: string;
  status: 'HEALTHY' | 'DISCREPANCIES_DETECTED' | 'RUNNING';
  paystackMetrics: {
    recordsChecked: number;
    matched: number;
    mismatched: number;
    amountDiscrepanciesPesewas: number;
    matchRatePercent: number;
  };
  datahouseMetrics: {
    recordsChecked: number;
    matched: number;
    mismatched: number;
    missingCarrierRecords: number;
    matchRatePercent: number;
  };
  ledgerMetrics: {
    totalJournalsChecked: number;
    balancedJournals: number;
    anomaliesCount: number;
    integrityPercent: number;
  };
  openCasesCount: number;
  criticalCasesCount: number;
}

export interface ReconciliationCaseDto {
  id: string;
  caseNumber: string;
  severity: ReconciliationSeverity | string;
  source: ReconciliationSource | string;
  accountId: string;
  accountName: string;
  amountPesewas: number;
  expectedState: string;
  actualState: string;
  discrepancyDetails: Record<string, any>;
  status: ReconciliationCaseStatus | string;
  assignedTo?: string | null;
  assignedName?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  escalatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateReconciliationCaseRequest {
  status: ReconciliationCaseStatus | string;
  resolutionNotes?: string;
  assignedTo?: string;
}

export interface AdminRefundListItemDto {
  id: string;
  orderId: string;
  orderPublicId: string;
  paymentId?: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  amountPesewas: number;
  reason: string;
  status: RefundAdminStatus | string;
  riskLevel: 'STANDARD' | 'HIGH_RISK';
  providerReference?: string;
  requestedAt: string;
  processedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
}

export interface AdminRefundActionRequest {
  action: 'APPROVE' | 'REJECT' | 'PROCESS';
  reason: string;
  rejectionReason?: string;
}

export interface FinancialAdjustmentDto {
  id: string;
  adjustmentNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  amountPesewas: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  requestedBy: string;
  requestedByName: string;
  status: FinancialAdjustmentStatus | string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  ledgerJournalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialAdjustmentRequest {
  userId: string;
  amountPesewas: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
}

export interface ReviewFinancialAdjustmentRequest {
  action: 'APPROVE' | 'REJECT';
  reason: string;
}

export interface FinancialSafetySettingsDto {
  emergencyPaymentsDisabled: boolean;
  emergencyWithdrawalsDisabled: boolean;
  emergencyRefundsDisabled: boolean;
  walletOperationsFrozen: boolean;
  agentPurchasesFrozen: boolean;
  globalMaintenanceMode: boolean;
  providerDisabled: {
    datahouse: boolean;
    paystack: boolean;
    gmpl: boolean;
  };
  maxSingleTransactionPesewas: number;
  maxDailyWithdrawalPesewas: number;
  maxDailyDepositPesewas: number;
  suspiciousVelocityThreshold: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface UpdateFinancialSafetySettingsRequest {
  settings: Partial<FinancialSafetySettingsDto>;
  reason: string;
}

export interface ReprocessEligibleItemDto {
  id: string;
  orderId: string;
  publicId: string;
  recipientPhone: string;
  network: string;
  amountPesewas: number;
  failureClass: string;
  errorCode: string;
  errorMessage: string;
  eligibleForRetry: boolean;
  retryReason: string;
}

export interface ReprocessPreviewDto {
  totalFailed: number;
  eligibleCount: number;
  ineligibleCount: number;
  eligibleItems: ReprocessEligibleItemDto[];
  summaryByNetwork: Record<string, number>;
}

export interface ReprocessExecuteRequest {
  itemIds?: string[];
  reprocessAllEligible?: boolean;
  reason: string;
}

// ==========================================
// Phase 11.10: API Management, Developer Platform & API Security DTOs
// ==========================================

export interface ApiServiceHealthItemDto {
  name: string;
  environment: 'LIVE' | 'TEST';
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  requests24h: number;
  errorRatePercent: number;
  avgLatencyMs: number;
}

export interface AdminApiOverviewStats {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  expiredKeys: number;
  productionKeys: number;
  testKeys: number;
  agentKeys: number;
  internalCredentials: number;
  requestsToday: number;
  requestsThisMonth: number;
  failedRequestsToday: number;
  rateLimitEventsToday: number;
  authFailuresToday: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  servicesHealth: ApiServiceHealthItemDto[];
}

export interface AdminApiKeyListItemDto {
  id: string;
  name: string;
  keyPrefix: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  environment: ApiKeyEnvironment;
  status: ApiKeyStatus;
  scopes: Permission[];
  rateLimitTier?: RateLimitTier;
  rateLimitPerMinute: number;
  ipRestrictions: string[];
  requestCount: number;
  lastUsedAt: string | null;
  lastRequestIp: string | null;
  lastRequestEndpoint: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminApiKeyDetailDto extends AdminApiKeyListItemDto {
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  rotationOfKeyId?: string | null;
  recentSecurityEventsCount: number;
  totalUsage24h: number;
}

export interface AdminCreateApiKeyRequest {
  ownerUserId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  expiresInDays?: number;
  rateLimitPerMinute?: number;
  ipRestrictions?: string[];
  stepUpPassword?: string;
}

export interface AdminRotateApiKeyRequest {
  expiresOldInHours?: number;
  reason: string;
  stepUpPassword?: string;
}

export interface AdminUpdateApiKeyRequest {
  name?: string;
  scopes?: Permission[];
  rateLimitPerMinute?: number;
  ipRestrictions?: string[];
  status?: ApiKeyStatus;
  reason?: string;
}

export interface AdminApiTimeSeriesPointDto {
  timestamp: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
}

export interface AdminApiTopEndpointDto {
  endpoint: string;
  method: string;
  requests: number;
  errorRatePercent: number;
  p95LatencyMs: number;
}

export interface AdminApiAgentUsageDto {
  agentId: string;
  agentName: string;
  requests: number;
  errors: number;
  lastUsedAt: string | null;
}

export interface AdminApiUsageAnalyticsDto {
  timeRange: string;
  totalRequests: number;
  successRequests: number;
  clientErrors: number;
  serverErrors: number;
  authFailures: number;
  rateLimitEvents: number;
  timeoutErrors: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  timeSeries: AdminApiTimeSeriesPointDto[];
  topEndpoints: AdminApiTopEndpointDto[];
  agentUsage: AdminApiAgentUsageDto[];
}

export interface AdminEndpointDetailDto {
  endpoint: string;
  method: string;
  requestCount: number;
  successRatePercent: number;
  failureRatePercent: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  authFailures: number;
  rateLimitEvents: number;
  topConsumers: Array<{ name: string; requests: number }>;
  recentErrors: Array<{ statusCode: number; message: string; timestamp: string }>;
}

export interface AdminApiSecurityEventDto {
  id: string;
  keyId?: string | null;
  keyPrefix?: string | null;
  userId?: string | null;
  userName?: string | null;
  eventType: ApiSecurityEventType;
  severity: ApiSecuritySeverity;
  ipAddress: string;
  endpoint: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface AdminWebhookListItemDto {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail?: string;
  url: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  rateLimitPerMinute: number;
  failureCount: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  successRatePercent: number;
  failedDeliveriesCount: number;
  retryCount: number;
  avgLatencyMs: number;
  createdAt: string;
}

export interface AdminCreateWebhookRequest {
  agentId: string;
  url: string;
  events: WebhookEvent[];
  rateLimitPerMinute?: number;
}

export interface AdminUpdateWebhookRequest {
  url?: string;
  events?: WebhookEvent[];
  status?: WebhookStatus;
  rateLimitPerMinute?: number;
  resetFailures?: boolean;
}

export interface AdminProviderConnectionDto {
  id: string;
  providerName: string;
  slug: string;
  isAuthoritative: boolean;
  environment: 'LIVE' | 'TEST';
  status: ProviderHealthStatus;
  priority: number;
  capabilities: string[];
  apiBaseUrl: string;
  authType: ProviderAuthType;
  lastHealthCheck: string | null;
  lastSuccessfulRequest: string | null;
  lastFailedRequest: string | null;
  lastError: string | null;
}

export interface AdminUpdateProviderConfigRequest {
  priority?: number;
  capabilities?: string[];
  apiBaseUrl?: string;
  status?: ProviderHealthStatus;
}

export interface AdminSwitchAuthoritativeProviderRequest {
  newProvider: string;
  reason: string;
  stepUpPassword?: string;
  runPreFlightHealthCheck?: boolean;
}

export interface AdminApiPolicyConfigDto {
  customerRateLimitPerMin: number;
  agentRateLimitPerMin: number;
  adminRateLimitPerMin: number;
  maxCustomRateLimitPerMin: number;
  apiKeyDefaultExpiryDays: number;
  enforceIpRestrictions: boolean;
  agentApiDisabled: boolean;
  sandboxApiDisabled: boolean;
  newOrdersApiDisabled: boolean;
  bulkOrdersApiDisabled: boolean;
  webhooksDisabled: boolean;
  providerIntegrationDisabled: boolean;
}

export interface AdminUpdateApiPolicyRequest {
  policies: Partial<AdminApiPolicyConfigDto>;
  reason: string;
}

export interface AdminApiConsumerDto {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  environment: ApiKeyEnvironment;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  keyCount: number;
  requestCount24h: number;
  totalRequests: number;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface AdminCreateApiConsumerRequest {
  name: string;
  description?: string;
  ownerUserId: string;
  environment: ApiKeyEnvironment;
}

export interface AdminUpdateApiConsumerRequest {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  reason?: string;
}

export interface AdminStructuredHealthComponentDto {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  latencyMs?: number;
  details?: Record<string, any>;
  lastCheckedAt: string;
}

export interface AdminStructuredHealthDto {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimeSeconds: number;
  components: {
    apiGateway: AdminStructuredHealthComponentDto;
    postgresql: AdminStructuredHealthComponentDto;
    redis: AdminStructuredHealthComponentDto;
    bullmq: AdminStructuredHealthComponentDto;
    datahouse: AdminStructuredHealthComponentDto;
    paystack: AdminStructuredHealthComponentDto;
    webhookProcessor: AdminStructuredHealthComponentDto;
  };
}

export interface AdminAgentApiDossierDto {
  agentId: string;
  agentName: string;
  agentEmail: string;
  keys: AdminApiKeyListItemDto[];
  consumers: AdminApiConsumerDto[];
  webhooks: AdminWebhookListItemDto[];
  usage24h: {
    totalRequests: number;
    errorRatePercent: number;
    avgLatencyMs: number;
  };
}

// =========================================================================
// Phase 11.11: Communication Center & System Messaging DTOs
// =========================================================================

export interface AdminCommunicationChannelHealthDto {
  channel: CommunicationChannel;
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'NOT_CONFIGURED';
  isConfigured: boolean;
  providerName: string;
  successRatePercent: number;
  lastDeliveredAt: string | null;
}

export interface AdminCommunicationOverviewStats {
  totalMessages: number;
  todayMessages: number;
  scheduledCount: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  emailDeliveryRate: number;
  inAppDeliveryRate: number;
  smsDeliveryRate: number | null;
  pushDeliveryRate: number | null;
  channelsHealth: AdminCommunicationChannelHealthDto[];
}

export interface AdminComposeMessageRequest {
  channels: CommunicationChannel[];
  targetType: CommunicationTargetType;
  recipientIds?: string[];
  recipientEmails?: string[];
  recipientRole?: UserRole;
  recipientStatus?: string;
  segment?: string;
  templateId?: string;
  subject: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: CommunicationPriority;
  scheduledAt?: string;
  isBroadcast?: boolean;
  justificationReason?: string;
}

export interface AdminCampaignListItemDto {
  id: string;
  title: string;
  description?: string;
  channels: CommunicationChannel[];
  targetType: CommunicationTargetType;
  segment?: string;
  audienceCount: number;
  subject: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: CommunicationPriority;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveredCount: number;
  failedCount: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateCampaignRequest {
  title: string;
  description?: string;
  channels: CommunicationChannel[];
  targetType: CommunicationTargetType;
  segment?: string;
  subject: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: CommunicationPriority;
  scheduledAt?: string;
  stepUpConfirmed?: boolean;
  justificationReason?: string;
}

export interface AdminNotificationTemplateDto {
  id: string;
  slug: string;
  name: string;
  category: NotificationCategory;
  channels: CommunicationChannel[];
  subjectTemplate: string;
  bodyTemplate: string;
  actionUrlTemplate?: string;
  availableVariables: string[];
  version: number;
  status: TemplateStatus;
  isSystemCritical: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateTemplateRequest {
  slug: string;
  name: string;
  category: NotificationCategory;
  channels: CommunicationChannel[];
  subjectTemplate: string;
  bodyTemplate: string;
  actionUrlTemplate?: string;
  availableVariables?: string[];
  isSystemCritical?: boolean;
}

export interface AdminUpdateTemplateRequest {
  name?: string;
  category?: NotificationCategory;
  channels?: CommunicationChannel[];
  subjectTemplate?: string;
  bodyTemplate?: string;
  actionUrlTemplate?: string;
  availableVariables?: string[];
  status?: TemplateStatus;
  isSystemCritical?: boolean;
  createNewVersion?: boolean;
  reason?: string;
}

export interface AdminDeliveryLogItemDto {
  id: string;
  messageId: string;
  campaignId?: string;
  templateId?: string;
  recipientUserId?: string;
  recipientName: string;
  recipientEmailRedacted: string;
  recipientPhoneRedacted: string;
  recipientRole: string;
  channel: CommunicationChannel;
  priority: CommunicationPriority;
  subject: string;
  bodyPreview: string;
  status: CommunicationDeliveryStatus;
  attempts: number;
  errorMessage?: string;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface AdminUserNotificationPreferenceDto {
  userId: string;
  emailOrderUpdates: boolean;
  emailAccountAlerts: boolean;
  emailMarketing: boolean;
  smsSecurity: boolean;
  smsTransactions: boolean;
  smsMarketing: boolean;
  inAppAll: boolean;
  updatedAt: string;
}

export interface AdminUpdateUserPreferenceRequest {
  emailOrderUpdates?: boolean;
  emailAccountAlerts?: boolean;
  emailMarketing?: boolean;
  smsSecurity?: boolean;
  smsTransactions?: boolean;
  smsMarketing?: boolean;
  inAppAll?: boolean;
}

// =========================================================================
// Phase 11.12: Audit & Security Operations DTOs
// =========================================================================

export interface AdminAuditOverviewStatsDto {
  totalEvents: number;
  criticalEventsCount: number;
  highSeverityCount: number;
  warningCount: number;
  failedLogins24h: number;
  rateLimitViolations24h: number;
  securityIncidentsCount: number;
  overallSecurityHealth: SecurityHealthStatus;
  tamperEvidenceStatus: 'VERIFIED' | 'TAMPER_DETECTED' | 'UNVERIFIED';
  lastChainedHash: string;
  verifiedBlocksCount: number;
}

export interface AdminAuditListItemDto {
  id: string;
  correlationId: string;
  timestamp: string;
  actorId: string | null;
  actorName: string;
  actorEmailRedacted: string;
  actorRole: string;
  actorType: string;
  action: string;
  category: AuditCategory;
  resourceType: string;
  resourceId: string | null;
  result: AuditResult;
  severity: AuditSeverity;
  ipAddress: string | null;
  userAgent: string | null;
  reason?: string;
  eventHash: string;
  previousEventHash: string | null;
}

export interface AdminAuditDetailDto extends AdminAuditListItemDto {
  metadata: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  linkedRecords?: {
    orderId?: string;
    paymentId?: string;
    walletId?: string;
    userId?: string;
    apiKeyId?: string;
  };
}

export interface AdminSecurityIncidentTimelineItem {
  timestamp: string;
  action: string;
  note: string;
  actorName: string;
}

export interface AdminSecurityIncidentDto {
  id: string;
  incidentNumber: string;
  title: string;
  severity: AuditSeverity;
  status: SecurityIncidentStatus;
  triggeringEventId: string | null;
  assignedAdminId?: string | null;
  assignedAdminName?: string;
  affectedUserId?: string | null;
  affectedUserEmail?: string;
  timeline: AdminSecurityIncidentTimelineItem[];
  investigationNotes: string;
  resolution?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateSecurityIncidentRequest {
  title: string;
  severity: AuditSeverity;
  triggeringEventId?: string;
  affectedUserId?: string;
  investigationNotes: string;
}

export interface AdminUpdateSecurityIncidentRequest {
  status?: SecurityIncidentStatus;
  severity?: AuditSeverity;
  assignedAdminId?: string;
  investigationNotes?: string;
  resolution?: string;
  timelineNote?: string;
}

export interface AdminAuditIntegrityVerificationDto {
  isTamperEvident: boolean;
  totalChecked: number;
  discrepanciesCount: number;
  brokenChains: Array<{
    eventId: string;
    expectedPrevHash: string;
    actualPrevHash: string;
    timestamp: string;
  }>;
  lastVerifiedAt: string;
}

export interface AdminAuditExportRequest {
  format: 'CSV' | 'JSON';
  category?: string;
  severity?: string;
  actorRole?: string;
  action?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminEmergencyControlToggleRequest {
  controlKey: 'MAINTENANCE_MODE' | 'DISABLE_AGENT_STORES' | 'KILL_SWITCH_PAYSTACK' | 'KILL_SWITCH_TELECOM_DISPATCH' | 'EMERGENCY_READ_ONLY';
  enabled: boolean;
  reason: string;
  stepUpConfirmation: string;
}

// ----------------------------------------------------
// Phase 11.13: System Configuration & Global Control
// ----------------------------------------------------

export interface AdminSubsystemHealthItemDto {
  component: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNCONFIGURED';
  message: string;
  latencyMs?: number;
  lastCheckedAt: string;
}

export interface AdminSystemHealthDiagnosticDto {
  overallStatus: ConfigurationHealthStatus;
  environment: string;
  uptimeSeconds: number;
  subsystems: AdminSubsystemHealthItemDto[];
  detectedIssuesCount: number;
}

export interface AdminGlobalConfigOverviewDto {
  platformStatus: 'OPERATIONAL' | 'MAINTENANCE' | 'DEGRADED';
  environment: string;
  configurationHealth: ConfigurationHealthStatus;
  lastConfigChangeAt: string | null;
  lastConfigChangeBy: string | null;
  totalConfigSettings: number;
  activeFeatureFlagsCount: number;
  activeSessionsCount: number;
  categoriesSummary: Array<{
    category: ConfigCategory;
    totalSettings: number;
    highRiskSettings: number;
    status: 'OPTIMAL' | 'ATTENTION_REQUIRED';
  }>;
}

export interface AdminSystemConfigItemDto {
  id: string;
  scope: ConfigScope;
  configKey: string;
  category: ConfigCategory;
  value: any;
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  isSecret: boolean;
  riskLevel: ConfigRiskLevel;
  requiresStepUp: boolean;
  description: string;
  version: number;
  lastModifiedBy?: string | null;
  lastModifiedByName?: string | null;
  lastModifiedAt: string;
  createdAt: string;
}

export interface AdminUpdateSystemConfigRequest {
  value: any;
  reason: string;
  stepUpConfirmation?: string;
}

export interface AdminConfigVersionItemDto {
  id: string;
  configKey: string;
  version: number;
  previousValue: any;
  newValue: any;
  changeReason: string;
  changedBy?: string | null;
  changedByName?: string | null;
  createdAt: string;
}

export interface AdminRollbackConfigRequest {
  targetVersion: number;
  reason: string;
  stepUpConfirmation: string;
}

export interface AdminFeatureFlagItemDto {
  id: string;
  flagKey: string;
  name: string;
  description: string;
  isEnabled: boolean;
  targetRole: FeatureFlagTargetRole;
  environment: string;
  lastToggledBy?: string | null;
  lastToggledByName?: string | null;
  lastToggledAt?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUpdateFeatureFlagRequest {
  isEnabled: boolean;
  targetRole?: FeatureFlagTargetRole;
  environment?: string;
  reason: string;
  stepUpConfirmation?: string;
}

export interface AdminActiveSessionDto {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface AdminRevokeSessionRequest {
  reason: string;
  revokeAllForUser?: boolean;
}

// Phase 11.14 — Permission Enforcement & Authorization Control DTOs
export interface PermissionMatrixEntryDto {
  permission: Permission;
  category: PermissionCategory;
  name: string;
  description: string;
  riskLevel: ConfigRiskLevel;
  requiresStepUp: boolean;
  allowedRoles: {
    customer: boolean;
    agent: boolean;
    operationsAdmin: boolean;
    financeAdmin: boolean;
    supportAdmin: boolean;
    developerAdmin: boolean;
    superAdmin: boolean;
  };
}

export interface AdminRolePermissionMatrixDto {
  registry: PermissionMatrixEntryDto[];
  roleBreakdown: Array<{
    role: UserRole;
    adminSubRole?: AdminSubRole;
    displayName: string;
    totalPermissions: number;
    effectivePermissions: Permission[];
  }>;
  totalPermissionsCount: number;
  lastEvaluatedAt: string;
}

export interface AdminUserEffectiveAuthorizationDto {
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  adminSubRole?: AdminSubRole;
  status: string;
  effectivePermissions: Permission[];
  tenantScope: {
    scopeType: 'GLOBAL' | 'AGENT_STORE' | 'CUSTOMER_SELF';
    description: string;
    resourceOwnerId?: string;
  };
  mfaEnforced: boolean;
  isLastSuperAdmin: boolean;
  canManageTargetUser: boolean;
}

// =========================================================================
// Phase 11.15: Notifications, Alerts & System Communications DTOs
// =========================================================================

export interface AdminNotificationOverviewDto {
  totalNotifications: number;
  unreadNotifications: number;
  systemAlerts: number;
  criticalAlerts: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  scheduledNotifications: number;
  activeNotificationRules: number;
  sentToday: number;
  deliverySuccessRate: number;
  recentSystemEvents: Array<{
    id: string;
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    createdAt: string;
  }>;
}

export interface AdminSystemAlertDto {
  id: string;
  severity: NotificationSeverity;
  source: AlertSource;
  condition: string;
  currentValue: string;
  threshold: string;
  status: AlertStatus;
  deduplicationKey: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  assignedToId?: string;
  assignedToName?: string;
  acknowledgedById?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  resolvedById?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  resolution?: string;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAlertEventDto {
  id: string;
  alertId: string;
  action: string;
  actorId: string;
  actorName: string;
  note?: string;
  previousStatus?: AlertStatus;
  newStatus?: AlertStatus;
  createdAt: string;
}

export interface AdminAcknowledgeAlertRequest {
  note?: string;
}

export interface AdminAssignAlertRequest {
  assigneeUserId: string;
  note?: string;
}

export interface AdminResolveAlertRequest {
  resolution: string;
  note?: string;
}

export interface AdminNotificationRuleDto {
  id: string;
  name: string;
  description: string;
  eventCondition: string;
  conditionValue: string;
  notifyRoles: UserRole[];
  notifyUserIds: string[];
  channels: CommunicationChannel[];
  severity: NotificationSeverity;
  templateId?: string;
  isActive: boolean;
  version: number;
  status: NotificationRuleStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateNotificationRuleRequest {
  name: string;
  description: string;
  eventCondition: string;
  conditionValue: string;
  notifyRoles: UserRole[];
  notifyUserIds?: string[];
  channels: CommunicationChannel[];
  severity: NotificationSeverity;
  templateId?: string;
}

export interface AdminUpdateNotificationRuleRequest {
  name?: string;
  description?: string;
  eventCondition?: string;
  conditionValue?: string;
  notifyRoles?: UserRole[];
  notifyUserIds?: string[];
  channels?: CommunicationChannel[];
  severity?: NotificationSeverity;
  templateId?: string;
  isActive?: boolean;
}

export interface AdminNotificationAnalyticsDto {
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  avgLatencyMs: number;
  retryRate: number;
  suppressionRate: number;
  byChannel: Array<{
    channel: CommunicationChannel;
    sent: number;
    delivered: number;
    failed: number;
    rate: number;
  }>;
  byEvent: Array<{
    event: string;
    count: number;
  }>;
  byRole: Array<{
    role: string;
    count: number;
  }>;
}

export interface AdminEmergencyBroadcastRequest {
  subject: string;
  body: string;
  severity: NotificationSeverity;
  audience: CommunicationTargetType;
  channels: CommunicationChannel[];
  startTime?: string;
  endTime?: string;
  justificationReason: string;
}

export interface AdminNotificationHistoryItemDto {
  id: string;
  recipientUserId: string;
  recipientName: string;
  recipientRole: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  bodyPreview: string;
  channel: CommunicationChannel;
  status: CommunicationDeliveryStatus;
  attempts: number;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface AdminNotificationDeliveryDetailDto {
  id: string;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  channelDeliveries: Array<{
    channel: CommunicationChannel;
    status: CommunicationDeliveryStatus;
    attempts: number;
    errorMessage?: string;
    providerResponse?: string;
    sentAt?: string;
    deliveredAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface UserNotificationItemDto {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionUrl?: string;
  isRead: boolean;
  channel: CommunicationChannel;
  createdAt: string;
}

export interface UserNotificationCountsDto {
  total: number;
  unread: number;
}

// =========================================================================
// Phase 11.9: Network & Telecom Provider Management DTOs
// =========================================================================

export interface ProviderTestRunItemDto {
  id: string;
  providerId: string;
  providerName: string;
  testType: ProviderTestType | string;
  environment: TelecomEnvironment | string;
  result: 'PASSED' | 'FAILED' | 'DEGRADED';
  durationMs: number;
  stepsJson: Array<{ step: string; status: string; latencyMs: number }>;
  providerReference?: string;
  errorCategory?: ConnectionDiagnosticCategory | string;
  errorMessage?: string;
  createdAt: string;
}

export interface TelecomNetworkDto {
  id: string;
  code: NetworkProvider;
  name: string;
  slug: string;
  status: TelecomProviderStatus | string;
  isActive: boolean;
  primaryProviderId?: string | null;
  primaryProviderName?: string | null;
  fallbackProviderId?: string | null;
  fallbackProviderName?: string | null;
  providersCount: number;
  endpointUrl?: string | null;
  webhookUrl?: string | null;
  dailyVolumeLimitMb: number;
  dailyOrderLimit: number;
  minBundleMb: number;
  maxBundleMb: number;
  uptimePercentage: number;
  latencyMs: number;
  successRatePercent: number;
  associatedProviders: Array<{
    providerId: string;
    providerName: string;
    role: NetworkProviderMappingRole | string;
    priority: number;
    status: string;
    latencyMs?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTelecomNetworkRequest {
  status?: TelecomProviderStatus | string;
  isActive?: boolean;
  primaryProviderId?: string;
  fallbackProviderId?: string;
  endpointUrl?: string;
  webhookUrl?: string;
  dailyVolumeLimitMb?: number;
  dailyOrderLimit?: number;
  minBundleMb?: number;
  maxBundleMb?: number;
}

export interface TelecomProviderDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  providerType: TelecomProviderType | string;
  environment: TelecomEnvironment | string;
  status: TelecomProviderStatus | string;
  isAuthoritative: boolean;
  supportedNetworks: NetworkProvider[];
  apiBaseUrl: string;
  apiVersion: string;
  authMethod: ProviderAuthMethod | string;
  webhookSupport: boolean;
  webhookUrl?: string | null;
  sandboxSupport: boolean;
  sandboxBaseUrl?: string | null;
  hasCredentials: {
    sandbox: boolean;
    production: boolean;
  };
  credentialsMasked: {
    apiKeyMasked?: string | null;
    webhookSecretMasked?: string | null;
    status?: string;
  };
  lastHealthCheck: string | null;
  lastSuccessfulRequest: string | null;
  lastFailure: string | null;
  lastError: string | null;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  totalRequestsCount: number;
  failedRequestsCount: number;
  capabilities: Record<ProviderCapabilityType | string, boolean>;
  networkMappings: Array<{
    networkCode: NetworkProvider;
    role: NetworkProviderMappingRole | string;
    priority: number;
    weightPercent: number;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTelecomProviderRequest {
  name: string;
  slug: string;
  description?: string;
  providerType: TelecomProviderType | string;
  environment?: TelecomEnvironment | string;
  status?: TelecomProviderStatus | string;
  isAuthoritative?: boolean;
  supportedNetworks: NetworkProvider[];
  apiBaseUrl: string;
  apiVersion?: string;
  authMethod: ProviderAuthMethod | string;
  webhookSupport?: boolean;
  webhookUrl?: string;
  sandboxSupport?: boolean;
  sandboxBaseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  capabilities?: Record<string, boolean>;
}

export interface UpdateTelecomProviderRequest {
  name?: string;
  slug?: string;
  description?: string;
  providerType?: TelecomProviderType | string;
  environment?: TelecomEnvironment | string;
  status?: TelecomProviderStatus | string;
  supportedNetworks?: NetworkProvider[];
  apiBaseUrl?: string;
  apiVersion?: string;
  authMethod?: ProviderAuthMethod | string;
  webhookSupport?: boolean;
  webhookUrl?: string;
  sandboxSupport?: boolean;
  sandboxBaseUrl?: string;
  capabilities?: Record<string, boolean>;
}

export interface ProviderCredentialDto {
  id: string;
  providerId: string;
  providerName?: string;
  environment: TelecomEnvironment | string;
  apiKeyMasked: string;
  webhookSecretMasked?: string | null;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED' | string;
  lastTestedAt?: string | null;
  lastTestResult?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderCredentialRequest {
  environment: TelecomEnvironment | string;
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
}

export interface RotateProviderCredentialRequest {
  environment: TelecomEnvironment | string;
  newApiKey: string;
  newApiSecret?: string;
  newWebhookSecret?: string;
  reason: string;
  expiresOldInHours?: number;
}

export interface ProviderIncidentDto {
  id: string;
  providerId: string;
  providerName: string;
  title: string;
  severity: ProviderIncidentSeverity | string;
  status: ProviderIncidentStatus | string;
  affectedNetwork: string; // 'MTN' | 'TELECEL' | 'AIRTELTIGO' | 'ALL'
  failureRatePercent: number;
  startedAt: string;
  resolvedAt?: string | null;
  summary: string;
  mitigationNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderIncidentRequest {
  providerId: string;
  title: string;
  severity: ProviderIncidentSeverity | string;
  status?: ProviderIncidentStatus | string;
  affectedNetwork?: string;
  failureRatePercent?: number;
  summary: string;
  mitigationNotes?: string;
}

export interface UpdateProviderIncidentRequest {
  title?: string;
  severity?: ProviderIncidentSeverity | string;
  status?: ProviderIncidentStatus | string;
  affectedNetwork?: string;
  failureRatePercent?: number;
  summary?: string;
  mitigationNotes?: string;
}

export interface NetworkProviderMappingDto {
  networkCode: NetworkProvider;
  primaryProvider: string;
  primaryProviderId?: string;
  fallbackProvider?: string | null;
  fallbackProviderId?: string | null;
  status: string;
  availableProviders: Array<{
    id: string;
    name: string;
    role: NetworkProviderMappingRole | string;
    priority: number;
    latencyMs: number;
    successRate: number;
  }>;
}

export interface UpdateNetworkRoutingRequest {
  network: NetworkProvider;
  primaryProvider: string;
  fallbackProvider?: string;
  reason?: string;
}

export interface AuthoritativeSwitchValidationItem {
  check: string;
  passed: boolean;
  message: string;
}

export interface AuthoritativeSwitchValidationResult {
  canSwitch: boolean;
  targetProvider: string;
  currentProvider: string;
  checks: AuthoritativeSwitchValidationItem[];
  timestamp: string;
}

export interface SwitchAuthoritativeProviderRequest {
  newProvider: string;
  reason: string;
  stepUpPassword?: string;
  forceSwitch?: boolean;
}

export interface TelecomControlPlaneOverviewDto {
  totalNetworks: number;
  activeNetworks: number;
  totalProviders: number;
  activeProviders: number;
  authoritativeProvider: string;
  systemAvailabilityPercent: number;
  averageLatencyMs: number;
  totalRequests24h: number;
  totalFailures24h: number;
  openIncidentsCount: number;
  networks: TelecomNetworkDto[];
  providers: TelecomProviderDetailDto[];
}

export interface ProviderHealthMetricDto {
  providerId: string;
  providerName: string;
  environment: string;
  status: string;
  latencyMs: number;
  uptimePercent: number;
  successRate: number;
  requestsCount: number;
  failuresCount: number;
  httpStatusDistribution: {
    status2xx: number;
    status4xx: number;
    status5xx: number;
  };
  failureBreakdown: {
    authFailures: number;
    webhookFailures: number;
    orderSubmissionFailures: number;
    reconciliationFailures: number;
    timeouts: number;
  };
  lastCheck: string;
}

// --- MTN & Carrier Beneficiary Precheck Contracts ---

export interface PublicBeneficiaryPrecheckRequest {
  network: NetworkProvider | string;
  phoneNumbers: string[];
}

export interface BeneficiaryPrecheckItem {
  phone: string;
  normalized: string;
  valid: boolean;
  known: boolean;
  accountName?: string;
}

export interface PublicBeneficiaryPrecheckData {
  network: NetworkProvider | string;
  results: BeneficiaryPrecheckItem[];
}

export interface AgentBeneficiaryPrecheckRequest {
  network: NetworkProvider | string;
  phoneNumbers: string[];
  record?: boolean;
}

export interface BeneficiaryPrecheckSummary {
  requested: number;
  unique: number;
  valid: number;
  invalid: number;
  known: number;
  unknown: number;
}

export interface AgentBeneficiaryPrecheckData {
  network: NetworkProvider | string;
  enforced: boolean;
  sandbox: boolean;
  recorded: boolean;
  reason?: string;
  summary: BeneficiaryPrecheckSummary;
  unknown: string[];
  results: BeneficiaryPrecheckItem[];
}

// --- Agent Orders List & Lookup Contracts ---

export interface AgentOrderDeliverySummary {
  approved: number;
  pending: number;
  failed: number;
  total: number;
}

export interface AgentOrderBeneficiaryItem {
  id: string;
  phoneNumber: string;
  dataVolumeGb: string;
  amount: string;
  network: string;
  status: string;
  isPorted: boolean;
}

export interface AgentOrderListItem {
  id: string;
  referenceCode: string;
  network: string;
  status: string;
  paymentStatus: string;
  amount: string;
  groupSizeGb: number;
  submissionId: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  beneficiaryCount: number;
  totalDataGb: number;
  delivery: AgentOrderDeliverySummary;
  beneficiaries: never[];
}

export interface AgentOrdersListData {
  data: AgentOrderListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AgentOrderDetailData {
  id: string;
  referenceCode: string;
  network: string;
  status: string;
  paymentStatus: string;
  amount: string;
  groupSizeGb: number;
  submissionId: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  paymentSplit?: { fromMain: number; fromOverdraft: number } | null;
  beneficiaryCount: number;
  totalDataGb: number;
  delivery: AgentOrderDeliverySummary;
  beneficiaries: AgentOrderBeneficiaryItem[];
}

// --- Agent Bulk Order Contracts ---

export interface AgentBulkOrderRecipient {
  phoneNumber: string;
  dataSizeGb: number;
}

export interface AgentBulkOrderRequest {
  network: NetworkProvider | string;
  recipients: AgentBulkOrderRecipient[];
  idempotencyKey: string;
  confirmedPorted?: string[];
  onUnvalidated?: 'set_aside' | 'reject';
}

export interface AgentBulkChildOrderDto {
  id: string;
  publicId: string;
  referenceCode: string;
  sizeGb: number;
  beneficiaryCount: number;
  amount: string;
  status: string;
}

export interface AgentBulkOrderResult {
  id: string;
  referenceCode: string;
  network: string;
  amount: string;
  status: string;
  createdAt: string;
  beneficiaryCount: number;
  groupCount: number;
  orders: AgentBulkChildOrderDto[];
  blocked: string[];
}

// --- Provider Operation Testing Contracts ---

export type ProviderTestOperationType =
  | 'HEALTH_CHECK'
  | 'AUTHENTICATION'
  | 'GET_AGENT'
  | 'GET_BALANCE'
  | 'GET_NETWORKS'
  | 'GET_BUNDLES'
  | 'VALIDATE_BENEFICIARY'
  | 'TEST_ORDER'
  | 'GET_ORDER_STATUS';

export interface ProviderTestOperationRequest {
  operation: ProviderTestOperationType;
  environment?: 'SANDBOX' | 'PRODUCTION' | string;
  recipientPhone?: string;
  network?: NetworkProvider | string;
  dataAmountMb?: number;
  bundleId?: string;
  providerReference?: string;
  orderId?: string;
}

export interface ProviderTestOperationResult {
  success: boolean;
  providerId: string;
  providerName: string;
  operation: ProviderTestOperationType;
  environment: string;
  httpStatus?: number;
  responseTimeMs: number;
  timestamp: string;
  sanitizedResponse?: Record<string, unknown> | null;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}

export interface ProviderDeleteResult {
  id: string;
  name: string;
  deleted: boolean;
  isSoftDeleted: boolean;
  reason: string;
}




