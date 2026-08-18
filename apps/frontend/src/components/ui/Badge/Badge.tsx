import React from 'react';
import { PaymentStatus, OrderStatus, NetworkProvider } from '@bytebeacon/shared';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info' | 'danger' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: 'var(--color-success-surface)', text: 'var(--color-success)' };
      case 'warning':
        return { bg: 'var(--color-warning-surface)', text: 'var(--color-warning)' };
      case 'info':
        return { bg: 'var(--color-info-surface)', text: 'var(--color-info)' };
      case 'danger':
        return { bg: 'var(--color-danger-surface)', text: 'var(--color-danger)' };
      case 'purple':
        return { bg: 'var(--color-api-surface)', text: 'var(--color-api)' };
      case 'neutral':
      default:
        return { bg: 'rgba(167, 175, 183, 0.12)', text: 'var(--color-text-secondary)' };
    }
  };

  const { bg, text } = getColors();

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: size === 'sm' ? '0.125rem 0.4rem' : '0.25rem 0.625rem',
        fontSize: size === 'sm' ? 'var(--font-size-2xs)' : 'var(--font-size-xs)',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${text}33`,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: text,
          }}
        />
      )}
      {children}
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus | string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  switch (status) {
    case PaymentStatus.PAID:
      return <Badge variant="success" size={size} dot>Paid</Badge>;
    case PaymentStatus.PROCESSING:
      return <Badge variant="info" size={size} dot>Processing</Badge>;
    case PaymentStatus.PENDING:
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case PaymentStatus.FAILED:
      return <Badge variant="danger" size={size} dot>Failed</Badge>;
    case PaymentStatus.REFUNDED:
    case PaymentStatus.PARTIALLY_REFUNDED:
      return <Badge variant="purple" size={size} dot>Refunded</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus | string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  switch (status) {
    case OrderStatus.COMPLETED:
      return <Badge variant="success" size={size} dot>Delivered</Badge>;
    case OrderStatus.PROCESSING:
      return <Badge variant="warning" size={size} dot>Processing</Badge>;
    case OrderStatus.SUBMITTED:
    case OrderStatus.READY_FOR_FULFILLMENT:
    case OrderStatus.VALIDATING:
    case OrderStatus.CREATED:
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case OrderStatus.FAILED:
      return <Badge variant="danger" size={size} dot>Failed</Badge>;
    case OrderStatus.CANCELLED:
      return <Badge variant="neutral" size={size} dot>Cancelled</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const NetworkBadge: React.FC<{ network: NetworkProvider | string; size?: 'sm' | 'md' }> = ({ network, size = 'md' }) => {
  const net = String(network || '').toUpperCase();
  let bg = 'rgba(255, 204, 0, 0.15)';
  let color = '#FFCC00';
  let label = 'MTN';

  if (net === 'TELECEL') {
    bg = 'rgba(230, 0, 0, 0.15)';
    color = '#FF4D4D';
    label = 'Telecel';
  } else if (net === 'AIRTELTIGO') {
    bg = 'rgba(0, 128, 255, 0.15)';
    color = '#38BDF8';
    label = 'AirtelTigo';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: size === 'sm' ? '0.125rem 0.4rem' : '0.2rem 0.5rem',
        fontSize: size === 'sm' ? 'var(--font-size-2xs)' : 'var(--font-size-xs)',
        fontWeight: 700,
        borderRadius: 'var(--radius-sm)',
        backgroundColor: bg,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      <span style={{ width: size === 'sm' ? '6px' : '8px', height: size === 'sm' ? '6px' : '8px', borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  );
};
