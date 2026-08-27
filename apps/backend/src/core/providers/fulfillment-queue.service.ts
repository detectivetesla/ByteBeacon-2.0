import crypto from 'node:crypto';
import type pg from 'pg';
import type { Redis } from 'ioredis';
import type { Queue, JobsOptions } from 'bullmq';
import { DlqEntryDto } from '@bytebeacon/shared';
import { FulfillmentJobData } from '../queues/queue.types.js';
import { QUEUE_NAMES, DEFAULT_RETRY_OPTIONS } from '../../infrastructure/queues/queue.config.js';
import { QueueManager } from '../../infrastructure/queues/queue.manager.js';
import { logger } from '../logging/logger.js';

export interface FulfillmentJob {
  jobId: string;
  orderId: string;
  attemptCount: number;
  correlationId: string;
  queuedAt: Date;
}

export class FulfillmentQueueService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly queueManager: QueueManager | null;
  private readonly bullQueue: Queue<FulfillmentJobData> | null = null;
  private readonly memoryLocks = new Set<string>();
  private readonly memoryQueue: FulfillmentJobData[] = [];

  constructor(
    db: pg.Pool,
    redis: Redis | null = null,
    queueManager: QueueManager | null = null,
  ) {
    this.db = db;
    this.redis = redis;
    this.queueManager = queueManager;

    if (this.queueManager && this.queueManager.hasRedis()) {
      this.bullQueue = this.queueManager.getQueue<FulfillmentJobData>(QUEUE_NAMES.FULFILLMENT);
    }
  }

  /**
   * Enqueues an order for asynchronous background fulfillment.
   * Uses BullMQ when Redis is available, or fallback in-memory queue for testing.
   */
  public async enqueueOrderFulfillment(
    jobData: FulfillmentJobData,
    options?: Partial<JobsOptions>,
  ): Promise<{ jobId: string; isEnqueued: boolean }> {
    const normalizedJobData: FulfillmentJobData = {
      ...jobData,
      idempotencyKey: jobData.idempotencyKey || `pst_job_${jobData.orderId}`,
      attemptCount: jobData.attemptCount || 1,
    };
    const jobId = `order_${normalizedJobData.orderId}`;

    if (this.bullQueue) {
      try {
        const job = await this.bullQueue.add('fulfill_order', normalizedJobData, {
          ...DEFAULT_RETRY_OPTIONS,
          jobId, // Unique per order to prevent duplicate enqueues
          ...options,
        });

        logger.info(
          { orderId: normalizedJobData.orderId, jobId: job.id, correlationId: normalizedJobData.correlationId },
          '[BullMQ] Order fulfillment job enqueued successfully',
        );

        return { jobId: job.id || jobId, isEnqueued: true };
      } catch (err: any) {
        logger.error(
          { orderId: normalizedJobData.orderId, err: err.message },
          '[BullMQ] Failed to add order to BullMQ queue, falling back to memory queue',
        );
      }
    }

    // In-Memory Fallback (useful for isolated unit tests without Redis)
    const exists = this.memoryQueue.some((j) => j.orderId === normalizedJobData.orderId);
    if (!exists) {
      this.memoryQueue.push(normalizedJobData);
    }

    return { jobId, isEnqueued: !exists };
  }

  /**
   * Retrieves pending items from the in-memory fallback queue (testing helper).
   */
  public getMemoryQueue(): FulfillmentJobData[] {
    return [...this.memoryQueue];
  }

  /**
   * Clears the in-memory fallback queue.
   */
  public clearMemoryQueue(): void {
    this.memoryQueue.length = 0;
  }

  /**
   * Acquires a concurrency lock for an order to prevent multiple workers racing on the same order.
   */
  public async acquireOrderLock(orderId: string, ttlSeconds = 60): Promise<boolean> {
    if (this.redis) {
      const lockKey = `lock:fulfillment:order:${orderId}`;
      const acquired = await this.redis.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
      return acquired === 'OK';
    }

    if (this.memoryLocks.has(orderId)) {
      return false;
    }
    this.memoryLocks.add(orderId);
    return true;
  }

  /**
   * Releases the order concurrency lock.
   */
  public async releaseOrderLock(orderId: string): Promise<void> {
    if (this.redis) {
      const lockKey = `lock:fulfillment:order:${orderId}`;
      await this.redis.del(lockKey);
      return;
    }
    this.memoryLocks.delete(orderId);
  }

  /**
   * Routes an unrecoverable or exhausted fulfillment failure into the Dead Letter Queue.
   */
  public async routeToDlq(params: {
    orderId: string;
    provider: string;
    jobId: string;
    attemptCount: number;
    errorCode: string;
    errorMessage: string;
    requestReference: string;
    correlationId: string;
    failureClass: 'RETRYABLE_EXHAUSTED' | 'PERMANENT_REJECTION' | 'MALFORMED_REQUEST';
  }): Promise<DlqEntryDto> {
    const res = await this.db.query(
      `INSERT INTO provider_dlq (
          order_id, provider, job_id, attempt_count, error_code,
          error_message, request_reference, correlation_id, failure_class, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_REVIEW')
       RETURNING id, order_id as "orderId", provider, job_id as "jobId",
                 attempt_count as "attemptCount", error_code as "errorCode",
                 error_message as "errorMessage", request_reference as "requestReference",
                 correlation_id as "correlationId", first_failed_at as "firstFailedAt",
                 last_failed_at as "lastFailedAt", failure_class as "failureClass",
                 status`,
      [
        params.orderId,
        params.provider,
        params.jobId || crypto.randomUUID(),
        params.attemptCount,
        params.errorCode,
        params.errorMessage,
        params.requestReference,
        params.correlationId,
        params.failureClass,
      ],
    );

    const row = res.rows[0];

    logger.error(
      {
        dlqId: row.id,
        orderId: params.orderId,
        failureClass: params.failureClass,
        errorCode: params.errorCode,
      },
      'Order routed to provider Dead-Letter Queue (DLQ)',
    );

    return {
      ...row,
      firstFailedAt: new Date(row.firstFailedAt).toISOString(),
      lastFailedAt: new Date(row.lastFailedAt).toISOString(),
    };
  }

  /**
   * Retrieves pending DLQ entries for administrator review and manual replay.
   */
  public async getDlqEntries(limit = 50): Promise<DlqEntryDto[]> {
    const res = await this.db.query(
      `SELECT id, order_id as "orderId", provider, job_id as "jobId",
              attempt_count as "attemptCount", error_code as "errorCode",
              error_message as "errorMessage", request_reference as "requestReference",
              correlation_id as "correlationId", first_failed_at as "firstFailedAt",
              last_failed_at as "lastFailedAt", failure_class as "failureClass",
              status
       FROM provider_dlq
       WHERE status = 'PENDING_REVIEW'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return res.rows.map((r) => ({
      ...r,
      firstFailedAt: new Date(r.firstFailedAt).toISOString(),
      lastFailedAt: new Date(r.lastFailedAt).toISOString(),
    }));
  }
}
