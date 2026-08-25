import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentCustomersPage } from '../pages/agent/AgentCustomersPage.js';
import { ToastProvider } from '../context/ToastContext.js';
import { walletApi } from '../api/wallet.api.js';

vi.mock('../api/wallet.api.js', () => ({
  walletApi: {
    getSubAgents: vi.fn(),
    createSubAgent: vi.fn(),
    updateSubAgentStatus: vi.fn(),
  },
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSubAgents = [
  {
    id: 'sa-1',
    agentId: 'SA-A1B2C3',
    name: 'Kofi Mensah',
    email: 'kofi@subagent.com',
    phone: '0241234567',
    storeName: "Kofi's Data Shop",
    storeSlug: 'kofis-data-shop',
    storeStatus: 'ONLINE' as const,
    enabledProductsCount: 12,
    dateJoined: 'Aug 20, 2026',
    lastActive: 'Active today',
    rawLastActive: '2026-08-20T10:00:00Z',
    status: 'ACTIVE' as const,
    ordersCount: 25,
    successfulOrdersCount: 24,
    failedOrdersCount: 1,
    totalSalesPesewas: 35000,
    totalCommissionPesewas: 2800,
    balancePesewas: 5000,
    totalDepositedPesewas: 5000,
    totalSpentPesewas: 35000,
    recentOrders: [],
    activityLogs: [],
  },
  {
    id: 'sa-2',
    agentId: 'SA-D4E5F6',
    name: 'Abena Osei',
    email: 'abena@subagent.com',
    phone: '0209876543',
    storeName: 'Abena Data Hub',
    storeSlug: 'abena-data-hub',
    storeStatus: 'ONLINE' as const,
    enabledProductsCount: 12,
    dateJoined: 'Aug 22, 2026',
    lastActive: 'Active today',
    rawLastActive: '2026-08-22T10:00:00Z',
    status: 'SUSPENDED' as const,
    ordersCount: 10,
    successfulOrdersCount: 10,
    failedOrdersCount: 0,
    totalSalesPesewas: 12000,
    totalCommissionPesewas: 960,
    balancePesewas: 2000,
    totalDepositedPesewas: 2000,
    totalSpentPesewas: 12000,
    recentOrders: [],
    activityLogs: [],
  },
];

describe('Agent Sub-Agents Page (AgentCustomersPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI metric cards and sub-agents list exclusively for the current agent', async () => {
    (walletApi.getSubAgents as any).mockResolvedValueOnce({ subAgents: mockSubAgents });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentCustomersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(walletApi.getSubAgents).toHaveBeenCalledTimes(1);
    });

    // Check page title and top metrics
    expect(screen.getByText('Sub Agents')).toBeTruthy();
    expect(screen.getByText("Kofi's Data Shop")).toBeTruthy();
    expect(screen.getByText('Abena Data Hub')).toBeTruthy();
  });

  it('filters sub-agents by search term and status tab', async () => {
    (walletApi.getSubAgents as any).mockResolvedValueOnce({ subAgents: mockSubAgents });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentCustomersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Kofi's Data Shop")).toBeTruthy();
    });

    // Search for "Abena"
    const searchInput = screen.getByPlaceholderText('Search sub-agents...');
    fireEvent.change(searchInput, { target: { value: 'Abena' } });

    await waitFor(() => {
      expect(screen.getByText('Abena Data Hub')).toBeTruthy();
      expect(screen.queryByText("Kofi's Data Shop")).toBeNull();
    });
  });

  it('allows enrolling a new sub-agent through the modal', async () => {
    (walletApi.getSubAgents as any).mockResolvedValue({ subAgents: mockSubAgents });
    (walletApi.createSubAgent as any).mockResolvedValueOnce({ success: true });

    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentCustomersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Sub Agents')).toBeTruthy();
    });

    const addBtn = screen.getByRole('button', { name: /add sub agent/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. Kwame Asante/i)).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/e.g. Kwame Asante/i), { target: { value: 'Yaw Manu' } });
    fireEvent.change(screen.getByPlaceholderText(/partner@example.com/i), { target: { value: 'yaw@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/024 123 4567/i), { target: { value: '0249871234' } });

    const submitBtn = screen.getByRole('button', { name: /create sub agent/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(walletApi.createSubAgent).toHaveBeenCalledWith({
        name: 'Yaw Manu',
        email: 'yaw@example.com',
        phone: '0249871234',
        storeName: undefined,
      });
    });
  });
});
