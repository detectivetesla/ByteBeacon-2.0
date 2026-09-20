import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  AlertCircle,
  Smartphone,
  Moon,
  Sun,
} from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';

export const ApiSolutionsPortalPage: React.FC = () => {
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(true);
  const [storeSlugInput, setStoreSlugInput] = useState('');

  // Dynamic Head Metadata, Favicon, and Manifest (Zero ByteBeacon leaks)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const originalTitle = document.title;
      document.title = 'API Solutions — Independent Mobile Telecom Data Storefront Network';

      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      const originalHref = link.href;
      link.type = 'image/svg+xml';
      link.href = '/storefront-icon.svg';

      let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = '/manifest.json';

      const updatedMetas: { el: HTMLMetaElement; originalContent: string | null; isNew: boolean }[] = [];
      const setOrCreateMeta = (attrName: string, attrVal: string, contentVal: string) => {
        let el = document.querySelector(`meta[${attrName}="${attrVal}"]`) as HTMLMetaElement;
        if (el) {
          updatedMetas.push({ el, originalContent: el.getAttribute('content'), isNew: false });
          el.setAttribute('content', contentVal);
        } else {
          el = document.createElement('meta');
          el.setAttribute(attrName, attrVal);
          el.setAttribute('content', contentVal);
          document.head.appendChild(el);
          updatedMetas.push({ el, originalContent: null, isNew: true });
        }
      };

      setOrCreateMeta('name', 'description', 'API Solutions Network - Instant automated mobile telecom data delivery across Ghana.');
      setOrCreateMeta('property', 'og:title', 'API Solutions — Independent Mobile Telecom Data Storefront Network');
      setOrCreateMeta('property', 'og:description', 'Instant automated mobile telecom data delivery across MTN, Telecel, and AT in Ghana.');
      setOrCreateMeta('property', 'og:site_name', 'API Solutions Network');
      setOrCreateMeta('property', 'og:image', '/storefront-icon.svg');
      setOrCreateMeta('name', 'twitter:title', 'API Solutions — Independent Mobile Telecom Data Storefront Network');
      setOrCreateMeta('name', 'twitter:description', 'Instant automated mobile telecom data delivery across MTN, Telecel, and AT in Ghana.');
      setOrCreateMeta('name', 'twitter:image', '/storefront-icon.svg');

      return () => {
        document.title = originalTitle;
        link.href = originalHref;
        updatedMetas.forEach(({ el, originalContent, isNew }) => {
          if (isNew) {
            el.remove();
          } else if (originalContent !== null) {
            el.setAttribute('content', originalContent);
          }
        });
      };
    }
  }, []);

  // Order Tracking State
  const [trackOrderId, setTrackOrderId] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const t = {
    bgPage: isDark ? '#0A0C10' : '#F8FAFC',
    bgCard: isDark ? '#12151E' : '#FFFFFF',
    bgCardInner: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    borderHighlight: isDark ? 'rgba(163, 230, 53, 0.35)' : 'rgba(132, 204, 22, 0.4)',
    textPrimary: isDark ? '#FFFFFF' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    accent: '#A3E635',
    accentBg: isDark ? 'rgba(163, 230, 53, 0.12)' : '#ECFCCB',
  };

  const handleGoToStore = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = storeSlugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (clean) {
      navigate(`/store/${clean}`);
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = trackOrderId.trim();
    if (!orderId) return;

    setIsTracking(true);
    setTrackError(null);
    setTrackedOrder(null);

    try {
      const res = await ordersApi.trackOrder(orderId);
      if (res?.success && res.order) {
        setTrackedOrder(res.order);
      } else {
        setTrackError('Order not found. Please double-check your Order ID.');
      }
    } catch (err: any) {
      setTrackError(err?.message || 'Unable to track order. Please try again.');
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: t.bgPage,
        color: t.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Header */}
      <header
        style={{
          borderBottom: `1px solid ${t.border}`,
          backgroundColor: isDark ? 'rgba(10, 12, 16, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '0.85rem 1.25rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo & Brand Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: t.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                boxShadow: '0 4px 12px rgba(163, 230, 53, 0.3)',
              }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontWeight: 900, fontSize: '16px', letterSpacing: '-0.02em', color: t.textPrimary }}>
                  API SOLUTIONS
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '6px',
                    backgroundColor: t.accentBg,
                    color: isDark ? '#A3E635' : '#4D7C0F',
                    textTransform: 'uppercase',
                  }}
                >
                  Network
                </span>
              </div>
              <span style={{ fontSize: '11px', color: t.textSecondary, display: 'block' }}>
                Independent Telecom Data Storefronts
              </span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              style={{
                background: 'none',
                border: `1px solid ${t.border}`,
                borderRadius: '8px',
                padding: '0.45rem',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Toggle theme"
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main style={{ flex: 1, padding: '2.5rem 1.25rem 4rem 1.25rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '100px',
                backgroundColor: t.accentBg,
                border: `1px solid ${t.borderHighlight}`,
                marginBottom: '1rem',
              }}
            >
              <Radio size={14} color="#A3E635" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#A3E635' : '#4D7C0F', textTransform: 'uppercase' }}>
                Automated Carrier Telecommunications Network
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                fontWeight: 900,
                color: t.textPrimary,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                margin: '0 0 1rem 0',
              }}
            >
              Find Your Agent's Store <br />
              <span style={{ color: t.accent }}>or Track Your Data Order</span>
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: t.textSecondary,
                maxWidth: '560px',
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              Welcome to the independent customer portal of the API Solutions Telecom Network.
              Connect directly with verified agent shops or check your live order delivery.
            </p>
          </div>

          {/* Two-Column Search & Track Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem',
            }}
          >
            {/* Card 1: Find Store */}
            <div
              style={{
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                borderRadius: '20px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: t.accentBg,
                    color: isDark ? '#A3E635' : '#4D7C0F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Store size={22} />
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 0.4rem 0', color: t.textPrimary }}>
                  Find Agent Storefront
                </h2>
                <p style={{ fontSize: '12px', color: t.textSecondary, margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
                  Enter your agent's unique store slug or brand identifier to browse their catalog and buy data bundles.
                </p>
              </div>

              <form onSubmit={handleGoToStore} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: t.bgCardInner,
                    border: `1px solid ${t.border}`,
                    borderRadius: '12px',
                    padding: '0.2rem 0.5rem 0.2rem 0.85rem',
                  }}
                >
                  <span style={{ fontSize: '12px', color: t.textSecondary, fontFamily: 'monospace' }}>
                    apisolutions.store/store/
                  </span>
                  <input
                    type="text"
                    placeholder="agent-slug"
                    value={storeSlugInput}
                    onChange={(e) => setStoreSlugInput(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: t.textPrimary,
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '0.6rem 0.4rem',
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: t.accent,
                    color: '#000000',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span>Open Storefront</span>
                  <ArrowRight size={15} />
                </button>
              </form>
            </div>

            {/* Card 2: Track Order */}
            <div
              style={{
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                borderRadius: '20px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    color: '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Search size={22} />
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 0.4rem 0', color: t.textPrimary }}>
                  Universal Order Tracker
                </h2>
                <p style={{ fontSize: '12px', color: t.textSecondary, margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
                  Placed an order on any agent storefront? Check real-time telecom carrier dispatch with your Order ID.
                </p>
              </div>

              <form onSubmit={handleTrackOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: t.bgCardInner,
                    border: `1px solid ${t.border}`,
                    borderRadius: '12px',
                    padding: '0.2rem 0.5rem 0.2rem 0.85rem',
                  }}
                >
                  <Search size={15} color={t.textSecondary} />
                  <input
                    type="text"
                    placeholder="Enter Order ID (e.g. ord_sf_...)"
                    value={trackOrderId}
                    onChange={(e) => setTrackOrderId(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: t.textPrimary,
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '0.6rem 0.65rem',
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isTracking}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                    color: t.textPrimary,
                    border: `1px solid ${t.border}`,
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: isTracking ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>{isTracking ? 'Searching...' : 'Track Order Status'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Tracked Order Result Modal / Card */}
          {trackError && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#F87171',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '2rem',
              }}
            >
              <AlertCircle size={18} />
              <span>{trackError}</span>
            </div>
          )}

          {trackedOrder && (
            <div
              style={{
                backgroundColor: t.bgCard,
                border: `1px solid ${t.borderHighlight}`,
                borderRadius: '18px',
                padding: '1.5rem',
                marginBottom: '2.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '11px', color: t.accent, fontWeight: 900, textTransform: 'uppercase' }}>
                    Order Found
                  </span>
                  <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '16px', fontWeight: 800, color: t.textPrimary }}>
                    {trackedOrder.product?.name || 'Telecom Data Package'}
                  </h3>
                  <span style={{ fontSize: '11px', color: t.textSecondary, fontFamily: 'monospace' }}>
                    ID: {trackedOrder.orderId}
                  </span>
                </div>
                <div
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor:
                      trackedOrder.status === 'SUCCESS' || trackedOrder.status === 'DELIVERED'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : trackedOrder.status === 'PENDING' || trackedOrder.status === 'PROCESSING'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color:
                      trackedOrder.status === 'SUCCESS' || trackedOrder.status === 'DELIVERED'
                        ? '#22C55E'
                        : trackedOrder.status === 'PENDING' || trackedOrder.status === 'PROCESSING'
                        ? '#F59E0B'
                        : '#EF4444',
                  }}
                >
                  {trackedOrder.statusLabel || trackedOrder.status || 'PROCESSED'}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.75rem',
                  padding: '1rem',
                  backgroundColor: t.bgCardInner,
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: t.textSecondary, display: 'block', fontSize: '11px' }}>Recipient Phone</span>
                  <strong style={{ color: t.textPrimary, fontFamily: 'monospace' }}>{trackedOrder.recipientPhone}</strong>
                </div>
                <div>
                  <span style={{ color: t.textSecondary, display: 'block', fontSize: '11px' }}>Carrier Network</span>
                  <strong style={{ color: t.textPrimary }}>{trackedOrder.product?.network || 'Ghana Telecom'}</strong>
                </div>
                <div>
                  <span style={{ color: t.textSecondary, display: 'block', fontSize: '11px' }}>Amount</span>
                  <strong style={{ color: '#10B981' }}>{trackedOrder.amountDisplay || 'Paid'}</strong>
                </div>
                <div>
                  <span style={{ color: t.textSecondary, display: 'block', fontSize: '11px' }}>Date</span>
                  <strong style={{ color: t.textPrimary }}>
                    {trackedOrder.createdAt ? new Date(trackedOrder.createdAt).toLocaleDateString() : 'Recent'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* 3. Value Props / Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '16px',
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <Smartphone size={20} color="#38BDF8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '13px', fontWeight: 800, color: t.textPrimary }}>
                  All Major Networks
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: t.textSecondary, lineHeight: 1.4 }}>
                  Automated top-ups across MTN Ghana, Telecel, and AT Ghana.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '16px',
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <Zap size={20} color="#A3E635" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '13px', fontWeight: 800, color: t.textPrimary }}>
                  Real-Time Dispatch
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: t.textSecondary, lineHeight: 1.4 }}>
                  Bundles delivered within minutes via direct telco API integration.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '1.25rem',
                borderRadius: '16px',
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <ShieldCheck size={20} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '13px', fontWeight: 800, color: t.textPrimary }}>
                  Encrypted Checkout
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: t.textSecondary, lineHeight: 1.4 }}>
                  Official Paystack verification for Mobile Money payments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. White-Labeled Footer */}
      <footer
        style={{
          borderTop: `1px solid ${t.border}`,
          padding: '1.5rem 1.25rem',
          backgroundColor: isDark ? '#080A0E' : '#F1F5F9',
          textAlign: 'center',
          fontSize: '11px',
          color: t.textSecondary,
        }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            © {new Date().getFullYear()} API Solutions Network. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span>Telecom Carrier API Gateway</span>
            <span>•</span>
            <span>256-bit SSL</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
