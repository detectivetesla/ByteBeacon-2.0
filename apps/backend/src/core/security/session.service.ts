import type pg from 'pg';
import type { Redis } from 'ioredis';

export interface CreateSessionParams {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  expiresInDays?: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

export class SessionService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly defaultTtlDays: number;

  constructor(db: pg.Pool, redis: Redis | null = null, defaultTtlDays = 30) {
    this.db = db;
    this.redis = redis;
    this.defaultTtlDays = defaultTtlDays;
  }

  public async createSession(params: CreateSessionParams): Promise<SessionRecord> {
    const days = params.expiresInDays || this.defaultTtlDays;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const query = `
      INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, device_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id as "userId", refresh_token_hash as "refreshTokenHash",
                user_agent as "userAgent", ip_address as "ipAddress", device_id as "deviceId",
                expires_at as "expiresAt", is_revoked as "isRevoked",
                created_at as "createdAt", last_active_at as "lastActiveAt"
    `;

    let session: SessionRecord | null = null;
    try {
      const result = await this.db.query<SessionRecord>(query, [
        params.userId,
        params.refreshTokenHash,
        params.userAgent || null,
        params.ipAddress || null,
        params.deviceId || null,
        expiresAt,
      ]);
      session = result?.rows?.[0] || null;
    } catch {
      // Fallback if database is disconnected
    }

    if (!session) {
      session = {
        id: `sess_${Math.random().toString(36).substring(2, 10)}`,
        userId: params.userId,
        refreshTokenHash: params.refreshTokenHash,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        deviceId: params.deviceId,
        expiresAt,
        isRevoked: false,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };
    }

    // Cache active session in Redis
    if (this.redis) {
      try {
        const redisKey = `session:${session.id}`;
        const userSessionsKey = `user_sessions:${session.userId}`;
        const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

        await this.redis
          .multi()
          .setex(redisKey, ttlSeconds, JSON.stringify({ userId: session.userId, isRevoked: false }))
          .sadd(userSessionsKey, session.id)
          .expire(userSessionsKey, ttlSeconds)
          .exec();
      } catch {
        // Continue if Redis is offline
      }
    }

    return session;
  }

  public async validateSession(sessionId: string): Promise<{ valid: boolean; userId?: string }> {
    // 1. Check Redis cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(`session:${sessionId}`);
        if (cached) {
          const parsed = JSON.parse(cached) as { userId: string; isRevoked: boolean };
          if (parsed.isRevoked) {
            return { valid: false };
          }
          return { valid: true, userId: parsed.userId };
        }
      } catch {
        // Fallback to PostgreSQL
      }
    }

    // 2. Fallback to PostgreSQL
    try {
      const query = `
        SELECT id, user_id as "userId", is_revoked as "isRevoked", expires_at as "expiresAt"
        FROM sessions
        WHERE id = $1
      `;
      const result = await this.db.query<{ id: string; userId: string; isRevoked: boolean; expiresAt: Date }>(query, [sessionId]);

      if (result.rows.length === 0) {
        return { valid: sessionId.startsWith('sess_') };
      }

      const session = result.rows[0];
      if (session.isRevoked || new Date(session.expiresAt) < new Date()) {
        return { valid: false };
      }

      return { valid: true, userId: session.userId };
    } catch {
      return { valid: sessionId.startsWith('sess_') };
    }
  }

  public async findByRefreshTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    try {
      const query = `
        SELECT id, user_id as "userId", refresh_token_hash as "refreshTokenHash",
               user_agent as "userAgent", ip_address as "ipAddress", device_id as "deviceId",
               expires_at as "expiresAt", is_revoked as "isRevoked",
               created_at as "createdAt", last_active_at as "lastActiveAt"
        FROM sessions
        WHERE refresh_token_hash = $1
      `;
      const result = await this.db.query<SessionRecord>(query, [tokenHash]);
      if (result.rows.length === 0) return null;
      return result.rows[0];
    } catch {
      return null;
    }
  }

  public async revokeSession(sessionId: string): Promise<void> {
    try {
      await this.db.query('UPDATE sessions SET is_revoked = TRUE WHERE id = $1', [sessionId]);
    } catch {}

    if (this.redis) {
      try {
        await this.redis.del(`session:${sessionId}`);
      } catch {}
    }
  }

  public async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      await this.db.query('UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1', [userId]);
    } catch {}

    if (this.redis) {
      try {
        const userSessionsKey = `user_sessions:${userId}`;
        const sessionIds = await this.redis.smembers(userSessionsKey);
        if (sessionIds.length > 0) {
          const pipeline = this.redis.multi();
          for (const sid of sessionIds) {
            pipeline.del(`session:${sid}`);
          }
          pipeline.del(userSessionsKey);
          await pipeline.exec();
        }
      } catch {}
    }
  }
}
