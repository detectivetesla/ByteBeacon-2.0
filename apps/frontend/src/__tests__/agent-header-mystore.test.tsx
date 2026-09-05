import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell.js';
import { AgentLayout } from '../layouts/AgentLayout.js';
import { AGENT_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { storesApi } from '../api/stores.api.js';

vi.mock('../api/stores.api.js', () => ({
  storesApi: {
    getStore: vi.fn(),
  },
}));

vi.mock('../hooks/useWalletBalance.js', () => ({
  useWalletBalance: () => ({ balancePesewas: 25000 }),
}));

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({ isMaintenanceMode: false, maintenanceMessage: '' }),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'agent-123', email: 'agent@bytebeacon.com', role: 'agent' },
    isAuthenticated: true,
    logout: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../auth/hooks/usePermissions.js', () => ({
  usePermissions: () => ({
    can: () => true,
    permissions: [],
  }),
}));

vi.mock('../context/PendingApprovalsContext.js', () => ({
  usePendingApprovals: () => ({
    pendingCount: 0,
    refreshPendingCount: vi.fn(),
  }),
  PendingApprovalsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/ThemeContext.js', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Agent Header My Store Link & Approval Gating', () => {
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

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('AppShell Component Direct Gating', () => {
    it('does NOT render My Store link when userRole is not agent', () => {
      render(
        <MemoryRouter>
          <AppShell
            portalTitle="ByteBeacon"
            portalSubtitle="Customer Portal"
            portalRoleBadge="CUSTOMER"
            navigationGroups={AGENT_NAVIGATION_GROUPS}
            userRole="customer"
            storeSlug="kwame-data"
            isStoreApproved={true}
          >
            <div>Content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByText(/My Store/i)).toBeNull();
    });

    it('does NOT render My Store link for agent when store is NOT approved', () => {
      render(
        <MemoryRouter>
          <AppShell
            portalTitle="ByteBeacon"
            portalSubtitle="Agent Operations"
            portalRoleBadge="RESELLER PARTNER"
            navigationGroups={AGENT_NAVIGATION_GROUPS}
            userRole="agent"
            storeSlug="kwame-data"
            isStoreApproved={false}
          >
            <div>Content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByText(/My Store/i)).toBeNull();
    });

    it('does NOT render My Store link for agent when storeSlug is missing or empty even if approved', () => {
      render(
        <MemoryRouter>
          <AppShell
            portalTitle="ByteBeacon"
            portalSubtitle="Agent Operations"
            portalRoleBadge="RESELLER PARTNER"
            navigationGroups={AGENT_NAVIGATION_GROUPS}
            userRole="agent"
            storeSlug=""
            isStoreApproved={true}
          >
            <div>Content</div>
          </AppShell>
        </MemoryRouter>,
      );

      expect(screen.queryByText(/My Store/i)).toBeNull();
    });

    it('RENDERS My Store link for agent when store setup IS approved with valid slug', () => {
      render(
        <MemoryRouter>
          <AppShell
            portalTitle="ByteBeacon"
            portalSubtitle="Agent Operations"
            portalRoleBadge="RESELLER PARTNER"
            navigationGroups={AGENT_NAVIGATION_GROUPS}
            userRole="agent"
            storeSlug="kwame-data"
            isStoreApproved={true}
          >
            <div>Content</div>
          </AppShell>
        </MemoryRouter>,
      );

      const storeLink = screen.getByRole('link', { name: /My Store/i });
      expect(storeLink).toBeInTheDocument();
      // Verifies it points to the agent's actual storefront, not a random external site
      expect(storeLink.getAttribute('href')).toBe(`${window.location.origin}/store/kwame-data`);
      expect(storeLink.getAttribute('target')).toBe('_blank');
      expect(storeLink.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('copies the exact storefront URL to clipboard on copy button click', async () => {
      render(
        <MemoryRouter>
          <AppShell
            portalTitle="ByteBeacon"
            portalSubtitle="Agent Operations"
            portalRoleBadge="RESELLER PARTNER"
            navigationGroups={AGENT_NAVIGATION_GROUPS}
            userRole="agent"
            storeSlug="kwame-data"
            isStoreApproved={true}
          >
            <div>Content</div>
          </AppShell>
        </MemoryRouter>,
      );

      const copyBtn = screen.getByRole('button', { name: /Copy Storefront Link/i });
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/store/kwame-data`,
      );
    });
  });

  describe('AgentLayout Integration & storesApi Lifecycle', () => {
    it('does NOT show My Store link when store approvalStatus is AWAITING_APPROVAL', async () => {
      vi.mocked(storesApi.getStore).mockResolvedValueOnce({
        id: 'str_1',
        userId: 'usr_1',
        storeName: 'Kwame Express Data',
        slug: 'kwame-data',
        approvalStatus: 'AWAITING_APPROVAL',
        paymentStatus: 'PAID',
        storeStatus: 'INACTIVE',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <MemoryRouter>
          <AgentLayout />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(storesApi.getStore).toHaveBeenCalled();
      });

      expect(screen.queryByText(/My Store/i)).toBeNull();
    });

    it('does NOT show My Store link when store approvalStatus is NOT_SUBMITTED', async () => {
      vi.mocked(storesApi.getStore).mockResolvedValueOnce({
        id: 'str_1',
        userId: 'usr_1',
        storeName: 'Kwame Express Data',
        slug: 'kwame-data',
        approvalStatus: 'NOT_SUBMITTED',
        paymentStatus: 'NOT_STARTED',
        storeStatus: 'NOT_STARTED',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <MemoryRouter>
          <AgentLayout />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(storesApi.getStore).toHaveBeenCalled();
      });

      expect(screen.queryByText(/My Store/i)).toBeNull();
    });

    it('SHOWS My Store link once store approvalStatus is APPROVED', async () => {
      vi.mocked(storesApi.getStore).mockResolvedValueOnce({
        id: 'str_1',
        userId: 'usr_1',
        storeName: 'Kwame Express Data',
        slug: 'kwame-data',
        approvalStatus: 'APPROVED',
        paymentStatus: 'PAID',
        storeStatus: 'ACTIVE',
        primaryColor: '#0066FF',
        accentColor: '#10B981',
        activationFeePesewas: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <MemoryRouter>
          <AgentLayout />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const storeLink = screen.getByRole('link', { name: /My Store/i });
        expect(storeLink).toBeInTheDocument();
        expect(storeLink.getAttribute('href')).toBe(`${window.location.origin}/store/kwame-data`);
      });
    });
  });
});
