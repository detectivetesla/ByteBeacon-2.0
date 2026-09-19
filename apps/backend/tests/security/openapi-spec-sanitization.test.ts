import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerSwagger } from '../../src/plugins/swagger.plugin.js';
import { createAuthHooks } from '../../src/plugins/auth.plugin.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { errorHandler } from '../../src/core/errors/app-error.js';
import { Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Public OpenAPI Specification Sanitization & Security Hardening', () => {
  let app: FastifyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'production';
    app = Fastify();
    await registerSwagger(app);
    await app.ready();
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    await app.close();
  });

  describe('OpenAPI Document Sanitization (/api/v1/openapi.json)', () => {
    it('returns 200 with sanitized specification', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/openapi.json',
      });

      expect(res.statusCode).toBe(200);
      const spec = JSON.parse(res.body);

      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('ByteBeacon 2.0 Developer API');
    });

    it('does NOT contain live-looking API keys in ApiKeyAuth scheme', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const spec = JSON.parse(res.body);
      const apiKeyDesc = spec.components?.securitySchemes?.ApiKeyAuth?.description || '';

      expect(apiKeyDesc).not.toContain('ak_live_G8xX');
      expect(apiKeyDesc).toContain('ak_live_REDACTED_EXAMPLE');
      expect(apiKeyDesc).toContain('ak_test_XXXXXXXXXXXXXXXX');
    });

    it('does NOT document or permit ?api_key= query parameter', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const spec = JSON.parse(res.body);
      const apiKeyDesc = spec.components?.securitySchemes?.ApiKeyAuth?.description || '';

      expect(apiKeyDesc).not.toContain('?api_key=');
      expect(apiKeyDesc).toContain('Do not pass API keys in URL query parameters');
    });

    it('does NOT expose localhost in production server list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const spec = JSON.parse(res.body);
      const servers = spec.servers || [];

      const urls = servers.map((s: any) => s.url);
      expect(urls).toContain('https://api.bytebeacon.online');
      expect(urls).toContain('https://bytebeacon-2-0.onrender.com');
      expect(urls).not.toContain('http://localhost:3000');
    });

    it('does NOT expose internal or destructive approval endpoints', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const spec = JSON.parse(res.body);
      const paths = spec.paths || {};

      expect(paths['/api/v1/beneficiaries/approvals']).toBeUndefined();
      expect(paths['/api/v1/beneficiaries/approvals/{id}']).toBeUndefined();
      expect(paths['/api/v1/beneficiaries/pending-count']).toBeUndefined();

      const tags = (spec.tags || []).map((t: any) => t.name);
      expect(tags).not.toContain('Pending Approvals');
    });

    it('does NOT leak internal implementation details in descriptions', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const body = res.body;

      expect(body).not.toContain('Redis validation cache');
      expect(body).not.toContain('500-1,000 rows per second');
      expect(body).not.toContain('upstream telecom pipe');
      expect(body).not.toContain('wallet float balance');
    });

    it('uses synthetic phone numbers (0240000000, +233240000000)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const body = res.body;

      expect(body).not.toContain('0241112233');
      expect(body).not.toContain('+233241112233');
      expect(body).toContain('0240000000');
    });

    it('documents webhooks under /api/v1/agent/webhooks without user secret', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
      const spec = JSON.parse(res.body);

      expect(spec.paths['/api/v1/agent/webhooks']).toBeDefined();
      expect(spec.paths['/api/v1/webhooks']).toBeUndefined();

      const postSchema =
        spec.paths['/api/v1/agent/webhooks']?.post?.requestBody?.content?.['application/json']?.schema;
      expect(postSchema?.properties?.url).toBeDefined();
      expect(postSchema?.properties?.events).toBeDefined();
      // Server generates the secret; user cannot supply plaintext secret
      expect(postSchema?.properties?.secret).toBeUndefined();
    });
  });

  describe('Query parameter authentication rejection in middleware', () => {
    let authApp: FastifyInstance;
    let authHooks: ReturnType<typeof createAuthHooks>;

    beforeEach(async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((query: string) => {
          if (query.includes('FROM api_keys WHERE key_prefix = $1')) {
            return Promise.resolve({ rows: [] });
          }
          if (query.includes('FROM users WHERE id = $1')) {
            return Promise.resolve({ rows: [{ id: 'u1', status: 'ACTIVE', role: 'agent' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as pg.Pool;

      const tokenService = new TokenService('secret-key-that-is-at-least-32-characters-long');
      const apiKeyService = new ApiKeyService(mockDb);
      const rbacService = new RbacService(mockDb);
      authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, mockDb);

      authApp = Fastify();
      authApp.setErrorHandler(errorHandler);

      authApp.get('/test-secured', { preHandler: [authHooks.authenticate(Permission.ORDERS_READ)] }, async (req) => {
        return { success: true, user: req.user?.sub };
      });

      authApp.get('/test-api-key-only', { preHandler: [authHooks.authenticateApiKey(Permission.ORDERS_READ)] }, async () => {
        return { success: true };
      });

      await authApp.ready();
    });

    afterEach(async () => {
      await authApp.close();
    });

    it('rejects API keys passed via ?api_key= query parameter with 401', async () => {
      const res = await authApp.inject({
        method: 'GET',
        url: '/test-secured?api_key=ak_live_v15mjjPX',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects query parameters on API-key protected endpoints with missing header message', async () => {
      const res = await authApp.inject({
        method: 'GET',
        url: '/test-api-key-only?api_key=ak_live_v15mjjPX',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error?.message || body.message).toContain('API key missing from request headers');
    });

    it('accepts API keys passed via x-api-key header', async () => {
      const res = await authApp.inject({
        method: 'GET',
        url: '/test-secured',
        headers: {
          'x-api-key': 'ak_live_v15mjjPX',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });
  });
});
