import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { BeneficiaryService } from '../../src/core/commerce/beneficiary.service.js';
import { beneficiaryRoutes } from '../../src/routes/commerce/beneficiary.routes.js';
import { ITelecomProvider } from '../../src/core/providers/telecom/telecom-provider.interface.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { NetworkProvider, UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Beneficiary Precheck & MTN Up2U Approval Flow Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTelecomProvider: ITelecomProvider;
  let beneficiaryService: BeneficiaryService;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes('FROM users')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', status: 'ACTIVE', role: 'admin' }],
          });
        }
        if (query.includes('SELECT COUNT(*) as total FROM beneficiary_validation')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }
        if (query.includes('FROM beneficiary_validation') && query.includes('SELECT id, phone_number')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ben_1',
                phoneNumber: '0249998877',
                network: 'MTN',
                status: 'PENDING',
                providerReference: 'dh_ref_99',
                validatedAt: null,
                expiresAt: null,
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }
        if (query.includes("UPDATE beneficiary_validation") && query.includes("'VALID'")) {
          return Promise.resolve({
            rows: [
              {
                id: 'ben_1',
                phoneNumber: '0249998877',
                network: 'MTN',
                status: 'VALID',
              },
            ],
          });
        }
        if (query.includes("UPDATE beneficiary_validation") && query.includes("'INVALID'")) {
          return Promise.resolve({
            rows: [
              {
                id: 'ben_1',
                phoneNumber: '0249998877',
                network: 'MTN',
                status: 'INVALID',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    mockTelecomProvider = {
      providerName: 'DATAHOUSE',
      precheckBeneficiaries: vi.fn().mockResolvedValue({
        network: NetworkProvider.MTN,
        enforced: true,
        results: [
          {
            phoneNumber: '0241112233',
            isValid: true,
            isKnown: true,
            accountName: 'Kwame Mensah',
          },
          {
            phoneNumber: '0249998877',
            isValid: true,
            isKnown: false,
            accountName: undefined,
          },
        ],
      }),
      precheckPublicBeneficiaries: vi.fn().mockResolvedValue({
        network: NetworkProvider.MTN,
        enforced: true,
        results: [
          {
            phoneNumber: '0241234567',
            phone: '0241234567',
            normalized: '0241234567',
            isValid: true,
            isKnown: true,
          },
          {
            phoneNumber: '0209990000',
            phone: '0209990000',
            normalized: '0209990000',
            isValid: true,
            isKnown: false,
          },
        ],
      }),
      validateBeneficiary: vi.fn(),
      submitOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      getWalletBalance: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      healthCheck: vi.fn(),
    };

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.ADMIN,
        domain: SecurityDomain.ADMIN,
        status: 'ACTIVE',
        sessionId: 'sess_admin_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateApiKey: vi.fn().mockImplementation((rawKey: string) => ({
        id: 'key_1',
        agentId: 'ag_1',
        isSandbox: rawKey.startsWith('ak_test_'),
        keyPrefix: rawKey.slice(0, 7),
        scopes: ['beneficiaries:read'],
        name: 'test_agent',
      })),
      verifyApiKey: vi.fn().mockReturnValue({
        id: 'key_1',
        agentId: 'ag_1',
        isSandbox: false,
        keyPrefix: 'ak_live',
        scopes: ['beneficiaries:read'],
      }),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    beneficiaryService = new BeneficiaryService(mockDb, mockTelecomProvider);

    app = Fastify();
    await app.register(beneficiaryRoutes, {
      db: mockDb,
      beneficiaryService,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });
  });

  describe('Public Endpoint: POST /orders/beneficiaries/precheck', () => {
    it('should allow public access without x-api-key or authorization and check MTN numbers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: ['0241234567', '0209990000'],
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(200);
      expect(json.message).toBe('Success');
      expect(json.data.network).toBe('MTN');
      expect(json.data.results).toHaveLength(2);
      expect(json.data.results[0]).toEqual({
        phone: '0241234567',
        normalized: '0241234567',
        valid: true,
        known: true,
      });
      expect(json.data.results[1]).toEqual({
        phone: '0209990000',
        normalized: '0209990000',
        valid: true,
        known: false,
      });
    });

    it('should always pass TELECEL numbers as known: true if valid Ghanaian MSISDN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/beneficiaries/precheck',
        payload: {
          network: 'TELECEL',
          phoneNumbers: ['0201234567', 'invalid_phone'],
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.network).toBe('TELECEL');
      expect(json.data.results[0]).toEqual({
        phone: '0201234567',
        normalized: '0201234567',
        valid: true,
        known: true,
      });
      expect(json.data.results[1]).toEqual({
        phone: 'invalid_phone',
        normalized: 'invalid_phone',
        valid: false,
        known: false,
      });
    });

    it('should reject requests exceeding 10 numbers or with numbers > 20 chars', async () => {
      const elevenNumbers = Array.from({ length: 11 }, (_, i) => `024100000${i}`);
      const resTooMany = await app.inject({
        method: 'POST',
        url: '/orders/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: elevenNumbers,
        },
      });

      expect(resTooMany.statusCode).toBe(400);

      const resTooLong = await app.inject({
        method: 'POST',
        url: '/orders/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: ['024123456789012345678901234567890'],
        },
      });

      expect(resTooLong.statusCode).toBe(400);
    });
  });

  describe('Agent Keyed Endpoint: POST /agent/beneficiaries/precheck', () => {
    it('should perform bulk-sized precheck with deduplication, summaries, and opt-in recording', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/beneficiaries/precheck',
        headers: {
          'x-api-key': 'ak_live_8f3c12345678',
        },
        payload: {
          network: 'MTN',
          phoneNumbers: ['0241112233', '0249998877', '0249998877'],
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(200);
      expect(json.message).toBe('Success');
      expect(json.data.network).toBe('MTN');
      expect(json.data.enforced).toBe(true);
      expect(json.data.sandbox).toBe(false);
      expect(json.data.recorded).toBe(true);
      expect(json.data.summary).toEqual({
        requested: 3,
        unique: 2,
        valid: 2,
        invalid: 0,
        known: 1,
        unknown: 1,
      });
      expect(json.data.unknown).toEqual(['0249998877']);
      expect(json.data.results).toHaveLength(2);
      expect(json.data.results[0]).toEqual({
        phone: '0241112233',
        normalized: '0241112233',
        valid: true,
        known: true,
      });
      expect(json.data.results[1]).toEqual({
        phone: '0249998877',
        normalized: '0249998877',
        valid: true,
        known: false,
      });
    });

    it('should short-circuit on sandbox keys: sandbox: true, enforced: false, recorded: false', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/beneficiaries/precheck',
        headers: {
          'x-api-key': 'ak_test_sandbox_secret_key',
        },
        payload: {
          network: 'MTN',
          phoneNumbers: ['0241112233', '0249998877'],
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.network).toBe('MTN');
      expect(json.data.sandbox).toBe(true);
      expect(json.data.enforced).toBe(false);
      expect(json.data.recorded).toBe(false);
      expect(json.data.reason).toBe('sandbox');
      expect(json.data.results.every((r: any) => r.known === true)).toBe(true);
    });

    it('should return enforced: false with reason non_mtn for TELECEL on agent precheck', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agent/beneficiaries/precheck',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          network: 'TELECEL',
          phoneNumbers: ['0201234567', '0207654321'],
          record: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.network).toBe('TELECEL');
      expect(json.data.enforced).toBe(false);
      expect(json.data.reason).toBe('non_mtn');
      expect(json.data.recorded).toBe(false);
      expect(json.data.summary.valid).toBe(2);
      expect(json.data.summary.known).toBe(2);
      expect(json.data.summary.unknown).toBe(0);
    });
  });

  describe('Admin MTN Approvals Workflow', () => {
    it('GET /admin/mtn-approvals should list pending approvals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/mtn-approvals?network=MTN&status=PENDING',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].phoneNumber).toBe('0249998877');
    });

    it('POST /admin/mtn-approvals/:id/approve should approve pending beneficiary and extend expiry by 30 days', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/mtn-approvals/ben_1/approve',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('VALID');
    });

    it('POST /admin/mtn-approvals/:id/reject should reject pending beneficiary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/mtn-approvals/ben_1/reject',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('INVALID');
    });
  });
});
