import { describe, it, expect, vi } from 'vitest';
import { RetryPolicy } from '../../src/core/providers/retry-policy.js';
import { FulfillmentQueueService } from '../../src/core/providers/fulfillment-queue.service.js';
import { GmplNetworkError, GmplRejectionError, GmplTimeoutError } from '../../src/core/providers/gmpl/gmpl.errors.js';
import type pg from 'pg';

describe('Retry Policy and Dead-Letter Queue (DLQ)', () => {
  it('should correctly classify retryable vs non-retryable errors', () => {
    const policy = new RetryPolicy();

    // Retryable errors
    expect(policy.isRetryable(new GmplTimeoutError())).toBe(true);
    expect(policy.isRetryable(new GmplNetworkError())).toBe(true);
    expect(policy.isRetryable(new Error('Connection reset by peer ECONNRESET'))).toBe(true);
    expect(policy.isRetryable(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    expect(policy.isRetryable(new Error('Gateway 504 Gateway Timeout'))).toBe(true);

    // Non-retryable errors
    expect(policy.isRetryable(new GmplRejectionError('Invalid phone number'))).toBe(false);
    expect(policy.isRetryable(new Error('Invalid token'))).toBe(false);
    expect(policy.isRetryable(new Error('Validation error: recipient format'))).toBe(false);
  });

  it('should compute exponential backoff with jitter within bounded range', () => {
    const policy = new RetryPolicy({ maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 16000 });

    const delay1 = policy.computeBackoffDelay(1); // ~1000ms + jitter
    const delay2 = policy.computeBackoffDelay(2); // ~2000ms + jitter
    const delay3 = policy.computeBackoffDelay(3); // ~4000ms + jitter

    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThanOrEqual(1300);

    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(2600);

    expect(delay3).toBeGreaterThanOrEqual(4000);
    expect(delay3).toBeLessThanOrEqual(5200);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('should route exhausted attempts and permanent rejections to provider_dlq', async () => {
    let capturedInsert: any = null;
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('INSERT INTO provider_dlq')) {
          capturedInsert = params;
          return Promise.resolve({
            rows: [
              {
                id: 'dlq_123',
                orderId: params[0],
                provider: params[1],
                jobId: params[2],
                attemptCount: params[3],
                errorCode: params[4],
                errorMessage: params[5],
                requestReference: params[6],
                correlationId: params[7],
                failureClass: params[8],
                status: 'PENDING_REVIEW',
                firstFailedAt: new Date(),
                lastFailedAt: new Date(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const queueService = new FulfillmentQueueService(mockDb, null);

    const dlqEntry = await queueService.routeToDlq({
      orderId: 'ord_dead_1',
      provider: 'GMPL',
      jobId: 'job_dead_1',
      attemptCount: 5,
      errorCode: 'MAX_RETRIES_EXCEEDED',
      errorMessage: 'Network timeout after 5 attempts',
      requestReference: 'pst_sub_ord_dead_1',
      correlationId: 'req_dead_1',
      failureClass: 'RETRYABLE_EXHAUSTED',
    });

    expect(dlqEntry.id).toBe('dlq_123');
    expect(dlqEntry.failureClass).toBe('RETRYABLE_EXHAUSTED');
    expect(capturedInsert[0]).toBe('ord_dead_1');
    expect(capturedInsert[1]).toBe('GMPL');
  });
});
