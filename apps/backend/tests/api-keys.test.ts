import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { ApiKeyService } from '../src/core/security/api-key.service.js';
import { ApiKeyEnvironment, ApiKeyStatus, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('API Key System (Agent/Developer Domain)', () => {
  it('should generate ak_live_ key and compute SHA-256 hash', async () => {
    let insertedRow: Record<string, unknown> = {};

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('INSERT INTO api_keys')) {
          insertedRow = {
            id: 'key_123',
            name: params[1],
            keyPrefix: params[2],
            keyHash: params[3],
            environment: params[4],
            scopes: params[5],
            createdAt: new Date(),
            expiresAt: params[6] || null,
          };
          return Promise.resolve({ rows: [insertedRow] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    const result = await apiKeyService.generateApiKey({
      agentId: 'agt_1',
      name: 'Production Storefront Key',
      environment: ApiKeyEnvironment.LIVE,
      scopes: [Permission.ORDERS_CREATE, Permission.ORDERS_READ],
    });

    expect(result.rawApiKey.startsWith('ak_live_')).toBe(true);
    expect(result.keyPrefix.startsWith('ak_live_')).toBe(true);
    expect(result.scopes).toContain(Permission.ORDERS_CREATE);
    expect(result.scopes).toContain(Permission.ORDERS_READ);
  });

  it('should validate API key credentials and enforce required scope', async () => {
    const rawKey = 'ak_live_abcdef1234567890abcdef1234567890';
    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = new ApiKeyService({} as pg.Pool).hashKey(rawKey);

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, agent_id')) {
          if (params[0] === keyPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_123',
                  agentId: 'agt_1',
                  name: 'Test Key',
                  keyHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: [Permission.ORDERS_READ],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    // Valid without scope
    const valid = await apiKeyService.validateApiKey(rawKey);
    expect(valid.id).toBe('key_123');
    expect(valid.agentId).toBe('agt_1');

    // Valid with matching scope
    const validWithScope = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_READ);
    expect(validWithScope.id).toBe('key_123');

    // Invalid when lacking required scope
    await expect(apiKeyService.validateApiKey(rawKey, Permission.ORDERS_REFUND)).rejects.toThrow(
      'API key lacks required permission scope: orders.refund',
    );
  });

  it('should allow unrestricted access when key is created with no scopes', async () => {
    const rawKey = 'ak_live_unrestricted1234567890';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes('FROM api_keys')) {
          return Promise.resolve({
            rows: [
              {
                id: 'key_unrestricted',
                agentId: 'agt_unrestricted',
                name: 'Unrestricted Master Key',
                keyHash,
                environment: ApiKeyEnvironment.LIVE,
                scopes: [], // No scopes = unrestricted
                rateLimitTier: 'TIER_AGENT',
                status: ApiKeyStatus.ACTIVE,
                expiresAt: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    // Should grant access regardless of required scope
    const resOrdersRead = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_READ);
    expect(resOrdersRead.id).toBe('key_unrestricted');

    const resOrdersCreate = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_CREATE);
    expect(resOrdersCreate.id).toBe('key_unrestricted');

    const resWalletRead = await apiKeyService.validateApiKey(rawKey, Permission.WALLET_READ);
    expect(resWalletRead.id).toBe('key_unrestricted');
  });

  it('should accept string scope aliases like orders:write and orders:read', async () => {
    const rawKey = 'ak_live_scoped1234567890';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes('FROM api_keys')) {
          return Promise.resolve({
            rows: [
              {
                id: 'key_scoped',
                agentId: 'agt_scoped',
                name: 'Scoped Key',
                keyHash,
                environment: ApiKeyEnvironment.LIVE,
                scopes: ['orders:write', 'orders:read', 'wallet:read'],
                rateLimitTier: 'TIER_AGENT',
                status: ApiKeyStatus.ACTIVE,
                expiresAt: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    const resWrite = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_CREATE);
    expect(resWrite.id).toBe('key_scoped');

    const resRead = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_READ);
    expect(resRead.id).toBe('key_scoped');

    const resWallet = await apiKeyService.validateApiKey(rawKey, Permission.WALLET_READ);
    expect(resWallet.id).toBe('key_scoped');

    await expect(apiKeyService.validateApiKey(rawKey, Permission.PENDING_MTN_MANAGE)).rejects.toThrow(
      'API key lacks required permission scope',
    );
  });

  it('should list agent API keys safely resolving candidate agent and user IDs', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM api_keys')) {
          return Promise.resolve({
            rows: [
              {
                id: 'key_1',
                name: 'Production Key',
                keyPrefix: 'ak_live_12345678',
                environment: ApiKeyEnvironment.LIVE,
                scopes: [Permission.ORDERS_CREATE],
                status: ApiKeyStatus.ACTIVE,
                lastUsedAt: new Date('2026-09-01T12:00:00.000Z'),
                expiresAt: null,
                createdAt: new Date('2026-08-01T12:00:00.000Z'),
              },
            ],
          });
        }
        if (q.includes('FROM agents')) {
          return Promise.resolve({
            rows: [{ id: 'agent-record-uuid', user_id: 'user-uuid-123' }],
          });
        }
        if (q.includes('FROM users')) {
          return Promise.resolve({
            rows: [{ id: 'user-uuid-123' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);
    const keys = await apiKeyService.listAgentApiKeys('user-uuid-123');

    expect(keys).toHaveLength(1);
    expect(keys[0].id).toBe('key_1');
    expect(keys[0].name).toBe('Production Key');
    expect(keys[0].keyPrefix).toBe('ak_live_12345678');
  });

  it('should return empty list gracefully when list query encounters unexpected error', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('FROM agents') || q.includes('FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('FROM api_keys')) {
          return Promise.reject(new Error('Relation does not exist'));
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);
    const keys = await apiKeyService.listAgentApiKeys('non-existent-agent');

    expect(keys).toEqual([]);
  });

  it('should roll an API key and return a newly generated key secret', async () => {
    let updatedPrefix = '';
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, name, environment, scopes')) {
          return Promise.resolve({
            rows: [
              {
                id: 'key_to_roll',
                name: 'Old Key',
                environment: ApiKeyEnvironment.LIVE,
                scopes: [Permission.ORDERS_CREATE],
                expires_at: null,
                status: ApiKeyStatus.ACTIVE,
              },
            ],
          });
        }
        if (q.includes('UPDATE api_keys')) {
          updatedPrefix = params[0] as string;
          return Promise.resolve({
            rows: [
              {
                id: 'key_to_roll',
                name: 'Old Key',
                keyPrefix: updatedPrefix,
                environment: ApiKeyEnvironment.LIVE,
                scopes: [Permission.ORDERS_CREATE],
                createdAt: new Date(),
                expiresAt: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);
    const rolled = await apiKeyService.rollApiKey('key_to_roll', 'agt_123');

    expect(rolled.id).toBe('key_to_roll');
    expect(rolled.rawApiKey.startsWith('ak_live_')).toBe(true);
    expect(rolled.keyPrefix.startsWith('ak_live_')).toBe(true);
    expect(updatedPrefix.startsWith('ak_live_')).toBe(true);
  });

  it('should revoke an API key without throwing', async () => {
    const executedQueries: string[] = [];
    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        executedQueries.push(q);
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);
    await expect(apiKeyService.revokeApiKey('key_to_revoke', 'agt_123')).resolves.not.toThrow();
    expect(executedQueries.some((q) => q.includes("status = 'REVOKED'"))).toBe(true);
  });
});
