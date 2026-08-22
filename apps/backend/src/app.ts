import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Redis } from 'ioredis';
import { Env, getConfig } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { errorHandler } from './core/errors/app-error.js';
import { healthRoutes } from './routes/health.routes.js';
import { getDatabasePool } from './infrastructure/database/pool.js';
import { getRedisClient } from './infrastructure/redis/client.js';
import { PasswordHasher } from './core/security/password-hasher.js';
import { TokenService } from './core/security/token.service.js';
import { SessionService } from './core/security/session.service.js';
import { ApiKeyService } from './core/security/api-key.service.js';
import { RbacService } from './core/security/rbac.service.js';
import { AuditService } from './core/security/audit.service.js';
import { RateLimiterService } from './core/security/rate-limiter.service.js';
import { customerAuthRoutes } from './routes/auth/customer-auth.routes.js';
import { adminAuthRoutes } from './routes/auth/admin-auth.routes.js';
import { developerApiKeyRoutes } from './routes/auth/developer-api-key.routes.js';
import { CatalogService } from './core/commerce/catalog.service.js';
import { IdempotencyService } from './core/commerce/idempotency.service.js';
import { OrderService } from './core/commerce/order.service.js';
import { BeneficiaryService } from './core/commerce/beneficiary.service.js';
import { BulkOrderService } from './core/commerce/bulk-order.service.js';
import { IPaymentProvider } from './core/payments/payment-provider.interface.js';
import { PaystackAdapter } from './core/payments/paystack.adapter.js';
import { MockPaymentProvider } from './providers/mocks/mock-payment.provider.js';
import { FinancialLedgerService } from './core/payments/financial-ledger.service.js';
import { PaymentService } from './core/payments/payment.service.js';
import { PaymentWebhookService } from './core/payments/payment-webhook.service.js';
import { RefundService } from './core/payments/refund.service.js';
import { ITelecomProvider } from './core/providers/telecom/telecom-provider.interface.js';
import { TelecomProviderRegistry } from './core/providers/telecom-provider.registry.js';
import { DataHouseClient } from './core/providers/datahouse/datahouse.client.js';
import { DataHouseAdapter } from './core/providers/datahouse/datahouse.adapter.js';
import { GmplClient } from './core/providers/gmpl/gmpl.client.js';
import { GmplAdapter } from './core/providers/gmpl/gmpl.adapter.js';
import { DataHouseWebhookService } from './core/providers/datahouse-webhook.service.js';
import { CircuitBreaker } from './core/providers/circuit-breaker.js';
import { RetryPolicy } from './core/providers/retry-policy.js';
import { FulfillmentQueueService } from './core/providers/fulfillment-queue.service.js';
import { FulfillmentWorker } from './core/providers/fulfillment-worker.js';
import { GmplWebhookService } from './core/providers/gmpl-webhook.service.js';
import { ProviderReconciliationService } from './core/providers/provider-reconciliation.service.js';
import { QueueManager } from './infrastructure/queues/queue.manager.js';
import { BulkQueueService } from './core/queues/bulk-queue.service.js';
import { ReconciliationQueueService } from './core/queues/reconciliation-queue.service.js';
import { catalogRoutes } from './routes/commerce/catalog.routes.js';
import { orderRoutes } from './routes/commerce/order.routes.js';
import { beneficiaryRoutes } from './routes/commerce/beneficiary.routes.js';
import { bulkOrderRoutes } from './routes/commerce/bulk-order.routes.js';
import { agentRoutes } from './routes/commerce/agent.routes.js';
import { storeRoutes } from './routes/commerce/store.routes.js';
import { adminOperationsRoutes } from './routes/commerce/admin-operations.routes.js';
import { adminOrdersRoutes } from './routes/commerce/admin-orders.routes.js';
import { adminApprovalsRoutes } from './routes/commerce/admin-approvals.routes.js';
import { adminCatalogRoutes } from './routes/commerce/admin-catalog.routes.js';
import { adminUsersRoutes } from './routes/commerce/admin-users.routes.js';
import { adminAgentsRoutes } from './routes/commerce/admin-agents.routes.js';
import { adminStoresRoutes } from './routes/commerce/admin-stores.routes.js';
import { adminAnalyticsRoutes } from './routes/commerce/admin-analytics.routes.js';
import { adminCommunicationsRoutes } from './routes/commerce/admin-communications.routes.js';
import { developerSandboxRoutes } from './routes/commerce/developer-sandbox.routes.js';
import { registerSwagger } from './plugins/swagger.plugin.js';
import { metricsPlugin } from './plugins/metrics.plugin.js';
import { paymentRoutes } from './routes/payments/payment.routes.js';
import { webhookRoutes } from './routes/payments/webhook.routes.js';
import { refundRoutes } from './routes/payments/refund.routes.js';
import { datahouseWebhookRoutes } from './routes/fulfillment/datahouse-webhook.routes.js';
import { gmplWebhookRoutes } from './routes/fulfillment/gmpl-webhook.routes.js';
import { integrationHealthRoutes } from './routes/health/integration-health.routes.js';

export interface AppOptions {
  config?: Env;
  dbPool?: pg.Pool;
  redisClient?: Redis | null;
  hasher?: PasswordHasher;
  tokenService?: TokenService;
  sessionService?: SessionService;
  apiKeyService?: ApiKeyService;
  rbacService?: RbacService;
  auditService?: AuditService;
  rateLimiter?: RateLimiterService;
  catalogService?: CatalogService;
  idempotencyService?: IdempotencyService;
  orderService?: OrderService;
  beneficiaryService?: BeneficiaryService;
  bulkOrderService?: BulkOrderService;
  paymentProvider?: IPaymentProvider;
  ledgerService?: FinancialLedgerService;
  paymentService?: PaymentService;
  webhookService?: PaymentWebhookService;
  refundService?: RefundService;
  telecomProvider?: ITelecomProvider;
  datahouseAdapter?: DataHouseAdapter;
  circuitBreaker?: CircuitBreaker;
  retryPolicy?: RetryPolicy;
  queueManager?: QueueManager;
  fulfillmentQueueService?: FulfillmentQueueService;
  fulfillmentWorker?: FulfillmentWorker;
  bulkQueueService?: BulkQueueService;
  reconciliationQueueService?: ReconciliationQueueService;
  datahouseWebhookService?: DataHouseWebhookService;
  gmplWebhookService?: GmplWebhookService;
  providerReconciliationService?: ProviderReconciliationService;
}

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? getConfig();

  const app = fastify({
    loggerInstance: logger,
    genReqId(req) {
      return (req.headers['x-request-id'] as string) || randomUUID();
    },
    bodyLimit: 1048576, // 1MB conservative default payload limit
    disableRequestLogging: false,
  });

  // 1. Security Headers (Helmet)
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // 2. Strict CORS Configuration
  app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (config.CORS_ORIGINS.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('CORS origin denied by ByteBeacon security policy'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-api-key', 'idempotency-key', 'x-gmpl-signature', 'x-telecom-signature', 'x-datahouse-signature', 'x-webhook-signature', 'x-correlation-id'],
    credentials: true,
  });

  // 3. Register Global Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Initialize Core & Security Services with test fallbacks
  let dbPool = options.dbPool;
  if (!dbPool) {
    try {
      dbPool = getDatabasePool();
    } catch {
      dbPool = {
        query: async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }),
        connect: async () => ({
          query: async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }),
          release: () => {},
        }),
        end: async () => {},
        on: () => dbPool,
      } as unknown as pg.Pool;
    }
  }

  let redisClient: Redis | null = null;
  try {
    redisClient = options.redisClient ?? getRedisClient();
  } catch {
    // Redis might be null in tests
  }

  const hasher = options.hasher ?? new PasswordHasher();
  const tokenService = options.tokenService ?? new TokenService(config.JWT_SECRET);
  const sessionService = options.sessionService ?? new SessionService(dbPool, redisClient);
  const apiKeyService = options.apiKeyService ?? new ApiKeyService(dbPool);
  const rbacService = options.rbacService ?? new RbacService(dbPool);
  const auditService = options.auditService ?? new AuditService(dbPool);
  const rateLimiter = options.rateLimiter ?? new RateLimiterService(redisClient);

  const catalogService = options.catalogService ?? new CatalogService(dbPool);
  const idempotencyService =
    options.idempotencyService ?? new IdempotencyService(dbPool, redisClient);
  const orderService =
    options.orderService ?? new OrderService(dbPool, catalogService, idempotencyService);

  const paymentProvider =
    options.paymentProvider ??
    (config.NODE_ENV !== 'production' && config.ALLOW_MOCK_PROVIDERS
      ? (new MockPaymentProvider() as unknown as IPaymentProvider)
      : new PaystackAdapter({ secretKey: config.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY || 'sk_test_paystack_secret_key' }));

  const ledgerService = options.ledgerService ?? new FinancialLedgerService(dbPool);
  const paymentService =
    options.paymentService ??
    new PaymentService(dbPool, paymentProvider, ledgerService, idempotencyService);
  const webhookService =
    options.webhookService ??
    new PaymentWebhookService(dbPool, redisClient, paymentProvider, paymentService);
  const refundService =
    options.refundService ??
    new RefundService(dbPool, paymentProvider, ledgerService, idempotencyService);

  // Phase 7.2 & 10.5: Dynamic Telecom Provider Registry (DataHouse + GMPL + Multi-carrier)
  const datahouseClient = new DataHouseClient({
    baseUrl: config.DATAHOUSE_BASE_URL || process.env.DATAHOUSE_BASE_URL || 'https://api.getmorepaylessdatahouse.net/api/v1',
    apiKey: config.DATAHOUSE_API_KEY || process.env.DATAHOUSE_API_KEY || 'dh_key',
    webhookSecret: config.DATAHOUSE_WEBHOOK_SECRET || process.env.DATAHOUSE_WEBHOOK_SECRET || 'dh_secret',
  });
  const datahouseAdapter = options.datahouseAdapter ?? new DataHouseAdapter(datahouseClient);

  const gmplClient = new GmplClient({
    apiKey: process.env.GMPL_API_KEY || 'gmpl_key',
    apiSecret: process.env.GMPL_API_SECRET || 'gmpl_secret',
    baseUrl: process.env.GMPL_BASE_URL || 'https://api.gmpl.local/v1',
  });
  const gmplAdapter = new GmplAdapter(gmplClient);

  const providerRegistry = new TelecomProviderRegistry();
  providerRegistry.registerProvider('DataHouse', datahouseAdapter, { isAuthoritative: true, priority: 1 });
  providerRegistry.registerProvider('GMPL', gmplAdapter, { isAuthoritative: false, priority: 2 });

  const telecomProvider: ITelecomProvider = options.telecomProvider ?? providerRegistry;

  const beneficiaryService = options.beneficiaryService ?? new BeneficiaryService(dbPool, telecomProvider);
  const bulkOrderService =
    options.bulkOrderService ?? new BulkOrderService(dbPool, catalogService);

  const circuitBreaker =
    options.circuitBreaker ??
    new CircuitBreaker({
      failureThreshold: 5,
      cooldownPeriodMs: 30000,
      providerName: telecomProvider.providerName,
    });

  const retryPolicy = options.retryPolicy ?? new RetryPolicy();
  const queueManager = options.queueManager ?? new QueueManager(redisClient);

  const fulfillmentQueueService =
    options.fulfillmentQueueService ?? new FulfillmentQueueService(dbPool, redisClient, queueManager);

  const fulfillmentWorker =
    options.fulfillmentWorker ??
    new FulfillmentWorker(
      dbPool,
      telecomProvider,
      circuitBreaker,
      retryPolicy,
      fulfillmentQueueService,
    );

  const providerReconciliationService =
    options.providerReconciliationService ??
    new ProviderReconciliationService(dbPool, telecomProvider);

  const bulkQueueService =
    options.bulkQueueService ??
    new BulkQueueService(dbPool, telecomProvider, queueManager);

  const reconciliationQueueService =
    options.reconciliationQueueService ??
    new ReconciliationQueueService(dbPool, providerReconciliationService, queueManager);

  // Attach distributed BullMQ workers if Redis is available
  if (queueManager.hasRedis()) {
    fulfillmentWorker.attachBullWorker(queueManager);
    bulkQueueService.attachBullWorker(queueManager);
    reconciliationQueueService.attachBullWorker(queueManager);
  }

  // Graceful shutdown: drain queues and stop workers on server close
  app.addHook('onClose', async () => {
    await queueManager.closeAll();
  });

  const datahouseWebhookService =
    options.datahouseWebhookService ??
    new DataHouseWebhookService(dbPool, redisClient, telecomProvider);

  const gmplWebhookService =
    options.gmplWebhookService ??
    new GmplWebhookService(dbPool, redisClient, telecomProvider);

  app.decorate('telecomProvider', telecomProvider);
  app.decorate('datahouseAdapter', datahouseAdapter);
  app.decorate('queueManager', queueManager);
  app.decorate('fulfillmentWorker', fulfillmentWorker);
  app.decorate('bulkQueueService', bulkQueueService);
  app.decorate('reconciliationQueueService', reconciliationQueueService);
  app.decorate('providerReconciliationService', providerReconciliationService);

  // 5. Register Swagger / OpenAPI Documentation & Prometheus Telemetry
  app.register(registerSwagger);
  app.register(metricsPlugin);

  // 6. Register Routes
  app.register(healthRoutes);
  app.register(async (healthSubApp: FastifyInstance) => {
    await integrationHealthRoutes(healthSubApp, {
      db: dbPool!,
      redis: redisClient,
      telecomProvider,
      paymentProvider,
    });
  });

  // Customer Auth Routes: /api/v1/auth
  app.register(
    async (authSubApp: FastifyInstance) => {
      await customerAuthRoutes(authSubApp, {
        db: dbPool!,
        hasher,
        tokenService,
        sessionService,
        auditService,
        rateLimiter,
        apiKeyService,
        rbacService,
      });
    },
    { prefix: '/api/v1/auth' },
  );

  // Admin Auth & Developer API Key Routes: /api/v1
  app.register(
    async (adminSubApp: FastifyInstance) => {
      await adminAuthRoutes(adminSubApp, {
        db: dbPool!,
        hasher,
        tokenService,
        sessionService,
        auditService,
        rateLimiter,
        apiKeyService,
        rbacService,
      });
      await developerApiKeyRoutes(adminSubApp, {
        db: dbPool!,
        apiKeyService,
        tokenService,
        rbacService,
        auditService,
      });
    },
    { prefix: '/api/v1' },
  );

  // Commerce, Payment & Fulfillment Routes: /api/v1
  app.register(
    async (commerceSubApp: FastifyInstance) => {
      await catalogRoutes(commerceSubApp, { catalogService });
      await orderRoutes(commerceSubApp, {
        db: dbPool!,
        orderService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await beneficiaryRoutes(commerceSubApp, {
        db: dbPool!,
        beneficiaryService,
        tokenService,
        apiKeyService,
        rbacService,
      });
      await bulkOrderRoutes(commerceSubApp, {
        db: dbPool!,
        bulkOrderService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await agentRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        ledgerService,
        paymentProvider,
      });
      await storeRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        paymentProvider,
      });
      await adminOperationsRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        fulfillmentQueueService,
        providerReconciliationService,
      });
      await adminOrdersRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        fulfillmentQueueService,
        providerReconciliationService,
        financialLedgerService: ledgerService,
      });
      await adminApprovalsRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        fulfillmentQueueService,
        beneficiaryService,
      });
      await adminCatalogRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        catalogService,
        telecomProvider,
      });
      await adminUsersRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        sessionService,
        ledgerService,
      });
      await adminAgentsRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        financialLedgerService: ledgerService,
        passwordHasher: hasher,
      });
      await adminStoresRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
        financialLedgerService: ledgerService,
      });
      await adminAnalyticsRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
      });
      await adminCommunicationsRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
      });
      await developerSandboxRoutes(commerceSubApp, {
        db: dbPool!,
        tokenService,
        apiKeyService,
        rbacService,
        auditService,
      });
      await paymentRoutes(commerceSubApp, {
        db: dbPool!,
        paymentService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await webhookRoutes(commerceSubApp, {
        webhookService,
      });
      await refundRoutes(commerceSubApp, {
        db: dbPool!,
        refundService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await datahouseWebhookRoutes(commerceSubApp, {
        webhookService: datahouseWebhookService,
      });
      await gmplWebhookRoutes(commerceSubApp, {
        webhookService: gmplWebhookService,
      });
    },
    { prefix: '/api/v1' },
  );

  // 6. 404 Handler
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  return app;
}
