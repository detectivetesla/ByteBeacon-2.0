import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, PasswordInput, PhoneInput, Switch } from '../../components/ui/index.js';
import { validatePassword } from '../../utils/password.js';
import { useToast } from '../../context/ToastContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  Building,
  User,
  Shield,
  Palette,
  Bell,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Laptop,
  Info,
  Eye,
} from 'lucide-react';

type SettingsTab = 'business' | 'personal' | 'security' | 'appearance' | 'notifications' | 'privacy';

export const AgentSettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { theme, setTheme } = useTheme();

  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || 'business');

  useEffect(() => {
    if (tabParam && ['business', 'personal', 'security', 'appearance', 'notifications', 'privacy'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Business State
  const [businessName, setBusinessName] = useState('DataHub Enterprise');
  const [businessPhone, setBusinessPhone] = useState('054 134 9282');
  const [businessEmail, setBusinessEmail] = useState('support@datahubgh.com');
  const [whatsAppNumber, setWhatsAppNumber] = useState('054 134 9282');

  // Personal Info State
  const [fullName, setFullName] = useState('Martin Teye Nomotsu');
  const [personalEmail, setPersonalEmail] = useState('nomotsumartin@gmail.com');
  const [personalPhone, setPersonalPhone] = useState('054 134 9282');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  // Appearance & Accessibility State
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [reduceSpacing, setReduceSpacing] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);
  const [enhancedVisibility, setEnhancedVisibility] = useState(false);

  // Notifications State
  const [emailNotify, setEmailNotify] = useState(true);
  const [pushNotify, setPushNotify] = useState(true);
  const [smsNotify, setSmsNotify] = useState(true);
  const [inAppNotify, setInAppNotify] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [paymentUpdates, setPaymentUpdates] = useState(true);
  const [walletAlerts, setWalletAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [systemAnnounce, setSystemAnnounce] = useState(false);

  // Privacy State
  const [phoneDiscoverability, setPhoneDiscoverability] = useState(true);
  const [anonymizedAnalytics, setAnonymizedAnalytics] = useState(true);

  // Handlers
  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPersonal(true);
    setTimeout(() => {
      setIsSavingPersonal(false);
      toastSuccess('Personal Information Saved', 'Your profile details have been successfully updated.');
    }, 600);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toastError('Validation Error', 'Please enter your current password.');
      return;
    }
    const passValidation = validatePassword(newPassword);
    if (!passValidation.isValid) {
      toastError('Weak Password', passValidation.error || 'Password does not meet complexity requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Mismatch', 'New passwords do not match.');
      return;
    }

    toastSuccess('Password Updated', 'Your security password has been changed.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Block */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Settings & Preferences
        </span>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem', letterSpacing: '-0.02em' }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Manage your agent profile, personal details, preferences, and security.
        </p>
      </div>

      {/* Top Agent Identity Capsule */}
      <Card
        style={{
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: 'var(--font-size-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            MN
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                Martin Nomotsu
              </strong>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </span>
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              nomotsumartin@gmail.com
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/agent/profile')}
          leftIcon={<User size={14} />}
        >
          View Profile
        </Button>
      </Card>

      {/* Settings Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--color-border-default)',
          paddingBottom: '0.25rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'business', label: 'Business', icon: Building },
          { id: 'personal', label: 'Personal Information', icon: User },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'privacy', label: 'Privacy', icon: Eye },
        ].map((t) => {
          const Icon = t.icon;
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id as SettingsTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isSelected ? 'var(--color-bg-surface-elevated)' : 'transparent',
                color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: BUSINESS SETTINGS
          ========================================================================= */}
      {activeTab === 'business' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toastSuccess('Business Profile Saved', 'Your business details and support contacts have been updated.');
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} color="var(--color-primary)" />
              Business Profile
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                label="Business / Agent Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />

              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Agent ID</span>
                <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>AGT-84920</div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Account Type</span>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>Commercial Data Reseller</div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Storefront</span>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>datahub.bytebeacon.com</div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Network Availability</span>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>MTN, Telecel, AirtelTigo</div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Date Joined</span>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>Jan 12, 2025</div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={18} color="var(--color-primary)" />
              Business Contact & Payout
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                label="Support Email"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
              <PhoneInput
                label="Business Phone"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
              <PhoneInput
                label="WhatsApp Business Line"
                value={whatsAppNumber}
                onChange={(e) => setWhatsAppNumber(e.target.value)}
              />
              <Input
                label="MoMo Payout Line (Masked)"
                value="054 ••• •282 (MTN)"
                disabled
                hint="Locked for security. Contact admin to modify."
              />
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="md" type="submit">
              Save Business Details
            </Button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 2: PERSONAL INFORMATION
          ========================================================================= */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSavePersonal} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="var(--color-primary)" />
              Personal Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                label="Full Legal Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                required
              />
              <PhoneInput
                label="Phone Number"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                required
              />
              <PhoneInput
                label="WhatsApp Number"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
              />
            </div>

            {/* Read-Only Badges */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: 'var(--space-6)', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Role</span>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>Dealer / Agent</div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>KYC Status</span>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={13} /> Verified
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="md" type="submit" disabled={isSavingPersonal}>
              {isSavingPersonal ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 3: SECURITY SETTINGS
          ========================================================================= */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Change Password Card */}
          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="var(--color-primary)" />
              Change Password
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
              Update your password regularly to keep your agent wallet and fulfillment tools secure.
            </p>

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px' }}>
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create strong password"
                showStrengthMeter
                showRequirements
                required
              />

              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="primary" size="sm" type="submit">
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          {/* Active Sessions & 2FA */}
          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Laptop size={18} color="var(--color-primary)" />
              Active Sessions & Device Management
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                    Chrome on Windows 11 (Current Session)
                  </strong>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Accra, GH · IP: 102.176.64.12 · Active Now
                  </span>
                </div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-success)' }}>
                  ● Active
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                    Mobile Safari on iPhone 15
                  </strong>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Kumasi, GH · IP: 102.176.64.12 · 2 hours ago
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toastInfo('Session Terminated', 'Remote iPhone session logged out.')}>
                  Revoke
                </Button>
              </div>
            </div>

            {/* 2FA Toggle */}
            <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
              <Switch
                label="Two-Factor Authentication (2FA)"
                description="Require SMS or authenticator token for high-value wallet payouts and API key rotations."
                checked={twoFactorEnabled}
                onChange={(checked) => {
                  setTwoFactorEnabled(checked);
                  if (checked) {
                    toastSuccess('2FA Enabled', 'Two-factor protection activated on your agent account.');
                  } else {
                    toastInfo('2FA Disabled', 'Two-factor protection disabled.');
                  }
                }}
              />
            </div>
          </Card>

          {/* Delete Account Destructive Card */}
          <Card style={{ padding: 'var(--space-6)', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.03)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-danger)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={18} color="var(--color-danger)" />
              Delete Account
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Permanently delete your agent account, storefront, and associated data. This action is irreversible.
            </p>

            <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete Account
            </Button>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 4: APPEARANCE & ACCESSIBILITY
          ========================================================================= */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Color Scheme
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              {[
                { id: 'system', label: 'System' },
                { id: 'light', label: 'Light' },
                { id: 'dark', label: 'Dark' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id as any)}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: theme === opt.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: theme === opt.id ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-bg-surface-elevated)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-primary)',
                    textAlign: 'center',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Text Size
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              {[
                { id: 'small', label: 'Small', sample: 'Aa' },
                { id: 'medium', label: 'Medium', sample: 'Aa' },
                { id: 'large', label: 'Large', sample: 'Aa' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTextSize(opt.id as any)}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: textSize === opt.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: textSize === opt.id ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-bg-surface-elevated)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span style={{ fontSize: opt.id === 'small' ? '14px' : opt.id === 'medium' ? '18px' : '22px', fontWeight: 800 }}>
                    {opt.sample}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600 }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Accessibility
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Switch
                label="Reduce spacing"
                description="Use a denser layout across data tables."
                checked={reduceSpacing}
                onChange={setReduceSpacing}
              />
              <Switch
                label="Reduce animations"
                description="Minimize motion throughout the application."
                checked={reduceAnimations}
                onChange={setReduceAnimations}
              />
              <Switch
                label="Enhanced visibility"
                description="Improve contrast and visual clarity for high-sunlight environments."
                checked={enhancedVisibility}
                onChange={setEnhancedVisibility}
              />
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 5: NOTIFICATIONS
          ========================================================================= */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Pro Tip Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
            }}
          >
            <Info size={18} color="var(--color-accent-analytics)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Pro Tip
              </strong>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                Disable non-critical notifications to reduce distractions while keeping important security and transaction alerts enabled.
              </span>
            </div>
          </div>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Delivery Channels
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              {[
                { label: 'Email Alerts', checked: emailNotify, set: setEmailNotify },
                { label: 'Push Notifications', checked: pushNotify, set: setPushNotify },
                { label: 'SMS Notifications', checked: smsNotify, set: setSmsNotify },
                { label: 'In-App Alerts', checked: inAppNotify, set: setInAppNotify },
              ].map((c, i) => (
                <Switch
                  key={i}
                  label={c.label}
                  checked={c.checked}
                  onChange={c.set}
                />
              ))}
            </div>
          </Card>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Notification Categories
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { title: 'Order updates', desc: 'Real-time SIM fulfillment delivery notifications and carrier status changes.', checked: orderUpdates, set: setOrderUpdates },
                { title: 'Payment & deposit updates', desc: 'Instant MoMo top-up and Paystack confirmation receipts.', checked: paymentUpdates, set: setPaymentUpdates },
                { title: 'Wallet alerts', desc: 'Low-balance float threshold warnings for continuous auto-fulfillment.', checked: walletAlerts, set: setWalletAlerts },
                { title: 'Security alerts', desc: 'New login attempts, password changes, and API key rotations (Always Recommended).', checked: securityAlerts, set: setSecurityAlerts },
                { title: 'System announcements', desc: 'Scheduled maintenance windows and carrier network updates.', checked: systemAnnounce, set: setSystemAnnounce },
              ].map((item, i) => (
                <Switch
                  key={i}
                  label={item.title}
                  description={item.desc}
                  checked={item.checked}
                  onChange={item.set}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 6: PRIVACY
          ========================================================================= */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Privacy Commitment Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
            }}
          >
            <Shield size={18} color="#8B5CF6" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Privacy Commitment
              </strong>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                We never sell your personal data. Optional data sharing is anonymized and requires your consent. You can change these settings at any time.
              </span>
            </div>
          </div>

          <Card style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Data & Visibility Preferences
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Switch
                label="Phone number discoverability"
                description="Allow sub-agents and customers to find your store using your phone number."
                checked={phoneDiscoverability}
                onChange={setPhoneDiscoverability}
              />
              <Switch
                label="Anonymized analytics"
                description="Allow trusted telemetry partners to use anonymized data to improve network routing speeds."
                checked={anonymizedAnalytics}
                onChange={setAnonymizedAnalytics}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }} onClick={() => setDeleteModalOpen(false)} />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-tactile-lg)',
              zIndex: 310,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
              <AlertTriangle size={22} />
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800 }}>Permanently Delete Account</h3>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              This will permanently delete your agent profile, custom storefront, and transaction records. Type <strong>DELETE</strong> below to confirm.
            </p>

            <Input
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder="Type DELETE to confirm"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirmationInput !== 'DELETE'}
                onClick={() => {
                  setDeleteModalOpen(false);
                  toastError('Account Deletion', 'Account deletion request submitted for compliance processing.');
                }}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
