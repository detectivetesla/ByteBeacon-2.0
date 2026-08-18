import { describe, it, expect, vi } from 'vitest';
import { FulfillmentWorker } from '../../src/core/providers/fulfillment-worker.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { CircuitBreaker } from '../../src/core/providers/circuit-breaker.js';
import { RetryPolicy } from '../../src/core/providers/retry-policy.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { PaymentStatus, OrderStatus, ProviderStatus, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Reconciliation-Before-Retry Strategy & Order Invariants', () => {
  it('should query GMPL using deterministic reference before retrying to prevent duplicate fulfillment', async () => {
    const mockProvider = {
      providerName: 'GMPL',
      getOrderStatus: vi.fn().mockResolvedValue({
        providerOrderId: 'gmpl_ord_reconciled_99',
        providerReference: 'pst_sub_ord_retry_1',
        providerStatus: ProviderStatus.PROCESSING,
        completedAt: null,
      }),
      submitOrder: vi.fn(), // Should NOT be called!
    } as unknown as ITelecomProvider;

    let updatedOrderStatus: OrderStatus | null = null;
    let updatedProviderStatus: ProviderStatus | null = null;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_retry_1',
                public_id: 'ord_pub_retry_1',
                user_id: 'usr_1',
                recipient_phone: '0241234567',
                network: NetworkProvider.MTN,
                data_amount_mb: 2048,
                payment_status: PaymentStatus.PAID,
                order_status: OrderStatus.READY_FOR_FULFILLMENT,
                providerOrderId: null,
                providerName: 'GMPL',
                providerReference: 'pst_sub_ord_retry_1',
                providerStatus: ProviderStatus.UNKNOWN,
                submissionAttempts: 1,
              },
            ],
          });
        }
        if (q.includes('UPDATE orders')) {
          updatedOrderStatus = params[0] as OrderStatus;
          updatedProviderStatus = params[1] as ProviderStatus;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE provider_orders') || q.includes('INSERT INTO order_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const cb = new CircuitBreaker({ failureThreshold: 5, cooldownPeriodMs: 30000, providerName: 'GMPL' });
    const retryPolicy = new RetryPolicy();
    const queueService = new FulfillmentQueueService(mockDb, null);

    const worker = new FulfillmentWorker(mockDb, mockProvider, cb, retryPolicy, queueService);

    // Call worker with attempt = 2 (retry scenario)
    const result = await worker.processOrderFulfillment('ord_retry_1', 'corr_retry_1', 2);

    expect(result.success).toBe(true);
    expect(result.reconciledBeforeRetry).toBe(true);
    expect(mockProvider.getOrderStatus).toHaveBeenCalledTimes(1);
    expect(mockProvider.submitOrder).not.toHaveBeenCalled(); // Prevented duplicate provider creation!

    expect(updatedOrderStatus).toBe(OrderStatus.PROCESSING);
    expect(updatedProviderStatus).toBe(ProviderStatus.PROCESSING);
  });

  it('should mark order SUBMITTED (not COMPLETED) upon explicit provider acceptance', async () => {
    const mockProvider = {
      providerName: 'GMPL',
      getOrderStatus: vi.fn().mockRejectedValue(new Error('Not found')),
      submitOrder: vi.fn().mockResolvedValue({
        providerOrderId: 'gmpl_new_123',
        providerReference: 'pst_sub_ord_fresh_1',
        providerStatus: ProviderStatus.RECEIVED,
        acceptedAt: new Date().toISOString(),
      }),
    } as unknown as ITelecomProvider;

    let finalOrderStatus: OrderStatus | null = null;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_fresh_1',
                public_id: 'ord_pub_fresh_1',
                user_id: 'usr_1',
                recipient_phone: '0241234567',
                network: NetworkProvider.MTN,
                data_amount_mb: 2048,
                payment_status: PaymentStatus.PAID,
                order_status: OrderStatus.READY_FOR_FULFILLMENT,
                providerOrderId: null,
                providerName: 'GMPL',
                providerReference: null,
                providerStatus: ProviderStatus.UNKNOWN,
                submissionAttempts: 0,
              },
            ],
          });
        }
        if (q.includes('UPDATE orders')) {
          finalOrderStatus = params[0] as OrderStatus;
          return Promise.resolve({ rows: [] });
        }
        if (
          q.includes('UPDATE provider_orders') ||
          q.includes('INSERT INTO provider_submission_attempts') ||
          q.includes('INSERT INTO order_events')
        ) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const cb = new CircuitBreaker({ failureThreshold: 5, cooldownPeriodMs: 30000, providerName: 'GMPL' });
    const retryPolicy = new RetryPolicy();
    const queueService = new FulfillmentQueueService(mockDb, null);

    const worker = new FulfillmentWorker(mockDb, mockProvider, cb, retryPolicy, queueService);

    const result = await worker.processOrderFulfillment('ord_fresh_1', 'corr_fresh_1', 1);

    expect(result.success).toBe(true);
    expect(result.orderStatus).toBe(OrderStatus.SUBMITTED);
    expect(finalOrderStatus).toBe(OrderStatus.SUBMITTED);
    // CRITICAL INVARIANT: Never COMPLETED on submission!
    expect(finalOrderStatus).not.toBe(OrderStatus.COMPLETED);
  });
});
