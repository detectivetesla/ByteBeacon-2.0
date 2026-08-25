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

  it('renders To Be Announced announcement state when feature is unannounced', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentCustomersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sub Agents')).toBeTruthy();
    expect(screen.getByText('To Be Announced')).toBeTruthy();
    expect(screen.getByText('Sub-Agent Multi-Tier Reseller System')).toBeTruthy();
    expect(screen.getByText('Partner Onboarding')).toBeTruthy();
    expect(screen.getByText('Automated Overrides')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Notify Me On Launch/i })).toBeTruthy();

    const notifyBtn = screen.getByRole('button', { name: /Notify Me On Launch/i });
    fireEvent.click(notifyBtn);
  });
});
