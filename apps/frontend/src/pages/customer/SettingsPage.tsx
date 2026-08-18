import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, PhoneInput, PasswordInput, Switch } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  User,
  Lock,
  Shield,
  Smartphone,
  Laptop,
  CheckCircle2,
  Trash2,
  X,
  Palette,
  Sun,
  Moon,
  Monitor,
  Bell,
} from 'lucide-react';

type SettingsTab = 'personal' | 'security' | 'appearance' | 'notifications' | 'privacy';

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  isCurrent: boolean;
  lastActive: string;
}

const SAMPLE_CUSTOMER_SESSIONS: ActiveSession[] = [
  { id: 'sess-1', device: 'Chrome on Windows 11', browser: 'Chrome 128.0', location: 'Accra, Ghana', ip: '102.176.65.12', isCurrent: true, lastActive: 'Active now' },
  { id: 'sess-2', device: 'Mobile Safari on iPhone 15', browser: 'Safari 17.4', location: 'Kumasi, Ghana', ip: '154.160.22.84', isCurrent: false, lastActive: '2 days ago' },
];

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { theme, toggleTheme } = useTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');

  // Personal Info Form State
  const [fullName, setFullName] = useState(user?.fullName || 'Caleb Mensah');
  const [email] = useState(user?.email || 'caleb.mensah@gmail.com');
  const [phone, setPhone] = useState(user?.phone || '024 123 4567');
  const [whatsapp, setWhatsapp] = useState('024 123 4567');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>(SAMPLE_CUSTOMER_SESSIONS);

  // Appearance State
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [reduceSpacing, setReduceSpacing] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Notifications State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [walletAlerts, setWalletAlerts] = useState(true);
  const [promoDeals, setPromoDeals] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  // Privacy State
  const [phoneDiscoverable, setPhoneDiscoverable] = useState(true);
  const [anonymizedAnalytics, setAnonymizedAnalytics] = useState(true);

  // Delete Account Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);


  // Handlers
  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPersonal(true);
    setTimeout(() => {
      setIsSavingPersonal(false);
      toastSuccess('Personal Info Updated', 'Your profile details have been saved.');
    }, 600);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toastError('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toastError('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }

    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastSuccess('Password Updated', 'Your login password has been changed successfully.');
    }, 800);
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toastInfo('Session Revoked', 'Signed out from selected remote device.');
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toastSuccess('Sessions Cleared', 'Signed out from all other active devices.');
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmationText !== 'DELETE') {
      toastError('Confirmation Mismatch', 'Please type DELETE to confirm account closure.');
      return;
    }
    setIsDeleting(true);
    setTimeout(() => {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      toastSuccess('Account Deleted', 'Your customer account has been permanently removed.');
      logout();
      window.location.href = '/signin';
    }, 1200);
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header & Identity Capsule */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Preferences & Controls
        </span>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          Manage your personal details, login credentials, notification channels, and privacy preferences.
        </p>
      </div>

      {/* 2. Customer Identity Capsule */}
      <Card style={{ padding: 'var(--space-4) var(--space-5)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                fontSize: '1.1rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              CM
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {fullName}
                </strong>
                <Badge variant="success" size="sm" dot>Active Customer</Badge>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                {email} · Verified
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', backgroundColor: 'rgba(34, 197, 94, 0.12)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <Shield size={13} color="var(--color-success)" />
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase' }}>
              Standard Tier Customer
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Navigation Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          borderBottom: '1px solid var(--color-border-default)',
          paddingBottom: '2px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'personal', label: 'Personal Information', icon: User },
          { id: 'security', label: 'Security & Login', icon: Lock },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'privacy', label: 'Privacy', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 120ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Independent Tab Content Areas */}

      {/* TAB 1: PERSONAL INFORMATION */}
      {activeTab === 'personal' && (
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Personal Identity & Contact
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Your verified details used for automated data bundle order fulfillment and receipts.
            </p>
          </div>

          <form onSubmit={handleSavePersonal} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <Input
                label="Full Legal Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Caleb Mensah"
                required
              />

              <Input
                label="Email Address"
                value={email}
                disabled
                hint="Verified account email. Contact support to request updates."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <PhoneInput
                label="Primary Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 123 4567"
                hint="Used as the default delivery number for telecom bundles."
                required
              />

              <PhoneInput
                label="WhatsApp Notification Number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="024 123 4567"
                hint="For instant delivery receipts and outage alerts."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <Button variant="primary" size="md" type="submit" isLoading={isSavingPersonal}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 2: SECURITY & LOGIN */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Password Change Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Change Password
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                Ensure your account is protected with a unique, high-entropy password.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Current Password */}
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />

              {/* New Password */}
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters with numbers & symbols"
                showStrengthMeter
                required
              />

              {/* Confirm Password */}
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <Button variant="primary" size="md" type="submit" isLoading={isUpdatingPassword}>
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          {/* 2FA Toggle Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Two-Factor Authentication (2FA)
                </h3>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Require a verification code sent to your email or authenticator app when signing in from unrecognized devices.
                </p>
              </div>

              <Button
                variant={is2faEnabled ? 'outline' : 'primary'}
                size="sm"
                onClick={() => {
                  setIs2faEnabled(!is2faEnabled);
                  toastSuccess(is2faEnabled ? '2FA Disabled' : '2FA Enabled', is2faEnabled ? 'Two-factor auth has been turned off.' : 'Two-factor auth is now active on your account.');
                }}
              >
                {is2faEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Button>
            </div>
          </Card>

          {/* Active Sessions List */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Active Devices & Sessions
                </h3>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Devices currently authenticated with your ByteBeacon customer credentials.
                </p>
              </div>

              {sessions.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleRevokeAllOtherSessions}>
                  Sign Out Other Devices
                </Button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {sess.device.includes('iPhone') ? (
                      <Smartphone size={20} color="var(--color-primary)" />
                    ) : (
                      <Laptop size={20} color="var(--color-primary)" />
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          {sess.device}
                        </strong>
                        {sess.isCurrent && (
                          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-xs)' }}>
                            Current Device
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                        {sess.browser} · {sess.location} ({sess.ip}) · {sess.lastActive}
                      </span>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(sess.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Theme Mode Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Color Scheme & Theme
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
              {[
                { id: 'system', label: 'System Default', icon: Monitor },
                { id: 'light', label: 'Light Mode', icon: Sun },
                { id: 'dark', label: 'Dark Mode', icon: Moon },
              ].map((th) => {
                const Icon = th.icon;
                const isSelected = theme === th.id;
                return (
                  <div
                    key={th.id}
                    onClick={() => {
                      if (theme !== th.id) toggleTheme();
                    }}
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                      backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.06)' : 'var(--color-bg-surface-elevated)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <Icon size={18} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{th.label}</strong>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Text Sizing Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Text Size & Legibility
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
              {[
                { id: 'sm', label: 'Small', preview: '13px' },
                { id: 'md', label: 'Medium (Default)', preview: '14px' },
                { id: 'lg', label: 'Large', preview: '16px' },
              ].map((sz) => (
                <div
                  key={sz.id}
                  onClick={() => setTextSize(sz.id as 'sm' | 'md' | 'lg')}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: textSize === sz.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: textSize === sz.id ? 'rgba(34, 197, 94, 0.06)' : 'var(--color-bg-surface-elevated)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-primary)', marginBottom: '4px' }}>Aa</div>
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>{sz.label}</strong>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{sz.preview} base font</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Accessibility Toggles */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Accessibility Adjustments
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Switch
                label="Compact Padding & Spacing"
                description="Reduce vertical whitespace across data tables and cards"
                checked={reduceSpacing}
                onChange={setReduceSpacing}
              />

              <Switch
                label="Reduce Motion & Animations"
                description="Disable smooth transition effects and hover glows"
                checked={reduceAnimations}
                onChange={setReduceAnimations}
              />

              <Switch
                label="High Contrast Surfaces"
                description="Enhance border visibility and text sharpness"
                checked={highContrast}
                onChange={setHighContrast}
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Notification Channels */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Delivery Channels
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Switch
                label="Email Receipts & Statements"
                description={`Send detailed receipts to ${email}`}
                checked={emailNotifs}
                onChange={setEmailNotifs}
              />

              <Switch
                label="SMS Order Dispatch Alerts"
                description="Direct SMS confirmation when data bundles are credited to beneficiary"
                checked={smsNotifs}
                onChange={setSmsNotifs}
              />

              <Switch
                label="In-App Toast Alerts"
                description="Show popover badges and sounds in browser"
                checked={inAppNotifs}
                onChange={setInAppNotifs}
              />
            </div>
          </Card>

          {/* Notification Categories */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Subscribed Topics & Events
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Switch
                label="Order Completion & Carrier Updates"
                description="Status changes for MTN, Telecel, and AT data deliveries"
                checked={orderAlerts}
                onChange={setOrderAlerts}
              />

              <Switch
                label="Wallet Deposit Confirmations"
                description="Immediate alerts when Paystack top-up funds are added"
                checked={walletAlerts}
                onChange={setWalletAlerts}
              />

              <Switch
                label="Promotional Discounts & Volume Deals"
                description="Special seasonal bundle discount announcements"
                checked={promoDeals}
                onChange={setPromoDeals}
              />

              <Switch
                label="Security & Login Warnings"
                description="Critical notifications for new device logins or password changes"
                checked={securityAlerts}
                onChange={setSecurityAlerts}
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: PRIVACY */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
              Data & Privacy Controls
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Switch
                label="Beneficiary Number History Autofill"
                description="Save recently dispatched phone numbers for fast reordering"
                checked={phoneDiscoverable}
                onChange={setPhoneDiscoverable}
              />

              <Switch
                label="Anonymized Performance Telemetry"
                description="Help improve system fulfillment speed by sharing anonymous API latency data"
                checked={anonymizedAnalytics}
                onChange={setAnonymizedAnalytics}
              />
            </div>
          </Card>

          {/* Privacy Commitment Card */}
          <Card style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>ByteBeacon Privacy Guarantee</strong>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                  We never sell your contact info or beneficiary numbers to third-party telemarketers. All telecom credentials and payment tokens are protected with end-to-end 256-bit encryption.
                </p>
              </div>
            </div>
          </Card>

          {/* Danger Zone: Delete Customer Account */}
          <Card style={{ padding: 'var(--space-5)', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.03)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-danger)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Close Customer Account
                </h3>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Permanently delete your profile, transaction logs, and wallet history.
                </p>
              </div>

              <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)} leftIcon={<Trash2 size={13} />}>
                Delete Account
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
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
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }} onClick={() => setIsDeleteModalOpen(false)} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} color="var(--color-danger)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Confirm Account Deletion
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-danger)', fontWeight: 700 }}>
                    Permanent action. All data will be wiped.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Are you sure you want to permanently delete your customer account? Any remaining prepaid balance will be forfeited.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <Input
              label="Type DELETE to confirm:"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== 'DELETE'}
                isLoading={isDeleting}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
