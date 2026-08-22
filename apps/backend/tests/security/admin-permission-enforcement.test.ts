import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { adminPermissionsRoutes } from '../../src/routes/commerce/admin-permissions.routes.js';
import { adminUsersRoutes } from '../../src/routes/commerce/admin-users.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { SessionService } from '../../src/core/security/session.service.js';
import {
  UserRole,
  SecurityDomain,
  AdminSubRole,
  Permission,
} from '@bytebeacon/shared';

describe('Phase 11.14 — Permission Enforcement & Authorization Control Integration Tests', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockSessionService: SessionService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (typeof sql === 'string') {
          // Users lookup for auth verification
          if (sql.includes('users') && (sql.includes('WHERE uuid = $1') || sql.includes('WHERE id = $1'))) {
            const requestedId = params?.[0];
            if (requestedId === '00000000-0000-0000-0000-000000000002') {
              return {
                rows: [
                  {
                    id: '00000000-0000-0000-0000-000000000002',
                    uuid: '00000000-0000-0000-0000-000000000002',
                    email: 'agent@bytebeacon.com',
                    full_name: 'Agent Reseller',
                    status: 'ACTIVE',
                    is_active: true,
                    role: UserRole.AGENT,
                    admin_sub_role: null,
                    mfa_enabled: false,
                  },
                ],
              };
            }
            if (requestedId === '00000000-0000-0000-0000-000000000003') {
              return {
                rows: [
                  {
                    id: '00000000-0000-0000-0000-000000000003',
                    uuid: '00000000-0000-0000-0000-000000000003',
                    email: 'customer@bytebeacon.com',
                    full_name: 'Customer Retail',
                    status: 'ACTIVE',
                    is_active: true,
                    role: UserRole.CUSTOMER,
                    admin_sub_role: null,
                    mfa_enabled: false,
                  },
                ],
              };
            }
            return {
              rows: [
                {
                  id: '00000000-0000-0000-0000-000000000001',
                  uuid: '00000000-0000-0000-0000-000000000001',
                  email: 'superadmin@bytebeacon.com',
                  full_name: 'Super Admin',
                  status: 'ACTIVE',
                  is_active: true,
                  role: UserRole.SUPER_ADMIN,
                  admin_sub_role: AdminSubRole.SUPER_ADMIN,
                  mfa_enabled: true,
                },
              ],
            };
          }

          // Last Super Admin query
          if (sql.includes('SELECT COUNT(*) as count FROM users WHERE (role = \'super_admin\'')) {
            const targetId = params?.[0];
            if (targetId === '00000000-0000-0000-0000-000000000001') {
              return { rows: [{ count: '0' }] }; // target is the LAST super admin
            }
            return { rows: [{ count: '2' }] };
          }
        }
        return { rows: [] };
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'superadmin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        adminSubRole: AdminSubRole.SUPER_ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_1',
      }),
    } as unknown as TokenService;

    mockApiKeyService = {} as unknown as ApiKeyService;
    mockRbacService = new RbacService(mockDb);

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockSessionService = {
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionService;

    app = Fastify();
    await adminPermissionsRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
    });
    await adminUsersRoutes(app, {
      db: mockDb,
      apiKeyService: mockApiKeyService,
      tokenService: mockTokenService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      sessionService: mockSessionService,
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.clearAllMocks();
  });

  // 1. Unauthenticated Request
  it('GET /admin/permissions/registry without token should return 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/registry',
    });

    expect(res.statusCode).toBe(401);
  });

  // 2. Customer Access Rejection
  it('GET /admin/permissions/registry from Customer role should return 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000003',
      email: 'customer@bytebeacon.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
      sessionId: 'sess_cust_1',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/registry',
      headers: { authorization: 'Bearer customer-token' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Administrator privileges required');
  });

  // 3. Agent Access Rejection
  it('GET /admin/permissions/registry from Agent role should return 403 Forbidden', async () => {
    (mockTokenService.verifyAccessToken as any).mockReturnValueOnce({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'agent@bytebeacon.com',
      role: UserRole.AGENT,
      domain: SecurityDomain.AGENT,
      sessionId: 'sess_agent_1',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/registry',
      headers: { authorization: 'Bearer agent-token' },
    });

    expect(res.statusCode).toBe(403);
  });

  // 4. Registry Inspection
  it('GET /admin/permissions/registry by Super Admin should return full registry and role matrix', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/registry',
      headers: { authorization: 'Bearer superadmin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalPermissionsCount).toBeGreaterThanOrEqual(25);
    expect(body.data.roleBreakdown).toHaveLength(7);
  });

  // 5. User Effective Authorization Inspection (Customer)
  it('GET /admin/permissions/users/:userId/effective should compute customer tenant scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/users/00000000-0000-0000-0000-000000000003/effective',
      headers: { authorization: 'Bearer superadmin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('customer');
    expect(body.data.tenantScope.scopeType).toBe('CUSTOMER_SELF');
    expect(body.data.effectivePermissions).toContain(Permission.ORDERS_CREATE);
    expect(body.data.effectivePermissions).not.toContain(Permission.ORDERS_REFUND);
  });

  // 6. User Effective Authorization Inspection (Super Admin)
  it('GET /admin/permissions/users/:userId/effective should compute super admin global scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/permissions/users/00000000-0000-0000-0000-000000000001/effective',
      headers: { authorization: 'Bearer superadmin-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('super_admin');
    expect(body.data.tenantScope.scopeType).toBe('GLOBAL');
    expect(body.data.isLastSuperAdmin).toBe(true);
  });

  // 7. Anti-IDOR Resource Scoping Logic
  it('RbacService.authorizeResource should enforce strict boundary between different tenants', () => {
    const cust1 = 'cust_111';
    const cust2 = 'cust_222';
    const agent1 = 'agent_111';
    const agent2 = 'agent_222';
    const admin1 = 'admin_111';
    const superAdmin1 = 'super_111';

    // Customer can only access self
    expect(mockRbacService.authorizeResource(cust1, UserRole.CUSTOMER, cust1, Permission.ORDERS_READ)).toBe(true);
    expect(mockRbacService.authorizeResource(cust1, UserRole.CUSTOMER, cust2, Permission.ORDERS_READ)).toBe(false);

    // Agent can only access self / owned store
    expect(mockRbacService.authorizeResource(agent1, UserRole.AGENT, agent1, Permission.ORDERS_READ)).toBe(true);
    expect(mockRbacService.authorizeResource(agent1, UserRole.AGENT, agent2, Permission.ORDERS_READ)).toBe(false);

    // Admin with operational read
    expect(mockRbacService.authorizeResource(admin1, UserRole.ADMIN, cust1, Permission.ORDERS_READ)).toBe(true);

    // Super Admin has global authority
    expect(mockRbacService.authorizeResource(superAdmin1, UserRole.SUPER_ADMIN, cust1, Permission.ORDERS_READ)).toBe(true);
    expect(mockRbacService.authorizeResource(superAdmin1, UserRole.SUPER_ADMIN, agent1, Permission.ORDERS_READ)).toBe(true);
  });

  // 8. Anti-Self Escalation Protection
  it('RbacService.canManageTargetUserDetailed should block self-role escalation', () => {
    const adminId = 'admin_999';
    const result = mockRbacService.canManageTargetUserDetailed(
      UserRole.ADMIN,
      adminId,
      adminId,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Self-role escalation is strictly prohibited');
  });

  // 9. Last Super Admin Suspension Protection
  it('POST /admin/users/:id/suspend should block suspending the last active Super Admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/00000000-0000-0000-0000-000000000001/suspend',
      headers: { authorization: 'Bearer superadmin-token' },
      payload: { reason: 'Accidental lockout attempt' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Cannot suspend the last active Super Administrator');
  });

  // 10. Last Super Admin Demotion Protection
  it('POST /admin/users/:id/role should block demoting the last active Super Admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/00000000-0000-0000-0000-000000000001/role',
      headers: { authorization: 'Bearer superadmin-token' },
      payload: { role: 'customer', reason: 'Accidental demotion' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Cannot demote the last active Super Administrator');
  });

  // 11. Authorization Denial Audit Log
  it('RbacService.logAuthorizationDenial should dispatch high-severity security audit event', async () => {
    await mockRbacService.logAuthorizationDenial(
      mockAuditService,
      'corr_test_99',
      { id: 'user_intruder', role: 'CUSTOMER', email: 'intruder@test.com' },
      'ADMIN_SETTINGS_UPDATE',
      'settings',
      'Unauthorized access attempt',
      '192.168.1.100',
    );

    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTHORIZATION_DENIED',
        severity: 'HIGH',
        result: 'DENIED',
      }),
    );
  });
});
