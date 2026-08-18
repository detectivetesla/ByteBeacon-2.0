import crypto from 'node:crypto';
import type pg from 'pg';
import type { Redis } from 'ioredis';
import { ConflictError } from '../errors/app-error.js';

export interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

export interface SaveResponseParams {
  key: string;
  userId: string;
  endpoint: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}

export class IdempotencyService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly defaultTtlSeconds: number;

  constructor(db: pg.Pool, redis: Redis | null = null, defaultTtlSeconds = 86400) {
    this.db = db;
    this.redis = redis;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  public computeHash(payload: unknown): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public async getExistingResponse(
    key: string,
    userId: string,
    currentRequestHash: string,
  ): Promise<{ exists: boolean; status?: number; body?: unknown }> {
    // 1. Redis Acceleration Check
    if (this.redis) {
      const redisKey = `idempotency:${userId}:${key}`;
      const cached = await this.redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          requestHash: string;
          status: number;
          body: unknown;
        };

        if (parsed.requestHash !== currentRequestHash) {
          throw new ConflictError(
            'Idempotency key collision: This key was previously used with a different request payload',
          );
        }

        return { exists: true, status: parsed.status, body: parsed.body };
      }
    }

    // 2. PostgreSQL Durable Check
    const query = `
      SELECT response_status as "responseStatus", response_body as "responseBody", request_hash as "requestHash"
      FROM idempotency_keys
      WHERE key = $1 AND user_id = $2 AND expires_at > CURRENT_TIMESTAMP;
    `;

    const result = await this.db.query(query, [key, userId]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (row.requestHash !== currentRequestHash) {
        throw new ConflictError(
          'Idempotency key collision: This key was previously used with a different request payload',
        );
      }

      // Populate Redis cache asynchronously
      if (this.redis) {
        const redisKey = `idempotency:${userId}:${key}`;
        await this.redis.set(
          redisKey,
          JSON.stringify({
            requestHash: row.requestHash,
            status: row.responseStatus,
            body: row.responseBody,
          }),
          'EX',
          this.defaultTtlSeconds,
        );
      }

      return {
        exists: true,
        status: row.responseStatus,
        body: row.responseBody,
      };
    }

    return { exists: false };
  }

  public async saveResponse(
    clientOrKey: pg.PoolClient | pg.Pool | string | SaveResponseParams,
    keyOrUserIdOrParams?: string | SaveResponseParams,
    endpoint?: string,
    requestHash?: string,
    status?: number,
    body?: unknown,
  ): Promise<void> {
    let executor: pg.PoolClient | pg.Pool = this.db;
    let key: string;
    let userId: string;
    let ep: string;
    let reqHash: string;
    let respStatus: number;
    let respBody: unknown;

    if (
      typeof clientOrKey === 'object' &&
      clientOrKey !== null &&
      'query' in clientOrKey &&
      typeof keyOrUserIdOrParams === 'object' &&
      keyOrUserIdOrParams !== null
    ) {
      executor = clientOrKey as pg.PoolClient | pg.Pool;
      const params = keyOrUserIdOrParams as SaveResponseParams;
      key = params.key;
      userId = params.userId;
      ep = params.endpoint;
      reqHash = params.requestHash;
      respStatus = params.responseStatus;
      respBody = params.responseBody;
    } else if (typeof clientOrKey === 'object' && clientOrKey !== null && 'key' in clientOrKey) {
      const params = clientOrKey as SaveResponseParams;
      key = params.key;
      userId = params.userId;
      ep = params.endpoint;
      reqHash = params.requestHash;
      respStatus = params.responseStatus;
      respBody = params.responseBody;
    } else {
      key = clientOrKey as string;
      userId = keyOrUserIdOrParams as string;
      ep = endpoint || 'API';
      reqHash = requestHash || '';
      respStatus = status || 200;
      respBody = body;
    }

    const expiresAt = new Date(Date.now() + this.defaultTtlSeconds * 1000);

    // 1. Persist to PostgreSQL (Durable Authority)
    const query = `
      INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, response_status, response_body, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key, user_id) 
      DO UPDATE SET
        response_status = EXCLUDED.response_status,
        response_body = EXCLUDED.response_body,
        expires_at = EXCLUDED.expires_at;
    `;

    await executor.query(query, [
      key,
      userId,
      ep,
      reqHash,
      respStatus,
      JSON.stringify(respBody),
      expiresAt,
    ]);

    // 2. Persist to Redis (Acceleration Layer)
    if (this.redis) {
      const redisKey = `idempotency:${userId}:${key}`;
      await this.redis.set(
        redisKey,
        JSON.stringify({ requestHash: reqHash, status: respStatus, body: respBody }),
        'EX',
        this.defaultTtlSeconds,
      );
    }
  }

  public async get<T>(key: string, userId: string, payload: unknown): Promise<T | null> {
    const hash = this.computeHash(payload);
    const res = await this.getExistingResponse(key, userId, hash);
    return res.exists ? (res.body as T) : null;
  }

  public async set<T>(
    key: string,
    userId: string,
    payload: unknown,
    responseBody: T,
    endpoint = 'API',
  ): Promise<void> {
    const hash = this.computeHash(payload);
    await this.saveResponse({
      key,
      userId,
      endpoint,
      requestHash: hash,
      responseStatus: 200,
      responseBody,
    });
  }

  /**
   * Normalizes idempotency key from HTTP headers or request body.
   * Priority:
   * 1. Header: `Idempotency-Key` or `x-idempotency-key` (ByteBeacon-native API contract)
   * 2. Body property: `idempotencyKey` (DataHouse Agent API contract)
   */
  public extractKey(req: { headers: Record<string, unknown>; body?: unknown }): string | undefined {
    const fromHeader =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string);

    if (fromHeader && typeof fromHeader === 'string' && fromHeader.trim().length > 0) {
      return fromHeader.trim();
    }

    if (req.body && typeof req.body === 'object' && 'idempotencyKey' in req.body) {
      const fromBody = (req.body as Record<string, unknown>).idempotencyKey;
      if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
        return fromBody.trim();
      }
    }

    return undefined;
  }
}

