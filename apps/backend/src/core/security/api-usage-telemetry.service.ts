import type { FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { logger } from '../logging/logger.js';
import { extractApiKeyFromRequest } from '../../plugins/auth.plugin.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ApiUsageRecordParams {
  keyId?: string | null;
  keyPrefix?: string | null;
  userId?: string | null;
  environment?: 'LIVE' | 'SANDBOX' | 'TEST';
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface CachedKeyMetadata {
  id: string;
  agentId?: string;
  ownerUserId?: string;
  environment: 'LIVE' | 'SANDBOX' | 'TEST';
  cachedAt: number;
}

export class ApiUsageTelemetryService {
  private readonly db: pg.Pool;
  private readonly keyCache = new Map<string, CachedKeyMetadata>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(db: pg.Pool) {
    this.db = db;
  }

  /**
   * Safely formats and validates a string as a valid UUID, returning null if invalid.
   */
  public safeUuid(val: unknown): string | null {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return UUID_REGEX.test(trimmed) ? trimmed : null;
  }

  /**
   * Fastify onResponse hook handler that safely extracts request telemetry
   * and asynchronously writes an entry to api_usage_metrics without blocking the response.
   */
  public async recordRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Skip OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        return;
      }

      const url = req.url || '';
      // Skip health checks, static assets, and metrics to prevent database bloat
      if (
        url.startsWith('/health') ||
        url.startsWith('/ready') ||
        url.startsWith('/live') ||
        url.startsWith('/metrics') ||
        url.startsWith('/favicon.ico') ||
        url.startsWith('/docs/static')
      ) {
        return;
      }

      const rawKey = extractApiKeyFromRequest(req);
      const authHeader = req.headers.authorization || '';
      const reqApiKey = (req as any).apiKey;
      const userSub = req.user?.sub;

      // Only track if authenticated via API key, JWT token, or requesting an API route
      const isApiRoute = url.startsWith('/api/') || url.startsWith('/agent/') || url.startsWith('/developer/');
      const hasAuth = Boolean(rawKey || authHeader.startsWith('Bearer ') || reqApiKey || userSub);

      if (!isApiRoute && !hasAuth) {
        return;
      }

      let keyId: string | null = null;
      let keyPrefix: string | null = null;
      let userId: string | null = userSub || null;
      let environment: 'LIVE' | 'SANDBOX' | 'TEST' = 'LIVE';

      // 1. Resolve from pre-authenticated req.apiKey if available
      if (reqApiKey) {
        if (reqApiKey.id && this.safeUuid(reqApiKey.id)) {
          keyId = reqApiKey.id;
        }
        if (reqApiKey.agentId) {
          userId = userId || reqApiKey.agentId;
        }
        if (reqApiKey.environment) {
          environment = reqApiKey.environment === 'TEST' || reqApiKey.environment === 'SANDBOX' ? 'TEST' : 'LIVE';
        }
      }

      // 2. Resolve from raw API key string if keyId is not yet resolved
      if (rawKey && !keyId) {
        keyPrefix = rawKey.substring(0, 16);
        if (rawKey.startsWith('ak_test_')) {
          environment = 'TEST';
        }

        const cached = this.keyCache.get(keyPrefix);
        if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
          keyId = cached.id;
          userId = userId || cached.ownerUserId || cached.agentId || null;
          environment = cached.environment;
        } else {
          try {
            const keyRes = await this.db.query(
              `SELECT id, agent_id, owner_user_id, environment 
               FROM api_keys 
               WHERE key_prefix = $1 
               LIMIT 1`,
              [keyPrefix],
            );
            if (keyRes.rows.length > 0) {
              const row = keyRes.rows[0];
              keyId = row.id;
              userId = userId || row.owner_user_id || row.agent_id || null;
              environment = row.environment === 'TEST' || row.environment === 'SANDBOX' ? 'TEST' : 'LIVE';

              this.keyCache.set(keyPrefix, {
                id: row.id,
                agentId: row.agent_id,
                ownerUserId: row.owner_user_id,
                environment,
                cachedAt: Date.now(),
              });
            }
          } catch (lookupErr) {
            logger.debug({ err: lookupErr }, '[ApiUsageTelemetry] Error looking up API key by prefix');
          }
        }
      }

      // 3. Extract path, timing, status, IP
      const endpoint = req.routeOptions?.url || url.split('?')[0];
      const responseTimeMs = Math.max(0, Math.round(reply.elapsedTime || 0));
      const statusCode = reply.statusCode || 200;
      const ipAddress = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '').trim() || null;

      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      if (statusCode >= 400) {
        errorCode = `HTTP_${statusCode}`;
      }

      await this.recordMetric({
        keyId,
        keyPrefix,
        userId,
        environment,
        endpoint,
        method: req.method,
        statusCode,
        responseTimeMs,
        ipAddress,
        errorCode,
        errorMessage,
      });
    } catch (err) {
      // Telemetry must never throw or disrupt the application lifecycle
      logger.debug({ err }, '[ApiUsageTelemetry] Safe recordRequest failure');
    }
  }

  /**
   * Persists an API usage record into api_usage_metrics with bulletproof foreign-key resilience.
   */
  public async recordMetric(params: ApiUsageRecordParams): Promise<void> {
    try {
      const safeKeyId = this.safeUuid(params.keyId);
      const safeUserId = this.safeUuid(params.userId);
      const prefix = params.keyPrefix || null;
      const env = params.environment || 'LIVE';

      // Robust insert query that safely resolves foreign keys to api_keys and users
      // without ever throwing foreign key violation errors
      await this.db.query(
        `INSERT INTO api_usage_metrics (
          key_id, user_id, environment, endpoint, method, status_code, response_time_ms, ip_address, error_code, error_message
        )
        SELECT
          (
            CASE 
              WHEN $1::uuid IS NOT NULL THEN (SELECT id FROM api_keys WHERE id = $1::uuid LIMIT 1)
              WHEN $2::text IS NOT NULL THEN (SELECT id FROM api_keys WHERE key_prefix = $2::text LIMIT 1)
              ELSE NULL 
            END
          ),
          (
            CASE 
              WHEN $3::uuid IS NOT NULL THEN (
                SELECT u.id FROM users u 
                LEFT JOIN agents a ON a.user_id = u.id 
                WHERE u.id = $3::uuid OR a.id = $3::uuid 
                LIMIT 1
              )
              ELSE NULL 
            END
          ),
          $4, $5, $6, $7, $8, $9, $10, $11`,
        [
          safeKeyId,
          prefix,
          safeUserId,
          env,
          params.endpoint,
          params.method.toUpperCase(),
          params.statusCode,
          params.responseTimeMs,
          params.ipAddress || null,
          params.errorCode || null,
          params.errorMessage || null,
        ],
      );
    } catch (dbErr) {
      // Non-blocking catch to ensure telemetry never interferes with HTTP transactions
      logger.debug({ err: dbErr }, '[ApiUsageTelemetry] Error inserting api_usage_metrics record');
    }
  }
}
