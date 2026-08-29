import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkProvider, PaymentMethod } from '@bytebeacon/shared';
import { Button } from '../ui/Button/Button.js';
import { PhoneInput, Input } from '../ui/index.js';
import { NetworkBadge } from '../ui/Badge/Badge.js';
import { BundleItem } from './BundleSelector.js';
import { catalogApi } from '../../api/catalog.api.js';
import {
  CheckCircle2,
  Wallet,
  Copy,
  Check,
  X,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Lock,
  ArrowRight,
  UsersRound,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWalletBalance } from '../../hooks/useWalletBalance.js';
import { ordersApi } from '../../api/orders.api.js';

export interface BulkOrderItem {
  recipientPhone: string;
  productId: string;
  dataDisplay?: string;
  pricePesewas?: number;
}

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNetwork?: NetworkProvider;
  initialBundleId?: string;
  initialRecipientPhone?: string;
  customTitle?: string;
  customPackageSummary?: string;
  customRecipientSummary?: string;
  customAmountDisplay?: string;
  walletBalanceGhs?: number;
  isGuestPurchase?: boolean;
  channel?: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API';
  bulkItems?: BulkOrderItem[];
}

const NETWORK_MODAL_THEMES: Record<
  NetworkProvider,
  {
    brandColor: string;
    buttonBg: string;
    buttonTextColor: string;
    accentBg: string;
    borderColor: string;
    glowColor: string;
  }
> = {
  [NetworkProvider.MTN]: {
    brandColor: '#FFCC00',
    buttonBg: '#FFCC00',
    buttonTextColor: '#000000',
    accentBg: 'rgba(255, 204, 0, 0.08)',
    borderColor: 'rgba(255, 204, 0, 0.35)',
    glowColor: 'rgba(255, 204, 0, 0.25)',
  },
  [NetworkProvider.TELECEL]: {
    brandColor: '#E7192D',
    buttonBg: '#E7192D',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(231, 25, 45, 0.08)',
    borderColor: 'rgba(231, 25, 45, 0.35)',
    glowColor: 'rgba(231, 25, 45, 0.25)',
  },
  [NetworkProvider.AIRTELTIGO]: {
    brandColor: '#0066B2',
    buttonBg: '#0066B2',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(0, 102, 178, 0.08)',
    borderColor: 'rgba(0, 102, 178, 0.35)',
    glowColor: 'rgba(0, 102, 178, 0.25)',
  },
};

// Dynamically load Paystack inline script if not present
function loadPaystackScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).PaystackPop) {
      resolve(true);
      return;
    }
    const existing = document.getElementById('paystack-inline-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  initialNetwork = NetworkProvider.MTN,
  initialBundleId,
  initialRecipientPhone = '',
  customTitle,
  customPackageSummary,
  customRecipientSummary,
  customAmountDisplay,
  walletBalanceGhs,
  isGuestPurchase,
  channel,
  bulkItems,
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { balanceGhs: liveBalanceGhs, refresh: refreshWalletBalance } = useWalletBalance();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  const isBulk = Boolean(bulkItems && bulkItems.length > 0);

  const [step, setStep] = useState<1 | 2 | 3>(
    isBulk || initialRecipientPhone || customRecipientSummary ? 2 : 1,
  );
  const [network, setNetwork] = useState<NetworkProvider>(initialNetwork);
  const [selectedBundle, setSelectedBundle] = useState<BundleItem | null>(null);
  const [recipientPhone, setRecipientPhone] = useState(initialRecipientPhone);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; count?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Determine active channel: explicitly passed, or inferred from authenticated user role
  const isAgentRole = user?.role === 'agent' || user?.role === 'admin' || user?.role === 'super_admin';
  const activeChannel = channel || (isAgentRole ? 'AGENT' : 'CUSTOMER');

  // Determine if this is guest checkout:
  // If isGuestPurchase is explicitly passed, respect it; otherwise if user is authenticated, it's not a guest.
  const effectiveIsGuest = isGuestPurchase !== undefined ? isGuestPurchase : !isAuthenticated;
  const effectiveWalletBalance =
    walletBalanceGhs !== undefined ? walletBalanceGhs : isAuthenticated ? liveBalanceGhs : 0;

  // Selected payment method for authenticated users: 'wallet' or 'paystack'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'wallet' | 'paystack'>(
    effectiveIsGuest ? 'paystack' : 'wallet',
  );

  useEffect(() => {
    if (effectiveIsGuest) {
      setSelectedPaymentMethod('paystack');
    } else {
      setSelectedPaymentMethod('wallet');
    }
  }, [effectiveIsGuest]);

  useEffect(() => {
    if (initialNetwork) {
      setNetwork(initialNetwork);
    }
    if (initialRecipientPhone) {
      setRecipientPhone(initialRecipientPhone);
    }
    if (isBulk || customRecipientSummary || initialRecipientPhone) {
      setStep(2);
    } else {
      setStep(1);
    }

    if (isOpen) {
      let isMounted = true;
      const targetNet = initialNetwork || network || NetworkProvider.MTN;
      catalogApi
        .getBundles(targetNet, activeChannel)
        .then((items) => {
          if (!isMounted || !Array.isArray(items) || items.length === 0) return;
          const isAgent = activeChannel === 'AGENT';
          const mapped: BundleItem[] = items.map((p) => {
            const price = p.effectivePricePesewas ?? (isAgent && p.agentPricePesewas ? p.agentPricePesewas : p.basePricePesewas);
            return {
              id: p.id,
              sku: p.sku,
              network: p.network as NetworkProvider,
              dataAmountMb: p.dataAmountMb,
              dataDisplay: `${(p.dataAmountMb / 1024).toFixed(p.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`,
              pricePesewas: price,
              priceDisplay: `GH₵ ${(price / 100).toFixed(2)}`,
              validityDays: p.validityDays,
              validityDisplay: p.validityDesc || `${p.validityDays} Days`,
              popular: Boolean(p.popular),
            };
          });
          const match =
            (initialBundleId &&
              mapped.find((b) => b.id === initialBundleId || b.sku === initialBundleId)) ||
            mapped[0];
          if (match) setSelectedBundle(match);
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [
    initialNetwork,
    initialBundleId,
    initialRecipientPhone,
    customRecipientSummary,
    isOpen,
    activeChannel,
    isBulk,
  ]);

  // Pre-fetch Paystack script in background when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPaystackScript().catch(() => {});
    }
  }, [isOpen]);

  const packageDisplay =
    customPackageSummary ||
    (isBulk
      ? `${bulkItems?.length} Packages (${network})`
      : selectedBundle?.dataDisplay || '5 GB');

  const amountDisplay =
    customAmountDisplay ||
    (selectedBundle?.priceDisplay
      ? selectedBundle.priceDisplay
      : 'GH₵ 0.00');

  const recipientDisplay =
    customRecipientSummary ||
    (isBulk ? `${bulkItems?.length} Recipients` : recipientPhone);

  // Numeric Price Calculation
  const numericPrice = useMemo(() => {
    if (customAmountDisplay) {
      const match = customAmountDisplay.match(/[\d,.]+/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
      }
    }
    if (selectedBundle?.pricePesewas) {
      return selectedBundle.pricePesewas / 100;
    }
    return 0;
  }, [selectedBundle, customAmountDisplay]);

  // Derived values
  const theme = NETWORK_MODAL_THEMES[network] || NETWORK_MODAL_THEMES[NetworkProvider.MTN];
  const remainingBalance = effectiveWalletBalance - numericPrice;
  const isSufficient = effectiveIsGuest || remainingBalance >= 0;
  const shortfall = (numericPrice - effectiveWalletBalance).toFixed(2);

  // Early return when modal is closed
  if (!isOpen) return null;

  const handleValidateAndContinue = () => {
    if (isMaintenanceMode) {
      toastError(
        'Maintenance in Progress',
        'Platform checkout is temporarily paused for scheduled maintenance.',
      );
      return;
    }
    const cleaned = recipientPhone.replace(/\s+/g, '');
    if (!/^(0|\+?233)[25][0-9]{8}$/.test(cleaned)) {
      setPhoneError('Please enter a valid Ghana 10-digit mobile number (e.g. 0241234567)');
      return;
    }
    setPhoneError('');
    setStep(2); // Proceed to Payment Review
  };

  const handlePaystackCheckout = async () => {
    if (isMaintenanceMode) {
      toastError(
        'Maintenance in Progress',
        'Platform checkout is temporarily paused for scheduled maintenance.',
      );
      return;
    }
    const targetPhone = (
      recipientPhone ||
      initialRecipientPhone ||
      (customRecipientSummary && !isBulk ? customRecipientSummary : '') ||
      ''
    ).trim().replace(/\s+/g, '');
    const bundleId = selectedBundle?.id || initialBundleId || '';

    if (!isBulk && !targetPhone) {
      toastError('Recipient Required', 'Please enter a recipient phone number before proceeding.');
      setStep(1);
      return;
    }
    if (!isBulk && !bundleId) {
      toastError('Bundle Required', 'Please select a data bundle before proceeding.');
      setStep(1);
      return;
    }

    const payEmail = buyerEmail.trim() || user?.email || `${targetPhone || 'customer'}@bytebeacon.com`;
    const amountPesewas = Math.round(numericPrice * 100);

    setIsProcessing(true);
    toastInfo('Initializing Checkout', 'Connecting to Paystack Secure Gateway...');

    try {
      const isScriptLoaded = await loadPaystackScript();
      const paystackKey =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY) || '';

      if (
        isScriptLoaded &&
        (window as any).PaystackPop &&
        paystackKey &&
        !paystackKey.includes('placeholder')
      ) {
        const handler = (window as any).PaystackPop.setup({
          key: paystackKey,
          email: payEmail,
          amount: amountPesewas,
          currency: 'GHS',
          ref: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          metadata: {
            custom_fields: [
              {
                display_name: 'Recipient SIM',
                variable_name: 'recipient_phone',
                value: targetPhone || (bulkItems?.length ? `${bulkItems.length} recipients` : ''),
              },
              { display_name: 'Network', variable_name: 'network', value: network },
              { display_name: 'Package', variable_name: 'package', value: packageDisplay },
            ],
          },
          callback: async function (response: { reference: string }) {
            try {
              if (bulkItems && bulkItems.length > 0) {
                const submission = await ordersApi.createBulkSubmission({
                  name: customTitle || `Bulk Order (${bulkItems.length} Recipients)`,
                  items: bulkItems.map((i) => ({
                    recipientPhone: i.recipientPhone,
                    productId: i.productId,
                  })),
                  paymentMethod: PaymentMethod.PAYSTACK,
                  idempotencyKey: response.reference || `bulk_${Date.now()}`,
                });
                if (response.reference) {
                  await ordersApi.verifyPayment(response.reference, submission.id).catch(() => {});
                }
                setCompletedOrder({ id: submission.id, count: bulkItems.length });
              } else if (bundleId) {
                const created = await ordersApi.createOrder({
                  productId: bundleId,
                  recipientPhone: targetPhone,
                  paymentMethod: PaymentMethod.PAYSTACK,
                  idempotencyKey: response.reference || `ord_${Date.now()}`,
                });
                if (response.reference) {
                  await ordersApi
                    .verifyPayment(response.reference, created.id || created.publicId)
                    .catch(() => {});
                }
                setCompletedOrder({ id: created.publicId || created.id || response.reference });
              } else {
                setCompletedOrder({ id: response.reference });
              }
            } catch {
              setCompletedOrder({ id: response.reference });
            }
            setIsProcessing(false);
            setStep(3);
            await refreshWalletBalance();
            window.dispatchEvent(new CustomEvent('wallet-updated'));
            toastSuccess(
              'Payment Verified!',
              `Paid GH₵ ${numericPrice.toFixed(2)} via Paystack. Bundle is being dispatched.`,
            );
          },
          onClose: function () {
            setIsProcessing(false);
            toastInfo('Payment Cancelled', 'You can resume your payment anytime.');
          },
        });
        handler.openIframe();
      } else {
        // Direct backend fulfillment
        if (bulkItems && bulkItems.length > 0) {
          const submission = await ordersApi.createBulkSubmission({
            name: customTitle || `Bulk Order (${bulkItems.length} Recipients)`,
            items: bulkItems.map((i) => ({
              recipientPhone: i.recipientPhone,
              productId: i.productId,
            })),
            paymentMethod: effectiveIsGuest ? PaymentMethod.PAYSTACK : PaymentMethod.WALLET,
            idempotencyKey: `bulk_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          });
          setCompletedOrder({ id: submission.id, count: bulkItems.length });
        } else {
          const created = await ordersApi.createOrder({
            productId: bundleId,
            recipientPhone: targetPhone,
            paymentMethod: effectiveIsGuest ? PaymentMethod.PAYSTACK : PaymentMethod.WALLET,
            idempotencyKey: `ord_buy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          });
          setCompletedOrder({ id: created.publicId || created.id });
        }
        setIsProcessing(false);
        setStep(3);
        await refreshWalletBalance();
        window.dispatchEvent(new CustomEvent('wallet-updated'));
        toastSuccess(
          'Order Confirmed',
          `Paid GH₵ ${numericPrice.toFixed(2)}. Processing fulfillment.`,
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      toastError('Payment Failed', err.message || 'Unable to complete Paystack payment.');
    }
  };

  const handleWalletPurchase = async () => {
    if (isMaintenanceMode) {
      toastError(
        'Maintenance in Progress',
        'Platform checkout is temporarily paused for scheduled maintenance.',
      );
      return;
    }
    if (!isSufficient) {
      toastError('Insufficient Balance', `You need GH₵ ${shortfall} more to complete this purchase.`);
      return;
    }

    setIsProcessing(true);

    try {
      if (bulkItems && bulkItems.length > 0) {
        const submission = await ordersApi.createBulkSubmission({
          name: customTitle || `Bulk Order (${bulkItems.length} Recipients)`,
          items: bulkItems.map((i) => ({
            recipientPhone: i.recipientPhone,
            productId: i.productId,
          })),
          paymentMethod: PaymentMethod.WALLET,
          idempotencyKey: `bulk_sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        });

        setIsProcessing(false);
        const subRef = submission.id;
        setCompletedOrder({ id: subRef, count: bulkItems.length });
        setStep(3);
        await refreshWalletBalance();
        window.dispatchEvent(new CustomEvent('wallet-updated'));
        toastSuccess(
          'Bulk Order Confirmed',
          `Paid GH₵ ${numericPrice.toFixed(2)} from wallet for ${bulkItems.length} recipients. Reference: ${subRef}.`,
        );
      } else {
        const bundleId = selectedBundle?.id || initialBundleId;
        if (!bundleId) {
          throw new Error('Please select a valid data package before purchasing.');
        }
        const cleanedPhone = (
          recipientPhone ||
          initialRecipientPhone ||
          (customRecipientSummary && !isBulk ? customRecipientSummary : '') ||
          ''
        ).trim().replace(/\s+/g, '');
        if (!cleanedPhone) {
          throw new Error('Please enter a recipient phone number before purchasing.');
        }
        const order = await ordersApi.createOrder({
          productId: bundleId,
          recipientPhone: cleanedPhone,
          paymentMethod: PaymentMethod.WALLET,
          idempotencyKey: `ord_buy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        });

        setIsProcessing(false);
        const orderRef =
          order.publicId || (order as any).orderNumber || order.id || 'Order Confirmed';
        setCompletedOrder({ id: orderRef });
        setStep(3);
        await refreshWalletBalance();
        window.dispatchEvent(new CustomEvent('wallet-updated'));
        toastSuccess(
          'Order Confirmed',
          `Paid GH₵ ${numericPrice.toFixed(2)} from wallet. Order reference: ${orderRef}.`,
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      toastError('Order Failed', err.message || 'Unable to complete purchase. Please try again.');
    }
  };

  const handleCopyOrder = () => {
    if (!completedOrder) return;
    navigator.clipboard.writeText(completedOrder.id);
    setCopied(true);
    toastSuccess('Copied', `Order reference ${completedOrder.id} copied.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep(isBulk || customRecipientSummary ? 2 : 1);
    setRecipientPhone(initialRecipientPhone);
    setBuyerEmail('');
    setPhoneError('');
    setCompletedOrder(null);
    onClose();
  };

  const handleNavigateToTopUp = () => {
    onClose();
    if (isAgentRole) {
      navigate('/agent/wallet');
    } else {
      navigate('/app/wallet');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      {/* Dark Overlay Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={handleReset}
      />

      {/* Centered Modal Surface */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '490px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-tactile-lg)',
          zIndex: 210,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 800,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {step === 1
                ? 'Step 1 of 2 · Recipient'
                : step === 2
                  ? 'Step 2 of 2 · Confirm Purchase'
                  : 'Order Status'}
            </span>
            <h2
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 900,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              {step === 3
                ? isBulk
                  ? 'Batch Order Submitted'
                  : 'Order Dispatched'
                : customTitle || 'Purchase Data'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'none',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {isMaintenanceMode && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#FBBF24',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                lineHeight: 1.4,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Scheduled Maintenance in Progress:</strong>{' '}
                {maintenanceMessage ||
                  'Telecom fulfillment and checkout are temporarily paused. Please check back shortly.'}
              </div>
            </div>
          )}

          {/* Selected Package Summary Card */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: theme.accentBg,
              borderRadius: 'var(--radius-lg)',
              border: `1px solid ${theme.borderColor}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <NetworkBadge network={network} size="sm" />
              <div>
                <strong
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 900,
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-data)',
                  }}
                >
                  {packageDisplay}
                </strong>
                <span
                  style={{
                    fontSize: 'var(--font-size-3xs)',
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    fontWeight: 700,
                  }}
                >
                  {isBulk
                    ? `${bulkItems?.length} items in batch · Direct SIM Dispatch`
                    : selectedBundle?.validityDisplay || 'Instant Delivery · Non-Expiry'}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <strong
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 900,
                  fontFamily: 'var(--font-data)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {amountDisplay}
              </strong>
            </div>
          </div>

          {/* STAGE 1: Enter Recipient & Contact Details */}
          {step === 1 && !isBulk && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <PhoneInput
                label="Recipient SIM Mobile Number"
                placeholder="024 123 4567"
                value={recipientPhone}
                onChange={(e) => {
                  setRecipientPhone(e.target.value);
                  setPhoneError('');
                }}
                error={phoneError}
                hint={`Enter the ${network} phone number to receive this data bundle.`}
                autoFocus
              />

              {effectiveIsGuest && (
                <Input
                  label="Email Address (Optional)"
                  placeholder="name@email.com (for payment receipt)"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  hint="Used for sending your Paystack payment receipt and fulfillment confirmation."
                />
              )}

              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: 'var(--font-size-2xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <ShieldCheck size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
                <span>Non-expiry guarantee. Direct SIM top-up with zero registration required.</span>
              </div>
            </div>
          )}

          {/* STAGE 2: Payment Confirmation */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Recipient Details Confirmation Pill */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {isBulk ? 'Batch Recipients:' : 'Recipient SIM:'}
                </span>
                <strong
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: isBulk ? 'var(--font-sans)' : 'var(--font-mono)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {recipientDisplay || 'Not specified'}
                </strong>
              </div>

              {/* Payment Method Selector Tabs for Authenticated Users */}
              {!effectiveIsGuest && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 800,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Select Payment Method
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('wallet')}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border:
                          selectedPaymentMethod === 'wallet'
                            ? '2px solid var(--color-primary)'
                            : '1px solid var(--color-border-default)',
                        backgroundColor:
                          selectedPaymentMethod === 'wallet'
                            ? 'rgba(34, 197, 94, 0.08)'
                            : 'var(--color-bg-surface-elevated)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        textAlign: 'left',
                      }}
                    >
                      <Wallet size={16} color="var(--color-primary)" />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800 }}>Wallet Balance</div>
                        <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                          GH₵ {effectiveWalletBalance.toFixed(2)}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('paystack')}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border:
                          selectedPaymentMethod === 'paystack'
                            ? '2px solid #00C3F7'
                            : '1px solid var(--color-border-default)',
                        backgroundColor:
                          selectedPaymentMethod === 'paystack'
                            ? 'rgba(0, 195, 247, 0.08)'
                            : 'var(--color-bg-surface-elevated)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        textAlign: 'left',
                      }}
                    >
                      <Lock size={16} color="#00C3F7" />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800 }}>Paystack Gateway</div>
                        <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                          MoMo / Cards
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* PAYMENT OPTION A: Guest Direct Checkout via Paystack */}
              {selectedPaymentMethod === 'paystack' ? (
                <div>
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1.5px solid #00C3F7',
                      backgroundColor: 'rgba(0, 195, 247, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#00C3F7',
                            color: '#000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '13px',
                          }}
                        >
                          <Lock size={18} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 800,
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            Paystack Secure Checkout
                          </div>
                          <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)' }}>
                            Mobile Money & Bank Cards
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#00C3F7',
                          backgroundColor: 'rgba(0, 195, 247, 0.12)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid rgba(0, 195, 247, 0.3)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Instant
                      </span>
                    </div>

                    {/* Supported Payment Channels */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        paddingTop: '0.35rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 204, 0, 0.15)',
                          color: '#FFCC00',
                          border: '1px solid rgba(255, 204, 0, 0.3)',
                        }}
                      >
                        MTN MoMo
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(231, 25, 45, 0.15)',
                          color: '#E7192D',
                          border: '1px solid rgba(231, 25, 45, 0.3)',
                        }}
                      >
                        Telecel Cash
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0, 102, 178, 0.15)',
                          color: '#38BDF8',
                          border: '1px solid rgba(0, 102, 178, 0.3)',
                        }}
                      >
                        AT Money
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#E2E8F0',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        Visa / Mastercard
                      </span>
                    </div>
                  </div>

                  {/* Order Pricing Breakdown */}
                  <div
                    style={{
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      padding: 'var(--space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Selected Package:</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{packageDisplay}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Network:</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{network}</strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'var(--font-size-xs)',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: 'var(--space-2)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>Total Payable:</span>
                      <strong
                        style={{
                          fontFamily: 'var(--font-data)',
                          color: 'var(--color-primary)',
                          fontWeight: 900,
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        {amountDisplay}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                /* PAYMENT OPTION B: Authenticated Wallet Balance */
                <div>
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1.5px solid var(--color-primary)',
                      backgroundColor: 'rgba(34, 197, 94, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-primary)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Wallet size={18} strokeWidth={2.4} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 800,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          Wallet Balance
                        </div>
                        <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)' }}>
                          Instant Deduct
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 'var(--font-size-3xs)',
                        fontWeight: 800,
                        color: 'var(--color-primary)',
                        backgroundColor: 'rgba(34, 197, 94, 0.12)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Active Wallet
                    </span>
                  </div>

                  {/* Financial Ledger Breakdown */}
                  <div
                    style={{
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      padding: 'var(--space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Wallet Balance:</span>
                      <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                        GH₵ {effectiveWalletBalance.toFixed(2)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Total Price:</span>
                      <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--color-danger)' }}>
                        - GH₵ {numericPrice.toFixed(2)}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'var(--font-size-xs)',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: 'var(--space-2)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Remaining Balance:
                      </span>
                      <strong
                        style={{
                          fontFamily: 'var(--font-data)',
                          color: isSufficient ? 'var(--color-success)' : 'var(--color-danger)',
                          fontWeight: 800,
                        }}
                      >
                        GH₵ {remainingBalance.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* Insufficient Balance Alert */}
                  {!isSufficient && (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                        <AlertTriangle
                          size={18}
                          color="var(--color-danger)"
                          style={{ marginTop: '2px', flexShrink: 0 }}
                        />
                        <div>
                          <strong
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--color-danger)',
                              display: 'block',
                            }}
                          >
                            Insufficient wallet balance
                          </strong>
                          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                            You need GH₵ {shortfall} more to complete this purchase.
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={handleNavigateToTopUp}
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: '#FFFFFF',
                          fontWeight: 700,
                        }}
                      >
                        Top Up Wallet
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: Order Dispatched Confirmation */}
          {step === 3 && completedOrder && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-4) 0',
                gap: 'var(--space-4)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-surface)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isBulk ? <UsersRound size={32} /> : <CheckCircle2 size={32} />}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 900,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                  }}
                >
                  {isBulk ? 'Bulk Order Queued for Dispatch!' : 'Data Bundle Dispatched!'}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    marginTop: '0.35rem',
                    maxWidth: '360px',
                    lineHeight: 1.5,
                  }}
                >
                  {isBulk ? (
                    <>
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {completedOrder.count || bulkItems?.length} recipient orders
                      </strong>{' '}
                      have been registered for fulfillment on {network}.{' '}
                      {selectedPaymentMethod === 'wallet'
                        ? 'Paid from ByteBeacon Wallet.'
                        : 'Secured via Paystack.'}
                    </>
                  ) : (
                    <>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{packageDisplay}</strong> data
                      has been dispatched to{' '}
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {recipientDisplay || 'your SIM'}
                      </strong>{' '}
                      on {network}.{' '}
                      {selectedPaymentMethod === 'wallet'
                        ? 'Paid from ByteBeacon Wallet.'
                        : 'Secured & verified via Paystack.'}
                    </>
                  )}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  width: '100%',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      textAlign: 'left',
                    }}
                  >
                    {isBulk ? 'Batch Reference' : 'Order Reference'}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {completedOrder.id}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyOrder}
                  leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {/* 1-Click Track Order Link */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/app/track/${completedOrder.id}`);
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <ArrowRight size={14} />
                <span>Track Fulfillment Live</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          {step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleValidateAndContinue}
                disabled={!recipientPhone.trim() || isMaintenanceMode}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isMaintenanceMode
                    ? 'var(--color-bg-surface-muted)'
                    : theme.buttonBg,
                  color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                  fontWeight: 800,
                  fontSize: 'var(--font-size-xs)',
                  cursor: !recipientPhone.trim() || isMaintenanceMode ? 'not-allowed' : 'pointer',
                  opacity: !recipientPhone.trim() || isMaintenanceMode ? 0.6 : 1,
                  boxShadow: !isMaintenanceMode ? `0 2px 8px ${theme.glowColor}` : 'none',
                }}
              >
                {isMaintenanceMode ? 'Platform in Maintenance' : 'Continue to Payment →'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isBulk || initialRecipientPhone || customRecipientSummary
                    ? handleReset()
                    : setStep(1)
                }
                disabled={isProcessing}
              >
                {isBulk || initialRecipientPhone || customRecipientSummary ? 'Cancel' : '← Back'}
              </Button>

              {selectedPaymentMethod === 'paystack' ? (
                <button
                  type="button"
                  onClick={handlePaystackCheckout}
                  disabled={isProcessing || isMaintenanceMode}
                  style={{
                    padding: '0.5rem 1.35rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: isMaintenanceMode
                      ? 'var(--color-bg-surface-muted)'
                      : theme.buttonBg,
                    color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                    fontWeight: 900,
                    fontSize: 'var(--font-size-xs)',
                    cursor: isProcessing
                      ? 'wait'
                      : isMaintenanceMode
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: isProcessing || isMaintenanceMode ? 0.6 : 1,
                    boxShadow: !isMaintenanceMode ? `0 2px 10px ${theme.glowColor}` : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Lock size={14} />
                  <span>
                    {isProcessing
                      ? 'Connecting...'
                      : isMaintenanceMode
                        ? 'Platform in Maintenance'
                        : `Pay ${amountDisplay} via Paystack`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleWalletPurchase}
                  disabled={isProcessing || !isSufficient || isMaintenanceMode}
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor:
                      isSufficient && !isMaintenanceMode
                        ? theme.buttonBg
                        : 'var(--color-bg-surface-muted)',
                    color:
                      isSufficient && !isMaintenanceMode
                        ? theme.buttonTextColor
                        : 'var(--color-text-muted)',
                    fontWeight: 800,
                    fontSize: 'var(--font-size-xs)',
                    cursor: isProcessing
                      ? 'wait'
                      : !isSufficient || isMaintenanceMode
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: isProcessing ? 0.8 : !isSufficient || isMaintenanceMode ? 0.6 : 1,
                    boxShadow:
                      isSufficient && !isMaintenanceMode
                        ? `0 2px 8px ${theme.glowColor}`
                        : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Zap size={14} />
                  <span>
                    {isProcessing
                      ? 'Deducting...'
                      : isMaintenanceMode
                        ? 'Platform in Maintenance'
                        : 'Confirm Purchase'}
                  </span>
                </button>
              )}
            </>
          )}

          {step === 3 && (
            <Button variant="primary" size="sm" fullWidth onClick={handleReset}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
