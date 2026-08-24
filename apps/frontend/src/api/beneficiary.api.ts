import { apiClient } from './httpClient.js';
import { NetworkProvider } from '@bytebeacon/shared';

export interface BeneficiaryValidationResult {
  phoneNumber: string;
  network: NetworkProvider;
  isValid: boolean;
  isKnown: boolean;
  accountName?: string;
}

export interface BeneficiaryItemDto {
  id: string;
  phoneNumber: string;
  network: NetworkProvider;
  accountName?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface BeneficiaryPrecheckItemDto {
  phone: string;
  normalized: string;
  valid: boolean;
  known: boolean;
  accountName?: string;
}

export interface AgentBeneficiaryPrecheckResultDto {
  network: NetworkProvider | string;
  enforced: boolean;
  sandbox: boolean;
  recorded: boolean;
  reason?: string;
  summary: {
    requested: number;
    unique: number;
    valid: number;
    invalid: number;
    known: number;
    unknown: number;
  };
  unknown: string[];
  results: BeneficiaryPrecheckItemDto[];
}

export const beneficiaryApi = {
  /**
   * Public precheck endpoint (up to 10 numbers, no auth needed).
   */
  precheckPublic: async (params: {
    network: NetworkProvider;
    phoneNumbers: string[];
  }): Promise<{
    network: NetworkProvider | string;
    results: BeneficiaryPrecheckItemDto[];
  }> => {
    return apiClient.post('/orders/beneficiaries/precheck', params);
  },

  /**
   * Authenticated agent bulk precheck (up to 1000 numbers with opt-in recording).
   */
  precheckAgent: async (params: {
    network: NetworkProvider;
    phoneNumbers: string[];
    record?: boolean;
  }): Promise<AgentBeneficiaryPrecheckResultDto> => {
    return apiClient.post('/agent/beneficiaries/precheck', params);
  },

  precheck: async (params: {
    phoneNumbers: string[];
    network: NetworkProvider;
    record?: boolean;
  }): Promise<{
    network: NetworkProvider;
    enforced: boolean;
    results: BeneficiaryValidationResult[];
  }> => {
    return apiClient.post('/beneficiaries/precheck', params);
  },

  listBeneficiaries: async (network?: NetworkProvider): Promise<BeneficiaryItemDto[]> => {
    return apiClient.get<BeneficiaryItemDto[]>('/beneficiaries', {
      params: { network },
    });
  },

  listApprovals: async (params?: { network?: string; status?: string; page?: number; limit?: number }): Promise<{ items: any[]; total?: number }> => {
    return apiClient.get('/beneficiaries/approvals', { params });
  },

  approveBeneficiary: async (id: string): Promise<any> => {
    return apiClient.post(`/beneficiaries/approvals/${id}/approve`);
  },

  rejectBeneficiary: async (id: string): Promise<any> => {
    return apiClient.post(`/beneficiaries/approvals/${id}/reject`);
  },

  validatePhoneNumber: async (params: { phoneNumber: string; network: NetworkProvider }): Promise<any> => {
    return apiClient.post('/beneficiaries/validate', params);
  },

  getBeneficiaryStatus: async (phone: string, network?: NetworkProvider): Promise<any> => {
    return apiClient.get(`/beneficiaries/${encodeURIComponent(phone)}`, {
      params: { network },
    });
  },

  syncBeneficiary: async (phoneNumber: string, network: NetworkProvider): Promise<any> => {
    return apiClient.post('/beneficiaries/precheck', {
      phoneNumbers: [phoneNumber],
      network,
      record: true,
    });
  },
};

