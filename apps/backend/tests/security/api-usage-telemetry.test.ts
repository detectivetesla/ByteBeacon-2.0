import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ApiUsageTelemetryService } from '../../src/core/security/api-usage-telemetry.service.js';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import type pg from 'pg';

describe('API Usage Telemetry Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let telemetryService: ApiUsageTelemetryService;
  let tokenService: TokenService;
  let apiKeyService: ApiKeyService;
  let rbacService: RbacService;
  let executedQueries: { sql: string; params: any[] }[] = [];

  const testAgentUserId = '11111111-1111-4111-8111-111111111111';
  const testAgentId = '22222222-2222-4222-8222-222222222222';
  const testKeyId = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    executedQueries = [];

    mockDb = {
      query: vi.fn().mockImplementation((query: string, params: any[] = []) => {
        executedQueries.push({ sql: query, params });
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM api_keys WHERE key_prefix = $1')) {
          if (params[0] === 'ak_live_testpref') {
            return Promise.resolve({
              rows: [{
                id: testKeyId,
                name: 'Agent Main Production Key',
                key_prefix: 'ak_live_testpref',
                agent_id: testAgentId,
                owner_user_id: testAgentUserId,
                environment: 'LIVE',
              }],
            });
          }
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: testAgentUserId, status: 'ACTIVE', role: 'agent' }],
          });
        }

        if (sql.includes('FROM agents WHERE user_id::text = $1 OR id::text = $1')) {
          return Promise.resolve({
            rows: [{ id: testAgentId, user_id: testAgentUserId }],
          });
        }

        if (sql.includes('SELECT id::text FROM api_keys')) {
          return Promise.resolve({
            rows: [{ id: testKeyId }],
          });
        }

        if (sql.includes('COUNT(*) as "totalCalls7d"')) {
          return Promise.resolve({
            rows: [{
              totalCalls7d: '5',
              liveCalls7d: '4',
              sandboxCalls7d: '1',
              successCount: '5',
              failureCount: '0',
              p95LatencyMs: '45.0',
              avgLatencyMs: '22.4',
            }],
          });
        }

        if (sql.includes('generate_series')) {
          return Promise.resolve({
            rows: [
              { date: '09-08', fullDate: '2026-09-08', successes: 0, failures: 0, total: 0, avgLatencyMs: 0 },
              { date: '09-09', fullDate: '2026-09-09', successes: 1, failures: 0, total: 1, avgLatencyMs: 15 },
              { date: '09-10', fullDate: '2026-09-10', successes: 0, failures: 0, total: 0, avgLatencyMs: 0 },
              { date: '09-11', fullDate: '2026-09-11', successes: 2, failures: 0, total: 2, avgLatencyMs: 20 },
              { date: '09-12', fullDate: '2026-09-12', successes: 0, failures: 0, total: 0, avgLatencyMs: 0 },
              { date: '09-13', fullDate: '2026-09-13', successes: 1, failures: 0, total: 1, avgLatencyMs: 25 },
              { date: '09-14', fullDate: '2026-09-14', successes: 1, failures: 0, total: 1, avgLatencyMs: 30 },
            ],
          });
        }

        if (sql.includes('GROUP BY m.method, m.endpoint')) {
          return Promise.resolve({
            rows: [
              { method: 'GET', path: '/api/v1/agent/orders', count: '3' },
              { method: 'POST', path: '/api/v1/orders', count: '2' },
            ],
          });
        }

        if (sql.includes('FROM api_keys k')) {
          return Promise.resolve({
            rows: [{
              id: testKeyId,
              name: 'Agent Main Production Key',
              keyPrefix: 'ak_live_testpref',
              environment: 'LIVE',
              status: 'ACTIVE',
              lastUsedAt: new Date().toISOString(),
              totalCalls: '5',
              successCount: '5',
              failureCount: '0',
              avgLatencyMs: '22',
            }],
          });
        }

        if (sql.includes('SELECT COUNT(*) as total FROM api_usage_metrics m')) {
          return Promise.resolve({
            rows: [{ total: '5' }],
          });
        }

        if (sql.includes('ROUND(m.response_time_ms) as "latencyMs"')) {
          return Promise.resolve({
            rows: [
              {
                id: 'metric-1',
                timestamp: new Date().toISOString(),
                mode: 'live',
                method: 'GET',
                path: '/api/v1/agent/orders',
                statusCode: 200,
                latencyMs: 15,
                ipAddress: '127.0.0.1',
                userAgent: 'ByteBeacon-Agent/2.0',
                keyId: testKeyId,
                keyName: 'Agent Main Production Key',
                keyPrefix: 'ak_live_testpref',
                requestHeaders: { 'content-type': 'application/json' },
                requestPayload: { bundleId: 'bundle-data-5gb' },
                responseHeaders: { 'content-type': 'application/json' },
                responsePayload: { success: true, orderId: 'ord-123' },
                errorCode: null,
                errorMessage: null,
              },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    telemetryService = new ApiUsageTelemetryService(mockDb);
    tokenService = new TokenService('test-secret-key-that-is-at-least-32-characters-long');
    apiKeyService = new ApiKeyService(mockDb);
    rbacService = new RbacService(mockDb);

    app = Fastify();
    app.setErrorHandler(errorHandler);

    // Register global onResponse telemetry hook
    app.addHook('onResponse', async (req, reply) => {
      await telemetryService.recordRequest(req, reply);
    });

    // Register agent routes
    await app.register(
      async (subApp) => {
        await agentRoutes(subApp, {
          db: mockDb,
          tokenService,
          apiKeyService,
          rbacService,
        });
      },
      { prefix: '/api/v1' },
    );
  });

  describe('ApiUsageTelemetryService Unit Methods', () => {
    it('validates UUIDs properly and filters invalid strings', () => {
      expect(telemetryService.safeUuid('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
      expect(telemetryService.safeUuid('key_ak_live_v15mjjPX')).toBeNull();
      expect(telemetryService.safeUuid('invalid-uuid')).toBeNull();
      expect(telemetryService.safeUuid(null)).toBeNull();
      expect(telemetryService.safeUuid(undefined)).toBeNull();
    });

    it('records metric with safe parameterization without throwing', async () => {
      await expect(
        telemetryService.recordMetric({
          keyId: testKeyId,
          keyPrefix: 'ak_live_testpref',
          keyName: 'Agent Main Production Key',
          userId: testAgentUserId,
          agentId: testAgentId,
          environment: 'LIVE',
          endpoint: '/api/v1/orders',
          method: 'POST',
          statusCode: 201,
          responseTimeMs: 85,
          ipAddress: '127.0.0.1',
          userAgent: 'ByteBeacon-Agent/2.0',
          requestHeaders: { 'content-type': 'application/json' },
          requestPayload: { bundleId: 'bundle-test', password: 'plain-secret-password' },
          responseHeaders: { 'x-correlation-id': 'req-123' },
          responsePayload: { success: true, token: 'secret-jwt-token' },
        }),
      ).resolves.not.toThrow();

      const insertQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO api_usage_metrics'));
      expect(insertQuery).toBeDefined();
      expect(insertQuery?.params[0]).toBe(testKeyId);
      expect(insertQuery?.params[1]).toBe('ak_live_testpref');
      expect(insertQuery?.params[2]).toBe('Agent Main Production Key');
      expect(insertQuery?.params[4]).toBe(testAgentUserId);
      expect(insertQuery?.params[5]).toBe(testAgentId);
      expect(insertQuery?.params[6]).toBe('LIVE');
      expect(insertQuery?.params[7]).toBe('/api/v1/orders');
      expect(insertQuery?.params[8]).toBe('POST');
      expect(insertQuery?.params[9]).toBe(201);
      expect(insertQuery?.params[10]).toBe(85);
      expect(insertQuery?.params[11]).toBe('127.0.0.1');
      expect(insertQuery?.params[12]).toBe('ByteBeacon-Agent/2.0');
    });
  });

  describe('GET /api/v1/agent/api-usage Route', () => {
    it('returns real aggregated metrics, apiKeysUsage attribution, and daily series for authenticated agent', async () => {
      const authToken = tokenService.signAccessToken({
        sub: testAgentUserId,
        email: 'agent@test.com',
        role: 'agent' as any,
        domain: 'COMMERCE' as any,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/api-usage',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);

      // Verify real aggregated data
      expect(json.data.overview.totalCalls7d).toBe(5);
      expect(json.data.overview.liveCalls7d).toBe(4);
      expect(json.data.overview.sandboxCalls7d).toBe(1);
      expect(json.data.overview.successRatePercent).toBe(100);
      expect(json.data.overview.failureRatePercent).toBe(0);
      expect(json.data.overview.avgLatencyMs).toBe(22);

      // Verify individual agent API key attribution
      expect(json.data.apiKeysUsage).toBeDefined();
      expect(json.data.apiKeysUsage).toHaveLength(1);
      expect(json.data.apiKeysUsage[0].id).toBe(testKeyId);
      expect(json.data.apiKeysUsage[0].name).toBe('Agent Main Production Key');
      expect(json.data.apiKeysUsage[0].keyPrefix).toBe('ak_live_testpref');
      expect(json.data.apiKeysUsage[0].totalCalls).toBe(5);
      expect(json.data.apiKeysUsage[0].successRatePercent).toBe(100);

      // Verify daily data
      expect(json.data.daily).toHaveLength(7);
      expect(json.data.daily[1].total).toBe(1);

      // Verify top endpoints
      expect(json.data.topEndpoints).toHaveLength(2);
      expect(json.data.topEndpoints[0].path).toBe('/api/v1/agent/orders');
      expect(json.data.topEndpoints[0].count).toBe(3);

      // Verify recent requests pagination and full inspection payloads
      expect(json.data.recentRequests.total).toBe(5);
      expect(json.data.recentRequests.items).toHaveLength(1);
      const item = json.data.recentRequests.items[0];
      expect(item.path).toBe('/api/v1/agent/orders');
      expect(item.latencyMs).toBe(15);
      expect(item.keyId).toBe(testKeyId);
      expect(item.keyName).toBe('Agent Main Production Key');
      expect(item.keyPrefix).toBe('ak_live_testpref');
      expect(item.ipAddress).toBe('127.0.0.1');
      expect(item.userAgent).toBe('ByteBeacon-Agent/2.0');
      expect(item.requestPayload).toEqual({ bundleId: 'bundle-data-5gb' });
      expect(item.responsePayload).toEqual({ success: true, orderId: 'ord-123' });
    });

    it('filters usage by specific keyId when provided', async () => {
      const authToken = tokenService.signAccessToken({
        sub: testAgentUserId,
        email: 'agent@test.com',
        role: 'agent' as any,
        domain: 'COMMERCE' as any,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agent/api-usage?keyId=${testKeyId}&mode=live`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.recentRequests.items).toHaveLength(1);
    });

    it('returns accurate clean zero state when database has 0 records', async () => {
      // Configure mock to return 0 for everything
      mockDb.query = vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: testAgentUserId, status: 'ACTIVE', role: 'agent' }],
          });
        }
        if (sql.includes('COUNT(*) as "totalCalls7d"')) {
          return Promise.resolve({
            rows: [{
              totalCalls7d: '0',
              liveCalls7d: '0',
              sandboxCalls7d: '0',
              successCount: '0',
              failureCount: '0',
              p95LatencyMs: null,
              avgLatencyMs: null,
            }],
          });
        }
        if (sql.includes('generate_series')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT COUNT(*) as total FROM api_usage_metrics')) {
          return Promise.resolve({ rows: [{ total: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const authToken = tokenService.signAccessToken({
        sub: testAgentUserId,
        email: 'agent@test.com',
        role: 'agent' as any,
        domain: 'COMMERCE' as any,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/api-usage',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.overview.totalCalls7d).toBe(0);
      expect(json.data.overview.liveCalls7d).toBe(0);
      expect(json.data.overview.sandboxCalls7d).toBe(0);
      expect(json.data.overview.successRatePercent).toBe(100);
      expect(json.data.overview.failureRatePercent).toBe(0);
      expect(json.data.overview.avgLatencyMs).toBe(0);
      expect(json.data.overview.p95LatencyMs).toBe(0);

      // Verify 7 empty days generated
      expect(json.data.daily).toHaveLength(7);
      expect(json.data.daily.every((d: any) => d.total === 0)).toBe(true);

      // Verify 0 recent requests and 1 total page
      expect(json.data.recentRequests.total).toBe(0);
      expect(json.data.recentRequests.items).toHaveLength(0);
      expect(json.data.recentRequests.totalPages).toBe(1);
    });
  });
});
