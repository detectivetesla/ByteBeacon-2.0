import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage.js';
import { adminApi } from '../api/admin.api.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../api/admin.api.js', () => ({
  adminApi: {
    getOrderStats: vi.fn(),
    getOrders: vi.fn(),
    getOrderDetail: vi.fn(),
    exportOrders: vi.fn(),
    reconcileOrder: vi.fn(),
    retryOrder: vi.fn(),
    refundOrder: vi.fn(),
  },
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: { id: 'admin-001', email: 'admin@bytebeacon.com', role: 'admin' },
  }),
}));

describe('AdminOrdersPage: Filter-Driven Stats & Operational Cards', () => {
  const initialStats = {
    totalOrders: 1000,
    processing: 50,
    completed: 850,
    failed: 60,
    refunded: 25,
    awaitingApproval: 10,
    syncIssues: 5,
    reconciliationRequired: 0,
  };

  const filteredStatsMTN = {
    totalOrders: 600,
    processing: 30,
    completed: 520,
    failed: 35,
    refunded: 10,
    awaitingApproval: 5,
    syncIssues: 0,
    reconciliationRequired: 0,
  };

  const filteredStatsFailed = {
    totalOrders: 60,
    processing: 0,
    completed: 0,
    failed: 60,
    refunded: 0,
    awaitingApproval: 0,
    syncIssues: 0,
    reconciliationRequired: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.getOrderStats).mockResolvedValue(initialStats);
    vi.mocked(adminApi.getOrders).mockResolvedValue({
      orders: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <AdminOrdersPage />
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('loads and renders all 8 operational KPI cards with initial stats', async () => {
    renderComponent();

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalled();
    });

    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('In-Flight Processing')).toBeInTheDocument();
    expect(screen.getByText('Completed Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Failed Dispatches')).toBeInTheDocument();
    expect(screen.getByText('Resolved Refunds')).toBeInTheDocument();
    expect(screen.getByText('Awaiting MTN Approvals')).toBeInTheDocument();
    expect(screen.getByText('Sync Issues')).toBeInTheDocument();
    expect(screen.getByText('Recon Required')).toBeInTheDocument();

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('850')).toBeInTheDocument();
  });

  it('updates card metrics when Network filter is selected', async () => {
    vi.mocked(adminApi.getOrderStats).mockResolvedValueOnce(initialStats);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    // Mock response for MTN filter
    vi.mocked(adminApi.getOrderStats).mockResolvedValueOnce(filteredStatsMTN);

    // Select MTN from Network dropdown
    const networkSelect = screen.getByDisplayValue('All Networks');
    fireEvent.change(networkSelect, { target: { value: 'MTN' } });

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalledWith(
        expect.objectContaining({
          network: 'MTN',
        })
      );
    });

    // Verify card value updated to 600
    await waitFor(() => {
      expect(screen.getByText('600')).toBeInTheDocument();
    });
  });

  it('updates card metrics when Lifecycle filter is selected', async () => {
    renderComponent();

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalled();
    });

    vi.mocked(adminApi.getOrderStats).mockResolvedValueOnce(filteredStatsFailed);

    const lifecycleSelect = screen.getByDisplayValue('All Lifecycles');
    fireEvent.change(lifecycleSelect, { target: { value: 'FAILED' } });

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalledWith(
        expect.objectContaining({
          lifecycle: 'FAILED',
        })
      );
    });
  });

  it('passes payment, channel, state, and period filters to getOrderStats', async () => {
    renderComponent();

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalled();
    });

    // Change Payment
    const paymentSelect = screen.getByDisplayValue('All Payments');
    fireEvent.change(paymentSelect, { target: { value: 'PAID' } });

    // Change Channel
    const channelSelect = screen.getByDisplayValue('All Channels');
    fireEvent.change(channelSelect, { target: { value: 'AGENT' } });

    // Change Operational State
    const stateSelect = screen.getByDisplayValue('All States');
    fireEvent.change(stateSelect, { target: { value: 'RECONCILIATION_REQUIRED' } });

    // Change Period
    const periodSelect = screen.getByDisplayValue('All Time');
    fireEvent.change(periodSelect, { target: { value: '7D' } });

    await waitFor(() => {
      expect(adminApi.getOrderStats).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: 'PAID',
          source: 'AGENT',
          operationalState: 'RECONCILIATION_REQUIRED',
          period: '7D',
        })
      );
    });
  });
});
