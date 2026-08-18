import { apiClient } from './httpClient.js';
import { UserSummaryDto } from '@bytebeacon/shared';
import { AuthTokens } from './types.js';

export interface LoginResponse {
  user: UserSummaryDto;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  email: string;
  password?: string;
  phoneNumber?: string;
  fullName?: string;
  role?: string;
}

export const authApi = {
  login: async (credentials: { email: string; password?: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', credentials, { skipAuth: true });
  },

  register: async (payload: RegisterPayload): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/register', payload, { skipAuth: true });
  },

  registerAgent: async (payload: RegisterPayload & { businessName?: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/register-agent', payload, { skipAuth: true });
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network failure on logout
    }
  },

  getProfile: async (): Promise<UserSummaryDto> => {
    return apiClient.get<UserSummaryDto>('/auth/me');
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email }, { skipAuth: true });
  },

  resetPassword: async (payload: { token: string; newPassword: string }): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/reset-password', payload, { skipAuth: true });
  },

  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/change-password', payload);
  },
};
