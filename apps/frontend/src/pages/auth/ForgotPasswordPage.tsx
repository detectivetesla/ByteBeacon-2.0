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
      await authApi.forgotPassword(trimmed);
      setIsSubmitted(true);
      toastSuccess('Reset Link Sent', 'If an account exists with this identifier, instructions have been sent.');
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

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
            Please check your inbox or SMS for your secure reset link. The link expires in 30 minutes.
          </p>

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
            marginTop: 'var(--space-2)',
          }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.8} />}
        >
          Send Reset Link
        </Button>
      </form>
    </AuthLayout>
  );
};
