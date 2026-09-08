import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { BeneficiaryNotApprovedModal } from '../components/commerce/BeneficiaryNotApprovedModal.js';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { BuyDataPage } from '../pages/customer/BuyDataPage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { PlatformStatusProvider } from '../context/PlatformStatusContext.js';
import { ordersApi } from '../api/orders.api.js';
import { beneficiaryApi } from '../api/beneficiary.api.js';
import { catalogApi } from '../api/catalog.api.js';

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
  PlatformStatusProvider: ({ children }: any) => children,
}));

vi.mock('../api/beneficiary.api.js', () => ({
  beneficiaryApi: {
    precheckPublic: vi.fn(),
  },
}));

vi.mock('../api/catalog.api.js', () => ({
  catalogApi: {
    getBundles: vi.fn().mockResolvedValue([]),
    getPublicPackages: vi.fn().mockResolvedValue([]),
    getCachedPublicPackages: vi.fn().mockResolvedValue([]),
  },
}));

describe('BeneficiaryNotApprovedModal UI & Copy Suite', () => {
  it('renders all required text, warning icon, and phone number matching reference design', () => {
    const handleClose = vi.fn();
    render(
      <BeneficiaryNotApprovedModal
        isOpen={true}
        onClose={handleClose}
        phoneNumber="0541349282"
      />,
    );

    // Check title
    expect(screen.getByRole('heading', { name: /New beneficiary number/i })).toBeTruthy();
    expect(screen.getByText(/detected!/i)).toBeTruthy();

    // Check bold phone number
    expect(screen.getByText('0541349282')).toBeTruthy();

    // Check descriptive paragraph copy
    expect(
      screen.getByText(/is not added to our beneficiary list at the moment/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Number has been recorded and will be added to our beneficiary list/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/orders to it are currently blocked/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Please use a verified number\./i),
    ).toBeTruthy();

    // Check Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes on X button click, Escape key press, and backdrop click', () => {
    const handleClose = vi.fn();
    render(
      <BeneficiaryNotApprovedModal
        isOpen={true}
        onClose={handleClose}
        phoneNumber="0241234567"
      />,
    );

    // X close button
    const xBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(xBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Backdrop click
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it('does not render when isOpen is false', () => {
    render(
      <BeneficiaryNotApprovedModal
        isOpen={false}
        onClose={() => {}}
        phoneNumber="0541349282"
      />,
    );

    expect(screen.queryByText('New beneficiary number')).toBeNull();
  });
});

describe('PurchaseModal Integration with BeneficiaryNotApprovedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays BeneficiaryNotApprovedModal when order creation fails with BENEFICIARY_NOT_VALIDATED', async () => {
    vi.spyOn(ordersApi, 'createOrder').mockRejectedValue({
      code: 'BENEFICIARY_NOT_VALIDATED',
      status: 422,
      message: 'First-time MTN number not yet validated — recorded for MTN approval; precheck first.',
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={true}
            onClose={() => {}}
            initialNetwork={NetworkProvider.MTN}
            initialBundleId="bundle_mtn_5gb"
            initialRecipientPhone="0541349282"
            customRecipientSummary="0541349282"
            customPackageSummary="5 GB MTN"
            customAmountDisplay="GH₵ 25.00"
            walletBalanceGhs={100}
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    // Step 2 is active since recipient is provided
    expect(screen.getByText('0541349282')).toBeTruthy();

    const payBtn = screen.getByRole('button', { name: /Confirm Purchase/i });
    fireEvent.click(payBtn);

    // Should pop up the BeneficiaryNotApprovedModal
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /New beneficiary number/i })).toBeTruthy();
    });

    expect(
      screen.getByText(/is not added to our beneficiary list at the moment/i),
    ).toBeTruthy();
    expect(screen.getByText(/Please use a verified number\./i)).toBeTruthy();
  });

  it('displays BeneficiaryNotApprovedModal on MTN step-1 continue if precheck reports known: false', async () => {
    (beneficiaryApi.precheckPublic as any).mockResolvedValue({
      network: 'MTN',
      results: [
        {
          phone: '0541349282',
          normalized: '0541349282',
          valid: true,
          known: false,
        },
      ],
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={true}
            onClose={() => {}}
            initialNetwork={NetworkProvider.MTN}
            initialBundleId="bundle_mtn_5gb"
            initialRecipientPhone=""
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    // On Step 1: fill recipient phone
    const phoneInput = screen.getByPlaceholderText(/024 123 4567/i);
    fireEvent.change(phoneInput, { target: { value: '0541349282' } });

    const continueBtn = screen.getByRole('button', { name: /Continue to Payment/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(beneficiaryApi.precheckPublic).toHaveBeenCalledWith({
        network: NetworkProvider.MTN,
        phoneNumbers: ['0541349282'],
      });
    });

    // Should pop up the BeneficiaryNotApprovedModal
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /New beneficiary number/i })).toBeTruthy();
    });

    expect(screen.getByText('0541349282')).toBeTruthy();
    // Verify user is NOT taken to the payment modal
    expect(screen.queryByRole('button', { name: /Confirm Purchase/i })).toBeNull();
  });

  it('blocks advancing to payment screen when precheck reports status UNAPPROVED / orderable: false', async () => {
    (beneficiaryApi.precheckPublic as any).mockResolvedValue({
      network: 'MTN',
      enforced: true,
      results: [
        {
          phone: '0240001122',
          normalized: '0240001122',
          valid: true,
          known: false,
          orderable: false,
          status: 'UNAPPROVED',
        },
      ],
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <PurchaseModal
            isOpen={true}
            onClose={() => {}}
            initialNetwork={NetworkProvider.MTN}
            initialBundleId="bundle_mtn_5gb"
            initialRecipientPhone=""
          />
        </ToastProvider>
      </BrowserRouter>,
    );

    const phoneInput = screen.getByPlaceholderText(/024 123 4567/i);
    fireEvent.change(phoneInput, { target: { value: '0240001122' } });

    const continueBtn = screen.getByRole('button', { name: /Continue to Payment/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /New beneficiary number/i })).toBeTruthy();
    });

    expect(screen.getByText('0240001122')).toBeTruthy();
    // Verify user is NOT taken to the payment modal
    expect(screen.queryByRole('button', { name: /Confirm Purchase/i })).toBeNull();
  });
});

describe('BuyDataPage Single Order Gating Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (catalogApi.getBundles as any).mockResolvedValue([
      {
        id: 'prod-mtn-5gb',
        sku: 'MTN-5GB',
        network: NetworkProvider.MTN,
        dataAmountMb: 5120,
        basePricePesewas: 2800,
        agentPricePesewas: 1900,
        validityDays: 30,
        validityDesc: 'Non-Expiry',
        popular: true,
        isActive: true,
      },
    ]);
  });

  it('shows BeneficiaryNotApprovedModal for single orders instead of taking the user to the payment model', async () => {
    (beneficiaryApi.precheckPublic as any).mockResolvedValue({
      network: 'MTN',
      enforced: true,
      results: [
        {
          phone: '0541349282',
          normalized: '0541349282',
          valid: true,
          known: false,
          orderable: false,
          status: 'UNAPPROVED',
        },
      ],
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <PlatformStatusProvider>
            <BuyDataPage />
          </PlatformStatusProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(catalogApi.getBundles).toHaveBeenCalled();
    });

    // Enter single recipient
    const recipientInput = screen.getByPlaceholderText(/024 123 4567/i);
    fireEvent.change(recipientInput, { target: { value: '0541349282' } });

    // Submit single order (Buy Data button)
    const submitBtn = screen.getByRole('button', { name: /Buy Data/i });
    fireEvent.click(submitBtn);

    // Precheck should be called
    await waitFor(() => {
      expect(beneficiaryApi.precheckPublic).toHaveBeenCalledWith({
        network: NetworkProvider.MTN,
        phoneNumbers: ['0541349282'],
      });
    });

    // BeneficiaryNotApprovedModal should be displayed with exact copy and number
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /New beneficiary number/i })).toBeTruthy();
    });
    expect(screen.getAllByText('0541349282').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/is not added to our beneficiary list at the moment/i)).toBeTruthy();

    // Payment modal must NOT be shown!
    expect(screen.queryByRole('button', { name: /Confirm Purchase/i })).toBeNull();
    expect(screen.queryByText(/Payment Method/i)).toBeNull();
  });
});

