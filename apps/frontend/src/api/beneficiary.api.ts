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

export const beneficiaryApi = {
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

