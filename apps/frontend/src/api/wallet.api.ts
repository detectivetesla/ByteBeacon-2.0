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
};
