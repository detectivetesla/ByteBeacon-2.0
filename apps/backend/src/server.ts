import { createApp } from './app.js';
import { getConfig } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { createDatabasePool, closeDatabasePool } from './infrastructure/database/pool.js';
import { createRedisClient, closeRedisClient } from './infrastructure/redis/client.js';
import { DatabaseMigrator } from './infrastructure/database/migrator.js';
import { allMigrations } from './infrastructure/database/migrations.registry.js';
import { ProductionSchemaVerifier } from './infrastructure/database/schema-verifier.service.js';

let isShuttingDown = false;

export async function startServer() {
  try {
    const config = getConfig();

    // Initialize infrastructure clients
    const dbPool = createDatabasePool({ connectionString: config.DATABASE_URL });
    createRedisClient({ url: config.REDIS_URL });

    // Safe, non-destructive migration execution on startup
    try {
      logger.info('[STARTUP] Executing authoritative database migrations...');
      const migrator = new DatabaseMigrator(dbPool);
      const applied = await migrator.runPendingMigrations(allMigrations);
      logger.info({ appliedCount: applied.length, applied }, '[STARTUP] Database migrations evaluated successfully.');
    } catch (migErr) {
      logger.error({ err: migErr }, '[STARTUP] Warning: Migration check encountered error; proceeding to schema verification');
    }

    // Production schema verification
    const schemaReport = await ProductionSchemaVerifier.verifyRequiredSchema(dbPool);
    if (!schemaReport.isComplete) {
      logger.warn(
        {
          missingCount: schemaReport.missingRelations.length,
          missing: schemaReport.missingRelations,
        },
        '[STARTUP] Schema verification incomplete — some relations missing',
      );
    }

    const app = createApp({ config });

    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn(`Shutdown already in progress. Ignoring additional ${signal} signal.`);
        return;
      }
      isShuttingDown = true;
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      const shutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000);

      try {
        // 1. Stop accepting new HTTP requests & close Fastify
        logger.info('Closing HTTP server...');
        await app.close();
        logger.info('HTTP server closed.');

        // 2. Close Redis
        await closeRedisClient();

        // 3. Close Postgres pool
        await closeDatabasePool();

        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    const address = await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`ByteBeacon 2.0 backend server listening at ${address} [ENV: ${config.NODE_ENV}]`);
    return app;
  } catch (err) {
    logger.error({ err }, 'Fatal error starting ByteBeacon backend server');
    console.error('Fatal error starting ByteBeacon backend server:', err);
    throw err;
  }
}
