import { apiClient } from './httpClient.js';
import { AgentApiUsageResponse } from '@bytebeacon/shared';

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
    try {
      const res = await apiClient.get<any>('/developer/api-keys');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.items)) return res.items;
      if (res && Array.isArray(res.data)) return res.data;
      if (res && res.data && Array.isArray(res.data.items)) return res.data.items;
      return [];
    } catch (primaryErr: any) {
      // Fallback to /agent/api-keys endpoint
      try {
        const fallbackRes = await apiClient.get<any>('/agent/api-keys');
        if (Array.isArray(fallbackRes)) return fallbackRes;
        if (fallbackRes && Array.isArray(fallbackRes.items)) return fallbackRes.items;
        if (fallbackRes && Array.isArray(fallbackRes.data)) return fallbackRes.data;
        if (fallbackRes && fallbackRes.data && Array.isArray(fallbackRes.data.items)) return fallbackRes.data.items;
        return [];
      } catch {
        throw primaryErr;
      }
    }
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

  getApiUsage: async (params?: {
    mode?: 'all' | 'live' | 'sandbox';
    keyId?: string;
    page?: number;
    limit?: number;
  }): Promise<AgentApiUsageResponse> => {
    const query = new URLSearchParams();
    if (params?.mode) query.set('mode', params.mode);
    if (params?.keyId) query.set('keyId', params.keyId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<AgentApiUsageResponse | { data: AgentApiUsageResponse }>(`/agent/api-usage${qs}`);
    if (res && 'data' in res && (res as any).data?.overview) {
      return (res as any).data;
    }
    return res as AgentApiUsageResponse;
  },
};

