import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { SocialAuthButton } from '../../components/auth/SocialAuthButton.js';
import { Input, PasswordInput, Checkbox, Button } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { authApi } from '../../api/auth.api.js';
import { promptGoogleSignIn } from '../../utils/googleAuth.js';
import { ArrowRight, Mail } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  const { login } = useAuth();
  const { isMaintenanceMode } = usePlatformStatus();
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();
  const navigate = useNavigate();

  const navigateAfterAuth = (authUser: any) => {
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
    if (returnUrl && returnUrl.startsWith('/')) {
      navigate(returnUrl);
      return;
    }
    const role = (authUser?.role || '').toLowerCase().trim();
    if (role === 'agent' || authUser?.securityDomain === 'AGENT') {
      navigate('/agent');
    } else if (role === 'admin' || role === 'super_admin' || authUser?.securityDomain === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/app/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isMaintenanceMode) {
      toastError('Maintenance Mode Active', 'Google sign-in is disabled during scheduled maintenance. Administrators may sign in below with credentials.');
      return;
    }

    setIsGoogleLoading(true);
    try {
      toastInfo('Google Sign In', 'Opening Google Authentication...');
      const data = await promptGoogleSignIn();

      if (data?.user && data?.tokens) {
        login(data.user, data.tokens);
        toastSuccess('Welcome to ByteBeacon!', `Signed in as ${data.user.fullName || data.user.email}`);
        navigateAfterAuth(data.user);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        toastError('Google Sign-In', err.message || 'Unable to complete Google sign-in.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side validation
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email or phone number is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const data = await authApi.login({ identifier: identifier.trim(), password });

      if (data?.user && data?.tokens) {
        login(data.user, data.tokens);
        toastSuccess('Welcome back!', `Signed in as ${data.user.fullName || data.user.email}`);
        navigateAfterAuth(data.user);
      }
    } catch (err: any) {
      toastError('Sign in failed', err.message || 'Unable to sign in right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back to ByteBeacon!"
      subtitle="Please enter your details to sign in your account"
      visualTitle="One Platform to Streamline All Mobile Data Delivery"
      visualSubtitle="Instant multi-network fulfillment, live tracking, and verified Mobile Money payments across Ghana."
      topActionText="Don't have an account?"
      topActionLinkText="Sign Up"
      topActionHref="/signup"
    >
      {/* Social Fast-Auth Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
        <SocialAuthButton
          provider="google"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isMaintenanceMode}
        />
        {isMaintenanceMode && (
          <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Google Sign-In is disabled during scheduled maintenance.
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '1.25rem 0 1.25rem',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-default)' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          Or sign in with email
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-default)' }} />
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
        {/* Email or Phone Input */}
        <Input
          id="signin-identifier"
          label="Email Address or Phone Number"
          type="text"
          placeholder="Enter your email or phone number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
          disabled={isLoading}
          leftIcon={<Mail size={15} color="var(--color-text-muted)" />}
          autoComplete="username"
          required
        />

        {/* Password Input */}
        <PasswordInput
          id="signin-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          error={fieldErrors.password}
          disabled={isLoading}
          required
        />

        {/* Remember Me & Forgot Password Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            marginTop: '0.125rem',
          }}
        >
          <Checkbox
            label="Remember me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
          />

          <Link
            to={identifier.trim() ? `/forgot-password?identifier=${encodeURIComponent(identifier.trim())}` : '/forgot-password'}
            state={{ identifier: identifier.trim() }}
            onClick={() => {
              if (identifier.trim()) {
                try {
                  sessionStorage.setItem('bytebeacon_pending_reset_identifier', identifier.trim());
                } catch {
                  // ignore
                }
              }
            }}
            style={{
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          style={{ marginTop: '1.25rem', minHeight: '48px', fontSize: '0.9375rem', fontWeight: 700 }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.4} />}
        >
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
};
