import pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface DatabasePoolOptions {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
}

/**
 * Creates an optimized PostgreSQL connection pool configured for Supabase Connection Poolers / Direct Postgres.
 * Enforces statement timeouts, connection timeouts, and graceful drainage.
 */
export function createOptimizedDatabasePool(options: DatabasePoolOptions = {}): pg.Pool {
  const isProduction = process.env.NODE_ENV === 'production';

  const poolConfig = {
    connectionString: options.connectionString || process.env.DATABASE_URL,
    host: options.host || process.env.DB_HOST,
    port: options.port ? Number(options.port) : process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: options.database || process.env.DB_NAME,
    user: options.user || process.env.DB_USER,
    password: options.password || process.env.DB_PASSWORD,
    max: options.maxConnections || (isProduction ? 20 : 10),
    idleTimeoutMillis: options.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: options.connectionTimeoutMillis || 5000,
    statement_timeout: options.statementTimeoutMillis || 10000, // 10s query timeout prevents runaway queries
    ssl:
      options.ssl !== undefined
        ? options.ssl
        : isProduction || process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
  };

  const pool = new pg.Pool(poolConfig);

  pool.on('error', (err) => {
    logger.error({ err }, '[DATABASE_POOL] Unexpected error on idle database client');
  });

  pool.on('connect', () => {
    logger.debug('[DATABASE_POOL] New database client connection established');
  });

  return pool;
}
