import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NetworkProvider, PaymentMethod, Currency } from '@bytebeacon/shared';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { ToastProvider } from '../context/ToastContext.js';
import { ordersApi } from '../api/orders.api.js';

// Mock Auth Context & Hooks
vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'usr_mock_1',
      email: 'customer@test.com',
      role: 'customer',
      walletBalancePesewas: 10000,
    },
    isAuthenticated: true,
  }),
}));

vi.mock('../hooks/useWalletBalance.js', () => ({
  useWalletBalance: () => ({
    balancePesewas: 10000,
    balanceGhs: 100,
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({
    isMaintenanceMode: false,
    maintenanceMessage: '',
  }),
}));

const renderModal = (props: React.ComponentProps<typeof PurchaseModal>) => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <PurchaseModal {...props} />
      </ToastProvider>
    </BrowserRouter>,
  );
};

describe('PurchaseModal Recipient Phone Number & Wallet Purchase Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly populates and retains recipient phone number when opened from buy page', async () => {
    const createOrderSpy = vi.spyOn(ordersApi, 'createOrder').mockResolvedValue({
      id: 'ord_success_1',
      publicId: 'ORD-000067',
      userId: 'usr_mock_1',
      agentId: null,
      recipientPhone: '0241234567',
      network: NetworkProvider.MTN,
      dataAmountMb: 2048,
      amountPesewas: 1200,
      currency: Currency.GHS,
      paymentStatus: 'PAID' as any,
      orderStatus: 'READY_FOR_FULFILLMENT' as any,
      providerStatus: 'UNKNOWN' as any,
      refundStatus: 'NONE' as any,
      pricingSnapshot: {} as any,
      providerOrder: {} as any,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderModal({
      isOpen: true,
      onClose: () => {},
      initialNetwork: NetworkProvider.MTN,
      initialBundleId: 'bundle_mtn_2gb',
      initialRecipientPhone: '0241234567',
      customRecipientSummary: '0241234567',
      customPackageSummary: '2 GB MTN',
      customAmountDisplay: 'GH₵ 12.00',
      walletBalanceGhs: 100,
    });

    // Should be on confirmation step and show recipient number
    expect(screen.getByText('0241234567')).toBeTruthy();

    // Click wallet purchase button
    const payBtn = screen.getByRole('button', { name: /Confirm Purchase/i });
    expect(payBtn).toBeTruthy();

    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(createOrderSpy).toHaveBeenCalledTimes(1);
    });

    const callArg = createOrderSpy.mock.calls[0][0];
    expect(callArg.recipientPhone).toBe('0241234567');
    expect(callArg.paymentMethod).toBe(PaymentMethod.WALLET);
  });
});
