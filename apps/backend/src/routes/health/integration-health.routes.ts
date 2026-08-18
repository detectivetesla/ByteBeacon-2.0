import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import type { Redis } from 'ioredis';
import { ITelecomProvider } from '../../core/providers/telecom/telecom-provider.interface.js';
import { IPaymentProvider } from '../../core/payments/payment-provider.interface.js';
import { IntegrationHealthReport } from '@bytebeacon/shared';

export async function integrationHealthRoutes(
  app: FastifyInstance,
  deps: {
    db: pg.Pool;
    redis: Redis | null;
    telecomProvider: ITelecomProvider;
    paymentProvider: IPaymentProvider;
  },
) {
  app.get('/health/integrations', async (_req: FastifyRequest, reply: FastifyReply) => {
    const startDb = Date.now();
    let dbStatus: 'UP' | 'DOWN' = 'UP';
    let dbLatency = 0;
    try {
      await deps.db.query('SELECT 1');
      dbLatency = Date.now() - startDb;
    } catch {
      dbStatus = 'DOWN';
      dbLatency = Date.now() - startDb;
    }

    const startRedis = Date.now();
    let redisStatus: 'UP' | 'DOWN' = 'UP';
    let redisLatency = 0;
    if (deps.redis) {
      try {
        const pong = await deps.redis.ping();
        redisStatus = pong === 'PONG' ? 'UP' : 'DOWN';
        redisLatency = Date.now() - startRedis;
      } catch {
        redisStatus = 'DOWN';
        redisLatency = Date.now() - startRedis;
      }
    } else {
      redisStatus = 'UP'; // In-memory fallback
    }

    let telecomHealth: any = { providerName: deps.telecomProvider.providerName || 'DATAHOUSE', status: 'UNKNOWN', latencyMs: 0 };
    try {
      telecomHealth = await deps.telecomProvider.healthCheck();
    } catch (err: any) {
      telecomHealth = { providerName: deps.telecomProvider.providerName || 'DATAHOUSE', status: 'DOWN', latencyMs: 0, message: err.message };
    }

    let paystackHealth: any = { providerName: 'Paystack', status: 'UP', latencyMs: 0 };
    if (deps.paymentProvider.healthCheck) {
      try {
        paystackHealth = await deps.paymentProvider.healthCheck();
      } catch (err: any) {
        paystackHealth = { providerName: 'Paystack', status: 'DOWN', latencyMs: 0, message: err.message };
      }
    }

    const isHealthy =
      dbStatus === 'UP' &&
      redisStatus === 'UP' &&
      telecomHealth.status === 'UP' &&
      paystackHealth.status === 'UP';

    const isDegraded =
      !isHealthy &&
      dbStatus === 'UP' && // DB is up, but an external provider or redis is down/degraded
      (telecomHealth.status === 'DEGRADED' || paystackHealth.status === 'DEGRADED');

    const overallStatus = isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'UNHEALTHY';

    const report: IntegrationHealthReport = {
      status: overallStatus,
      integrations: {
        datahouse: telecomHealth,
        gmpl: telecomHealth, // Backward compatibility alias
        paystack: paystackHealth,
        redis: { status: redisStatus, latencyMs: redisLatency },
        database: { status: dbStatus, latencyMs: dbLatency },
      },
      timestamp: new Date().toISOString(),
    };

    const statusCode = overallStatus === 'UNHEALTHY' && dbStatus === 'DOWN' ? 503 : 200;
    reply.status(statusCode).send(report);
  });
}
