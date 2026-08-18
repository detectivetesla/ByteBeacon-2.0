import { OrderStatus, PaymentStatus } from '@bytebeacon/shared';

export interface PresentationOrderStatus {
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'UNABLE_TO_COMPLETE';
  label: string;
  badgeVariant: 'warning' | 'info' | 'success' | 'danger';
  customerMessage: string;
}

/**
 * Presentation-Safe Status Mapper
 * Maps granular backend & provider operational states into customer-safe statuses.
 * Strictly conceals internal operational states (GMPL, DataHouse, DLQ, RETRYING, RECONCILING, etc.)
 */
export function mapToPresentationOrderStatus(rawStatus: string): PresentationOrderStatus {
  const normalized = (rawStatus || '').toUpperCase();

  switch (normalized) {
    case 'DELIVERED':
    case 'COMPLETED':
    case OrderStatus.COMPLETED:
      return {
        status: 'DELIVERED',
        label: 'Delivered',
        badgeVariant: 'success',
        customerMessage: 'Your data bundle has been delivered successfully.',
      };

    case 'FAILED':
    case 'CANCELLED':
    case 'DLQ':
    case 'REFUNDED':
    case OrderStatus.FAILED:
    case OrderStatus.CANCELLED:
      return {
        status: 'UNABLE_TO_COMPLETE',
        label: 'Unable to complete',
        badgeVariant: 'danger',
        customerMessage: "We're having trouble completing this order. Our team has been notified.",
      };

    case 'PENDING':
    case 'CREATED':
    case 'ORDER_CREATED':
    case OrderStatus.CREATED:
      return {
        status: 'PENDING',
        label: 'Pending',
        badgeVariant: 'warning',
        customerMessage: 'Awaiting payment confirmation to process your order.',
      };

    case 'PROCESSING':
    case 'SUBMITTED':
    case 'PROVIDER_ACCEPTED':
    case 'PROVIDER_PENDING':
    case 'RECONCILING':
    case 'RETRYING':
    case 'CHECKING_ORDER':
    case 'READY_TO_PROCESS':
    case 'ORDER_RECEIVED':
    case OrderStatus.PROCESSING:
    case OrderStatus.SUBMITTED:
    case OrderStatus.READY_FOR_FULFILLMENT:
    case OrderStatus.VALIDATING:
    default:
      return {
        status: 'PROCESSING',
        label: 'Processing',
        badgeVariant: 'info',
        customerMessage: "We're processing your data bundle with the telecom network.",
      };
  }
}

export function mapToPresentationPaymentStatus(rawStatus: string): { label: string; badgeVariant: 'warning' | 'info' | 'success' | 'danger' } {
  const normalized = (rawStatus || '').toUpperCase();

  switch (normalized) {
    case 'PAID':
    case 'COMPLETED':
    case PaymentStatus.PAID:
      return { label: 'Paid', badgeVariant: 'success' };
    case 'FAILED':
    case PaymentStatus.FAILED:
      return { label: 'Failed', badgeVariant: 'danger' };
    case 'REFUNDED':
    case PaymentStatus.REFUNDED:
      return { label: 'Refunded', badgeVariant: 'danger' };
    case 'PROCESSING':
    case PaymentStatus.PROCESSING:
      return { label: 'Processing', badgeVariant: 'info' };
    case 'PENDING':
    case PaymentStatus.PENDING:
    default:
      return { label: 'Pending', badgeVariant: 'warning' };
  }
}
