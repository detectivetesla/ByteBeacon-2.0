import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminAnalyticsRoutes } from '../../src/routes/commerce/admin-analytics.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Analytics & Overview Dashboard Telemetry', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        const sql = query.replace(/\s+/g, ' ');

        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
          });
        }

        // 1. User metrics
        if (sql.includes('COUNT(*) as "totalUsers"') && sql.includes('FROM users')) {
          return Promise.resolve({
            rows: [{
              totalUsers: '150',
              totalCustomers: '120',
              totalAgents: '25',
              totalAdmins: '4',
              totalSuperAdmins: '1',
              activeUsers: '145',
            }],
          });
        }

        // 2. Order metrics
        if (sql.includes('COUNT(*) as "lifetimeOrders"') && sql.includes('FROM orders')) {
          return Promise.resolve({
            rows: [{
              lifetimeOrders: '850',
              lifetimeVolumePesewas: '15000000',
              totalOrders: '320',
              completedOrders: '300',
              processingOrders: '15',
              failedOrders: '5',
              refundedOrders: '0',
              periodVolumePesewas: '5200000',
              todayVolumePesewas: '85000',
              monthVolumePesewas: '2400000',
            }],
          });
        }

        // 3. Network stats
        if (sql.includes('SELECT network, COUNT(*) as "orderCount"') && sql.includes('FROM orders')) {
          return Promise.resolve({
            rows: [
              { network: 'MTN', orderCount: '200', volumePesewas: '3500000' },
              { network: 'TELECEL', orderCount: '80', volumePesewas: '1200000' },
              { network: 'AIRTELTIGO', orderCount: '40', volumePesewas: '500000' },
            ],
          });
        }

        // 4. Wallet liabilities
        if (sql.includes('totalWalletPesewas') && sql.includes('FROM users')) {
          return Promise.resolve({
            rows: [{
              totalWalletPesewas: '850000',
              agentWalletPesewas: '600000',
              customerWalletPesewas: '250000',
            }],
          });
        }

        // 5. DLQ & Approvals
        if (sql.includes('FROM provider_dlq')) {
          return Promise.resolve({ rows: [{ pendingDlq: '2' }] });
        }
        if (sql.includes('FROM beneficiary_validation') || sql.includes('FROM beneficiary_records')) {
          return Promise.resolve({ rows: [{ pendingMtn: '1' }] });
        }

        // 6. Security Metrics
        if (sql.includes('FROM sessions')) {
          return Promise.resolve({ rows: [{ activeSessions: '42' }] });
        }
        if (sql.includes('FROM audit_logs')) {
          return Promise.resolve({ rows: [{ failedLogins: '3' }] });
        }

        // 7. Recent Orders
        if (sql.includes('FROM orders o LEFT JOIN users u')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ord_1',
                recipientPhone: '0240000001',
                network: 'MTN',
                dataAmountMb: 5120,
                amountPesewas: '2800',
                orderStatus: 'COMPLETED',
                paymentStatus: 'PAID',
                createdAt: new Date().toISOString(),
                userEmail: 'user@test.com',
                userName: 'Test User',
              },
            ],
          });
        }

        // 8. Recent Users
        if (sql.includes('SELECT id, COALESCE(full_name, email) as name') && sql.includes('FROM users')) {
          return Promise.resolve({
            rows: [
              {
                id: 'usr_1',
                name: 'New Customer',
                email: 'customer@test.com',
                role: 'customer',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        }

        // 9. Active Stores
        if (sql.includes('FROM agent_stores')) {
          return Promise.resolve({
            rows: [{ totalStores: '18', activeStores: '16' }],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    } as any;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.ADMIN,
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
    } as any;

    app = Fastify();
    await app.register(adminAnalyticsRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });
    await app.ready();
  });

  it('1. GET /admin/analytics/overview should return total users, period revenue, and platform orders', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/analytics/overview?range=30d',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify Users metrics
    expect(body.data.users.total).toBe(150);
    expect(body.data.users.customers).toBe(120);
    expect(body.data.users.agents).toBe(25);
    expect(body.data.users.admins).toBe(4);

    // Verify Orders metrics
    expect(body.data.orders.total).toBe(320);
    expect(body.data.orders.lifetimeTotal).toBe(850);
    expect(body.data.orders.completed).toBe(300);
    expect(body.data.orders.completionRate).toBe(94);

    // Verify Revenue metrics
    expect(body.data.revenue.periodPesewas).toBe(5200000);
    expect(body.data.revenue.lifetimePesewas).toBe(15000000);
    expect(body.data.revenue.todayPesewas).toBe(85000);
    expect(body.data.revenue.monthPesewas).toBe(2400000);

    // Verify Stores & Queues
    expect(body.data.stores.total).toBe(18);
    expect(body.data.stores.active).toBe(16);
    expect(body.data.queues.pendingDlq).toBe(2);
    expect(body.data.queues.pendingMtnApprovals).toBe(1);

    // Verify Networks
    expect(body.data.networks.length).toBe(3);
    expect(body.data.networks[0].network).toBe('MTN');
  });

  it('2. GET /admin/analytics/overview with range=all should query all time', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/analytics/overview?range=all',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.range).toBe('all');
    expect(body.data.orders.total).toBe(850);
    expect(body.data.revenue.periodPesewas).toBe(15000000);
  });

  it('3. GET /admin/analytics/overview with range=today should return today revenue and orders', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/analytics/overview?range=today',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.range).toBe('today');
    expect(body.data.users.total).toBe(150);
    expect(body.data.revenue.todayPesewas).toBe(85000);
    expect(body.data.revenue.periodPesewas).toBe(85000);
  });
});
