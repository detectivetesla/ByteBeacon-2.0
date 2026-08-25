import { apiClient } from './httpClient.js';
import {
  IntegrationHealthReport,
  CatalogProductDto,
  AdminCatalogStats,
  AdminCatalogPlanDetail,
  CreateCatalogPlanRequest,
  UpdateCatalogPlanRequest,
  BulkCatalogActionRequest,
  BulkPricingPreviewRequest,
  BulkPricingPreviewResponse,
  BulkPricingApplyRequest,
  ProviderCatalogSyncBatchDto,
  CatalogPlanStatus,
  CatalogProviderStatus,
  AdminAgentStats,
  AdminAgentListItem,
  AdminAgentDetail,
  CreateAgentAdminRequest,
  UpdateAgentAdminRequest,
  UpdateAgentStatusRequest,
  AgentCustomPricingItemDto,
  UpdateAgentPricingRequest,
  AgentSubAgentSummaryDto,
  AgentCustomerSummaryDto,
  AdminStoreStats,
  AdminStoreListItem,
  AdminStoreDetail,
  StoreProductAdminDto,
  UpdateStoreProductsRequest,
  StorePayoutDto,
  StorePayoutActionRequest,
  StoreHealthReportDto,
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
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminTransactionFilterQuery,
  AdminTransactionDetailDto,
  AdminLedgerAnomalyDto,
  ReconciliationDashboardDto,
  ReconciliationCaseDto,
  UpdateReconciliationCaseRequest,
  AdminRefundListItemDto,
  AdminRefundActionRequest,
  FinancialAdjustmentDto,
  CreateFinancialAdjustmentRequest,
  ReviewFinancialAdjustmentRequest,
  FinancialSafetySettingsDto,
  UpdateFinancialSafetySettingsRequest,
  ReprocessEligibleItemDto,
  ReprocessPreviewDto,
  ReprocessExecuteRequest,
  ApiKeyEnvironment,
  ApiKeyStatus,
  Permission,
  ApiSecurityEventType,
  ApiSecuritySeverity,
  WebhookEvent,
  WebhookStatus,
  ProviderAuthType,
  ProviderHealthStatus,
  RateLimitTier,
  AdminApiOverviewStats,
  AdminApiKeyListItemDto,
  AdminApiKeyDetailDto,
  AdminCreateApiKeyRequest,
  AdminRotateApiKeyRequest,
  AdminUpdateApiKeyRequest,
  AdminApiUsageAnalyticsDto,
  AdminEndpointDetailDto,
  AdminApiSecurityEventDto,
  AdminWebhookListItemDto,
  AdminCreateWebhookRequest,
  AdminUpdateWebhookRequest,
  AdminProviderConnectionDto,
  AdminUpdateProviderConfigRequest,
  AdminSwitchAuthoritativeProviderRequest,
  AdminApiPolicyConfigDto,
  AdminUpdateApiPolicyRequest,
  AdminApiConsumerDto,
  AdminCreateApiConsumerRequest,
  AdminUpdateApiConsumerRequest,
  AdminStructuredHealthDto,
  AdminAgentApiDossierDto,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationDeliveryStatus,
  CommunicationTargetType,
  CampaignStatus,
  TemplateStatus,
  NotificationCategory,
  AdminCommunicationChannelHealthDto,
  AdminCommunicationOverviewStats,
  AdminComposeMessageRequest,
  AdminCampaignListItemDto,
  AdminCreateCampaignRequest,
  AdminNotificationTemplateDto,
  AdminCreateTemplateRequest,
  AdminUpdateTemplateRequest,
  AdminDeliveryLogItemDto,
  AdminUserNotificationPreferenceDto,
  AdminUpdateUserPreferenceRequest,
  AuditSeverity,
  AuditCategory,
  AuditResult,
  SecurityIncidentStatus,
  SecurityHealthStatus,
  AdminAuditOverviewStatsDto,
  AdminAuditListItemDto,
  AdminAuditDetailDto,
  AdminSecurityIncidentDto,
  AdminCreateSecurityIncidentRequest,
  AdminUpdateSecurityIncidentRequest,
  AdminAuditIntegrityVerificationDto,
  AdminAuditExportRequest,
  AdminEmergencyControlToggleRequest,
  ConfigRiskLevel,
  ConfigScope,
  ConfigCategory,
  FeatureFlagTargetRole,
  ConfigurationHealthStatus,
  AdminGlobalConfigOverviewDto,
  AdminSystemConfigItemDto,
  AdminUpdateSystemConfigRequest,
  AdminConfigVersionItemDto,
  AdminRollbackConfigRequest,
  AdminFeatureFlagItemDto,
  AdminUpdateFeatureFlagRequest,
  AdminActiveSessionDto,
  AdminRevokeSessionRequest,
  AdminSystemHealthDiagnosticDto,
  AdminSubsystemHealthItemDto,
  PermissionCategory,
  PermissionMatrixEntryDto,
  AdminRolePermissionMatrixDto,
  AdminUserEffectiveAuthorizationDto,
  UserRole,
  NotificationSeverity,
  NotificationType,
  AlertStatus,
  AlertSource,
  NotificationRuleStatus,
  AdminNotificationOverviewDto,
  AdminSystemAlertDto,
  AdminAlertEventDto,
  AdminAcknowledgeAlertRequest,
  AdminAssignAlertRequest,
  AdminResolveAlertRequest,
  AdminNotificationRuleDto,
  AdminCreateNotificationRuleRequest,
  AdminUpdateNotificationRuleRequest,
  AdminNotificationAnalyticsDto,
  AdminEmergencyBroadcastRequest,
  AdminNotificationHistoryItemDto,
  AdminNotificationDeliveryDetailDto,
  UserNotificationItemDto,
  UserNotificationCountsDto,
  TelecomControlPlaneOverviewDto,
  TelecomNetworkDto,
  UpdateTelecomNetworkRequest,
  TelecomProviderDetailDto,
  CreateTelecomProviderRequest,
  UpdateTelecomProviderRequest,
  ProviderCredentialDto,
  CreateProviderCredentialRequest,
  RotateProviderCredentialRequest,
  ProviderIncidentDto,
  CreateProviderIncidentRequest,
  UpdateProviderIncidentRequest,
  NetworkProviderMappingDto,
  UpdateNetworkRoutingRequest,
  AuthoritativeSwitchValidationResult,
  SwitchAuthoritativeProviderRequest,
  ProviderHealthMetricDto,
  ProviderConnectionTestResult,
  SandboxTransactionTestInput,
  SandboxTransactionTestResult,
  TelecomProviderType,
  TelecomProviderStatus,
  TelecomEnvironment,
  ProviderAuthMethod,
  ProviderCapabilityType,
  ProviderIncidentSeverity,
  ProviderIncidentStatus,
} from '@bytebeacon/shared';


export {
  UserRole,
  AgentAccountStatus,
  StoreStatus,
  StoreApprovalStatus,
  StorePayoutStatus,
  CatalogPlanStatus,
  CatalogProviderStatus,
  TransactionType,
  TransactionStatus,
  ReconciliationSeverity,
  ReconciliationSource,
  ReconciliationCaseStatus,
  FinancialAdjustmentStatus,
  RefundAdminStatus,
  LedgerAnomalySeverity,
  ApiKeyEnvironment,
  ApiKeyStatus,
  Permission,
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
  ProviderIncidentSeverity,
  ProviderIncidentStatus,
};

export type {
  AdminApiOverviewStats,
  AdminApiKeyListItemDto,
  AdminApiKeyDetailDto,
  AdminCreateApiKeyRequest,
  AdminRotateApiKeyRequest,
  AdminUpdateApiKeyRequest,
  AdminApiUsageAnalyticsDto,
  AdminEndpointDetailDto,
  AdminApiSecurityEventDto,
  AdminWebhookListItemDto,
  AdminCreateWebhookRequest,
  AdminUpdateWebhookRequest,
  AdminProviderConnectionDto,
  AdminUpdateProviderConfigRequest,
  AdminSwitchAuthoritativeProviderRequest,
  AdminApiPolicyConfigDto,
  AdminUpdateApiPolicyRequest,
  AdminApiConsumerDto,
  AdminCreateApiConsumerRequest,
  AdminUpdateApiConsumerRequest,
  AdminStructuredHealthDto,
  AdminAgentApiDossierDto,
  AdminCommunicationChannelHealthDto,
  AdminCommunicationOverviewStats,
  AdminComposeMessageRequest,
  AdminCampaignListItemDto,
  AdminCreateCampaignRequest,
  AdminNotificationTemplateDto,
  AdminCreateTemplateRequest,
  AdminUpdateTemplateRequest,
  AdminDeliveryLogItemDto,
  AdminUserNotificationPreferenceDto,
  AdminUpdateUserPreferenceRequest,
  AdminAuditOverviewStatsDto,
  AdminAuditListItemDto,
  AdminAuditDetailDto,
  AdminSecurityIncidentDto,
  AdminCreateSecurityIncidentRequest,
  AdminUpdateSecurityIncidentRequest,
  AdminAuditIntegrityVerificationDto,
  AdminAuditExportRequest,
  AdminEmergencyControlToggleRequest,
  AdminNotificationOverviewDto,
  AdminSystemAlertDto,
  AdminAlertEventDto,
  AdminAcknowledgeAlertRequest,
  AdminAssignAlertRequest,
  AdminResolveAlertRequest,
  AdminNotificationRuleDto,
  AdminCreateNotificationRuleRequest,
  AdminUpdateNotificationRuleRequest,
  AdminNotificationAnalyticsDto,
  AdminEmergencyBroadcastRequest,
  AdminNotificationHistoryItemDto,
  AdminNotificationDeliveryDetailDto,
  UserNotificationItemDto,
  UserNotificationCountsDto,
};
export type {
  AdminAgentStats,
  AdminAgentListItem,
  AdminAgentDetail,
  CreateAgentAdminRequest,
  UpdateAgentAdminRequest,
  UpdateAgentStatusRequest,
  AgentCustomPricingItemDto,
  UpdateAgentPricingRequest,
  AgentSubAgentSummaryDto,
  AgentCustomerSummaryDto,
  AdminStoreStats,
  AdminStoreListItem,
  AdminStoreDetail,
  StoreProductAdminDto,
  UpdateStoreProductsRequest,
  StorePayoutDto,
  StorePayoutActionRequest,
  StoreHealthReportDto,
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminTransactionFilterQuery,
  AdminTransactionDetailDto,
  AdminLedgerAnomalyDto,
  ReconciliationDashboardDto,
  ReconciliationCaseDto,
  UpdateReconciliationCaseRequest,
  AdminRefundListItemDto,
  AdminRefundActionRequest,
  FinancialAdjustmentDto,
  CreateFinancialAdjustmentRequest,
  ReviewFinancialAdjustmentRequest,
  FinancialSafetySettingsDto,
  UpdateFinancialSafetySettingsRequest,
  ReprocessEligibleItemDto,
  ReprocessPreviewDto,
  ReprocessExecuteRequest,
};

export interface AdminUserStats {
  total: number;
  customers: number;
  agents: number;
  admins: number;
  superAdmins: number;
  active: number;
  suspended: number;
  unverified: number;
  mfaEnabled: number;
  recentlyRegistered: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  role: string;
  status: string;
  securityDomain?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  walletBalancePesewas: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminUserDetail {
  user: AdminUserListItem & {
    phoneVerified: boolean;
    emailVerified: boolean;
    mfaEnabled: boolean;
    failedLoginAttempts: number;
    lockedUntil?: string;
    updatedAt: string;
  };
  financialSummary?: {
    walletBalancePesewas: number;
    ledgerDerivedBalancePesewas: number;
    totalDepositsPesewas: number;
    totalSpentPesewas: number;
    totalRefundsPesewas: number;
    totalWithdrawalsPesewas: number;
    pendingOperationsPesewas: number;
    lifetimeValuePesewas: number;
    reconciliationStatus: 'RECONCILED' | 'DISCREPANCY_DETECTED';
    discrepancyPesewas: number;
  };
  orderSummary?: {
    totalOrders: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
    refunded: number;
    cancelled: number;
    lastOrderAt?: string | null;
    dailyOrders: number;
    dailySpentPesewas: number;
  };
  metrics?: {
    totalOrders: number;
    totalSpentPesewas: number;
    dailyOrders: number;
    dailySpentPesewas: number;
    totalRefundsPesewas: number;
    dailyRefundsPesewas: number;
  };
  recentOrders: Array<{
    id: string;
    publicId?: string;
    recipientPhone: string;
    network: string;
    dataAmountMb: number;
    amountPesewas: number;
    orderStatus: string;
    paymentStatus?: string;
    providerStatus?: string;
    refundStatus?: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  recentLedgerLines: Array<{
    id: string;
    transactionId?: string;
    entryType: string;
    amountPesewas: number;
    accountType?: string;
    referenceType: string;
    referenceId: string;
    description: string;
    createdAt: string;
  }>;
  transactions?: Array<{
    id: string;
    amountPesewas: number;
    currency: string;
    provider: string;
    paymentMethod: string;
    status: string;
    paidAt?: string;
    createdAt: string;
  }>;
  activeSessions: Array<{
    id: string;
    userAgent: string;
    ipAddress: string;
    deviceId: string;
    isRevoked: boolean;
    lastActiveAt: string;
    createdAt: string;
  }>;
  activity?: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string;
    ipAddress?: string;
    createdAt: string;
    metadata?: any;
  }>;
  notifications?: Array<{
    id: string;
    channel: string;
    subject?: string;
    message?: string;
    createdAt: string;
  }>;
  agentData?: {
    store?: {
      id: string;
      storeName: string;
      slug: string;
      status: string;
      commissionRate: number;
      customDomain?: string;
      createdAt: string;
    } | null;
    apiKeys?: Array<{
      id: string;
      name: string;
      keyPrefix: string;
      environment: string;
      status: string;
      rateLimitTier: string;
      lastUsedAt?: string;
      createdAt: string;
    }>;
    revenuePesewas?: number;
    commissionEarnedPesewas?: number;
    subAgentsCount?: number;
    withdrawableFloatPesewas?: number;
  } | null;
  adminData?: {
    permissions: string[];
  } | null;
}

export interface AdminAnalyticsOverview {
  range: string;
  users: {
    total: number;
    customers: number;
    agents: number;
    admins: number;
    superAdmins?: number;
    active: number;
  };
  orders: {
    total: number;
    lifetimeTotal?: number;
    periodTotal?: number;
    completed: number;
    processing: number;
    failed: number;
    refunded: number;
    completionRate: number;
  };
  revenue: {
    periodPesewas?: number;
    lifetimePesewas: number;
    todayPesewas: number;
    monthPesewas: number;
    platformMarginPesewas?: number;
  };
  financialHealth?: {
    ledgerStatus: string;
    totalWalletLiabilitiesPesewas: number;
    agentWalletPesewas: number;
    customerWalletPesewas: number;
    unreconciledDiscrepancies: number;
  };
  networks: Array<{
    network: string;
    orderCount: number;
    volumePesewas: number;
    sharePct?: number;
  }>;
  stores: {
    total: number;
    active: number;
  };
  queues: {
    pendingDlq: number;
    pendingMtnApprovals: number;
    processingOrders: number;
  };
  systemStatus?: Record<string, string>;
  alerts?: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    source: string;
    actionPath?: string;
  }>;
  recentOrders?: any[];
  recentUsers?: any[];
}

export interface AdminOrderStats {
  totalOrders: number;
  processing: number;
  completed: number;
  failed: number;
  refunded: number;
  awaitingApproval: number;
  syncIssues: number;
  reconciliationRequired: number;
}

export interface AdminOrderListItem {
  id: string;
  userId: string;
  agentId?: string;
  recipientPhone: string;
  network: string;
  dataAmountMb: number;
  amountPesewas: number;
  paymentStatus: string;
  orderStatus: string;
  providerStatus: string;
  refundStatus?: string;
  createdAt: string;
  updatedAt?: string;
  userEmail?: string;
  userName?: string;
  providerName?: string;
  providerOrderId?: string;
}

export interface AdminOrderDetail {
  order: AdminOrderListItem & {
    currency: string;
    idempotencyKey?: string;
    pricingSnapshot?: any;
  };
  customer?: {
    id: string;
    email: string;
    phone?: string;
    fullName: string;
    role: string;
    status: string;
  } | null;
  agent?: {
    id: string;
    storeName: string;
    storeSlug: string;
    commissionRate: number;
    floatPesewas?: number;
  } | null;
  providerOrder?: {
    id: string;
    providerName: string;
    providerOrderId: string;
    providerReference: string;
    providerStatus: string;
    rawPayload: any;
    lastSyncedAt?: string;
    createdAt: string;
  } | null;
  payment?: {
    id: string;
    amountPesewas: number;
    paymentStatus: string;
    provider: string;
    reference: string;
    createdAt: string;
  } | null;
  refund?: {
    id: string;
    amountPesewas: number;
    reason: string;
    status: string;
    refundReference: string;
    createdAt: string;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    actorType: string;
    actorId: string;
    previousState?: string;
    newState?: string;
    metadata?: any;
    occurredAt: string;
  }>;
  dlq?: {
    id: string;
    attemptCount: number;
    errorCode?: string;
    errorMessage?: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface AdminPendingApprovalStats {
  awaitingApproval: number;
  approvedToday: number;
  rejected: number;
  processing: number;
  syncFailed: number;
  affectedOrders: number;
}

export interface AdminPendingApprovalItem {
  id: string;
  phoneNumber: string;
  network: string;
  status: string;
  providerReference?: string;
  validatedAt?: string;
  expiresAt?: string;
  createdAt: string;
  occurrences: number;
}

export interface AdminPendingApprovalDetail {
  record: AdminPendingApprovalItem;
  affectedOrders: Array<{
    id: string;
    recipientPhone: string;
    network: string;
    dataAmountMb: number;
    amountPesewas: number;
    orderStatus: string;
    createdAt: string;
    userName: string;
    userEmail: string;
  }>;
}

export interface AdminLedgerLine {
  id: string;
  transactionId: string;
  entryType: 'DEBIT' | 'CREDIT';
  accountType: string;
  accountId: string;
  amountPesewas: number;
  currency: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface AdminAuditEvent {
  id: string;
  correlationId: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  metadata?: any;
  createdAt: string;
}

export const adminApi = {
  // Users & Administration
  getUsers: async (params: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    verification?: string;
    mfa?: string;
    period?: string;
    search?: string;
  } = {}) => {
    return apiClient.get<{
      users: AdminUserListItem[];
      stats?: AdminUserStats;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/users', { params });
  },

  createUser: async (data: { email: string; phone: string; fullName: string; password?: string; role?: string }) => {
    return apiClient.post<{ user: AdminUserListItem }>('/admin/users', data);
  },

  getUserDetails: async (id: string) => {
    return apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
  },

  updateUserProfile: async (id: string, data: { fullName?: string; phone?: string; phoneVerified?: boolean; emailVerified?: boolean }) => {
    return apiClient.patch(`/admin/users/${id}`, data);
  },

  suspendUser: async (id: string, data?: { reason?: string; duration?: string; revokeSessions?: boolean } | string) => {
    const payload = typeof data === 'string' ? { reason: data } : data;
    return apiClient.post(`/admin/users/${id}/suspend`, payload);
  },

  reactivateUser: async (id: string) => {
    return apiClient.post(`/admin/users/${id}/reactivate`);
  },

  updateUserRole: async (id: string, role: string, reason?: string) => {
    return apiClient.post(`/admin/users/${id}/role`, { role, reason });
  },

  adjustUserWallet: async (id: string, data: { amountPesewas: number; type: 'CREDIT' | 'DEBIT'; reason: string }) => {
    return apiClient.post<{ userId: string; previousBalancePesewas: number; newBalancePesewas: number }>(`/admin/users/${id}/adjust-wallet`, data);
  },

  reconcileUserWallet: async (id: string) => {
    return apiClient.post<{
      userId: string;
      walletBalancePesewas: number;
      ledgerDerivedBalancePesewas: number;
      discrepancyPesewas: number;
      status: string;
      reconciledAt: string;
    }>(`/admin/users/${id}/reconcile`);
  },

  exportUserDossier: async (id: string, format: 'CSV' | 'JSON' = 'JSON') => {
    return apiClient.post(`/admin/users/${id}/export-dossier`, { format });
  },

  revokeUserSessions: async (id: string) => {
    return apiClient.post(`/admin/users/${id}/revoke-sessions`);
  },

  requestUserPasswordReset: async (id: string) => {
    return apiClient.post(`/admin/users/${id}/password-reset`);
  },

  sendUserDirectNotification: async (id: string, data: { channel: 'EMAIL' | 'SMS' | 'IN_APP'; subject: string; message: string }) => {
    return apiClient.post(`/admin/users/${id}/notifications`, data);
  },

  revokeUserApiKey: async (userId: string, keyId: string) => {
    return apiClient.post(`/admin/users/${userId}/api-keys/${keyId}/revoke`);
  },

  rotateUserApiKey: async (userId: string, keyId: string) => {
    return apiClient.post(`/admin/users/${userId}/api-keys/${keyId}/rotate`);
  },

  exportUsers: async (data: { format?: 'CSV' | 'JSON'; role?: string; status?: string; search?: string } = {}) => {
    return apiClient.post('/admin/users/export', data);
  },

  bulkUsersAction: async (data: { action: 'SUSPEND' | 'ACTIVATE' | 'NOTIFY'; userIds: string[]; reason?: string; message?: string }) => {
    return apiClient.post('/admin/users/bulk', data);
  },

  // Analytics
  getAnalyticsOverview: async (range: string = '30d') => {
    return apiClient.get<AdminAnalyticsOverview>('/admin/analytics/overview', { params: { range } });
  },

  // Orders Control Plane (Phase 11.5)
  getOrderStats: async () => {
    return apiClient.get<AdminOrderStats>('/admin/orders/stats');
  },

  getOrders: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    lifecycle?: string;
    paymentStatus?: string;
    provider?: string;
    network?: string;
    source?: string;
    period?: string;
    operationalState?: string;
    status?: string;
  } = {}) => {
    return apiClient.get<{ orders: AdminOrderListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/orders', { params });
  },

  getOrderDetail: async (id: string) => {
    return apiClient.get<AdminOrderDetail>(`/admin/orders/${id}`);
  },

  reconcileOrder: async (id: string) => {
    return apiClient.post<{ orderId: string; summary: any }>(`/admin/orders/${id}/reconcile`);
  },

  retryOrder: async (id: string) => {
    return apiClient.post(`/admin/orders/${id}/retry`);
  },

  refundOrder: async (id: string, reason: string, amountPesewas?: number) => {
    return apiClient.post(`/admin/orders/${id}/refund`, { reason, amountPesewas });
  },

  exportOrders: async (data: { format?: 'CSV' | 'JSON'; filter?: any } = {}) => {
    return apiClient.post('/admin/orders/export', data);
  },

  // Pending MTN Approvals (Phase 11.5)
  getPendingApprovalStats: async () => {
    return apiClient.get<AdminPendingApprovalStats>('/admin/pending-approvals/stats');
  },

  getPendingApprovals: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    network?: string;
  } = {}) => {
    return apiClient.get<{ items: AdminPendingApprovalItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/pending-approvals', { params });
  },

  getPendingApprovalDetail: async (id: string) => {
    return apiClient.get<AdminPendingApprovalDetail>(`/admin/pending-approvals/${id}`);
  },

  syncPendingApproval: async (id: string) => {
    return apiClient.post(`/admin/pending-approvals/${id}/sync`);
  },

  bulkSyncPendingApprovals: async (ids: string[]) => {
    return apiClient.post<{ syncedCount: number }>('/admin/pending-approvals/bulk-sync', { ids });
  },

  approveBeneficiaryApproval: async (id: string) => {
    return apiClient.post(`/admin/pending-approvals/${id}/approve`);
  },

  rejectBeneficiaryApproval: async (id: string, reason?: string) => {
    return apiClient.post(`/admin/pending-approvals/${id}/reject`, { reason });
  },

  exportPendingApprovals: async () => {
    return apiClient.post('/admin/pending-approvals/export');
  },

  // Ledger & Payments
  getLedger: async (params: { page?: number; limit?: number; entryType?: string; accountType?: string } = {}) => {
    return apiClient.get<{ items: AdminLedgerLine[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/ledger', { params });
  },

  getPayments: async (params: { page?: number; limit?: number; status?: string } = {}) => {
    return apiClient.get<{ items: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/payments', { params });
  },

  // Audit Stream
  getAudit: async (params: { page?: number; limit?: number; action?: string } = {}) => {
    return apiClient.get<{ items: AdminAuditEvent[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/audit', { params });
  },

  // Stores
  getStores: async (params: { page?: number; limit?: number; status?: string } = {}) => {
    return apiClient.get('/admin/stores', { params });
  },

  approveStore: async (storeId: string, notes?: string) => {
    return apiClient.post(`/admin/stores/${storeId}/approve`, { internalNotes: notes });
  },

  rejectStore: async (storeId: string, reason: string) => {
    return apiClient.post(`/admin/stores/${storeId}/reject`, { reason });
  },

  // Providers & Routing
  getProviders: async () => {
    return apiClient.get<{ providers: any[]; routing: Record<string, { primary: string; fallback: string }> }>('/admin/providers');
  },

  updateProviderRouting: async (data: { network: string; primaryProvider: string; fallbackProvider?: string }) => {
    return apiClient.put('/admin/providers/routing', data);
  },

  // Communications & Messaging Center (Phase 11.11)
  getCommunicationOverview: async (): Promise<AdminCommunicationOverviewStats> => {
    return apiClient.get<AdminCommunicationOverviewStats>('/admin/communication/overview');
  },

  sendCommunication: async (data: AdminComposeMessageRequest) => {
    return apiClient.post('/admin/communication/send', data);
  },

  getCommunicationCampaigns: async (params: { status?: string; search?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{ items: AdminCampaignListItemDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/admin/communication/campaigns',
      { params },
    );
  },

  createCommunicationCampaign: async (data: AdminCreateCampaignRequest) => {
    return apiClient.post('/admin/communication/campaigns', data);
  },

  cancelCommunicationCampaign: async (id: string, reason: string) => {
    return apiClient.post(`/admin/communication/campaigns/${id}/cancel`, { reason });
  },

  getNotificationTemplates: async (params: { category?: string; status?: string } = {}) => {
    return apiClient.get<AdminNotificationTemplateDto[]>('/admin/communication/templates', { params });
  },

  createNotificationTemplate: async (data: AdminCreateTemplateRequest) => {
    return apiClient.post('/admin/communication/templates', data);
  },

  updateNotificationTemplate: async (id: string, data: AdminUpdateTemplateRequest) => {
    return apiClient.put(`/admin/communication/templates/${id}`, data);
  },

  getCommunicationDeliveryLogs: async (params: { search?: string; channel?: string; status?: string; priority?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{ items: AdminDeliveryLogItemDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/admin/communication/delivery-logs',
      { params },
    );
  },

  getCommunicationHealth: async () => {
    return apiClient.get<{ status: string; subsystems: Record<string, any> }>('/admin/communication/health');
  },

  getUserNotificationPreferences: async (userId: string): Promise<AdminUserNotificationPreferenceDto> => {
    return apiClient.get<AdminUserNotificationPreferenceDto>(`/admin/communication/user-preferences/${userId}`);
  },

  updateUserNotificationPreferences: async (userId: string, data: AdminUpdateUserPreferenceRequest) => {
    return apiClient.patch(`/admin/communication/user-preferences/${userId}`, data);
  },

  getCommunicationHistory: async () => {
    return apiClient.get<{ items: any[]; total: number }>('/admin/communication/delivery-logs');
  },

  // Health, MTN Approvals & DLQ
  getHealth: async (): Promise<IntegrationHealthReport> => {
    return apiClient.get<IntegrationHealthReport>('/health/integrations');
  },

  getMtnApprovals: async (params: { page?: number; limit?: number; status?: string; network?: string } = {}) => {
    return apiClient.get('/admin/mtn-approvals', { params });
  },

  approveMtnBeneficiary: async (id: string) => {
    return apiClient.post(`/admin/mtn-approvals/${id}/approve`);
  },

  rejectMtnBeneficiary: async (id: string, reason?: string) => {
    return apiClient.post(`/admin/mtn-approvals/${id}/reject`, { reason });
  },

  getDlq: async (params: { page?: number; limit?: number; status?: string } = {}) => {
    return apiClient.get('/admin/dlq', { params });
  },

  retryDlqItem: async (id: string) => {
    return apiClient.post(`/admin/dlq/${id}/retry`);
  },

  dismissDlqItem: async (id: string, reason?: string) => {
    return apiClient.post(`/admin/dlq/${id}/dismiss`, { reason });
  },

  replayAllDlq: async () => {
    return apiClient.post('/admin/dlq/replay-all');
  },

  getReconciliationSummary: async () => {
    return apiClient.get('/admin/reconciliation/summary');
  },

  triggerReconciliation: async () => {
    return apiClient.post('/admin/reconciliation/trigger');
  },

  // Catalog & Data Plans Control Plane (Phase 11.6)
  getCatalogStats: async () => {
    return apiClient.get<AdminCatalogStats>('/admin/catalog/stats');
  },

  getCatalogPlans: async (params: {
    search?: string;
    network?: string;
    provider?: string;
    status?: string;
    providerStatus?: string;
    customerAvailability?: string;
    agentAvailability?: string;
    storeAvailability?: string;
    apiAvailability?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}) => {
    return apiClient.get<{ items: CatalogProductDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/catalog/plans', { params });
  },

  getCatalogPlanDetail: async (id: string) => {
    return apiClient.get<AdminCatalogPlanDetail>(`/admin/catalog/plans/${id}`);
  },

  createCatalogPlan: async (data: CreateCatalogPlanRequest) => {
    return apiClient.post<CatalogProductDto>('/admin/catalog/plans', data);
  },

  updateCatalogPlan: async (id: string, data: UpdateCatalogPlanRequest) => {
    return apiClient.put<CatalogProductDto>(`/admin/catalog/plans/${id}`, data);
  },

  deleteCatalogPlan: async (id: string) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/catalog/plans/${id}`);
  },

  updatePlanStatus: async (id: string, status: CatalogPlanStatus, reason?: string) => {
    return apiClient.patch<CatalogProductDto>(`/admin/catalog/plans/${id}/status`, { status, reason });
  },

  updatePlanVisibility: async (
    id: string,
    visibility: {
      availableForCustomer?: boolean;
      availableForAgent?: boolean;
      availableForStore?: boolean;
      availableForApi?: boolean;
    },
  ) => {
    return apiClient.patch<CatalogProductDto>(`/admin/catalog/plans/${id}/visibility`, visibility);
  },

  executeBulkCatalogAction: async (data: BulkCatalogActionRequest) => {
    return apiClient.post<{ affectedCount: number }>('/admin/catalog/plans/bulk', data);
  },

  previewBulkPricing: async (data: BulkPricingPreviewRequest) => {
    return apiClient.post<BulkPricingPreviewResponse>('/admin/catalog/plans/bulk-pricing/preview', data);
  },

  applyBulkPricing: async (data: BulkPricingApplyRequest) => {
    return apiClient.post<{ updatedCount: number }>('/admin/catalog/plans/bulk-pricing/apply', data);
  },

  triggerProviderCatalogSync: async (data: { autoApply?: boolean; network?: string } = {}) => {
    return apiClient.post<{
      batchId: string;
      totalProviderPlans: number;
      matchedPlans: number;
      newPlansCount: number;
      changedPlansCount: number;
      removedPlansCount: number;
      discrepancyCount: number;
      status: string;
      items: any[];
    }>('/admin/catalog/sync', data);
  },

  getSyncBatches: async () => {
    return apiClient.get<ProviderCatalogSyncBatchDto[]>('/admin/catalog/sync/batches');
  },

  getSyncBatchDetail: async (id: string) => {
    return apiClient.get<ProviderCatalogSyncBatchDto>(`/admin/catalog/sync/batches/${id}`);
  },

  applySyncBatch: async (id: string, data: { itemIds?: string[] } = {}) => {
    return apiClient.post<{ appliedCount: number }>(`/admin/catalog/sync/batches/${id}/apply`, data);
  },

  rejectSyncBatch: async (id: string, reason?: string) => {
    return apiClient.post(`/admin/catalog/sync/batches/${id}/reject`, { reason });
  },

  getPlanOrders: async (id: string, params: { page?: number; limit?: number } = {}) => {
    return apiClient.get<{ items: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/catalog/plans/${id}/orders`, { params });
  },

  getPlanPriceHistory: async (id: string) => {
    return apiClient.get<any[]>(`/admin/catalog/plans/${id}/price-history`);
  },

  exportCatalog: async (data: { format: 'csv' | 'json'; network?: string; status?: string }) => {
    return apiClient.post('/admin/catalog/export', data);
  },

  // --- Phase 11.7: Agent Administration ---

  getAgentStats: async (): Promise<AdminAgentStats> => {
    const res = await apiClient.get<AdminAgentStats>('/admin/agents/stats');
    return res;
  },

  getAgentsList: async (params: {
    search?: string;
    status?: string;
    store?: string;
    api?: string;
    financial?: string;
    dateRange?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    return apiClient.get<{
      items: AdminAgentListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/agents', { params });
  },

  getAgentDetail: async (id: string): Promise<AdminAgentDetail> => {
    return apiClient.get<AdminAgentDetail>(`/admin/agents/${id}`);
  },

  createAgent: async (data: CreateAgentAdminRequest) => {
    return apiClient.post<{ id: string; userId: string; fullName: string; email: string }>('/admin/agents', data);
  },

  updateAgent: async (id: string, data: UpdateAgentAdminRequest) => {
    return apiClient.put(`/admin/agents/${id}`, data);
  },

  updateAgentStatus: async (id: string, data: UpdateAgentStatusRequest) => {
    return apiClient.patch<{ id: string; status: string; reason: string }>(`/admin/agents/${id}/status`, data);
  },

  adjustAgentWallet: async (id: string, data: { amountPesewas: number; direction: 'CREDIT' | 'DEBIT'; reason: string; idempotencyKey?: string }) => {
    return apiClient.post(`/admin/agents/${id}/wallet/adjust`, data);
  },

  getAgentCustomPricing: async (id: string): Promise<AgentCustomPricingItemDto[]> => {
    return apiClient.get<AgentCustomPricingItemDto[]>(`/admin/agents/${id}/pricing`);
  },

  updateAgentCustomPricing: async (id: string, data: UpdateAgentPricingRequest) => {
    return apiClient.put(`/admin/agents/${id}/pricing`, data);
  },

  getAgentApiKeys: async (id: string) => {
    return apiClient.get<any[]>(`/admin/agents/${id}/api-keys`);
  },

  revokeAgentApiKey: async (id: string, keyId: string, reason?: string) => {
    return apiClient.post(`/admin/agents/${id}/api-keys/${keyId}/revoke`, { reason });
  },

  exportAgents: async (data: { format?: 'csv' | 'json'; status?: string } = {}) => {
    return apiClient.post('/admin/agents/export', data);
  },

  // --- Phase 11.7: Store Administration ---

  getStoreStats: async (): Promise<AdminStoreStats> => {
    return apiClient.get<AdminStoreStats>('/admin/stores/stats');
  },

  getStoresList: async (params: {
    search?: string;
    status?: string;
    approval?: string;
    payment?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    return apiClient.get<{
      items: AdminStoreListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/stores', { params });
  },

  getStoreDetail: async (id: string): Promise<AdminStoreDetail> => {
    return apiClient.get<AdminStoreDetail>(`/admin/stores/${id}`);
  },

  updateStoreStatus: async (id: string, storeStatus: string, reason?: string) => {
    return apiClient.patch(`/admin/stores/${id}/status`, { storeStatus, reason });
  },

  approveStoreApplication: async (id: string, adminNotes?: string) => {
    return apiClient.post(`/admin/stores/${id}/approve`, { adminNotes });
  },

  rejectStoreApplication: async (id: string, reason: string) => {
    return apiClient.post(`/admin/stores/${id}/reject`, { reason });
  },

  verifyStorePayment: async (id: string, notes?: string, autoApprove: boolean = true) => {
    return apiClient.post(`/admin/stores/${id}/verify-payment`, { notes, autoApprove });
  },

  getStoreActivationFee: async (): Promise<{ activationFeePesewas: number; activationFeeGhs: number; configKey: string }> => {
    const res = await apiClient.get<any>('/admin/stores/settings/activation-fee');
    return res.data || res;
  },

  updateStoreActivationFee: async (data: { activationFeeGhs?: number; activationFeePesewas?: number; reason?: string }) => {
    const res = await apiClient.put<any>('/admin/stores/settings/activation-fee', data);
    return res.data || res;
  },


  getStoreProductsList: async (id: string): Promise<StoreProductAdminDto[]> => {
    return apiClient.get<StoreProductAdminDto[]>(`/admin/stores/${id}/products`);
  },

  updateStoreProductsList: async (id: string, data: UpdateStoreProductsRequest) => {
    return apiClient.put(`/admin/stores/${id}/products`, data);
  },

  processStorePayoutAction: async (storeId: string, payoutId: string, data: StorePayoutActionRequest) => {
    return apiClient.post(`/admin/stores/${storeId}/payouts/${payoutId}/action`, data);
  },

  exportStores: async (data: { format?: 'csv' | 'json'; status?: string } = {}) => {
    return apiClient.post('/admin/stores/export', data);
  },

  // --- Phase 11.8: Finance, Transactions & Reconciliation ---

  getFinanceOverview: async (): Promise<AdminFinanceStats> => {
    return apiClient.get<AdminFinanceStats>('/admin/finance/overview');
  },

  getFinanceTransactions: async (params: AdminTransactionFilterQuery = {}) => {
    return apiClient.get<{
      items: AdminTransactionListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/finance/transactions', { params });
  },

  getFinanceTransactionDetail: async (id: string): Promise<AdminTransactionDetailDto> => {
    return apiClient.get<AdminTransactionDetailDto>(`/admin/finance/transactions/${id}`);
  },

  getFinanceLedger: async (params: { page?: number; limit?: number; entryType?: string; accountType?: string; transactionId?: string } = {}) => {
    return apiClient.get<{
      items: any[];
      isBalanced: boolean;
      status: string;
      totalDebitsPesewas: number;
      totalCreditsPesewas: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/finance/ledger', { params });
  },

  getFinanceLedgerAnomalies: async () => {
    return apiClient.get<{
      anomaliesCount: number;
      status: string;
      anomalies: AdminLedgerAnomalyDto[];
    }>('/admin/finance/ledger/anomalies');
  },

  getFinanceRefunds: async (params: { status?: string; riskLevel?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: AdminRefundListItemDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/finance/refunds', { params });
  },

  processRefundAction: async (id: string, data: AdminRefundActionRequest) => {
    return apiClient.post(`/admin/finance/refunds/${id}/action`, data);
  },

  getFinanceWithdrawals: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/finance/withdrawals', { params });
  },

  getFinanceAdjustments: async (): Promise<FinancialAdjustmentDto[]> => {
    return apiClient.get<FinancialAdjustmentDto[]>('/admin/finance/adjustments');
  },

  requestFinancialAdjustment: async (data: CreateFinancialAdjustmentRequest) => {
    return apiClient.post('/admin/finance/adjustments/request', data);
  },

  reviewFinancialAdjustment: async (id: string, data: ReviewFinancialAdjustmentRequest) => {
    return apiClient.post(`/admin/finance/adjustments/${id}/action`, data);
  },

  getFinancialSafetySettings: async (): Promise<FinancialSafetySettingsDto> => {
    return apiClient.get<FinancialSafetySettingsDto>('/admin/finance/safety-controls');
  },

  updateFinancialSafetySettings: async (data: UpdateFinancialSafetySettingsRequest) => {
    return apiClient.put('/admin/finance/safety-controls', data);
  },

  getReprocessPreview: async (): Promise<ReprocessPreviewDto> => {
    return apiClient.post<ReprocessPreviewDto>('/admin/finance/reprocess/preview');
  },

  executeReprocessBatch: async (data: ReprocessExecuteRequest) => {
    return apiClient.post('/admin/finance/reprocess/execute', data);
  },

  exportFinancialReport: async (data: { reportType: string; format?: string; startDate?: string; endDate?: string }) => {
    return apiClient.post('/admin/finance/reports/export', data, { responseType: 'blob' });
  },

  getReconciliationDashboard: async (): Promise<ReconciliationDashboardDto> => {
    return apiClient.get<ReconciliationDashboardDto>('/admin/reconciliation/dashboard');
  },

  getReconciliationCases: async (params: { status?: string; severity?: string; source?: string; search?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: ReconciliationCaseDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/reconciliation/cases', { params });
  },

  getReconciliationCaseDetail: async (id: string): Promise<ReconciliationCaseDto> => {
    return apiClient.get<ReconciliationCaseDto>(`/admin/reconciliation/cases/${id}`);
  },

  updateReconciliationCaseStatus: async (id: string, data: UpdateReconciliationCaseRequest) => {
    return apiClient.patch(`/admin/reconciliation/cases/${id}/status`, data);
  },

  triggerPaystackReconciliation: async () => {
    return apiClient.post('/admin/reconciliation/trigger/paystack');
  },

  triggerDatahouseReconciliation: async () => {
    return apiClient.post('/admin/reconciliation/trigger/datahouse');
  },

  triggerLedgerReconciliation: async () => {
    return apiClient.post('/admin/reconciliation/trigger/ledger');
  },

  exportReconciliationCases: async (data: { status?: string; format?: string } = {}) => {
    return apiClient.post('/admin/reconciliation/export', data, { responseType: 'blob' });
  },

  // ==========================================
  // Phase 11.10: API Management, Developer Platform & Security
  // ==========================================

  getApiOverview: async (): Promise<AdminApiOverviewStats> => {
    return apiClient.get<AdminApiOverviewStats>('/admin/api/overview');
  },

  getApiKeys: async (params: {
    search?: string;
    environment?: string;
    status?: string;
    ownerId?: string;
    ownerRole?: string;
    scope?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    return apiClient.get<{
      items: AdminApiKeyListItemDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/api/keys', { params });
  },

  getApiKeyDetail: async (id: string): Promise<AdminApiKeyDetailDto> => {
    return apiClient.get<AdminApiKeyDetailDto>(`/admin/api/keys/${id}`);
  },

  createAdminApiKey: async (data: AdminCreateApiKeyRequest) => {
    return apiClient.post<{
      id: string;
      name: string;
      keyPrefix: string;
      rawApiKey: string;
      environment: string;
      scopes: string[];
      createdAt: string;
      expiresAt: string | null;
    }>('/admin/api/keys', data);
  },

  rotateAdminApiKey: async (id: string, data: AdminRotateApiKeyRequest) => {
    return apiClient.post<{
      newKeyId: string;
      name: string;
      keyPrefix: string;
      rawApiKey: string;
      environment: string;
      scopes: string[];
      oldKeyExpiresAt: string;
    }>(`/admin/api/keys/${id}/rotate`, data);
  },

  updateAdminApiKey: async (id: string, data: AdminUpdateApiKeyRequest) => {
    return apiClient.patch(`/admin/api/keys/${id}`, data);
  },

  revokeAdminApiKey: async (id: string, reason: string) => {
    return apiClient.post(`/admin/api/keys/${id}/revoke`, { reason });
  },

  getApiUsage: async (params: { timeRange?: string; environment?: string; agentId?: string } = {}): Promise<AdminApiUsageAnalyticsDto> => {
    return apiClient.get<AdminApiUsageAnalyticsDto>('/admin/api/usage', { params });
  },

  getApiSecurityEvents: async (params: { eventType?: string; severity?: string; search?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: AdminApiSecurityEventDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/api/security', { params });
  },

  getAdminWebhooks: async (params: { status?: string; agentId?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: AdminWebhookListItemDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/api/webhooks', { params });
  },

  createAdminWebhook: async (data: AdminCreateWebhookRequest) => {
    return apiClient.post('/admin/api/webhooks', data);
  },

  testAdminWebhook: async (id: string) => {
    return apiClient.post(`/admin/api/webhooks/${id}/test`);
  },

  getAdminProviders: async (): Promise<AdminProviderConnectionDto[]> => {
    return apiClient.get<AdminProviderConnectionDto[]>('/admin/api/providers');
  },

  switchApiAuthoritativeProvider: async (data: AdminSwitchAuthoritativeProviderRequest) => {
    return apiClient.post('/admin/api/providers/switch', data);
  },


  getApiPolicies: async (): Promise<AdminApiPolicyConfigDto> => {
    return apiClient.get<AdminApiPolicyConfigDto>('/admin/api/policies');
  },

  updateApiPolicies: async (data: AdminUpdateApiPolicyRequest) => {
    return apiClient.put('/admin/api/policies', data);
  },

  getApiConsumers: async (params: { search?: string; environment?: string; status?: string; page?: number; limit?: number } = {}) => {
    return apiClient.get<{
      items: AdminApiConsumerDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/api/consumers', { params });
  },

  createApiConsumer: async (data: AdminCreateApiConsumerRequest) => {
    return apiClient.post('/admin/api/consumers', data);
  },

  updateApiConsumer: async (id: string, data: AdminUpdateApiConsumerRequest) => {
    return apiClient.patch(`/admin/api/consumers/${id}`, data);
  },

  getStructuredApiHealth: async (): Promise<AdminStructuredHealthDto> => {
    return apiClient.get<AdminStructuredHealthDto>('/admin/api/health');
  },

  getAgentApiDossier: async (agentId: string): Promise<AdminAgentApiDossierDto> => {
    return apiClient.get<AdminAgentApiDossierDto>(`/admin/api/agents/${agentId}/dossier`);
  },

  // =========================================================================
  // Phase 11.12: Audit & Security Operations Control Plane
  // =========================================================================

  getAuditOverview: async (): Promise<AdminAuditOverviewStatsDto> => {
    return apiClient.get<AdminAuditOverviewStatsDto>('/admin/audit/overview');
  },

  getAuditEvents: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    severity?: string;
    result?: string;
    actorRole?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    return apiClient.get<{
      items: AdminAuditListItemDto[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/audit/events', { params });
  },

  getAuditEventDetail: async (id: string): Promise<AdminAuditDetailDto> => {
    return apiClient.get<AdminAuditDetailDto>(`/admin/audit/events/${id}`);
  },

  verifyAuditIntegrity: async (): Promise<AdminAuditIntegrityVerificationDto> => {
    return apiClient.get<AdminAuditIntegrityVerificationDto>('/admin/audit/integrity');
  },

  exportAuditLogs: async (data: AdminAuditExportRequest) => {
    return apiClient.post('/admin/audit/export', data);
  },

  getSecurityIncidents: async (params: { status?: string; severity?: string } = {}): Promise<AdminSecurityIncidentDto[]> => {
    return apiClient.get<AdminSecurityIncidentDto[]>('/admin/audit/incidents', { params });
  },

  createSecurityIncident: async (data: AdminCreateSecurityIncidentRequest) => {
    return apiClient.post('/admin/audit/incidents', data);
  },

  updateSecurityIncident: async (id: string, data: AdminUpdateSecurityIncidentRequest) => {
    return apiClient.patch(`/admin/audit/incidents/${id}`, data);
  },

  getEmergencyControls: async (): Promise<Array<{
    key: string;
    name: string;
    desc: string;
    status: boolean;
    lastToggledBy?: string | null;
    lastToggledAt?: string | null;
    lastJustification?: string | null;
  }>> => {
    const res = await apiClient.get('/admin/audit/emergency/controls');
    return Array.isArray(res) ? res : res?.data || [];
  },

  toggleEmergencyControl: async (data: AdminEmergencyControlToggleRequest) => {
    return apiClient.post('/admin/audit/emergency/toggle', data);
  },

  // System Settings, Configuration & Global Governance (Phase 11.13)
  getGlobalConfigOverview: async (): Promise<AdminGlobalConfigOverviewDto> => {
    return apiClient.get<AdminGlobalConfigOverviewDto>('/admin/settings/overview');
  },

  getSystemConfigs: async (params: {
    scope?: ConfigScope;
    category?: ConfigCategory;
    riskLevel?: ConfigRiskLevel;
    search?: string;
  } = {}): Promise<AdminSystemConfigItemDto[]> => {
    return apiClient.get<AdminSystemConfigItemDto[]>('/admin/settings/configs', { params });
  },

  updateSystemConfig: async (key: string, data: AdminUpdateSystemConfigRequest) => {
    return apiClient.put(`/admin/settings/configs/${key}`, data);
  },

  getConfigVersions: async (key: string): Promise<AdminConfigVersionItemDto[]> => {
    return apiClient.get<AdminConfigVersionItemDto[]>(`/admin/settings/configs/${key}/versions`);
  },

  rollbackSystemConfig: async (key: string, data: AdminRollbackConfigRequest) => {
    return apiClient.post(`/admin/settings/configs/${key}/rollback`, data);
  },

  getFeatureFlags: async (): Promise<AdminFeatureFlagItemDto[]> => {
    return apiClient.get<AdminFeatureFlagItemDto[]>('/admin/settings/feature-flags');
  },

  updateFeatureFlag: async (flagKey: string, data: AdminUpdateFeatureFlagRequest) => {
    return apiClient.put(`/admin/settings/feature-flags/${flagKey}`, data);
  },

  getActiveSessions: async (): Promise<AdminActiveSessionDto[]> => {
    return apiClient.get<AdminActiveSessionDto[]>('/admin/settings/sessions');
  },

  revokeActiveSession: async (sessionId: string, data: AdminRevokeSessionRequest) => {
    return apiClient.post(`/admin/settings/sessions/${sessionId}/revoke`, data);
  },

  getSystemHealthDiagnostics: async (): Promise<AdminSystemHealthDiagnosticDto> => {
    return apiClient.get<AdminSystemHealthDiagnosticDto>('/admin/settings/health');
  },

  // Permission Enforcement & Role Governance (Phase 11.14)
  getPermissionRegistry: async (): Promise<AdminRolePermissionMatrixDto> => {
    return apiClient.get<AdminRolePermissionMatrixDto>('/admin/permissions/registry');
  },

  getUserEffectivePermissions: async (userId: string): Promise<AdminUserEffectiveAuthorizationDto> => {
    return apiClient.get<AdminUserEffectiveAuthorizationDto>(`/admin/permissions/users/${userId}/effective`);
  },

  // Notifications, Alerts & System Communications Administration (Phase 11.15)
  getNotificationOverview: async (): Promise<AdminNotificationOverviewDto> => {
    return apiClient.get<AdminNotificationOverviewDto>('/admin/notifications/overview');
  },

  getNotificationRules: async (): Promise<AdminNotificationRuleDto[]> => {
    return apiClient.get<AdminNotificationRuleDto[]>('/admin/notifications/rules');
  },

  createNotificationRule: async (data: AdminCreateNotificationRuleRequest) => {
    return apiClient.post('/admin/notifications/rules', data);
  },

  updateNotificationRule: async (id: string, data: AdminUpdateNotificationRuleRequest) => {
    return apiClient.put(`/admin/notifications/rules/${id}`, data);
  },

  getNotificationAnalytics: async (): Promise<AdminNotificationAnalyticsDto> => {
    return apiClient.get<AdminNotificationAnalyticsDto>('/admin/notifications/analytics');
  },

  getNotificationDeliveryDetail: async (id: string): Promise<AdminNotificationDeliveryDetailDto> => {
    return apiClient.get<AdminNotificationDeliveryDetailDto>(`/admin/notifications/deliveries/${id}`);
  },

  sendEmergencyBroadcast: async (data: AdminEmergencyBroadcastRequest) => {
    return apiClient.post('/admin/notifications/emergency-broadcast', data);
  },

  getNotificationHistory: async (params: {
    recipient?: string;
    role?: string;
    type?: string;
    channel?: string;
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    event?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: AdminNotificationHistoryItemDto[]; meta: any }> => {
    return apiClient.get<{ items: AdminNotificationHistoryItemDto[]; meta: any }>('/admin/notifications/history', { params });
  },

  getAlerts: async (params: {
    severity?: string;
    source?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: AdminSystemAlertDto[]; meta: any }> => {
    return apiClient.get<{ items: AdminSystemAlertDto[]; meta: any }>('/admin/alerts', { params });
  },

  getAlertDetail: async (id: string): Promise<{ alert: AdminSystemAlertDto; timeline: AdminAlertEventDto[] }> => {
    return apiClient.get<{ alert: AdminSystemAlertDto; timeline: AdminAlertEventDto[] }>(`/admin/alerts/${id}`);
  },

  acknowledgeAlert: async (id: string, data: AdminAcknowledgeAlertRequest = {}) => {
    return apiClient.post(`/admin/alerts/${id}/acknowledge`, data);
  },

  assignAlert: async (id: string, data: AdminAssignAlertRequest) => {
    return apiClient.post(`/admin/alerts/${id}/assign`, data);
  },

  investigateAlert: async (id: string, data: { note?: string } = {}) => {
    return apiClient.post(`/admin/alerts/${id}/investigate`, data);
  },

  resolveAlert: async (id: string, data: AdminResolveAlertRequest) => {
    return apiClient.post(`/admin/alerts/${id}/resolve`, data);
  },

  addAlertNote: async (id: string, note: string) => {
    return apiClient.post(`/admin/alerts/${id}/note`, { note });
  },

  getUserNotifications: async (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}): Promise<{ items: UserNotificationItemDto[]; meta: any }> => {
    return apiClient.get<{ items: UserNotificationItemDto[]; meta: any }>('/notifications', { params });
  },

  getUserNotificationCounts: async (): Promise<UserNotificationCountsDto> => {
    return apiClient.get<UserNotificationCountsDto>('/notifications/counts');
  },

  markNotificationRead: async (id: string) => {
    return apiClient.post(`/notifications/${id}/read`);
  },

  markAllNotificationsRead: async () => {
    return apiClient.post('/notifications/read-all');
  },

  // =========================================================================
  // Phase 11.9: Telecom Provider & Networks Control Plane APIs
  // =========================================================================

  getTelecomOverview: async (): Promise<TelecomControlPlaneOverviewDto> => {
    return apiClient.get<TelecomControlPlaneOverviewDto>('/admin/telecom/overview');
  },

  getTelecomNetworks: async (): Promise<TelecomNetworkDto[]> => {
    return apiClient.get<TelecomNetworkDto[]>('/admin/telecom/networks');
  },

  updateTelecomNetwork: async (code: string, data: UpdateTelecomNetworkRequest): Promise<TelecomNetworkDto> => {
    return apiClient.patch<TelecomNetworkDto>(`/admin/telecom/networks/${code}`, data);
  },

  toggleTelecomNetwork: async (code: string): Promise<{ code: string; isActive: boolean; status: string }> => {
    return apiClient.post<{ code: string; isActive: boolean; status: string }>(`/admin/telecom/networks/${code}/toggle`);
  },

  getTelecomProviders: async (): Promise<TelecomProviderDetailDto[]> => {
    return apiClient.get<TelecomProviderDetailDto[]>('/admin/telecom/providers');
  },

  getTelecomProviderDetail: async (id: string): Promise<TelecomProviderDetailDto> => {
    return apiClient.get<TelecomProviderDetailDto>(`/admin/telecom/providers/${id}`);
  },

  createTelecomProvider: async (data: CreateTelecomProviderRequest): Promise<TelecomProviderDetailDto> => {
    return apiClient.post<TelecomProviderDetailDto>('/admin/telecom/providers', data);
  },

  updateTelecomProvider: async (id: string, data: UpdateTelecomProviderRequest): Promise<TelecomProviderDetailDto> => {
    return apiClient.patch<TelecomProviderDetailDto>(`/admin/telecom/providers/${id}`, data);
  },

  updateTelecomProviderStatus: async (id: string, status: string, reason?: string): Promise<{ id: string; status: string }> => {
    return apiClient.post<{ id: string; status: string }>(`/admin/telecom/providers/${id}/status`, { status, reason });
  },

  getProviderCredentials: async (providerId: string): Promise<ProviderCredentialDto[]> => {
    return apiClient.get<ProviderCredentialDto[]>(`/admin/telecom/providers/${providerId}/credentials`);
  },

  createProviderCredential: async (providerId: string, data: CreateProviderCredentialRequest): Promise<ProviderCredentialDto> => {
    return apiClient.post<ProviderCredentialDto>(`/admin/telecom/providers/${providerId}/credentials`, data);
  },

  rotateProviderCredential: async (providerId: string, data: RotateProviderCredentialRequest): Promise<ProviderCredentialDto> => {
    return apiClient.post<ProviderCredentialDto>(`/admin/telecom/providers/${providerId}/credentials/rotate`, data);
  },

  revokeProviderCredential: async (providerId: string, credId: string, reason: string): Promise<{ id: string; status: string }> => {
    return apiClient.post<{ id: string; status: string }>(`/admin/telecom/providers/${providerId}/credentials/${credId}/revoke`, { reason });
  },

  testProviderConnection: async (providerId: string, environment: string = 'SANDBOX'): Promise<ProviderConnectionTestResult> => {
    return apiClient.post<ProviderConnectionTestResult>(`/admin/telecom/providers/${providerId}/test-connection`, { environment });
  },

  testProviderCapabilities: async (providerId: string): Promise<Record<string, boolean>> => {
    return apiClient.post<Record<string, boolean>>(`/admin/telecom/providers/${providerId}/test-capabilities`);
  },

  testProviderSandboxTransaction: async (providerId: string, input: SandboxTransactionTestInput): Promise<SandboxTransactionTestResult> => {
    return apiClient.post<SandboxTransactionTestResult>(`/admin/telecom/providers/${providerId}/test-sandbox`, input);
  },

  getTelecomRoutingMatrix: async (): Promise<NetworkProviderMappingDto[]> => {
    return apiClient.get<NetworkProviderMappingDto[]>('/admin/telecom/routing');
  },

  updateTelecomRouting: async (data: UpdateNetworkRoutingRequest): Promise<NetworkProviderMappingDto> => {
    return apiClient.post<NetworkProviderMappingDto>('/admin/telecom/routing', data);
  },

  validateAuthoritativeSwitch: async (targetProvider: string): Promise<AuthoritativeSwitchValidationResult> => {
    return apiClient.get<AuthoritativeSwitchValidationResult>('/admin/telecom/authoritative-switch/validate', { params: { targetProvider } });
  },

  switchAuthoritativeProvider: async (data: SwitchAuthoritativeProviderRequest): Promise<{ previousProvider: string; currentAuthoritativeProvider: string; switchedAt: string }> => {
    return apiClient.post<{ previousProvider: string; currentAuthoritativeProvider: string; switchedAt: string }>('/admin/telecom/authoritative-switch', data);
  },

  getProviderIncidents: async (params: { status?: string; severity?: string } = {}): Promise<ProviderIncidentDto[]> => {
    return apiClient.get<ProviderIncidentDto[]>('/admin/telecom/incidents', { params });
  },

  createProviderIncident: async (data: CreateProviderIncidentRequest): Promise<ProviderIncidentDto> => {
    return apiClient.post<ProviderIncidentDto>('/admin/telecom/incidents', data);
  },

  updateProviderIncident: async (id: string, data: UpdateProviderIncidentRequest): Promise<ProviderIncidentDto> => {
    return apiClient.patch<ProviderIncidentDto>(`/admin/telecom/incidents/${id}`, data);
  },

  getProviderHealthMetrics: async (providerId: string): Promise<ProviderHealthMetricDto> => {
    return apiClient.get<ProviderHealthMetricDto>(`/admin/telecom/providers/${providerId}/health`);
  },
};

export type {
  AdminGlobalConfigOverviewDto,
  AdminSystemConfigItemDto,
  AdminUpdateSystemConfigRequest,
  AdminConfigVersionItemDto,
  AdminRollbackConfigRequest,
  AdminFeatureFlagItemDto,
  AdminUpdateFeatureFlagRequest,
  AdminActiveSessionDto,
  AdminRevokeSessionRequest,
  AdminSystemHealthDiagnosticDto,
  AdminSubsystemHealthItemDto,
  PermissionMatrixEntryDto,
  AdminRolePermissionMatrixDto,
  AdminUserEffectiveAuthorizationDto,
};


