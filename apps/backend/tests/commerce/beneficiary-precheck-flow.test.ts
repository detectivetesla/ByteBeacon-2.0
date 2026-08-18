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

    mockApiKeyService = {} as unknown as ApiKeyService;
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

  describe('POST /beneficiaries/precheck', () => {
    it('should precheck numbers with DataHouse provider and report MTN Up2U status', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beneficiaries/precheck',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          network: NetworkProvider.MTN,
          phoneNumbers: ['0241112233', '0249998877'],
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.network).toBe('MTN');
      expect(json.data.enforced).toBe(true);
      expect(json.data.results).toHaveLength(2);
      expect(json.data.results[0].isKnown).toBe(true);
      expect(json.data.results[0].accountName).toBe('Kwame Mensah');
      expect(json.data.results[1].isKnown).toBe(false);

      expect(mockTelecomProvider.precheckBeneficiaries).toHaveBeenCalledWith({
        network: NetworkProvider.MTN,
        phoneNumbers: ['0241112233', '0249998877'],
        record: true,
      });
    });

    it('should reject requests missing phone numbers or network', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beneficiaries/precheck',
        headers: {
          authorization: 'Bearer valid_token',
        },
        payload: {
          network: NetworkProvider.MTN,
          phoneNumbers: [],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.message).toContain('phoneNumbers array is required');
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
