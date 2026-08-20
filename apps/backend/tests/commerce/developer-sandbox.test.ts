import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { developerSandboxRoutes } from '../../src/routes/commerce/developer-sandbox.routes.js';
import { registerSwagger } from '../../src/plugins/swagger.plugin.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { UserRole, SecurityDomain, ApiKeyEnvironment, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('OpenAPI Specification & Developer Sandbox Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('FROM users WHERE id = $1') || sql.includes('FROM users WHERE uuid = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_agent_1', uuid: 'usr_agent_1', status: 'ACTIVE', role: 'agent' }],
          });
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_dev_1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_dev_1',
        email: 'developer@bytebeacon.com',
        role: UserRole.AGENT,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_dev_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      listAgentApiKeys: vi.fn().mockResolvedValue([
        {
          id: 'key_1',
          name: 'Staging Integration Key',
          keyPrefix: 'ak_test_abcd1234',
          environment: ApiKeyEnvironment.TEST,
          scopes: [Permission.ORDERS_CREATE, Permission.ORDERS_READ],
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
      ]),
      generateApiKey: vi.fn().mockResolvedValue({
        id: 'key_new_1',
        name: 'Production Key',
        keyPrefix: 'ak_live_xyz98765',
        rawApiKey: 'ak_live_xyz9876543210abcdefghijklmnop',
        environment: ApiKeyEnvironment.LIVE,
        scopes: [Permission.ORDERS_CREATE],
        createdAt: new Date().toISOString(),
        expiresAt: null,
      }),
      revokeApiKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    app = Fastify();
    await registerSwagger(app);
    await app.register(developerSandboxRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });
  });

  describe('OpenAPI 3.1 Specification Endpoints', () => {
    it('GET /api/v1/openapi.json should return valid OpenAPI 3.1 schema', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/openapi.json',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.openapi).toBe('3.1.0');
      expect(json.info.title).toBe('ByteBeacon 2.0 API');
      expect(json.components.securitySchemes.BearerAuth).toBeDefined();
      expect(json.components.securitySchemes.ApiKeyAuth).toBeDefined();
    });
  });

  describe('Developer API Key Management', () => {
    it('GET /developer/keys should list developer API keys', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/developer/keys',
        headers: {
          authorization: 'Bearer valid_dev_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].environment).toBe('TEST');
    });

    it('POST /developer/keys should generate a new API key with raw key output', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/developer/keys',
        headers: {
          authorization: 'Bearer valid_dev_token',
        },
        payload: {
          name: 'Production Key',
          environment: 'LIVE',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.rawApiKey).toContain('ak_live_');
    });

    it('DELETE /developer/keys/:id should revoke API key', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/developer/keys/key_1',
        headers: {
          authorization: 'Bearer valid_dev_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('key_1', 'agt_dev_1');
    });
  });

  describe('Developer Sandbox Mock Carrier Gateway', () => {
    it('POST /developer/sandbox/simulate-fulfillment should simulate instant telecom fulfillment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/developer/sandbox/simulate-fulfillment',
        headers: {
          authorization: 'Bearer valid_dev_token',
        },
        payload: {
          recipientPhone: '0240001122',
          network: 'MTN',
          dataAmountMb: 5120,
          simulateStatus: 'COMPLETED',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.orderStatus).toBe('COMPLETED');
      expect(json.data.isSandbox).toBe(true);
      expect(json.data.providerReference).toBeDefined();
    });
  });
});
