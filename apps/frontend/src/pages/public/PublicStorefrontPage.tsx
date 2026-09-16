import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { PhoneInput, Input, Card, Button, detectGhanaianNetwork } from '../../components/ui/index.js';
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
  Sun,
  Moon,
  Home,
  ShoppingCart,
  FileText,
  Info,
} from 'lucide-react';
import { NetworkProvider, CustomerOrderDto } from '@bytebeacon/shared';

// Network styling specifications matching design images
interface NetworkThemeStyle {
  name: string;
  pillText: string;
  pillBg: string;
  pillColor: string;
  cardBg: string;
  textColor: string;
  subColor: string;
  priceColor: string;
  btnBg: string;
  btnColor: string;
  accentColor: string;
}

const NETWORK_THEMES: Record<NetworkProvider, NetworkThemeStyle> = {
  [NetworkProvider.MTN]: {
    name: 'MTN Ghana',
    pillText: 'MTN',
    pillBg: '#000000',
    pillColor: '#FFCC00',
    cardBg: '#EAB308',
    textColor: '#0F172A',
    subColor: '#334155',
    priceColor: '#0F172A',
    btnBg: '#0F172A',
    btnColor: '#FFFFFF',
    accentColor: '#EAB308',
  },
  [NetworkProvider.TELECEL]: {
    name: 'Telecel Ghana',
    pillText: 'TELECEL',
    pillBg: '#FFFFFF',
    pillColor: '#DC2626',
    cardBg: '#DC2626',
    textColor: '#FFFFFF',
    subColor: 'rgba(255, 255, 255, 0.85)',
    priceColor: '#FFFFFF',
    btnBg: '#FFFFFF',
    btnColor: '#DC2626',
    accentColor: '#DC2626',
  },
  [NetworkProvider.AIRTELTIGO]: {
    name: 'AT Ghana',
    pillText: 'AIRTELTIGO',
    pillBg: '#FFFFFF',
    pillColor: '#2563EB',
    cardBg: '#2563EB',
    textColor: '#FFFFFF',
    subColor: 'rgba(255, 255, 255, 0.85)',
    priceColor: '#FFFFFF',
    btnBg: '#FFFFFF',
    btnColor: '#2563EB',
    accentColor: '#2563EB',
  },
};

const formatDataAmount = (dataAmountMb: number): string => {
  const gb = dataAmountMb / 1024;
  return gb % 1 === 0 ? `${gb}GB` : `${gb.toFixed(1)}GB`;
};

const formatDataAmountWithSpace = (dataAmountMb: number): string => {
  const gb = dataAmountMb / 1024;
  return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
};

type StorefrontNavPage = 'home' | 'buy' | 'track' | 'info';

const RECENT_ORDERS_STORAGE_KEY = 'bb_customer_recent_orders';

export const PublicStorefrontPage: React.FC = () => {
  const { slug, page } = useParams<{ slug?: string; page?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const { toastSuccess, toastError, toastInfo } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Extract slug from path, host, or query
  const subdomainSlug = STOREFRONT_CONFIG.extractSlugFromSubdomain();
  const querySlug = searchParams.get('store') || searchParams.get('slug');
  const storeSlug = (slug || subdomainSlug || querySlug || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  // Determine current active navigation page
  const determineActivePage = useCallback((): StorefrontNavPage => {
    // 1. Check path parameter :page
    if (page) {
      const p = page.toLowerCase();
      if (p === 'buy' || p === 'buy-data' || p === 'bundles') return 'buy';
      if (p === 'track' || p === 'track-order') return 'track';
      if (p === 'info' || p === 'about' || p === 'store-info') return 'info';
      if (p === 'home') return 'home';
    }
    // 2. Check location pathname
    const path = location.pathname.toLowerCase();
    if (path.endsWith('/buy') || path.endsWith('/buy-data') || path.endsWith('/bundles')) return 'buy';
    if (path.endsWith('/track') || path.endsWith('/track-order')) return 'track';
    if (path.endsWith('/info') || path.endsWith('/about') || path.endsWith('/store-info')) return 'info';
    // 3. Check query param e.g. ?tab=buy
    const tabParam = searchParams.get('tab');
    if (tabParam === 'buy') return 'buy';
    if (tabParam === 'track') return 'track';
    if (tabParam === 'info') return 'info';

    return 'home';
  }, [page, location.pathname, searchParams]);

  const [activeNav, setActiveNav] = useState<StorefrontNavPage>(determineActivePage);

  useEffect(() => {
    setActiveNav(determineActivePage());
  }, [determineActivePage]);

  // Navigate helper that updates URL cleanly
  const handleNavClick = (target: StorefrontNavPage) => {
    setActiveNav(target);
    const isSubdomain = STOREFRONT_CONFIG.isStorefrontHost();
    const basePath = isSubdomain ? '' : `/store/${storeSlug}`;
    const targetPath = target === 'home' ? (basePath || '/') : `${basePath}/${target}`;

    if (typeof window !== 'undefined' && window.history?.pushState) {
      try {
        window.history.pushState(null, '', targetPath);
      } catch {
        // Safe fallback
      }
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');
        if (!isJsdom) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch {
        // Safe fallback
      }
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setActiveNav(determineActivePage());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [determineActivePage]);

  // Color theme tokens matching screenshots
  const t = useMemo(() => ({
    isDark,
    bgPage: isDark ? '#0A0C10' : '#F8FAFC',
    textPage: isDark ? '#F8FAFC' : '#0F172A',

    // Top Header & Navbar
    bgHeader: isDark ? '#0D0F14' : '#FFFFFF',
    borderHeader: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E2E8F0',
    logoContainerBg: isDark ? '#1E293B' : '#0F172A',
    logoContainerBorder: isDark ? 'rgba(59, 130, 246, 0.25)' : '#CBD5E1',
    logoColor: '#60A5FA',
    storeNameColor: isDark ? '#FFFFFF' : '#0F172A',
    storeSubColor: isDark ? '#64748B' : '#94A3B8',

    // Nav Pills
    navContainerBg: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9',
    navContainerBorder: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    navActiveBg: '#A3E635', // Electric Lime Green from design
    navActiveColor: '#000000',
    navInactiveColor: isDark ? '#94A3B8' : '#64748B',

    // Utility Pills (Instant Delivery, Theme Toggle)
    utilityPillBg: isDark ? '#141720' : '#FFFFFF',
    utilityPillBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    utilityPillColor: isDark ? '#CBD5E1' : '#334155',

    // Cards & Sections
    cardBg: isDark ? '#13161F' : '#FFFFFF',
    cardInnerBg: isDark ? '#0B0E14' : '#F8FAFC',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    cardInnerBorder: isDark ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0',
    cardShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0, 0, 0, 0.05)',

    // Headings & Text
    heading: isDark ? '#FFFFFF' : '#0F172A',
    subText: isDark ? '#64748B' : '#94A3B8',
    bodyText: isDark ? '#94A3B8' : '#475569',
    limeText: '#A3E635',

    // Inputs
    inputBg: isDark ? '#0C0E14' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1',

    // Modal
    modalBg: isDark ? '#141720' : '#FFFFFF',
    modalOverlay: 'rgba(0, 0, 0, 0.85)',
    modalBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',

    // Footer
    footerBg: isDark ? '#0A0C10' : '#F8FAFC',
    footerBorder: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E2E8F0',
    footerText: isDark ? '#64748B' : '#94A3B8',
  }), [isDark]);

  // Real store data state
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [products, setProducts] = useState<PublicStoreProductDto[]>([]);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [storeNotFound, setStoreNotFound] = useState(false);
  const [notFoundSearch, setNotFoundSearch] = useState('');

  // Network filter state for Buy Data view
  const [activeNetworkFilter, setActiveNetworkFilter] = useState<'ALL' | NetworkProvider>('ALL');

  // Checkout modal state
  const [selectedProduct, setSelectedProduct] = useState<PublicStoreProductDto | null>(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [unapprovedModalOpen, setUnapprovedModalOpen] = useState(false);
  const [unapprovedPhone, setUnapprovedPhone] = useState('');

  // Order Complete & Live Track state
  const [confirmedOrder, setConfirmedOrder] = useState<CustomerOrderDto | null>(null);

  // Live order tracker & manual query state
  const [activeCustomerOrder, setActiveCustomerOrder] = useState<CustomerOrderDto | null>(null);
  const [manualTrackQuery, setManualTrackQuery] = useState('');
  const [isTrackingManual, setIsTrackingManual] = useState(false);
  const [manualTrackSearched, setManualTrackSearched] = useState(false);
  const [manualTrackedOrder, setManualTrackedOrder] = useState<CustomerOrderDto | null>(null);

  // Dedicated Track Page state
  const [trackPageQuery, setTrackPageQuery] = useState('');
  const [isTrackPageSearching, setIsTrackPageSearching] = useState(false);
  const [trackPageSearched, setTrackPageSearched] = useState(false);
  const [trackPageOrder, setTrackPageOrder] = useState<CustomerOrderDto | null>(null);

  // In-store Track Order Modal state
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [modalTrackQuery, setModalTrackQuery] = useState('');
  const [isModalTracking, setIsModalTracking] = useState(false);
  const [modalTrackSearched, setModalTrackSearched] = useState(false);
  const [modalTrackedOrder, setModalTrackedOrder] = useState<CustomerOrderDto | null>(null);

  // Dynamic favicon & tab title
  useEffect(() => {
    const storeName = store?.storeName || 'ByteBeacon Test Hub';
    if (typeof document !== 'undefined') {
      document.title = `${storeName} · Instant Automated Telecom Data`;

      const initial = (storeName.charAt(0) || 'B').toUpperCase();
      const brandColor = store?.primaryColor || '#A3E635';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${brandColor}"/><text x="16" y="22" font-size="18" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="900" fill="#000000" text-anchor="middle">${initial}</text></svg>`;
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

  // Load real store data (Zero mock data)
  const loadStore = useCallback(async () => {
    setIsLoadingStore(true);
    setStoreNotFound(false);
    try {
      const res = await storesApi.getPublicStore(storeSlug);
      if (res && res.store) {
        setStore(res.store);
        const prods = Array.isArray(res.products) ? res.products : [];
        setProducts(prods);
      } else {
        setStoreNotFound(true);
      }
    } catch {
      setStoreNotFound(true);
    } finally {
      setIsLoadingStore(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  // Paystack verification callback handler
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('trxref');
    if (ref) {
      setIsCheckingOut(true);
      toastInfo('Verifying Payment', 'Confirming your transaction with Paystack...');
      storesApi
        .verifyPublicPayment(ref)
        .then((orderRes) => {
          setConfirmedOrder(orderRes);
          setActiveCustomerOrder(orderRes);
          saveRecentOrder(orderRes);
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

  // Save recent order to sessionStorage for real-time live tracker
  const saveRecentOrder = (order: CustomerOrderDto) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(order));
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Load recent order on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved = sessionStorage.getItem(RECENT_ORDERS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.orderId) {
            setActiveCustomerOrder(parsed);
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Real-time polling for active order (Every 5s until final status)
  useEffect(() => {
    if (!activeCustomerOrder || !activeCustomerOrder.orderId) return;

    const isFinalStatus =
      activeCustomerOrder.status === 'DELIVERED' ||
      activeCustomerOrder.status === 'UNABLE_TO_COMPLETE' ||
      activeCustomerOrder.status === 'CANCELLED';

    if (isFinalStatus) return;

    const pollInterval = setInterval(async () => {
      try {
        const updated = await ordersApi.trackOrder(activeCustomerOrder.orderId);
        if (updated) {
          const raw = updated as any;
          const mapped: CustomerOrderDto = {
            orderId: raw.orderId || raw.publicId || raw.id || activeCustomerOrder.orderId,
            status: raw.status || raw.orderStatus || 'PROCESSING',
            statusLabel: raw.statusLabel || raw.orderStatus || 'Processing',
            paymentStatus: raw.paymentStatus || 'PAID',
            product: {
              name: raw.product?.name || activeCustomerOrder.product.name,
              network: raw.product?.network || activeCustomerOrder.product.network,
              volumeDisplay: raw.product?.volumeDisplay || activeCustomerOrder.product.volumeDisplay,
              validityDisplay: raw.product?.validityDisplay || 'Non-Expiry',
            },
            recipientPhone: raw.recipientPhone || activeCustomerOrder.recipientPhone,
            amountPesewas: raw.amountPesewas || activeCustomerOrder.amountPesewas,
            amountDisplay: raw.amountDisplay || activeCustomerOrder.amountDisplay,
            currency: raw.currency || 'GHS',
            createdAt: raw.createdAt || activeCustomerOrder.createdAt,
            updatedAt: raw.updatedAt || new Date().toISOString(),
          };
          setActiveCustomerOrder(mapped);
          saveRecentOrder(mapped);
        }
      } catch {
        // Suppress background poll errors
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeCustomerOrder]);

  // Filtered lists by network
  const mtnProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.MTN), [products]);
  const telecelProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.TELECEL), [products]);
  const airteltigoProducts = useMemo(() => products.filter((p) => p.network === NetworkProvider.AIRTELTIGO), [products]);

  // Products to display on Buy Data page
  const displayProducts = useMemo(() => {
    if (activeNetworkFilter === 'ALL') return products;
    return products.filter((p) => p.network === activeNetworkFilter);
  }, [products, activeNetworkFilter]);

  // Featured popular products for Home view
  const popularProducts = useMemo(() => {
    if (activeNetworkFilter !== 'ALL') {
      return products.filter((p) => p.network === activeNetworkFilter);
    }
    const populars = products.filter((p) => p.popular);
    if (populars.length > 0) return populars;
    // Fallback: Pick top diverse bundles from each network, MTN first
    const list: PublicStoreProductDto[] = [];
    if (mtnProducts[0]) list.push(mtnProducts[0]);
    if (telecelProducts[0]) list.push(telecelProducts[0]);
    if (airteltigoProducts[0]) list.push(airteltigoProducts[0]);
    return list.length > 0 ? list : products.slice(0, 3);
  }, [products, telecelProducts, mtnProducts, airteltigoProducts, activeNetworkFilter]);

  // Handle Checkout submission
  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (!selectedProduct) return;

    const cleanRecipient = recipientPhone.trim().replace(/\s+/g, '');
    if (!cleanRecipient || cleanRecipient.length < 10) {
      toastError('Invalid Phone', 'Please enter a valid 10-digit Ghanaian recipient phone number.');
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
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${location.pathname}?ref=${idempotencyKey}`
          : undefined;

      const checkoutRes = await storesApi.publicCheckout({
        slug: store?.slug || storeSlug,
        productId: selectedProduct.id,
        recipientPhone: cleanRecipient,
        customerEmail: customerEmail.trim() || undefined,
        paymentMethod: 'PAYSTACK',
        channel: selectedChannel,
        idempotencyKey,
        callbackUrl,
      });

      if (checkoutRes?.payment?.authorizationUrl) {
        toastInfo('Redirecting to Paystack', 'Redirecting to secure payment...');
        window.location.href = checkoutRes.payment.authorizationUrl;
        return;
      }

      if (checkoutRes?.payment?.reference) {
        const verified = await storesApi.verifyPublicPayment(checkoutRes.payment.reference, checkoutRes.order.orderId);
        setConfirmedOrder(verified);
        setActiveCustomerOrder(verified);
        saveRecentOrder(verified);
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
        setActiveCustomerOrder(fallbackOrder);
        saveRecentOrder(fallbackOrder);
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

  // Handle Manual Tracking on Home View
  const handleHomeManualTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualTrackQuery.trim();
    if (!query) return;

    setIsTrackingManual(true);
    setManualTrackSearched(true);
    try {
      const res = await ordersApi.trackOrder(query);
      if (res) {
        const raw = res as any;
        const mapped: CustomerOrderDto = {
          orderId: raw.orderId || raw.publicId || raw.id || query,
          status: raw.status || raw.orderStatus || 'PROCESSING',
          statusLabel: raw.statusLabel || raw.orderStatus || 'Processing',
          paymentStatus: raw.paymentStatus || 'PENDING',
          product: {
            name: raw.product?.name || `${raw.network || 'Data'} Bundle`,
            network: raw.product?.network || raw.network || 'MTN',
            volumeDisplay: raw.product?.volumeDisplay || (raw.dataAmountMb ? formatDataAmount(raw.dataAmountMb) : 'Data Bundle'),
            validityDisplay: raw.product?.validityDisplay || 'Non-Expiry',
          },
          recipientPhone: raw.recipientPhone || '',
          amountPesewas: raw.amountPesewas || 0,
          amountDisplay: raw.amountDisplay || (raw.amountPesewas ? `GH₵ ${(raw.amountPesewas / 100).toFixed(2)}` : 'GH₵ 0.00'),
          currency: raw.currency || 'GHS',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
        setManualTrackedOrder(mapped);
      } else {
        setManualTrackedOrder(null);
      }
    } catch {
      setManualTrackedOrder(null);
    } finally {
      setIsTrackingManual(false);
    }
  };

  // Handle Dedicated Track Page Search
  const handleTrackPageSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackPageQuery.trim();
    if (!query) return;

    setIsTrackPageSearching(true);
    setTrackPageSearched(true);
    try {
      const res = await ordersApi.trackOrder(query);
      if (res) {
        const raw = res as any;
        const mapped: CustomerOrderDto = {
          orderId: raw.orderId || raw.publicId || raw.id || query,
          status: raw.status || raw.orderStatus || 'PROCESSING',
          statusLabel: raw.statusLabel || raw.orderStatus || 'Processing',
          paymentStatus: raw.paymentStatus || 'PENDING',
          product: {
            name: raw.product?.name || `${raw.network || 'Data'} Bundle`,
            network: raw.product?.network || raw.network || 'MTN',
            volumeDisplay: raw.product?.volumeDisplay || (raw.dataAmountMb ? formatDataAmount(raw.dataAmountMb) : 'Data Bundle'),
            validityDisplay: raw.product?.validityDisplay || 'Non-Expiry',
          },
          recipientPhone: raw.recipientPhone || '',
          amountPesewas: raw.amountPesewas || 0,
          amountDisplay: raw.amountDisplay || (raw.amountPesewas ? `GH₵ ${(raw.amountPesewas / 100).toFixed(2)}` : 'GH₵ 0.00'),
          currency: raw.currency || 'GHS',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
        setTrackPageOrder(mapped);
      } else {
        setTrackPageOrder(null);
      }
    } catch {
      setTrackPageOrder(null);
    } finally {
      setIsTrackPageSearching(false);
    }
  };

  // Handle in-store Tracking Modal Search
  const handleModalTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = modalTrackQuery.trim();
    if (!query) return;

    setIsModalTracking(true);
    setModalTrackSearched(true);
    try {
      const res = await ordersApi.trackOrder(query);
      if (res) {
        const raw = res as any;
        const mapped: CustomerOrderDto = {
          orderId: raw.orderId || raw.publicId || raw.id || query,
          status: raw.status || raw.orderStatus || 'PROCESSING',
          statusLabel: raw.statusLabel || raw.orderStatus || 'Processing',
          paymentStatus: raw.paymentStatus || 'PENDING',
          product: {
            name: raw.product?.name || `${raw.network || 'Data'} Bundle`,
            network: raw.product?.network || raw.network || 'MTN',
            volumeDisplay: raw.product?.volumeDisplay || (raw.dataAmountMb ? formatDataAmountWithSpace(raw.dataAmountMb) : 'Data Bundle'),
            validityDisplay: raw.product?.validityDisplay || 'Non-Expiry',
          },
          recipientPhone: raw.recipientPhone || '',
          amountPesewas: raw.amountPesewas || 0,
          amountDisplay: raw.amountDisplay || (raw.amountPesewas ? `GH₵ ${(raw.amountPesewas / 100).toFixed(2)}` : 'GH₵ 0.00'),
          currency: raw.currency || 'GHS',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
        setModalTrackedOrder(mapped);
      } else {
        setModalTrackedOrder(null);
      }
    } catch {
      setModalTrackedOrder(null);
    } finally {
      setIsModalTracking(false);
    }
  };

  // 1. Loading Skeleton
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
          padding: '2rem',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid #A3E635',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 700, color: t.subText }}>
          Loading Storefront & Bundles...
        </span>
      </div>
    );
  }

  // 2. Storefront Not Found / Maintenance State
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
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <Card
          style={{
            maxWidth: '500px',
            width: '100%',
            padding: '2rem',
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '20px',
            boxShadow: t.cardShadow,
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
              margin: '0 auto 1rem auto',
            }}
          >
            <Store size={28} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: t.heading, margin: 0 }}>
            Storefront Unavailable
          </h2>
          <p style={{ fontSize: '13px', color: t.bodyText, marginTop: '0.5rem', lineHeight: 1.5 }}>
            The merchant storefront <code style={{ color: '#A3E635', fontFamily: 'monospace' }}>/{storeSlug}</code> is currently undergoing maintenance or is unavailable.
          </p>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = notFoundSearch.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
                if (target) {
                  window.location.href = `/store/${target}`;
                }
              }}
              style={{ display: 'flex', gap: '0.5rem' }}
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

            <a
              href={STOREFRONT_CONFIG.getMainPlatformUrl('/')}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: t.heading,
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              Visit ByteBeacon Platform
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const storeName = store.storeName || 'ByteBeacon Test Hub';
  const storeTagline = store.tagline || 'Instant Automated Telecommunications Data';
  const contactPhone = store.contactPhone || '0241234567';
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
        overflowX: 'hidden',
        transition: 'background-color 200ms ease, color 200ms ease',
      }}
    >
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />

      {/* ==================================================================== */}
      {/* 1. TOP HEADER & NAVBAR (Exact visual match from images) */}
      {/* ==================================================================== */}
      <header
        style={{
          borderBottom: `1px solid ${t.borderHeader}`,
          backgroundColor: t.bgHeader,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '0.85rem 1.25rem',
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Store Brand / Logo Squircle */}
          <div
            onClick={() => handleNavClick('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: t.logoContainerBg,
                border: `1px solid ${t.logoContainerBorder}`,
                color: t.logoColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.4)' : '0 2px 6px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Store size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 900,
                    color: t.storeNameColor,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  {storeName}
                </span>
                <span className="sr-only">Verified Merchant</span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: t.storeSubColor,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>{storeTagline}</span>
              </div>
            </div>
          </div>

          {/* Navigation Links & Right Utility Badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Nav Group Pills */}
            <nav
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {/* Home Link */}
              <button
                type="button"
                onClick={() => handleNavClick('home')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '100px',
                  border: 'none',
                  backgroundColor: activeNav === 'home' ? t.navActiveBg : 'transparent',
                  color: activeNav === 'home' ? t.navActiveColor : t.navInactiveColor,
                  fontSize: '12px',
                  fontWeight: activeNav === 'home' ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <Home size={14} color={activeNav === 'home' ? '#000000' : 'currentColor'} />
                <span>Home</span>
              </button>

              {/* Buy Data Link */}
              <button
                type="button"
                onClick={() => handleNavClick('buy')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '100px',
                  border: 'none',
                  backgroundColor: activeNav === 'buy' ? t.navActiveBg : 'transparent',
                  color: activeNav === 'buy' ? t.navActiveColor : t.navInactiveColor,
                  fontSize: '12px',
                  fontWeight: activeNav === 'buy' ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <ShoppingCart size={14} color={activeNav === 'buy' ? '#000000' : 'currentColor'} />
                <span>Buy Data</span>
              </button>

              {/* Track Order Link */}
              <button
                type="button"
                onClick={() => {
                  setShowTrackModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '100px',
                  border: 'none',
                  backgroundColor: activeNav === 'track' ? t.navActiveBg : 'transparent',
                  color: activeNav === 'track' ? t.navActiveColor : t.navInactiveColor,
                  fontSize: '12px',
                  fontWeight: activeNav === 'track' ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <FileText size={14} color={activeNav === 'track' ? '#000000' : 'currentColor'} />
                <span>Track Order</span>
              </button>

              {/* Info Link */}
              <button
                type="button"
                onClick={() => handleNavClick('info')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '100px',
                  border: 'none',
                  backgroundColor: activeNav === 'info' ? t.navActiveBg : 'transparent',
                  color: activeNav === 'info' ? t.navActiveColor : t.navInactiveColor,
                  fontSize: '12px',
                  fontWeight: activeNav === 'info' ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <Info size={14} color={activeNav === 'info' ? '#000000' : 'currentColor'} />
                <span>Info</span>
              </button>
            </nav>

            {/* Instant Delivery Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: t.utilityPillBg,
                border: `1px solid ${t.utilityPillBorder}`,
                borderRadius: '100px',
                padding: '0.4rem 0.8rem',
                fontSize: '11px',
                fontWeight: 700,
                color: t.utilityPillColor,
              }}
            >
              <Zap size={12} color="#A3E635" fill="#A3E635" />
              <span>Instant Delivery</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: t.utilityPillBg,
                border: `1px solid ${t.utilityPillBorder}`,
                borderRadius: '100px',
                padding: '0.4rem 0.8rem',
                fontSize: '11px',
                fontWeight: 700,
                color: t.utilityPillColor,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {isDark ? (
                <>
                  <Sun size={13} color="#FACC15" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon size={13} color="#38BDF8" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. PAGE CONTENT ROUTER / RENDERER */}
      {/* ==================================================================== */}
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%',
          padding: '1.5rem 1.25rem',
          flex: 1,
        }}
      >
        {/* VIEW 1: HOME PAGE (Matches media_1789552950052.png) */}
        {activeNav === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Section 1: Hero Card */}
            <section
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                boxShadow: t.cardShadow,
              }}
            >
              <div style={{ maxWidth: '640px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: isDark ? 'rgba(163, 230, 53, 0.12)' : '#ECFDF5',
                    border: '1px solid rgba(163, 230, 53, 0.3)',
                    color: isDark ? '#A3E635' : '#15803D',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '100px',
                    marginBottom: '1rem',
                  }}
                >
                  <Zap size={12} fill="currentColor" />
                  <span>Instant Delivery</span>
                </div>

                <h1
                  style={{
                    fontSize: 'clamp(2rem, 4.5vw, 2.75rem)',
                    fontWeight: 900,
                    color: t.heading,
                    lineHeight: 1.15,
                    margin: '0 0 0.5rem 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Buy Data Bundles
                  <span style={{ display: 'block', color: '#A3E635' }}>At Unbeatable Prices</span>
                </h1>

                <p
                  style={{
                    fontSize: '14px',
                    color: t.bodyText,
                    lineHeight: 1.5,
                    margin: '0 0 1.75rem 0',
                  }}
                >
                  MTN, Telecel & AirtelTigo bundles delivered to your phone within minutes. Safe, fast, and reliable.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleNavClick('buy')}
                    style={{
                      backgroundColor: '#A3E635',
                      color: '#000000',
                      border: 'none',
                      padding: '0.65rem 1.35rem',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      transition: 'transform 100ms ease',
                    }}
                  >
                    <ShoppingCart size={15} color="#000000" />
                    <span>Buy Data Now</span>
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTrackModal(true);
                      handleNavClick('track');
                    }}
                    style={{
                      backgroundColor: isDark ? '#1C212D' : '#F1F5F9',
                      color: t.heading,
                      border: `1px solid ${t.cardBorder}`,
                      padding: '0.65rem 1.35rem',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <FileText size={15} />
                    <span>Order Tracking</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Section 2: Live Order Tracker */}
            <section
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: '20px',
                padding: '1.75rem',
                boxShadow: t.cardShadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                <Clock size={16} color="#A3E635" />
                <h3 style={{ fontSize: '15px', fontWeight: 900, color: t.heading, margin: 0 }}>
                  Live Order Tracker
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.25rem 0' }}>
                Automated real-time tracking for your current purchase
              </p>

              {/* Inner Box: Real-Time Order or Empty State */}
              <div
                style={{
                  backgroundColor: t.cardInnerBg,
                  border: `1px solid ${t.cardInnerBorder}`,
                  borderRadius: '14px',
                  padding: '2.25rem 1.5rem',
                  textAlign: 'center',
                }}
              >
                {activeCustomerOrder && !confirmedOrder ? (
                  <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '12px', color: t.bodyText }}>Order ID:</span>
                      <strong style={{ fontSize: '13px', color: '#A3E635', fontFamily: 'monospace' }}>
                        {activeCustomerOrder.orderId}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '12px', color: t.bodyText }}>Package:</span>
                      <strong style={{ fontSize: '13px', color: t.heading }}>
                        {activeCustomerOrder.product.name}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '12px', color: t.bodyText }}>Recipient:</span>
                      <strong style={{ fontSize: '13px', color: t.heading, fontFamily: 'monospace' }}>
                        {activeCustomerOrder.recipientPhone}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '12px', color: t.bodyText }}>Live Status:</span>
                      <span style={{ color: '#10B981', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                        {activeCustomerOrder.statusLabel || activeCustomerOrder.status}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackPageQuery(activeCustomerOrder.orderId);
                          handleNavClick('track');
                        }}
                        style={{
                          backgroundColor: '#A3E635',
                          color: '#000000',
                          border: 'none',
                          padding: '0.5rem 1.25rem',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        View Full Tracking Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '0.65rem' }}>
                      <Clock size={36} color={isDark ? '#475569' : '#94A3B8'} style={{ margin: '0 auto' }} />
                    </div>
                    <strong style={{ fontSize: '14px', fontWeight: 800, color: t.heading, display: 'block', marginBottom: '0.25rem' }}>
                      No active orders found.
                    </strong>
                    <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.25rem 0' }}>
                      When you place an order, live tracking will automatically appear here.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavClick('buy')}
                      style={{
                        backgroundColor: '#A3E635',
                        color: '#000000',
                        border: 'none',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <ShoppingCart size={14} color="#000000" />
                      <span>Buy Data Now</span>
                    </button>
                  </>
                )}
              </div>

              {/* Manual Lookup Sub-section */}
              <div style={{ marginTop: '1.25rem' }}>
                <span style={{ fontSize: '12px', color: t.subText, display: 'block', marginBottom: '0.5rem' }}>
                  Look up another order manually:
                </span>
                <form
                  onSubmit={handleHomeManualTrack}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    maxWidth: '600px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Input
                      placeholder="Reference or tracking code (e.g., BB-123456)"
                      value={manualTrackQuery}
                      onChange={(e) => setManualTrackQuery(e.target.value)}
                      leftIcon={<Search size={14} color={t.subText} />}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTrackingManual}
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '10px',
                      backgroundColor: isDark ? '#1E2330' : '#E2E8F0',
                      color: t.heading,
                      border: `1px solid ${t.cardBorder}`,
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: isTrackingManual ? 'wait' : 'pointer',
                    }}
                  >
                    Find Order
                  </button>
                </form>

                {manualTrackedOrder && (
                  <div
                    style={{
                      backgroundColor: t.cardInnerBg,
                      border: `1px solid ${t.cardInnerBorder}`,
                      borderRadius: '12px',
                      padding: '1rem',
                      marginTop: '0.75rem',
                      fontSize: '12px',
                      maxWidth: '600px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: t.subText }}>Order ID:</span>
                      <strong style={{ color: t.heading, fontFamily: 'monospace' }}>{manualTrackedOrder.orderId}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: t.subText }}>Package:</span>
                      <strong style={{ color: t.heading }}>{manualTrackedOrder.product.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: t.subText }}>Recipient:</span>
                      <strong style={{ color: t.heading, fontFamily: 'monospace' }}>{manualTrackedOrder.recipientPhone}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: t.subText }}>Status:</span>
                      <span style={{ color: '#10B981', fontWeight: 800 }}>● {manualTrackedOrder.statusLabel}</span>
                    </div>
                  </div>
                )}

                {manualTrackSearched && !isTrackingManual && !manualTrackedOrder && (
                  <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '0.5rem' }}>
                    No order found matching "{manualTrackQuery}". Please verify your reference ID.
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: Choose Your Network (3 Cards) */}
            <section>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: t.heading, margin: '0 0 0.25rem 0' }}>
                Choose Your Network
              </h2>
              <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.25rem 0' }}>
                Select a network provider to explore available data bundles
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                {/* MTN Ghana Card */}
                <button
                  type="button"
                  aria-label="MTN"
                  onClick={() => {
                    setActiveNetworkFilter(NetworkProvider.MTN);
                    handleNavClick('buy');
                  }}
                  style={{
                    backgroundColor: '#EAB308',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: '#0F172A',
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    boxShadow: '0 8px 24px rgba(234, 179, 8, 0.2)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        backgroundColor: '#000000',
                        color: '#FFCC00',
                        fontSize: '11px',
                        fontWeight: 900,
                        padding: '3px 9px',
                        borderRadius: '100px',
                      }}
                    >
                      MTN
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '100px',
                      }}
                    >
                      {mtnProducts.length} available
                    </span>
                  </div>
                  <strong style={{ fontSize: '18px', fontWeight: 900, display: 'block', marginBottom: '0.25rem' }}>
                    MTN Ghana
                  </strong>
                  <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 1rem 0' }}>
                    High speed 4G LTE internet data bundles.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px', fontWeight: 800 }}>
                    <span>View Bundles</span>
                    <ArrowRight size={13} strokeWidth={2.8} />
                  </div>
                </button>

                {/* Telecel Ghana Card */}
                <button
                  type="button"
                  aria-label="Telecel"
                  onClick={() => {
                    setActiveNetworkFilter(NetworkProvider.TELECEL);
                    handleNavClick('buy');
                  }}
                  style={{
                    backgroundColor: '#DC2626',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    boxShadow: '0 8px 24px rgba(220, 38, 38, 0.2)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: 900,
                        padding: '3px 9px',
                        borderRadius: '100px',
                      }}
                    >
                      Telecel
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '100px',
                      }}
                    >
                      {telecelProducts.length} available
                    </span>
                  </div>
                  <strong style={{ fontSize: '18px', fontWeight: 900, display: 'block', marginBottom: '0.25rem' }}>
                    Telecel Ghana
                  </strong>
                  <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', margin: '0 0 1rem 0' }}>
                    Fast and reliable non expiring data packages.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px', fontWeight: 800 }}>
                    <span>View Bundles</span>
                    <ArrowRight size={13} strokeWidth={2.8} />
                  </div>
                </button>

                {/* AT Ghana Card */}
                <button
                  type="button"
                  aria-label="AirtelTigo"
                  onClick={() => {
                    setActiveNetworkFilter(NetworkProvider.AIRTELTIGO);
                    handleNavClick('buy');
                  }}
                  style={{
                    backgroundColor: '#2563EB',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    border: 'none',
                    textAlign: 'left',
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.2)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#2563EB',
                        fontSize: '11px',
                        fontWeight: 900,
                        padding: '3px 9px',
                        borderRadius: '100px',
                      }}
                    >
                      AirtelTigo
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '100px',
                      }}
                    >
                      {airteltigoProducts.length} available
                    </span>
                  </div>
                  <strong style={{ fontSize: '18px', fontWeight: 900, display: 'block', marginBottom: '0.25rem' }}>
                    AT Ghana
                  </strong>
                  <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', margin: '0 0 1rem 0' }}>
                    Affordable and instant data bundle delivery.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px', fontWeight: 800 }}>
                    <span>View Bundles</span>
                    <ArrowRight size={13} strokeWidth={2.8} />
                  </div>
                </button>
              </div>
            </section>

            {/* Section 4: Popular Data Bundles */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 900, color: t.heading, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🔥</span>
                    <span>Popular Data Bundles</span>
                  </h2>
                  <span style={{ fontSize: '12px', color: t.subText }}>
                    Featured active bundles from MTN, Telecel, and AirtelTigo
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavClick('buy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A3E635',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>View All Bundles</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '1rem',
                }}
              >
                {popularProducts.map((prod) => {
                  const theme = NETWORK_THEMES[prod.network] || NETWORK_THEMES[NetworkProvider.TELECEL];
                  const priceGhs = (prod.retailPricePesewas / 100).toFixed(2);
                  const isMtn = prod.network === NetworkProvider.MTN;

                  return (
                    <div
                      key={prod.id}
                      style={{
                        backgroundColor: theme.cardBg,
                        borderRadius: '18px',
                        padding: '1.5rem',
                        color: theme.textColor,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '170px',
                        boxShadow: `0 8px 24px ${theme.accentColor}33`,
                        transition: 'transform 120ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span
                            style={{
                              backgroundColor: theme.pillBg,
                              color: theme.pillColor,
                              fontSize: '11px',
                              fontWeight: 900,
                              padding: '3px 10px',
                              borderRadius: '100px',
                            }}
                          >
                            {theme.pillText}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: isMtn ? '#0F172A' : '#FFFFFF',
                              }}
                            >
                              Popular Choice
                            </span>
                            <span style={{ fontSize: '10px', opacity: 0.85 }}>
                              {prod.validityDesc || 'Non-Expiry'}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
                            fontWeight: 900,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            margin: '0.65rem 0',
                          }}
                        >
                          {formatDataAmountWithSpace(prod.dataAmountMb)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.75rem' }}>
                        <div>
                          <span style={{ fontSize: '11px', display: 'block', color: theme.subColor }}>
                            Retail Price
                          </span>
                          <strong style={{ fontSize: '18px', fontWeight: 900, color: theme.priceColor }}>
                            GH₵ {priceGhs}
                          </strong>
                        </div>

                        <button
                          type="button"
                          aria-label="Buy Now"
                          onClick={() => setSelectedProduct(prod)}
                          style={{
                            backgroundColor: theme.btnBg,
                            color: theme.btnColor,
                            border: 'none',
                            borderRadius: '100px',
                            padding: '0.5rem 1.1rem',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>Buy Now</span>
                          <ArrowRight size={13} strokeWidth={2.8} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Section 5: Trust Badges Row */}
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                }}
              >
                <Zap size={20} color="#A3E635" style={{ marginBottom: '0.5rem' }} />
                <strong style={{ fontSize: '13px', fontWeight: 900, color: t.heading, display: 'block', marginBottom: '0.2rem' }}>
                  Instant Fulfillment
                </strong>
                <p style={{ fontSize: '11px', color: t.subText, margin: 0, lineHeight: 1.4 }}>
                  Data bundles are dispatched automatically to your recipient number.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                }}
              >
                <ShieldCheck size={20} color="#10B981" style={{ marginBottom: '0.5rem' }} />
                <strong style={{ fontSize: '13px', fontWeight: 900, color: t.heading, display: 'block', marginBottom: '0.2rem' }}>
                  Secure Checkout
                </strong>
                <p style={{ fontSize: '11px', color: t.subText, margin: 0, lineHeight: 1.4 }}>
                  Transactions are encrypted and processed securely via Paystack.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                }}
              >
                <PhoneCall size={20} color="#38BDF8" style={{ marginBottom: '0.5rem' }} />
                <strong style={{ fontSize: '13px', fontWeight: 900, color: t.heading, display: 'block', marginBottom: '0.2rem' }}>
                  Support Availability
                </strong>
                <p style={{ fontSize: '11px', color: t.subText, margin: 0, lineHeight: 1.4 }}>
                  Need help? Contact our store administrator directly for assistance.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: BUY DATA PAGE (Matches media_1789552950051.png) */}
        {activeNav === 'buy' && (
          <div>
            {/* Top Network Filter Tabs */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '2.5rem',
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'ALL', label: 'ALL NETWORKS' },
                { id: NetworkProvider.MTN, label: 'MTN' },
                { id: NetworkProvider.TELECEL, label: 'TELECEL' },
                { id: NetworkProvider.AIRTELTIGO, label: 'AIRTELTIGO' },
              ].map((tab) => {
                const isActive = activeNetworkFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-label={tab.label}
                    onClick={() => setActiveNetworkFilter(tab.id as any)}
                    style={{
                      padding: '0.45rem 1.25rem',
                      borderRadius: '100px',
                      border: isActive ? 'none' : `1px solid ${t.cardBorder}`,
                      backgroundColor: isActive ? '#A3E635' : (isDark ? '#1C212D' : '#F1F5F9'),
                      color: isActive ? '#000000' : t.bodyText,
                      fontSize: '11px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      boxShadow: isActive ? '0 4px 14px rgba(163, 230, 53, 0.3)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Product Cards Catalog Grid */}
            {displayProducts.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: t.cardBg,
                  borderRadius: '20px',
                  border: `1px dashed ${t.cardBorder}`,
                }}
              >
                <Smartphone size={36} color={t.subText} style={{ margin: '0 auto 0.75rem auto' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: t.heading, margin: 0 }}>
                  No Bundles Available
                </h3>
                <p style={{ fontSize: '12px', color: t.subText, marginTop: '0.25rem' }}>
                  There are currently no active data bundles listed under this selection.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {displayProducts.map((prod) => {
                  const theme = NETWORK_THEMES[prod.network] || NETWORK_THEMES[NetworkProvider.TELECEL];
                  const priceGhs = (prod.retailPricePesewas / 100).toFixed(2);
                  const isMtn = prod.network === NetworkProvider.MTN;

                  return (
                    <div
                      key={prod.id}
                      style={{
                        backgroundColor: theme.cardBg,
                        borderRadius: '18px',
                        padding: '1.5rem',
                        color: theme.textColor,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '170px',
                        boxShadow: `0 8px 24px ${theme.accentColor}33`,
                        transition: 'transform 120ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span
                            style={{
                              backgroundColor: theme.pillBg,
                              color: theme.pillColor,
                              fontSize: '11px',
                              fontWeight: 900,
                              padding: '3px 10px',
                              borderRadius: '100px',
                            }}
                          >
                            {theme.pillText}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: isMtn ? '#0F172A' : '#FFFFFF',
                              }}
                            >
                              Instant Delivery
                            </span>
                            <span style={{ fontSize: '10px', opacity: 0.85 }}>
                              {prod.validityDesc || 'Non-Expiry'}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
                            fontWeight: 900,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            margin: '0.65rem 0',
                          }}
                        >
                          {formatDataAmountWithSpace(prod.dataAmountMb)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.75rem' }}>
                        <div>
                          <span style={{ fontSize: '11px', display: 'block', color: theme.subColor }}>
                            Retail Price
                          </span>
                          <strong style={{ fontSize: '18px', fontWeight: 900, color: theme.priceColor }}>
                            GH₵ {priceGhs}
                          </strong>
                        </div>

                        <button
                          type="button"
                          aria-label="Buy Now"
                          onClick={() => setSelectedProduct(prod)}
                          style={{
                            backgroundColor: theme.btnBg,
                            color: theme.btnColor,
                            border: 'none',
                            borderRadius: '100px',
                            padding: '0.5rem 1.1rem',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>Buy Now</span>
                          <ArrowRight size={13} strokeWidth={2.8} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TRACK ORDER PAGE (Matches media_1789553086389.png) */}
        {activeNav === 'track' && !showTrackModal && (
          <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
            <div
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                boxShadow: t.cardShadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <FileText size={22} color="#A3E635" />
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: t.heading, margin: 0 }}>
                  Track Order Status
                </h2>
              </div>
              <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.5rem 0' }}>
                Enter your Order ID, reference, or recipient phone number to check live status.
              </p>

              <form onSubmit={handleTrackPageSearch}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: t.heading,
                    display: 'block',
                    marginBottom: '0.5rem',
                  }}
                >
                  Order Reference ID *
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: '12px',
                    padding: '4px',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter Order ID or Reference (e.g. BB-123456)"
                    value={trackPageQuery}
                    onChange={(e) => setTrackPageQuery(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: t.heading,
                      fontSize: '13px',
                      padding: '0.65rem 0.75rem',
                      outline: 'none',
                    }}
                    required
                  />
                  <button
                    type="submit"
                    aria-label="Search - Track Order"
                    disabled={isTrackPageSearching}
                    style={{
                      backgroundColor: '#A3E635',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.65rem 1.25rem',
                      fontSize: '12px',
                      fontWeight: 900,
                      cursor: isTrackPageSearching ? 'wait' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Track Order
                  </button>
                </div>
              </form>

              {/* Live Tracking Result Card */}
              {trackPageOrder && (
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '14px',
                    padding: '1.25rem',
                    marginTop: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.subText }}>Order ID:</span>
                    <strong style={{ color: '#A3E635', fontFamily: 'monospace' }}>
                      {trackPageOrder.orderId}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.subText }}>Package:</span>
                    <strong style={{ color: t.heading }}>{trackPageOrder.product.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.subText }}>Recipient:</span>
                    <strong style={{ color: t.heading, fontFamily: 'monospace' }}>
                      {trackPageOrder.recipientPhone}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.subText }}>Amount:</span>
                    <strong style={{ color: '#10B981' }}>{trackPageOrder.amountDisplay}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: t.subText }}>Delivery Status:</span>
                    <span style={{ color: '#10B981', fontWeight: 800 }}>
                      ● {trackPageOrder.statusLabel || trackPageOrder.status}
                    </span>
                  </div>
                </div>
              )}

              {trackPageSearched && !isTrackPageSearching && !trackPageOrder && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    marginTop: '1.25rem',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  No active or past order was found matching "{trackPageQuery}". Please check your order reference.
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: INFO PAGE (Matches media_1789553086414.png) */}
        {activeNav === 'info' && (
          <div style={{ maxWidth: '680px', margin: '2rem auto' }}>
            <div
              style={{
                backgroundColor: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                boxShadow: t.cardShadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Info size={22} color="#A3E635" />
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: t.heading, margin: 0 }}>
                  Store Information
                </h2>
              </div>
              <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.5rem 0' }}>
                Public store identity and customer service contact details.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. STORE NAME */}
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    STORE NAME
                  </span>
                  <strong style={{ fontSize: '14px', fontWeight: 800, color: t.heading, display: 'block', marginTop: '0.25rem' }}>
                    {storeName}
                  </strong>
                </div>

                {/* 2. ABOUT STORE OWNER */}
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    ABOUT STORE OWNER
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: t.heading, display: 'block', marginTop: '0.25rem' }}>
                    {store.description || store.tagline || 'Official Development Agent Store'}
                  </span>
                </div>

                {/* 3. SERVICE OVERVIEW */}
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    SERVICE OVERVIEW
                  </span>
                  <p style={{ fontSize: '12px', color: t.bodyText, margin: '0.25rem 0 0 0', lineHeight: 1.5 }}>
                    MTN, Telecel & AirtelTigo bundles delivered to your phone within minutes. Safe, fast, and reliable.
                  </p>
                </div>

                {/* 4. CUSTOMER SUPPORT PHONE */}
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    CUSTOMER SUPPORT PHONE
                  </span>
                  <a
                    href={`tel:${contactPhone}`}
                    style={{
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#A3E635',
                      textDecoration: 'none',
                      display: 'inline-block',
                      marginTop: '0.25rem',
                    }}
                  >
                    {contactPhone}
                  </a>
                </div>

                {/* 5. FULFILLMENT GUARANTEE */}
                <div
                  style={{
                    backgroundColor: t.cardInnerBg,
                    border: `1px solid ${t.cardInnerBorder}`,
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    FULFILLMENT GUARANTEE
                  </span>
                  <p style={{ fontSize: '12px', color: t.bodyText, margin: '0.25rem 0 0 0', lineHeight: 1.5 }}>
                    All data bundles are fulfilled automatically 24/7. In the event of a network error, transactions are automatically queued for retry or refunded.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* 3. UNIVERSAL FOOTER (Matches images) */}
      {/* ==================================================================== */}
      <footer
        style={{
          borderTop: `1px solid ${t.footerBorder}`,
          backgroundColor: t.footerBg,
          padding: '2rem 1.25rem',
          fontSize: '12px',
          color: t.footerText,
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          {/* Left: Brand Identity & Copyright */}
          <div>
            <strong style={{ fontSize: '14px', color: t.heading, display: 'block', marginBottom: '0.25rem' }}>
              {storeName} Direct Storefront
            </strong>
            <p style={{ fontSize: '11px', color: t.footerText, margin: '0 0 0.5rem 0', maxWidth: '420px', lineHeight: 1.4 }}>
              MTN, Telecel & AirtelTigo bundles delivered to your phone within minutes. Safe, fast, and reliable.
            </p>
            <div style={{ fontSize: '11px', color: t.footerText }}>
              © 2026 {storeName} Platform. All rights reserved.
              <a
                href={STOREFRONT_CONFIG.getMainPlatformUrl('/login')}
                style={{ marginLeft: '0.5rem', color: t.footerText, textDecoration: 'none' }}
              >
                Merchant Portal
              </a>
            </div>
          </div>

          {/* Right: WhatsApp Us button, Track Order, Store Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {whatsappNumber && (
              <a
                href={STOREFRONT_CONFIG.getWhatsAppUrl(whatsappNumber, storeName)}
                target="_blank"
                rel="noreferrer"
                style={{
                  backgroundColor: '#10B981',
                  color: '#000000',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '100px',
                  fontWeight: 900,
                  fontSize: '12px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                }}
              >
                <MessageSquare size={14} color="#000000" />
                <span>WhatsApp Us</span>
              </a>
            )}

            <a
              href="#track"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('track');
              }}
              style={{
                color: t.heading,
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Track Order
            </a>

            <a
              href="#info"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('info');
              }}
              style={{
                color: t.heading,
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Store Info
            </a>
          </div>
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* 4. EXPRESS CHECKOUT MODAL */}
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
            padding: '1rem',
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
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: t.cardShadow,
              zIndex: 110,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#A3E635', fontWeight: 900, textTransform: 'uppercase' }}>
                  Secure Customer Checkout
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: t.heading }}>
                  Purchase {formatDataAmountWithSpace(selectedProduct.dataAmountMb)} {selectedProduct.network}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', color: t.subText, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Price Pill */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #A7F3D0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: t.heading, display: 'block' }}>
                  {selectedProduct.network} · {formatDataAmount(selectedProduct.dataAmountMb)} Data
                </span>
                <span style={{ fontSize: '10px', color: t.subText }}>
                  {selectedProduct.validityDesc || 'Non-Expiry'}
                </span>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#10B981' }}>
                GH₵ {(selectedProduct.retailPricePesewas / 100).toFixed(2)}
              </strong>
            </div>

            <form onSubmit={handleProcessCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: t.subText, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('mobile_money')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '10px',
                      border: selectedChannel === 'mobile_money' ? '2px solid #A3E635' : `1px solid ${t.inputBorder}`,
                      backgroundColor: selectedChannel === 'mobile_money' ? (isDark ? 'rgba(163, 230, 53, 0.15)' : '#FEF9C3') : t.inputBg,
                      color: t.heading,
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Smartphone size={14} color="#A3E635" />
                    <span>Mobile Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('card')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '10px',
                      border: selectedChannel === 'card' ? '2px solid #A3E635' : `1px solid ${t.inputBorder}`,
                      backgroundColor: selectedChannel === 'card' ? (isDark ? 'rgba(163, 230, 53, 0.15)' : '#FEF9C3') : t.inputBg,
                      color: t.heading,
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <CreditCard size={14} color="#A3E635" />
                    <span>Debit Card</span>
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isCheckingOut || isMaintenanceMode}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: isMaintenanceMode ? '#334155' : '#A3E635',
                    color: '#000000',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 900,
                    cursor: isCheckingOut ? 'wait' : isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: !isMaintenanceMode ? '0 4px 16px rgba(163, 230, 53, 0.35)' : 'none',
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

              <div style={{ textAlign: 'center', fontSize: '10px', color: t.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                <ShieldCheck size={13} color="#10B981" />
                <span>256-bit Encrypted Server-Side Paystack Verification</span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ORDER CONFIRMATION MODAL */}
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
            padding: '1rem',
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
              borderRadius: '20px',
              padding: '1.75rem',
              textAlign: 'center',
              zIndex: 110,
              boxShadow: t.cardShadow,
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
                margin: '0 auto 1rem auto',
              }}
            >
              <CheckCircle2 size={30} />
            </div>

            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: t.heading }}>
              Bundle Dispatched!
            </h3>
            <p style={{ fontSize: '12px', color: t.bodyText, marginTop: '0.35rem', lineHeight: 1.5 }}>
              Your order <strong style={{ color: '#A3E635', fontFamily: 'monospace' }}>{confirmedOrder.orderId}</strong> has been confirmed and queued for direct telecom delivery to <strong style={{ color: t.heading, fontFamily: 'monospace' }}>{confirmedOrder.recipientPhone}</strong>.
            </p>

            <div
              style={{
                backgroundColor: t.cardInnerBg,
                border: `1px solid ${t.cardInnerBorder}`,
                borderRadius: '12px',
                padding: '1rem',
                margin: '1rem 0',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.subText }}>Package:</span>
                <strong style={{ color: t.heading }}>{confirmedOrder.product.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.subText }}>Amount Paid:</span>
                <strong style={{ color: '#10B981' }}>{confirmedOrder.amountDisplay}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: t.subText }}>Status:</span>
                <span style={{ color: '#38BDF8', fontWeight: 800 }}>● {confirmedOrder.statusLabel}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveCustomerOrder(confirmedOrder);
                setConfirmedOrder(null);
                setSelectedProduct(null);
              }}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '10px',
                backgroundColor: '#A3E635',
                color: '#000000',
                border: 'none',
                fontSize: '12px',
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
      {/* 6. IN-STORE TRACKING MODAL */}
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
            padding: '1rem',
          }}
        >
          <div
            style={{ position: 'fixed', inset: 0, backgroundColor: t.modalOverlay, backdropFilter: 'blur(6px)' }}
            onClick={() => setShowTrackModal(false)}
          />

          <div
            style={{
              position: 'relative',
              maxWidth: '480px',
              width: '100%',
              backgroundColor: t.modalBg,
              border: `1px solid ${t.modalBorder}`,
              borderRadius: '20px',
              padding: '1.75rem',
              zIndex: 110,
              boxShadow: t.cardShadow,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#A3E635', fontWeight: 900, textTransform: 'uppercase' }}>
                  Live Order Tracker
                </span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: t.heading }}>
                  Track Order Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                style={{ background: 'none', border: 'none', color: t.subText, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: t.subText, margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
              Enter your ByteBeacon order ID to monitor telecom dispatch status in real-time.
            </p>

            <form onSubmit={handleModalTrackSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Enter Order ID (e.g. ord_sf_...)"
                  value={modalTrackQuery}
                  onChange={(e) => setModalTrackQuery(e.target.value)}
                  leftIcon={<Search size={14} color={t.subText} />}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isModalTracking}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  backgroundColor: '#A3E635',
                  color: '#000000',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: isModalTracking ? 'wait' : 'pointer',
                }}
              >
                Search
              </button>
            </form>

            {modalTrackedOrder && (
              <div
                style={{
                  backgroundColor: t.cardInnerBg,
                  border: `1px solid ${t.cardInnerBorder}`,
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: t.subText }}>Order ID:</span>
                  <strong style={{ color: '#A3E635', fontFamily: 'monospace' }}>
                    {modalTrackedOrder.orderId}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: t.subText }}>Package:</span>
                  <strong style={{ color: t.heading }}>{modalTrackedOrder.product.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: t.subText }}>Recipient:</span>
                  <strong style={{ color: t.heading, fontFamily: 'monospace' }}>
                    {modalTrackedOrder.recipientPhone}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: t.subText }}>Status:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>
                    ● {modalTrackedOrder.statusLabel || modalTrackedOrder.status}
                  </span>
                </div>
              </div>
            )}

            {modalTrackSearched && !isModalTracking && !modalTrackedOrder && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                No order found matching "{modalTrackQuery}". Please check your order reference.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. BENEFICIARY NOT APPROVED WARNING MODAL */}
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
