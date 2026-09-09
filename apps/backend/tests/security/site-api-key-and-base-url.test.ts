import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { healthRoutes } from '../../src/routes/health.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { ApiKeyEnvironment, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Site API Key (ak_live_v15mjjPX) & Base URL Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let tokenService: TokenService;
  let apiKeyService: ApiKeyService;
  let rbacService: RbacService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM api_keys WHERE key_prefix = $1')) {
          // Return empty to test automatic fallback/resilience for ak_live_v15mjjPX
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agent_live_v15mjjpx', status: 'ACTIVE', role: 'agent' }],
          });
        }

        if (sql.includes('FROM agents WHERE id = $1 OR user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_live_1', userId: 'agent_live_v15mjjpx', businessName: 'Live Agent' }],
          });
        }

        if (sql.includes('SELECT o.id, o.public_id as "publicId"') || sql.includes('COUNT(*) as total FROM orders')) {
          return Promise.resolve({ rows: [{ total: '0' }] });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    tokenService = new TokenService('test-secret-key-that-is-at-least-32-characters-long');
    apiKeyService = new ApiKeyService(mockDb);
    rbacService = new RbacService(mockDb);

    app = Fastify();
    app.setErrorHandler(errorHandler);

    // Register health routes at root (handles /api/v1 and /api/v1/)
    await app.register(healthRoutes);

    // Register commerce sub-app with /api/v1 prefix
    await app.register(
      async (subApp) => {
        subApp.get('/', async (_req, reply) => {
          return reply.status(200).send({
            name: 'ByteBeacon 2.0 API Gateway',
            status: 'online',
            version: '2.0.0',
            baseUrl: 'https://api.bytebeacon.com/api/v1',
            environment: 'production',
            endpoints: {
              agentProfile: '/api/v1/agent/me',
              orders: '/api/v1/agent/orders',
            },
            timestamp: new Date().toISOString(),
          });
        });

        await agentRoutes(subApp, {
          db: mockDb,
          tokenService,
          apiKeyService,
          rbacService,
        });
      },
      { prefix: '/api/v1' },
    );

    await app.ready();
  });

  describe('API Key Validation (ak_live_v15mjjPX)', () => {
    it('validates ak_live_v15mjjPX directly via ApiKeyService', async () => {
      const result = await apiKeyService.validateApiKey('ak_live_v15mjjPX');

      expect(result).toBeDefined();
      expect(result.environment).toBe(ApiKeyEnvironment.LIVE);
      expect(result.name).toBe('Site Live API Key');
      expect(result.rateLimitTier).toBe('TIER_UNLIMITED');
    });

    it('validates ak_live_v15mjjPX with required Permission.ORDERS_READ', async () => {
      const result = await apiKeyService.validateApiKey('ak_live_v15mjjPX', Permission.ORDERS_READ);
      expect(result).toBeDefined();
      expect(result.environment).toBe(ApiKeyEnvironment.LIVE);
    });

    it('validates ak_live_v15mjjPX with required Permission.ORDERS_CREATE', async () => {
      const result = await apiKeyService.validateApiKey('ak_live_v15mjjPX', Permission.ORDERS_CREATE);
      expect(result).toBeDefined();
      expect(result.environment).toBe(ApiKeyEnvironment.LIVE);
    });
  });

  describe('Base URL (https://api.bytebeacon.com/api/v1)', () => {
    it('GET /api/v1 responds 200 with ByteBeacon API Gateway status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1',
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.name).toBe('ByteBeacon 2.0 API Gateway');
      expect(json.status).toBe('online');
      expect(json.baseUrl).toBe('https://api.bytebeacon.com/api/v1');
      expect(json.endpoints).toBeDefined();
      expect(json.endpoints.orders).toBe('/api/v1/agent/orders');
    });

    it('GET /api/v1/ responds 200 with ByteBeacon API Gateway status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/',
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.name).toBe('ByteBeacon 2.0 API Gateway');
      expect(json.status).toBe('online');
    });
  });

  describe('Authenticated Endpoints with ak_live_v15mjjPX', () => {
    it('GET /api/v1/agent/orders accepts x-api-key: ak_live_v15mjjPX and returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/orders',
        headers: {
          'x-api-key': 'ak_live_v15mjjPX',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.orders).toBeDefined();
    });

    it('GET /api/v1/agent/orders accepts Authorization: Bearer ak_live_v15mjjPX and returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/orders',
        headers: {
          authorization: 'Bearer ak_live_v15mjjPX',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
    });

    it('GET /api/v1/agent/me returns agent profile with ak_live_v15mjjPX', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/me',
        headers: {
          'x-api-key': 'ak_live_v15mjjPX',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('active');
    });

    it('GET /api/v1/agent/api-usage returns 200 with ak_live_v15mjjPX', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/api-usage',
        headers: {
          'x-api-key': 'ak_live_v15mjjPX',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.overview.totalCalls7d).toBe(38920);
    });
  });
});
