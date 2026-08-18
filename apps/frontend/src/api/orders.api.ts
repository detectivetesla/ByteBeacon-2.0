import { apiClient } from './httpClient.js';
import { OrderDetailsDto, OrderSummaryDto, CreateOrderRequest, NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';

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
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ordersApi = {
  createOrder: async (input: CreateOrderRequest, idempotencyKey?: string): Promise<OrderDetailsDto> => {
    return apiClient.post<OrderDetailsDto>('/orders', input, { idempotencyKey });
  },

  getOrder: async (orderId: string): Promise<OrderDetailsDto> => {
    return apiClient.get<OrderDetailsDto>(`/orders/${orderId}`);
  },

  trackOrder: async (query: string): Promise<OrderDetailsDto> => {
    return apiClient.get<OrderDetailsDto>(`/orders/track/${encodeURIComponent(query)}`, { skipAuth: true });
  },

  listOrders: async (filters: OrderListFilters = {}): Promise<PaginatedOrdersResponse> => {
    return apiClient.get<PaginatedOrdersResponse>('/orders', {
      params: filters as Record<string, string | number | boolean | undefined>,
    });
  },

  listAgentOrders: async (filters: OrderListFilters = {}): Promise<PaginatedOrdersResponse> => {
    return apiClient.get<PaginatedOrdersResponse>('/agents/orders', {
      params: filters as Record<string, string | number | boolean | undefined>,
    });
  },
};
