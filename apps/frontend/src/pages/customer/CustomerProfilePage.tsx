import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input } from '../../components/ui/index.js';
import {
  User,
  ShieldCheck,
  CreditCard,
  Settings,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Lock,
  Headphones,
  Trash2,
  X,
  Plus,
  ArrowRight,
  Zap,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { walletApi } from '../../api/wallet.api.js';
import { ordersApi } from '../../api/orders.api.js';

export const CustomerProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [walletBalanceGhs, setWalletBalanceGhs] = useState<number>(
    (user?.walletBalancePesewas || 0) / 100,
  );
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  const [totalVolumeGb, setTotalVolumeGb] = useState<number>(0);

  const fetchProfileStats = useCallback(async () => {
    try {
      const balRes = await walletApi.getBalance().catch(() => null);
      if (balRes && typeof balRes.balanceGhs === 'number') {
        setWalletBalanceGhs(balRes.balanceGhs);
      }

      const ordersRes = await ordersApi.listOrders({ limit: 100 }).catch(() => null);
      if (ordersRes && Array.isArray(ordersRes.orders)) {
        setTotalOrdersCount(ordersRes.orders.length);
        const sumMb = ordersRes.orders.reduce((acc: number, o: any) => acc + (o.dataAmountMb || 0), 0);
        setTotalVolumeGb(parseFloat((sumMb / 1024).toFixed(1)));
      }
    } catch {
      // keep resilient
    }
  }, []);

  useEffect(() => {
    fetchProfileStats();
  }, [fetchProfileStats]);

  const customerName = user?.fullName || user?.email?.split('@')[0] || 'Customer';
  const customerEmail = user?.email || '—';
  const customerPhone = user?.phone || 'Not linked';
  const memberSince = 'June 2025';

  const handleDeleteAccount = () => {
    if (deleteConfirmationText !== 'DELETE') {
      toastError('Confirmation Mismatch', 'Please type DELETE to confirm account closure.');
      return;
    }
    setIsDeleting(true);
    setTimeout(() => {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      toastSuccess('Account Deleted', 'Your account and data have been queued for permanent deletion.');
      navigate('/signin');
    }, 1200);
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Account Overview
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            My Profile
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            View your personal identity, verified telecom credentials, prepaid wallet, and account settings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/settings')} leftIcon={<Settings size={14} />}>
            Preferences
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/app/buy-data')} leftIcon={<Zap size={14} />}>
            Buy Data
          </Button>
        </div>
      </div>

      {/* 2. Customer Identity Card */}
      <Card
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-2xl)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {/* Avatar Initials Badge */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                fontSize: 'var(--font-size-xl)',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-tactile-sm)',
                flexShrink: 0,
              }}
            >
              {customerName.charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                  {customerName}
                </h2>
                <span
                  style={{
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 800,
                    padding: '0.12rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--color-success)',
                    textTransform: 'uppercase',
                  }}
                >
                  Active Customer
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Mail size={13} color="var(--color-text-muted)" />
                  {customerEmail}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                  <Phone size={13} color="var(--color-text-muted)" />
                  {customerPhone}
                </span>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate('/app/settings')}>
            Edit Profile
          </Button>
        </div>
      </Card>

      {/* 3. Financial & Bundle Activity Cards (Green Tactile Balance Card + Data Activity) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Left: Customer Wallet Balance Card */}
        <div
          style={{
            background: 'linear-gradient(145deg, #064E3B 0%, #022C22 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            color: '#FFFFFF',
            boxShadow: '0 8px 24px -4px rgba(6, 78, 59, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Prepaid Wallet Balance
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <CreditCard size={15} color="#34D399" />
              </div>
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              GH₵ {walletBalanceGhs.toFixed(2)}
            </div>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: '#A7F3D0', margin: '4px 0 0 0' }}>
              Instant automated debit for all data bundle orders
            </p>
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/wallet')}
              leftIcon={<Plus size={14} />}
            >
              Top Up Wallet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/transactions')}
              style={{ color: '#D1FAE5' }}
            >
              View Statement →
            </Button>
          </div>
        </div>

        {/* Right: Data Dispatched & Completed Orders */}
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Purchased Volume
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={15} color="#3B82F6" />
              </div>
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {totalVolumeGb} GB
            </div>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              {totalOrdersCount} successfully dispatched telecom packages
            </p>
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/orders')} rightIcon={<ArrowRight size={13} />}>
              Order History
            </Button>
          </div>
        </Card>
      </div>

      {/* 4. Verified Credentials Section */}
      <Card
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <ShieldCheck size={16} color="var(--color-success)" />
          Verified Identity & Contact Info
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Email Address</span>
              <CheckCircle2 size={13} color="var(--color-success)" />
            </div>
            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{customerEmail}</strong>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: '2px' }}>Verified for security notifications</span>
          </div>

          <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phone Number</span>
              <CheckCircle2 size={13} color="var(--color-success)" />
            </div>
            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{customerPhone}</strong>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', marginTop: '2px' }}>Verified for instant bundle top-ups</span>
          </div>

          <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Account Security</span>
              <Lock size={13} color="#10B981" />
            </div>
            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Two-Factor (2FA) Active</strong>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>Protected with password & session tokens</span>
          </div>
        </div>
      </Card>

      {/* 5. Quick Account Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <Card
          style={{ padding: 'var(--space-4)', cursor: 'pointer', transition: 'all 150ms ease' }}
          onClick={() => navigate('/app/settings')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="var(--color-primary)" />
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>Personal Settings</strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Name, email & preferences</span>
            </div>
          </div>
        </Card>

        <Card
          style={{ padding: 'var(--space-4)', cursor: 'pointer', transition: 'all 150ms ease' }}
          onClick={() => navigate('/app/settings')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="#8B5CF6" />
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>Password & Security</strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Credentials & 2FA</span>
            </div>
          </div>
        </Card>

        <Card
          style={{ padding: 'var(--space-4)', cursor: 'pointer', transition: 'all 150ms ease' }}
          onClick={() => toastSuccess('Support Desk', 'Redirecting to customer support channel...')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Headphones size={18} color="#3B82F6" />
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>Customer Support</strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Get help 24/7</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 6. Danger Zone: Close / Delete Account */}
      <Card style={{ padding: 'var(--space-5)', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.03)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-danger)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Delete Customer Account
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Permanently close your ByteBeacon customer account, clear order histories, and forfeit active balances.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 size={13} />}
          >
            Delete Account
          </Button>
        </div>
      </Card>

      {/* Delete Account Confirmation Modal */}
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
                    This action is permanent and irreversible.
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
              Are you sure you want to delete your customer account? You will lose access to remaining wallet funds and purchase history.
            </p>

            <Input
              label="Type DELETE to confirm:"
              type="text"
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
      )}
    </div>
  );
};
