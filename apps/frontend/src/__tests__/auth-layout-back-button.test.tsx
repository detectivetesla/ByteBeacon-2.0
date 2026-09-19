import React from 'react';
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

describe('AuthLayout — Go Back Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates directly to the landing page ("/") when Go Back button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/auth/sign-in']}>
        <AuthLayout title="Sign In" subtitle="Welcome back">
          <div>Form Content</div>
        </AuthLayout>
      </MemoryRouter>,
    );

    const goBackButton = screen.getByRole('button', { name: /Go Back to Landing Page/i });
    expect(goBackButton).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();

    fireEvent.click(goBackButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/');
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

