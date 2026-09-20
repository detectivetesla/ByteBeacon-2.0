import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { SignInPage } from '../pages/auth/SignInPage.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/PlatformStatusContext.js', () => ({
  usePlatformStatus: () => ({ isMaintenanceMode: false, maintenanceMessage: '' }),
}));

vi.mock('../context/ToastContext.js', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('ForgotPasswordPage — Standard Formal Placeholder & Locked Pre-filled Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders standard and formal placeholder when opened without pre-filled email', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe('name@company.com or phone number');
    expect(input.value).toBe('');
    expect(input).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
  });

  it('automatically populates and locks the email when passed via query parameters from sign-in', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password?identifier=kofi%40bytebeacon.online']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('kofi@bytebeacon.online');
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText(/Locked for confirmation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Use different account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Account confirmed from your sign-in details/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Send Reset Link/i })).toBeInTheDocument();
  });

  it('keeps the input locked as read-only and does not give user the chance to edit or use different account', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password?email=ama%40example.com']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(input.value).toBe('ama@example.com');

    // Asserts that no edit button or switch account action is rendered
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Use different account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Locked for confirmation/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Send Reset Link/i })).toBeInTheDocument();
  });

  it('passes typed email from SignInPage to forgot-password link', () => {
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <SignInPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/Email Address or Phone Number/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'reseller@domain.gh' } });

    const forgotLink = screen.getByRole('link', { name: /Forgot password\?/i });
    expect(forgotLink).toHaveAttribute(
      'href',
      '/forgot-password?identifier=reseller%40domain.gh',
    );
  });
});
