import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminUsersRoutes } from '../../src/routes/commerce/admin-users.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Users Directory & Dossier Control Plane', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;

  const mockUserRow = {
    id: 'usr_cust_123',
    email: 'customer@bytebeacon.com',
    phone: '0240000001',
    fullName: 'Test Customer',
    role: 'customer',
    status: 'ACTIVE',
    securityDomain: 'CUSTOMER',
    phoneVerified: true,
    emailVerified: true,
    mfaEnabled: false,
    walletBalancePesewas: '50000',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{
              ...mockUserRow,
              id: params?.[0] || 'usr_admin_1',
              uuid: params?.[0] || 'usr_admin_1',
              role: params?.[0] === 'usr_cust_123' ? UserRole.CUSTOMER : UserRole.SUPER_ADMIN,
            }],
          });
        }

        // User stats query
        if (sql.includes('COUNT(*) as "total"') && sql.includes('FILTER (WHERE LOWER(COALESCE(role::text, \'\')) = \'customer\')')) {
          return Promise.resolve({
            rows: [{
              total: '120',
              customers: '100',
              agents: '15',
              admins: '4',
              superAdmins: '1',
              active: '115',
              suspended: '5',
              unverified: '10',
              mfaEnabled: '25',
              recentlyRegistered: '30',
            }],
          });
        }

        // Count query
        if (sql.includes('SELECT COUNT(*) as total FROM users')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        // List query
        if (sql.includes('SELECT id, email, phone') && sql.includes('FROM users')) {
          return Promise.resolve({
            rows: [mockUserRow],
          });
        }

        // Financial ledger sum for user
        if (sql.includes('FROM financial_ledger WHERE account_id = $1')) {
          return Promise.resolve({
            rows: [{ ledgerDerivedBalance: '50000' }],
          });
        }

        // Payments for user
        if (sql.includes('FROM payments WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [{ totalDepositsPesewas: '100000', pendingOperationsPesewas: '0' }],
          });
        }

        // Orders breakdown for user
        if (sql.includes('FROM orders WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [{
              totalOrders: '10',
              completed: '9',
              processing: '1',
              pending: '0',
              failed: '0',
              refunded: '0',
              cancelled: '0',
              lastOrderAt: new Date().toISOString(),
              totalSpentPesewas: '50000',
              totalRefundsPesewas: '0',
              dailyOrders: '1',
              dailySpentPesewas: '5000',
            }],
          });
        }

        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
    } as any;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'superadmin@bytebeacon.com',
        role: UserRole.SUPER_ADMIN,
        domain: 'ADMIN',
        sessionId: 'sess_1',
      }),
    } as any;

    mockApiKeyService = {
      authenticate: vi.fn().mockResolvedValue(null),
    } as any;

    mockRbacService = {
      validateRoleAccess: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      assertPermission: vi.fn().mockReturnValue(true),
      canManageTargetUser: vi.fn().mockReturnValue(true),
      isLastActiveSuperAdmin: vi.fn().mockResolvedValue(false),
    } as any;

    app = Fastify();
    await app.register(adminUsersRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });
    await app.ready();
  });

  it('1. GET /admin/users should return paginated list of users and statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users?page=1&limit=20',
      headers: { authorization: 'Bearer superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.users.length).toBe(1);
    expect(body.data.users[0].email).toBe('customer@bytebeacon.com');
    expect(body.data.stats.total).toBe(120);
    expect(body.data.stats.customers).toBe(100);
    expect(body.data.pagination.total).toBe(1);
  });

  it('2. GET /admin/users/:id should return complete individual user dossier', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users/usr_cust_123',
      headers: { authorization: 'Bearer superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('customer@bytebeacon.com');
    expect(body.data.financialSummary.walletBalancePesewas).toBe(50000);
    expect(body.data.financialSummary.reconciliationStatus).toBe('RECONCILED');
    expect(body.data.orderSummary.totalOrders).toBe(10);
  });
});
