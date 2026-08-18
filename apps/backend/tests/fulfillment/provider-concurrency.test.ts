import { describe, it, expect, vi } from 'vitest';
import { FulfillmentWorker } from '../../src/core/providers/fulfillment-worker.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { CircuitBreaker } from '../../src/core/providers/circuit-breaker.js';
import { RetryPolicy } from '../../src/core/providers/retry-policy.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { PaymentStatus, OrderStatus, ProviderStatus, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Fulfillment Concurrency Invariant', () => {
  it('should handle 100 simultaneous workers on the same order producing EXACTLY ONE provider submission', async () => {
    let submissionCount = 0;

    const mockProvider = {
      providerName: 'GMPL',
      getOrderStatus: vi.fn().mockRejectedValue(new Error('Not found')),
      submitOrder: vi.fn().mockImplementation(() => {
        submissionCount++;
        return Promise.resolve({
          providerOrderId: 'gmpl_concurrent_123',
          providerReference: 'pst_sub_ord_conc_1',
          providerStatus: ProviderStatus.RECEIVED,
          acceptedAt: new Date().toISOString(),
        });
      }),
    } as unknown as ITelecomProvider;

    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('FROM orders o')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_conc_1',
                public_id: 'ord_pub_conc_1',
                user_id: 'usr_conc_1',
                recipient_phone: '0241234567',
                network: NetworkProvider.MTN,
                data_amount_mb: 1024,
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
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const cb = new CircuitBreaker({ failureThreshold: 5, cooldownPeriodMs: 30000, providerName: 'GMPL' });
    const retryPolicy = new RetryPolicy();
    const queueService = new FulfillmentQueueService(mockDb, null);

    const worker = new FulfillmentWorker(mockDb, mockProvider, cb, retryPolicy, queueService);

    // Launch 100 simultaneous worker calls on the same order
    const workerPromises = Array.from({ length: 100 }).map((_, i) =>
      worker.processOrderFulfillment('ord_conc_1', `corr_worker_${i}`, 1),
    );

    const results = await Promise.all(workerPromises);

    // EXACTLY 1 submission made to provider
    expect(submissionCount).toBe(1);
    expect(mockProvider.submitOrder).toHaveBeenCalledTimes(1);

    // Exactly 1 worker succeeded; 99 were locked out safely
    const successfulWorkers = results.filter((r) => r.success);
    const lockedWorkers = results.filter((r) => !r.success && r.error?.includes('locked'));

    expect(successfulWorkers).toHaveLength(1);
    expect(lockedWorkers).toHaveLength(99);
  });
});
