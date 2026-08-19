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
}
