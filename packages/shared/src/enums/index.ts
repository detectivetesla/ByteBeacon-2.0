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
  AGENTS_READ = 'agents.read',
  AGENTS_SUSPEND = 'agents.suspend',

  // Developer & Infrastructure
  API_KEYS_MANAGE = 'api_keys.manage',
  WEBHOOKS_MANAGE = 'webhooks.manage',
  SANDBOX_MANAGE = 'sandbox.manage',

  // Platform & Security Controls
  AUDIT_READ = 'audit.read',
  SETTINGS_MANAGE = 'settings.manage',
  MAINTENANCE_MANAGE = 'maintenance.manage',
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
    Permission.AUDIT_READ,
  ],
  [AdminSubRole.FINANCE_ADMIN]: [
    Permission.WALLET_READ,
    Permission.WALLET_ADJUST,
    Permission.PAYMENTS_MANAGE,
    Permission.LEDGER_READ,
    Permission.PRICING_MANAGE,
    Permission.ORDERS_REFUND,
    Permission.REPORTS_VIEW,
    Permission.AUDIT_READ,
  ],
  [AdminSubRole.SUPPORT_ADMIN]: [
    Permission.USERS_READ,
    Permission.ORDERS_READ,
    Permission.WALLET_READ,
    Permission.AGENTS_READ,
  ],
  [AdminSubRole.DEVELOPER_ADMIN]: [
    Permission.API_KEYS_MANAGE,
    Permission.WEBHOOKS_MANAGE,
    Permission.SANDBOX_MANAGE,
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
