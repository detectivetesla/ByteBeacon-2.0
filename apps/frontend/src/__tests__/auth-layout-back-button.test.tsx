import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout.js';

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

import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage.js';
import { SignUpPage } from '../pages/auth/SignUpPage.js';
import { AgentSignUpPage } from '../pages/auth/AgentSignUpPage.js';

describe('AuthLayout — Go Back Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates directly to the landing page ("/") when Go Back button is clicked on standard auth page', () => {
    render(
      <MemoryRouter initialEntries={['/auth/sign-in']}>
        <AuthLayout title="Sign In" subtitle="Welcome back">
          <div>Form Content</div>
        </AuthLayout>
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to "/signin" when Go Back button is clicked on "Account Security & Access Recovery" pages', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AuthLayout
          title="Reset your password"
          visualTitle="Account Security & Access Recovery"
        >
          <div>Reset form</div>
        </AuthLayout>
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/signin');
  });

  it('navigates to explicit backHref if provided', () => {
    render(
      <MemoryRouter initialEntries={['/custom-auth']}>
        <AuthLayout
          title="Custom Page"
          backHref="/custom-target"
        >
          <div>Custom Content</div>
        </AuthLayout>
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/custom-target');
  });

  it('navigates to "/signin" when Go Back is clicked on ForgotPasswordPage', () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledWith('/signin');
  });

  it('navigates to "/signin" when Go Back is clicked on ResetPasswordPage', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=test-token']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledWith('/signin');
  });

  it('navigates to "/signin" when Go Back is clicked on SignUpPage', () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignUpPage />
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledWith('/signin');
  });

  it('navigates to "/signin" when Go Back is clicked on AgentSignUpPage', () => {
    render(
      <MemoryRouter initialEntries={['/agent/signup']}>
        <AgentSignUpPage />
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back/i });
    expect(goBackButton).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledWith('/signin');
  });

  it('renders top switcher link in responsive switcher containers', () => {
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <AuthLayout
          title="Welcome back to ByteBeacon!"
          subtitle="Please enter your details to sign in your account"
          topActionText="Don't have an account?"
          topActionLinkText="Sign Up"
          topActionHref="/signup"
        >
          <div>Form Content</div>
        </AuthLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Welcome back to ByteBeacon!/i)).toBeInTheDocument();
    expect(screen.getByText(/Please enter your details to sign in your account/i)).toBeInTheDocument();

    const signUpLinks = screen.getAllByRole('link', { name: /Sign Up/i });
    expect(signUpLinks.length).toBeGreaterThanOrEqual(1);
    expect(signUpLinks[0]).toHaveAttribute('href', '/signup');
  });
});

