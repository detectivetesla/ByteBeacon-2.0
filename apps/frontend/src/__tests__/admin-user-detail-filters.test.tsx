import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminUserDetailPage } from '../pages/admin/AdminUserDetailPage.js';
import { adminApi } from '../api/admin.api.js';

// Mock contexts
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const mockCurrentUser = { sub: 'admin_1', email: 'admin@bytebeacon.com', role: 'super_admin' };

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: true,
  }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    toastSuccess: mockToastSuccess,
    toastError: mockToastError,
  }),
}));

vi.mock('../api/admin.api.js', () => ({
  adminApi: {
    getUserDetails: vi.fn(),
    getUserPricing: vi.fn(),
    updateUserProductPricing: vi.fn(),
    deleteUserProductPricing: vi.fn(),
    adjustUserWallet: vi.fn(),
    reconcileUserWallet: vi.fn(),
  },
}));

describe('AdminUserDetailPage — Operational Cards & Snapshot Filters', () => {
  const mockUserDetail = {
    user: {
      id: 'usr_cust_123',
      email: 'customer@bytebeacon.com',
      phone: '0240000001',
      fullName: 'Kwame Mensah',
      role: 'customer',
      status: 'ACTIVE',
      securityDomain: 'CUSTOMER',
      phoneVerified: true,
      emailVerified: true,
      mfaEnabled: false,
      walletBalancePesewas: 50000,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-08-25T00:00:00.000Z',
    },
    financialSummary: {
      walletBalancePesewas: 50000,
      ledgerDerivedBalancePesewas: 50000,
      reconciliationStatus: 'RECONCILED',
      totalDepositsPesewas: 100000,
      pendingOperationsPesewas: 0,
      totalSpentPesewas: 50000,
      totalRefundsPesewas: 2500,
      periodNetFlowPesewas: 15000,
      periodCreditsPesewas: 20000,
      periodDebitsPesewas: 5000,
      lastAdjustmentAt: '2026-08-20T00:00:00.000Z',
    },
    orderSummary: {
      totalOrders: 10,
      completed: 8,
      processing: 1,
      pending: 0,
      failed: 1,
      refunded: 1,
      cancelled: 0,
      totalSpentPesewas: 50000,
      totalRefundsPesewas: 2500,
      dailyOrders: 1,
      dailySpentPesewas: 5000,
      lastOrderAt: '2026-08-24T00:00:00.000Z',
    },
    recentOrders: [
      {
        id: 'ord_1',
        publicId: 'BB-ORD-001',
        recipientPhone: '0240000001',
        network: 'MTN',
        dataAmountMb: 1024,
        amountPesewas: 2500,
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        createdAt: '2026-08-25T10:00:00.000Z',
      },
      {
        id: 'ord_2',
        publicId: 'BB-ORD-002',
        recipientPhone: '0200000002',
        network: 'TELECEL',
        dataAmountMb: 2048,
        amountPesewas: 4500,
        orderStatus: 'FAILED',
        paymentStatus: 'REFUNDED',
        refundStatus: 'COMPLETED',
        createdAt: '2026-08-24T10:00:00.000Z',
      },
    ],
    recentLedgerLines: [
      {
        id: 'led_1',
        entryType: 'CREDIT',
        amountPesewas: 20000,
        referenceType: 'PAYMENT',
        referenceId: 'pay_1',
        description: 'Wallet top-up via Paystack',
        createdAt: '2026-08-25T08:00:00.000Z',
      },
      {
        id: 'led_2',
        entryType: 'DEBIT',
        amountPesewas: 5000,
        referenceType: 'ORDER',
        referenceId: 'ord_1',
        description: 'Payment for MTN Data Bundle',
        createdAt: '2026-08-25T10:00:00.000Z',
      },
    ],
    transactions: [],
    activity: [],
    activeSessions: [],
    notifications: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (adminApi.getUserDetails as any).mockResolvedValue(mockUserDetail);
    (adminApi.getUserPricing as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/admin/users/usr_cust_123']}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('1. renders all-time operational cards with authoritative values', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
      // Authoritative Wallet card: 500.00 GH₵
      expect(screen.getByText('Authoritative Wallet')).toBeInTheDocument();
      expect(screen.getAllByText('GH₵ 500.00').length).toBeGreaterThanOrEqual(1);

      // Total Lifetime Orders card: 10
      expect(screen.getByText('Total Lifetime Orders')).toBeInTheDocument();
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);

      // Total Spending card: GH₵ 500.00
      expect(screen.getByText('Total Spending')).toBeInTheDocument();

      // Resolved Refunds card: GH₵ 25.00
      expect(screen.getByText('Resolved Refunds')).toBeInTheDocument();
      expect(screen.getAllByText('GH₵ 25.00').length).toBeGreaterThanOrEqual(1);
    });

    // Check Filter Bar is rendered
    expect(screen.getByText('Snapshot Metrics & Ledger Filters')).toBeInTheDocument();
    expect(screen.getByText('All-time view')).toBeInTheDocument();
  });

  it('2. changes filter dropdowns and dynamically updates cards and triggers parameterized fetch', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Snapshot Metrics & Ledger Filters')).toBeInTheDocument();
    });

    // Find Network filter dropdown and select MTN
    const networkSelect = screen.getByDisplayValue('All Networks');
    fireEvent.change(networkSelect, { target: { value: 'MTN' } });

    await waitFor(() => {
      // Cards now reflect filtered status
      expect(screen.getByText('1 active filter')).toBeInTheDocument();
      expect(screen.getByText(/Reset Filters/i)).toBeInTheDocument();
      expect(screen.getByText('Filtered Orders')).toBeInTheDocument();
      expect(screen.getByText('Filtered Spending')).toBeInTheDocument();
      expect(screen.getByText('Filtered Refunds')).toBeInTheDocument();
    });

    // Verify backend call was dispatched with network parameter
    await waitFor(() => {
      expect(adminApi.getUserDetails).toHaveBeenCalledWith(
        'usr_cust_123',
        expect.objectContaining({ network: 'MTN' }),
      );
    });
  });

  it('3. filters by Period and verifies custom date inputs expand on CUSTOM selection', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Snapshot Metrics & Ledger Filters')).toBeInTheDocument();
    });

    // Select Custom Range
    const periodSelect = screen.getByDisplayValue('📅 All Time');
    fireEvent.change(periodSelect, { target: { value: 'CUSTOM' } });

    await waitFor(() => {
      expect(screen.getByText('Custom Range:')).toBeInTheDocument();
      expect(screen.getByText('From:')).toBeInTheDocument();
      expect(screen.getByText('To:')).toBeInTheDocument();
    });

    // Reset filters
    const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText('All-time view')).toBeInTheDocument();
      expect(screen.queryByText('Custom Range:')).not.toBeInTheDocument();
    });
  });
});
