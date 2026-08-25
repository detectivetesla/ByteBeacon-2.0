import { apiClient } from './httpClient.js';

export interface StoreProfileDto {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor: string;
  accentColor: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  paymentStatus: 'NOT_STARTED' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'PAYMENT_FAILED';
  approvalStatus: 'NOT_SUBMITTED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  storeStatus: 'NOT_STARTED' | 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';
  activationFeePesewas: number;
  paystackReference?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductDto {
  id: string;
  storeId: string;
  catalogProductId: string;
  name: string;
  network: string;
  dataAmountMb: number;
  basePricePesewas: number;
  markupPesewas: number;
  finalPricePesewas: number;
  finalPriceGhs: number;
  isAvailable: boolean;
  isVisible: boolean;
}

export const storesApi = {
  getStore: async (identifier?: string): Promise<StoreProfileDto | null> => {
    try {
      const res = await apiClient.get<any>(`/stores/${identifier || 'my-store'}`);
      if (res && res.store) return res.store;
      if (res && res.data && res.data.store) return res.data.store;
      if (res && res.storeName) return res;
      return null;
    } catch {
      return null;
    }
  },

  setupStore: async (payload: {
    storeName: string;
    slug: string;
    tagline?: string;
    description?: string;
    contactPhone?: string;
    contactEmail?: string;
    contactWhatsapp?: string;
  }): Promise<StoreProfileDto> => {
    return apiClient.post<StoreProfileDto>('/stores/setup', payload);
  },

  getPublicStore: async (slug: string): Promise<StoreProfileDto> => {
    return apiClient.get<StoreProfileDto>(`/stores/public/${encodeURIComponent(slug)}`, { skipAuth: true });
  },

  saveStoreConfig: async (payload: Partial<StoreProfileDto>): Promise<StoreProfileDto> => {
    return apiClient.post<StoreProfileDto>('/stores/setup', payload);
  },

  initializeActivation: async (payload: {
    storeName: string;
    slug: string;
    contactPhone?: string;
    contactEmail?: string;
  }): Promise<{ authorizationUrl?: string; reference: string; amountGhs?: number }> => {
    return apiClient.post<{ authorizationUrl?: string; reference: string; amountGhs?: number }>('/stores/payment/initialize', payload);
  },

  verifyActivation: async (reference: string): Promise<{ success: boolean; store: StoreProfileDto }> => {
    return apiClient.post<{ success: boolean; store: StoreProfileDto }>('/stores/payment/verify', { reference });
  },

  getStoreProducts: async (storeId: string): Promise<StoreProductDto[]> => {
    return apiClient.get<StoreProductDto[]>(`/stores/${storeId}/products`);
  },

  updateProductMarkup: async (
    storeId: string,
    productId: string,
    markupPesewas: number,
  ): Promise<StoreProductDto> => {
    return apiClient.patch<StoreProductDto>(`/stores/${storeId}/products/${productId}`, {
      markupPesewas,
    });
  },
};
