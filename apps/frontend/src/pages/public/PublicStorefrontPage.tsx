import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PhoneInput, Input, Card, Badge, Button } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { MaintenanceBanner } from '../../components/navigation/MaintenanceBanner.js';
import { storesApi, StoreProfileDto, PublicStoreProductDto } from '../../api/stores.api.js';
import { ordersApi } from '../../api/orders.api.js';
import { STOREFRONT_CONFIG } from '../../config/storefront.config.js';
import {
  Store,
  ShieldCheck,
  CheckCircle2,
  Lock,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  Search,
  ExternalLink,
  Smartphone,
  CreditCard,
  Zap,
  PhoneCall,
  X,
} from 'lucide-react';
import { NetworkProvider, CustomerOrderDto } from '@bytebeacon/shared';

const NETWORK_COLORS: Record<NetworkProvider, { brandColor: string; bg: string; border: string; glow: string; name: string }> = {
  [NetworkProvider.MTN]: {
    brandColor: '#FFCC00',
    bg: 'rgba(255, 204, 0, 0.12)',
    border: 'rgba(255, 204, 0, 0.35)',
    glow: 'rgba(255, 204, 0, 0.25)',
    name: 'MTN Ghana',
  },
  [NetworkProvider.TELECEL]: {
    brandColor: '#E11D48',
    bg: 'rgba(225, 29, 72, 0.12)',
    border: 'rgba(225, 29, 72, 0.35)',
    glow: 'rgba(225, 29, 72, 0.25)',
    name: 'Telecel Ghana',
  },
  [NetworkProvider.AIRTELTIGO]: {
    brandColor: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.12)',
    border: 'rgba(37, 99, 235, 0.35)',
    glow: 'rgba(37, 99, 235, 0.25)',
    name: 'AirtelTigo',
  },
};

const formatDataAmount = (dataAmountMb: number): string => {
  const gb = dataAmountMb / 1024;
  return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
};

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  const storeSlug = (slug || 'default').trim().toLowerCase();

  // Store state
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [products, setProducts] = useState<PublicStoreProductDto[]>([]);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [storeNotFound, setStoreNotFound] = useState(false);

  // Filter & Network state
  const [activeNetwork, setActiveNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [bundleSearch, setBundleSearch] = useState('');

  // Checkout state
  const [selectedProduct, setSelectedProduct] = useState<PublicStoreProductDto | null>(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Order Complete / Confirmation state
  const [confirmedOrder, setConfirmedOrder] = useState<CustomerOrderDto | null>(null);

  // In-store Track Modal state
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<CustomerOrderDto | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackSearched, setTrackSearched] = useState(false);

  // Load store data
  const loadStore = useCallback(async () => {
    setIsLoadingStore(true);
    setStoreNotFound(false);
    try {
      const res = await storesApi.getPublicStore(storeSlug);
      if (res && res.store) {
        setStore(res.store);
        const prods = Array.isArray(res.products) ? res.products : [];
        setProducts(prods);

        // Auto-select first available network if MTN has no bundles
        const availableNetworks = Array.from(new Set(prods.map((p) => p.network)));
        if (availableNetworks.length > 0 && !availableNetworks.includes(activeNetwork)) {
          setActiveNetwork(availableNetworks[0] as NetworkProvider);
        }
      } else {
        setStoreNotFound(true);
      }
    } catch {
      setStoreNotFound(true);
    } finally {
      setIsLoadingStore(false);
    }
  }, [storeSlug, activeNetwork]);

  useEffect(() => {
    loadStore();
  }, [storeSlug]);

  // Handle Paystack callback verification if redirected back
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('trxref');
    if (ref) {
      setIsCheckingOut(true);
      toastInfo('Verifying Payment', 'Confirming your mobile transaction with Paystack...');
      storesApi
        .verifyPublicPayment(ref)
        .then((orderRes) => {
          setConfirmedOrder(orderRes);
          toastSuccess('Payment Verified', 'Your data bundle has been queued for immediate telecom delivery!');
        })
        .catch((err) => {
          toastError('Payment Verification Failed', err?.message || 'Unable to confirm payment. Please check tracking.');
        })
        .finally(() => {
          setIsCheckingOut(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        });
    }
  }, [searchParams]);

  // Filter products by active network and search query
  const filteredProducts = products.filter((p) => {
    const matchesNetwork = p.network === activeNetwork;
    const dataLabel = formatDataAmount(p.dataAmountMb);
    const priceGhs = (p.retailPricePesewas / 100).toFixed(2);
    const matchesSearch =
      !bundleSearch ||
      p.name.toLowerCase().includes(bundleSearch.toLowerCase()) ||
      dataLabel.toLowerCase().includes(bundleSearch.toLowerCase()) ||
      priceGhs.includes(bundleSearch);
    return matchesNetwork && matchesSearch;
  });

  // Initiate purchase modal
  const handleSelectProduct = (prod: PublicStoreProductDto) => {
    setSelectedProduct(prod);
  };

  // Submit checkout
  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (!selectedProduct) return;

    const cleanRecipient = recipientPhone.trim().replace(/\s+/g, '');
    if (!cleanRecipient || cleanRecipient.length < 10) {
      toastError('Invalid Phone', 'Please enter a valid 10-digit Ghanaian recipient phone number (e.g. 0244123456).');
      return;
    }

    setIsCheckingOut(true);
    try {
      const idempotencyKey = `ord_sf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const checkoutRes = await storesApi.publicCheckout({
        slug: store?.slug || storeSlug,
        productId: selectedProduct.id,
        recipientPhone: cleanRecipient,
        customerEmail: customerEmail.trim() || undefined,
        paymentMethod: 'PAYSTACK',
        channel: selectedChannel,
        idempotencyKey,
        callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/store/${store?.slug || storeSlug}?ref=${idempotencyKey}` : undefined,
      });

      if (checkoutRes?.payment?.authorizationUrl) {
        toastInfo('Redirecting to Paystack', 'Redirecting to secure Mobile Money & Card payment...');
        window.location.href = checkoutRes.payment.authorizationUrl;
        return;
      }

      // If instant verification / reference returned
      if (checkoutRes?.payment?.reference) {
        const verified = await storesApi.verifyPublicPayment(checkoutRes.payment.reference, checkoutRes.order.orderId);
        setConfirmedOrder(verified);
        setSelectedProduct(null);
        toastSuccess('Order Placed Successfully', 'Payment verified and data bundle is being dispatched!');
      } else {
        const fallbackOrder: CustomerOrderDto = {
          orderId: checkoutRes.order.orderId,
          status: 'READY_TO_PROCESS',
          statusLabel: 'Order Confirmed',
          paymentStatus: 'PAID',
          product: {
            name: `${checkoutRes.order.network} ${checkoutRes.order.dataLabel} Data Bundle`,
            network: checkoutRes.order.network,
            volumeDisplay: checkoutRes.order.dataLabel,
            validityDisplay: 'Non-Expiry',
          },
          recipientPhone: checkoutRes.order.recipientPhone,
          amountPesewas: checkoutRes.order.amountPesewas,
          amountDisplay: `GH₵ ${(checkoutRes.order.amountPesewas / 100).toFixed(2)}`,
          currency: 'GHS' as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConfirmedOrder(fallbackOrder);
        setSelectedProduct(null);
        toastSuccess('Order Placed', 'Payment processed and bundle is being dispatched!');
      }
    } catch (err: any) {
      toastError('Checkout Failed', err.message || 'Unable to complete order. Please verify details and try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Run in-store tracking search
  const handlePerformTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackQuery.trim();
    if (!query) return;

    setIsTracking(true);
    setTrackSearched(true);
    try {
      const res = await ordersApi.trackOrder(query);
      if (res) {
        const dataDisplay = formatDataAmount(res.dataAmountMb);
        const mapped: CustomerOrderDto = {
          orderId: res.publicId || res.id,
          status: (res.orderStatus as any) || 'PROCESSING',
          statusLabel: res.orderStatus,
          paymentStatus: res.paymentStatus as any,
          product: {
            name: `${res.network} ${dataDisplay} Data Bundle`,
            network: res.network,
            volumeDisplay: dataDisplay,
            validityDisplay: 'Non-Expiry',
          },
          recipientPhone: res.recipientPhone,
          amountPesewas: res.amountPesewas,
          amountDisplay: `GH₵ ${(res.amountPesewas / 100).toFixed(2)}`,
          currency: 'GHS' as any,
          createdAt: res.createdAt,
          updatedAt: res.updatedAt,
          completedAt: res.providerOrder?.lastSyncedAt || null,
        };
        setTrackedOrder(mapped);
      } else {
        setTrackedOrder(null);
      }
    } catch {
      setTrackedOrder(null);
    } finally {
      setIsTracking(false);
    }
  };

  // 1. Loading Skeleton View
  if (isLoadingStore) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0B0F19',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '3px solid #0066FF', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#94A3B8' }}>
          Loading Storefront & Real-Time Catalog...
        </span>
      </div>
    );
  }

  // 2. Storefront Not Found / Inactive View
  if (storeNotFound || !store) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0B0F19',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6)',
          textAlign: 'center',
        }}
      >
        <Card
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: 'var(--space-8)',
            backgroundColor: '#0F172A',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4) auto',
            }}
          >
            <Store size={28} />
          </div>

          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            Storefront Unavailable
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8', marginTop: '0.5rem', lineHeight: 1.5 }}>
            The requested merchant store <code style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>/{storeSlug}</code> does not exist, is currently undergoing maintenance, or is awaiting administrator activation.
          </p>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link
              to="/track"
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Search size={14} />
              <span>Track an Existing Order</span>
            </Link>

            <Link
              to="/"
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: '#0066FF',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.35)',
              }}
            >
              <span>Visit ByteBeacon Platform</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const primaryBrandColor = store.primaryColor || '#0066FF';
  const merchantWhatsApp = store.contactWhatsapp || store.contactPhone || '';

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
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '0.75rem var(--space-6)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Merchant Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: primaryBrandColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: `0 4px 14px ${primaryBrandColor}55`,
                flexShrink: 0,
              }}
            >
              <Store size={20} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1 }}>
                  {store.storeName}
                </strong>
                <Badge variant="success" size="sm" dot>
                  Verified Merchant
                </Badge>
              </div>
              <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                /{store.slug}
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={() => setShowTrackModal(true)}
              style={{
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#CBD5E1',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Search size={13} />
              <span>Track Order</span>
            </button>

            {merchantWhatsApp && (
              <a
                href={STOREFRONT_CONFIG.getWhatsAppUrl(merchantWhatsApp, store.storeName)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  color: '#22C55E',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  transition: 'background-color 150ms ease',
                }}
              >
                <MessageSquare size={14} />
                <span>WhatsApp Support</span>
              </a>
            )}

            {store.contactPhone && !merchantWhatsApp && (
              <a
                href={`tel:${store.contactPhone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#38BDF8',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                }}
              >
                <PhoneCall size={14} />
                <span>{store.contactPhone}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Branding Banner */}
      <div style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center', maxWidth: '820px', margin: '0 auto' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 12px',
            borderRadius: '12px',
            backgroundColor: `${primaryBrandColor}22`,
            color: '#38BDF8',
            border: `1px solid ${primaryBrandColor}44`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: 'var(--space-3)',
          }}
        >
          <Zap size={13} color="#38BDF8" />
          <span>Fast Automated Telecom Delivery · Ghana</span>
        </span>

        <h1
          style={{
            fontSize: 'clamp(1.85rem, 4.5vw, 2.75rem)',
            fontWeight: 900,
            color: '#FFFFFF',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          {store.tagline || `${store.storeName} Data Bundles`}
        </h1>

        <p style={{ fontSize: 'var(--font-size-sm)', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
          {store.description || 'Direct high-speed MTN, Telecel, and AirtelTigo data delivery with secure Paystack checkout.'}
        </p>
      </div>

      {/* 3. Network Selection Tabs & Search */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', width: '100%', padding: '0 var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
          }}
        >
          {/* Network Selection Buttons */}
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {[
              { id: NetworkProvider.MTN, label: 'MTN Ghana', color: '#FFCC00' },
              { id: NetworkProvider.TELECEL, label: 'Telecel', color: '#E11D48' },
              { id: NetworkProvider.AIRTELTIGO, label: 'AirtelTigo', color: '#2563EB' },
            ].map((net) => {
              const isSelected = activeNetwork === net.id;
              const count = products.filter((p) => p.network === net.id).length;

              return (
                <button
                  key={net.id}
                  type="button"
                  onClick={() => setActiveNetwork(net.id)}
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
                  <span>{net.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      color: isSelected ? '#FFFFFF' : '#94A3B8',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div style={{ width: '220px' }}>
            <Input
              placeholder="Search size (e.g. 5 GB)"
              value={bundleSearch}
              onChange={(e) => setBundleSearch(e.target.value)}
              leftIcon={<Search size={14} color="#94A3B8" />}
            />
          </div>
        </div>

        {/* Bundles Grid */}
        {filteredProducts.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-12)',
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              borderRadius: '20px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              marginBottom: 'var(--space-10)',
            }}
          >
            <Smartphone size={32} color="#64748B" style={{ margin: '0 auto var(--space-3) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              No bundles found for {activeNetwork}
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8', marginTop: '0.25rem' }}>
              {bundleSearch ? `No bundles matching "${bundleSearch}". Try a different size.` : 'This merchant currently has no active bundles configured for this carrier.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-10)',
            }}
          >
            {filteredProducts.map((prod) => {
              const dataLabel = formatDataAmount(prod.dataAmountMb);
              const priceGhs = prod.retailPricePesewas / 100;
              const netTheme = NETWORK_COLORS[prod.network] || NETWORK_COLORS[NetworkProvider.MTN];

              return (
                <div
                  key={prod.id}
                  style={{
                    borderRadius: '18px',
                    backgroundColor: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: 'var(--space-5)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    transition: 'transform 140ms ease, border-color 140ms ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = netTheme.brandColor;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {prod.popular && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        fontSize: '9px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        color: '#FBBF24',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                      }}
                    >
                      POPULAR
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: netTheme.brandColor,
                          color: prod.network === NetworkProvider.MTN ? '#000000' : '#FFFFFF',
                        }}
                      >
                        {prod.network}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                        {prod.validityDesc || `${prod.validityDays} Days`}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', margin: '0.25rem 0' }}>
                      {dataLabel}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Direct High-Speed 4G/5G Turbo</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', marginBottom: '0.65rem' }}>
                      GH₵ {priceGhs.toFixed(2)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      disabled={isMaintenanceMode}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        borderRadius: '10px',
                        backgroundColor: isMaintenanceMode ? 'rgba(51, 65, 85, 0.7)' : primaryBrandColor,
                        color: isMaintenanceMode ? '#94A3B8' : '#FFFFFF',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 800,
                        cursor: isMaintenanceMode ? 'not-allowed' : 'pointer',
                        opacity: isMaintenanceMode ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        boxShadow: isMaintenanceMode ? 'none' : `0 4px 14px ${primaryBrandColor}44`,
                        transition: 'transform 100ms ease',
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                      onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <span>{isMaintenanceMode ? 'Maintenance' : 'Buy Now'}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Express Checkout Modal */}
      {selectedProduct && !confirmedOrder && (
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
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedProduct(null)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '24px',
              padding: 'var(--space-6)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
              zIndex: 110,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Secure Customer Checkout
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: '#FFFFFF' }}>
                  Purchase {formatDataAmount(selectedProduct.dataAmountMb)} {selectedProduct.network}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Price pill */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#F8FAFC', display: 'block' }}>
                  {selectedProduct.network} · {formatDataAmount(selectedProduct.dataAmountMb)} Data
                </span>
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>{selectedProduct.validityDesc || `${selectedProduct.validityDays} Days`}</span>
              </div>
              <strong style={{ fontSize: '1.3rem', color: '#10B981', fontFamily: 'var(--font-data)' }}>
                GH₵ {(selectedProduct.retailPricePesewas / 100).toFixed(2)}
              </strong>
            </div>

            <form onSubmit={handleProcessCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>{maintenanceMessage || 'Checkout is temporarily paused for scheduled maintenance.'}</div>
                </div>
              )}

              <PhoneInput
                label="Recipient Phone Number (Ghana)"
                placeholder="0244123456"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                required
              />

              <Input
                label="Email Address (for digital receipt)"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />

              {/* Payment Channel */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('mobile_money')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: selectedChannel === 'mobile_money' ? '2px solid #0066FF' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: selectedChannel === 'mobile_money' ? 'rgba(0, 102, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Smartphone size={14} color="#38BDF8" />
                    <span>Mobile Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('card')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: selectedChannel === 'card' ? '2px solid #0066FF' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: selectedChannel === 'card' ? 'rgba(0, 102, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <CreditCard size={14} color="#38BDF8" />
                    <span>Debit Card</span>
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-3)' }}>
                <button
                  type="submit"
                  disabled={isCheckingOut || isMaintenanceMode}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    backgroundColor: isMaintenanceMode ? '#334155' : primaryBrandColor,
                    color: isMaintenanceMode ? '#94A3B8' : '#FFFFFF',
                    border: 'none',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 900,
                    cursor: isCheckingOut ? 'wait' : isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: !isMaintenanceMode ? `0 4px 16px ${primaryBrandColor}55` : 'none',
                  }}
                >
                  <Lock size={15} />
                  <span>
                    {isCheckingOut
                      ? 'Securing Payment...'
                      : isMaintenanceMode
                      ? 'Platform in Maintenance'
                      : `Pay GH₵ ${(selectedProduct.retailPricePesewas / 100).toFixed(2)} via Paystack`}
                  </span>
                </button>
              </div>

              <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                <ShieldCheck size={13} color="#10B981" />
                <span>256-bit Encrypted Server-Side Paystack Verification</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Order Confirmation Modal */}
      {confirmedOrder && (
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
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)' }} />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '24px',
              padding: 'var(--space-6)',
              textAlign: 'center',
              zIndex: 110,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#22C55E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4) auto',
              }}
            >
              <CheckCircle2 size={30} />
            </div>

            <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 900, color: '#FFFFFF' }}>
              Bundle Dispatched!
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#94A3B8', marginTop: '0.35rem', lineHeight: 1.5 }}>
              Your order <strong style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{confirmedOrder.orderId}</strong> has been confirmed and queued for direct telecom delivery to <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{confirmedOrder.recipientPhone}</strong>.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: 'var(--space-4)',
                margin: 'var(--space-4) 0',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#64748B' }}>Package:</span>
                <strong style={{ color: '#FFFFFF' }}>{confirmedOrder.product.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#64748B' }}>Amount Paid:</span>
                <strong style={{ color: '#10B981', fontFamily: 'var(--font-data)' }}>{confirmedOrder.amountDisplay}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#64748B' }}>Status:</span>
                <span style={{ color: '#38BDF8', fontWeight: 800 }}>● {confirmedOrder.statusLabel}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                to={`/track/${confirmedOrder.orderId}`}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>Live Tracker</span>
                <ExternalLink size={13} />
              </Link>

              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setSelectedProduct(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  backgroundColor: primaryBrandColor,
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

      {/* 6. In-Store Quick Order Tracking Modal */}
      {showTrackModal && (
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
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowTrackModal(false)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              padding: 'var(--space-6)',
              zIndex: 110,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Delivery Tracking
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: '#FFFFFF' }}>
                  Track Order Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePerformTrack} style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Order ID (e.g. ord_sf_... or phone)"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  leftIcon={<Search size={14} color="#94A3B8" />}
                />
              </div>
              <Button variant="primary" size="md" type="submit" isLoading={isTracking}>
                Search
              </Button>
            </form>

            {trackedOrder ? (
              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748B' }}>Order ID:</span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{trackedOrder.orderId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748B' }}>Package:</span>
                  <strong style={{ color: '#FFFFFF' }}>{trackedOrder.product.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748B' }}>Recipient:</span>
                  <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>{trackedOrder.recipientPhone}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#64748B' }}>Status:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>● {trackedOrder.statusLabel}</span>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <Link
                    to={`/track/${trackedOrder.orderId}`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 102, 255, 0.15)',
                      border: '1px solid rgba(0, 102, 255, 0.35)',
                      color: '#38BDF8',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    Open Detailed Tracker Timeline →
                  </Link>
                </div>
              </div>
            ) : trackSearched && !isTracking ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#EF4444', fontSize: 'var(--font-size-xs)' }}>
                No order found matching "{trackQuery}". Please verify your order reference.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 7. Storefront Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          fontSize: '11px',
          color: '#64748B',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span>© {new Date().getFullYear()} {store.storeName} · Powered by </span>
            <strong style={{ color: '#94A3B8' }}>ByteBeacon Telecom Platform</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/track" style={{ color: '#94A3B8', textDecoration: 'none' }}>Order Tracking</Link>
            <span style={{ color: '#334155' }}>•</span>
            <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={13} /> Secured by Paystack
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
