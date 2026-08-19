import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { walletApi } from '../../api/wallet.api.js';
import {
  Wallet,
  Coins,
  BadgeCheck,
  CheckCircle2,
  Settings,
  Pencil,
  Headphones,
  Trash2,
  AlertTriangle,
  Mail,
  Phone,
  Radio,
} from 'lucide-react';

export const AgentProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toastInfo, toastError } = useToast();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [walletBalanceGhs, setWalletBalanceGhs] = useState<number>(
    (user?.walletBalancePesewas || 0) / 100,
  );

  const fetchBalance = useCallback(async () => {
    try {
      const bal = await walletApi.getBalance().catch(() => null);
      if (bal && typeof bal.balanceGhs === 'number') {
        setWalletBalanceGhs(bal.balanceGhs);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleContactSupport = () => {
    toastInfo('Support Contact', 'Opening official ByteBeacon Agent Helpdesk channel.');
    window.open('mailto:support@bytebeacon.com?subject=Agent%20Account%20Support', '_blank');
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || 'Agent Account';
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Agent Overview
        </span>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem', letterSpacing: '-0.02em' }}>
          Agent Profile
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Personal dashboard, wallet balance overview, and account verification.
        </p>
      </div>

      {/* 1. Profile Header Card */}
      <Card
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-2xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
          {/* Avatar Monogram */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.25)',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                {displayName}
              </h2>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--color-accent-analytics)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                }}
              >
                {user?.role ? user.role.toUpperCase() : 'AGENT'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              {user?.email && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={13} color="var(--color-text-muted)" />
                  {user.email}
                </span>
              )}
              {user?.phone && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Phone size={13} color="var(--color-text-muted)" />
                  {user.phone}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckCircle2 size={11} /> Status: Approved
              </span>

              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  backgroundColor: 'rgba(255, 204, 0, 0.12)',
                  color: '#D97706',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Radio size={11} /> Network: MTN
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/agent/settings?tab=personal')}
          leftIcon={<Pencil size={14} />}
        >
          Edit Profile
        </Button>
      </Card>

      {/* 2. Financial Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Wallet Balance Card (Tactile Green) */}
        <Card
          style={{
            padding: 'var(--space-5)',
            border: '1.5px solid rgba(34, 197, 94, 0.35)',
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
              <Wallet size={16} strokeWidth={2.4} />
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Wallet Balance
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              GHS {walletBalanceGhs.toFixed(2)}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/wallet')}
            style={{ backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontWeight: 700 }}
          >
            Top Up Wallet
          </Button>
        </Card>

        {/* Commission Earned Card (Tactile Secondary) */}
        <Card
          style={{
            padding: 'var(--space-5)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              <Coins size={16} strokeWidth={2.4} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Commission Earned
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              GHS 0.00
            </div>
          </div>

          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
            Standard Margin
          </span>
        </Card>
      </div>

      {/* 3. Account Verification Card */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BadgeCheck size={20} color="var(--color-primary)" />
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Account Verification
            </h2>
          </div>
          <span
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              color: 'var(--color-success)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            ✓ Your identity is verified
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Email Address</span>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>nomotsumartin@gmail.com</strong>
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-success)' }}>
              ✓ Verified
            </span>
          </div>

          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Phone Number</span>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>0541349282</strong>
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-success)' }}>
              ✓ Verified
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Profile Quick Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Edit Profile */}
        <Card
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Pencil size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>Edit Profile</strong>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Update your personal details, email, and mobile lines.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => navigate('/agent/settings?tab=personal')}
          >
            Edit Profile
          </Button>
        </Card>

        {/* Preferences */}
        <Card
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Settings size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>Preferences</strong>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Customize notifications, appearance themes, and privacy.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => navigate('/agent/settings?tab=appearance')}
          >
            Edit Preferences
          </Button>
        </Card>

        {/* Support */}
        <Card
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Headphones size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>Support</strong>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Need help with orders or wallet funding?
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={handleContactSupport}
          >
            Contact Support
          </Button>
        </Card>
      </div>

      {/* 5. Separate Destructive Action */}
      <Card
        style={{
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          backgroundColor: 'rgba(239, 68, 68, 0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
            <Trash2 size={16} />
            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Delete Account</strong>
          </div>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Permanently remove your account and all associated reseller data.
          </p>
        </div>

        <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
          Delete Account
        </Button>
      </Card>

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
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteInput !== 'DELETE'}
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
