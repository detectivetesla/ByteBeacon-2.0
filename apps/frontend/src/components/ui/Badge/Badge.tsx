import React from 'react';
import { PaymentStatus, OrderStatus, NetworkProvider } from '@bytebeacon/shared';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info' | 'danger' | 'purple' | 'neutral' | 'brand';
  size?: 'xs' | 'sm' | 'md';
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
      case 'brand':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: 'var(--color-brand)' };
      case 'neutral':
      case 'default':
      default:
        return { bg: 'rgba(167, 175, 183, 0.12)', text: 'var(--color-text-secondary)' };
    }
  };

  const { bg, text } = getColors();

  const getPaddingAndFont = () => {
    switch (size) {
      case 'xs':
        return {
          padding: '0.1rem 0.35rem',
          fontSize: 'var(--font-size-3xs)',
          gap: '0.25rem',
          dotSize: '4px',
        };
      case 'sm':
        return {
          padding: '0.15rem 0.45rem',
          fontSize: 'var(--font-size-2xs)',
          gap: '0.3rem',
          dotSize: '5px',
        };
      case 'md':
      default:
        return {
          padding: '0.2rem 0.55rem',
          fontSize: 'var(--font-size-xs)',
          gap: '0.375rem',
          dotSize: '6px',
        };
    }
  };

  const { padding, fontSize, gap, dotSize } = getPaddingAndFont();

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${text}28`,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: text,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus | string; size?: 'xs' | 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
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

export const OrderStatusBadge: React.FC<{ status: OrderStatus | string; size?: 'xs' | 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  switch (status) {
    case OrderStatus.COMPLETED:
      return <Badge variant="success" size={size} dot>Delivered</Badge>;
    case OrderStatus.PROCESSING:
      return <Badge variant="info" size={size} dot>Processing</Badge>;
    case OrderStatus.SUBMITTED:
    case OrderStatus.READY_FOR_FULFILLMENT:
    case OrderStatus.VALIDATING:
    case OrderStatus.CREATED:
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case OrderStatus.FAILED:
      return <Badge variant="danger" size={size} dot>Failed</Badge>;
    case OrderStatus.PAUSED:
      return <Badge variant="danger" size={size} dot>Paused</Badge>;
    case OrderStatus.CANCELLED:
      return <Badge variant="neutral" size={size} dot>Cancelled</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const ApprovalStatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'VALID') {
    return <Badge variant="success" size={size} dot>Approved</Badge>;
  }
  if (s === 'REJECTED' || s === 'FAILED' || s === 'INVALID') {
    return <Badge variant="danger" size={size} dot>Rejected</Badge>;
  }
  if (s === 'EXPIRED') {
    return <Badge variant="neutral" size={size} dot>Expired</Badge>;
  }
  return <Badge variant="warning" size={size} dot>Pending</Badge>;
};

export const NetworkBadge: React.FC<{ network: NetworkProvider | string; size?: 'xs' | 'sm' | 'md' }> = ({ network, size = 'sm' }) => {
  const net = String(network || '').toUpperCase();
  let bg = 'rgba(212, 160, 0, 0.08)';
  let color = '#B8860B';
  let border = 'rgba(212, 160, 0, 0.25)';
  let label = 'MTN';

  if (net === 'TELECEL') {
    bg = 'rgba(231, 25, 45, 0.08)';
    color = '#DC2626';
    border = 'rgba(231, 25, 45, 0.22)';
    label = 'Telecel';
  } else if (net === 'AIRTELTIGO') {
    bg = 'rgba(0, 102, 178, 0.08)';
    color = '#0284C7';
    border = 'rgba(0, 102, 178, 0.22)';
    label = 'AirtelTigo';
  }

  const isSmall = size === 'sm' || size === 'xs';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: isSmall ? '0.125rem 0.45rem' : '0.2rem 0.55rem',
        fontSize: size === 'xs' ? 'var(--font-size-3xs)' : size === 'sm' ? 'var(--font-size-2xs)' : 'var(--font-size-xs)',
        fontWeight: 650,
        borderRadius: 'var(--radius-sm)',
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        lineHeight: 1.2,
      }}
    >
      <span style={{ width: isSmall ? '5px' : '6px', height: isSmall ? '5px' : '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      {label}
    </span>
  );
};
