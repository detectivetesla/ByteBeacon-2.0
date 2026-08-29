import { apiClient } from './httpClient.js';
import {
  OrderDetailsDto,
  OrderSummaryDto,
  CreateOrderRequest,
  CreateBulkSubmissionRequest,
  BulkSubmissionDetailsDto,
  NetworkProvider,
  OrderStatus,
  PaymentStatus,
} from '@bytebeacon/shared';

export interface OrderListFilters {
  page?: number;
  limit?: number;
  network?: NetworkProvider;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedOrdersResponse {
  orders: OrderSummaryDto[];
  items?: OrderSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const ordersApi = {
  createOrder: async (input: CreateOrderRequest, idempotencyKey?: string): Promise<OrderDetailsDto> => {
    return apiClient.post<OrderDetailsDto>('/orders', input, { idempotencyKey });
  },

  createBulkSubmission: async (
    input: CreateBulkSubmissionRequest,
    idempotencyKey?: string,
  ): Promise<BulkSubmissionDetailsDto> => {
    return apiClient.post<BulkSubmissionDetailsDto>('/bulk-orders', input, { idempotencyKey });
  },

  getBulkSubmission: async (submissionId: string): Promise<BulkSubmissionDetailsDto> => {
    return apiClient.get<BulkSubmissionDetailsDto>(`/bulk-orders/${submissionId}`);
  },

  getOrder: async (orderId: string): Promise<OrderDetailsDto> => {
    return apiClient.get<OrderDetailsDto>(`/orders/${orderId}`);
  },

  trackOrder: async (query: string): Promise<any> => {
    return apiClient.get<any>(`/orders/track/${encodeURIComponent(query)}`, { skipAuth: true });
  },

  verifyPayment: async (reference: string, orderId?: string): Promise<any> => {
    return apiClient.post<any>('/payments/verify', { reference, orderId });
  },

  listOrders: async (filters: OrderListFilters = {}): Promise<PaginatedOrdersResponse> => {
    const raw = await apiClient.get<any>('/orders', {
      params: filters as Record<string, string | number | boolean | undefined>,
    });

    const ordersList: OrderSummaryDto[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.orders)
      ? raw.orders
      : Array.isArray(raw)
      ? raw
      : [];

    const page = raw?.meta?.page ?? raw?.page ?? (typeof filters.page === 'number' ? filters.page : 1);
    const limit = raw?.meta?.limit ?? raw?.limit ?? (typeof filters.limit === 'number' ? filters.limit : 20);
    const total = raw?.meta?.total ?? raw?.total ?? ordersList.length;
    const totalPages = raw?.meta?.totalPages ?? raw?.totalPages ?? (Math.ceil(total / limit) || 1);

    return {
      orders: ordersList,
      items: ordersList,
      total,
      page,
      limit,
      totalPages,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  listAgentOrders: async (filters: OrderListFilters = {}): Promise<PaginatedOrdersResponse> => {
    const raw = await apiClient.get<any>('/agents/orders', {
      params: filters as Record<string, string | number | boolean | undefined>,
    });

    const ordersList: OrderSummaryDto[] = Array.isArray(raw?.orders)
      ? raw.orders
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
      ? raw
      : [];

    const page = raw?.page ?? raw?.meta?.page ?? (typeof filters.page === 'number' ? filters.page : 1);
    const limit = raw?.limit ?? raw?.meta?.limit ?? (typeof filters.limit === 'number' ? filters.limit : 20);
    const total = raw?.total ?? raw?.meta?.total ?? ordersList.length;
    const totalPages = raw?.totalPages ?? raw?.meta?.totalPages ?? (Math.ceil(total / limit) || 1);

    return {
      orders: ordersList,
      items: ordersList,
      total,
      page,
      limit,
      totalPages,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },
};
