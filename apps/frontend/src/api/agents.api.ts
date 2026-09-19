import { apiClient } from './httpClient.js';
import {
  AgentApplicationDto,
  SubmitAgentApplicationRequest,
  AgentApplicationFeeConfigDto,
} from '@bytebeacon/shared';

export interface MyAgentApplicationResponse {
  application: AgentApplicationDto | null;
  isAgent: boolean;
  currentFeePesewas: number;
  currentFeeGhs: number;
}

export const agentsApi = {
  /**
   * Get current dynamic agent application fee
   */
  getApplicationFee: async (): Promise<AgentApplicationFeeConfigDto> => {
    return apiClient.get<AgentApplicationFeeConfigDto>('/agents/application-fee');
  },

  /**
   * Get authenticated customer's agent application status
   */
  getMyApplication: async (): Promise<MyAgentApplicationResponse> => {
    return apiClient.get<MyAgentApplicationResponse>('/agents/my-application');
  },

  /**
   * Submit agent application and initiate payment
   */
  apply: async (data: SubmitAgentApplicationRequest): Promise<AgentApplicationDto & { authorizationUrl?: string }> => {
    return apiClient.post<AgentApplicationDto & { authorizationUrl?: string }>('/agents/apply', data);
  },

  /**
   * Verify agent application payment reference
   */
  verifyPayment: async (reference: string): Promise<AgentApplicationDto> => {
    return apiClient.post<AgentApplicationDto>('/agents/apply/verify-payment', { reference });
  },
};
