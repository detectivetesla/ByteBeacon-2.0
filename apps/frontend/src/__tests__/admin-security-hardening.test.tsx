import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRouteGuard } from '../auth/guards/AdminRouteGuard.js';
import { AdminSignInPage } from '../pages/auth/AdminSignInPage.js';
import { authApi } from '../api/auth.api.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';

// Mock contexts
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
let mockCurrentUser: any = null;
let mockIsAuthenticated = false;
let mockIsLoading = false;
const mockLogin = vi.fn();

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    login: mockLogin,
  }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock('../api/auth.api.js', () => ({
  authApi: {
    adminLogin: vi.fn(),
    adminMfaVerify: vi.fn(),
  },
}));

describe('Admin Security Hardening & Gatekeeper Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    mockIsAuthenticated = false;
    mockIsLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. AdminRouteGuard Access Control & Stealth Protection', () => {
    it('1.1 redirects unauthenticated users to /admin-auth/login gateway with returnUrl', async () => {
      mockIsAuthenticated = false;
      mockCurrentUser = null;

      render(
        <MemoryRouter initialEntries={['/admin/overview']}>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <AdminRouteGuard>
                  <div>Secret Admin Dashboard</div>
                </AdminRouteGuard>
              }
            />
            <Route path="/admin-auth/login" element={<div>Admin Gateway Login Page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.queryByText('Secret Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.getByText('Admin Gateway Login Page')).toBeInTheDocument();
    });

    it('1.2 renders stealth 404 lockout screen when stealthMode is enabled for unauthenticated visitors', async () => {
      mockIsAuthenticated = false;
      mockCurrentUser = null;

      render(
        <MemoryRouter initialEntries={['/admin/users']}>
          <AdminRouteGuard stealthMode={true}>
            <div>Secret User Directory</div>
          </AdminRouteGuard>
        </MemoryRouter>,
      );

      expect(screen.queryByText('Secret User Directory')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-stealth-lockout')).toBeInTheDocument();
      expect(screen.getByText(/404 — Access Restricted/i)).toBeInTheDocument();
    });

    it('1.3 locks out standard customer accounts and prevents unauthorized admin access', async () => {
      mockIsAuthenticated = true;
      mockCurrentUser = {
        id: 'usr_cust_1',
        email: 'customer@gmail.com',
        role: UserRole.CUSTOMER,
        securityDomain: SecurityDomain.CUSTOMER,
      };

      render(
        <MemoryRouter initialEntries={['/admin/overview']}>
          <AdminRouteGuard>
            <div>Secret Admin Dashboard</div>
          </AdminRouteGuard>
        </MemoryRouter>,
      );

      expect(screen.queryByText('Secret Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-unauthorized-lockout')).toBeInTheDocument();
      expect(screen.getByText(/Administrative Privileges Required/i)).toBeInTheDocument();
      expect(screen.getByText(/customer@gmail.com/i)).toBeInTheDocument();
    });

    it('1.4 locks out agent accounts and blocks admin link access', async () => {
      mockIsAuthenticated = true;
      mockCurrentUser = {
        id: 'usr_agent_1',
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        securityDomain: SecurityDomain.AGENT,
      };

      render(
        <MemoryRouter initialEntries={['/admin/orders']}>
          <AdminRouteGuard>
            <div>Confidential Platform Orders</div>
          </AdminRouteGuard>
        </MemoryRouter>,
      );

      expect(screen.queryByText('Confidential Platform Orders')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-unauthorized-lockout')).toBeInTheDocument();
      expect(screen.getByText(/Role: AGENT/i)).toBeInTheDocument();
    });

    it('1.5 permits authorized super_admin and admin users into protected routes', async () => {
      mockIsAuthenticated = true;
      mockCurrentUser = {
        id: 'usr_admin_1',
        email: 'superadmin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        securityDomain: SecurityDomain.ADMIN,
      };

      render(
        <MemoryRouter initialEntries={['/admin/overview']}>
          <AdminRouteGuard>
            <div>Secret Admin Dashboard</div>
          </AdminRouteGuard>
        </MemoryRouter>,
      );

      expect(screen.getByText('Secret Admin Dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-unauthorized-lockout')).not.toBeInTheDocument();
    });
  });

  describe('2. Dedicated AdminSignInPage Security Gateway', () => {
    it('2.1 renders high-security admin gateway with audit compliance warning', async () => {
      render(
        <MemoryRouter>
          <AdminSignInPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Admin Security Gateway')).toBeInTheDocument();
      expect(screen.getByText('Central Control Plane')).toBeInTheDocument();
      expect(
        screen.getByText(/All session interactions, source IPs, and clearances are cryptographically logged/i),
      ).toBeInTheDocument();
    });

    it('2.2 successfully submits admin credentials and logs into control center', async () => {
      (authApi.adminLogin as any).mockResolvedValueOnce({
        user: {
          id: 'usr_admin_99',
          email: 'admin@bytebeacon.com',
          fullName: 'Chief Administrator',
          role: UserRole.ADMIN,
          securityDomain: SecurityDomain.ADMIN,
        },
        tokens: {
          accessToken: 'admin_jwt_token',
          refreshToken: 'admin_refresh_token',
          expiresIn: 3600,
        },
      });

      render(
        <MemoryRouter initialEntries={['/admin-auth/login']}>
          <Routes>
            <Route path="/admin-auth/login" element={<AdminSignInPage />} />
            <Route path="/admin/overview" element={<div>Admin Control Center</div>} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Admin Identity/i), {
        target: { value: 'admin@bytebeacon.com' },
      });
      fireEvent.change(screen.getByLabelText(/Master Passkey/i), {
        target: { value: 'MasterPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Authenticate Clearance/i }));

      await waitFor(() => {
        expect(authApi.adminLogin).toHaveBeenCalledWith({
          email: 'admin@bytebeacon.com',
          password: 'MasterPassword123!',
        });
        expect(mockLogin).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'admin@bytebeacon.com' }),
          expect.objectContaining({ accessToken: 'admin_jwt_token' }),
        );
        expect(mockToastSuccess).toHaveBeenCalledWith('Access Granted', expect.any(String));
      });
    });

    it('2.3 presents 2FA TOTP prompt and handles MFA verification challenge', async () => {
      // Step 1: Credentials require MFA challenge
      (authApi.adminLogin as any).mockResolvedValueOnce({
        mfaRequired: true,
        mfaSessionToken: 'mfa_session_token_xyz',
      });

      // Step 2: MFA verification returns session
      (authApi.adminMfaVerify as any).mockResolvedValueOnce({
        user: {
          id: 'usr_admin_99',
          email: 'superadmin@bytebeacon.com',
          role: UserRole.SUPER_ADMIN,
          securityDomain: SecurityDomain.ADMIN,
        },
        tokens: {
          accessToken: 'admin_jwt_token_mfa',
          refreshToken: 'admin_refresh_token_mfa',
          expiresIn: 3600,
        },
      });

      render(
        <MemoryRouter initialEntries={['/admin-auth/login']}>
          <Routes>
            <Route path="/admin-auth/login" element={<AdminSignInPage />} />
            <Route path="/admin/overview" element={<div>Admin Control Center</div>} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Admin Identity/i), {
        target: { value: 'superadmin@bytebeacon.com' },
      });
      fireEvent.change(screen.getByLabelText(/Master Passkey/i), {
        target: { value: 'SuperSecret123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Authenticate Clearance/i }));

      // Expect MFA challenge view to render
      await waitFor(() => {
        expect(screen.getByText('Two-Factor Verification')).toBeInTheDocument();
        expect(screen.getByLabelText(/6-Digit Authenticator Code/i)).toBeInTheDocument();
      });

      // Enter 6-digit TOTP
      fireEvent.change(screen.getByLabelText(/6-Digit Authenticator Code/i), {
        target: { value: '654321' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Verify Code/i }));

      await waitFor(() => {
        expect(authApi.adminMfaVerify).toHaveBeenCalledWith({
          mfaSessionToken: 'mfa_session_token_xyz',
          totpCode: '654321',
        });
        expect(mockLogin).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith('MFA Clearance Approved', expect.any(String));
      });
    });

    it('2.4 displays authentication denial error on invalid credentials', async () => {
      (authApi.adminLogin as any).mockRejectedValueOnce(
        new Error('Invalid administrator credentials or access restricted.'),
      );

      render(
        <MemoryRouter>
          <AdminSignInPage />
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Admin Identity/i), {
        target: { value: 'intruder@unknown.com' },
      });
      fireEvent.change(screen.getByLabelText(/Master Passkey/i), {
        target: { value: 'WrongPassword' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Authenticate Clearance/i }));

      await waitFor(() => {
        expect(screen.getByTestId('admin-login-error')).toBeInTheDocument();
        expect(mockToastError).toHaveBeenCalledWith('Authentication Denied', expect.any(String));
      });
    });
  });
});
