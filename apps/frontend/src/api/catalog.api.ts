import { apiClient } from './httpClient.js';
import { CatalogProductDto, NetworkProvider } from '@bytebeacon/shared';

export const catalogApi = {
  getBundles: async (
    network?: NetworkProvider,
    channel: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API' = 'CUSTOMER',
  ): Promise<CatalogProductDto[]> => {
    return apiClient.get<CatalogProductDto[]>('/catalog/bundles', {
      params: {
        network: network && network !== ('ALL' as any) ? network : undefined,
        channel,
      },
    });
  },

  getProduct: async (id: string): Promise<CatalogProductDto> => {
    return apiClient.get<CatalogProductDto>(`/catalog/bundles/${id}`);
  },
};
