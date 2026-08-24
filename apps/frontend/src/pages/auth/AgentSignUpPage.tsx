import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Input, PhoneInput, PasswordInput, Button } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { authApi } from '../../api/auth.api.js';
import { validatePassword } from '../../utils/password.js';
import { Store, ArrowRight, User, Mail } from 'lucide-react';

export const AgentSignUpPage: React.FC = () => {
  const [storeName, setStoreName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ storeName?: string; fullName?: string; email?: string; phone?: string; password?: string }>({});

  const { isMaintenanceMode } = usePlatformStatus();
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (isMaintenanceMode) {
      toastError('Registration Paused', 'Agent registrations are temporarily paused during scheduled platform maintenance.');
      return;
    }

    const errors: { storeName?: string; fullName?: string; email?: string; phone?: string; password?: string } = {};
    if (!storeName.trim()) errors.storeName = 'Store / Business name is required';
    if (!fullName.trim()) errors.fullName = 'Full legal name is required';
    if (!email.trim() || !email.includes('@')) errors.email = 'Valid business email is required';
    if (!phone.trim() || phone.trim().length < 10) errors.phone = 'Valid 10-digit mobile money phone is required';
    const passValidation = validatePassword(password);
    if (!passValidation.isValid) errors.password = passValidation.error || 'Password does not meet requirements';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      await authApi.registerAgent({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        storeName: storeName.trim(),
        password,
      });

      toastSuccess('Agent Account Created Successfully!', 'Please sign in with your credentials.');
      navigate('/signin');
    } catch (err: any) {
      toastError('Registration failed', err.message || 'Unable to register agent right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Apply for an Agent Account"
      subtitle="Join hundreds of data resellers across Ghana with wholesale data margins."
      visualTitle="Accelerate Your Telecom Resale Business"
      visualSubtitle="Access wholesale data pricing, multi-network float, custom storefronts, and automated sales commissions."
      topActionText="Already an agent?"
      topActionLinkText="Sign In"
      topActionHref="/signin"
    >
      {/* Reseller Perks Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          fontSize: 'var(--font-size-2xs)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Store size={18} strokeWidth={2.4} color="#CA8A04" />
        <span>Resellers receive wholesale rates, bulk API access, and instant delivery.</span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Store / Business Name */}
        <Input
          id="agent-store-name"
          label="Store / Business Name"
          type="text"
          placeholder="e.g. Accra Data Hub"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          disabled={isLoading || isMaintenanceMode}
          error={fieldErrors.storeName}
          leftIcon={<Store size={15} color="var(--color-text-muted)" />}
          required
        />

        {/* Full Legal Name */}
        <Input
          id="agent-fullname"
          label="Full Legal Name"
          type="text"
          placeholder="e.g. Kofi Owusu"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading || isMaintenanceMode}
          error={fieldErrors.fullName}
          leftIcon={<User size={15} color="var(--color-text-muted)" />}
          required
        />

        {/* Business Email */}
        <Input
          id="agent-email"
          label="Business Email"
          type="email"
          placeholder="kofi@datahub.gh"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading || isMaintenanceMode}
          error={fieldErrors.email}
          leftIcon={<Mail size={15} color="var(--color-text-muted)" />}
          required
        />

        {/* Mobile Money Payout Phone */}
        <PhoneInput
          id="agent-phone"
          label="Mobile Money Payout Phone (MTN/Telecel/AT)"
          placeholder="024 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isLoading || isMaintenanceMode}
          error={fieldErrors.phone}
          required
        />

        {/* Password */}
        <PasswordInput
          id="agent-password"
          label="Account Password"
          placeholder="Create strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={isLoading || isMaintenanceMode}
          showStrengthMeter
          showRequirements
          required
        />

        {/* Register Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isMaintenanceMode}
          isLoading={isLoading}
          style={{
            marginTop: 'var(--space-3)',
          }}
          rightIcon={<ArrowRight size={16} strokeWidth={2.8} />}
        >
          {isMaintenanceMode ? 'Registration Paused' : 'Register as Agent'}
        </Button>
      </form>
    </AuthLayout>
  );
};
