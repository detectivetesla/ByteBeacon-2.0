import { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../infrastructure/database/pool.js';
import { checkRedisHealth } from '../infrastructure/redis/client.js';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * Root Server Metadata
   * GET /
   */
  fastify.get('/', async (_request, reply) => {
    return reply.status(200).send({
      name: 'ByteBeacon 2.0 API Server',
      status: 'online',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'production',
      endpoints: {
        health: '/healthz',
        ready: '/readyz',
        integrations: '/health/integrations',
        docs: '/docs',
        apiBase: '/api/v1',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Liveness Probe
   * GET /healthz
   * Returns immediately if process is alive. No external dependency checks.
   */
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Readiness Probe
   * GET /readyz
   * Checks database pool and Redis connection.
   */
  fastify.get('/readyz', async (_request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();

    const isReady = dbHealthy && redisHealthy;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? 'ok' : 'error',
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        redis: redisHealthy ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Platform Operational & Maintenance Status Probe
   * GET /platform/status & GET /health/status
   */
  const handlePlatformStatus = async (_request: any, reply: any) => {
    let isMaintenance = false;
    let isOrderProcessingPaused = false;
    const flagService = (fastify as any).featureFlagService;
    if (flagService) {
      try {
        isMaintenance = await flagService.isMaintenanceModeActive();
      } catch {
        isMaintenance = false;
      }
      try {
        isOrderProcessingPaused = await flagService.isOrderProcessingPaused();
      } catch {
        isOrderProcessingPaused = false;
      }
    }

    let defaultMsg = 'All systems operational.';
    if (isMaintenance) {
      defaultMsg = 'Scheduled Maintenance in Progress: Telecom fulfillment and checkout are temporarily paused. You can still browse bundles, track past orders, and access your account.';
    } else if (isOrderProcessingPaused) {
      defaultMsg = 'Order Processing Paused: Customer and agent order checkouts and Excel bulk uploads are temporarily paused by administration. You can still browse and access your account.';
    }

    return reply.status(200).send({
      success: true,
      data: {
        isMaintenanceMode: isMaintenance,
        isOrderProcessingPaused,
        platformStatus: isMaintenance ? 'MAINTENANCE' : 'OPERATIONAL',
        environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT / STAGING',
        message: defaultMsg,
        orderProcessingMessage: isOrderProcessingPaused
          ? 'Order processing, checkout, and bulk Excel uploads are temporarily paused by administration.'
          : undefined,
        timestamp: new Date().toISOString(),
      },
    });
  };

  fastify.get('/platform/status', handlePlatformStatus);
  fastify.get('/health/status', handlePlatformStatus);
  fastify.get('/api/v1/platform/status', handlePlatformStatus);
}


