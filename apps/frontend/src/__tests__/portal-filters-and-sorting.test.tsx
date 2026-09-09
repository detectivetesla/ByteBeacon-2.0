import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { OrdersPage } from '../pages/customer/OrdersPage.js';
import { AgentOrdersPage } from '../pages/agent/AgentOrdersPage.js';
import { ordersApi } from '../api/orders.api.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    listOrders: vi.fn(),
    listAgentOrders: vi.fn(),
  },
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: { id: 'agent-123', email: 'agent@bytebeacon.com', role: 'agent' },
  }),
}));

const mockOrders = [
  {
    id: 'ord-1',
    publicId: 'ORD-PROC-1',
    network: 'MTN',
    recipientPhone: '0244111222',
    dataAmountMb: 1024,
    amountPesewas: 1000,
    paymentMethod: 'Wallet',
    orderStatus: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PAID,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (Today)
  },
  {
    id: 'ord-2',
    publicId: 'ORD-COMP-2',
    network: 'MTN',
    recipientPhone: '0544333444',
    dataAmountMb: 5120,
    amountPesewas: 5000,
    paymentMethod: 'Wallet',
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  },
  {
    id: 'ord-3',
    publicId: 'ORD-FAIL-3',
    network: 'MTN',
    recipientPhone: '0555666777',
    dataAmountMb: 2048,
    amountPesewas: 2000,
    paymentMethod: 'Wallet',
    orderStatus: OrderStatus.FAILED,
    paymentStatus: PaymentStatus.FAILED,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
  },
  {
    id: 'ord-4',
    publicId: 'ORD-SUBM-4',
    network: 'TELECEL',
    recipientPhone: '0200111222',
    dataAmountMb: 3072,
    amountPesewas: 3000,
    paymentMethod: 'Wallet',
    orderStatus: OrderStatus.SUBMITTED,
    paymentStatus: PaymentStatus.PENDING,
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days ago (outside 30d)
  },
];

describe('Customer & Agent Portal Filter & Sorting Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Customer OrdersPage Filters & Sorting', () => {
    it('renders all status tabs: All, Processing, Delivered, Failed, Submitted, Cancelled', async () => {
      vi.mocked(ordersApi.listOrders).mockResolvedValueOnce({
        orders: mockOrders as any,
        total: mockOrders.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <OrdersPage />
          </ToastProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(ordersApi.listOrders).toHaveBeenCalled();
      });

      expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Processing$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Delivered$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Failed$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Submitted$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Cancelled$/i })).toBeInTheDocument();
    });

    it('filters orders by Delivered (COMPLETED) when clicking Delivered tab', async () => {
      vi.mocked(ordersApi.listOrders).mockResolvedValue({
        orders: mockOrders as any,
        total: mockOrders.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <OrdersPage />
          </ToastProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getAllByText('ORD-PROC-1').length).toBeGreaterThan(0);
      });

      // Click "Delivered" tab
      const deliveredBtn = screen.getByRole('button', { name: /^Delivered$/i });
      fireEvent.click(deliveredBtn);

      await waitFor(() => {
        expect(screen.getAllByText('ORD-COMP-2').length).toBeGreaterThan(0);
        expect(screen.queryByText('ORD-PROC-1')).not.toBeInTheDocument();
        expect(screen.queryByText('ORD-FAIL-3')).not.toBeInTheDocument();
      });
    });

    it('filters orders by 30 days date range and excludes older orders', async () => {
      vi.mocked(ordersApi.listOrders).mockResolvedValueOnce({
        orders: mockOrders as any,
        total: mockOrders.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <OrdersPage />
          </ToastProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getAllByText('ORD-PROC-1').length).toBeGreaterThan(0);
      });

      // Default dateRange is 30d: ord-1 (today), ord-2 (5d), ord-3 (20d) should appear, but ord-4 (40d) should be excluded
      expect(screen.getAllByText('ORD-PROC-1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ORD-COMP-2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ORD-FAIL-3').length).toBeGreaterThan(0);
      expect(screen.queryByText('ORD-SUBM-4')).not.toBeInTheDocument();
    });
  });

  describe('Agent OrdersPage Filters & Sorting', () => {
    it('renders all status tabs and allows filtering by Delivered and Failed statuses', async () => {
      vi.mocked(ordersApi.listAgentOrders).mockResolvedValue({
        orders: [
          {
            id: 'ord-agent-1',
            publicId: 'ORD-AG-PROC',
            referenceCode: 'TXN-AG-1',
            network: 'MTN',
            recipientPhone: '0244000111',
            orderStatus: OrderStatus.PROCESSING,
            status: 'processing',
            paymentStatus: 'paid',
            amount: '10.00',
            groupSizeGb: 1,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'ord-agent-2',
            publicId: 'ORD-AG-DELIV',
            referenceCode: 'TXN-AG-2',
            network: 'MTN',
            recipientPhone: '0244000222',
            orderStatus: OrderStatus.COMPLETED,
            status: 'approved',
            paymentStatus: 'paid',
            amount: '25.00',
            groupSizeGb: 5,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'ord-agent-3',
            publicId: 'ORD-AG-FAIL',
            referenceCode: 'TXN-AG-3',
            network: 'AIRTELTIGO',
            recipientPhone: '0277000333',
            orderStatus: OrderStatus.FAILED,
            status: 'rejected',
            paymentStatus: 'failed',
            amount: '15.00',
            groupSizeGb: 2,
            createdAt: new Date(Date.now() - 172800000).toISOString(),
          },
        ] as any,
        total: 3,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <ToastProvider>
            <AgentOrdersPage />
          </ToastProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(ordersApi.listAgentOrders).toHaveBeenCalled();
      });

      // Check all status buttons exist
      expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Processing$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Delivered$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Failed$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Submitted$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Cancelled$/i })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('ORD-AG-PROC')).toBeInTheDocument();
        expect(screen.getByText('ORD-AG-DELIV')).toBeInTheDocument();
        expect(screen.getByText('ORD-AG-FAIL')).toBeInTheDocument();
      });

      // Filter by Delivered
      const deliveredBtn = screen.getByRole('button', { name: /^Delivered$/i });
      fireEvent.click(deliveredBtn);

      await waitFor(() => {
        expect(screen.getByText('ORD-AG-DELIV')).toBeInTheDocument();
        expect(screen.queryByText('ORD-AG-PROC')).not.toBeInTheDocument();
        expect(screen.queryByText('ORD-AG-FAIL')).not.toBeInTheDocument();
      });

      // Filter by Failed
      const failedBtn = screen.getByRole('button', { name: /^Failed$/i });
      fireEvent.click(failedBtn);

      await waitFor(() => {
        expect(screen.getByText('ORD-AG-FAIL')).toBeInTheDocument();
        expect(screen.queryByText('ORD-AG-DELIV')).not.toBeInTheDocument();
        expect(screen.queryByText('ORD-AG-PROC')).not.toBeInTheDocument();
      });
    });
  });
});
