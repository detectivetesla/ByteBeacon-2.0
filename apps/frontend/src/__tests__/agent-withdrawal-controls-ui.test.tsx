import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentWithdrawalsPage } from '../pages/agent/AgentWithdrawalsPage.js';
import { walletApi } from '../api/wallet.api.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../api/wallet.api.js', () => ({
  walletApi: {
    getWithdrawals: vi.fn(),
    requestWithdrawal: vi.fn(),
  },
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: { id: 'agent-123', email: 'agent@bytebeacon.com', role: 'agent' },
  }),
}));

vi.mock('../hooks/useWalletBalance.js', () => ({
  useWalletBalance: () => ({
    balancePesewas: 25000,
    walletNumber: 'WAL-12345',
    isLoading: false,
    refreshBalance: vi.fn(),
  }),
}));

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({
    status: { maintenanceMode: false },
  }),
}));

describe('Agent Withdrawals Dynamic Limits and Schedule Window UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Displays dynamic limits configured by admin (e.g. Min: GH₵ 25.00, Max Single: GH₵ 8,000.00)', async () => {
    vi.mocked(walletApi.getWithdrawals).mockResolvedValueOnce({
      withdrawals: [],
      ledger: [],
      limits: {
        minWithdrawalPesewas: 2500, // GH₵ 25.00
        maxWithdrawalPesewas: 800000, // GH₵ 8,000.00
        dailyLimitPesewas: 1500000, // GH₵ 15,000.00
        remainingDailyLimitPesewas: 1500000,
        withdrawalsPaused: false,
        isCustomLimit: true,
        isWindowOpen: true,
        allowAnytimeWithdrawals: false,
      },
      summary: {
        hasStore: true,
        storeName: 'Test Store',
        totalProfitEarnedPesewas: 50000,
        totalWithdrawnPesewas: 10000,
        availableProfitPesewas: 40000,
      },
    } as any);

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentWithdrawalsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Min: GH₵ 25\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Max Single: GH₵ 8000\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/24h Remaining: GH₵ 15000\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Custom Reseller Limit Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Operating Window Open/i)).toBeInTheDocument();
    });
  });

  it('2. Shows closed window badge, warning banner, and disables withdrawal button when window is closed', async () => {
    vi.mocked(walletApi.getWithdrawals).mockResolvedValueOnce({
      withdrawals: [],
      ledger: [],
      limits: {
        minWithdrawalPesewas: 1000,
        maxWithdrawalPesewas: 500000,
        dailyLimitPesewas: 500000,
        remainingDailyLimitPesewas: 500000,
        withdrawalsPaused: false,
        isCustomLimit: false,
        isWindowOpen: false, // Window CLOSED
        allowAnytimeWithdrawals: false,
        windowMessage: 'Withdrawal hours are 08:00 - 18:00 GMT.',
      },
      summary: {
        hasStore: true,
        storeName: 'Test Store',
        totalProfitEarnedPesewas: 50000,
        totalWithdrawnPesewas: 0,
        availableProfitPesewas: 50000,
      },
    } as any);

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentWithdrawalsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/○ Window Closed/i)).toBeInTheDocument();
      expect(screen.getByText(/Profit Payout Window is Currently Closed/i)).toBeInTheDocument();
      // The withdraw profit button should show 'Payout Window Closed' and be disabled
      const button = screen.getByRole('button', { name: /Payout Window Closed/i });
      expect(button).toBeDisabled();
    });
  });

  it('3. Shows 24/7 VIP Access badge when allowAnytimeWithdrawals is active', async () => {
    vi.mocked(walletApi.getWithdrawals).mockResolvedValueOnce({
      withdrawals: [],
      ledger: [],
      limits: {
        minWithdrawalPesewas: 1000,
        maxWithdrawalPesewas: 500000,
        dailyLimitPesewas: 500000,
        remainingDailyLimitPesewas: 500000,
        withdrawalsPaused: false,
        isCustomLimit: false,
        isWindowOpen: false, // Window closed for others, but agent has VIP bypass
        allowAnytimeWithdrawals: true,
      },
      summary: {
        hasStore: true,
        storeName: 'Test Store',
        totalProfitEarnedPesewas: 50000,
        totalWithdrawnPesewas: 0,
        availableProfitPesewas: 50000,
      },
    } as any);

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentWithdrawalsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/24\/7 VIP Access/i)).toBeInTheDocument();
      const button = screen.getByRole('button', { name: /Withdraw Profit/i });
      expect(button).toBeEnabled();
    });
  });
});
