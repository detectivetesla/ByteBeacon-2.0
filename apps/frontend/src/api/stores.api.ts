import { apiClient } from './httpClient.js';
import { NetworkProvider, CustomerOrderDto } from '@bytebeacon/shared';

export interface StoreProfileDto {
  id: string;
  agentId?: string;
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

export type StoreDto = StoreProfileDto;

export interface PublicStoreProductDto {

  id: string;
  catalogProductId: string;
  sku: string;
  name: string;
  network: NetworkProvider;
  dataAmountMb: number;
  validityDays: number;
  validityDesc?: string;
  basePricePesewas: number;
  markupPesewas: number;
  retailPricePesewas: number;
  popular?: boolean;
}

export interface PublicStoreData {
  store: StoreProfileDto;
  products: PublicStoreProductDto[];
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

export interface PublicCheckoutRequest {
  slug: string;
  productId: string;
  recipientPhone: string;
  customerEmail?: string;
  customerName?: string;
  paymentMethod?: string;
  channel?: 'mobile_money' | 'card';
  idempotencyKey?: string;
  callbackUrl?: string;
}

export interface PublicCheckoutResponse {
  order: {
    orderId: string;
    id: string;
    recipientPhone: string;
    network: NetworkProvider;
    dataAmountMb: number;
    dataLabel: string;
    amountPesewas: number;
    amountGhs: number;
    currency: string;
    paymentStatus: string;
    orderStatus: string;
    statusLabel: string;
    storeName: string;
    storeSlug: string;
  };
  payment: {
    reference: string;
    authorizationUrl?: string;
    accessCode?: string;
    amountPesewas: number;
    amountGhs: number;
    currency: string;
  };
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

  getPublicStore: async (slug: string): Promise<PublicStoreData> => {
    return apiClient.get<PublicStoreData>(`/stores/public/${encodeURIComponent(slug)}`, { skipAuth: true });
  },

  publicCheckout: async (payload: PublicCheckoutRequest): Promise<PublicCheckoutResponse> => {
    return apiClient.post<PublicCheckoutResponse>('/stores/public/orders/checkout', payload, {
      skipAuth: true,
      idempotencyKey: payload.idempotencyKey,
    });
  },

  verifyPublicPayment: async (reference: string, orderId?: string): Promise<CustomerOrderDto> => {
    return apiClient.post<CustomerOrderDto>('/stores/public/orders/verify', { reference, orderId }, {
      skipAuth: true,
    });
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
