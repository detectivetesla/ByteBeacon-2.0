import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WalletPage } from '../pages/customer/WalletPage.js';

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({ isMaintenanceMode: false, maintenanceMessage: '' }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    toastInfo: vi.fn(),
    toastWarning: vi.fn(),
  }),
}));

vi.mock('../hooks/useWalletBalance.js', () => ({
  useWalletBalance: () => ({
    balanceGhs: 50.0,
    balancePesewas: 5000,
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../api/wallet.api.js', () => ({
  walletApi: {
    getTransactions: vi.fn().mockResolvedValue({
      transactions: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    }),
    initializeTopup: vi.fn().mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/test-ref',
      reference: 'test-ref',
      creditAmountPesewas: 1000,
      feePesewas: 30,
      totalPayablePesewas: 1030,
    }),
    verifyTopup: vi.fn().mockResolvedValue({
      success: true,
      newBalancePesewas: 6000,
      amountCreditedPesewas: 1000,
      feePesewas: 30,
    }),
  },
}));

describe('Customer WalletPage — 3% Paystack Surcharge & 100% Credit Breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders deposit modal with transparent 3% surcharge and 100% credit guarantee', async () => {
    render(
      <MemoryRouter initialEntries={['/customer/wallet']}>
        <WalletPage />
      </MemoryRouter>,
    );

    // Open top-up modal
    const topUpButton = screen.getByRole('button', { name: /Top Up Wallet/i });
    fireEvent.click(topUpButton);

    // Default amount is 20: 20 * 0.03 = 0.60, total 20.60
    expect(screen.getByText('Deposit to Wallet:')).toBeInTheDocument();
    expect(screen.getByText('Processing Fee (3%):')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 0.60')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 20.60')).toBeInTheDocument();
    expect(
      screen.getByText(/100% of your deposit \(GH₵ 20.00\) is credited directly to your wallet/i),
    ).toBeInTheDocument();

    // Select Quick Amount 10: 10 * 0.03 = 0.30, total 10.30
    const btn10 = screen.getByRole('button', { name: '10' });
    fireEvent.click(btn10);

    expect(screen.getByText('GH₵ 0.30')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 10.30')).toBeInTheDocument();
    expect(
      screen.getByText(/100% of your deposit \(GH₵ 10.00\) is credited directly to your wallet/i),
    ).toBeInTheDocument();

    // Change input to 17: 17 * 0.03 = 0.51, total 17.51
    const amountInput = screen.getByPlaceholderText('Enter amount');
    fireEvent.change(amountInput, { target: { value: '17' } });

    expect(screen.getByText('GH₵ 0.51')).toBeInTheDocument();
    expect(screen.getByText('GH₵ 17.51')).toBeInTheDocument();
    expect(
      screen.getByText(/100% of your deposit \(GH₵ 17.00\) is credited directly to your wallet/i),
    ).toBeInTheDocument();
  });
});
