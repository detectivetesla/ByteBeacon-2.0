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

describe('AdminUserDetailPage — Custom Data Bundle Pricing & Wallet Adjustments', () => {
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
      lastAdjustmentAt: '2026-08-20T00:00:00.000Z',
    },
    orderSummary: {
      totalOrders: 10,
      completed: 9,
      processing: 1,
      pending: 0,
      failed: 0,
      refunded: 0,
      cancelled: 0,
      totalSpentPesewas: 50000,
      totalRefundsPesewas: 0,
      dailyOrders: 1,
      dailySpentPesewas: 5000,
      lastOrderAt: '2026-08-24T00:00:00.000Z',
    },
    recentOrders: [],
    recentLedgerLines: [],
    transactions: [],
    activity: [],
    activeSessions: [],
    notifications: [],
  };

  const mockPricingData = [
    {
      id: 'upr_1',
      productId: 'prod_mtn_1gb',
      productName: 'MTN 1GB Data Bundle',
      sku: 'MTN-1GB-DATA',
      network: 'MTN',
      dataAmountMb: 1024,
      defaultAgentPricePesewas: 450,
      basePricePesewas: 500,
      customPricePesewas: 420,
      effectivePricePesewas: 420,
      isActive: true,
      updatedAt: '2026-08-25T10:00:00.000Z',
    },
    {
      productId: 'prod_telecel_2gb',
      productName: 'Telecel 2GB Bundle',
      sku: 'TEL-2GB-DATA',
      network: 'TELECEL',
      dataAmountMb: 2048,
      defaultAgentPricePesewas: 800,
      basePricePesewas: 900,
      customPricePesewas: null,
      effectivePricePesewas: 900,
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (adminApi.getUserDetails as any).mockResolvedValue(mockUserDetail);
    (adminApi.getUserPricing as any).mockResolvedValue(mockPricingData);
    (adminApi.updateUserProductPricing as any).mockResolvedValue({ success: true });
    (adminApi.deleteUserProductPricing as any).mockResolvedValue({ success: true });
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

  it('1. renders user overview and displays navigation tabs including Bundle Pricing', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
      expect(screen.getByText('customer@bytebeacon.com')).toBeInTheDocument();
    });

    // Check tab button exists
    const pricingTabBtn = screen.getByRole('button', { name: /Bundle Pricing/i });
    expect(pricingTabBtn).toBeInTheDocument();
  });

  it('2. switches to Bundle Pricing tab and loads custom pricing table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
    });

    const pricingTabBtn = screen.getByRole('button', { name: /Bundle Pricing/i });
    fireEvent.click(pricingTabBtn);

    await waitFor(() => {
      expect(adminApi.getUserPricing).toHaveBeenCalledWith('usr_cust_123');
      expect(screen.getByText('Individual User Bundle Pricing Overrides')).toBeInTheDocument();
      expect(screen.getByText('MTN 1GB Data Bundle')).toBeInTheDocument();
      expect(screen.getByText('Telecel 2GB Bundle')).toBeInTheDocument();
    });

    // Check custom price badge is rendered for MTN 1GB (GH₵ 4.20)
    expect(screen.getAllByText('GH₵ 4.20').length).toBeGreaterThanOrEqual(1);
  });

  it('3. opens Set Custom Price modal and saves new custom price override', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
    });

    const pricingTabBtn = screen.getByRole('button', { name: /Bundle Pricing/i });
    fireEvent.click(pricingTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Telecel 2GB Bundle')).toBeInTheDocument();
    });

    // Click "Set Custom" for Telecel 2GB
    const setCustomBtns = screen.getAllByRole('button', { name: /Set Custom|Edit Price/i });
    fireEvent.click(setCustomBtns[1]); // Telecel item

    await waitFor(() => {
      expect(screen.getByText('Set Custom Bundle Price')).toBeInTheDocument();
    });

    // Change input value to 7.80
    const priceInput = screen.getByPlaceholderText('e.g. 4.50');
    fireEvent.change(priceInput, { target: { value: '7.80' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Custom Price/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminApi.updateUserProductPricing).toHaveBeenCalledWith(
        'usr_cust_123',
        'prod_telecel_2gb',
        {
          customPricePesewas: 780,
          isActive: true,
        },
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Custom Price Saved',
        expect.stringContaining('GH₵ 7.80'),
      );
    });
  });

  it('4. resets custom price override back to default', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument();
    });

    const pricingTabBtn = screen.getByRole('button', { name: /Bundle Pricing/i });
    fireEvent.click(pricingTabBtn);

    await waitFor(() => {
      expect(screen.getByText('MTN 1GB Data Bundle')).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(adminApi.deleteUserProductPricing).toHaveBeenCalledWith('usr_cust_123', 'prod_mtn_1gb');
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Override Removed',
        expect.stringContaining('Custom price removed'),
      );
    });
  });
});
