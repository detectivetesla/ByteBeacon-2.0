import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { authApi } from '../../api/auth.api.js';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  ArrowRight,
  Terminal,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../../components/ui/Button/Button.js';

export const AdminSignInPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // MFA Challenge State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSessionToken, setMfaSessionToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);

  const { login } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const getReturnUrl = () => {
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get('returnUrl');
    if (returnUrl && returnUrl.startsWith('/admin')) {
      return returnUrl;
    }
    return '/admin/overview';
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Administrator email is required.');
      return;
    }
    if (!password) {
      setErrorMessage('Master password is required.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.adminLogin({
        email: email.trim(),
        password,
      });

      // Case 1: 2FA MFA Challenge Required
      if ('mfaRequired' in response && response.mfaRequired) {
        setMfaRequired(true);
        setMfaSessionToken(response.mfaSessionToken);
        toastSuccess('Identity Confirmed', 'Please enter your two-factor authenticator code.');
        return;
      }

      // Case 2: Direct Authentication Success
      if ('user' in response && 'tokens' in response) {
        login(response.user, response.tokens);
        toastSuccess(
          'Access Granted',
          `Welcome to ByteBeacon Control Center, ${response.user.fullName || response.user.email}.`,
        );
        navigate(getReturnUrl(), { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Invalid administrator credentials or access restricted.';
      setErrorMessage(msg);
      toastError('Authentication Denied', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!totpCode.trim() || totpCode.trim().length < 6) {
      setErrorMessage('A valid 6-digit TOTP authenticator code is required.');
      return;
    }

    setIsMfaLoading(true);

    try {
      const response = await authApi.adminMfaVerify({
        mfaSessionToken,
        totpCode: totpCode.trim(),
      });

      if (response?.user && response?.tokens) {
        login(response.user, response.tokens);
        toastSuccess('MFA Clearance Approved', `Authenticated as ${response.user.role?.toUpperCase()}.`);
        navigate(getReturnUrl(), { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Invalid two-factor authentication code.';
      setErrorMessage(msg);
      toastError('MFA Verification Failed', msg);
    } finally {
      setIsMfaLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#070A11',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14, 165, 233, 0.15), transparent 70%),
          radial-gradient(ellipse 60% 40% at 50% 120%, rgba(99, 102, 241, 0.1), transparent 70%)
        `,
        padding: 'var(--space-6)',
        fontFamily: 'var(--font-sans)',
        color: '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Grid Accent */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Gateway Card */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(51, 65, 85, 0.6)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-8)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2))',
                border: '1px solid rgba(14, 165, 233, 0.4)',
                color: '#38BDF8',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 0 20px rgba(14, 165, 233, 0.25)',
              }}
            >
              <ShieldCheck size={28} strokeWidth={2.4} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.2rem 0.625rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#38BDF8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
              }}
            >
              <Terminal size={12} />
              Central Control Plane
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                margin: '0 0 0.25rem 0',
                color: '#F8FAFC',
              }}
            >
              Admin Security Gateway
            </h1>
            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: 0 }}>
              Authorized administrative personnel only
            </p>
          </div>

          {/* Security Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.75rem',
              color: '#FCA5A5',
              lineHeight: 1.4,
              marginBottom: 'var(--space-6)',
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#EF4444' }} />
            <span>
              All session interactions, source IPs, and clearances are cryptographically logged for audit compliance.
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              data-testid="admin-login-error"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#FCA5A5',
                fontSize: '0.8125rem',
                marginBottom: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Form Step 1: Initial Credentials */}
          {!mfaRequired ? (
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label
                  htmlFor="admin-email"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#CBD5E1',
                    marginBottom: '0.375rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Admin Identity
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bytebeacon.com"
                  autoComplete="username"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#CBD5E1',
                    marginBottom: '0.375rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Master Passkey
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.75rem 2.5rem 0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid #334155',
                      color: '#F8FAFC',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                style={{
                  marginTop: 'var(--space-2)',
                  minHeight: '46px',
                  width: '100%',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
                  boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                }}
              >
                Authenticate Clearance <ArrowRight size={16} />
              </Button>
            </form>
          ) : (
            /* Form Step 2: Two-Factor TOTP Challenge */
            <form onSubmit={handleMfaVerify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#EAB308',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <KeyRound size={22} />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  Two-Factor Verification
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: 0 }}>
                  Enter the 6-digit TOTP code from your authenticator app
                </p>
              </div>

              <div>
                <label
                  htmlFor="admin-totp"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#CBD5E1',
                    marginBottom: '0.375rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  6-Digit Authenticator Code
                </label>
                <input
                  id="admin-totp"
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #334155',
                    color: '#38BDF8',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'var(--space-2)' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMfaRequired(false);
                    setTotpCode('');
                  }}
                  style={{ flex: 1, minHeight: '44px' }}
                >
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isMfaLoading}
                  style={{
                    flex: 2,
                    minHeight: '44px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
                  }}
                >
                  Verify Code <Lock size={16} />
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.75rem', color: '#475569' }}>
          ByteBeacon 2.0 Security Core • Zero-Trust Administrative Gateway
        </div>
      </div>
    </div>
  );
};
