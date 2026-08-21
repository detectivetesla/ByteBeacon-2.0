import { apiClient } from './httpClient.js';
import { IntegrationHealthReport } from '@bytebeacon/shared';

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
    active: number;
  };
  orders: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    refunded: number;
    completionRate: number;
  };
  revenue: {
    lifetimePesewas: number;
    todayPesewas: number;
    monthPesewas: number;
  };
  networks: Array<{
    network: string;
    orderCount: number;
    volumePesewas: number;
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
  systemStatus: Record<string, string>;
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

  // Communications
  sendCommunication: async (data: { target: string; recipientEmail?: string; channel: string; subject: string; message: string }) => {
    return apiClient.post('/admin/communication/send', data);
  },

  getCommunicationHistory: async () => {
    return apiClient.get<{ items: any[]; total: number }>('/admin/communication/history');
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
};
