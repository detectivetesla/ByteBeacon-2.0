import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminApiManagementRoutes } from '../../src/routes/commerce/admin-api-management.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { UserRole, SecurityDomain, ApiKeyEnvironment, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.10: API Management, Developer Platform & API Security', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockClient: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;

  beforeEach(async () => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };

    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
          return {
            rows: [
              {
                id: 'admin_1',
                uuid: 'admin_1',
                email: 'admin@bytebeacon.com',
                full_name: 'Admin User',
                status: 'ACTIVE',
                role: UserRole.SUPER_ADMIN,
              },
            ],
          };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
      requirePermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    app = Fastify();
    await adminApiManagementRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });
    await app.ready();
  });

  // 1. Overview & Health
  it('GET /admin/api/overview returns KPI counters and service health table', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/overview',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('totalKeys');
    expect(body.data).toHaveProperty('activeKeys');
    expect(body.data).toHaveProperty('p95LatencyMs');
    expect(Array.isArray(body.data.servicesHealth)).toBe(true);
    expect(body.data.servicesHealth.length).toBeGreaterThan(0);
  });

  // 2. Key List Search
  it('GET /admin/api/keys returns paginated key items and masks hash secrets', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as total FROM api_keys')) {
        return { rows: [{ total: '1' }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT') && sql.includes('FROM api_keys')) {
        return {
          rows: [
            {
              id: 'key_1',
              name: 'Reseller Production Key',
              keyPrefix: 'bb_live_a1b2c3d4',
              ownerId: 'usr_1',
              ownerName: 'Yaw Telecom',
              ownerEmail: 'yaw@telecom.gh',
              ownerRole: 'agent',
              environment: 'LIVE',
              status: 'ACTIVE',
              scopes: ['orders.create', 'orders.read'],
              rateLimitPerMinute: 300,
              ipRestrictions: [],
              requestCount: 1540,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/keys?search=Reseller&environment=LIVE',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].keyPrefix).toBe('bb_live_a1b2c3d4');
    expect(body.data.items[0]).not.toHaveProperty('key_hash');
    expect(body.data.items[0]).not.toHaveProperty('rawApiKey');
  });

  // 3. Key Detail Dossier
  it('GET /admin/api/keys/:id returns full key metadata dossier', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM api_keys') && sql.includes('WHERE ak.id = $1')) {
        return {
          rows: [
            {
              id: 'key_1',
              name: 'Reseller Production Key',
              keyPrefix: 'bb_live_a1b2c3d4',
              ownerId: 'usr_1',
              ownerName: 'Yaw Telecom',
              ownerEmail: 'yaw@telecom.gh',
              ownerRole: 'agent',
              environment: 'LIVE',
              status: 'ACTIVE',
              scopes: ['orders.create', 'orders.read'],
              rateLimitPerMinute: 300,
              ipRestrictions: [],
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/keys/key_1',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('key_1');
    expect(body.data.name).toBe('Reseller Production Key');
  });

  // 4. Create Key
  it('POST /admin/api/keys generates an API key, returns raw key once, and writes audit log', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', full_name: 'Admin', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO api_keys')) {
        return {
          rows: [
            {
              id: 'key_new_1',
              name: 'Billing Bot',
              keyPrefix: 'bb_live_12345678',
              environment: 'LIVE',
              scopes: [Permission.ORDERS_CREATE],
              createdAt: new Date().toISOString(),
              expiresAt: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/keys',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: {
        name: 'Billing Bot',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        rateLimitPerMinute: 300,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('rawApiKey');
    expect(body.data.rawApiKey).toMatch(/^bb_live_/);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_API_KEY_CREATED' }),
    );
  });

  // 5. Rotate Key
  it('POST /admin/api/keys/:id/rotate rotates key, grants grace period, and returns replacement key', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM api_keys WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'key_old_1',
              agent_id: 'usr_1',
              owner_user_id: 'usr_1',
              name: 'Integration Key',
              environment: 'LIVE',
              scopes: ['orders.create'],
              rate_limit_per_minute: 300,
            },
          ],
        };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO api_keys')) {
        return {
          rows: [
            {
              id: 'key_new_2',
              name: 'Integration Key (Rotated)',
              keyPrefix: 'bb_live_87654321',
              environment: 'LIVE',
              scopes: ['orders.create'],
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/keys/key_old_1/rotate',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: {
        reason: 'Scheduled quarterly key rotation',
        expiresOldInHours: 24,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('rawApiKey');
    expect(body.data.newKeyId).toBe('key_new_2');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_API_KEY_ROTATED' }),
    );
  });

  // 6. Revoke Key
  it('POST /admin/api/keys/:id/revoke invalidates key with mandatory reason', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE api_keys') && sql.includes('REVOKED')) {
        return {
          rows: [{ id: 'key_1', name: 'Leaked Key', keyPrefix: 'bb_live_leaked' }],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/keys/key_1/revoke',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: { reason: 'Suspected credential leak on public github' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_API_KEY_REVOKED' }),
    );
  });

  // 7. Usage Analytics
  it('GET /admin/api/usage returns traffic analytics and latency percentiles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/usage?timeRange=30d',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('totalRequests');
    expect(body.data).toHaveProperty('p50LatencyMs');
    expect(body.data).toHaveProperty('p95LatencyMs');
    expect(body.data).toHaveProperty('topEndpoints');
  });

  // 8. Security Events Stream
  it('GET /admin/api/security returns security violations stream', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*) as total FROM api_security_events')) {
        return { rows: [{ total: '1' }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM api_security_events')) {
        return {
          rows: [
            {
              id: 'sec_1',
              keyId: 'key_1',
              keyPrefix: 'bb_live_a1b2',
              userId: 'usr_1',
              userName: 'Agent 1',
              eventType: 'RATE_LIMIT_EXCEEDED',
              severity: 'MEDIUM',
              ipAddress: '102.176.45.12',
              endpoint: '/api/v1/orders',
              details: { threshold: 300, current: 340 },
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/security',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].eventType).toBe('RATE_LIMIT_EXCEEDED');
  });

  // 9. Webhooks Registry & Test Ping
  it('POST /admin/api/webhooks registers webhook and returns one-time signing secret', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO agent_webhooks')) {
        return {
          rows: [
            {
              id: 'wh_1',
              url: 'https://api.partner.com/webhook',
              events: ['order.completed'],
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/webhooks',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: {
        agentId: 'usr_1',
        url: 'https://api.partner.com/webhook',
        events: ['order.completed'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('signingSecret');
    expect(body.data.signingSecret).toMatch(/^bb_whsec_/);
  });

  it('POST /admin/api/webhooks/:id/test triggers simulated webhook event', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM agent_webhooks WHERE id = $1')) {
        return {
          rows: [{ id: 'wh_1', url: 'https://api.partner.com/webhook', status: 'ACTIVE' }],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/webhooks/wh_1/test',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  // 10. Telecom Provider Connections & Authoritative Switching
  it('GET /admin/api/providers returns provider connections list', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM telecom_provider_configs')) {
        return {
          rows: [
            {
              id: 'p_1',
              providerName: 'DataHouse',
              slug: 'datahouse',
              isAuthoritative: true,
              environment: 'LIVE',
              status: 'HEALTHY',
              priority: 1,
              capabilities: ['MTN', 'TELECEL'],
              apiBaseUrl: 'https://api.datahouse.com.gh/v1',
              authType: 'BEARER',
            },
            {
              id: 'p_2',
              providerName: 'GMPL',
              slug: 'gmpl',
              isAuthoritative: false,
              environment: 'LIVE',
              status: 'HEALTHY',
              priority: 2,
              capabilities: ['MTN', 'TELECEL'],
              apiBaseUrl: 'https://api.gmpl.com.gh/v2',
              authType: 'BEARER',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/providers',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].providerName).toBe('DataHouse');
    expect(body.data[0].isAuthoritative).toBe(true);
  });

  it('POST /admin/api/providers/switch executes authoritative telecom provider switch', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM telecom_provider_configs WHERE provider_name = $1')) {
        return {
          rows: [{ id: 'p_2', provider_name: 'GMPL', is_authoritative: false, status: 'HEALTHY', api_base_url: 'https://api.gmpl.com.gh', capabilities: ['MTN'] }],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM telecom_provider_configs WHERE is_authoritative = TRUE')) {
        return {
          rows: [{ provider_name: 'DataHouse' }],
        };
      }
      return { rows: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/providers/switch',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: {
        newProvider: 'GMPL',
        reason: 'DataHouse carrier maintenance scheduled failover',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.currentAuthoritativeProvider).toBe('GMPL');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_AUTHORITATIVE_PROVIDER_SWITCHED' }),
    );
  });

  // 11. API Policies & Emergency Kill Switches
  it('GET and PUT /admin/api/policies retrieves and updates global rate limits and emergency kill switches', async () => {
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE uuid = $1')) {
        return {
          rows: [{ id: 'admin_1', uuid: 'admin_1', email: 'admin@bytebeacon.com', status: 'ACTIVE', role: UserRole.SUPER_ADMIN }],
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM api_policy_controls')) {
        return {
          rows: [
            {
              id: 'GLOBAL',
              customer_rate_limit_per_min: 120,
              agent_rate_limit_per_min: 300,
              admin_rate_limit_per_min: 600,
              agent_api_disabled: false,
              sandbox_api_disabled: false,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/admin/api/policies',
      headers: { authorization: 'Bearer mock_admin_token' },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.data.agentRateLimitPerMin).toBe(300);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/admin/api/policies',
      headers: { authorization: 'Bearer mock_admin_token' },
      payload: {
        policies: {
          agentRateLimitPerMin: 400,
          agentApiDisabled: true,
        },
        reason: 'Mitigating distributed brute force attack on agent gateway',
      },
    });

    expect(putRes.statusCode).toBe(200);
    const putBody = JSON.parse(putRes.payload);
    expect(putBody.success).toBe(true);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPER_ADMIN_API_POLICY_UPDATED' }),
    );
  });
});
