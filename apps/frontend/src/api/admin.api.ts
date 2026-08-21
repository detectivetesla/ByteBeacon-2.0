import { apiClient } from './httpClient.js';
import { IntegrationHealthReport } from '@bytebeacon/shared';

export interface AdminUserListItem {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  role: string;
  status: string;
  securityDomain?: string;
  walletBalancePesewas: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminUserDetail {
  user: AdminUserListItem & {
    phoneVerified: boolean;
    mfaEnabled: boolean;
    updatedAt: string;
  };
  recentOrders: Array<{
    id: string;
    recipientPhone: string;
    network: string;
    dataAmountMb: number;
    amountPesewas: number;
    orderStatus: string;
    createdAt: string;
  }>;
  recentLedgerLines: Array<{
    id: string;
    entryType: string;
    amountPesewas: number;
    referenceType: string;
    referenceId: string;
    description: string;
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

export interface AdminOrderListItem {
  id: string;
  userId: string;
  recipientPhone: string;
  network: string;
  dataAmountMb: number;
  amountPesewas: number;
  paymentStatus: string;
  orderStatus: string;
  providerStatus: string;
  createdAt: string;
  userEmail?: string;
  userName?: string;
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
  // Users
  getUsers: async (params: { page?: number; limit?: number; role?: string; status?: string; search?: string } = {}) => {
    return apiClient.get<{ users: AdminUserListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/users', { params });
  },

  getUserDetails: async (id: string) => {
    return apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
  },

  suspendUser: async (id: string, reason?: string) => {
    return apiClient.post(`/admin/users/${id}/suspend`, { reason });
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

  revokeUserSessions: async (id: string) => {
    return apiClient.post(`/admin/users/${id}/revoke-sessions`);
  },

  // Analytics
  getAnalyticsOverview: async (range: string = '30d') => {
    return apiClient.get<AdminAnalyticsOverview>('/admin/analytics/overview', { params: { range } });
  },

  // Orders
  getOrders: async (params: { page?: number; limit?: number; status?: string; network?: string; search?: string } = {}) => {
    return apiClient.get<{ orders: AdminOrderListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/admin/orders', { params });
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
