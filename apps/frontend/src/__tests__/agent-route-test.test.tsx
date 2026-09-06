import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { routes } from '../routes/index.js';
import { ThemeProvider } from '../context/ThemeContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { ErrorBoundary } from '../components/common/ErrorBoundary.js';
import { useAuth } from '../context/AuthContext.js';

vi.mock('../context/AuthContext.js', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'usr_agent_1', email: 'agent@bytebeacon.com', fullName: 'Kwame Agent', role: 'agent' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    login: vi.fn(),
    updateUser: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({ isMaintenanceMode: false, maintenanceMessage: '', refetch: vi.fn() }),
  PlatformStatusProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/PendingApprovalsContext.js', () => ({
  usePendingApprovals: () => ({ pendingCount: 0, refreshPendingCount: vi.fn() }),
  PendingApprovalsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../hooks/useWalletBalance.js', () => ({
  useWalletBalance: () => ({ balancePesewas: 50000, balanceGhs: 500.0 }),
}));

vi.mock('../api/orders.api.js', () => ({
  ordersApi: {
    listAgentOrders: vi.fn().mockResolvedValue({ orders: [] }),
  },
}));

vi.mock('../api/wallet.api.js', () => ({
  walletApi: {
    getTransactions: vi.fn().mockResolvedValue({ transactions: [] }),
  },
  notificationsApi: {
    listNotifications: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    getNotifications: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    getCounts: vi.fn().mockResolvedValue({ total: 0, unread: 0 }),
    markAllAsRead: vi.fn().mockResolvedValue({}),
    clearNotifications: vi.fn().mockResolvedValue({}),
    markAsRead: vi.fn().mockResolvedValue({}),
    deleteNotification: vi.fn().mockResolvedValue({}),
  },
  analyticsApi: {
    getRevenueTrend: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../api/stores.api.js', () => ({
  storesApi: {
    getStore: vi.fn().mockResolvedValue(null),
  },
}));

const AppRoutes = () => {
  return useRoutes(routes);
};

describe('Route /agent navigation and rendering', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders correctly when navigating to /agent and redirects to dashboard', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/agent']}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Store Dashboard/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Reseller/i).length).toBeGreaterThan(0);
    });
  });

  it('handles uppercase role "AGENT" seamlessly without redirecting to unauthorized', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'usr_agent_upper', email: 'agent@bytebeacon.com', fullName: 'Kwame Agent Upper', role: 'AGENT' } as any,
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      login: vi.fn(),
      updateUser: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/agent']}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Store Dashboard/i)).toBeTruthy();
      expect(screen.queryByText(/Unauthorized/i)).toBeNull();
    });
  });

  it('renders ErrorBoundary fallback instead of blank page when child throws', () => {
    const ProblematicChild = () => {
      throw new Error('Test fatal crash');
    };

    // Suppress console.error in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblematicChild />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
