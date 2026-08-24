import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { CustomerPendingApprovalsPage } from '../pages/customer/CustomerPendingApprovalsPage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { PlatformStatusProvider } from '../context/PlatformStatusContext.js';
import { beneficiaryApi } from '../api/beneficiary.api.js';
import { ordersApi } from '../api/orders.api.js';

// Mock beneficiaryApi
vi.mock('../api/beneficiary.api.js', () => ({
  beneficiaryApi: {
    listApprovals: vi.fn(),
    approveBeneficiary: vi.fn(),
    rejectBeneficiary: vi.fn(),
    precheck: vi.fn(),
    validatePhoneNumber: vi.fn(),
    getBeneficiaryStatus: vi.fn(),
    syncBeneficiary: vi.fn(),
  },
}));

// Mock ordersApi
vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    listOrders: vi.fn(),
  },
}));

const mockApprovalsList = [
  {
    id: 'ben-1',
    phoneNumber: '0244123456',
    network: NetworkProvider.MTN,
    status: 'PENDING',
    providerReference: 'DH-REF-101',
    detectedFrom: 'Bulk Order',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    occurrences: 2,
  },
  {
    id: 'ben-2',
    phoneNumber: '0555987654',
    network: NetworkProvider.MTN,
    status: 'VALID',
    providerReference: 'DH-REF-102',
    detectedFrom: 'Single Order',
    createdAt: new Date(Date.now() - 50000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    occurrences: 1,
  },
  {
    id: 'ben-3',
    phoneNumber: '0200112233',
    network: NetworkProvider.TELECEL,
    status: 'INVALID',
    providerReference: 'DH-REF-103',
    detectedFrom: 'Excel Upload',
    createdAt: new Date(Date.now() - 100000).toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    occurrences: 1,
  },
];

const mockOrders = [
  {
    id: 'ord-test-01',
    recipientPhone: '0244123456',
    network: 'MTN',
    dataAmountMb: 10240,
    amountPesewas: 4500,
    orderStatus: 'AWAITING_APPROVAL',
    createdAt: new Date().toISOString(),
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <PlatformStatusProvider>
        <ToastProvider>
          <CustomerPendingApprovalsPage />
        </ToastProvider>
      </PlatformStatusProvider>
    </MemoryRouter>
  );
};

describe('CustomerPendingApprovalsPage — Customer MTN Approvals Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beneficiaryApi.listApprovals as any).mockResolvedValue({
      items: mockApprovalsList,
      total: 3,
    });
    (ordersApi.listOrders as any).mockResolvedValue({
      orders: mockOrders,
      total: 1,
    });
    (beneficiaryApi.approveBeneficiary as any).mockResolvedValue({ success: true });
    (beneficiaryApi.rejectBeneficiary as any).mockResolvedValue({ success: true });
    (beneficiaryApi.syncBeneficiary as any).mockResolvedValue({ success: true });
    (beneficiaryApi.precheck as any).mockResolvedValue({
      network: NetworkProvider.MTN,
      enforced: true,
      results: [
        {
          phoneNumber: '0244999888',
          network: NetworkProvider.MTN,
          isValid: true,
          isKnown: true,
          accountName: 'Subscriber 9888',
        },
      ],
    });
  });

  it('renders top page title, action buttons, and telemetry metric cards', async () => {
    renderComponent();

    expect(screen.getByText('Pending MTN Approvals')).toBeDefined();
    expect(screen.getByText('Customer Telecom Hub')).toBeDefined();
    expect(screen.getByText('Validate New Number')).toBeDefined();
    expect(screen.getByText('Export (MTN Format)')).toBeDefined();

    // Verify Metric cards and Refresh button after loading finishes
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeDefined();
      expect(screen.getByText('Awaiting Approval')).toBeDefined();
      expect(screen.getByText('Approved / Valid')).toBeDefined();
      expect(screen.getByText('Rejected / Invalid')).toBeDefined();
      expect(screen.getByText('Total Registered')).toBeDefined();
    });

    // Check beneficiary numbers rendered in table
    await waitFor(() => {
      expect(screen.getByText('0244123456')).toBeDefined();
      expect(screen.getByText('0555987654')).toBeDefined();
      expect(screen.getByText('0200112233')).toBeDefined();
    });
  });

  it('filters records by search input query and status tabs', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244123456')).toBeDefined();
    });

    // Search query
    const searchInput = screen.getByPlaceholderText(/Search beneficiary/i);
    fireEvent.change(searchInput, { target: { value: '0555' } });

    expect(screen.getByText('0555987654')).toBeDefined();
    expect(screen.queryByText('0244123456')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Status Tab: Pending
    const pendingTab = screen.getByRole('button', { name: 'Pending' });
    fireEvent.click(pendingTab);

    expect(screen.getByText('0244123456')).toBeDefined();
    expect(screen.queryByText('0555987654')).toBeNull();
  });

  it('opens Validate New Number modal and runs carrier precheck successfully', async () => {
    renderComponent();

    const validateBtn = screen.getByRole('button', { name: /Validate New Number/i });
    fireEvent.click(validateBtn);

    expect(screen.getByText('Validate & Whitelist Beneficiary Number')).toBeDefined();

    const phoneInput = screen.getByLabelText('Beneficiary Phone Input');
    fireEvent.change(phoneInput, { target: { value: '0244999888' } });

    const runCheckBtn = screen.getByRole('button', { name: /Run Validation Check/i });
    fireEvent.click(runCheckBtn);

    await waitFor(() => {
      expect(beneficiaryApi.precheck).toHaveBeenCalledWith({
        phoneNumbers: ['0244999888'],
        network: NetworkProvider.MTN,
        record: true,
      });
      expect(screen.getByText('Carrier Validation Passed')).toBeDefined();
    });
  });

  it('opens Beneficiary Dossier modal and displays associated orders', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244123456')).toBeDefined();
    });

    const phoneButton = screen.getByText('0244123456');
    fireEvent.click(phoneButton);

    await waitFor(() => {
      expect(screen.getByText(/Beneficiary Dossier — 0244123456/i)).toBeDefined();
      expect(screen.getByText('Buy Data for this Number')).toBeDefined();
      expect(screen.getByText('DH-REF-101')).toBeDefined();
    });
  });

  it('handles carrier sync action with toast feedback', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244123456')).toBeDefined();
    });

    const syncButtons = screen.getAllByTitle('Re-verify / Sync with Carrier');
    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(beneficiaryApi.syncBeneficiary).toHaveBeenCalledWith('0244123456', NetworkProvider.MTN);
    });
  });

  it('handles approve and reject actions with toast feedback', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244123456')).toBeDefined();
    });

    // Whitelist / Approve button for pending row (0244123456)
    const approveButtons = screen.getAllByTitle('Approve / Whitelist');
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(beneficiaryApi.approveBeneficiary).toHaveBeenCalledWith('ben-1');
    });

    // Reject button for non-rejected row
    const rejectButtons = screen.getAllByTitle('Reject Number');
    fireEvent.click(rejectButtons[0]);

    await waitFor(() => {
      expect(beneficiaryApi.rejectBeneficiary).toHaveBeenCalledWith('ben-1');
    });
  });
});
