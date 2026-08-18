import React, { useEffect } from 'react';
import { NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { NetworkBadge } from '../ui/Badge/Badge.js';
import { Button } from '../ui/Button/Button.js';
import { X, Copy, Check, Smartphone, Package, DollarSign, Calendar, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  network: NetworkProvider;
  recipient: string;
  dataDisplay: string;
  amountDisplay: string;
  paymentStatus: PaymentStatus | string;
  orderStatus: OrderStatus | string;
  dateDisplay: string;
  reference?: string;
  carrierLatency?: string;
}

export interface OrderDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetailData | null;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const { toastSuccess } = useToast();
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    toastSuccess('Copied', `Order reference ${order.orderNumber} copied.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCompleted = order.orderStatus === OrderStatus.COMPLETED || order.orderStatus === 'Delivered';
  const isPending = order.orderStatus === OrderStatus.PROCESSING || order.orderStatus === 'Pending';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Dark Overlay Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          height: '100%',
          backgroundColor: 'var(--color-bg-surface)',
          borderLeft: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-tactile-lg)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'var(--space-6)',
          zIndex: 260,
          overflowY: 'auto',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Order Details
              </div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', margin: '0.15rem 0 0 0' }}>
                {order.orderNumber}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
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
              <X size={18} />
            </button>
          </div>

          {/* Status Header Capsule */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: isCompleted ? 'var(--color-success-surface)' : isPending ? 'var(--color-warning-surface)' : 'var(--color-danger-surface)',
              border: `1px solid ${isCompleted ? 'var(--color-success-border)' : isPending ? 'var(--color-warning-border)' : 'var(--color-danger-border)'}`,
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Fulfillment Status
              </span>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: isCompleted ? 'var(--color-success)' : isPending ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {isCompleted ? 'Delivered Successfully' : isPending ? 'Queued for Provisioning' : 'Failed / Refunded'}
              </div>
            </div>
            <NetworkBadge network={order.network} size="sm" />
          </div>

          {/* Structured Detail Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Recipient */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <Smartphone size={15} />
                <span>Recipient SIM</span>
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                {order.recipient}
              </strong>
            </div>

            {/* Bundle Capacity */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <Package size={15} />
                <span>Data Volume</span>
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                {order.dataDisplay}
              </strong>
            </div>

            {/* Amount */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <DollarSign size={15} />
                <span>Amount Paid</span>
              </div>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)', color: 'var(--color-brand)' }}>
                {order.amountDisplay}
              </strong>
            </div>

            {/* Date */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <Calendar size={15} />
                <span>Timestamp</span>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {order.dateDisplay}
              </span>
            </div>

            {/* Delivery Speed / Carrier Latency */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <Clock size={15} />
                <span>Provisioning Speed</span>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-success)' }}>
                {order.carrierLatency || '1.4s (Instant)'}
              </span>
            </div>
          </div>
        </div>

        {/* Drawer Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <Button variant="outline" size="sm" fullWidth onClick={handleCopyRef} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>
            {copied ? 'Reference Copied' : 'Copy Reference'}
          </Button>

          <Button variant="primary" size="sm" fullWidth onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
