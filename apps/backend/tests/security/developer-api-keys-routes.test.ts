import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { developerApiKeyRoutes } from '../../src/routes/auth/developer-api-key.routes.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { UserRole, SecurityDomain, ApiKeyEnvironment, ApiKeyStatus, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Developer API Key Routes (/developer/api-keys & /agent/api-keys)', () => {
  const setupApp = (mockKeys: any[] = [], shouldThrow = false) => {
    const app = Fastify();

    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('FROM users')) {
          return Promise.resolve({
            rows: [
              {
                id: 'user_agent_1',
                email: 'agent@bytebeacon.com',
                role: 'agent',
                status: 'ACTIVE',
              },
            ],
          });
        }
        if (q.includes('FROM agents')) {
          return Promise.resolve({
            rows: [{ id: 'agent_rec_1', user_id: 'user_agent_1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const mockApiKeyService = {
      listAgentApiKeys: vi.fn().mockImplementation(() => {
        if (shouldThrow) {
          return Promise.reject(new Error('Relation does not exist'));
        }
        return Promise.resolve(mockKeys);
      }),
      generateApiKey: vi.fn().mockResolvedValue({
        id: 'new_key_1',
        name: 'New Test Key',
        keyPrefix: 'ak_live_abcdefgh',
        rawApiKey: 'ak_live_abcdefghijklmnopqrstuvwxyz123456',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        createdAt: new Date(),
        expiresAt: null,
      }),
      rollApiKey: vi.fn().mockResolvedValue({
        id: 'rolled_key_1',
        name: 'Rolled Key',
        keyPrefix: 'ak_live_freshfresh',
        rawApiKey: 'ak_live_freshfresh1234567890abcdefghijkl',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        createdAt: new Date(),
        expiresAt: null,
      }),
      revokeApiKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApiKeyService;

    const mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'user_agent_1',
        email: 'agent@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.AGENT,
      }),
    } as unknown as TokenService;

    const mockRbacService = {
      hasPermission: vi.fn().mockResolvedValue(true),
    } as unknown as RbacService;

    const mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    developerApiKeyRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });

    return { app, mockApiKeyService };
  };

  it('GET /developer/api-keys should return 200 with formatted key items', async () => {
    const sampleKeys = [
      {
        id: 'key_abc',
        name: 'Production Server Key',
        keyPrefix: 'ak_live_11223344',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        status: ApiKeyStatus.ACTIVE,
        lastUsedAt: new Date('2026-09-10T10:00:00.000Z'),
        expiresAt: null,
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
      },
    ];

    const { app } = setupApp(sampleKeys);
    const res = await app.inject({
      method: 'GET',
      url: '/developer/api-keys',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('key_abc');
    expect(body.data[0].keyPrefix).toBe('ak_live_11223344');
    expect(body.data[0].lastUsedAt).toBe('2026-09-10T10:00:00.000Z');
  });

  it('GET /agent/api-keys alias should also return 200 with keys', async () => {
    const sampleKeys = [
      {
        id: 'key_xyz',
        name: 'Storefront Key',
        keyPrefix: 'ak_live_99887766',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        status: ApiKeyStatus.ACTIVE,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
      },
    ];

    const { app } = setupApp(sampleKeys);
    const res = await app.inject({
      method: 'GET',
      url: '/agent/api-keys',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data[0].id).toBe('key_xyz');
  });

  it('GET /developer/api-keys should return 200 with empty array on database error instead of 500 crash', async () => {
    const { app } = setupApp([], true);
    const res = await app.inject({
      method: 'GET',
      url: '/developer/api-keys',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('POST /developer/api-keys should create key and return 201', async () => {
    const { app } = setupApp();
    const res = await app.inject({
      method: 'POST',
      url: '/developer/api-keys',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
      payload: {
        name: 'New Integration Key',
        environment: 'LIVE',
        scopes: ['orders:create'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.apiKey).toBeDefined();
  });

  it('POST /developer/api-keys/:id/roll should roll secret and return 200', async () => {
    const { app } = setupApp();
    const res = await app.inject({
      method: 'POST',
      url: '/developer/api-keys/key_1/roll',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('rolled_key_1');
  });

  it('DELETE /developer/api-keys/:id should revoke key and return 200', async () => {
    const { app } = setupApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/developer/api-keys/key_1',
      headers: {
        authorization: 'Bearer valid-agent-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('revoked');
  });
});
