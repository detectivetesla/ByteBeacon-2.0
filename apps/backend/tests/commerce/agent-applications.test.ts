import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { adminAgentsRoutes } from '../../src/routes/commerce/admin-agents.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { PasswordHasher } from '../../src/core/security/password-hasher.js';
import {
  UserRole,
  SecurityDomain,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Applications, Verifications, and Dynamic Application Fee Suite', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFinancialLedgerService: FinancialLedgerService;
  let mockPasswordHasher: PasswordHasher;

  const mockCustomerPayload = {
    sub: 'usr_cust_001',
    email: 'applicant@example.com',
    role: UserRole.CUSTOMER,
    domain: SecurityDomain.CUSTOMER,
    sessionId: 'sess_cust_001',
  };

  const mockAdminPayload = {
    sub: 'usr_admin_001',
    email: 'admin@bytebeacon.com',
    role: UserRole.ADMIN,
    domain: SecurityDomain.ADMIN,
    sessionId: 'sess_admin_001',
  };

  const mockApplicationRow = {
    id: 'app_uuid_001',
    user_id: 'usr_cust_001',
    full_name: 'Applicant User',
    business_name: 'Fast Telecom',
    slug: 'fast-telecom',
    phone: '0244123456',
    email: 'applicant@example.com',
    location_region: 'Greater Accra',
    experience_description: '5 years retail sales experience',
    fee_pesewas: '10000',
    payment_status: 'PAYMENT_PENDING',
    paystack_reference: 'APPLY_REF_001',
    status: 'PENDING_APPROVAL',
    admin_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    app = Fastify();

    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        // ─── Auth Hook: user lookup ───
        // auth.plugin.ts uses: SELECT * FROM users WHERE id = $1
        // fallback: SELECT * FROM users WHERE id::text = $1 OR email = $1
        if (sql.includes('FROM users WHERE id') && !sql.includes('role')) {
          const requestedId = params?.[0];
          if (requestedId === 'usr_admin_001') {
            return Promise.resolve({
              rows: [{
                id: 'usr_admin_001', uuid: 'usr_admin_001', status: 'ACTIVE',
                role: UserRole.ADMIN, full_name: 'Admin User', email: 'admin@bytebeacon.com',
                phone: '0200000000', is_active: true,
              }],
            });
          }
          return Promise.resolve({
            rows: [{
              id: 'usr_cust_001', uuid: 'usr_cust_001', status: 'ACTIVE',
              role: UserRole.CUSTOMER, full_name: 'Applicant User', email: 'applicant@example.com',
              phone: '0244123456', is_active: true,
            }],
          });
        }

        // ─── Application fee config lookup ───
        // Both agent.routes and admin-agents.routes query:
        //   SELECT value FROM system_configurations WHERE config_key = 'agent_application_fee_pesewas'
        if (sql.includes('system_configurations') && sql.includes('agent_application_fee_pesewas') && !sql.includes('INSERT') && !sql.includes('UPDATE')) {
          return Promise.resolve({
            rows: [{ value: '10000' }],
          });
        }

        // ─── Check existing agent (agents WHERE user_id = ...) ───
        // agent.routes: SELECT id FROM agents WHERE user_id = $1 AND status != 'DISABLED'
        if (sql.includes('FROM agents WHERE user_id')) {
          return Promise.resolve({ rows: [] });
        }

        // ─── Slug uniqueness check ───
        // agent.routes uses UNION: agents WHERE slug + agent_applications WHERE slug
        if (sql.includes('FROM agents WHERE slug') || (sql.includes('agents') && sql.includes('slug') && sql.includes('UNION'))) {
          return Promise.resolve({ rows: [] });
        }

        // ─── Existing application lookup (for POST /agents/apply) ───
        // agent.routes: SELECT * FROM agent_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
        if (sql.includes('FROM agent_applications WHERE user_id') && sql.includes('ORDER BY created_at DESC LIMIT 1')) {
          return Promise.resolve({ rows: [] });
        }

        // ─── INSERT new application ───
        if (sql.includes('INSERT INTO agent_applications')) {
          return Promise.resolve({
            rows: [mockApplicationRow],
          });
        }

        // ─── Verify payment: lookup by paystack_reference AND user_id ───
        // agent.routes: SELECT * FROM agent_applications WHERE paystack_reference = $1 AND user_id = $2
        if (sql.includes('FROM agent_applications WHERE paystack_reference')) {
          return Promise.resolve({
            rows: [mockApplicationRow],
          });
        }

        // ─── Update payment_status to PAID ───
        if (sql.includes('UPDATE agent_applications') && sql.includes("payment_status = 'PAID'")) {
          return Promise.resolve({
            rows: [{ ...mockApplicationRow, payment_status: 'PAID', updated_at: new Date().toISOString() }],
          });
        }

        // ─── Admin notifications lookup ───
        if (sql.includes("FROM users WHERE role IN ('admin', 'super_admin')")) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_001' }],
          });
        }

        // ─── Insert notifications (no-op) ───
        if (sql.includes('INSERT INTO notifications')) {
          return Promise.resolve({ rows: [] });
        }

        // ─── Admin: COUNT total applications ───
        if (sql.includes('SELECT COUNT(*) as total FROM agent_applications')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        // ─── Admin: Pending count ───
        if (sql.includes("SELECT COUNT(*) as count FROM agent_applications WHERE status = 'PENDING_APPROVAL'")) {
          return Promise.resolve({
            rows: [{ count: '1' }],
          });
        }

        // ─── Admin: List applications (ORDER BY) ───
        if (sql.includes('FROM agent_applications') && sql.includes('ORDER BY created_at DESC') && sql.includes('LIMIT')) {
          return Promise.resolve({
            rows: [mockApplicationRow],
          });
        }

        // ─── Admin: Single application detail (SELECT * FROM agent_applications WHERE id = $1) ───
        if (sql.includes('FROM agent_applications WHERE id = $1') && !sql.includes('UPDATE')) {
          return Promise.resolve({
            rows: [{ ...mockApplicationRow, payment_status: 'PAID' }],
          });
        }

        // ─── Approve: UPDATE agent_applications SET status = 'APPROVED' ───
        if (sql.includes('UPDATE agent_applications') && sql.includes("status = 'APPROVED'")) {
          return Promise.resolve({
            rows: [{ ...mockApplicationRow, status: 'APPROVED', reviewed_by: 'usr_admin_001', reviewed_at: new Date().toISOString() }],
          });
        }

        // ─── Promote user role to agent ───
        if (sql.includes("UPDATE users") && sql.includes("role = 'agent'")) {
          return Promise.resolve({ rows: [] });
        }

        // ─── Upsert agent record ───
        if (sql.includes('INSERT INTO agents')) {
          return Promise.resolve({
            rows: [{ id: 'agt_new_001', user_id: 'usr_cust_001', status: 'ACTIVE' }],
          });
        }

        // ─── Reject: UPDATE agent_applications SET status = 'REJECTED' ───
        if (sql.includes('UPDATE agent_applications') && sql.includes("status = 'REJECTED'")) {
          return Promise.resolve({
            rows: [{ ...mockApplicationRow, status: 'REJECTED', admin_notes: 'Missing documentation', reviewed_at: new Date().toISOString() }],
          });
        }

        // ─── Fee update: INSERT INTO system_configurations ... ON CONFLICT ───
        if (sql.includes('INSERT INTO system_configurations') && sql.includes('agent_application_fee_pesewas')) {
          return Promise.resolve({ rows: [] });
        }

        // ─── Audit version: INSERT INTO configuration_versions ───
        if (sql.includes('INSERT INTO configuration_versions')) {
          return Promise.resolve({ rows: [] });
        }

        // Default fallback
        return Promise.resolve({ rows: [] });
      }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockImplementation((token: string) => {
        if (token === 'valid_admin_token') return mockAdminPayload;
        if (token === 'valid_customer_token') return mockCustomerPayload;
        throw new Error('Invalid token');
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockResolvedValue(true),
      canAccessDomain: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockFinancialLedgerService = {
      getAccountBalance: vi.fn().mockResolvedValue({ balancePesewas: 50000 }),
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    mockPasswordHasher = {
      hashPassword: vi.fn().mockResolvedValue('$2b$12$hashed_temp_pw'),
    } as unknown as PasswordHasher;

    // Register Customer Agent Routes
    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: mockFinancialLedgerService,
    });

    // Register Admin Agent Routes
    await adminAgentsRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
      passwordHasher: mockPasswordHasher,
    });

    await app.ready();
  });

  describe('Customer Application Endpoints', () => {
    it('GET /agents/application-fee should return the configured fee (default 100 GHS)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/agents/application-fee',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.feePesewas).toBe(10000);
      expect(json.data.feeGhs).toBe(100);
    });

    it('POST /agents/apply should create application with PAYMENT_PENDING', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/apply',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
        payload: {
          businessName: 'Fast Telecom',
          slug: 'fast-telecom',
          phone: '0244123456',
          locationRegion: 'Greater Accra',
          experienceDescription: '5 years retail sales experience',
          paymentMethod: 'PAYSTACK',
        },
      });

      // Route returns 201 for new applications
      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      // The route spreads appRecord directly into data (not nested under data.application)
      expect(json.data.businessName).toBe('Fast Telecom');
      expect(json.data.paymentStatus).toBe('PAYMENT_PENDING');
    });

    it('POST /agents/apply/verify-payment should verify payment and send notification to admins', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/agents/apply/verify-payment',
        headers: {
          authorization: 'Bearer valid_customer_token',
        },
        payload: {
          reference: 'APPLY_REF_001',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      // Route returns updatedRecord directly in data (not nested under data.application)
      expect(json.data.paymentStatus).toBe('PAID');
      expect(json.message).toContain('Payment verified');
    });
  });

  describe('Admin Application Verification & Fee Management Endpoints', () => {
    it('GET /admin/agents/applications should list pending applications and pending count', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/agents/applications',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBe(1);
      expect(json.data.pendingCount).toBe(1);
    });

    it('POST /admin/agents/applications/:id/approve should promote user to agent and activate agent record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents/applications/app_uuid_001/approve',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      // Route returns { id, userId, status, businessName, slug } directly (not nested under data.application)
      expect(json.data.status).toBe('APPROVED');
      // Actual audit action in admin-agents.routes.ts is 'APPROVE_AGENT_APPLICATION'
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE_AGENT_APPLICATION',
        }),
      );
    });

    it('POST /admin/agents/applications/:id/reject should reject application and save notes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/agents/applications/app_uuid_001/reject',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
        payload: {
          reason: 'Missing documentation',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      // Route returns { id, userId, status, adminNotes } directly (not nested under data.application)
      expect(json.data.status).toBe('REJECTED');
      // Actual audit action in admin-agents.routes.ts is 'REJECT_AGENT_APPLICATION'
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REJECT_AGENT_APPLICATION',
        }),
      );
    });

    it('PUT /admin/agents/settings/application-fee should allow admin to configure dynamic application price', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/agents/settings/application-fee',
        headers: {
          authorization: 'Bearer valid_admin_token',
        },
        payload: {
          applicationFeeGhs: 150,
          reason: 'Adjusted seasonal onboarding fee',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.applicationFeeGhs).toBe(150);
      expect(json.data.applicationFeePesewas).toBe(15000);
      // Actual audit action in admin-agents.routes.ts is 'UPDATE_SYSTEM_CONFIG'
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_SYSTEM_CONFIG',
        }),
      );
    });
  });
});
