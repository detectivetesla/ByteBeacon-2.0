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
  phone?: string;
  fullName?: string;
  role?: string;
  storeName?: string;
}

export const authApi = {
  login: async (credentials: { identifier?: string; email?: string; password?: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', credentials, { skipAuth: true });
  },

  loginWithGoogle: async (payload: { idToken?: string; accessToken?: string; userInfo?: any }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/google', payload, { skipAuth: true });
  },

  register: async (payload: RegisterPayload): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/register', payload, { skipAuth: true });
  },

  registerAgent: async (payload: RegisterPayload & { businessName?: string; storeName?: string }): Promise<LoginResponse> => {
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

  getAdminProfile: async (): Promise<UserSummaryDto> => {
    return apiClient.get<UserSummaryDto>('/admin/auth/me');
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email }, { skipAuth: true });
  },

  resetPassword: async (payload: { token: string; newPassword: string }): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/reset-password', payload, { skipAuth: true });
  },

  adminLogin: async (credentials: { email?: string; password?: string }): Promise<LoginResponse | { mfaRequired: true; mfaSessionToken: string }> => {
    return apiClient.post<LoginResponse | { mfaRequired: true; mfaSessionToken: string }>('/admin/auth/login', credentials, { skipAuth: true });
  },

  adminMfaVerify: async (payload: { mfaSessionToken: string; totpCode: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/admin/auth/mfa/verify', payload, { skipAuth: true });
  },

  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/change-password', payload);
  },
};
