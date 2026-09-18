import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { AgentPendingOrdersPage } from '../pages/agent/AgentPendingOrdersPage.js';
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
    syncApprovalsWithProvider: vi.fn(),
    deleteAllApprovals: vi.fn(),
    recordUnapproved: vi.fn(),
  },
}));

// Mock ordersApi
vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    listOrders: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'agent-uuid-101',
      role: 'agent',
      email: 'agent@bytebeacon.com',
    },
  }),
}));

const mockRecords = [
  {
    id: 'ben-1',
    phoneNumber: '0244111222',
    network: NetworkProvider.MTN,
    status: 'PENDING',
    providerReference: 'DH-AUTO',
    detectedFrom: 'Excel Upload',
    createdAt: new Date(Date.now() - 10000).toISOString(),
    occurrences: 1,
    lastBundleSizeGb: 5,
  },
  {
    id: 'ben-2',
    phoneNumber: '0244333444',
    network: NetworkProvider.MTN,
    status: 'PENDING',
    providerReference: 'DH-AUTO',
    detectedFrom: 'Single Order',
    createdAt: new Date(Date.now() - 5000).toISOString(),
    occurrences: 4,
    lastBundleSizeGb: 10,
  },
  {
    id: 'ben-3',
    phoneNumber: '0555666777',
    network: NetworkProvider.MTN,
    status: 'APPROVED',
    providerReference: 'DH-AUTO',
    detectedFrom: 'Manual Check',
    createdAt: new Date(Date.now() - 20000).toISOString(),
    occurrences: 2,
    lastBundleSizeGb: 2,
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <PlatformStatusProvider>
        <ToastProvider>
          <AgentPendingOrdersPage />
        </ToastProvider>
      </PlatformStatusProvider>
    </MemoryRouter>
  );
};

describe('AgentPendingOrdersPage — Occurrence Feature Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beneficiaryApi.listApprovals as any).mockResolvedValue({
      items: mockRecords,
      total: 3,
      counts: {
        total: 3,
        pending: 2,
        approved: 1,
        rejected: 0,
        processing: 0,
      },
    });
    (beneficiaryApi.recordUnapproved as any).mockResolvedValue({ recorded: 1 });
    (beneficiaryApi.precheck as any).mockResolvedValue({
      network: 'MTN',
      enforced: true,
      results: [
        {
          phoneNumber: '0244999888',
          phone: '0244999888',
          isValid: true,
          isKnown: false,
          status: 'UNAPPROVED',
          accountName: 'Subscriber 9888',
        },
      ],
    });
    (ordersApi.listOrders as any).mockResolvedValue({ orders: [], total: 0 });
  });

  it('renders the Occurrences column header and occurrence badges in the table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244111222')).toBeInTheDocument();
    });

    // Verify Occurrences table header
    const thOccurrences = screen.getByRole('columnheader', { name: /occurrences/i });
    expect(thOccurrences).toBeInTheDocument();

    // Verify occurrence badges in table
    expect(screen.getByText('1 time')).toBeInTheDocument();
    expect(screen.getByText('4 times')).toBeInTheDocument();
    expect(screen.getByText('2 times')).toBeInTheDocument();
  });

  it('displays recorded occurrences inside the beneficiary detail modal dossier', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244333444')).toBeInTheDocument();
    });

    // Click on phone number to open dossier modal
    fireEvent.click(screen.getByText('0244333444'));

    await waitFor(() => {
      expect(screen.getByText(/Beneficiary Dossier — 0244333444/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Recorded Occurrences')).toBeInTheDocument();
    expect(screen.getByText('4 times recorded')).toBeInTheDocument();
  });

  it('sorts records by Most Occurrences', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244111222')).toBeInTheDocument();
    });

    // Select "Most Occurrences" from sort dropdown
    const sortSelects = screen.getAllByRole('combobox');
    const sortDropdown = sortSelects.find((s) => (s as HTMLSelectElement).value === 'newest');
    expect(sortDropdown).toBeDefined();

    fireEvent.change(sortDropdown!, { target: { value: 'occurrences' } });

    // With sort by occurrences: 0244333444 (4 times) should precede 0555666777 (2 times) and 0244111222 (1 time)
    const rows = screen.getAllByRole('row');
    // First body row should contain 0244333444
    expect(rows[1]).toHaveTextContent('0244333444');
    expect(rows[1]).toHaveTextContent('4 times');
    // Second row should contain 0555666777
    expect(rows[2]).toHaveTextContent('0555666777');
    expect(rows[2]).toHaveTextContent('2 times');
    // Third row should contain 0244111222
    expect(rows[3]).toHaveTextContent('0244111222');
    expect(rows[3]).toHaveTextContent('1 time');
  });

  it('records unapproved check and registers occurrence on manual number validation', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('0244111222')).toBeInTheDocument();
    });

    // Click "Validate New Number" button
    fireEvent.click(screen.getByRole('button', { name: /validate new number/i }));

    await waitFor(() => {
      expect(screen.getByText(/Validate & Whitelist Beneficiary Number/i)).toBeInTheDocument();
    });

    // Enter new phone number
    const input = screen.getByLabelText(/Beneficiary Phone Input/i);
    fireEvent.change(input, { target: { value: '0244999888' } });

    // Click Run Validation Check
    fireEvent.click(screen.getByRole('button', { name: /run validation check/i }));

    await waitFor(() => {
      expect(beneficiaryApi.precheck).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumbers: ['0244999888'],
          network: NetworkProvider.MTN,
          record: true,
        })
      );
      expect(beneficiaryApi.recordUnapproved).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              phoneNumber: '0244999888',
              network: NetworkProvider.MTN,
              detectedFrom: 'Manual Check',
            }),
          ],
          userId: 'agent-uuid-101',
        })
      );
    });
  });
});
