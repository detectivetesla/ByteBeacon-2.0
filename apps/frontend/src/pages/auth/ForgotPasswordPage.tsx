import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Input, Button } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { authApi } from '../../api/auth.api.js';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = identifier.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your email address or phone number.');
      return;
    }

    setIsLoading(true);

    try {
      const res: any = await authApi.forgotPassword(trimmed);
      if (res?.debug) {
        setDebugData(res.debug);
      }
      setIsSubmitted(true);
      toastSuccess('Reset Link Dispatched', 'If an account exists with this identifier, instructions have been sent.');
    } catch (err: any) {
      toastError('Request failed', err.message || 'Unable to send reset instructions.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We've sent password reset instructions to ${identifier}`}
        visualTitle="Account Security & Access Recovery"
        visualSubtitle="ByteBeacon protects your account with multi-layered credential encryption and instant security alerts."
        topActionText="Remember your password?"
        topActionLinkText="Sign In"
        topActionHref="/signin"
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-4)',
            }}
          >
            <CheckCircle2 size={28} strokeWidth={2.5} />
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
            Please check your inbox (including your <strong>Spam or Junk folder</strong>) for your secure recovery link. The link expires in 15 minutes.
          </p>

          {debugData?.resetLink && (
            <div
              style={{
                marginBottom: 'var(--space-5)',
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Development Reset Link
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                {debugData.smtpReady
                  ? 'Email dispatched via SMTP. You can also test directly with this link:'
                  : 'SMTP transport is running in local development mode. Open your reset link directly:'}
              </p>
              <a
                href={debugData.resetLink}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-brand)',
                  wordBreak: 'break-all',
                  textDecoration: 'underline',
                }}
              >
                Proceed to Reset Password &rarr;
              </a>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/signin')}
          >
            Back to Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email or phone number and we'll send you a recovery link"
      visualTitle="Account Security & Access Recovery"
      visualSubtitle="ByteBeacon protects your account with multi-layered credential encryption and instant security alerts."
      topActionText="Remember your password?"
      topActionLinkText="Sign In"
      topActionHref="/signin"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          id="forgot-email"
          label="Email Address or Phone Number"
          type="text"
          placeholder="e.g. kofi@example.com or 0241234567"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={isLoading}
          error={errorMsg}
          leftIcon={<Mail size={15} color="var(--color-text-muted)" />}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          style={{
            marginTop: '1.25rem',
            minHeight: '48px',
            fontSize: '0.9375rem',
            fontWeight: 700,
          }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.8} />}
        >
          Send Reset Link
        </Button>
      </form>
    </AuthLayout>
  );
};
