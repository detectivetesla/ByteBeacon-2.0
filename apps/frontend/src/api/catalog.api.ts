import { apiClient } from './httpClient.js';
import { CatalogProductDto, NetworkProvider } from '@bytebeacon/shared';

export const catalogApi = {
  getBundles: async (network?: NetworkProvider): Promise<CatalogProductDto[]> => {
    return apiClient.get<CatalogProductDto[]>('/catalog/bundles', {
      params: { network },
    });
  },

  getProduct: async (id: string): Promise<CatalogProductDto> => {
    return apiClient.get<CatalogProductDto>(`/catalog/bundles/${id}`);
  },
};
