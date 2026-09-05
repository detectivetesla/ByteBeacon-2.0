import { describe, it, expect, vi } from 'vitest';
import { FulfillmentWorker } from '../../src/core/providers/fulfillment-worker.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { CircuitBreaker } from '../../src/core/providers/circuit-breaker.js';
import { RetryPolicy } from '../../src/core/providers/retry-policy.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { AgentWebhookDispatcherService } from '../../src/core/webhooks/agent-webhook-dispatcher.service.js';
import { PaymentStatus, OrderStatus, ProviderStatus, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Order Lifecycle Webhook Dispatching', () => {
  it('dispatches order.processing, order.approved, and purchase.success on fulfillment success', async () => {
    const mockProvider = {
      providerName: 'DataHouse',
      submitOrder: vi.fn().mockResolvedValue({
        success: true,
        providerReference: 'TXN-ABC1234',
        providerStatus: ProviderStatus.COMPLETED,
      }),
      getOrderStatus: vi.fn(),
    } as unknown as ITelecomProvider;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_123',
                public_id: 'ord_pub_123',
                user_id: 'usr_agent_1',
                agent_id: 'agent_uuid_1',
                recipient_phone: '0241234567',
                network: NetworkProvider.MTN,
                data_amount_mb: 2048,
                payment_status: PaymentStatus.PAID,
                order_status: OrderStatus.READY_FOR_FULFILLMENT,
                providerOrderId: null,
                providerName: 'DataHouse',
                providerReference: null,
                providerStatus: ProviderStatus.UNKNOWN,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const mockDispatcher = {
      dispatchAgentEvent: vi.fn().mockResolvedValue([]),
    } as unknown as AgentWebhookDispatcherService;

    const cb = new CircuitBreaker({ failureThreshold: 5, cooldownPeriodMs: 30000, providerName: 'DataHouse' });
    const retryPolicy = new RetryPolicy();
    const queueService = new FulfillmentQueueService(mockDb, null);

    const worker = new FulfillmentWorker(mockDb, mockProvider, cb, retryPolicy, queueService, mockDispatcher);

    const result = await worker.processOrderFulfillment('ord_123', 'corr_test_1');

    expect(result.success).toBe(true);
    expect(result.orderStatus).toBe(OrderStatus.COMPLETED);

    // 1. Should have dispatched order.processing
    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_1',
      'order.processing',
      expect.objectContaining({
        order_id: 'ord_123',
        public_id: 'ord_pub_123',
        status: 'processing',
      }),
    );

    // 2. Should have dispatched order.approved and purchase.success
    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_1',
      'order.approved',
      expect.objectContaining({
        order_id: 'ord_123',
        public_id: 'ord_pub_123',
        reference: 'TXN-ABC1234',
        status: 'approved',
      }),
    );

    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_1',
      'purchase.success',
      expect.objectContaining({
        order_id: 'ord_123',
        public_id: 'ord_pub_123',
        reference: 'TXN-ABC1234',
        status: 'approved',
      }),
    );
  });

  it('dispatches order.rejected, purchase.failed, and wallet.updated on fulfillment failure & refund', async () => {
    const mockProvider = {
      providerName: 'DataHouse',
      submitOrder: vi.fn().mockResolvedValue({
        success: false,
        providerReference: 'TXN-FAIL999',
        providerStatus: ProviderStatus.FAILED,
      }),
      getOrderStatus: vi.fn(),
    } as unknown as ITelecomProvider;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_fail_1',
                public_id: 'ord_pub_fail_1',
                user_id: 'usr_agent_2',
                agent_id: 'agent_uuid_2',
                recipient_phone: '0241234567',
                network: NetworkProvider.MTN,
                data_amount_mb: 2048,
                payment_status: PaymentStatus.PAID,
                order_status: OrderStatus.READY_FOR_FULFILLMENT,
                amount_pesewas: 500,
              },
            ],
          });
        }
        if (q.includes('SELECT id, user_id, agent_id, amount_pesewas')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_fail_1',
                user_id: 'usr_agent_2',
                agent_id: 'agent_uuid_2',
                amount_pesewas: 500,
                payment_status: PaymentStatus.PAID,
                refund_status: 'NONE',
              },
            ],
          });
        }
        if (q.includes('SELECT wallet_balance_pesewas, wallet_balance FROM users')) {
          return Promise.resolve({
            rows: [{ wallet_balance_pesewas: 1000, wallet_balance: '10.00' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const mockDispatcher = {
      dispatchAgentEvent: vi.fn().mockResolvedValue([]),
    } as unknown as AgentWebhookDispatcherService;

    const cb = new CircuitBreaker({ failureThreshold: 5, cooldownPeriodMs: 30000, providerName: 'DataHouse' });
    const retryPolicy = new RetryPolicy();
    const queueService = new FulfillmentQueueService(mockDb, null);

    const worker = new FulfillmentWorker(mockDb, mockProvider, cb, retryPolicy, queueService, mockDispatcher);

    const result = await worker.processOrderFulfillment('ord_fail_1', 'corr_fail_1');

    expect(result.success).toBe(false);
    expect(result.orderStatus).toBe(OrderStatus.FAILED);

    // 1. Should have dispatched order.rejected and purchase.failed
    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_2',
      'order.rejected',
      expect.objectContaining({
        order_id: 'ord_fail_1',
        public_id: 'ord_pub_fail_1',
        status: 'rejected',
      }),
    );

    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_2',
      'purchase.failed',
      expect.objectContaining({
        order_id: 'ord_fail_1',
        public_id: 'ord_pub_fail_1',
        status: 'rejected',
      }),
    );

    // 2. Should have dispatched wallet.updated with refund details
    expect(mockDispatcher.dispatchAgentEvent).toHaveBeenCalledWith(
      'agent_uuid_2',
      'wallet.updated',
      expect.objectContaining({
        wallet_id: 'usr_agent_2',
        direction: 'credit',
        amount: '5.00',
        currency: 'GHS',
        balance_after: '10.00',
      }),
    );
  });
});
