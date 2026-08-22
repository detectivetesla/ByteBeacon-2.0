export enum Environment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum NetworkProvider {
  MTN = 'MTN',
  TELECEL = 'TELECEL',
  AIRTELTIGO = 'AIRTELTIGO',
}

export enum Currency {
  GHS = 'GHS',
  USD = 'USD',
}

export enum SecurityDomain {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  PROVIDER = 'PROVIDER',
  INTERNAL_WORKER = 'INTERNAL_WORKER',
}

export enum UserRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum AdminSubRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATIONS_ADMIN = 'OPERATIONS_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  DEVELOPER_ADMIN = 'DEVELOPER_ADMIN',
  READ_ONLY_ANALYST = 'READ_ONLY_ANALYST',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum ApiKeyEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum Permission {
  // Orders & Telecom Operations
  ORDERS_READ = 'orders.read',
  ORDERS_CREATE = 'orders.create',
  ORDERS_REFUND = 'orders.refund',
  ORDERS_RECONCILE = 'orders.reconcile',
  ORDERS_RETRY = 'orders.retry',
  PENDING_MTN_MANAGE = 'pending_mtn.manage',

  // Wallet & Finance
  WALLET_READ = 'wallet.read',
  WALLET_ADJUST = 'wallet.adjust',
  PAYMENTS_MANAGE = 'payments.manage',
  LEDGER_READ = 'ledger.read',
  PRICING_MANAGE = 'pricing.manage',

  // User & Agent Management
  USERS_READ = 'users.read',
  USERS_MANAGE = 'users.manage',
  USERS_CREATE = 'users.create',
  USERS_ROLE_PROMOTE = 'users.role_promote',
  USERS_SECURITY_MANAGE = 'users.security_manage',
  AGENTS_READ = 'agents.read',
  AGENTS_SUSPEND = 'agents.suspend',

  // Catalog & Telecom Providers
  CATALOG_PRICING_MANAGE = 'catalog.pricing_manage',
  PROVIDERS_MANAGE = 'providers.manage',
  PROVIDERS_CREDENTIALS_READ = 'providers.credentials_read',

  // Developer & Infrastructure
  API_KEYS_MANAGE = 'api_keys.manage',
  WEBHOOKS_MANAGE = 'webhooks.manage',
  SANDBOX_MANAGE = 'sandbox.manage',

  // Communication
  COMMUNICATION_BROADCAST = 'communication.broadcast',
  COMMUNICATION_TEMPLATES_MANAGE = 'communication.templates_manage',

  // Platform & Security Controls
  AUDIT_READ = 'audit.read',
  SETTINGS_MANAGE = 'settings.manage',
  FEATURE_FLAGS_MANAGE = 'feature_flags.manage',
  MAINTENANCE_MANAGE = 'maintenance.manage',
  SYSTEM_MAINTENANCE_TOGGLE = 'system.maintenance_toggle',
  REPORTS_VIEW = 'reports.view',
}

export const ADMIN_ROLE_PERMISSIONS: Record<AdminSubRole, Permission[]> = {
  [AdminSubRole.SUPER_ADMIN]: Object.values(Permission),
  [AdminSubRole.OPERATIONS_ADMIN]: [
    Permission.ORDERS_READ,
    Permission.ORDERS_RETRY,
    Permission.PENDING_MTN_MANAGE,
    Permission.ORDERS_RECONCILE,
    Permission.ORDERS_REFUND,
    Permission.USERS_READ,
    Permission.AGENTS_READ,
    Permission.AUDIT_READ,
    Permission.REPORTS_VIEW,
  ],
  [AdminSubRole.FINANCE_ADMIN]: [
    Permission.WALLET_READ,
    Permission.WALLET_ADJUST,
    Permission.PAYMENTS_MANAGE,
    Permission.LEDGER_READ,
    Permission.PRICING_MANAGE,
    Permission.CATALOG_PRICING_MANAGE,
    Permission.ORDERS_REFUND,
    Permission.REPORTS_VIEW,
    Permission.AUDIT_READ,
  ],
  [AdminSubRole.SUPPORT_ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_MANAGE,
    Permission.ORDERS_READ,
    Permission.WALLET_READ,
    Permission.AGENTS_READ,
    Permission.AUDIT_READ,
  ],
  [AdminSubRole.DEVELOPER_ADMIN]: [
    Permission.API_KEYS_MANAGE,
    Permission.WEBHOOKS_MANAGE,
    Permission.SANDBOX_MANAGE,
    Permission.PROVIDERS_MANAGE,
    Permission.AUDIT_READ,
  ],
  [AdminSubRole.READ_ONLY_ANALYST]: [
    Permission.ORDERS_READ,
    Permission.WALLET_READ,
    Permission.USERS_READ,
    Permission.AGENTS_READ,
    Permission.LEDGER_READ,
    Permission.REPORTS_VIEW,
    Permission.AUDIT_READ,
  ],
};

export function hasCapability(role: AdminSubRole, permission: Permission): boolean {
  const perms = ADMIN_ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export enum RateLimitTier {
  TIER_PUBLIC = 'TIER_PUBLIC',
  TIER_CUSTOMER = 'TIER_CUSTOMER',
  TIER_AGENT = 'TIER_AGENT',
  TIER_ADMIN = 'TIER_ADMIN',
}

// --- 4 Independent Status Dimensions (Core Invariant) ---

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  READY_FOR_FULFILLMENT = 'READY_FOR_FULFILLMENT',
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ProviderStatus {
  UNKNOWN = 'UNKNOWN',
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum RefundStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

// --- Beneficiary & Bulk Statuses ---

export enum BeneficiaryValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

export enum BulkSubmissionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum OrderEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_VALIDATED = 'ORDER_VALIDATED',
  ORDER_VALIDATION_FAILED = 'ORDER_VALIDATION_FAILED',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  ORDER_READY_FOR_FULFILLMENT = 'ORDER_READY_FOR_FULFILLMENT',
  ORDER_SUBMITTED = 'ORDER_SUBMITTED',
  PROVIDER_STATUS_UPDATED = 'PROVIDER_STATUS_UPDATED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_FAILED = 'ORDER_FAILED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
}

// --- Phase 4 Financial & Payment Enums ---

export enum PaymentMethod {
  MOMO = 'MOMO',
  CARD = 'CARD',
  WALLET = 'WALLET',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentChannel {
  MTN_MOMO = 'MTN_MOMO',
  TELECEL_CASH = 'TELECEL_CASH',
  AIRTELTIGO_MONEY = 'AIRTELTIGO_MONEY',
  VISA_MASTERCARD = 'VISA_MASTERCARD',
}

export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum LedgerAccountType {
  CUSTOMER_WALLET = 'CUSTOMER_WALLET',
  AGENT_WALLET = 'AGENT_WALLET',
  PLATFORM_ESCROW = 'PLATFORM_ESCROW',
  PROVIDER_PAYABLE = 'PROVIDER_PAYABLE',
}

export enum PaymentEventType {
  PAYMENT_INITIALIZED = 'PAYMENT_INITIALIZED',
  PAYMENT_AUTHORIZED = 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
}

export enum RefundEventType {
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  REFUND_FAILED = 'REFUND_FAILED',
  REFUND_REVERSED = 'REFUND_REVERSED',
}

export enum ReconciliationStatus {
  MATCHED = 'MATCHED',
  DISCREPANCY = 'DISCREPANCY',
  PENDING_INVESTIGATION = 'PENDING_INVESTIGATION',
}

// --- Phase 11.6 Catalog Enums ---

export enum CatalogPlanStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
}

export enum CatalogProviderStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
  SUSPENDED = 'SUSPENDED',
  PROVIDER_REMOVED = 'PROVIDER_REMOVED',
  SYNC_ERROR = 'SYNC_ERROR',
}

export enum CatalogPricingMode {
  FIXED = 'FIXED',
  PERCENTAGE_MARKUP = 'PERCENTAGE_MARKUP',
  ABSOLUTE_MARKUP = 'ABSOLUTE_MARKUP',
}

export enum CatalogSyncChangeType {
  NEW_PLAN = 'NEW_PLAN',
  PRICE_CHANGE = 'PRICE_CHANGE',
  REMOVED_PLAN = 'REMOVED_PLAN',
  NETWORK_CHANGE = 'NETWORK_CHANGE',
  NO_CHANGE = 'NO_CHANGE',
}

export enum CatalogSyncBatchStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  PARTIALLY_APPLIED = 'PARTIALLY_APPLIED',
}

// --- Phase 11.7 Agent & Store Enums ---

export enum AgentAccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  RESTRICTED = 'RESTRICTED',
  DISABLED = 'DISABLED',
}

export enum StoreStatus {
  NOT_STARTED = 'NOT_STARTED',
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum StoreApprovalStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum StorePayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  HELD = 'HELD',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

// --- Phase 11.8 Finance, Transactions & Reconciliation Enums ---

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  DATA_PURCHASE = 'DATA_PURCHASE',
  REFUND = 'REFUND',
  WITHDRAWAL = 'WITHDRAWAL',
  COMMISSION = 'COMMISSION',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
  AGENT_ACTIVATION = 'AGENT_ACTIVATION',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  REVERSED = 'REVERSED',
  PENDING_RECONCILIATION = 'PENDING_RECONCILIATION',
}

export enum ReconciliationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ReconciliationSource {
  PAYSTACK = 'PAYSTACK',
  DATAHOUSE = 'DATAHOUSE',
  LEDGER = 'LEDGER',
  WALLET = 'WALLET',
  ORDERS = 'ORDERS',
}

export enum ReconciliationCaseStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export enum FinancialAdjustmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

export enum RefundAdminStatus {
  REQUESTED = 'REQUESTED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum LedgerAnomalySeverity {
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// --- Phase 11.10 Enums: API Management, Developer Platform & Security ---

export enum ApiSecurityEventType {
  INVALID_API_KEY = 'INVALID_API_KEY',
  AUTH_FAILURE = 'AUTH_FAILURE',
  SUSPICIOUS_IP = 'SUSPICIOUS_IP',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SCOPE_VIOLATION = 'SCOPE_VIOLATION',
  EXPIRED_KEY_ATTEMPT = 'EXPIRED_KEY_ATTEMPT',
  REVOKED_KEY_ATTEMPT = 'REVOKED_KEY_ATTEMPT',
  ABNORMAL_TRAFFIC = 'ABNORMAL_TRAFFIC',
}

export enum ApiSecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum WebhookEvent {
  ORDER_CREATED = 'order.created',
  ORDER_PROCESSING = 'order.processing',
  ORDER_COMPLETED = 'order.completed',
  ORDER_FAILED = 'order.failed',
  ORDER_REFUNDED = 'order.refunded',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  WALLET_UPDATED = 'wallet.updated',
}

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  FAILED = 'FAILED',
}

export enum ProviderAuthType {
  BEARER = 'BEARER',
  API_KEY = 'API_KEY',
  BASIC = 'BASIC',
  HMAC_SHA256 = 'HMAC_SHA256',
}

export enum ProviderHealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
  MAINTENANCE = 'MAINTENANCE',
}

export enum RateLimitTier {
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
  CUSTOM = 'CUSTOM',
}

// =========================================================================
// Phase 11.11: Communication Center & Messaging Administration Enums
// =========================================================================

export enum CommunicationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export enum CommunicationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum CommunicationDeliveryStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
}

export enum CommunicationTargetType {
  INDIVIDUAL = 'INDIVIDUAL',
  CUSTOM_GROUP = 'CUSTOM_GROUP',
  ROLE = 'ROLE',
  ACCOUNT_STATUS = 'ACCOUNT_STATUS',
  AGENT_SEGMENT = 'AGENT_SEGMENT',
  CUSTOMER_SEGMENT = 'CUSTOMER_SEGMENT',
  BROADCAST = 'BROADCAST',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum TemplateStatus {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export enum NotificationCategory {
  AUTH = 'AUTH',
  WALLET = 'WALLET',
  ORDERS = 'ORDERS',
  BENEFICIARY = 'BENEFICIARY',
  STORE = 'STORE',
  API = 'API',
  MARKETING = 'MARKETING',
  SYSTEM = 'SYSTEM',
}

// =========================================================================
// Phase 11.12: Audit & Security Operations Enums
// =========================================================================

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AuditCategory {
  AUTH = 'AUTH',
  AUTHORIZATION = 'AUTHORIZATION',
  API_SECURITY = 'API_SECURITY',
  FINANCIAL_SECURITY = 'FINANCIAL_SECURITY',
  TELECOM_SECURITY = 'TELECOM_SECURITY',
  SYSTEM_WORKER = 'SYSTEM_WORKER',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
  CHALLENGED = 'CHALLENGED',
}

export enum SecurityIncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  CONTAINED = 'CONTAINED',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
}

export enum SecurityHealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum ConfigRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ConfigScope {
  GLOBAL = 'GLOBAL',
  SECURITY = 'SECURITY',
  PAYMENTS = 'PAYMENTS',
  TELECOM = 'TELECOM',
  ORDERS = 'ORDERS',
  CATALOG = 'CATALOG',
  AGENTS = 'AGENTS',
  CUSTOMERS = 'CUSTOMERS',
  APIS = 'APIS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  RATE_LIMITS = 'RATE_LIMITS',
  MAINTENANCE = 'MAINTENANCE',
}

export enum ConfigCategory {
  GENERAL = 'GENERAL',
  SECURITY = 'SECURITY',
  PAYMENTS = 'PAYMENTS',
  TELECOM = 'TELECOM',
  ORDERS = 'ORDERS',
  CATALOG = 'CATALOG',
  AGENTS = 'AGENTS',
  APIS = 'APIS',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SYSTEM = 'SYSTEM',
}

export enum FeatureFlagTargetRole {
  ALL = 'ALL',
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  CUSTOMER = 'CUSTOMER',
}

export enum ConfigurationHealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  CRITICAL = 'CRITICAL',
}
