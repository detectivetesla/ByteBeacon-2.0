import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NetworkProvider } from '@bytebeacon/shared';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { PlatformStatusProvider, usePlatformStatus } from '../context/PlatformStatusContext.js';
import { AuthProvider } from '../context/AuthContext.js';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { ToastProvider } from '../context/ToastContext.js';
import { apiClient } from '../api/httpClient.js';

describe('Frontend Maintenance Mode Integration & UI Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('MaintenanceBanner renders correctly with custom message when active and hides when inactive', () => {
    const { rerender } = render(<MaintenanceBanner isMaintenanceMode={false} />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <MaintenanceBanner
        isMaintenanceMode={true}
        message="System upgrade in progress. Checkouts temporarily queued."
      />,
    );

    const banner = screen.getByRole('alert');
    expect(banner).toBeTruthy();
    expect(screen.getByText(/System upgrade in progress/i)).toBeTruthy();
  });

  it('PlatformStatusProvider fetches and supplies maintenance status to consumers', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Scheduled Platform Maintenance: Fulfillment Paused',
    } as any);

    const TestConsumer: React.FC = () => {
      const { isMaintenanceMode, platformStatus, maintenanceMessage } = usePlatformStatus();
      return (
        <div>
          <div data-testid="status">{platformStatus}</div>
          <div data-testid="is-maintenance">{String(isMaintenanceMode)}</div>
          <div data-testid="msg">{maintenanceMessage}</div>
        </div>
      );
    };

    render(
      <PlatformStatusProvider>
        <TestConsumer />
      </PlatformStatusProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('MAINTENANCE');
      expect(screen.getByTestId('is-maintenance').textContent).toBe('true');
      expect(screen.getByTestId('msg').textContent).toContain('Scheduled Platform Maintenance');
    });
  });

  it('PurchaseModal renders maintenance alert and disables checkout buttons when maintenance mode is active', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Telecom network maintenance active.',
    } as any);

    render(
      <BrowserRouter>
        <ToastProvider>
          <PlatformStatusProvider>
            <PurchaseModal
              isOpen={true}
              onClose={() => {}}
              initialNetwork={NetworkProvider.MTN}
              initialRecipientPhone="0241234567"
            />
          </PlatformStatusProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Scheduled Maintenance in Progress/i)).toBeTruthy();
      const button = screen.getByRole('button', { name: /Platform in Maintenance/i });
      expect(button).toBeTruthy();
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    cleanup();
  });

  it('BuyDataPage renders in-page maintenance banner and disables single order button when active', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Platform order fulfillment and checkout operations are temporarily paused for maintenance.',
    } as any);

    const { BuyDataPage } = await import('../pages/customer/BuyDataPage.js');

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
      expect(screen.getByText(/Platform Maintenance Active — Checkout Operations Paused/i)).toBeTruthy();
      const buyButton = screen.getByRole('button', { name: /Platform in Maintenance/i });
      expect(buyButton).toBeTruthy();
      expect(buyButton.hasAttribute('disabled')).toBe(true);
    });

    cleanup();
  });

  it('WalletPage renders maintenance warning and disables top-up checkout', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/platform/status')) {
        return {
          isMaintenanceMode: true,
          platformStatus: 'MAINTENANCE',
          message: 'Wallet deposits paused for system maintenance.',
        };
      }
      if (url.includes('/wallet/balance')) {
        return { balanceGhs: 50.0, balancePesewas: 5000 };
      }
      if (url.includes('/wallet/transactions')) {
        return { transactions: [] };
      }
      return {};
    });

    const { WalletPage } = await import('../pages/customer/WalletPage.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <WalletPage />
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Platform Maintenance Active — Deposits Temporarily Paused/i)).toBeTruthy();
    });

    cleanup();
  });

  it('AuthLayout and SignInPage display maintenance alert and disable Google authentication', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Scheduled server maintenance in progress.',
    } as any);

    const { SignInPage } = await import('../pages/auth/SignInPage.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <SignInPage />
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      // Maintenance alert banner in AuthLayout
      const alert = screen.getByTestId('auth-maintenance-alert');
      expect(alert).toBeTruthy();
      expect(screen.getByText(/Scheduled Maintenance in Progress/i)).toBeTruthy();
      expect(screen.getByText(/Administrator sign-in remains active/i)).toBeTruthy();

      // Google Sign-in button is disabled
      const googleBtn = screen.getByTestId('social-auth-google');
      expect(googleBtn.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText(/Google Sign-In is disabled during scheduled maintenance/i)).toBeTruthy();
    });

    cleanup();
  });

  it('SignUpPage disables registration and Google auth during maintenance mode', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Registrations temporarily paused.',
    } as any);

    const { SignUpPage } = await import('../pages/auth/SignUpPage.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <SignUpPage />
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-maintenance-alert')).toBeTruthy();
      const submitBtn = screen.getByRole('button', { name: /Registration Paused/i });
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
      const googleBtn = screen.getByTestId('social-auth-google');
      expect(googleBtn.hasAttribute('disabled')).toBe(true);
    });

    cleanup();
  });

  it('StoreLoginPage displays maintenance alert and disables portal login during maintenance mode', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Store portal offline for maintenance.',
    } as any);

    const { StoreLoginPage } = await import('../pages/store/StoreLoginPage.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <StoreLoginPage />
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const storeAlert = screen.getByTestId('store-maintenance-alert');
      expect(storeAlert).toBeTruthy();
      const submitBtn = screen.getByRole('button', { name: /Portal Offline/i });
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
    });

    cleanup();
  });

  it('ProtectedRoute displays full-screen lockout view for customer sessions during maintenance', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Core systems offline.',
    } as any);

    // Mock localStorage auth user as customer
    localStorage.setItem(
      'bytebeacon_auth_user',
      JSON.stringify({
        id: 'cust-123',
        email: 'customer@example.com',
        role: 'customer',
        fullName: 'Customer Test',
      }),
    );
    localStorage.setItem(
      'bytebeacon_auth_tokens',
      JSON.stringify({
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
      }),
    );

    const { ProtectedRoute } = await import('../auth/guards/ProtectedRoute.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <ProtectedRoute>
                <div data-testid="protected-content">Secret Customer Dashboard</div>
              </ProtectedRoute>
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('maintenance-lockout-screen')).toBeTruthy();
      expect(screen.getByText(/System Temporarily Inaccessible/i)).toBeTruthy();
      expect(screen.getByText(/Platform Maintenance Mode Active/i)).toBeTruthy();
    });

    localStorage.clear();
    cleanup();
  });

  it('ProtectedRoute permits admin access during maintenance mode', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      isMaintenanceMode: true,
      platformStatus: 'MAINTENANCE',
      message: 'Core systems offline.',
    } as any);

    // Mock localStorage auth user as admin
    localStorage.setItem(
      'bytebeacon_auth_user',
      JSON.stringify({
        id: 'admin-123',
        email: 'admin@bytebeacon.com',
        role: 'admin',
        fullName: 'Admin User',
      }),
    );
    localStorage.setItem(
      'bytebeacon_auth_tokens',
      JSON.stringify({
        accessToken: 'valid-admin-token',
        refreshToken: 'valid-admin-refresh',
      }),
    );

    const { ProtectedRoute } = await import('../auth/guards/ProtectedRoute.js');

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PlatformStatusProvider>
              <ProtectedRoute>
                <div data-testid="admin-content">Admin Dashboard Content</div>
              </ProtectedRoute>
            </PlatformStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeTruthy();
      expect(screen.queryByTestId('maintenance-lockout-screen')).toBeNull();
    });

    localStorage.clear();
    cleanup();
  });
});
