import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell.js';
import { CUSTOMER_NAVIGATION_GROUPS, AGENT_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { PendingApprovalsProvider } from '../context/PendingApprovalsContext.js';
import { AuthProvider } from '../context/AuthContext.js';
import { ThemeProvider } from '../context/ThemeContext.js';
import { beneficiaryApi } from '../api/beneficiary.api.js';

vi.mock('../api/beneficiary.api.js', () => ({
  beneficiaryApi: {
    getPendingCount: vi.fn(),
    listApprovals: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../api/httpClient.js', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'agent-123', email: 'agent@bytebeacon.com', role: 'agent' },
    isAuthenticated: true,
    logout: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../auth/hooks/usePermissions.js', () => ({
  usePermissions: () => ({
    can: () => true,
    permissions: [],
  }),
}));

describe('Real-time Pending MTN Order Badge in Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('fetches pending approvals count and displays real-time badge on Pending MTN Approvals nav item', async () => {
    (beneficiaryApi.getPendingCount as any).mockResolvedValueOnce({ pendingCount: 5 });

    render(
      <MemoryRouter initialEntries={['/agent/dashboard']}>
        <ThemeProvider>
          <AuthProvider>
            <PendingApprovalsProvider>
              <AppShell
                portalTitle="ByteBeacon"
                portalSubtitle="Agent Operations"
                portalRoleBadge="AGENT"
                navigationGroups={AGENT_NAVIGATION_GROUPS}
                userRole="agent"
              >
                <div>Dashboard Content</div>
              </AppShell>
            </PendingApprovalsProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(beneficiaryApi.getPendingCount).toHaveBeenCalled();
    });

    await waitFor(() => {
      const badge = screen.getByTestId('pending-mtn-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('5');
      const dot = screen.getByTestId('pending-mtn-dot');
      expect(dot).toBeTruthy();
    });
  });

  it('updates badge in real time when pending-approvals-updated event is dispatched', async () => {
    (beneficiaryApi.getPendingCount as any)
      .mockResolvedValueOnce({ pendingCount: 3 })
      .mockResolvedValueOnce({ pendingCount: 0 });

    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <ThemeProvider>
          <AuthProvider>
            <PendingApprovalsProvider>
              <AppShell
                portalTitle="ByteBeacon"
                portalSubtitle="Customer Portal"
                portalRoleBadge="CUSTOMER"
                navigationGroups={CUSTOMER_NAVIGATION_GROUPS}
                userRole="customer"
              >
                <div>Customer Dashboard</div>
              </AppShell>
            </PendingApprovalsProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const badge = screen.getByTestId('pending-mtn-badge');
      expect(badge.textContent).toContain('3');
    });

    // Trigger real-time event when approvals are cleared
    act(() => {
      window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('pending-mtn-badge')).toBeNull();
      expect(screen.queryByTestId('pending-mtn-dot')).toBeNull();
    });
  });

  it('caps large pending numbers cleanly as 99+', async () => {
    (beneficiaryApi.getPendingCount as any).mockResolvedValueOnce({ pendingCount: 150 });

    render(
      <MemoryRouter initialEntries={['/agent/dashboard']}>
        <ThemeProvider>
          <AuthProvider>
            <PendingApprovalsProvider>
              <AppShell
                portalTitle="ByteBeacon"
                portalSubtitle="Agent Operations"
                portalRoleBadge="AGENT"
                navigationGroups={AGENT_NAVIGATION_GROUPS}
                userRole="agent"
              >
                <div>Dashboard Content</div>
              </AppShell>
            </PendingApprovalsProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const badge = screen.getByTestId('pending-mtn-badge');
      expect(badge.textContent).toContain('99+');
    });
  });
});
