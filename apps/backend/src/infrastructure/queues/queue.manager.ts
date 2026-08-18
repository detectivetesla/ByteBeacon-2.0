import { Queue, Worker, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { QueueName, DEFAULT_QUEUE_OPTIONS, DEFAULT_WORKER_OPTIONS } from './queue.config.js';
import { logger } from '../../core/logging/logger.js';

export interface QueueHealthStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}

export class QueueManager {
  private readonly redisClient: Redis | null;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private isShuttingDown = false;

  constructor(redisClient: Redis | null = null) {
    this.redisClient = redisClient;
  }

  /**
   * Returns true if a live Redis connection is available for BullMQ.
   */
  public hasRedis(): boolean {
    return this.redisClient !== null && this.redisClient.status === 'ready';
  }

  /**
   * Retrieves or creates a BullMQ Queue instance.
   */
  public getQueue<T = any, R = any>(name: QueueName, options: Partial<QueueOptions> = {}): Queue<T, R> | null {
    if (!this.redisClient) {
      return null;
    }

    if (this.queues.has(name)) {
      return this.queues.get(name) as Queue<T, R>;
    }

    const queue = new Queue<T, R>(name, {
      ...DEFAULT_QUEUE_OPTIONS,
      ...options,
      connection: this.redisClient as any,
    });

    this.queues.set(name, queue);
    logger.info({ queueName: name }, `[BullMQ] Initialized queue ${name}`);
    return queue;
  }

  /**
   * Registers a worker processor on a specified queue.
   */
  public registerWorker<T = any, R = any>(
    name: QueueName,
    processor: Processor<T, R>,
    options: Partial<WorkerOptions> = {},
  ): Worker<T, R> | null {
    if (!this.redisClient) {
      return null;
    }

    if (this.workers.has(name)) {
      return this.workers.get(name) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(name, processor, {
      ...DEFAULT_WORKER_OPTIONS,
      ...options,
      connection: this.redisClient as any,
    });

    worker.on('completed', (job) => {
      logger.info({ queueName: name, jobId: job.id }, `[BullMQ] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      logger.error(
        { queueName: name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message },
        `[BullMQ] Job ${job?.id} failed: ${err.message}`,
      );
    });

    worker.on('error', (err) => {
      logger.error({ queueName: name, err: err.message }, `[BullMQ] Worker encountered error`);
    });

    this.workers.set(name, worker);
    logger.info({ queueName: name }, `[BullMQ] Registered worker for ${name}`);
    return worker;
  }

  /**
   * Collects granular health and job counts across all registered queues.
   */
  public async getHealthStats(): Promise<QueueHealthStats[]> {
    const stats: QueueHealthStats[] = [];

    for (const [name, queue] of this.queues.entries()) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        const isPaused = await queue.isPaused();
        stats.push({
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          isPaused,
        });
      } catch (err: any) {
        stats.push({
          name,
          waiting: -1,
          active: -1,
          completed: -1,
          failed: -1,
          delayed: -1,
          isPaused: false,
        });
      }
    }

    return stats;
  }

  /**
   * Gracefully shuts down all workers and queue connections.
   */
  public async closeAll(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('[BullMQ] Closing all workers and queues gracefully...');

    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
        logger.info({ workerName: name }, `[BullMQ] Closed worker ${name}`);
      } catch (err) {
        logger.error({ workerName: name, err }, `[BullMQ] Error closing worker ${name}`);
      }
    }
    this.workers.clear();

    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        logger.info({ queueName: name }, `[BullMQ] Closed queue ${name}`);
      } catch (err) {
        logger.error({ queueName: name, err }, `[BullMQ] Error closing queue ${name}`);
      }
    }
    this.queues.clear();
  }
}
