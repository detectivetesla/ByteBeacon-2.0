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
  visitCount?: number;
  dailyVisits?: number;
  lastVisitDate?: string;
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

// ─── Agent Commerce DTO Types ────────────────────────────────────

export interface StoreDashboardDto {
  store: {
    id: string;
    storeName: string;
    slug: string;
    primaryColor: string;
    accentColor: string;
  };
  kpis: {
    todaySalesGhs: number;
    totalSalesGhs: number;
    filteredSalesGhs?: number;
    todayProfitGhs?: number;
    totalProfitGhs?: number;
    availableProfitGhs?: number;
    totalProfitEarnedGhs?: number;
    totalWithdrawnGhs?: number;
    settledWithdrawnGhs?: number;
    pendingPayoutGhs?: number;
    filteredProfitGhs?: number;
    ordersCount: number;
    ordersTodayCount?: number;
    totalOrdersCount?: number;
    filteredOrdersCount?: number;
    customersCount: number;
    customersTodayCount?: number;
    filteredCustomersCount?: number;
    storeVisits: number;
    dailyVisits?: number;
    totalStoreVisits?: number;
    completedOrders?: number;
    processingOrders?: number;
    pendingOrders?: number;
    failedOrders?: number;
  };
  orderHealth: {
    completed: number;
    processing: number;
    pending: number;
    failed: number;
    total?: number;
    successRate?: number;
  };
  revenueTrend?: Array<{ date: string; revenueGhs: number; orderCount?: number }>;
}

export interface StoreOrderRecordDto {
  id: string;
  publicId: string;
  recipientPhone: string;
  network: string;
  dataAmountMb: number;
  dataLabel?: string;
  amountPesewas: number;
  amountGhs?: number;
  profitPesewas?: number;
  profitGhs?: number;
  basePricePesewas?: number;
  basePriceGhs?: number;
  productName?: string;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

export interface StoreOrdersResponseDto {
  orders: StoreOrderRecordDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StoreCustomerRecordDto {
  phone: string;
  totalOrders: number;
  totalSpentGhs: number;
  lastPurchase: string;
  firstPurchase: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StoreCustomersResponseDto {
  customers: StoreCustomerRecordDto[];
  items?: StoreCustomerRecordDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalItems?: number;
    totalPages: number;
  };
}

export interface StoreAnalyticsDto {
  monthlyRevenueGhs: number;
  monthlyRevenuePesewas?: number;
  completedOrders: number;
  totalOrders: number;
  successRate: number;
  averageOrderValueGhs: number;
  averageOrderValuePesewas?: number;
  networkBreakdown: Array<{
    network: string;
    revenueGhs: number;
    revenuePesewas?: number;
    orderCount: number;
    percentage: number;
  }>;
  networks?: Array<{
    network: string;
    revenueGhs?: number;
    revenuePesewas?: number;
    orderCount: number;
    percentage?: number;
  }>;
  revenueTrend: Array<{ date: string; revenueGhs: number; orderCount?: number }>;
  dailyTrend?: Array<{ date: string; revenueGhs?: number; revenuePesewas?: number }>;
}

export interface StoreFinanceLedgerEntryDto {
  id: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountPesewas: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface StoreFinanceDto {
  grossSalesGhs: number;
  grossSalesPesewas?: number;
  costGhs: number;
  costPesewas?: number;
  profitGhs: number;
  profitPesewas?: number;
  availableProfitGhs?: number;
  availableProfitPesewas?: number;
  totalProfitEarnedGhs?: number;
  totalProfitEarnedPesewas?: number;
  totalWithdrawnGhs?: number;
  totalWithdrawnPesewas?: number;
  settledWithdrawnGhs?: number;
  pendingWithdrawnGhs?: number;
  totalFulfilledOrders: number;
  transactions: StoreFinanceLedgerEntryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StoreTransactionRecordDto {
  id: string;
  reference: string;
  type: 'SALE' | 'WITHDRAWAL' | string;
  typeLabel: string;
  details: string;
  recipient: string;
  grossAmountPesewas: number;
  grossAmountGhs: number;
  profitPesewas: number;
  profitGhs: number;
  status: string;
  channel: string;
  createdAt: string;
}

export interface StoreTransactionsResponseDto {
  transactions: StoreTransactionRecordDto[];
  summary: {
    totalCount: number;
    totalGrossGhs: number;
    totalProfitGhs: number;
    availableProfitGhs?: number;
    totalProfitEarnedGhs?: number;
    totalWithdrawnGhs?: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StoreSettingsDto {
  autoFulfill: boolean;
  smsAlerts: boolean;
  emailAlerts: boolean;
}

export const storesApi = {
  getActivationFee: async (): Promise<{ activationFeePesewas: number; activationFeeGhs: number }> => {
    try {
      const res = await apiClient.get<any>('/stores/activation-fee');
      const data = res?.data !== undefined ? res.data : res;
      if (data && data.activationFeePesewas !== undefined) {
        return {
          activationFeePesewas: data.activationFeePesewas,
          activationFeeGhs: data.activationFeeGhs ?? Number((data.activationFeePesewas / 100).toFixed(2)),
        };
      }
      return { activationFeePesewas: 9000, activationFeeGhs: 90.00 };
    } catch {
      return { activationFeePesewas: 9000, activationFeeGhs: 90.00 };
    }
  },

  getStore: async (identifier?: string): Promise<StoreProfileDto | null> => {
    try {
      const res = await apiClient.get<any>(`/stores/${identifier || 'my-store'}`);
      const data = res?.data !== undefined && (res?.store === undefined && res?.hasStore === undefined) ? res.data : res;

      // 1. If wrapped or unwrapped response has store object
      if (data && data.store) {
        const fee = data.activationFeePesewas ?? data.store.activationFeePesewas;
        return {
          ...data.store,
          activationFeePesewas: fee,
          activationFeeGhs: data.activationFeeGhs ?? (fee ? Number((fee / 100).toFixed(2)) : undefined),
        };
      }

      // 2. If res has direct store properties (already unwrapped StoreProfileDto)
      if (data && data.storeName && data.id) {
        return data as StoreProfileDto;
      }

      // 3. If user has no store yet (hasStore === false or !store), but activation fee is returned
      if (data && (data.activationFeePesewas !== undefined || data.activationFeeGhs !== undefined)) {
        const feePesewas = data.activationFeePesewas ?? Math.round((data.activationFeeGhs || 90) * 100);
        return {
          id: '',
          userId: '',
          storeName: '',
          slug: '',
          primaryColor: '#F97316',
          accentColor: '#3B82F6',
          paymentStatus: data.paymentStatus || 'NOT_STARTED',
          approvalStatus: data.approvalStatus || 'NOT_SUBMITTED',
          storeStatus: data.storeStatus || 'NOT_STARTED',
          activationFeePesewas: feePesewas,
          activationFeeGhs: data.activationFeeGhs ?? Number((feePesewas / 100).toFixed(2)),
          createdAt: '',
          updatedAt: '',
        } as StoreProfileDto;
      }

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
    return apiClient.get<PublicStoreData>(`/stores/public/${encodeURIComponent(slug)}`);
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

  cancelPublicOrder: async (orderIdOrRef: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      '/stores/public/orders/cancel',
      { orderId: orderIdOrRef, reference: orderIdOrRef },
      { skipAuth: true },
    );
  },

  saveStoreConfig: async (payload: Partial<StoreProfileDto>): Promise<StoreProfileDto> => {
    try {
      return await apiClient.put<StoreProfileDto>('/stores/my-store', payload);
    } catch (err: any) {
      // If store is not yet created, fallback to /stores/setup
      if (err?.status === 404 || err?.statusCode === 404) {
        return apiClient.post<StoreProfileDto>('/stores/setup', payload);
      }
      throw err;
    }
  },

  updateStoreProfile: async (payload: Partial<StoreProfileDto>): Promise<StoreProfileDto> => {
    return apiClient.put<StoreProfileDto>('/stores/my-store', payload);
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

  getStoreProducts: async (_storeId?: string): Promise<StoreProductDto[]> => {
    return apiClient.get<StoreProductDto[]>('/stores/my-store/products');
  },

  updateStoreProduct: async (
    productId: string,
    payload: { markupPesewas?: number; isAvailable?: boolean; isVisible?: boolean },
  ): Promise<StoreProductDto> => {
    return apiClient.put<StoreProductDto>(`/stores/my-store/products/${productId}`, payload);
  },

  bulkUpdateStoreProducts: async (
    items: Array<{ id: string; markupPesewas?: number; isAvailable?: boolean; isVisible?: boolean }>,
  ): Promise<{ success: boolean; count: number }> => {
    return apiClient.put<{ success: boolean; count: number }>('/stores/my-store/products/bulk', { items });
  },

  /** @deprecated Use updateStoreProduct instead */
  updateProductMarkup: async (
    _storeId: string,
    productId: string,
    markupPesewas: number,
  ): Promise<StoreProductDto> => {
    return apiClient.put<StoreProductDto>(`/stores/my-store/products/${productId}`, {
      markupPesewas,
    });
  },

  // ─── Agent Commerce: Dashboard ───────────────────────────────────

  getStoreDashboard: async (params?: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    network?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StoreDashboardDto> => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.paymentStatus && params.paymentStatus !== 'ALL') query.set('paymentStatus', params.paymentStatus);
    if (params?.network && params.network !== 'ALL') query.set('network', params.network);
    if (params?.dateRange && params.dateRange !== 'ALL') query.set('dateRange', params.dateRange);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return apiClient.get<StoreDashboardDto>(`/stores/my-store/dashboard${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Orders ──────────────────────────────────────

  getStoreOrders: async (params?: {
    status?: string;
    paymentStatus?: string;
    network?: string;
    search?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<StoreOrdersResponseDto> => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.paymentStatus && params.paymentStatus !== 'ALL') query.set('paymentStatus', params.paymentStatus);
    if (params?.network && params.network !== 'ALL') query.set('network', params.network);
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.dateRange && params.dateRange !== 'ALL') query.set('dateRange', params.dateRange);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient.get<StoreOrdersResponseDto>(`/stores/my-store/orders${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Customers ───────────────────────────────────

  getStoreCustomers: async (params?: {
    search?: string;
    status?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<StoreCustomersResponseDto> => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.dateRange && params.dateRange !== 'ALL') query.set('dateRange', params.dateRange);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient.get<StoreCustomersResponseDto>(`/stores/my-store/customers${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Analytics ───────────────────────────────────

  getStoreAnalytics: async (params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StoreAnalyticsDto> => {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return apiClient.get<StoreAnalyticsDto>(`/stores/my-store/analytics${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Finance ─────────────────────────────────────

  getStoreFinance: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<StoreFinanceDto> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient.get<StoreFinanceDto>(`/stores/my-store/finance${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Transactions Ledger ─────────────────────────

  getStoreTransactions: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
  }): Promise<StoreTransactionsResponseDto> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.type && params.type !== 'ALL') query.set('type', params.type);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.dateRange && params.dateRange !== 'ALL') query.set('dateRange', params.dateRange);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return apiClient.get<StoreTransactionsResponseDto>(`/stores/my-store/transactions${qs ? `?${qs}` : ''}`);
  },

  // ─── Agent Commerce: Settings ────────────────────────────────────

  getStoreSettings: async (): Promise<StoreSettingsDto> => {
    return apiClient.get<StoreSettingsDto>('/stores/my-store/settings');
  },

  saveStoreSettings: async (settings: Partial<StoreSettingsDto>): Promise<StoreSettingsDto> => {
    return apiClient.put<StoreSettingsDto>('/stores/my-store/settings', settings);
  },

  // ─── Public Storefront: Beneficiary Precheck ──────────────────────

  precheckStoreBeneficiary: async (params: {
    slug: string;
    phoneNumber: string;
    network?: NetworkProvider | string;
    record?: boolean;
  }): Promise<{
    network: string;
    valid: boolean;
    known: boolean;
    orderable: boolean;
    status: string;
    message: string;
    accountName?: string;
    recorded?: boolean;
  }> => {
    return apiClient.post(`/stores/public/${encodeURIComponent(params.slug)}/precheck`, {
      phoneNumber: params.phoneNumber,
      network: params.network || 'MTN',
      record: params.record !== false,
    });
  },
};

