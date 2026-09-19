import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { PasswordInput, Button } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { authApi } from '../../api/auth.api.js';
import { validatePassword } from '../../utils/password.js';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!token) {
      setErrorMsg('Invalid or missing password reset token.');
      return;
    }

    const passValidation = validatePassword(newPassword);
    if (!passValidation.isValid) {
      setErrorMsg(passValidation.error || 'Password does not meet complexity requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({ token, newPassword });
      setIsSuccess(true);
      toastSuccess('Password Updated', 'Your password has been successfully reset.');
    } catch (err: any) {
      toastError('Reset failed', err.message || 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Invalid Reset Link"
        subtitle="This password recovery link is invalid or incomplete"
        visualTitle="Account Security & Access Recovery"
        visualSubtitle="ByteBeacon protects your account with multi-layered credential encryption."
        topActionText="Remember password?"
        topActionLinkText="Sign In"
        topActionHref="/signin"
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
            The recovery token is missing from your URL. Please request a fresh password reset link.
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/forgot-password')}
          >
            Request New Reset Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout
        title="Password Reset Successful"
        subtitle="You can now sign in with your new credentials"
        visualTitle="Account Security & Access Recovery"
        visualSubtitle="Your account credentials have been securely updated."
        topActionText=""
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

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/signin')}
          >
            Sign In Now
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Please enter and confirm your new secure password"
      visualTitle="Account Security & Access Recovery"
      visualSubtitle="ByteBeacon protects your account with multi-layered credential encryption."
      topActionText="Remember password?"
      topActionLinkText="Sign In"
      topActionHref="/signin"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <PasswordInput
          id="new-password"
          label="New Password"
          placeholder="Create new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isLoading}
          showStrengthMeter
          showRequirements
          required
        />

        <PasswordInput
          id="confirm-password"
          label="Confirm Password"
          placeholder="repeat new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errorMsg}
          disabled={isLoading}
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
          Update Password
        </Button>
      </form>
    </AuthLayout>
  );
};
