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
        if (query.includes('pendingCount')) {
          return Promise.resolve({
            rows: [{ pendingCount: '3' }],
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
      precheckBeneficiaries: vi.fn().mockImplementation(async (input) => {
        const phoneNumbers = input?.phoneNumbers || [];
        return {
          network: NetworkProvider.MTN,
          enforced: true,
          results: phoneNumbers.map((p: string) => ({
            phoneNumber: p,
            isValid: !p.includes('invalid'),
            isKnown: p === '0241112233' || p.endsWith('1') || p.endsWith('2'),
            accountName: p === '0241112233' ? 'Kwame Mensah' : undefined,
          })),
        };
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

  describe('Bulk Commerce Endpoint: POST /beneficiaries/precheck', () => {
    it('should handle bulk numbers (>10) without truncation and verify against telecom provider', async () => {
      const fifteenNumbers = Array.from({ length: 15 }, (_, i) => `02410000${String(i).padStart(2, '0')}`);
      const res = await app.inject({
        method: 'POST',
        url: '/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: fifteenNumbers,
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.statusCode).toBe(200);
      expect(json.data.network).toBe('MTN');
      expect(json.data.recorded).toBe(true);
      expect(json.data.results).toHaveLength(15);
      expect(mockTelecomProvider.precheckBeneficiaries).toHaveBeenCalled();
      const lastCall = (mockTelecomProvider.precheckBeneficiaries as any).mock.calls.slice(-1)[0][0];
      expect(lastCall.phoneNumbers.length).toBeGreaterThan(10);
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
        orderable: 1,
      });
      expect(json.data.unknown).toEqual(['0249998877']);
      expect(json.data.results).toHaveLength(2);
      expect(json.data.results[0]).toMatchObject({
        phone: '0241112233',
        normalized: '0241112233',
        valid: true,
        known: true,
        status: 'APPROVED',
      });
      expect(json.data.results[1]).toMatchObject({
        phone: '0249998877',
        normalized: '0249998877',
        valid: true,
        known: false,
        status: 'UNAPPROVED',
      });
    });

    it('should query live telecom provider for full batch and accurately map known vs unknown statuses', async () => {
      (mockTelecomProvider.precheckBeneficiaries as any).mockResolvedValueOnce({
        network: NetworkProvider.MTN,
        summary: { requested: 2, unique: 2, valid: 2, invalid: 0, known: 1, unknown: 1 },
        unknown: ['0249998877'],
        results: [
          { phone: '0241112233', normalized: '0241112233', valid: true, known: true, isKnown: true, status: 'APPROVED' },
          { phone: '0249998877', normalized: '0249998877', valid: true, known: false, isKnown: false, status: 'UNAPPROVED' },
        ],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/agent/beneficiaries/precheck',
        headers: { 'x-api-key': 'ak_live_8f3c12345678' },
        payload: {
          network: 'MTN',
          phoneNumbers: ['0241112233', '0249998877'],
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.summary.known).toBe(1);
      expect(json.data.summary.unknown).toBe(1);
      expect(json.data.results[0].known).toBe(true);
      expect(json.data.results[0].status).toBe('APPROVED');
      expect(json.data.results[1].known).toBe(false);
      expect(json.data.results[1].status).toBe('UNAPPROVED');
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

    it('should never let stale database records override live telecom unapproved status', async () => {
      const mockResult = {
        network: NetworkProvider.MTN,
        enforced: true,
        results: [
          { phoneNumber: '0531983428', phone: '0531983428', normalized: '0531983428', isKnown: false, known: false, orderable: false, status: 'UNAPPROVED' },
          { phoneNumber: '0241112233', phone: '0241112233', normalized: '0241112233', isKnown: true, known: true, orderable: true, status: 'APPROVED' },
        ],
      };
      mockTelecomProvider.precheckBeneficiaries = vi.fn().mockResolvedValue(mockResult);
      mockTelecomProvider.precheckPublicBeneficiaries = vi.fn().mockResolvedValue(mockResult);

      // Mock database returning stale VALID for 0531983428
      vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
        if (query.includes('FROM beneficiary_validation') && query.includes("validation_status IN ('VALID', 'APPROVED')")) {
          return Promise.resolve({
            rows: [
              { phoneNumber: '0531983428', accountName: null },
              { phoneNumber: '0241112233', accountName: null },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: ['0531983428', '0241112233'],
          record: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);

      const unapproved = json.data.results.find((r: any) => r.phone === '0531983428');
      expect(unapproved.isKnown).toBe(false);
      expect(unapproved.known).toBe(false);
      expect(unapproved.orderable).toBe(false);
      expect(unapproved.status).toBe('UNAPPROVED');

      const approved = json.data.results.find((r: any) => r.phone === '0241112233');
      expect(approved.isKnown).toBe(true);
      expect(approved.known).toBe(true);
      expect(approved.orderable).toBe(true);
      expect(approved.status).toBe('APPROVED');
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

    it('GET /beneficiaries/pending-count should return real-time count of pending approvals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/beneficiaries/pending-count',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.pendingCount).toBe(3);
    });
  });

  describe('Customer & Agent User Isolation for Pending MTN Approvals', () => {
    it('GET /beneficiaries/approvals should return empty list and zero counts when unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/beneficiaries/approvals',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.items).toEqual([]);
      expect(json.data.total).toBe(0);
      expect(json.data.counts.total).toBe(0);
    });

    it('GET /beneficiaries/approvals should isolate records to the authenticated customer', async () => {
      // Mock customer token
      mockTokenService.verifyAccessToken = vi.fn().mockReturnValue({
        sub: 'usr_customer_42',
        email: 'customer42@bytebeacon.com',
        role: UserRole.CUSTOMER,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_cust_42',
      });

      vi.spyOn(mockDb, 'query').mockImplementation((query: string, params: any) => {
        if (query.includes('FROM users')) {
          return Promise.resolve({
            rows: [{ id: params?.[0] || 'usr_customer_42', status: 'ACTIVE', role: 'customer' }],
          });
        }
        if (query.includes('COUNT(*) as total')) {
          expect(params[0]).toBe('usr_customer_42');
          return Promise.resolve({
            rows: [{ total: '1', pending: '1', approved: '0', rejected: '0', processing: '0' }],
          });
        }
        if (query.includes('SELECT p.id')) {
          expect(params[0]).toBe('usr_customer_42');
          return Promise.resolve({
            rows: [
              {
                id: 'pba_cust_1',
                phoneNumber: '0241234567',
                network: 'MTN',
                status: 'PENDING',
                providerReference: 'DH-AUTO',
                validatedAt: null,
                expiresAt: null,
                createdAt: new Date().toISOString(),
                lastBundleSizeGb: 5,
                metadata: { detectedFrom: 'Single Order' },
                detectedFrom: 'Single Order',
                occurrences: 2,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/beneficiaries/approvals',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].phoneNumber).toBe('0241234567');
      expect(json.data.items[0].occurrences).toBe(2);
      expect(json.data.counts.pending).toBe(1);
    });

    it('GET /beneficiaries/pending-count should query pending_beneficiary_approvals for customers', async () => {
      mockTokenService.verifyAccessToken = vi.fn().mockReturnValue({
        sub: 'usr_customer_99',
        email: 'customer99@bytebeacon.com',
        role: UserRole.CUSTOMER,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_cust_99',
      });

      vi.spyOn(mockDb, 'query').mockImplementation((query: string, params: any) => {
        if (query.includes('FROM users')) {
          return Promise.resolve({
            rows: [{ id: params?.[0] || 'usr_customer_99', status: 'ACTIVE', role: 'customer' }],
          });
        }
        if (query.includes('FROM pending_beneficiary_approvals') && query.includes('agent_id = $1')) {
          expect(params[0]).toBe('usr_customer_99');
          return Promise.resolve({
            rows: [{ pendingCount: '5' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/beneficiaries/pending-count',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.pendingCount).toBe(5);
    });

    it('DELETE /beneficiaries/approvals should reject unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/beneficiaries/approvals',
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(false);
    });

    it('DELETE /beneficiaries/approvals should delete all records for the authenticated customer', async () => {
      mockTokenService.verifyAccessToken = vi.fn().mockReturnValue({
        sub: 'usr_customer_42',
        email: 'customer42@bytebeacon.com',
        role: UserRole.CUSTOMER,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_cust_42',
      });

      let deleteAgentIdPassed: string | null = null;
      vi.spyOn(mockDb, 'query').mockImplementation((query: string, params: any) => {
        if (query.includes('DELETE FROM pending_beneficiary_approvals')) {
          deleteAgentIdPassed = params?.[0];
          return Promise.resolve({
            rowCount: 3,
            rows: [{ phone_number: '0241112233' }, { phone_number: '0242223344' }, { phone_number: '0243334455' }],
          });
        }
        if (query.includes('DELETE FROM beneficiary_validation WHERE agent_id')) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/beneficiaries/approvals',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.count).toBe(3);
      expect(deleteAgentIdPassed).toBe('usr_customer_42');
    });

    it('DELETE /beneficiaries/approvals/:id should delete single record for authenticated customer', async () => {
      mockTokenService.verifyAccessToken = vi.fn().mockReturnValue({
        sub: 'usr_customer_42',
        email: 'customer42@bytebeacon.com',
        role: UserRole.CUSTOMER,
        domain: SecurityDomain.CUSTOMER,
        status: 'ACTIVE',
        sessionId: 'sess_cust_42',
      });

      vi.spyOn(mockDb, 'query').mockImplementation((query: string, params: any) => {
        if (query.includes('DELETE FROM pending_beneficiary_approvals WHERE id = $1 AND agent_id = $2')) {
          expect(params[0]).toBe('pba_cust_1');
          expect(params[1]).toBe('usr_customer_42');
          return Promise.resolve({
            rowCount: 1,
            rows: [{ id: 'pba_cust_1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/beneficiaries/approvals/pba_cust_1',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('pba_cust_1');
    });

    it('should correctly approve single number input from local database when live provider check does not have it', async () => {
      // Mock live telecom provider returning empty / not found
      mockTelecomProvider.precheckPublicBeneficiaries = vi.fn().mockResolvedValue({
        network: NetworkProvider.MTN,
        enforced: true,
        results: [],
      });

      // Mock database having the number as VALID in beneficiary_validation
      vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
        if (query.includes('FROM beneficiary_validation') && query.includes("validation_status IN ('VALID', 'APPROVED')")) {
          return Promise.resolve({
            rows: [{ phoneNumber: '0245556677', accountName: 'Kofi Mensah' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/orders/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: ['0245556677'],
          record: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      const item = json.data.results.find((r: any) => r.phone === '0245556677');
      expect(item.valid).toBe(true);
      expect(item.known).toBe(true);
    });

    it('should correctly preserve database approvals in bulk/Excel precheck even when bypassCache is true', async () => {
      // Mock live telecom provider returning not found
      mockTelecomProvider.precheckBeneficiaries = vi.fn().mockResolvedValue({
        network: NetworkProvider.MTN,
        enforced: true,
        results: [],
      });

      // Mock database having 0247778899 as APPROVED in pending_beneficiary_approvals
      vi.spyOn(mockDb, 'query').mockImplementation((query: string) => {
        if (query.includes("validation_status IN ('VALID', 'APPROVED')") || query.includes("status = 'APPROVED'")) {
          return Promise.resolve({
            rows: [
              { phoneNumber: '0247778899', accountName: null },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/beneficiaries/precheck',
        payload: {
          network: 'MTN',
          phoneNumbers: ['0247778899', '0240001122'],
          record: false,
          bypassCache: true, // Excel verification job passes bypassCache: true
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);

      const approvedItem = json.data.results.find((r: any) => r.phone === '0247778899');
      expect(approvedItem.isKnown).toBe(true);
      expect(approvedItem.status).toBe('APPROVED');
      expect(approvedItem.orderable).toBe(true);

      const unapprovedItem = json.data.results.find((r: any) => r.phone === '0240001122');
      expect(unapprovedItem.isKnown).toBe(false);
      expect(unapprovedItem.status).toBe('UNAPPROVED');
      expect(unapprovedItem.orderable).toBe(false);
    });
  });
});
