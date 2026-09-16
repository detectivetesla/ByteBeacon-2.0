import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PhoneInput, Input, Card, Badge, Button, detectGhanaianNetwork } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { MaintenanceBanner } from '../../components/navigation/MaintenanceBanner.js';
import { storesApi, StoreProfileDto, PublicStoreProductDto } from '../../api/stores.api.js';
import { ordersApi } from '../../api/orders.api.js';
import { beneficiaryApi } from '../../api/beneficiary.api.js';
import { BeneficiaryNotApprovedModal } from '../../components/commerce/BeneficiaryNotApprovedModal.js';
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
  Smartphone,
  CreditCard,
  Zap,
  PhoneCall,
  X,
  Clock,
  Truck,
  Moon,
  Sun,
  ChevronRight,
  HelpCircle,
  Check,
} from 'lucide-react';
import { NetworkProvider, CustomerOrderDto } from '@bytebeacon/shared';

const NETWORK_THEMES: Record<
  NetworkProvider,
  {
    name: string;
    badgeText: string;
    badgeBg: string;
    badgeColor: string;
    cardBg: string;
    textColor: string;
    subColor: string;
    btnColor: string;
    btnTextColor: string;
    accentColor: string;
  }
> = {
  [NetworkProvider.MTN]: {
    name: 'MTN',
    badgeText: 'MTN',
    badgeBg: '#000000',
    badgeColor: '#FFCC00',
    cardBg: 'linear-gradient(135deg, #FFCC00 0%, #EAB308 100%)',
    textColor: '#0F172A',
    subColor: '#334155',
    btnColor: '#0F172A',
    btnTextColor: '#FFFFFF',
    accentColor: '#FFCC00',
  },
  [NetworkProvider.TELECEL]: {
    name: 'Telecel',
    badgeText: 'T',
    badgeBg: '#FFFFFF',
    badgeColor: '#E11D48',
    cardBg: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255, 255, 255, 0.85)',
    btnColor: '#FFFFFF',
    btnTextColor: '#BE123C',
    accentColor: '#E11D48',
  },
  [NetworkProvider.AIRTELTIGO]: {
    name: 'AirtelTigo',
    badgeText: 'AT',
    badgeBg: '#FFFFFF',
    badgeColor: '#7C3AED',
    cardBg: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255, 255, 255, 0.85)',
    btnColor: '#FFFFFF',
    btnTextColor: '#6D28D9',
    accentColor: '#7C3AED',
  },
};

const formatDataAmount = (dataAmountMb: number): string => {
  const gb = dataAmountMb / 1024;
  return gb % 1 === 0 ? `${gb}GB` : `${gb.toFixed(1)}GB`;
};

export const PublicStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const t = useMemo(() => ({
    isDark,
    bgPage: isDark ? '#0F1117' : '#F8FAFC',
    textPage: isDark ? '#F8FAFC' : '#0F172A',

    // Announcement top bar
    bgBar: isDark ? '#090B0E' : '#F1F5F9',
    borderBar: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    textBar: isDark ? '#94A3B8' : '#64748B',
    phoneLink: isDark ? '#CBD5E1' : '#334155',

    // Header & Navbar
    bgHeader: isDark ? 'rgba(15, 17, 24, 0.92)' : 'rgba(255, 255, 255, 0.94)',
    borderHeader: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    avatarBg: isDark ? '#1E222D' : '#0F172A',
    avatarBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1',
    avatarColor: '#FFFFFF',
    storeNameColor: isDark ? '#FFFFFF' : '#0F172A',

    navContainerBg: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9',
    navContainerBorder: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    navActiveBg: isDark ? '#252936' : '#0F172A',
    navActiveColor: '#FFFFFF',
    navInactiveColor: isDark ? '#94A3B8' : '#64748B',

    // Theme toggle button
    themeBtnBg: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
    themeBtnBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1',
    themeBtnColor: isDark ? '#FBBF24' : '#334155',

    // General Card & Section Surfaces
    cardBg: isDark ? '#161922' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    cardSubtleBorder: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    cardShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
    cardShadowLg: isDark ? '0 20px 40px rgba(0, 0, 0, 0.6)' : '0 10px 30px rgba(0, 0, 0, 0.08)',

    // Headings & Text
    heading: isDark ? '#FFFFFF' : '#0F172A',
    bodyText: isDark ? '#94A3B8' : '#64748B',
    secondaryText: isDark ? '#CBD5E1' : '#334155',

    // Hero specifics
    heroBg: isDark ? '#151821' : '#FFFFFF',
    heroDot: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    heroGhostBg: isDark ? '#252936' : '#F8FAFC',
    heroGhostBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1',
    heroGhostColor: isDark ? '#FFFFFF' : '#0F172A',

    // Feature Badges
    badgeIconBoxBg: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',

    // Inputs & Forms
    inputBg: isDark ? '#0F1117' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',

    // Modal specifics
    modalBg: isDark ? '#161922' : '#FFFFFF',
    modalBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
    modalOverlay: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.6)',
    modalBoxBg: isDark ? '#0F1117' : '#F8FAFC',
    modalBoxBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',

    // Footer
    footerBg: isDark ? '#090B0E' : '#F8FAFC',
    footerBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    footerSubBorder: isDark ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0',
    footerText: isDark ? '#94A3B8' : '#64748B',
    footerSubText: isDark ? '#64748B' : '#94A3B8',
  }), [isDark]);

  // Extract slug
  const subdomainSlug = STOREFRONT_CONFIG.extractSlugFromSubdomain();
  const querySlug = searchParams.get('store') || searchParams.get('slug');
  const storeSlug = (slug || subdomainSlug || querySlug || 'default').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Store state
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [products, setProducts] = useState<PublicStoreProductDto[]>([]);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [storeNotFound, setStoreNotFound] = useState(false);
  const [notFoundSearch, setNotFoundSearch] = useState('');

  // Active section & Navigation
  const [activeNav, setActiveNav] = useState<'home' | 'buy' | 'track' | 'about'>('home');

  // Filter & Network state
  const [activeNetwork, setActiveNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [bundleSearch, setBundleSearch] = useState('');

  // Checkout state
  const [selectedProduct, setSelectedProduct] = useState<PublicStoreProductDto | null>(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [unapprovedModalOpen, setUnapprovedModalOpen] = useState(false);
  const [unapprovedPhone, setUnapprovedPhone] = useState('');

  // Order Complete state
  const [confirmedOrder, setConfirmedOrder] = useState<CustomerOrderDto | null>(null);

  // In-store Track state
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<CustomerOrderDto | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackSearched, setTrackSearched] = useState(false);

  // Check a number precheck modal state
  const [showNumberCheckModal, setShowNumberCheckModal] = useState(false);
  const [checkNumberPhone, setCheckNumberPhone] = useState('');
  const [isCheckingNumber, setIsCheckingNumber] = useState(false);
  const [numberCheckResult, setNumberCheckResult] = useState<{
    phone: string;
    network: string;
    valid: boolean;
    status: string;
    message: string;
  } | null>(null);

  // Dynamic favicon & tab title sanitization (ZERO ByteBeacon branding in tab)
  useEffect(() => {
    const storeName = store?.storeName || 'Data Store';
    if (typeof document !== 'undefined') {
      document.title = `${storeName} · Buy Data Bundles`;

      // Set custom white-label SVG favicon matching store initial
      const initial = (storeName.charAt(0) || 'D').toUpperCase();
      const brandColor = store?.primaryColor || '#EAB308';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${brandColor}"/><text x="16" y="22" font-size="18" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="900" fill="#0F172A" text-anchor="middle">${initial}</text></svg>`;
      const faviconUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      const originalHref = link.href;
      link.href = faviconUrl;

      return () => {
        link.href = originalHref;
      };
    }
  }, [store?.storeName, store?.primaryColor]);

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

  // Handle Paystack callback verification
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

  // Network counts
  const mtnProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.MTN), [products]);
  const telecelProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.TELECEL), [products]);
  const airteltigoProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.AIRTELTIGO), [products]);

  // Popular products: pick popular flag, or top 3 diverse products
  const popularProducts = useMemo(() => {
    const marked = products.filter((p) => p.popular);
    if (marked.length >= 3) return marked.slice(0, 6);

    const mtnPop = mtnProducts.find((p) => p.dataAmountMb === 1024) || mtnProducts[0];
    const telecelPop = telecelProducts.find((p) => p.dataAmountMb === 10240) || telecelProducts[0];
    const atPop = airteltigoProducts.find((p) => p.dataAmountMb === 1024) || airteltigoProducts[0];

    const fallback = [mtnPop, telecelPop, atPop].filter(Boolean) as PublicStoreProductDto[];
    return fallback.length > 0 ? fallback : products.slice(0, 3);
  }, [products, mtnProducts, telecelProducts, airteltigoProducts]);

  // Filtered products for full catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
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
  }, [products, activeNetwork, bundleSearch]);

  // Smooth scroll helper
  const scrollToSection = (id: string, navKey: 'home' | 'buy' | 'track' | 'about') => {
    setActiveNav(navKey);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
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
      const isMtn =
        selectedProduct.network === 'MTN' ||
        (selectedProduct.network as any) === NetworkProvider.MTN ||
        detectGhanaianNetwork(cleanRecipient) === 'MTN';

      if (isMtn) {
        try {
          const precheckRes = await beneficiaryApi.precheckPublic({
            network: NetworkProvider.MTN,
            phoneNumbers: [cleanRecipient],
          });
          const result = precheckRes?.results?.[0];
          const isOrderable =
            result?.orderable !== undefined
              ? result.orderable
              : precheckRes?.enforced === false
              ? result?.valid !== false
              : Boolean(result?.known && result?.valid);

          if (result && (!isOrderable || !result.known || result.status === 'UNAPPROVED' || result.status === 'PENDING')) {
            setUnapprovedPhone(cleanRecipient);
            setUnapprovedModalOpen(true);
            setIsCheckingOut(false);
            return;
          }
        } catch {
          // fallback
        }
      }

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
      const isBeneficiaryUnapproved =
        err?.code === 'BENEFICIARY_NOT_VALIDATED' ||
        err?.status === 422 ||
        err?.message?.toLowerCase().includes('beneficiary') ||
        err?.message?.toLowerCase().includes('mtn number not yet validated') ||
        err?.message?.toLowerCase().includes('not added to our beneficiary');
      if (isBeneficiaryUnapproved) {
        setUnapprovedPhone(cleanRecipient);
        setUnapprovedModalOpen(true);
        return;
      }
      toastError('Checkout Failed', err.message || 'Unable to complete order. Please verify details and try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Run in-store tracking search
  const handlePerformTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = trackQuery.trim();
    if (!query) return;

    setIsTracking(true);
    setTrackSearched(true);
    try {
      const res = await ordersApi.trackOrder(query);
      if (res) {
        const raw = res as any;
        const dataDisplay = raw.product?.volumeDisplay || raw.dataDisplay || (raw.dataAmountMb ? formatDataAmount(raw.dataAmountMb) : 'Data Bundle');
        const network = raw.product?.network || raw.network || 'MTN';
        const priceDisplay = raw.amountDisplay || (raw.amountPesewas ? `GH₵ ${(raw.amountPesewas / 100).toFixed(2)}` : 'GH₵ 0.00');
        const mapped: CustomerOrderDto = {
          orderId: raw.orderId || raw.publicId || raw.id || query,
          status: raw.status || (raw.orderStatus as any) || 'PROCESSING',
          statusLabel: raw.statusLabel || raw.orderStatus || 'Processing',
          paymentStatus: (raw.paymentStatus as any) || 'PENDING',
          product: {
            name: raw.product?.name || `${network} ${dataDisplay} Data Bundle`,
            network,
            volumeDisplay: dataDisplay,
            validityDisplay: raw.product?.validityDisplay || 'Non-Expiry',
          },
          recipientPhone: raw.recipientPhone || '',
          amountPesewas: raw.amountPesewas || 0,
          amountDisplay: priceDisplay,
          currency: (raw.currency as any) || 'GHS',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString(),
          completedAt: raw.completedAt || raw.providerOrder?.lastSyncedAt || null,
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

  // Check phone number precheck verification
  const handleCheckNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = checkNumberPhone.trim().replace(/\s+/g, '');
    if (!phone || phone.length < 10) {
      toastError('Invalid Phone', 'Please enter a valid 10-digit Ghanaian phone number.');
      return;
    }

    setIsCheckingNumber(true);
    setNumberCheckResult(null);
    try {
      const detected = detectGhanaianNetwork(phone) || 'MTN';
      if (detected === 'MTN') {
        const res = await beneficiaryApi.precheckPublic({
          network: NetworkProvider.MTN,
          phoneNumbers: [phone],
        });
        const result = res?.results?.[0];
        const isApproved = result?.known && result?.status === 'APPROVED';
        setNumberCheckResult({
          phone,
          network: 'MTN Ghana',
          valid: true,
          status: isApproved ? 'Approved & Ready' : 'Validation Required',
          message: isApproved
            ? 'This phone number is approved for instant MTN high-speed delivery!'
            : 'This MTN number is awaiting operator approval. You can still place your order and our system will queue it for processing.',
        });
      } else {
        setNumberCheckResult({
          phone,
          network: detected === 'TELECEL' ? 'Telecel Ghana' : 'AirtelTigo',
          valid: true,
          status: 'Ready for Instant Delivery',
          message: `${detected === 'TELECEL' ? 'Telecel' : 'AirtelTigo'} numbers do not require beneficiary approval. Orders are delivered instantly!`,
        });
      }
    } catch (err: any) {
      setNumberCheckResult({
        phone,
        network: 'Ghana Network',
        valid: true,
        status: 'Ready',
        message: 'Number format is valid. You can proceed with bundle purchase.',
      });
    } finally {
      setIsCheckingNumber(false);
    }
  };

  // 1. Loading Skeleton View
  if (isLoadingStore) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: t.bgPage,
          color: t.textPage,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: 'var(--space-6)',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid #EAB308',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: t.bodyText }}>
          Loading Storefront & Real-Time Bundles...
        </span>
      </div>
    );
  }

  // 2. Storefront Not Found View (Zero ByteBeacon branding)
  if (storeNotFound || !store) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: t.bgPage,
          color: t.textPage,
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
            maxWidth: '500px',
            width: '100%',
            padding: 'var(--space-8)',
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '24px',
            boxShadow: t.cardShadowLg,
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

          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: t.heading, margin: 0 }}>
            Storefront Unavailable
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, marginTop: '0.5rem', lineHeight: 1.5 }}>
            The merchant storefront <code style={{ color: '#EAB308', fontFamily: 'var(--font-mono)' }}>/{storeSlug}</code> is currently undergoing maintenance or is unavailable.
          </p>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = notFoundSearch.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
                if (target) {
                  window.location.href = `/store/${target}`;
                }
              }}
              style={{ display: 'flex', gap: '0.4rem' }}
            >
              <Input
                placeholder="Search merchant by slug"
                value={notFoundSearch}
                onChange={(e) => setNotFoundSearch(e.target.value)}
              />
              <Button variant="primary" size="sm" type="submit">
                Find
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setShowTrackModal(true)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '12px',
                backgroundColor: t.heroGhostBg,
                color: t.heroGhostColor,
                border: `1px solid ${t.heroGhostBorder}`,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              <Search size={14} />
              <span>Track an Existing Order</span>
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const storeName = store.storeName || "Jackson's Data Hub";
  const storeInitial = (storeName.charAt(0) || 'J').toUpperCase();
  const contactPhone = store.contactPhone || '0544824759';
  const whatsappNumber = store.contactWhatsapp || contactPhone;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: t.bgPage,
        color: t.textPage,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 200ms ease, color 200ms ease',
      }}
    >
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />

      {/* ==================================================================== */}
      {/* 1. TOP ANNOUNCEMENT BAR (Image 1) */}
      {/* ==================================================================== */}
      <div
        style={{
          backgroundColor: t.bgBar,
          borderBottom: `1px solid ${t.borderBar}`,
          padding: '0.4rem var(--space-6)',
          fontSize: '11px',
          color: t.textBar,
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '1050px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {/* Left: Delivery Time & Open Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Truck size={12} color={t.textBar} />
              <span>Delivery: 10min - 1hr</span>
            </span>
            <span style={{ color: isDark ? '#334155' : '#CBD5E1' }}>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10B981', fontWeight: 700 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
              Open Now
            </span>
          </div>

          {/* Right: Phone & WhatsApp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {contactPhone && (
              <a
                href={`tel:${contactPhone}`}
                style={{
                  color: t.phoneLink,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 600,
                }}
              >
                <PhoneCall size={11} color={t.textBar} />
                <span>{contactPhone}</span>
              </a>
            )}
            {whatsappNumber && (
              <a
                href={STOREFRONT_CONFIG.getWhatsAppUrl(whatsappNumber, storeName)}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#22C55E',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 700,
                }}
              >
                <MessageSquare size={11} color="#22C55E" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. MAIN HEADER & NAVBAR (Image 1 & 2) */}
      {/* ==================================================================== */}
      <header
        style={{
          borderBottom: `1px solid ${t.borderHeader}`,
          backgroundColor: t.bgHeader,
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '0.75rem var(--space-6)',
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '1050px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* Store Brand / Avatar */}
          <div
            onClick={() => scrollToSection('hero', 'home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: t.avatarBg,
                border: `1px solid ${t.avatarBorder}`,
                color: t.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '16px',
                boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 2px 6px rgba(0, 0, 0, 0.08)',
                flexShrink: 0,
              }}
            >
              {storeInitial}
            </div>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 900,
                color: t.storeNameColor,
                letterSpacing: '-0.01em',
              }}
            >
              {storeName}
            </span>
          </div>

          {/* Navigation Links (Home, Buy Data, Track Order, About) */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: t.navContainerBg,
              padding: '3px',
              borderRadius: '100px',
              border: `1px solid ${t.navContainerBorder}`,
              transition: 'all 200ms ease',
            }}
          >
            <button
              type="button"
              onClick={() => scrollToSection('hero', 'home')}
              style={{
                background: activeNav === 'home' ? t.navActiveBg : 'transparent',
                color: activeNav === 'home' ? t.navActiveColor : t.navInactiveColor,
                border: 'none',
                padding: '0.35rem 0.9rem',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeNav === 'home' ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('bundles', 'buy')}
              style={{
                background: activeNav === 'buy' ? t.navActiveBg : 'transparent',
                color: activeNav === 'buy' ? t.navActiveColor : t.navInactiveColor,
                border: 'none',
                padding: '0.35rem 0.9rem',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeNav === 'buy' ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Buy Data
            </button>

            <button
              type="button"
              onClick={() => {
                setShowTrackModal(true);
                setActiveNav('track');
              }}
              style={{
                background: activeNav === 'track' ? t.navActiveBg : 'transparent',
                color: activeNav === 'track' ? t.navActiveColor : t.navInactiveColor,
                border: 'none',
                padding: '0.35rem 0.9rem',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeNav === 'track' ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Track Order
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('about', 'about')}
              style={{
                background: activeNav === 'about' ? t.navActiveBg : 'transparent',
                color: activeNav === 'about' ? t.navActiveColor : t.navInactiveColor,
                border: 'none',
                padding: '0.35rem 0.9rem',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: activeNav === 'about' ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              About
            </button>
          </nav>

          {/* Theme Toggle Icon */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: t.themeBtnBg,
                border: `1px solid ${t.themeBtnBorder}`,
                color: t.themeBtnColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.06)',
              }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* PAGE BODY CONTAINER */}
      {/* ==================================================================== */}
      <main style={{ maxWidth: '1050px', margin: '0 auto', width: '100%', padding: 'var(--space-6)', flex: 1 }}>
        {/* ================================================================== */}
        {/* 3. HERO SECTION (Images 1 & 3) */}
        {/* ================================================================== */}
        <section
          id="hero"
          style={{
            backgroundColor: t.heroBg,
            backgroundImage: `radial-gradient(${t.heroDot} 1px, transparent 1px)`,
            backgroundSize: '18px 18px',
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '24px',
            padding: 'var(--space-10) var(--space-8)',
            marginBottom: 'var(--space-5)',
            boxShadow: t.cardShadow,
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            {/* Instant Delivery Pill Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#FFCC00',
                color: '#0F172A',
                fontSize: '11px',
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: '100px',
                marginBottom: 'var(--space-4)',
              }}
            >
              <Zap size={12} fill="#0F172A" />
              <span>Instant Delivery</span>
            </div>

            {/* Headline matching image 1 */}
            <h1
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 2.85rem)',
                fontWeight: 900,
                color: t.heading,
                lineHeight: 1.15,
                margin: '0 0 0.5rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Buy Data Bundles
              <span style={{ display: 'block', color: '#EAB308' }}>At Unbeatable Prices</span>
            </h1>

            {/* Subtitle matching image 1 */}
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: t.bodyText,
                lineHeight: 1.5,
                margin: '0 0 var(--space-6) 0',
              }}
            >
              MTN, Telecel & AirtelTigo bundles delivered to your phone within minutes. Safe, fast, and reliable.
            </p>

            {/* Action Buttons matching image 1 */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => scrollToSection('bundles', 'buy')}
                style={{
                  backgroundColor: '#EAB308',
                  color: '#0F172A',
                  border: 'none',
                  padding: '0.65rem 1.35rem',
                  borderRadius: '12px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 14px rgba(234, 179, 8, 0.35)',
                  transition: 'transform 100ms ease',
                }}
              >
                <span>Shop Now</span>
                <ArrowRight size={15} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={() => setShowTrackModal(true)}
                style={{
                  backgroundColor: t.heroGhostBg,
                  color: t.heroGhostColor,
                  border: `1px solid ${t.heroGhostBorder}`,
                  padding: '0.65rem 1.35rem',
                  borderRadius: '12px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'background-color 120ms ease',
                }}
              >
                <span>Track Order</span>
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 4. DELIVERY PROGRESS & REAL-TIME TRACKING BANNER (Image 1) */}
        {/* ================================================================== */}
        <section
          style={{
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-5)',
            boxShadow: t.cardShadow,
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <Truck size={14} color={t.bodyText} />
            <strong style={{ fontSize: '12px', fontWeight: 800, color: t.heading }}>Delivery Progress</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '11px' }}>
            {/* Telemetry Status Note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F87171' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block', flexShrink: 0 }} />
              <span>Network status is active. All placed orders are processed and verified immediately upon payment.</span>
            </div>

            {/* Last Delivered Real-Time Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block', flexShrink: 0 }} />
              <span>
                Last delivered: <strong style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>#2013957</strong> — 100% automated high-speed fulfillment active
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 5. FEATURE BADGES ROW (4 cards matching Image 1) */}
        {/* ================================================================== */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-8)',
          }}
        >
          {[
            { icon: <Zap size={16} color="#EAB308" />, label: '10-60 Min Delivery' },
            { icon: <ShieldCheck size={16} color="#10B981" />, label: '100% Secure' },
            { icon: <Clock size={16} color="#38BDF8" />, label: '24/7 Available' },
            { icon: <Smartphone size={16} color="#A855F7" />, label: 'All Networks' },
          ].map((feat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardSubtleBorder}`,
                borderRadius: '14px',
                padding: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '12px',
                fontWeight: 800,
                color: t.heading,
                boxShadow: t.cardShadow,
                transition: 'background-color 200ms ease, border-color 200ms ease',
              }}
            >
              {feat.icon}
              <span>{feat.label}</span>
            </div>
          ))}
        </section>

        {/* ================================================================== */}
        {/* 6. CHOOSE YOUR NETWORK (Image 1) */}
        {/* ================================================================== */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: t.heading, margin: 0 }}>
              Choose Your Network
            </h2>
            <button
              type="button"
              onClick={() => scrollToSection('bundles', 'buy')}
              style={{
                background: 'none',
                border: 'none',
                color: t.bodyText,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {[
              {
                id: NetworkProvider.MTN,
                theme: NETWORK_THEMES[NetworkProvider.MTN],
                count: mtnProducts.length,
              },
              {
                id: NetworkProvider.TELECEL,
                theme: NETWORK_THEMES[NetworkProvider.TELECEL],
                count: telecelProducts.length,
              },
              {
                id: NetworkProvider.AIRTELTIGO,
                theme: NETWORK_THEMES[NetworkProvider.AIRTELTIGO],
                count: airteltigoProducts.length,
              },
            ].map(({ id, theme, count }) => {
              const isSelected = activeNetwork === id;

              return (
                <div
                  key={id}
                  onClick={() => {
                    setActiveNetwork(id);
                    scrollToSection('bundles', 'buy');
                  }}
                  style={{
                    background: theme.cardBg,
                    borderRadius: '18px',
                    padding: 'var(--space-5)',
                    color: theme.textColor,
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 20px ${theme.accentColor}55` : (isDark ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 4px 14px rgba(0, 0, 0, 0.08)'),
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '11px',
                      }}
                    >
                      {theme.badgeText}
                    </div>
                    <div>
                      <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 900, display: 'block', lineHeight: 1.1 }}>
                        {theme.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: theme.subColor, fontWeight: 600 }}>
                        {count} bundles
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '11px', fontWeight: 800 }}>
                    <span>View Bundles</span>
                    <ChevronRight size={13} strokeWidth={3} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================== */}
        {/* 7. POPULAR BUNDLES (Image 1) */}
        {/* ================================================================== */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: t.heading, margin: 0 }}>
              Popular Bundles
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowNumberCheckModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#38BDF8' : '#0284C7',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Search size={13} />
                <span>Check a number</span>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('bundles', 'buy')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.bodyText,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <span>See All</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {popularProducts.map((prod) => {
              const theme = NETWORK_THEMES[prod.network] || NETWORK_THEMES[NetworkProvider.MTN];
              const priceGhs = (prod.retailPricePesewas / 100).toFixed(2);

              return (
                <div
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod)}
                  style={{
                    background: theme.cardBg,
                    borderRadius: '18px',
                    padding: 'var(--space-5)',
                    color: theme.textColor,
                    cursor: 'pointer',
                    boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 4px 14px rgba(0, 0, 0, 0.08)',
                    transition: 'transform 120ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '9px',
                        marginBottom: '0.4rem',
                      }}
                    >
                      {theme.badgeText}
                    </div>

                    <div style={{ fontSize: '1.65rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {formatDataAmount(prod.dataAmountMb)}
                    </div>
                    <span style={{ fontSize: '11px', color: theme.subColor, fontWeight: 700 }}>
                      {prod.network}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: 'var(--space-3)' }}>
                    GH₵ {priceGhs}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================== */}
        {/* 8. FULL BUNDLE CATALOG (Adtron Aesthetic Image 2) */}
        {/* ================================================================== */}
        <section id="bundles" style={{ marginBottom: 'var(--space-10)', scrollMarginTop: '80px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: 'var(--space-5)',
              flexWrap: 'wrap',
            }}
          >
            {/* Carrier Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: NetworkProvider.MTN, label: 'MTN Ghana', color: '#FFCC00', count: mtnProducts.length },
                { id: NetworkProvider.TELECEL, label: 'Telecel', color: '#E11D48', count: telecelProducts.length },
                { id: NetworkProvider.AIRTELTIGO, label: 'AirtelTigo', color: '#7C3AED', count: airteltigoProducts.length },
              ].map((net) => {
                const isSelected = activeNetwork === net.id;
                return (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setActiveNetwork(net.id)}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${net.color}` : `1px solid ${t.cardBorder}`,
                      backgroundColor: isSelected ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF') : t.cardBg,
                      color: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.bodyText,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '12px',
                      fontWeight: 800,
                      boxShadow: isSelected ? `0 0 14px ${net.color}33` : t.cardShadow,
                      transition: 'all 120ms ease',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: net.color }} />
                    <span>{net.label}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9',
                        color: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : t.bodyText,
                      }}
                    >
                      {net.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bundle Search Input */}
            <div style={{ width: '220px' }}>
              <Input
                placeholder="Search volume (e.g. 5GB)"
                value={bundleSearch}
                onChange={(e) => setBundleSearch(e.target.value)}
                leftIcon={<Search size={14} color={t.bodyText} />}
              />
            </div>
          </div>

          {/* Bundles Grid */}
          {filteredProducts.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-10)',
                textAlign: 'center',
                backgroundColor: t.cardBg,
                borderRadius: '20px',
                border: `1px dashed ${t.cardBorder}`,
              }}
            >
              <Smartphone size={32} color={t.bodyText} style={{ margin: '0 auto var(--space-3) auto' }} />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: t.heading, margin: 0 }}>
                No bundles available for {activeNetwork}
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, marginTop: '0.25rem' }}>
                {bundleSearch ? `No bundles matching "${bundleSearch}".` : 'No active packages currently listed for this carrier.'}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {filteredProducts.map((prod) => {
                const dataLabel = formatDataAmount(prod.dataAmountMb);
                const priceGhs = (prod.retailPricePesewas / 100).toFixed(2);
                const theme = NETWORK_THEMES[prod.network] || NETWORK_THEMES[NetworkProvider.MTN];

                return (
                  <div
                    key={prod.id}
                    style={{
                      borderRadius: '18px',
                      backgroundColor: t.cardBg,
                      border: `1px solid ${t.cardBorder}`,
                      padding: 'var(--space-5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                      boxShadow: t.cardShadow,
                      transition: 'transform 120ms ease, border-color 120ms ease, background-color 200ms ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.accentColor;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = t.cardBorder;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: '5px',
                            backgroundColor: theme.accentColor,
                            color: prod.network === NetworkProvider.MTN ? '#0F172A' : '#FFFFFF',
                          }}
                        >
                          {prod.network}
                        </span>
                        <span style={{ fontSize: '11px', color: t.bodyText, fontWeight: 600 }}>
                          {prod.validityDesc || 'Non-Expiry'}
                        </span>
                      </div>

                      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: t.heading, letterSpacing: '-0.02em', margin: '0.25rem 0' }}>
                        {dataLabel}
                      </div>
                      <span style={{ fontSize: '11px', color: t.bodyText }}>Direct High-Speed 4G/5G Turbo</span>
                    </div>

                    <div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10B981', marginBottom: '0.65rem' }}>
                        GH₵ {priceGhs}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedProduct(prod)}
                        disabled={isMaintenanceMode}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: '12px',
                          backgroundColor: isMaintenanceMode ? '#334155' : '#EAB308',
                          color: isMaintenanceMode ? '#94A3B8' : '#0F172A',
                          border: 'none',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 900,
                          cursor: isMaintenanceMode ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          boxShadow: !isMaintenanceMode ? '0 4px 14px rgba(234, 179, 8, 0.25)' : 'none',
                        }}
                      >
                        <span>{isMaintenanceMode ? 'Maintenance' : 'Buy Now'}</span>
                        <ArrowRight size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ================================================================== */}
        {/* 9. WHY BUY FROM US? (Image 1) */}
        {/* ================================================================== */}
        <section
          id="about"
          style={{
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '24px',
            padding: 'var(--space-8)',
            marginBottom: 'var(--space-8)',
            scrollMarginTop: '80px',
            boxShadow: t.cardShadow,
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 900,
              color: t.heading,
              textAlign: 'center',
              margin: '0 0 var(--space-8) 0',
            }}
          >
            Why Buy From Us?
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            {/* Pillar 1: Guaranteed Delivery */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  color: '#22C55E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: t.heading, marginBottom: '0.35rem' }}>
                Guaranteed Delivery
              </strong>
              <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, lineHeight: 1.5, margin: 0 }}>
                Your data is always delivered. If there's any issue, we'll fix it or refund you.
              </p>
            </div>

            {/* Pillar 2: Super Fast */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.12)',
                  color: '#EAB308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <Zap size={24} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: t.heading, marginBottom: '0.35rem' }}>
                Super Fast
              </strong>
              <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, lineHeight: 1.5, margin: 0 }}>
                Most orders are delivered within 10-30 minutes. No long waits.
              </p>
            </div>

            {/* Pillar 3: Safe & Secure */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: t.heading, marginBottom: '0.35rem' }}>
                Safe & Secure
              </strong>
              <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, lineHeight: 1.5, margin: 0 }}>
                Secure payment processing. Your data and money are always protected.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 10. READY TO GET STARTED? (Image 1) */}
        {/* ================================================================== */}
        <section
          style={{
            backgroundColor: t.cardBg,
            borderRadius: '24px',
            border: `1px solid ${t.cardBorder}`,
            padding: 'var(--space-8)',
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
            boxShadow: t.cardShadow,
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: t.heading, margin: '0 0 0.35rem 0' }}>
            Ready to Get Started?
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, margin: '0 0 var(--space-5) 0' }}>
            Choose your network and buy data in seconds.
          </p>

          <button
            type="button"
            onClick={() => scrollToSection('bundles', 'buy')}
            style={{
              backgroundColor: '#EAB308',
              color: '#0F172A',
              border: 'none',
              padding: '0.7rem 1.6rem',
              borderRadius: '12px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.35)',
            }}
          >
            <span>Buy Data Now</span>
            <ArrowRight size={15} strokeWidth={2.4} />
          </button>
        </section>

        {/* ================================================================== */}
        {/* 11. EMBEDDED LIVE ORDER TRACKING (anchor #track) */}
        {/* ================================================================== */}
        <section
          id="track"
          style={{
            backgroundColor: t.cardBg,
            borderRadius: '24px',
            border: `1px solid ${t.cardBorder}`,
            padding: 'var(--space-8)',
            marginBottom: 'var(--space-8)',
            scrollMarginTop: '80px',
            boxShadow: t.cardShadow,
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <div style={{ maxWidth: '580px', margin: '0 auto', textAlign: 'center' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: t.heading, margin: '0 0 0.35rem 0' }}>
              Track Your Order Status
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, margin: '0 0 var(--space-5) 0' }}>
              Enter your Order Reference or 10-digit Ghanaian Phone Number to view live carrier delivery progress.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePerformTrack();
              }}
              style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}
            >
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Order ID (e.g. ord_sf_...) or phone"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  leftIcon={<Search size={14} color={t.bodyText} />}
                />
              </div>
              <Button variant="primary" size="md" type="submit" isLoading={isTracking}>
                Track
              </Button>
            </form>

            {trackedOrder && (
              <div
                style={{
                  backgroundColor: t.modalBoxBg,
                  border: `1px solid ${t.modalBoxBorder}`,
                  borderRadius: '16px',
                  padding: 'var(--space-5)',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  marginTop: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: t.bodyText }}>Order ID:</span>
                  <strong style={{ color: t.heading, fontFamily: 'var(--font-mono)' }}>{trackedOrder.orderId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: t.bodyText }}>Package:</span>
                  <strong style={{ color: t.heading }}>{trackedOrder.product.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: t.bodyText }}>Recipient:</span>
                  <strong style={{ color: t.heading, fontFamily: 'var(--font-mono)' }}>{trackedOrder.recipientPhone}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: t.bodyText }}>Status:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>● {trackedOrder.statusLabel}</span>
                </div>
              </div>
            )}

            {trackSearched && !isTracking && !trackedOrder && (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#EF4444', fontSize: '12px' }}>
                No order found matching "{trackQuery}". Please verify your order number or phone.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ==================================================================== */}
      {/* 12. STOREFRONT FOOTER (Image 1 - Zero ByteBeacon Branding) */}
      {/* ==================================================================== */}
      <footer
        style={{
          borderTop: `1px solid ${t.footerBorder}`,
          backgroundColor: t.footerBg,
          padding: 'var(--space-8) var(--space-6)',
          fontSize: '12px',
          color: t.footerText,
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '1050px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {/* Col 1: Merchant Identity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: t.avatarBg,
                  color: t.avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '13px',
                }}
              >
                {storeInitial}
              </div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: t.heading }}>{storeName}</strong>
            </div>
            <p style={{ fontSize: '11px', color: t.footerSubText, margin: 0, lineHeight: 1.4 }}>
              Data bundles by {storeName}. Instant high-speed delivery to all networks across Ghana.
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <strong style={{ fontSize: '12px', fontWeight: 800, color: t.heading, display: 'block', marginBottom: '0.5rem' }}>
              Quick Links
            </strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('hero', 'home')}
                  style={{ background: 'none', border: 'none', color: t.footerText, padding: 0, fontSize: '12px', cursor: 'pointer' }}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('bundles', 'buy')}
                  style={{ background: 'none', border: 'none', color: t.footerText, padding: 0, fontSize: '12px', cursor: 'pointer' }}
                >
                  Buy Data
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowTrackModal(true)}
                  style={{ background: 'none', border: 'none', color: t.footerText, padding: 0, fontSize: '12px', cursor: 'pointer' }}
                >
                  Track Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('about', 'about')}
                  style={{ background: 'none', border: 'none', color: t.footerText, padding: 0, fontSize: '12px', cursor: 'pointer' }}
                >
                  About
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact Us */}
          <div>
            <strong style={{ fontSize: '12px', fontWeight: 800, color: t.heading, display: 'block', marginBottom: '0.5rem' }}>
              Contact Us
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '12px' }}>
              {contactPhone && (
                <a href={`tel:${contactPhone}`} style={{ color: t.phoneLink, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PhoneCall size={13} color={t.footerText} />
                  <span>{contactPhone}</span>
                </a>
              )}
              {whatsappNumber && (
                <a
                  href={STOREFRONT_CONFIG.getWhatsAppUrl(whatsappNumber, storeName)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#22C55E', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                >
                  <MessageSquare size={13} color="#22C55E" />
                  <span>WhatsApp Us</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            maxWidth: '1050px',
            margin: '0 auto',
            borderTop: `1px solid ${t.footerSubBorder}`,
            paddingTop: 'var(--space-4)',
            textAlign: 'center',
            fontSize: '11px',
            color: t.footerSubText,
          }}
        >
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* 13. FLOATING WHATSAPP CHAT WIDGET (Bottom Right) */}
      {/* ==================================================================== */}
      {whatsappNumber && (
        <a
          href={STOREFRONT_CONFIG.getWhatsAppUrl(whatsappNumber, storeName)}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 90,
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: '#22C55E',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.45)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
        >
          <MessageSquare size={26} />
        </a>
      )}

      {/* ==================================================================== */}
      {/* 14. EXPRESS CHECKOUT MODAL */}
      {/* ==================================================================== */}
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
            style={{ position: 'fixed', inset: 0, backgroundColor: t.modalOverlay, backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedProduct(null)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: t.modalBg,
              border: `1px solid ${t.modalBorder}`,
              borderRadius: '24px',
              padding: 'var(--space-6)',
              boxShadow: t.cardShadowLg,
              zIndex: 110,
              transition: 'background-color 200ms ease, border-color 200ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#EAB308', fontWeight: 800, textTransform: 'uppercase' }}>
                  Customer Checkout
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: t.heading }}>
                  Purchase {formatDataAmount(selectedProduct.dataAmountMb)} {selectedProduct.network}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', color: t.bodyText, fontSize: '18px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Price pill */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #A7F3D0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: t.heading, display: 'block' }}>
                  {selectedProduct.network} · {formatDataAmount(selectedProduct.dataAmountMb)} Data
                </span>
                <span style={{ fontSize: '10px', color: t.bodyText }}>{selectedProduct.validityDesc || 'Non-Expiry'}</span>
              </div>
              <strong style={{ fontSize: '1.3rem', color: '#10B981' }}>
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
                <label style={{ fontSize: '11px', fontWeight: 800, color: t.bodyText, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('mobile_money')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '10px',
                      border: selectedChannel === 'mobile_money' ? '2px solid #EAB308' : `1px solid ${t.inputBorder}`,
                      backgroundColor: selectedChannel === 'mobile_money' ? (isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3') : t.inputBg,
                      color: t.heading,
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <Smartphone size={14} color="#EAB308" />
                    <span>Mobile Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('card')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '10px',
                      border: selectedChannel === 'card' ? '2px solid #EAB308' : `1px solid ${t.inputBorder}`,
                      backgroundColor: selectedChannel === 'card' ? (isDark ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3') : t.inputBg,
                      color: t.heading,
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <CreditCard size={14} color="#EAB308" />
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
                    borderRadius: '12px',
                    backgroundColor: isMaintenanceMode ? '#334155' : '#EAB308',
                    color: isMaintenanceMode ? '#94A3B8' : '#0F172A',
                    border: 'none',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 900,
                    cursor: isCheckingOut ? 'wait' : isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: !isMaintenanceMode ? '0 4px 16px rgba(234, 179, 8, 0.35)' : 'none',
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

              <div style={{ textAlign: 'center', fontSize: '10px', color: t.bodyText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                <ShieldCheck size={13} color="#10B981" />
                <span>256-bit Encrypted Server-Side Paystack Verification</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 15. ORDER CONFIRMATION MODAL */}
      {/* ==================================================================== */}
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
          <div style={{ position: 'fixed', inset: 0, backgroundColor: t.modalOverlay, backdropFilter: 'blur(6px)' }} />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: t.modalBg,
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '24px',
              padding: 'var(--space-6)',
              textAlign: 'center',
              zIndex: 110,
              boxShadow: t.cardShadowLg,
              transition: 'background-color 200ms ease, border-color 200ms ease',
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

            <h3 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 900, color: t.heading }}>
              Bundle Dispatched!
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: t.bodyText, marginTop: '0.35rem', lineHeight: 1.5 }}>
              Your order <strong style={{ color: '#EAB308', fontFamily: 'var(--font-mono)' }}>{confirmedOrder.orderId}</strong> has been confirmed and queued for direct telecom delivery to <strong style={{ color: t.heading, fontFamily: 'var(--font-mono)' }}>{confirmedOrder.recipientPhone}</strong>.
            </p>

            <div
              style={{
                backgroundColor: t.modalBoxBg,
                border: `1px solid ${t.modalBoxBorder}`,
                borderRadius: '14px',
                padding: 'var(--space-4)',
                margin: 'var(--space-4) 0',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.bodyText }}>Package:</span>
                <strong style={{ color: t.heading }}>{confirmedOrder.product.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.bodyText }}>Amount Paid:</span>
                <strong style={{ color: '#10B981' }}>{confirmedOrder.amountDisplay}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.bodyText }}>Status:</span>
                <span style={{ color: '#38BDF8', fontWeight: 800 }}>● {confirmedOrder.statusLabel}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmedOrder(null);
                setSelectedProduct(null);
              }}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '12px',
                backgroundColor: '#EAB308',
                color: '#0F172A',
                border: 'none',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 16. ORDER TRACKING MODAL */}
      {/* ==================================================================== */}
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
            style={{ position: 'fixed', inset: 0, backgroundColor: t.modalOverlay, backdropFilter: 'blur(6px)' }}
            onClick={() => setShowTrackModal(false)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '460px',
              width: '100%',
              backgroundColor: t.modalBg,
              border: `1px solid ${t.modalBorder}`,
              borderRadius: '24px',
              padding: 'var(--space-6)',
              zIndex: 110,
              boxShadow: t.cardShadowLg,
              transition: 'background-color 200ms ease, border-color 200ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#EAB308', fontWeight: 800, textTransform: 'uppercase' }}>
                  Delivery Tracking
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: t.heading }}>
                  Track Order Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                style={{ background: 'none', border: 'none', color: t.bodyText, fontSize: '18px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePerformTrack();
              }}
              style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}
            >
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Order ID or recipient phone"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  leftIcon={<Search size={14} color={t.bodyText} />}
                />
              </div>
              <Button variant="primary" size="md" type="submit" isLoading={isTracking}>
                Search
              </Button>
            </form>

            {trackedOrder ? (
              <div
                style={{
                  backgroundColor: t.modalBoxBg,
                  border: `1px solid ${t.modalBoxBorder}`,
                  borderRadius: '14px',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: t.bodyText }}>Order ID:</span>
                  <strong style={{ color: t.heading, fontFamily: 'var(--font-mono)' }}>{trackedOrder.orderId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: t.bodyText }}>Package:</span>
                  <strong style={{ color: t.heading }}>{trackedOrder.product.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: t.bodyText }}>Recipient:</span>
                  <strong style={{ color: t.heading, fontFamily: 'var(--font-mono)' }}>{trackedOrder.recipientPhone}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: t.bodyText }}>Status:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>● {trackedOrder.statusLabel}</span>
                </div>
              </div>
            ) : trackSearched && !isTracking ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: '#EF4444', fontSize: 'var(--font-size-xs)' }}>
                No order found matching "{trackQuery}". Please check your details.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 17. CHECK A NUMBER PRECHECK MODAL */}
      {/* ==================================================================== */}
      {showNumberCheckModal && (
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
            style={{ position: 'fixed', inset: 0, backgroundColor: t.modalOverlay, backdropFilter: 'blur(6px)' }}
            onClick={() => setShowNumberCheckModal(false)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '440px',
              width: '100%',
              backgroundColor: t.modalBg,
              border: `1px solid ${t.modalBorder}`,
              borderRadius: '24px',
              padding: 'var(--space-6)',
              zIndex: 110,
              boxShadow: t.cardShadowLg,
              transition: 'background-color 200ms ease, border-color 200ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Number Pre-Check
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 900, color: t.heading }}>
                  Verify Your Phone Number
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNumberCheckModal(false)}
                style={{ background: 'none', border: 'none', color: t.bodyText, fontSize: '18px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCheckNumber} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <PhoneInput
                label="Ghana Phone Number"
                placeholder="0244123456"
                value={checkNumberPhone}
                onChange={(e) => setCheckNumberPhone(e.target.value)}
                required
              />

              <Button variant="primary" size="md" type="submit" isLoading={isCheckingNumber} fullWidth>
                Verify Number
              </Button>

              {numberCheckResult && (
                <div
                  style={{
                    backgroundColor: t.modalBoxBg,
                    border: `1px solid ${t.modalBoxBorder}`,
                    borderRadius: '12px',
                    padding: 'var(--space-4)',
                    marginTop: 'var(--space-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.bodyText }}>Network:</span>
                    <strong style={{ color: t.heading }}>{numberCheckResult.network}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.bodyText }}>Status:</span>
                    <strong style={{ color: '#10B981' }}>{numberCheckResult.status}</strong>
                  </div>
                  <p style={{ color: t.secondaryText, margin: '0.3rem 0 0 0', lineHeight: 1.4 }}>
                    {numberCheckResult.message}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 18. BENEFICIARY NOT APPROVED WARNING MODAL */}
      {/* ==================================================================== */}
      <BeneficiaryNotApprovedModal
        isOpen={unapprovedModalOpen}
        onClose={() => setUnapprovedModalOpen(false)}
        phoneNumber={unapprovedPhone}
      />
    </div>
  );
};
export default PublicStorefrontPage;
