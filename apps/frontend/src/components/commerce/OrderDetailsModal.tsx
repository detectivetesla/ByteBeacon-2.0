import React, { useState } from 'react';
import { NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { OrderStatusBadge, PaymentStatusBadge, NetworkBadge } from '../ui/Badge/Badge.js';
import { Button } from '../ui/Button/Button.js';
import { X, CheckCircle2, Clock, Smartphone, AlertCircle, Copy, Check, Calendar, Zap, Wallet, CreditCard, Landmark } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export interface OrderDetailsItem {
  id: string;
  orderNumber: string;
  network: NetworkProvider;
  recipient: string;
  dataDisplay: string;
  amountDisplay: string;
  source?: string;
  paidDisplay?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  dateDisplay: string;
  timestamp?: string;
}

export interface OrderDetailsModalProps {
  order: OrderDetailsItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SourceIndicator: React.FC<{ source?: string }> = ({ source = 'Wallet' }) => {
  const s = source.toLowerCase();
  let Icon = Wallet;
  let label = 'Wallet';
  let color = 'var(--color-primary-light)';

  if (s.includes('momo') || s.includes('mobile')) {
    Icon = Smartphone;
    label = 'MoMo';
    color = 'var(--color-warning)';
  } else if (s.includes('card') || s.includes('visa') || s.includes('master')) {
    Icon = CreditCard;
    label = 'Card';
    color = 'var(--color-info)';
  } else if (s.includes('bank')) {
    Icon = Landmark;
    label = 'Bank';
    color = 'var(--color-brand)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
      }}
    >
      <Icon size={13} color={color} />
      <span>{label}</span>
    </span>
  );
};

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { toastSuccess } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    toastSuccess('Copied', `Order ID ${order.orderNumber} copied.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFailed = order.orderStatus === OrderStatus.FAILED;
  const isCompleted = order.orderStatus === OrderStatus.COMPLETED;
  const paidVal = order.paidDisplay || order.amountDisplay;
  const sourceVal = order.source || 'Wallet';

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
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
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
        {/* Header */}
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
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Order Details
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', margin: 0 }}>
                {order.orderNumber}
              </h2>
              <button
                type="button"
                onClick={handleCopyId}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              </button>
            </div>
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
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Key Specs Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-base)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                Package
              </span>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {order.dataDisplay}
              </div>
              <div style={{ marginTop: '4px' }}>
                <NetworkBadge network={order.network} size="sm" />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                Paid
              </span>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-brand)', marginTop: '2px' }}>
                {paidVal}
              </div>
              <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                <PaymentStatusBadge status={order.paymentStatus} size="sm" />
              </div>
            </div>
          </div>

          {/* Details Table List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Smartphone size={14} />
                Recipient
              </span>
              <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                {order.recipient}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wallet size={14} />
                Payment Source
              </span>
              <SourceIndicator source={sourceVal} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={14} />
                Status
              </span>
              <OrderStatusBadge status={order.orderStatus} size="sm" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} />
                Date & Time
              </span>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                {order.dateDisplay}
              </strong>
            </div>
          </div>

          {/* Clean Fulfillment Timeline */}
          <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 'var(--space-3)' }}>
              Fulfillment Lifecycle
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative', paddingLeft: 'var(--space-4)' }}>
              {/* Step 1: Placed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--color-success)" />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Order Placed</div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Verified and logged</div>
                </div>
              </div>

              {/* Step 2: Payment Confirmed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--color-success)" />
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Payment Confirmed ({sourceVal})</div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Instant clearing · {paidVal}</div>
                </div>
              </div>

              {/* Step 3: Carrier Dispatch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isCompleted ? (
                  <CheckCircle2 size={16} color="var(--color-success)" />
                ) : isFailed ? (
                  <AlertCircle size={16} color="var(--color-danger)" />
                ) : (
                  <Clock size={16} color="var(--color-warning)" />
                )}
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Carrier Dispatch</div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{order.network} data provisioning</div>
                </div>
              </div>

              {/* Step 4: Final Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isCompleted ? (
                  <CheckCircle2 size={16} color="var(--color-success)" />
                ) : isFailed ? (
                  <AlertCircle size={16} color="var(--color-danger)" />
                ) : (
                  <Clock size={16} color="var(--color-text-muted)" />
                )}
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: isCompleted ? 'var(--color-success)' : isFailed ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                    {isCompleted ? 'Delivered to Recipient' : isFailed ? 'Delivery Failed / Refunded' : 'Awaiting Confirmation'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    {isCompleted ? 'Data credited to SIM' : isFailed ? 'Automatic refund initiated' : 'Provisioning in progress'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
