import { apiClient } from './httpClient.js';

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  environment: 'LIVE' | 'SANDBOX';
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  environment: 'LIVE' | 'SANDBOX';
  scopes: string[];
  createdAt: string;
  expiresAt?: string | null;
}

export const apiKeysApi = {
  listKeys: async (): Promise<ApiKeyItem[]> => {
    const res = await apiClient.get<{ items: ApiKeyItem[] } | ApiKeyItem[]>('/developer/api-keys');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).items)) return (res as any).items;
    return [];
  },

  createKey: async (payload: {
    name: string;
    environment: 'LIVE' | 'SANDBOX';
    scopes: string[];
    expiresInDays?: number;
  }): Promise<ApiKeyCreatedResponse> => {
    return apiClient.post<ApiKeyCreatedResponse>('/developer/api-keys', payload);
  },

  revokeKey: async (keyId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/developer/api-keys/${keyId}`);
  },

  rollKey: async (keyId: string): Promise<ApiKeyCreatedResponse> => {
    return apiClient.post<ApiKeyCreatedResponse>(`/developer/api-keys/${keyId}/roll`);
  },
};
