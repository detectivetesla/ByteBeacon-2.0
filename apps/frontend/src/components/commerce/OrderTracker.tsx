import React from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card } from '../ui/Card/Card.js';
import { PaymentStatusBadge, NetworkBadge } from '../ui/Badge/Badge.js';
import { CheckCircle2, Clock, Smartphone, CreditCard, ShieldCheck } from 'lucide-react';

export interface CustomerOrderDetails {
  orderId: string; // e.g. "BB-102938"
  network: NetworkProvider;
  recipientPhone: string;
  dataDisplay: string;
  priceDisplay: string;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';
  orderStatus: 'ORDER_CREATED' | 'CHECKING_ORDER' | 'READY_TO_PROCESS' | 'ORDER_RECEIVED' | 'PROCESSING' | 'DELIVERED' | 'UNABLE_TO_COMPLETE' | 'CANCELLED';
  statusLabel: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface OrderTrackerProps {
  order: CustomerOrderDetails;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({ order }) => {
  const isPaid = order.paymentStatus === 'PAID';
  const isReceived = order.orderStatus === 'ORDER_RECEIVED' || order.orderStatus === 'PROCESSING' || order.orderStatus === 'DELIVERED';
  const isProcessing = order.orderStatus === 'PROCESSING' || order.orderStatus === 'DELIVERED';
  const isDelivered = order.orderStatus === 'DELIVERED';

  const steps = [
    {
      title: 'Payment Confirmed',
      status: isPaid ? 'COMPLETED' : 'PENDING',
      description: isPaid ? 'Payment authorized and verified' : 'Awaiting payment confirmation',
      icon: <CreditCard size={18} strokeWidth={2.8} />,
    },
    {
      title: 'Order Received',
      status: isReceived ? 'COMPLETED' : 'PENDING',
      description: isReceived ? 'Recipient number validated' : 'Queued for processing',
      icon: <Smartphone size={18} strokeWidth={2.8} />,
    },
    {
      title: 'Processing',
      status: isDelivered ? 'COMPLETED' : isProcessing ? 'PROCESSING' : 'PENDING',
      description: isDelivered ? 'Telecom network provisioned' : isProcessing ? 'Provisioning mobile data' : 'Pending dispatch',
      icon: <Clock size={18} strokeWidth={2.8} />,
    },
    {
      title: 'Data Delivered',
      status: isDelivered ? 'COMPLETED' : 'PENDING',
      description: isDelivered ? 'Bundle successfully delivered' : 'Awaiting final confirmation',
      icon: <CheckCircle2 size={18} strokeWidth={2.8} />,
    },
  ];

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--color-border-default)', paddingBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              Order #{order.orderId}
            </h2>
            <NetworkBadge network={order.network} />
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
            Placed on {new Date(order.createdAt).toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <PaymentStatusBadge status={order.paymentStatus} />
          <span
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              backgroundColor: isDelivered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              color: isDelivered ? 'var(--color-accent-emerald)' : 'var(--color-accent-amber)',
              border: `1px solid ${isDelivered ? 'var(--color-accent-emerald)' : 'var(--color-accent-amber)'}44`,
            }}
          >
            ● {order.statusLabel}
          </span>
        </div>
      </div>

      {/* Package & Recipient Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>RECIPIENT</span>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginTop: '0.125rem' }}>{order.recipientPhone}</div>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>PACKAGE</span>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginTop: '0.125rem' }}>{order.dataDisplay}</div>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>AMOUNT PAID</span>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.125rem' }}>
            {order.priceDisplay}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>SECURITY</span>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
            <ShieldCheck size={14} strokeWidth={2.5} /> Verified
          </div>
        </div>
      </div>

      {/* Multi-Step Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Delivery Status
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {steps.map((st, idx) => {
            const isDone = st.status === 'COMPLETED';
            const isCurrent = st.status === 'PROCESSING';

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isDone
                      ? 'rgba(16, 185, 129, 0.15)'
                      : isCurrent
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'var(--color-bg-surface-elevated)',
                    color: isDone
                      ? 'var(--color-accent-emerald)'
                      : isCurrent
                      ? 'var(--color-accent-amber)'
                      : 'var(--color-text-muted)',
                    border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.4)' : isCurrent ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-border-default)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {st.icon}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      color: isDone || isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {st.title}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                    {st.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
