import { createOptimizedDatabasePool } from './infrastructure/database/connection-pool.config.js';
import { QueueManager } from './infrastructure/queues/queue.manager.js';
import { QUEUE_NAMES } from './infrastructure/queues/queue.config.js';
import { DataHouseClient } from './core/providers/datahouse/datahouse.client.js';
import { DataHouseAdapter } from './core/providers/datahouse/datahouse.adapter.js';
import { CircuitBreaker } from './core/providers/circuit-breaker.js';
import { RetryPolicy } from './core/providers/retry-policy.js';
import { FulfillmentQueueService } from './core/providers/fulfillment-queue.service.js';
import { FulfillmentWorker } from './core/providers/fulfillment-worker.js';
import { ProviderReconciliationService } from './core/providers/provider-reconciliation.service.js';
import { Redis } from 'ioredis';
import { logger } from './core/logging/logger.js';

/**
 * Dedicated Background Worker Process for ByteBeacon 2.0.
 * Runs standalone containerized BullMQ background workers independently of the HTTP Fastify API.
 */
export async function startWorkerProcess(): Promise<void> {
  logger.info('[WORKER_PROCESS] Starting ByteBeacon 2.0 Standalone Background Worker...');

  const db = createOptimizedDatabasePool();

  // Initialize Redis for BullMQ distributed workers
  let redisClient: Redis | null = null;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      logger.info('[WORKER_PROCESS] Connected to Redis for BullMQ queues');
    } catch (err) {
      logger.warn({ err }, '[WORKER_PROCESS] Redis unavailable; worker running in fallback mode');
    }
  }

  const queueManager = new QueueManager(redisClient);

  // Initialize telecom adapter & resilient executor
  const dhClient = new DataHouseClient({
    baseUrl: process.env.DATAHOUSE_BASE_URL || 'https://sandbox.getmorepaylessdatahouse.net/api/v1',
    apiKey: process.env.DATAHOUSE_API_KEY || 'dh_sandbox_key',
    timeoutMs: 15000,
  });
  const datahouseAdapter = new DataHouseAdapter(dhClient);

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownPeriodMs: 30000,
    providerName: 'DATAHOUSE',
  });
  const retryPolicy = new RetryPolicy();

  const fulfillmentQueue = new FulfillmentQueueService(db, redisClient, queueManager);
  const fulfillmentWorker = new FulfillmentWorker(
    db,
    datahouseAdapter,
    circuitBreaker,
    retryPolicy,
    fulfillmentQueue,
  );

  const reconService = new ProviderReconciliationService(db, datahouseAdapter);

  // 1. Register Fulfillment Worker on BullMQ
  queueManager.registerWorker(QUEUE_NAMES.FULFILLMENT, async (job) => {
    logger.info({ jobId: job.id, data: job.data }, '[WORKER_PROCESS] Processing fulfillment job');
    return fulfillmentWorker.processOrderFulfillment(
      job.data.orderId,
      job.data.correlationId,
      job.attemptsMade + 1,
    );
  });

  // 2. Register Reconciliation Worker on BullMQ
  queueManager.registerWorker(QUEUE_NAMES.RECONCILIATION, async (job) => {
    logger.info({ jobId: job.id }, '[WORKER_PROCESS] Executing scheduled provider reconciliation audit');
    return reconService.reconcileStaleOrders(new Date().toISOString(), 300);
  });

  logger.info('[WORKER_PROCESS] All background workers successfully registered and listening for jobs.');

  // Graceful Shutdown Handlers
  async function gracefulShutdown(signal: string) {
    logger.info({ signal }, '[WORKER_PROCESS] Received termination signal; shutting down gracefully...');
    try {
      await queueManager.closeAll();
      await db.end();
      if (redisClient) {
        await redisClient.quit();
      }
      logger.info('[WORKER_PROCESS] Graceful shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, '[WORKER_PROCESS] Error during graceful shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorkerProcess().catch((err) => {
    logger.fatal({ err }, '[WORKER_PROCESS] Fatal unhandled error during worker startup');
    process.exit(1);
  });
}
