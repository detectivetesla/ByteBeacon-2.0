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
};
