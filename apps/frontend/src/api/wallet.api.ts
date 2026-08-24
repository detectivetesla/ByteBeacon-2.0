import { apiClient } from './httpClient.js';

export interface WalletBalanceDto {
  balancePesewas: number;
  balanceGhs: number;
  availablePesewas: number;
  availableGhs: number;
  currency: string;
}

export interface WalletTransactionDto {
  id: string;
  referenceId: string;
  type: 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'COMMISSION' | 'ADJUSTMENT' | 'WITHDRAWAL';
  amountPesewas: number;
  amountGhs: number;
  balanceAfterPesewas: number;
  balanceAfterGhs: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransactionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const walletApi = {
  getBalance: async (): Promise<WalletBalanceDto> => {
    return apiClient.get<WalletBalanceDto>('/agents/wallet/balance');
  },

  getTransactions: async (params: {
    type?: string;
    page?: number;
    limit?: number;
    search?: string;
    dateRange?: string;
  } = {}): Promise<WalletTransactionsResponse> => {
    return apiClient.get<WalletTransactionsResponse>('/agents/wallet/transactions', {
      params,
    });
  },

  initializeTopup: async (amountGhs: number): Promise<{ authorizationUrl: string; reference: string }> => {
    return apiClient.post<{ authorizationUrl: string; reference: string }>('/agents/wallet/topup/initialize', {
      amountPesewas: Math.round(amountGhs * 100),
    });
  },

  verifyTopup: async (reference: string): Promise<{ success: boolean; newBalancePesewas: number }> => {
    return apiClient.post<{ success: boolean; newBalancePesewas: number }>('/agents/wallet/topup/verify', {
      reference,
    });
  },

  requestWithdrawal: async (payload: {
    amountPesewas: number;
    payoutMethod: string;
    accountNumber: string;
    accountName: string;
    bankName?: string;
  }): Promise<any> => {
    return apiClient.post('/agents/withdrawals', payload);
  },

  getWithdrawals: async (): Promise<{ withdrawals: any[] }> => {
    return apiClient.get<{ withdrawals: any[] }>('/agents/withdrawals');
  },

  getSubAgents: async (): Promise<{ subAgents: any[] }> => {
    return apiClient.get<{ subAgents: any[] }>('/agents/sub-agents');
  },

  createSubAgent: async (payload: {
    name: string;
    email: string;
    phone: string;
    storeName?: string;
  }): Promise<any> => {
    return apiClient.post('/agents/sub-agents', payload);
  },
};

export interface RevenuePeriodStats {
  label: string;
  revenueDisplay: string;
  orderCount: number;
  trendDisplay: string;
  points: Array<{ label: string; revenue: number; orders: number }>;
}

export interface SalesMarginAnalytics {
  totals: {
    grossSalesGhs: number;
    refundsGhs: number;
    netSalesGhs: number;
    totalCostGhs: number;
    grossProfitGhs: number;
    marginPercent: number;
    totalOrders: number;
    avgOrderValueGhs: number;
  };
  networkBreakdown: Array<{
    network: string;
    name: string;
    color: string;
    orders: number;
    sales: number;
    cost: number;
    profit: number;
    margin: number;
    share: number;
  }>;
  bundleBreakdown: Array<{
    id: string;
    name: string;
    network: string;
    orders: number;
    salesPesewas: number;
    costPesewas: number;
    profitPesewas: number;
    marginPercent: number;
  }>;
}

export const analyticsApi = {
  getRevenueTrend: async (): Promise<Record<string, RevenuePeriodStats>> => {
    return apiClient.get<Record<string, RevenuePeriodStats>>('/agents/analytics/revenue');
  },

  getSalesMargins: async (params: {
    period?: string;
    network?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<SalesMarginAnalytics> => {
    return apiClient.get<SalesMarginAnalytics>('/agents/analytics/sales-margins', { params });
  },
};

export const settingsApi = {
  updateSettings: async (payload: {
    businessName?: string;
    businessPhone?: string;
    businessEmail?: string;
    whatsAppNumber?: string;
    fullName?: string;
    personalEmail?: string;
    personalPhone?: string;
  }): Promise<any> => {
    return apiClient.put('/agents/settings', payload);
  },

  updateProfile: async (payload: {
    fullName?: string;
    phone?: string;
    email?: string;
  }): Promise<any> => {
    return apiClient.patch('/agents/profile', payload);
  },
};

export interface NotificationItemDto {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionUrl?: string;
  isRead: boolean;
  channel: string;
  createdAt: string;
}

export const notificationsApi = {
  listNotifications: async (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}): Promise<{
    items: NotificationItemDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> => {
    return apiClient.get('/notifications', { params });
  },

  getCounts: async (): Promise<{ total: number; unread: number }> => {
    return apiClient.get('/notifications/counts');
  },

  markAsRead: async (id: string): Promise<{ id: string; isRead: boolean }> => {
    return apiClient.post(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<{ markedCount: number }> => {
    return apiClient.post('/notifications/read-all');
  },
};

