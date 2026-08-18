import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('FulfillmentQueueService and Concurrency Locks', () => {
  let mockDb: pg.Pool;
  let queueService: FulfillmentQueueService;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as pg.Pool;

    queueService = new FulfillmentQueueService(mockDb, null, null);
  });

  describe('In-Memory Fallback Queueing & Deduplication', () => {
    it('should enqueue an order fulfillment job into memory fallback', async () => {
      const res = await queueService.enqueueOrderFulfillment({
        orderId: 'ord_123',
        correlationId: 'req_123',
        network: NetworkProvider.MTN,
        phoneNumber: '0241234567',
        idempotencyKey: 'idemp_123',
        attemptCount: 1,
      });

      expect(res.jobId).toBe('order_ord_123');
      expect(res.isEnqueued).toBe(true);

      const items = queueService.getMemoryQueue();
      expect(items).toHaveLength(1);
      expect(items[0].orderId).toBe('ord_123');
    });

    it('should reject duplicate orderId enqueue in fallback queue', async () => {
      await queueService.enqueueOrderFulfillment({
        orderId: 'ord_123',
        correlationId: 'req_123',
        network: NetworkProvider.MTN,
        phoneNumber: '0241234567',
        idempotencyKey: 'idemp_123',
        attemptCount: 1,
      });

      const res2 = await queueService.enqueueOrderFulfillment({
        orderId: 'ord_123',
        correlationId: 'req_123_duplicate',
        network: NetworkProvider.MTN,
        phoneNumber: '0241234567',
        idempotencyKey: 'idemp_123',
        attemptCount: 1,
      });

      expect(res2.isEnqueued).toBe(false);
      expect(queueService.getMemoryQueue()).toHaveLength(1);
    });
  });

  describe('Concurrency Lock Guarantees', () => {
    it('should acquire lock and prevent second concurrent acquisition', async () => {
      const first = await queueService.acquireOrderLock('ord_lock_test');
      expect(first).toBe(true);

      const second = await queueService.acquireOrderLock('ord_lock_test');
      expect(second).toBe(false);

      await queueService.releaseOrderLock('ord_lock_test');

      const third = await queueService.acquireOrderLock('ord_lock_test');
      expect(third).toBe(true);
    });
  });

  describe('Dead-Letter Queue (DLQ) Routing', () => {
    it('should route exhausted fulfillment failure to PostgreSQL provider_dlq', async () => {
      const now = new Date();
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'dlq_uuid_1',
            orderId: 'ord_fail_999',
            provider: 'DATAHOUSE',
            jobId: 'job_123',
            attemptCount: 5,
            errorCode: 'CARRIER_TIMEOUT',
            errorMessage: 'Upstream DataHouse timeout after 5 attempts',
            requestReference: 'TXN-REF-999',
            correlationId: 'req_999',
            firstFailedAt: now,
            lastFailedAt: now,
            failureClass: 'RETRYABLE_EXHAUSTED',
            status: 'PENDING_REVIEW',
          },
        ],
      });

      const dlqEntry = await queueService.routeToDlq({
        orderId: 'ord_fail_999',
        provider: 'DATAHOUSE',
        jobId: 'job_123',
        attemptCount: 5,
        errorCode: 'CARRIER_TIMEOUT',
        errorMessage: 'Upstream DataHouse timeout after 5 attempts',
        requestReference: 'TXN-REF-999',
        correlationId: 'req_999',
        failureClass: 'RETRYABLE_EXHAUSTED',
      });

      expect(dlqEntry.id).toBe('dlq_uuid_1');
      expect(dlqEntry.failureClass).toBe('RETRYABLE_EXHAUSTED');
      expect(dlqEntry.status).toBe('PENDING_REVIEW');
    });
  });
});
