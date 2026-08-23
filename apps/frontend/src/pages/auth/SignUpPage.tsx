import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { SocialAuthButton } from '../../components/auth/SocialAuthButton.js';
import { Input, PhoneInput, PasswordInput, Button } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { authApi } from '../../api/auth.api.js';
import { promptGoogleSignIn } from '../../utils/googleAuth.js';
import { validatePassword } from '../../utils/password.js';
import { ArrowRight, User, Mail } from 'lucide-react';

export const SignUpPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; phone?: string; password?: string }>({});

  const { login } = useAuth();
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      toastInfo('Google Sign Up', 'Opening Google Authentication...');
      const data = await promptGoogleSignIn();

      if (data?.user && data?.tokens) {
        login(data.user, data.tokens);
        toastSuccess('Account Created!', `Welcome to ByteBeacon, ${data.user.fullName || data.user.email}`);

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
        toastError('Google Sign-Up', err.message || 'Unable to complete Google sign-up.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors: { fullName?: string; email?: string; phone?: string; password?: string } = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required';
    if (!email.trim() || !email.includes('@')) errors.email = 'Valid email address is required';
    if (!phone.trim() || phone.trim().length < 10) errors.phone = 'Valid phone number (e.g. 0241234567) is required';
    const passValidation = validatePassword(password);
    if (!passValidation.isValid) errors.password = passValidation.error || 'Password does not meet requirements';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      toastSuccess('Account Created Successfully!', 'Please sign in with your credentials.');
      navigate('/signin');
    } catch (err: any) {
      toastError('Registration failed', err.message || 'Unable to register right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your ByteBeacon account"
      subtitle="Enter your details to get started with instant data delivery"
      visualTitle="One Platform to Streamline All Mobile Data Delivery"
      visualSubtitle="Instant multi-network fulfillment, live tracking, and verified Mobile Money payments across Ghana."
      topActionText="Already have an account?"
      topActionLinkText="Sign In"
      topActionHref="/signin"
    >
      {/* Social Fast-Auth Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: 'var(--space-4)' }}>
        <SocialAuthButton
          provider="google"
          onClick={handleGoogleSignUp}
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
          Or register with email
        </span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-default)' }} />
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Full Name */}
        <Input
          id="signup-name"
          label="Full Name"
          type="text"
          placeholder="e.g. Kwame Mensah"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading}
          error={fieldErrors.fullName}
          leftIcon={<User size={15} color="var(--color-text-muted)" />}
          required
        />

        {/* Email */}
        <Input
          id="signup-email"
          label="Email Address"
          type="email"
          placeholder="kwame@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          error={fieldErrors.email}
          leftIcon={<Mail size={15} color="var(--color-text-muted)" />}
          required
        />

        {/* Phone */}
        <PhoneInput
          id="signup-phone"
          label="Ghana Phone Number"
          placeholder="024 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isLoading}
          error={fieldErrors.phone}
          required
        />

        {/* Password */}
        <PasswordInput
          id="signup-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          error={fieldErrors.password}
          disabled={isLoading}
          showStrengthMeter
          showRequirements
          required
        />

        {/* Terms notice */}
        <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: 'var(--space-1) 0' }}>
          By signing up, you agree to ByteBeacon's Terms of Service and Privacy Policy.
        </p>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          style={{ marginTop: 'var(--space-1)' }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.4} />}
        >
          Create Account
        </Button>
      </form>
    </AuthLayout>
  );
};
