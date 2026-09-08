import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentStorePage } from '../pages/agent/AgentStorePage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { storesApi } from '../api/stores.api.js';

vi.mock('../api/stores.api.js', () => ({
  storesApi: {
    getStore: vi.fn(),
    setupStore: vi.fn(),
    initializeActivation: vi.fn(),
    verifyActivation: vi.fn(),
  },
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-agent-99',
      fullName: 'Kwame Agent',
      email: 'kwame@bytebeacon.com',
      phone: '0241234567',
      role: 'agent',
    },
    isAuthenticated: true,
  }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Agent Storefront Setup & Activation Paywall Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders activation paywall when agent has no store setup yet', async () => {
    (storesApi.getStore as any).mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentStorePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unlock Your Standalone Agent Store/i)).toBeTruthy();
    });

    expect(screen.getByText(/Agent Storefront Platform/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pay GH₵ 500.00 via Paystack & Activate Store/i })).toBeTruthy();
  });

  it('successfully initializes store setup and activation payment without error', async () => {
    (storesApi.getStore as any).mockResolvedValueOnce(null);
    (storesApi.initializeActivation as any).mockResolvedValueOnce({
      reference: 'STRPAY-TEST-1234',
      amountGhs: 500,
    });
    (storesApi.verifyActivation as any).mockResolvedValueOnce({
      success: true,
      store: {
        id: 'str_1',
        storeName: 'Kwame Data Hub',
        slug: 'kwame-data-hub',
        storeStatus: 'ACTIVE',
        approvalStatus: 'APPROVED',
        paymentStatus: 'PAID',
      },
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentStorePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unlock Your Standalone Agent Store/i)).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(/Store Business Name/i);
    const slugInput = screen.getByLabelText(/Custom URL Slug/i);
    fireEvent.change(nameInput, { target: { value: 'Kwame Data Hub' } });
    fireEvent.change(slugInput, { target: { value: 'kwame-data-hub' } });

    const payBtn = screen.getByRole('button', { name: /Pay GH₵ 500.00 via Paystack & Activate Store/i });
    fireEvent.click(payBtn);


    await waitFor(() => {

      expect(storesApi.initializeActivation).toHaveBeenCalledWith({
        storeName: 'Kwame Data Hub',
        slug: 'kwame-data-hub',
        contactPhone: '0241234567',
        contactEmail: 'kwame@bytebeacon.com',
      });
      expect(storesApi.verifyActivation).toHaveBeenCalledWith('STRPAY-TEST-1234');
    });
  });

  it('renders paywall form with dynamic price and does not lock on PAYMENT_PENDING on fresh page load', async () => {
    (storesApi.getStore as any).mockResolvedValueOnce({
      id: 'str_pending_1',
      storeName: 'Kwame Dynamic Hub',
      slug: 'kwame-dynamic-hub',
      contactPhone: '0241234567',
      contactEmail: 'kwame@bytebeacon.com',
      paymentStatus: 'PAYMENT_PENDING',
      approvalStatus: 'NOT_SUBMITTED',
      storeStatus: 'INACTIVE',
      activationFeePesewas: 35000,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentStorePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(storesApi.getStore).toHaveBeenCalled();
    });

    // Paywall form is visible and editable
    expect(screen.getByText(/Unlock Your Standalone Agent Store/i)).toBeTruthy();
    expect(screen.getByText(/Payment Incomplete/i)).toBeTruthy();
    expect(screen.getAllByText(/350.00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Pay GH₵ 350.00 via Paystack & Activate Store/i })).toBeTruthy();
    expect(screen.queryByText(/Verifying Paystack Payment.../i)).toBeNull();
    expect(screen.queryByText(/500\.00/i)).toBeNull();
  });

  it('never displays paywall or GHC 500 fee when store is already paid and approved', async () => {
    (storesApi.getStore as any).mockResolvedValue({
      id: 'str_approved_99',
      storeName: 'Kwame Live Store',
      slug: 'kwame-live-store',
      contactPhone: '0241234567',
      contactEmail: 'kwame@bytebeacon.com',
      paymentStatus: 'PAID',
      approvalStatus: 'APPROVED',
      storeStatus: 'ACTIVE',
      activationFeePesewas: 35000,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentStorePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(storesApi.getStore).toHaveBeenCalled();
    });

    // Should render active store view directly
    expect(screen.getByText(/Live & Active/i)).toBeTruthy();
    expect(screen.getByText(/Kwame Live Store/i)).toBeTruthy();
    expect(screen.getByText(/Open Agent Store Console/i)).toBeTruthy();

    // Paywall elements and 500 fee MUST NEVER exist in DOM
    expect(screen.queryByText(/Unlock Your Standalone Agent Store/i)).toBeNull();
    expect(screen.queryByText(/HARD PAYWALL/i)).toBeNull();
    expect(screen.queryByText(/500\.00/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Pay GH₵/i })).toBeNull();
  });
});


