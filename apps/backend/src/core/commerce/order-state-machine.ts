import { OrderStatus } from '@bytebeacon/shared';
import { BadRequestError } from '../errors/app-error.js';

export type AgentOrderLifecycleStatus =
  | 'received'
  | 'processing'
  | 'delivered'
  | 'approved'
  | 'could_not_deliver'
  | 'rejected'
  | 'refunded'
  | 'partially_approved';

export type AgentWebhookEventType =
  | 'order.received'
  | 'order.processing'
  | 'order.approved'
  | 'order.partially_approved'
  | 'order.rejected'
  | 'purchase.success'
  | 'purchase.failed'
  | 'wallet.updated';

export class OrderStateMachine {
  // Explicit valid state transitions for internal domain OrderStatus
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.CREATED]: [
      OrderStatus.VALIDATING,
      OrderStatus.READY_FOR_FULFILLMENT,
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.VALIDATING]: [
      OrderStatus.READY_FOR_FULFILLMENT,
      OrderStatus.FAILED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.READY_FOR_FULFILLMENT]: [
      OrderStatus.SUBMITTED,
      OrderStatus.PROCESSING,
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.SUBMITTED]: [
      OrderStatus.PROCESSING,
      OrderStatus.COMPLETED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.PROCESSING]: [
      OrderStatus.COMPLETED,
      OrderStatus.FAILED,
    ],
    // Terminal States (No outward transitions)
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.FAILED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  /**
   * Finite State Machine for Agent Orders:
   * received  →  processing  →  delivered (happy path)
   *                         ↘  could_not_deliver  →  refunded
   *
   * With aliases:
   * - delivered / approved (happy path)
   * - could_not_deliver / rejected (failure path)
   * - mixed batches: partially_approved
   */
  private static readonly AGENT_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
    received: ['processing', 'could_not_deliver', 'rejected', 'refunded'],
    processing: ['delivered', 'approved', 'could_not_deliver', 'rejected', 'refunded', 'partially_approved'],
    could_not_deliver: ['refunded'],
    rejected: ['refunded'],
    delivered: [],
    approved: [],
    refunded: [],
    partially_approved: [],
  };

  public static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static validateTransition(from: OrderStatus, to: OrderStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestError(
        `Invalid order status transition: Cannot transition from '${from}' to '${to}'`,
      );
    }
  }

  public static canTransitionAgentLifecycle(from: string, to: string): boolean {
    const normalizedFrom = String(from || '').trim().toLowerCase();
    const normalizedTo = String(to || '').trim().toLowerCase();
    const allowed = this.AGENT_LIFECYCLE_TRANSITIONS[normalizedFrom];
    return allowed ? allowed.includes(normalizedTo) : false;
  }

  public static validateAgentLifecycleTransition(from: string, to: string): void {
    if (!this.canTransitionAgentLifecycle(from, to)) {
      throw new BadRequestError(
        `Invalid order lifecycle transition: Cannot transition from '${from}' to '${to}'`,
      );
    }
  }

  public static isAgentLifecycleTerminal(status: string): boolean {
    const s = String(status || '').trim().toLowerCase();
    return s === 'delivered' || s === 'approved' || s === 'refunded' || s === 'partially_approved';
  }

  public static mapToAgentLifecycleStatus(
    orderStatus: OrderStatus | string,
    paymentStatus?: string,
    refundStatus?: string,
  ): AgentOrderLifecycleStatus {
    const s = String(orderStatus || '').toUpperCase();
    const p = String(paymentStatus || '').toUpperCase();
    const r = String(refundStatus || '').toUpperCase();

    if (r === 'COMPLETED' || p === 'REFUNDED') {
      return 'refunded';
    }
    if (s === 'COMPLETED' || s === 'DELIVERED') {
      return 'delivered';
    }
    if (s === 'FAILED' || s === 'CANCELLED' || s === 'REJECTED') {
      return 'could_not_deliver';
    }
    if (s === 'PROCESSING') {
      return 'processing';
    }
    return 'received';
  }

  public static getWebhookEventsForLifecycle(
    status: AgentOrderLifecycleStatus,
    options?: { isAuto?: boolean },
  ): AgentWebhookEventType[] {
    switch (status) {
      case 'received':
        return ['order.received'];
      case 'processing':
        return ['order.processing'];
      case 'delivered':
      case 'approved':
        return options?.isAuto ? ['order.approved', 'purchase.success'] : ['order.approved'];
      case 'could_not_deliver':
      case 'rejected':
        return options?.isAuto ? ['order.rejected', 'purchase.failed'] : ['order.rejected'];
      case 'refunded':
        return ['wallet.updated'];
      case 'partially_approved':
        return ['order.partially_approved', 'wallet.updated'];
      default:
        return [];
    }
  }

  public static isTerminal(status: OrderStatus): boolean {
    return (
      status === OrderStatus.COMPLETED ||
      status === OrderStatus.FAILED ||
      status === OrderStatus.CANCELLED
    );
  }
}
