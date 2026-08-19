import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { SocialAuthButton } from '../../components/auth/SocialAuthButton.js';
import { Input, PasswordInput, Checkbox, Button } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
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
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      toastInfo('Google Sign In', 'Opening Google Authentication...');
      const data = await promptGoogleSignIn();

      if (data?.user && data?.tokens) {
        login(data.user, data.tokens);
        toastSuccess('Welcome to ByteBeacon!', `Signed in as ${data.user.fullName || data.user.email}`);

        const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/')) {
          navigate(returnUrl);
          return;
        }

        if (data.user.role === 'agent') {
          navigate('/agent');
        } else if (data.user.role === 'admin' || data.user.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/app/dashboard');
        }
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

        const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/')) {
          navigate(returnUrl);
          return;
        }

        if (data.user.role === 'agent') {
          navigate('/agent');
        } else if (data.user.role === 'admin' || data.user.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/app/dashboard');
        }
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: 'var(--space-4)' }}>
        <SocialAuthButton
          provider="google"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
        />
      </div>

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          margin: 'var(--space-3) 0 var(--space-4)',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-default)' }} />
        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Or sign in with email
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-default)' }} />
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <Checkbox
            label="Remember me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
          />

          <Link
            to="/forgot-password"
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
          style={{ marginTop: 'var(--space-2)' }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.4} />}
        >
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
};
