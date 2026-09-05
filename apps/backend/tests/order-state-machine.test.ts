import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from '../src/core/commerce/order-state-machine.js';
import { OrderStatus } from '@bytebeacon/shared';

describe('Order State Machine Transition Engine', () => {
  it('should allow valid transitions according to state graph', () => {
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.VALIDATING)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.READY_FOR_FULFILLMENT)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.CREATED, OrderStatus.CANCELLED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.VALIDATING, OrderStatus.READY_FOR_FULFILLMENT)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.VALIDATING, OrderStatus.FAILED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.READY_FOR_FULFILLMENT, OrderStatus.SUBMITTED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.READY_FOR_FULFILLMENT, OrderStatus.CANCELLED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.PROCESSING)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.FAILED)).toBe(true);

    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.FAILED)).toBe(true);
  });

  it('should strictly reject illegal transitions', () => {
    // COMPLETED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.PROCESSING)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.FAILED)).toBe(false);

    // FAILED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.FAILED, OrderStatus.SUBMITTED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.FAILED, OrderStatus.COMPLETED)).toBe(false);

    // CANCELLED is terminal
    expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.READY_FOR_FULFILLMENT)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.COMPLETED)).toBe(false);

    // Backward transitions
    expect(OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.canTransition(OrderStatus.SUBMITTED, OrderStatus.VALIDATING)).toBe(false);
  });

  it('should throw BadRequestError when validateTransition is called with illegal transition', () => {
    expect(() =>
      OrderStateMachine.validateTransition(OrderStatus.COMPLETED, OrderStatus.PROCESSING),
    ).toThrow("Invalid order status transition: Cannot transition from 'COMPLETED' to 'PROCESSING'");
  });

  it('should correctly identify terminal states', () => {
    expect(OrderStateMachine.isTerminal(OrderStatus.COMPLETED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.FAILED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.CANCELLED)).toBe(true);
    expect(OrderStateMachine.isTerminal(OrderStatus.CREATED)).toBe(false);
    expect(OrderStateMachine.isTerminal(OrderStatus.PROCESSING)).toBe(false);
  });

  describe('Agent Order Lifecycle Finite State Machine', () => {
    it('allows valid transitions along the happy path: received -> processing -> delivered / approved', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('received', 'processing')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'delivered')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'approved')).toBe(true);
    });

    it('allows valid transitions along the failure & refund path: received -> processing -> could_not_deliver -> refunded', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('received', 'could_not_deliver')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('received', 'rejected')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'could_not_deliver')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'rejected')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('could_not_deliver', 'refunded')).toBe(true);
      expect(OrderStateMachine.canTransitionAgentLifecycle('rejected', 'refunded')).toBe(true);
    });

    it('allows mixed batch transition to partially_approved', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('processing', 'partially_approved')).toBe(true);
    });

    it('strictly rejects illegal transitions from terminal states or invalid steps', () => {
      expect(OrderStateMachine.canTransitionAgentLifecycle('delivered', 'processing')).toBe(false);
      expect(OrderStateMachine.canTransitionAgentLifecycle('delivered', 'could_not_deliver')).toBe(false);
      expect(OrderStateMachine.canTransitionAgentLifecycle('approved', 'received')).toBe(false);
      expect(OrderStateMachine.canTransitionAgentLifecycle('refunded', 'processing')).toBe(false);
      expect(OrderStateMachine.canTransitionAgentLifecycle('refunded', 'delivered')).toBe(false);
      expect(OrderStateMachine.canTransitionAgentLifecycle('partially_approved', 'received')).toBe(false);
    });

    it('validates transitions and throws BadRequestError for illegal transitions', () => {
      expect(() =>
        OrderStateMachine.validateAgentLifecycleTransition('delivered', 'processing'),
      ).toThrow("Invalid order lifecycle transition: Cannot transition from 'delivered' to 'processing'");
    });

    it('correctly maps internal order and refund statuses to agent lifecycle status', () => {
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.READY_FOR_FULFILLMENT)).toBe('received');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.SUBMITTED)).toBe('received');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.PROCESSING)).toBe('processing');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.COMPLETED)).toBe('delivered');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.FAILED)).toBe('could_not_deliver');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.FAILED, 'PAID', 'COMPLETED')).toBe('refunded');
      expect(OrderStateMachine.mapToAgentLifecycleStatus(OrderStatus.COMPLETED, 'REFUNDED')).toBe('refunded');
    });

    it('maps lifecycle statuses to expected webhook events', () => {
      expect(OrderStateMachine.getWebhookEventsForLifecycle('received')).toContain('order.received');
      expect(OrderStateMachine.getWebhookEventsForLifecycle('processing')).toContain('order.processing');
      expect(OrderStateMachine.getWebhookEventsForLifecycle('delivered', { isAuto: true })).toEqual([
        'order.approved',
        'purchase.success',
      ]);
      expect(OrderStateMachine.getWebhookEventsForLifecycle('could_not_deliver', { isAuto: true })).toEqual([
        'order.rejected',
        'purchase.failed',
      ]);
      expect(OrderStateMachine.getWebhookEventsForLifecycle('refunded')).toContain('wallet.updated');
      expect(OrderStateMachine.getWebhookEventsForLifecycle('partially_approved')).toEqual([
        'order.partially_approved',
        'wallet.updated',
      ]);
    });
  });
});
