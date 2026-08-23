import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PhoneInput, Input } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { MaintenanceBanner } from '../../components/navigation/MaintenanceBanner.js';
import { storesApi } from '../../api/stores.api.js';
import { ordersApi } from '../../api/orders.api.js';
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  Lock,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface PublicBundle {
  id: string;
  network: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
  dataAmountMb: number;
  dataLabel: string;
  priceGhs: number;
  validity: string;
}

const SAMPLE_PUBLIC_BUNDLES: PublicBundle[] = [
  // MTN
  { id: 'pb-1', network: 'MTN', dataAmountMb: 1024, dataLabel: '1.0 GB', priceGhs: 7.00, validity: 'Non-Expiry' },
  { id: 'pb-2', network: 'MTN', dataAmountMb: 2560, dataLabel: '2.5 GB', priceGhs: 14.00, validity: 'Non-Expiry' },
  { id: 'pb-3', network: 'MTN', dataAmountMb: 5120, dataLabel: '5.0 GB', priceGhs: 25.00, validity: 'Non-Expiry' },
  { id: 'pb-4', network: 'MTN', dataAmountMb: 10240, dataLabel: '10.0 GB', priceGhs: 46.00, validity: 'Non-Expiry' },
  { id: 'pb-5', network: 'MTN', dataAmountMb: 20480, dataLabel: '20.0 GB', priceGhs: 88.00, validity: 'Non-Expiry' },
  // Telecel
  { id: 'pb-6', network: 'TELECEL', dataAmountMb: 2048, dataLabel: '2.0 GB', priceGhs: 12.00, validity: '30 Days' },
  { id: 'pb-7', network: 'TELECEL', dataAmountMb: 5120, dataLabel: '5.0 GB', priceGhs: 24.00, validity: '30 Days' },
  { id: 'pb-8', network: 'TELECEL', dataAmountMb: 10240, dataLabel: '10.0 GB', priceGhs: 43.50, validity: '30 Days' },
  // AirtelTigo
  { id: 'pb-9', network: 'AIRTELTIGO', dataAmountMb: 3072, dataLabel: '3.0 GB', priceGhs: 15.00, validity: 'No Expiry' },
  { id: 'pb-10', network: 'AIRTELTIGO', dataAmountMb: 6144, dataLabel: '6.0 GB', priceGhs: 26.00, validity: 'No Expiry' },
  { id: 'pb-11', network: 'AIRTELTIGO', dataAmountMb: 15360, dataLabel: '15.0 GB', priceGhs: 58.00, validity: 'No Expiry' },
];

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const { toastSuccess, toastError } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  const [activeNetwork, setActiveNetwork] = useState<'MTN' | 'TELECEL' | 'AIRTELTIGO'>('MTN');
  const [selectedBundle, setSelectedBundle] = useState<PublicBundle | null>(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any | null>(null);

  const [storeInfo, setStoreInfo] = useState({
    id: 'store_default_1',
    name: 'DataHub Express',
    tagline: 'Instant Automated Telecom Data Bundles 24/7',
    description: 'Direct automated delivery of MTN, Telecel, and AirtelTigo bundles across Ghana.',
    primaryColor: '#0066FF',
    whatsapp: '+233244123456',
    phone: '0244123456',
  });

  const [bundles, setBundles] = useState<PublicBundle[]>(SAMPLE_PUBLIC_BUNDLES);

  useEffect(() => {
    if (!slug) return;
    storesApi
      .getPublicStore(slug)
      .then((res: any) => {
        if (res?.store) {
          setStoreInfo({
            id: res.store.id || 'store_default_1',
            name: res.store.storeName || 'Merchant Store',
            tagline: res.store.tagline || 'Fast Telecom Bundles',
            description: res.store.description || 'Automated bundle delivery',
            primaryColor: res.store.primaryColor || '#0066FF',
            whatsapp: res.store.contactWhatsapp || '+233244123456',
            phone: res.store.contactPhone || '0244123456',
          });
        }
        if (res?.products && Array.isArray(res.products) && res.products.length > 0) {
          const mapped: PublicBundle[] = res.products.map((p: any) => ({
            id: p.id,
            network: p.network,
            dataAmountMb: p.dataAmountMb,
            dataLabel: `${(p.dataAmountMb / 1024).toFixed(1)} GB`,
            priceGhs: Number(p.retailPricePesewas || 5000) / 100,
            validity: p.validityDays ? `${p.validityDays} Days` : 'Non-Expiry',
          }));
          setBundles(mapped);
        }
      })
      .catch(() => {
        // Fallback to sample data
      });
  }, [slug]);

  const filteredBundles = bundles.filter((b) => b.network === activeNetwork);

  const handleInitiateOrder = (bundle: PublicBundle) => {
    setSelectedBundle(bundle);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (!recipientPhone || recipientPhone.length < 10) {
      toastError('Invalid Phone', 'Please enter a valid 10-digit Ghanaian mobile number.');
      return;
    }

    setIsCheckingOut(true);
    try {
      if (selectedBundle) {
        const orderRes = await ordersApi.createOrder({
          productId: selectedBundle.id,
          recipientPhone: recipientPhone.trim(),
          idempotencyKey: `ord_sf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        });

        const generatedOrder = {
          orderId: orderRes.publicId || orderRes.id,
          phone: recipientPhone,
          bundle: selectedBundle.dataLabel,
          network: selectedBundle.network,
          amount: selectedBundle.priceGhs,
        };
        setOrderComplete(generatedOrder);
        toastSuccess('Order Placed', 'Payment processed and bundle is being dispatched!');
        return;
      }
    } catch (err: any) {
      toastError('Checkout Failed', err.message || 'Unable to complete order. Please verify your payment details and try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B0F19',
        color: '#F8FAFC',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />
      {/* 1. Header & Store Navigation */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '0.75rem var(--space-6)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: storeInfo.primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.4)',
              }}
            >
              <Store size={18} strokeWidth={2.4} />
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 900, color: '#FFFFFF', display: 'block', lineHeight: 1.1 }}>
                {storeInfo.name}
              </strong>
              <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ● Verified Merchant Store
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              to="/track"
              style={{
                fontSize: 'var(--font-size-xs)',
                color: '#94A3B8',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Track Order
            </Link>

            <a
              href={`https://wa.me/${storeInfo.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22C55E',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 800,
              }}
            >
              <MessageSquare size={13} />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Banner */}
      <div style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(0, 102, 255, 0.15)',
            color: '#38BDF8',
            display: 'inline-block',
            marginBottom: 'var(--space-3)',
          }}
        >
          Fast & Instant Data Delivery
        </span>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 900,
            color: '#FFFFFF',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          {storeInfo.tagline}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: '#94A3B8', margin: 0 }}>
          {storeInfo.description}
        </p>
      </div>

      {/* 3. Network Selection Tabs */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '0 var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { id: 'MTN', name: 'MTN Ghana', color: '#FFCC00', badge: 'Fastest' },
            { id: 'TELECEL', name: 'Telecel', color: '#E11D48', badge: 'Popular' },
            { id: 'AIRTELTIGO', name: 'AirtelTigo', color: '#2563EB', badge: 'Great Value' },
          ].map((net) => {
            const isSelected = activeNetwork === net.id;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => setActiveNetwork(net.id as any)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '12px',
                  border: isSelected ? `2px solid ${net.color}` : '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 800,
                  boxShadow: isSelected ? `0 0 16px ${net.color}33` : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: net.color }} />
                <span>{net.name}</span>
                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }}>
                  {net.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bundles Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-10)',
          }}
        >
          {filteredBundles.map((bundle) => (
            <div
              key={bundle.id}
              style={{
                borderRadius: '16px',
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 'var(--space-4)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                transition: 'transform 120ms ease, border-color 120ms ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: bundle.network === 'MTN' ? '#FFCC00' : bundle.network === 'TELECEL' ? '#E11D48' : '#2563EB',
                      color: bundle.network === 'MTN' ? '#000000' : '#FFFFFF',
                    }}
                  >
                    {bundle.network}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{bundle.validity}</span>
                </div>

                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', margin: '0.25rem 0' }}>
                  {bundle.dataLabel}
                </div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Direct High-Speed Data</span>
              </div>

              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', marginBottom: '0.5rem' }}>
                  GH₵ {bundle.priceGhs.toFixed(2)}
                </div>

                <button
                  type="button"
                  onClick={() => handleInitiateOrder(bundle)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    backgroundColor: storeInfo.primaryColor,
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
                  }}
                >
                  <span>Buy Now</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Checkout Modal */}
      {selectedBundle && !orderComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedBundle(null)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '440px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: 'var(--space-6)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              zIndex: 110,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase' }}>Express Checkout</span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: '#FFFFFF' }}>
                  Purchase {selectedBundle.dataLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBundle(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Price pill */}
            <div style={{ padding: 'var(--space-3)', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#F8FAFC' }}>
                {selectedBundle.network} · {selectedBundle.dataLabel}
              </span>
              <strong style={{ fontSize: 'var(--font-size-base)', color: '#10B981', fontFamily: 'var(--font-data)' }}>
                GH₵ {selectedBundle.priceGhs.toFixed(2)}
              </strong>
            </div>

            <form onSubmit={handleProcessPayment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {isMaintenanceMode && (
                <div
                  role="alert"
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#FBBF24',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    lineHeight: 1.4,
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Scheduled Maintenance:</strong>{' '}
                    {maintenanceMessage || 'Checkout is temporarily paused. Please check back shortly.'}
                  </div>
                </div>
              )}

              <PhoneInput
                label="Recipient Phone Number"
                placeholder="0244123456"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                required
              />

              <Input
                label="Email Address (for receipt)"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />

              <div style={{ marginTop: 'var(--space-3)' }}>
                <button
                  type="submit"
                  disabled={isCheckingOut || isMaintenanceMode}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: isMaintenanceMode ? '#334155' : storeInfo.primaryColor,
                    color: isMaintenanceMode ? '#94A3B8' : '#FFFFFF',
                    border: 'none',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 800,
                    cursor: isCheckingOut ? 'wait' : isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: !isMaintenanceMode ? '0 4px 14px rgba(0, 102, 255, 0.4)' : 'none',
                  }}
                >
                  <Lock size={14} />
                  <span>
                    {isCheckingOut
                      ? 'Securing Transaction...'
                      : isMaintenanceMode
                        ? 'Platform in Maintenance'
                        : `Pay GH₵ ${selectedBundle.priceGhs.toFixed(2)} via Paystack`}
                  </span>
                </button>
              </div>

              <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                <ShieldCheck size={12} color="#10B981" />
                <span>256-bit Encrypted Mobile Money & Card Checkout</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Order Success Modal */}
      {orderComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }} />

          <div
            style={{
              position: 'relative',
              maxWidth: '440px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '20px',
              padding: 'var(--space-6)',
              textAlign: 'center',
              zIndex: 110,
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
              <CheckCircle2 size={26} />
            </div>

            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 900, color: '#FFFFFF' }}>
              Bundle Dispatched!
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8', marginTop: '0.25rem' }}>
              Your order <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{orderComplete.orderId}</strong> has been sent for telecom fulfillment to <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{orderComplete.phone}</strong>.
            </p>

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: '0.5rem' }}>
              <Link
                to={`/track/${orderComplete.orderId}`}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Track Fulfillment
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOrderComplete(null);
                  setSelectedBundle(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: storeInfo.primaryColor,
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Footer */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: 'var(--space-6)', textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
        <p style={{ margin: 0 }}>
          Powered by <strong style={{ color: '#94A3B8' }}>ByteBeacon Telecom Platform</strong> · Secured by Paystack
        </p>
      </footer>
    </div>
  );
};
