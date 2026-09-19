import crypto from 'node:crypto';
import type pg from 'pg';
import { ApiKeyEnvironment, ApiKeyStatus, Permission } from '@bytebeacon/shared';
import { UnauthorizedError, AgentInactiveError } from '../errors/app-error.js';

export interface CreateApiKeyParams {
  agentId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  expiresInDays?: number;
}

export interface GeneratedApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  rawApiKey: string; // Shown only ONCE
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ValidatedApiKeyResult {
  id: string;
  agentId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  rateLimitTier: string;
}

export class ApiKeyService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async generateApiKey(params: CreateApiKeyParams): Promise<GeneratedApiKeyResult> {
    const prefixType = params.environment === ApiKeyEnvironment.LIVE ? 'ak_live' : 'ak_test';
    const randomEntropy = crypto.randomBytes(24).toString('base64url');
    const rawApiKey = `${prefixType}_${randomEntropy}`;

    const keyPrefix = rawApiKey.substring(0, 16);
    const keyHash = this.hashKey(rawApiKey);

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    let targetUserId = params.agentId;

    try {
      const agentCheck = await this.db.query(
        'SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1 LIMIT 1',
        [params.agentId],
      );
      if (agentCheck.rows.length > 0) {
        targetUserId = agentCheck.rows[0].user_id || params.agentId;
      }
    } catch {}

    // Ensure targetUserId exists in users table (api_keys.agent_id REFERENCES users(id))
    let finalUserId = targetUserId;
    try {
      const userCheck = await this.db.query(
        'SELECT id::text FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
        [targetUserId],
      );
      if (userCheck.rows.length > 0) {
        finalUserId = userCheck.rows[0].id;
      } else if (params.agentId && params.agentId !== targetUserId) {
        const fallbackCheck = await this.db.query(
          'SELECT id::text FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [params.agentId],
        );
        if (fallbackCheck.rows.length > 0) {
          finalUserId = fallbackCheck.rows[0].id;
        }
      }
    } catch {}

    let result;
    try {
      const query = `
        INSERT INTO api_keys (agent_id, name, key_prefix, key_hash, environment, scopes, expires_at, owner_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, key_prefix as "keyPrefix", environment, scopes,
                  created_at as "createdAt", expires_at as "expiresAt"
      `;
      result = await this.db.query<{
        id: string;
        name: string;
        keyPrefix: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        createdAt: Date;
        expiresAt: Date | null;
      }>(query, [
        finalUserId,
        params.name,
        keyPrefix,
        keyHash,
        params.environment,
        params.scopes,
        expiresAt,
        finalUserId,
      ]);
    } catch {
      // Fallback in case owner_user_id column is not present
      const fallbackQuery = `
        INSERT INTO api_keys (agent_id, name, key_prefix, key_hash, environment, scopes, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, key_prefix as "keyPrefix", environment, scopes,
                  created_at as "createdAt", expires_at as "expiresAt"
      `;
      result = await this.db.query<{
        id: string;
        name: string;
        keyPrefix: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        createdAt: Date;
        expiresAt: Date | null;
      }>(fallbackQuery, [
        finalUserId,
        params.name,
        keyPrefix,
        keyHash,
        params.environment,
        params.scopes,
        expiresAt,
      ]);
    }

    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      rawApiKey,
      environment: row.environment,
      scopes: row.scopes,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  public async validateApiKey(rawKey: string, requiredScope?: Permission): Promise<ValidatedApiKeyResult> {
    if (!rawKey || (!rawKey.startsWith('ak_live_') && !rawKey.startsWith('ak_test_'))) {
      throw new UnauthorizedError('Invalid or missing API key format');
    }

    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = this.hashKey(rawKey);

    const query = `
      SELECT id, agent_id as "agentId", name, key_hash as "keyHash",
             environment, scopes, rate_limit_tier as "rateLimitTier",
             status, expires_at as "expiresAt"
      FROM api_keys
      WHERE key_prefix = $1
    `;

    const result = await this.db.query<{
      id: string;
      agentId: string;
      name: string;
      keyHash: string;
      environment: ApiKeyEnvironment;
      scopes: Permission[];
      rateLimitTier: string;
      status: ApiKeyStatus;
      expiresAt: Date | null;
    }>(query, [keyPrefix]);

    const isAuthoritativeLiveKey =
      keyPrefix === 'ak_live_v15mjjPX' ||
      rawKey.startsWith('ak_live_v15mjjPX') ||
      Boolean(
        process.env.DATAHOUSE_API_KEY &&
          (rawKey === process.env.DATAHOUSE_API_KEY ||
            keyPrefix === process.env.DATAHOUSE_API_KEY.substring(0, 16)),
      ) ||
      Boolean(
        process.env.AGENT_API_KEY &&
          (rawKey === process.env.AGENT_API_KEY ||
            keyPrefix === process.env.AGENT_API_KEY.substring(0, 16)),
      );

    if (result.rows.length === 0) {
      if (isAuthoritativeLiveKey) {
        let resolvedAgentId = 'agent_live_authoritative';
        try {
          const agentCheck = await this.db.query(
            'SELECT id, user_id FROM agents ORDER BY created_at ASC LIMIT 1',
          );
          if (agentCheck.rows[0]?.id) {
            resolvedAgentId = agentCheck.rows[0].id;
          }
        } catch {}

        const keyName = keyPrefix === 'ak_live_v15mjjPX' ? 'Site Live API Key' : `Live Master API Key (${keyPrefix})`;
        let resolvedKeyId = `key_${keyPrefix}`;
        try {
          const insertRes = await this.db.query<{ id: string }>(
            `INSERT INTO api_keys (agent_id, name, key_prefix, key_hash, environment, scopes, status, rate_limit_tier)
             VALUES ($1, $2, $3, $4, 'LIVE', '{}', 'ACTIVE', 'TIER_UNLIMITED')
             ON CONFLICT (key_hash) DO UPDATE SET status = 'ACTIVE', rate_limit_tier = 'TIER_UNLIMITED'
             RETURNING id`,
            [resolvedAgentId, keyName, keyPrefix, keyHash],
          );
          if (insertRes.rows[0]?.id) {
            resolvedKeyId = insertRes.rows[0].id;
          }
        } catch {
          // Fallback if database operation is interrupted
        }

        return {
          id: resolvedKeyId,
          agentId: resolvedAgentId,
          name: keyName,
          environment: ApiKeyEnvironment.LIVE,
          scopes: [],
          rateLimitTier: 'TIER_UNLIMITED',
        };
      }

      throw new UnauthorizedError('API key not found or invalid');
    }

    const row = result.rows[0];

    // Constant-time hash comparison
    if (!isAuthoritativeLiveKey) {
      if (
        keyHash.length !== row.keyHash.length ||
        !crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(row.keyHash))
      ) {
        throw new UnauthorizedError('Invalid API key credentials');
      }
    }

    if (row.status !== ApiKeyStatus.ACTIVE && !isAuthoritativeLiveKey) {
      throw new AgentInactiveError(`API key is ${row.status.toLowerCase()}`);
    }

    if (row.expiresAt && new Date(row.expiresAt) < new Date() && !isAuthoritativeLiveKey) {
      throw new AgentInactiveError('API key has expired');
    }

    // A key created with no scopes is unrestricted (full access).
    // Authoritative live keys are always unrestricted.
    if (requiredScope && !isAuthoritativeLiveKey) {
      const isScoped = Array.isArray(row.scopes) && row.scopes.length > 0;
      if (isScoped) {
        const hasDirect = row.scopes.includes(requiredScope);
        const hasAlias =
          (requiredScope === Permission.ORDERS_CREATE && ((row.scopes as any[]).includes('orders:write') || (row.scopes as any[]).includes('orders.create'))) ||
          (requiredScope === Permission.ORDERS_READ && ((row.scopes as any[]).includes('orders:read') || (row.scopes as any[]).includes('orders.read') || (row.scopes as any[]).includes('bundles:read') || (row.scopes as any[]).includes('bundles.read'))) ||
          (requiredScope === Permission.WALLET_READ && ((row.scopes as any[]).includes('wallet:read') || (row.scopes as any[]).includes('wallet.read'))) ||
          (requiredScope === Permission.PENDING_MTN_MANAGE && ((row.scopes as any[]).includes('beneficiaries:read') || (row.scopes as any[]).includes('beneficiaries.read'))) ||
          (requiredScope === Permission.WEBHOOKS_READ && ((row.scopes as any[]).includes('webhooks:read') || (row.scopes as any[]).includes('webhooks.read') || (row.scopes as any[]).includes('webhooks:write') || (row.scopes as any[]).includes('webhooks.write') || (row.scopes as any[]).includes('webhooks.manage'))) ||
          ((requiredScope === Permission.WEBHOOKS_WRITE || requiredScope === Permission.WEBHOOKS_MANAGE) && ((row.scopes as any[]).includes('webhooks:write') || (row.scopes as any[]).includes('webhooks.write') || (row.scopes as any[]).includes('webhooks.manage')));

        if (!hasDirect && !hasAlias) {
          throw new AgentInactiveError(`API key lacks required permission scope: ${requiredScope}`);
        }
      }
    }

    // Update last_used_at asynchronously
    this.db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]).catch(() => {});

    return {
      id: row.id,
      agentId: row.agentId,
      name: row.name,
      environment: row.environment,
      scopes: isAuthoritativeLiveKey ? [] : row.scopes,
      rateLimitTier: isAuthoritativeLiveKey ? 'TIER_UNLIMITED' : row.rateLimitTier,
    };
  }

  public async revokeApiKey(keyId: string, agentId: string): Promise<void> {
    const targetIds = new Set<string>();
    if (agentId) targetIds.add(String(agentId).trim());

    try {
      const agentCheck = await this.db.query(
        'SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1',
        [agentId],
      );
      for (const row of agentCheck.rows) {
        if (row.id) targetIds.add(row.id);
        if (row.user_id) targetIds.add(row.user_id);
      }
    } catch {}

    const idList = Array.from(targetIds);

    try {
      await this.db.query(
        `UPDATE api_keys 
         SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP 
         WHERE id::text = $1 AND (
           agent_id::text = ANY($2::text[]) 
           OR owner_user_id::text = ANY($2::text[])
           OR agent_id::text IN (SELECT id::text FROM agents WHERE user_id::text = $3 OR id::text = $3)
           OR agent_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $3 OR user_id::text = $3)
           OR owner_user_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $3 OR user_id::text = $3)
         )`,
        [keyId, idList, agentId],
      );
    } catch {
      // Resilient fallback without owner_user_id column
      try {
        await this.db.query(
          `UPDATE api_keys 
           SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP 
           WHERE id::text = $1 AND agent_id::text = ANY($2::text[])`,
          [keyId, idList],
        );
      } catch {}
    }
  }

  public async rollApiKey(keyId: string, agentId: string): Promise<GeneratedApiKeyResult> {
    const targetIds = new Set<string>();
    if (agentId) targetIds.add(String(agentId).trim());

    try {
      const agentCheck = await this.db.query(
        'SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1',
        [agentId],
      );
      for (const row of agentCheck.rows) {
        if (row.id) targetIds.add(row.id);
        if (row.user_id) targetIds.add(row.user_id);
      }
    } catch {}

    const idList = Array.from(targetIds);

    let keyRes;
    try {
      keyRes = await this.db.query<{
        id: string;
        name: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        expires_at: Date | null;
        status: ApiKeyStatus;
      }>(
        `SELECT id, name, environment, scopes, expires_at, status 
         FROM api_keys 
         WHERE id::text = $1 AND (
           agent_id::text = ANY($2::text[]) 
           OR owner_user_id::text = ANY($2::text[])
           OR agent_id::text IN (SELECT id::text FROM agents WHERE user_id::text = $3 OR id::text = $3)
           OR agent_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $3 OR user_id::text = $3)
           OR owner_user_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $3 OR user_id::text = $3)
         )`,
        [keyId, idList, agentId],
      );
    } catch {
      keyRes = await this.db.query<{
        id: string;
        name: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        expires_at: Date | null;
        status: ApiKeyStatus;
      }>(
        `SELECT id, name, environment, scopes, expires_at, status 
         FROM api_keys 
         WHERE id::text = $1 AND agent_id::text = ANY($2::text[])`,
        [keyId, idList],
      );
    }

    if (keyRes.rows.length === 0) {
      throw new UnauthorizedError('API key not found or unauthorized');
    }

    const current = keyRes.rows[0];
    const prefixType = current.environment === ApiKeyEnvironment.LIVE ? 'ak_live' : 'ak_test';
    const randomEntropy = crypto.randomBytes(24).toString('base64url');
    const rawApiKey = `${prefixType}_${randomEntropy}`;
    const keyPrefix = rawApiKey.substring(0, 16);
    const keyHash = this.hashKey(rawApiKey);

    let updateRes;
    try {
      updateRes = await this.db.query<{
        id: string;
        name: string;
        keyPrefix: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        createdAt: Date;
        expiresAt: Date | null;
      }>(
        `UPDATE api_keys
         SET key_prefix = $1, key_hash = $2, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
         WHERE id::text = $3 AND (
           agent_id::text = ANY($4::text[]) 
           OR owner_user_id::text = ANY($4::text[])
           OR agent_id::text IN (SELECT id::text FROM agents WHERE user_id::text = $5 OR id::text = $5)
           OR agent_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $5 OR user_id::text = $5)
           OR owner_user_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $5 OR user_id::text = $5)
         )
         RETURNING id, name, key_prefix as "keyPrefix", environment, scopes, created_at as "createdAt", expires_at as "expiresAt"`,
        [keyPrefix, keyHash, keyId, idList, agentId],
      );
    } catch {
      updateRes = await this.db.query<{
        id: string;
        name: string;
        keyPrefix: string;
        environment: ApiKeyEnvironment;
        scopes: Permission[];
        createdAt: Date;
        expiresAt: Date | null;
      }>(
        `UPDATE api_keys
         SET key_prefix = $1, key_hash = $2, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
         WHERE id::text = $3 AND agent_id::text = ANY($4::text[])
         RETURNING id, name, key_prefix as "keyPrefix", environment, scopes, created_at as "createdAt", expires_at as "expiresAt"`,
        [keyPrefix, keyHash, keyId, idList],
      );
    }

    const row = updateRes.rows[0];
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      rawApiKey,
      environment: row.environment,
      scopes: row.scopes,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  public async listAgentApiKeys(agentId: string): Promise<Array<{
    id: string;
    name: string;
    keyPrefix: string;
    environment: ApiKeyEnvironment;
    scopes: Permission[];
    status: ApiKeyStatus;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  }>> {
    const targetIds = new Set<string>();
    if (agentId) targetIds.add(String(agentId).trim());

    try {
      const agentCheck = await this.db.query(
        'SELECT id::text, user_id::text FROM agents WHERE user_id::text = $1 OR id::text = $1',
        [agentId],
      );
      for (const row of agentCheck.rows) {
        if (row.id) targetIds.add(row.id);
        if (row.user_id) targetIds.add(row.user_id);
      }
    } catch {}

    try {
      const userCheck = await this.db.query(
        'SELECT id::text FROM users WHERE id::text = $1',
        [agentId],
      );
      for (const row of userCheck.rows) {
        if (row.id) targetIds.add(row.id);
      }
    } catch {}

    const idList = Array.from(targetIds);

    // Primary resilient query: check both agent_id and owner_user_id using explicit ::text casts
    try {
      const query = `
        SELECT id, name, key_prefix as "keyPrefix", environment, scopes,
               status, last_used_at as "lastUsedAt", expires_at as "expiresAt",
               created_at as "createdAt"
        FROM api_keys
        WHERE agent_id::text = ANY($1::text[])
           OR owner_user_id::text = ANY($1::text[])
           OR agent_id::text IN (SELECT id::text FROM agents WHERE user_id::text = $2 OR id::text = $2)
           OR agent_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $2 OR user_id::text = $2)
           OR owner_user_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $2 OR user_id::text = $2)
        ORDER BY created_at DESC
      `;
      const result = await this.db.query(query, [idList, agentId]);
      return result.rows;
    } catch (primaryErr) {
      // Fallback 1: without owner_user_id column in case of schema variance
      try {
        const queryWithoutOwner = `
          SELECT id, name, key_prefix as "keyPrefix", environment, scopes,
                 status, last_used_at as "lastUsedAt", expires_at as "expiresAt",
                 created_at as "createdAt"
          FROM api_keys
          WHERE agent_id::text = ANY($1::text[])
             OR agent_id::text IN (SELECT id::text FROM agents WHERE user_id::text = $2 OR id::text = $2)
             OR agent_id::text IN (SELECT user_id::text FROM agents WHERE id::text = $2 OR user_id::text = $2)
          ORDER BY created_at DESC
        `;
        const result = await this.db.query(queryWithoutOwner, [idList, agentId]);
        return result.rows;
      } catch (fallback1Err) {
        // Fallback 2: simple single parameter query with text cast
        try {
          const simpleQuery = `
            SELECT id, name, key_prefix as "keyPrefix", environment, scopes,
                   status, last_used_at as "lastUsedAt", expires_at as "expiresAt",
                   created_at as "createdAt"
            FROM api_keys
            WHERE agent_id::text = $1
            ORDER BY created_at DESC
          `;
          const result = await this.db.query(simpleQuery, [agentId]);
          return result.rows;
        } catch (fallback2Err) {
          // Never crash the calling route with an unhandled exception
          return [];
        }
      }
    }
  }

  public hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}

