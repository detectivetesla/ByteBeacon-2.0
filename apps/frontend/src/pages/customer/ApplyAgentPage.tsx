import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, Select } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWalletBalance } from '../../hooks/useWalletBalance.js';
import { agentsApi } from '../../api/agents.api.js';
import { AgentApplicationDto } from '@bytebeacon/shared';
import {
  TrendingUp,
  Store,
  Code2,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Phone,
  Building,
  User,
  CreditCard,
  Wallet,
} from 'lucide-react';

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Eastern',
  'Western',
  'Western North',
  'Volta',
  'Oti',
  'Northern',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
];

export const ApplyAgentPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { balanceGhs, balancePesewas } = useWalletBalance();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [application, setApplication] = useState<AgentApplicationDto | null>(null);
  const [feeGhs, setFeeGhs] = useState<number>(100);
  const [feePesewas, setFeePesewas] = useState<number>(10000);
  const [paymentMethod, setPaymentMethod] = useState<'PAYSTACK' | 'WALLET'>('PAYSTACK');

  // Form Fields
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    slug: '',
    phone: '',
    email: '',
    locationRegion: 'Greater Accra',
    experienceDescription: '',
  });

  // Slug auto-generation state
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.fullName || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  // Load application and fee data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await agentsApi.getMyApplication();
      if (res) {
        setIsAgent(res.isAgent);
        setApplication(res.application);
        if (res.currentFeeGhs) {
          setFeeGhs(res.currentFeeGhs);
          setFeePesewas(res.currentFeePesewas);
        }
      }
    } catch {
      // Fallback: fetch fee separately
      try {
        const feeRes = await agentsApi.getApplicationFee();
        if (feeRes) {
          setFeeGhs(feeRes.feeGhs);
          setFeePesewas(feeRes.feePesewas);
        }
      } catch {}
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check Paystack verification query parameter on return
  useEffect(() => {
    const verifyRef = searchParams.get('verify') || searchParams.get('reference') || searchParams.get('trxref');
    if (verifyRef) {
      toastInfo('Verifying Application Payment', 'Confirming transaction with payment gateway...');
      agentsApi
        .verifyPayment(verifyRef)
        .then((updatedApp) => {
          toastSuccess(
            'Application Submitted!',
            'Your agent application and payment have been verified. Platform administrators have been notified for review.',
          );
          setApplication(updatedApp);
        })
        .catch((err: any) => {
          toastError('Payment Verification Notice', err.message || 'Could not verify payment automatically.');
        })
        .finally(() => {
          setSearchParams({});
          loadData();
        });
    } else {
      loadData();
    }
  }, [searchParams, setSearchParams, toastInfo, toastSuccess, toastError, loadData]);

  // Handle business name input to auto-slugify
  const handleBusinessNameChange = (val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, businessName: val };
      if (!isSlugManuallyEdited) {
        updated.slug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      }
      return updated;
    });
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.businessName.trim() || !formData.slug.trim() || !formData.phone.trim()) {
      toastError('Missing Details', 'Please fill in your Business Name, Store Slug, and Contact Phone.');
      return;
    }

    if (formData.slug.trim().length < 3) {
      toastError('Slug Too Short', 'Storefront slug must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await agentsApi.apply({
        fullName: formData.fullName.trim() || user?.fullName || 'Agent Applicant',
        businessName: formData.businessName.trim(),
        slug: formData.slug.trim().toLowerCase(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || user?.email || '',
        locationRegion: formData.locationRegion,
        experienceDescription: formData.experienceDescription.trim(),
        paymentMethod,
      });

      // If paid via wallet immediately
      if (res.paymentStatus === 'PAID') {
        toastSuccess(
          'Application Submitted!',
          'Your registration fee was paid from your wallet. Administrators have been notified to verify your account.',
        );
        setApplication(res);
        setIsSubmitting(false);
        return;
      }

      // If Paystack authorization URL is returned
      if (res.authorizationUrl) {
        toastInfo('Redirecting to Paystack', 'Opening secure checkout for application payment...');
        window.location.href = res.authorizationUrl;
        return;
      }

      // Check if Paystack Pop inline is available
      const paystackKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY) || '';
      if ((window as any).PaystackPop && paystackKey && !paystackKey.includes('placeholder')) {
        const handler = (window as any).PaystackPop.setup({
          key: paystackKey,
          email: formData.email || user?.email || 'customer@bytebeacon.com',
          amount: feePesewas,
          currency: 'GHS',
          ref: res.paystackReference,
          callback: (response: any) => {
            toastInfo('Verifying Payment', 'Confirming payment with administrators...');
            agentsApi
              .verifyPayment(response.reference)
              .then((updatedApp) => {
                toastSuccess('Application Complete!', 'Your agent application is now submitted for review.');
                setApplication(updatedApp);
              })
              .catch((verErr: any) => {
                toastError('Verification Issue', verErr.message || 'Payment logged. Admin will review.');
                loadData();
              });
          },
          onClose: () => {
            toastInfo('Payment Paused', 'You can complete your application fee payment at any time.');
            loadData();
          },
        });
        handler.openIframe();
        setIsSubmitting(false);
        return;
      }

      // Simulation/Test environment verification fallback
      if (res.paystackReference) {
        toastInfo('Finalizing Application', 'Confirming registration in platform registry...');
        const verified = await agentsApi.verifyPayment(res.paystackReference);
        toastSuccess(
          'Application Submitted!',
          'Your agent application has been submitted and administrators have been notified for review.',
        );
        setApplication(verified);
      }
    } catch (err: any) {
      toastError('Application Submission Failed', err.message || 'Could not submit application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '360px' }}>
        <RefreshCw size={28} className="animate-spin" color="var(--color-primary)" />
      </div>
    );
  }

  // 2. User is already an active Agent
  if (isAgent || user?.role === 'agent') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Card elevated accentColor="emerald" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-bright, #22C55E)',
              }}
            >
              <CheckCircle2 size={36} strokeWidth={2.4} />
            </div>
          </div>
          <Badge variant="success" size="md" style={{ marginBottom: 'var(--space-3)' }}>
            AGENT ACCOUNT ACTIVE
          </Badge>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>
            You are a Registered ByteBeacon Agent
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto var(--space-6)' }}>
            Your account has full agent privileges, wholesale tier pricing, sub-agent capabilities, and access to the dedicated Agent Operations Portal.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/agent/dashboard')} rightIcon={<ArrowRight size={18} />}>
              Open Agent Portal
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/app/buy-data')}>
              Buy Personal Data
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Application is already submitted and Under Review
  if (application && application.status === 'PENDING_APPROVAL' && application.paymentStatus === 'PAID') {
    return (
      <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Under Review Notice Banner */}
        <Card elevated accentColor="cyan" style={{ padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EAB308',
                flexShrink: 0,
              }}
            >
              <Clock size={30} strokeWidth={2.4} />
            </div>

            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Badge variant="warning" size="md">
                  APPLICATION UNDER REVIEW
                </Badge>
                <Badge variant="success" size="md">
                  FEE PAID: GH₵ {application.feeGhs.toFixed(2)}
                </Badge>
              </div>

              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.25rem 0 0.5rem 0' }}>
                Your Agent Application is Being Verified
              </h2>

              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Thank you for applying to become a ByteBeacon agent! Your payment of <strong>GH₵ {application.feeGhs.toFixed(2)}</strong> has been verified and an in-app alert was dispatched to our platform administrators.
                Once approved, your role will automatically upgrade to <strong>AGENT</strong> and you will receive access to wholesale margins and the Agent Operations Portal.
              </p>
            </div>
          </div>

          {/* Application Details Summary */}
          <div
            style={{
              marginTop: 'var(--space-6)',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Business / Brand Name
              </span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                {application.businessName}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Storefront Slug
              </span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.2rem' }}>
                apisolutions.store/{application.slug}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Contact Phone
              </span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                {application.phone}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Location Region
              </span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
                {application.locationRegion || 'Not specified'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Payment Reference
              </span>
              <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                {application.paystackReference || 'Verified'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Submitted At
              </span>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                {new Date(application.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="md" onClick={loadData} leftIcon={<RefreshCw size={14} />}>
              Refresh Status
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Default View: Application Form with Dynamic Price & Value Props
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Top Header */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            RESELLER PARTNERSHIP
          </span>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            AGENT ONBOARDING
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Apply for Agent Status
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.35rem', maxWidth: '560px' }}>
              Join the ByteBeacon telecom reseller network. Enjoy exclusive wholesale margins across MTN, Telecel, and AirtelTigo, white-labeled storefronts, and developer REST APIs.
            </p>
          </div>

          {/* Dynamic Fee Pill */}
          <div
            style={{
              padding: '0.65rem 1.15rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-primary-bright, #22C55E)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              One-Time Application Fee
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>
              GH₵ {feeGhs.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Previous Rejection Alert (if re-applying) */}
      {application && application.status === 'REJECTED' && (
        <Card elevated accentColor="red" style={{ padding: 'var(--space-5)', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={20} color="var(--color-accent-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-accent-red)', margin: 0 }}>
                Previous Application Feedback
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                {application.adminNotes || 'Your previous submission did not meet reseller requirements. You may update your business details and submit a new application below.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 4 Value Proposition Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {[
          {
            icon: TrendingUp,
            title: 'Top Wholesale Margins',
            desc: 'Save significantly on every gigabyte sold with automated volume discount tiers.',
            color: 'security' as const,
          },
          {
            icon: Store,
            title: 'Branded Storefront',
            desc: 'Get your own custom-branded data website with MoMo checkout and unified float.',
            color: 'analytics' as const,
          },
          {
            icon: Code2,
            title: 'Developer REST API',
            desc: 'Automated fulfillment endpoints with HMAC-signed webhooks and idempotent requests.',
            color: 'api' as const,
          },
          {
            icon: Zap,
            title: 'Direct Settlements',
            desc: 'Instant wallet withdrawals and commission settlement straight to your phone.',
            color: 'wallet' as const,
          },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <TactileIcon icon={item.icon} color={item.color} size="sm" />
            <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              {item.title}
            </h4>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Application Form & Payment Box */}
      <Card elevated accentColor="brand" style={{ padding: 'var(--space-8)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Agent Business Registration Form
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0' }}>
              Please provide accurate business information. This will be verified by ByteBeacon administration.
            </p>
          </div>

          {/* Form Row 1: Full Name & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Applicant Full Name <span style={{ color: 'var(--color-accent-red)' }}>*</span>
              </label>
              <Input
                placeholder="e.g. Kwame Mensah"
                value={formData.fullName}
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                required
                leftIcon={<User size={15} />}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Account Email <span style={{ color: 'var(--color-accent-red)' }}>*</span>
              </label>
              <Input
                type="email"
                placeholder="e.g. kwame@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Form Row 2: Business Name & Slug */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Business / Brand Name <span style={{ color: 'var(--color-accent-red)' }}>*</span>
              </label>
              <Input
                placeholder="e.g. Accra Fast Data Hub"
                value={formData.businessName}
                onChange={(e) => handleBusinessNameChange(e.target.value)}
                required
                leftIcon={<Building size={15} />}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Storefront / Agent Slug <span style={{ color: 'var(--color-accent-red)' }}>*</span>
              </label>
              <Input
                placeholder="e.g. accra-fast-data"
                value={formData.slug}
                onChange={(e) => {
                  setIsSlugManuallyEdited(true);
                  setFormData((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                  }));
                }}
                required
              />
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Your custom link: <code>apisolutions.store/{formData.slug || 'your-slug'}</code>
              </span>
            </div>
          </div>

          {/* Form Row 3: Phone & Region */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Contact / MoMo Phone Number <span style={{ color: 'var(--color-accent-red)' }}>*</span>
              </label>
              <Input
                placeholder="e.g. 0241234567"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                required
                leftIcon={<Phone size={15} />}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
                Primary Operational Region
              </label>
              <Select
                value={formData.locationRegion}
                onChange={(e) => setFormData((prev) => ({ ...prev, locationRegion: e.target.value }))}
                options={GHANA_REGIONS.map((reg) => ({ value: reg, label: reg }))}
              />
            </div>
          </div>

          {/* Form Row 4: Experience / Sales Channels */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--color-text-primary)' }}>
              Brief Description of Business / Sales Channels
            </label>
            <Input
              placeholder="e.g. Physical retail store in Madina; selling to university students and campus groups via WhatsApp."
              value={formData.experienceDescription}
              onChange={(e) => setFormData((prev) => ({ ...prev, experienceDescription: e.target.value }))}
            />
          </div>

          {/* Payment Selection Box */}
          <div
            style={{
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Agent Application & Onboarding Fee
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0' }}>
                  A one-time verification fee of <strong>GH₵ {feeGhs.toFixed(2)}</strong> is required to submit your application to administration.
                </p>
              </div>

              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary-bright, #22C55E)' }}>
                GH₵ {feeGhs.toFixed(2)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              {/* Paystack Option */}
              <div
                onClick={() => setPaymentMethod('PAYSTACK')}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${paymentMethod === 'PAYSTACK' ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                  backgroundColor: paymentMethod === 'PAYSTACK' ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <CreditCard size={20} color={paymentMethod === 'PAYSTACK' ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Mobile Money / Card
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    Instant via Paystack gateway
                  </div>
                </div>
              </div>

              {/* Wallet Option */}
              <div
                onClick={() => setPaymentMethod('WALLET')}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${paymentMethod === 'WALLET' ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                  backgroundColor: paymentMethod === 'WALLET' ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Wallet size={20} color={paymentMethod === 'WALLET' ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    ByteBeacon Wallet
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: balancePesewas >= feePesewas ? 'var(--color-primary-bright)' : 'var(--color-accent-red)' }}>
                    Available: GH₵ {balanceGhs.toFixed(2)} {balancePesewas < feePesewas ? '(Insufficient)' : '✓'}
                  </div>
                </div>
              </div>
            </div>

            {/* Trust & Guarantee Note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <ShieldCheck size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Protected with 256-bit encrypted checkout. Admin verification is triggered immediately upon payment.
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: 'var(--space-2)' }}>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => navigate('/app/dashboard')}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={isSubmitting || (paymentMethod === 'WALLET' && balancePesewas < feePesewas)}
              rightIcon={<ArrowRight size={18} />}
            >
              {paymentMethod === 'WALLET'
                ? `Pay GH₵ ${feeGhs.toFixed(2)} from Wallet & Apply`
                : `Pay GH₵ ${feeGhs.toFixed(2)} via Paystack & Apply`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
