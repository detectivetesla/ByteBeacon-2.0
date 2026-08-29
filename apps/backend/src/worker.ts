import { createOptimizedDatabasePool } from './infrastructure/database/connection-pool.config.js';
import { QueueManager } from './infrastructure/queues/queue.manager.js';
import { QUEUE_NAMES } from './infrastructure/queues/queue.config.js';
import { DataHouseClient } from './core/providers/datahouse/datahouse.client.js';
import { DataHouseAdapter } from './core/providers/datahouse/datahouse.adapter.js';
import { GmplClient } from './core/providers/gmpl/gmpl.client.js';
import { GmplAdapter } from './core/providers/gmpl/gmpl.adapter.js';
import { DynamicHttpTelecomAdapter } from './core/providers/dynamic-http/dynamic-http.adapter.js';
import { SupabaseVaultCredentialStore } from './core/providers/credentials/supabase-vault-credential-store.js';
import { NetworkProvider } from '@bytebeacon/shared';
import { TelecomProviderRegistry } from './core/providers/telecom-provider.registry.js';
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

  // Initialize telecom provider registry & resilient executor
  const dhClient = new DataHouseClient({
    baseUrl: process.env.DATAHOUSE_BASE_URL || 'https://api.getmorepaylessdatahouse.net/api/v1',
    apiKey: process.env.DATAHOUSE_API_KEY || 'dh_key',
    timeoutMs: 15000,
  });
  const datahouseAdapter = new DataHouseAdapter(dhClient);

  const gmplClient = new GmplClient({
    apiKey: process.env.GMPL_API_KEY || 'gmpl_key',
    apiSecret: process.env.GMPL_API_SECRET || 'gmpl_secret',
    baseUrl: process.env.GMPL_BASE_URL || 'https://api.gmpl.local/v1',
  });
  const gmplAdapter = new GmplAdapter(gmplClient);
  const portal02ApiKey = process.env.PORTAL02_API_KEY || 'dk_iGoTZ6KA8-GDrvemBECywzhisNhOpttr';
  const portal02BaseUrl = process.env.PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
  const portal02Adapter = new DynamicHttpTelecomAdapter({
    providerName: 'Portal-02',
    providerSlug: 'portal-02',
    apiBaseUrl: portal02BaseUrl,
    authMethod: 'API_KEY',
    apiKey: portal02ApiKey,
    supportedNetworks: [NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO],
  });

  const envAuthoritativeProvider = (process.env.AUTHORITATIVE_PROVIDER || '').trim();

  const providerRegistry = new TelecomProviderRegistry();
  providerRegistry.registerProvider('DataHouse', datahouseAdapter, {
    isAuthoritative: envAuthoritativeProvider.toLowerCase() === 'datahouse' || (!envAuthoritativeProvider),
    priority: envAuthoritativeProvider.toLowerCase().includes('portal') ? 2 : 1,
  });
  providerRegistry.registerProvider('GMPL', gmplAdapter, { isAuthoritative: false, priority: 3 });
  providerRegistry.registerProvider('Portal-02', portal02Adapter, {
    isAuthoritative: envAuthoritativeProvider.toLowerCase().includes('portal'),
    priority: envAuthoritativeProvider.toLowerCase().includes('portal') ? 1 : 3,
  });

  const workerCredentialStore = new SupabaseVaultCredentialStore(db);
  await providerRegistry.loadProvidersFromDatabase(db, workerCredentialStore).catch((err) => {
    logger.warn({ err }, '[WORKER_PROCESS] Failed to load dynamic telecom providers from database on boot');
  });

  // After DB load, re-assert env var override
  if (envAuthoritativeProvider) {
    providerRegistry.setActiveProvider(envAuthoritativeProvider);
    const fallback = envAuthoritativeProvider.toLowerCase().includes('portal') ? 'DataHouse' : 'Portal-02';
    providerRegistry.setNetworkRouting('MTN', envAuthoritativeProvider, fallback);
    providerRegistry.setNetworkRouting('TELECEL', envAuthoritativeProvider, fallback);
    providerRegistry.setNetworkRouting('AIRTELTIGO', envAuthoritativeProvider, fallback);
    logger.info({ provider: envAuthoritativeProvider }, '[WORKER_PROCESS] Authoritative provider set from env var (post-DB load)');
  }

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    cooldownPeriodMs: 30000,
    providerName: providerRegistry.providerName,
  });
  const retryPolicy = new RetryPolicy();

  const fulfillmentQueue = new FulfillmentQueueService(db, redisClient, queueManager);
  const fulfillmentWorker = new FulfillmentWorker(
    db,
    providerRegistry,
    circuitBreaker,
    retryPolicy,
    fulfillmentQueue,
  );

  const reconService = new ProviderReconciliationService(db, providerRegistry);

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
    return reconService.reconcileStaleOrders(new Date().toISOString(), 1);
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
