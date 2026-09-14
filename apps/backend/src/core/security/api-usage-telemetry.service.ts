import type { FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { logger } from '../logging/logger.js';
import { extractApiKeyFromRequest } from '../../plugins/auth.plugin.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ApiUsageRecordParams {
  keyId?: string | null;
  keyPrefix?: string | null;
  keyName?: string | null;
  userId?: string | null;
  agentId?: string | null;
  environment?: 'LIVE' | 'SANDBOX' | 'TEST';
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestHeaders?: Record<string, string> | null;
  requestPayload?: string | null;
  responseHeaders?: Record<string, string> | null;
  responsePayload?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface CachedKeyMetadata {
  id: string;
  name?: string;
  keyPrefix?: string;
  agentId?: string;
  ownerUserId?: string;
  environment: 'LIVE' | 'SANDBOX' | 'TEST';
  cachedAt: number;
}

function maskSensitiveStrings(str: string): string {
  return str
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1***')
    .replace(/(ak_(live|test)_[a-zA-Z0-9_\-]+)/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+(")/gi, '$1***$2')
    .replace(/("token"\s*:\s*")[^"]+(")/gi, '$1***$2');
}

function sanitizePayload(data: unknown): string | null {
  if (data === undefined || data === null) return null;
  try {
    let parsed: any = data;
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed) return null;
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          return maskSensitiveStrings(trimmed).slice(0, 4000);
        }
      } else {
        return maskSensitiveStrings(trimmed).slice(0, 4000);
      }
    }

    const maskObject = (obj: any, depth = 0): any => {
      if (depth > 5) return obj;
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map((item) => maskObject(item, depth + 1));

      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/password|secret|token|apikey|api_key|authorization|cookie|pin|cvv|creditcard|card_number/i.test(k)) {
          res[k] = '***';
        } else if (typeof v === 'object' && v !== null) {
          res[k] = maskObject(v, depth + 1);
        } else {
          res[k] = v;
        }
      }
      return res;
    };

    const masked = maskObject(parsed);
    const json = JSON.stringify(masked);
    return json.length > 4000 ? json.slice(0, 3997) + '...' : json;
  } catch {
    return null;
  }
}

function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const allowed = [
    'content-type',
    'accept',
    'user-agent',
    'host',
    'origin',
    'x-request-id',
    'x-forwarded-for',
    'content-length',
    'referer',
    'cache-control',
  ];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (allowed.includes(lower)) {
      out[lower] = String(v);
    } else if (/auth|key|secret|cookie/i.test(lower)) {
      out[lower] = '***';
    }
  }
  return out;
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
      let keyName: string | null = null;
      let userId: string | null = userSub || null;
      let agentId: string | null = null;
      let environment: 'LIVE' | 'SANDBOX' | 'TEST' = 'LIVE';

      // 1. Resolve from pre-authenticated req.apiKey if available
      if (reqApiKey) {
        if (reqApiKey.id && this.safeUuid(reqApiKey.id)) {
          keyId = reqApiKey.id;
        }
        if (reqApiKey.name) {
          keyName = reqApiKey.name;
        }
        if (reqApiKey.agentId) {
          userId = userId || reqApiKey.agentId;
          agentId = agentId || reqApiKey.agentId;
        }
        if (reqApiKey.environment) {
          environment = reqApiKey.environment === 'TEST' || reqApiKey.environment === 'SANDBOX' ? 'TEST' : 'LIVE';
        }
      }

      // 2. Resolve from raw API key string if keyId is not yet resolved
      if (rawKey) {
        keyPrefix = rawKey.substring(0, 16);
        if (rawKey.startsWith('ak_test_')) {
          environment = 'TEST';
        }

        const cached = this.keyCache.get(keyPrefix);
        if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
          keyId = cached.id;
          keyName = keyName || cached.name || null;
          userId = userId || cached.ownerUserId || cached.agentId || null;
          agentId = agentId || cached.agentId || null;
          environment = cached.environment;
        } else {
          try {
            const keyRes = await this.db.query(
              `SELECT id, name, key_prefix, agent_id, owner_user_id, environment 
               FROM api_keys 
               WHERE key_prefix = $1 
               LIMIT 1`,
              [keyPrefix],
            );
            if (keyRes.rows.length > 0) {
              const row = keyRes.rows[0];
              keyId = row.id;
              keyName = row.name;
              userId = userId || row.owner_user_id || row.agent_id || null;
              agentId = agentId || row.agent_id || null;
              environment = row.environment === 'TEST' || row.environment === 'SANDBOX' ? 'TEST' : 'LIVE';

              this.keyCache.set(keyPrefix, {
                id: row.id,
                name: row.name,
                keyPrefix: row.key_prefix,
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

      // Also ensure agentId is resolved if we have userId
      if (!agentId && userId && this.safeUuid(userId)) {
        try {
          const agentRes = await this.db.query(
            `SELECT id FROM agents WHERE user_id = $1 OR id = $1 LIMIT 1`,
            [userId],
          );
          if (agentRes.rows.length > 0) {
            agentId = agentRes.rows[0].id;
          }
        } catch {}
      }

      // 3. Extract path, timing, status, IP, headers, payloads
      const endpoint = req.routeOptions?.url || url.split('?')[0];
      const responseTimeMs = Math.max(0, Math.round(reply.elapsedTime || 0));
      const statusCode = reply.statusCode || 200;
      const ipAddress = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '').trim() || null;
      const userAgent = (req.headers['user-agent'] as string) || null;

      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      if (statusCode >= 400) {
        errorCode = `HTTP_${statusCode}`;
        const errObj = (req as any)._error;
        if (errObj && typeof errObj.message === 'string') {
          errorMessage = errObj.message;
          if (errObj.code) errorCode = errObj.code;
        }
      }

      const rawResp = (req as any)._responsePayload;
      if (statusCode >= 400 && rawResp && typeof rawResp === 'string') {
        try {
          const parsedResp = JSON.parse(rawResp);
          if (parsedResp.error) {
            if (parsedResp.error.code) errorCode = String(parsedResp.error.code);
            if (parsedResp.error.message) errorMessage = String(parsedResp.error.message);
          }
        } catch {}
      }

      const requestPayload = sanitizePayload(req.body);
      const responsePayload = sanitizePayload(rawResp);
      const requestHeaders = sanitizeHeaders(req.headers);
      const responseHeaders = sanitizeHeaders((reply as any).getHeaders?.() || {});

      await this.recordMetric({
        keyId,
        keyPrefix,
        keyName,
        userId,
        agentId,
        environment,
        endpoint,
        method: req.method,
        statusCode,
        responseTimeMs,
        ipAddress,
        userAgent,
        requestHeaders,
        requestPayload,
        responseHeaders,
        responsePayload,
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
      const safeAgentId = this.safeUuid(params.agentId);
      const prefix = params.keyPrefix || null;
      const keyName = params.keyName || null;
      const env = params.environment || 'LIVE';

      // Primary enhanced insert query with full payload and agent attribution
      try {
        await this.db.query(
          `INSERT INTO api_usage_metrics (
            key_id, key_name, key_prefix, user_id, agent_id, environment,
            endpoint, method, status_code, response_time_ms, ip_address,
            user_agent, request_headers, request_payload, response_headers, response_payload,
            error_code, error_message
          )
          SELECT
            (
              CASE 
                WHEN $1::uuid IS NOT NULL THEN (SELECT id FROM api_keys WHERE id = $1::uuid LIMIT 1)
                WHEN $2::text IS NOT NULL THEN (SELECT id FROM api_keys WHERE key_prefix = $2::text LIMIT 1)
                ELSE NULL 
              END
            ),
            $3, $4,
            (
              CASE 
                WHEN $5::uuid IS NOT NULL THEN (
                  SELECT u.id FROM users u 
                  LEFT JOIN agents a ON a.user_id = u.id 
                  WHERE u.id = $5::uuid OR a.id = $5::uuid 
                  LIMIT 1
                )
                ELSE NULL 
              END
            ),
            (
              CASE 
                WHEN $6::uuid IS NOT NULL THEN (
                  SELECT a.id FROM agents a 
                  WHERE a.id = $6::uuid OR a.user_id = $6::uuid 
                  LIMIT 1
                )
                WHEN $5::uuid IS NOT NULL THEN (
                  SELECT a.id FROM agents a 
                  WHERE a.id = $5::uuid OR a.user_id = $5::uuid 
                  LIMIT 1
                )
                ELSE NULL 
              END
            ),
            $7, $8, $9, $10, $11, $12,
            $13,
            CASE WHEN $14::text IS NOT NULL THEN $14::jsonb ELSE NULL END,
            $15,
            CASE WHEN $16::text IS NOT NULL THEN $16::jsonb ELSE NULL END,
            $17,
            $18, $19`,
          [
            safeKeyId,
            prefix,
            keyName,
            prefix,
            safeUserId,
            safeAgentId,
            env,
            params.endpoint,
            params.method.toUpperCase(),
            params.statusCode,
            params.responseTimeMs,
            params.ipAddress || null,
            params.userAgent || null,
            params.requestHeaders ? JSON.stringify(params.requestHeaders) : null,
            params.requestPayload || null,
            params.responseHeaders ? JSON.stringify(params.responseHeaders) : null,
            params.responsePayload || null,
            params.errorCode || null,
            params.errorMessage || null,
          ],
        );
      } catch (insertErr: any) {
        // Fallback for databases/tests where migration 26 columns are not yet provisioned
        if (insertErr?.code === '42703') {
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
        } else {
          logger.debug({ err: insertErr }, '[ApiUsageTelemetry] Error inserting api_usage_metrics record');
        }
      }
    } catch (dbErr) {
      // Non-blocking catch to ensure telemetry never interferes with HTTP transactions
      logger.debug({ err: dbErr }, '[ApiUsageTelemetry] Error in recordMetric');
    }
  }
}
