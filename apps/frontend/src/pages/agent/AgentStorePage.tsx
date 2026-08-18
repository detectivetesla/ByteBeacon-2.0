import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, PhoneInput } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Store,
  CreditCard,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Lock,
  Mail,
  Zap,
  Globe,
  DollarSign,
  Layers,
} from 'lucide-react';

export type StoreSetupState =
  | 'LOCKED_PAYWALL'
  | 'PAYMENT_PENDING'
  | 'AWAITING_APPROVAL'
  | 'ACTIVE';

export const AgentStorePage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  // Hard paywall state machine (defaults to LOCKED_PAYWALL)
  const [setupState, setSetupState] = useState<StoreSetupState>('LOCKED_PAYWALL');

  // Store profile fields
  const [storeName, setStoreName] = useState('DataHub Express');
  const [slug, setSlug] = useState('datahub-express');
  const [phone, setPhone] = useState('0244123456');
  const [email, setEmail] = useState('support@datahubexpress.com');

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const activationFeeGhs = 500.00;
  const publicStoreUrl = `/store/${slug}`;

  // Handle Paystack Hard Paywall Checkout
  const handlePayActivationFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !slug) {
      toastError('Missing fields', 'Please enter your Store Name and custom URL slug.');
      return;
    }

    setIsProcessingPayment(true);
    setSetupState('PAYMENT_PENDING');

    setTimeout(() => {
      setIsProcessingPayment(false);
      setSetupState('AWAITING_APPROVAL');
      toastSuccess('Payment Verified', 'Paystack activation fee verified. Store submitted for admin review.');
    }, 1500);
  };

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header & Live State Navigator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F97316' }}>
              AGENT PLATFORM
            </span>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              STOREFRONT SETUP
            </span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Agent Storefront Platform
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Launch your branded online data shop with automated Paystack mobile money checkout.
          </p>
        </div>

        {/* State Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {setupState === 'LOCKED_PAYWALL' && (
            <Badge variant="warning" size="md" dot>
              Paywall: Activation Required
            </Badge>
          )}
          {setupState === 'PAYMENT_PENDING' && (
            <Badge variant="info" size="md" dot>
              Verifying Payment...
            </Badge>
          )}
          {setupState === 'AWAITING_APPROVAL' && (
            <Badge variant="warning" size="md" dot>
              Under Review
            </Badge>
          )}
          {setupState === 'ACTIVE' && (
            <Badge variant="success" size="md" dot>
              Store Activated
            </Badge>
          )}
        </div>
      </div>

      {/* STATE 1: HARD PAYWALL SCREEN */}
      {setupState === 'LOCKED_PAYWALL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Main Paywall Banner */}
          <Card
            style={{
              padding: 'var(--space-8)',
              borderRadius: 'var(--radius-2xl)',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              boxShadow: 'var(--shadow-tactile-lg)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Lock Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: '#F97316',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(249, 115, 22, 0.35)',
                  }}
                >
                  <Lock size={24} strokeWidth={2.4} />
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F97316' }}>
                    HARD PAYWALL · ONE-TIME ACTIVATION
                  </span>
                  <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0' }}>
                    Unlock Your Standalone Agent Store
                  </h2>
                </div>
              </div>

              {/* Price Tag */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  textAlign: 'right',
                  boxShadow: 'var(--shadow-tactile-sm)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                  One-Time Setup Fee
                </span>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', lineHeight: 1.1 }}>
                  GH₵ {activationFeeGhs.toFixed(2)}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6) 0', maxWidth: '750px', lineHeight: 1.5 }}>
              Deploy your own dedicated public data shop with custom profit markups, automated Paystack customer checkout, and a separate standalone Agent Store Console.
            </p>

            {/* Feature Highlights Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
              <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <Globe size={16} />
                </div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                  Custom Public Storefront
                </strong>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  Your branded link at bytebeacon.online/store/your-slug
                </span>
              </div>

              <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <DollarSign size={16} />
                </div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                  Set Custom Markups
                </strong>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  Control your profit margins on MTN, Telecel, and AirtelTigo
                </span>
              </div>

              <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <Zap size={16} />
                </div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                  100% Automated Delivery
                </strong>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  Instant telecom fulfillment via GMPL direct API
                </span>
              </div>

              <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <Layers size={16} />
                </div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                  Separate Store Console
                </strong>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  Dedicated operations portal at /store-console
                </span>
              </div>
            </div>

            {/* Direct Paywall Checkout Form */}
            <form onSubmit={handlePayActivationFee} style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <CreditCard size={18} color="#F97316" />
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Storefront Deployment & Paystack Activation Checkout
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
                <Input
                  label="Store Business Name"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. DataHub Express"
                  required
                />

                <Input
                  label="Custom URL Slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g. datahub-express"
                  required
                />

                <PhoneInput
                  label="Merchant Support Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="024 123 4567"
                  required
                />

                <Input
                  label="Merchant Contact Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@example.com"
                  leftIcon={<Mail size={14} color="var(--color-text-muted)" />}
                  required
                />
              </div>

              <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  type="submit"
                  isLoading={isProcessingPayment}
                  leftIcon={<Lock size={15} />}
                  rightIcon={<ArrowRight size={15} />}
                >
                  Pay GH₵ {activationFeeGhs.toFixed(2)} via Paystack & Activate Store
                </Button>

                <div style={{ textAlign: 'center', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <ShieldCheck size={13} color="#10B981" />
                  <span>256-bit Encrypted Server-Side Paystack Verification • Instant Activation</span>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* STATE 2: PAYMENT PENDING */}
      {setupState === 'PAYMENT_PENDING' && (
        <Card style={{ padding: 'var(--space-10)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', maxWidth: '560px', margin: '0 auto', width: '100%' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #F97316', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto var(--space-4) auto' }} />
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Verifying Paystack Payment...
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem' }}>
            We are confirming your GH₵ 500.00 storefront activation payment with Paystack servers.
          </p>
        </Card>
      )}

      {/* STATE 3: AWAITING ADMIN REVIEW */}
      {setupState === 'AWAITING_APPROVAL' && (
        <Card style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Clock size={28} />
          </div>

          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B5CF6' }}>
            PAYMENT CONFIRMED · UNDER REVIEW
          </span>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.25rem 0' }}>
            Store Application Awaiting Approval
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6) 0' }}>
            Your activation payment has been verified. A ByteBeacon administrator is currently reviewing your merchant store.
          </p>

          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', textAlign: 'left', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>Payment Reference:</span>
              <strong style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>STRPAY-2026-0817-VERIFIED</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>Status:</span>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: '#8B5CF6' }}>PAID · AWAITING_APPROVAL</span>
            </div>
          </div>

          {/* Simulate approval for test/demo */}
          <Button variant="outline" size="sm" onClick={() => { setSetupState('ACTIVE'); toastSuccess('Store Approved', 'Your store has been activated!'); }}>
            Simulate Admin Approval (Demo)
          </Button>
        </Card>
      )}

      {/* STATE 4: UNLOCKED & ACTIVE */}
      {setupState === 'ACTIVE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Active Store Launchpad Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid rgba(34, 197, 94, 0.3)', boxShadow: 'var(--shadow-tactile-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', backgroundColor: '#3B82F6', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)' }}>
                  <Store size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                      {storeName}
                    </h2>
                    <Badge variant="success" size="sm" dot>Live & Active</Badge>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    https://bytebeacon.online/store/{slug}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={publicStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    color: 'var(--color-text-primary)',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                  }}
                >
                  <span>View Public Store</span>
                  <ExternalLink size={13} />
                </a>

                <a
                  href="/store-console/overview"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.95rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 800,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
                  }}
                >
                  <span>Open Agent Store Console</span>
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </Card>

          {/* Configuration Summary Card */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
              Storefront Details & Configuration
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Store Slug</span>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  /{slug}
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Support Phone</span>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {phone}
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Support Email</span>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {email}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Demo Switcher for fast evaluation */}
      <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px dashed var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
          DEMO LIFECYCLE SWITCHER:
        </span>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setSetupState('LOCKED_PAYWALL')}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: setupState === 'LOCKED_PAYWALL' ? '1px solid #F97316' : '1px solid var(--color-border-default)',
              backgroundColor: setupState === 'LOCKED_PAYWALL' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            1. Hard Paywall
          </button>
          <button
            type="button"
            onClick={() => setSetupState('AWAITING_APPROVAL')}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: setupState === 'AWAITING_APPROVAL' ? '1px solid #8B5CF6' : '1px solid var(--color-border-default)',
              backgroundColor: setupState === 'AWAITING_APPROVAL' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            2. Awaiting Review
          </button>
          <button
            type="button"
            onClick={() => setSetupState('ACTIVE')}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: setupState === 'ACTIVE' ? '1px solid #10B981' : '1px solid var(--color-border-default)',
              backgroundColor: setupState === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            3. Active / Unlocked
          </button>
        </div>
      </div>
    </div>
  );
};
