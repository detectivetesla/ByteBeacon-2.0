import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminUsersRoutes } from '../../src/routes/commerce/admin-users.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { UserRole, LedgerAccountType, LedgerEntryType } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Users Directory & Dossier Control Plane', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockClient: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockLedgerService: FinancialLedgerService;

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
    mockClient = {
      query: vi.fn().mockImplementation((query: string, params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');
        if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
          return Promise.resolve({
            rows: [{
              id: 'usr_cust_123',
              email: 'customer@bytebeacon.com',
              role: 'customer',
              currentBalance: '50000',
            }],
          });
        }
        if (sql.includes('UPDATE users SET wallet_balance_pesewas')) {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: vi.fn(),
    };

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
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

        // Catalog products with user pricing query
        if (sql.includes('FROM catalog_products cp') && sql.includes('LEFT JOIN user_pricing up')) {
          return Promise.resolve({
            rows: [
              {
                productId: 'prod_mtn_1gb',
                productName: 'MTN 1GB Data Bundle',
                sku: 'MTN-1GB-DATA',
                network: 'MTN',
                dataAmountMb: '1024',
                basePricePesewas: '500',
                defaultAgentPricePesewas: '450',
                pricingId: 'upr_1',
                customPricePesewas: '420',
                isActive: true,
                updatedAt: new Date().toISOString(),
              },
              {
                productId: 'prod_telecel_2gb',
                productName: 'Telecel 2GB Bundle',
                sku: 'TEL-2GB-DATA',
                network: 'TELECEL',
                dataAmountMb: '2048',
                basePricePesewas: '900',
                defaultAgentPricePesewas: '800',
                pricingId: null,
                customPricePesewas: null,
                isActive: true,
                updatedAt: null,
              },
            ],
          });
        }

        // Catalog product lookup by ID
        if (sql.includes('FROM catalog_products WHERE id = $1')) {
          return Promise.resolve({
            rows: [{
              id: params?.[0] || 'prod_mtn_1gb',
              name: 'MTN 1GB Data Bundle',
              base_price_pesewas: '500',
            }],
          });
        }

        // Single product upsert return
        if (sql.includes('INSERT INTO user_pricing') && sql.includes('RETURNING')) {
          return Promise.resolve({
            rows: [{
              id: 'upr_new',
              userId: params?.[0],
              productId: params?.[1],
              customPricePesewas: params?.[2],
              isActive: params?.[3],
              updatedAt: new Date().toISOString(),
            }],
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

    mockLedgerService = {
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as any;

    app = Fastify();
    await app.register(adminUsersRoutes, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: mockLedgerService,
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

  it('3. POST /admin/users/:id/adjust-wallet should credit user wallet using valid UUID for platform escrow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/usr_cust_123/adjust-wallet',
      headers: { authorization: 'Bearer superadmin_token' },
      payload: {
        amountPesewas: 1000,
        type: 'CREDIT',
        reason: 'Customer goodwill deposit compensation',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('usr_cust_123');
    expect(body.data.previousBalancePesewas).toBe(50000);
    expect(body.data.newBalancePesewas).toBe(51000);
    expect(body.data.type).toBe('CREDIT');

    // Verify double-entry ledger entries use nil UUID for platform escrow
    expect(mockLedgerService.recordJournalEntries).toHaveBeenCalledWith(
      mockClient,
      expect.arrayContaining([
        expect.objectContaining({
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: '00000000-0000-0000-0000-000000000000',
          amountPesewas: 1000,
        }),
        expect.objectContaining({
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_cust_123',
          amountPesewas: 1000,
        }),
      ]),
    );
  });

  it('4. POST /admin/users/:id/adjust-wallet should debit user wallet using valid UUID for platform escrow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/usr_cust_123/adjust-wallet',
      headers: { authorization: 'Bearer superadmin_token' },
      payload: {
        amountPesewas: 500,
        type: 'DEBIT',
        reason: 'Manual clawback for duplicate credit reversal',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.newBalancePesewas).toBe(49500);
    expect(body.data.type).toBe('DEBIT');

    expect(mockLedgerService.recordJournalEntries).toHaveBeenCalledWith(
      mockClient,
      expect.arrayContaining([
        expect.objectContaining({
          entryType: LedgerEntryType.DEBIT,
          accountType: LedgerAccountType.CUSTOMER_WALLET,
          accountId: 'usr_cust_123',
          amountPesewas: 500,
        }),
        expect.objectContaining({
          entryType: LedgerEntryType.CREDIT,
          accountType: LedgerAccountType.PLATFORM_ESCROW,
          accountId: '00000000-0000-0000-0000-000000000000',
          amountPesewas: 500,
        }),
      ]),
    );
  });

  it('5. GET /admin/users/:id/pricing should return catalog products with user custom price overrides', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users/usr_cust_123/pricing',
      headers: { authorization: 'Bearer superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);

    const mtnPlan = body.data.find((p: any) => p.productId === 'prod_mtn_1gb');
    expect(mtnPlan).toBeDefined();
    expect(mtnPlan.customPricePesewas).toBe(420);
    expect(mtnPlan.effectivePricePesewas).toBe(420);

    const telecelPlan = body.data.find((p: any) => p.productId === 'prod_telecel_2gb');
    expect(telecelPlan).toBeDefined();
    expect(telecelPlan.customPricePesewas).toBeNull();
    expect(telecelPlan.effectivePricePesewas).toBe(900); // Standard base retail
  });

  it('6. PUT /admin/users/:id/pricing/:productId should set custom bundle price for user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/users/usr_cust_123/pricing/prod_mtn_1gb',
      headers: { authorization: 'Bearer superadmin_token' },
      payload: {
        customPricePesewas: 410,
        isActive: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.customPricePesewas).toBe(410);
  });

  it('7. DELETE /admin/users/:id/pricing/:productId should remove custom price override', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/users/usr_cust_123/pricing/prod_mtn_1gb',
      headers: { authorization: 'Bearer superadmin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Custom price override removed');
  });

  it('8. PUT /admin/users/:id/pricing should batch update custom pricing overrides', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/admin/users/usr_cust_123/pricing',
      headers: { authorization: 'Bearer superadmin_token' },
      payload: {
        pricing: [
          { productId: 'prod_mtn_1gb', customPricePesewas: 400, isActive: true },
          { productId: 'prod_telecel_2gb', customPricePesewas: null },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Custom bundle pricing updated successfully');
  });
});

