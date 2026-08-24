import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminAgentsRoutes } from '../../src/routes/commerce/admin-agents.routes.js';
import { adminStoresRoutes } from '../../src/routes/commerce/admin-stores.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { PasswordHasher } from '../../src/core/security/password-hasher.js';
import {
  UserRole,
  SecurityDomain,
  AgentAccountStatus,
  StoreStatus,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Phase 11.7: Agent & Agent Store Management Control Plane', () => {
  let app: FastifyInstance;
  let mockDb: pg.Pool;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFinancialLedgerService: FinancialLedgerService;
  let mockPasswordHasher: PasswordHasher;

  const mockAgentRow = {
    id: 'agt_uuid_101',
    userId: 'usr_agt_101',
    user_id: 'usr_agt_101',
    fullName: 'Yaw Mensah',
    full_name: 'Yaw Mensah',
    email: 'yaw@example.com',
    phone: '0244123456',
    businessName: 'Yaw Telecom',
    business_name: 'Yaw Telecom',
    slug: 'yaw-telecom',
    agentStatus: 'ACTIVE',
    status: 'ACTIVE',
    storeStatus: 'ACTIVE',
    store_status: 'ACTIVE',
    storeId: 'str_uuid_201',
    store_id: 'str_uuid_201',
    storeName: 'Yaw Express Store',
    store_name: 'Yaw Express Store',
    storeSlug: 'yaw-express',
    store_slug: 'yaw-express',
    apiAccessEnabled: true,
    api_access_enabled: true,
    activeKeysCount: 2,
    active_keys_count: 2,
    walletBalancePesewas: 125000,
    wallet_balance: 1250,
    ordersCount: 438,
    orders_count: 438,
    revenuePesewas: 782000,
    revenue_pesewas: 782000,
    subAgentsCount: 3,
    sub_agents_count: 3,
    agentTier: 'GOLD',
    agent_tier: 'GOLD',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  const mockStoreRow = {
    id: 'str_uuid_201',
    agentId: 'agt_uuid_101',
    agent_id: 'agt_uuid_101',
    userId: 'usr_agt_101',
    user_id: 'usr_agt_101',
    storeName: 'Yaw Express Store',
    store_name: 'Yaw Express Store',
    slug: 'yaw-express',
    ownerName: 'Yaw Mensah',
    owner_name: 'Yaw Mensah',
    ownerEmail: 'yaw@example.com',
    owner_email: 'yaw@example.com',
    ownerPhone: '0244123456',
    owner_phone: '0244123456',
    paymentStatus: 'PAID',
    payment_status: 'PAID',
    approvalStatus: 'APPROVED',
    approval_status: 'APPROVED',
    storeStatus: 'ACTIVE',
    store_status: 'ACTIVE',
    activationFeePesewas: 50000,
    activation_fee_pesewas: 50000,
    paystackReference: 'STRPAY-9988-1122',
    paystack_reference: 'STRPAY-9988-1122',
    totalSalesPesewas: 843000,
    total_sales_pesewas: 843000,
    pendingPayoutPesewas: 32000,
    pending_payout_pesewas: 32000,
    productsCount: 15,
    products_count: 15,
    adminNotes: 'Verified KYC documents.',
    admin_notes: 'Verified KYC documents.',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    primaryColor: '#0066FF',
    accentColor: '#00E599',
  };

  beforeEach(async () => {
    app = Fastify();

    mockDb = {
      query: vi.fn().mockImplementation((query: string, _params?: any[]) => {
        const sql = query.replace(/\s+/g, ' ');

        // 1. Auth Hook User verification
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'usr_admin_1', uuid: 'usr_admin_1', status: 'ACTIVE', role: UserRole.ADMIN }],
          });
        }

        // 2. Agent Stats Query
        if (sql.includes('COUNT(DISTINCT a.id) as "totalAgents"') && sql.includes('FROM agents a')) {
          return Promise.resolve({
            rows: [{
              totalAgents: '42',
              activeAgents: '38',
              suspendedAgents: '2',
              pendingAgents: '2',
              agentsWithStores: '25',
              agentsWithApi: '12',
              totalWalletFloatPesewas: '8500000',
              totalRevenuePesewas: '145000000',
            }],
          });
        }

        // 3. Agent Count Query
        if (sql.includes('SELECT COUNT(DISTINCT a.id) as total FROM agents a')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        // 4. Agent List Query
        if (sql.includes('FROM agents a') && sql.includes('ORDER BY a.created_at DESC')) {
          return Promise.resolve({
            rows: [mockAgentRow],
          });
        }

        // 5. Single Agent Detail Query
        if (sql.includes('FROM agents a') && sql.includes('WHERE a.id = $1 OR a.user_id::text = $1')) {
          return Promise.resolve({
            rows: [mockAgentRow],
          });
        }

        if (sql.includes('FROM financial_ledger WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [{
              ledgerBalancePesewas: '125000',
              totalDepositsPesewas: '200000',
              totalSpentPesewas: '75000',
              totalWithdrawalsPesewas: '0',
              totalRefundsPesewas: '0',
            }],
          });
        }

        if (sql.includes('FROM orders WHERE agent_id = $1 OR user_id = $2')) {
          return Promise.resolve({
            rows: [{
              total: '438',
              completed: '430',
              processing: '5',
              failed: '3',
              refunded: '2',
            }],
          });
        }

        if (sql.includes('FROM api_keys WHERE agent_id = $1')) {
          return Promise.resolve({
            rows: [{
              activeKeys: '2',
              lastRequestAt: new Date().toISOString(),
            }],
          });
        }

        if (sql.includes('FROM stores s WHERE s.agent_id = $1 OR s.user_id = $2')) {
          return Promise.resolve({
            rows: [mockStoreRow],
          });
        }

        if (sql.includes('FROM agents a WHERE a.parent_agent_id = $1')) {
          return Promise.resolve({
            rows: [],
          });
        }

        if (sql.includes('FROM agent_customers ac WHERE ac.agent_id = $1')) {
          return Promise.resolve({
            rows: [],
          });
        }

        if (sql.includes('FROM catalog_products cp LEFT JOIN agent_pricing ap')) {
          return Promise.resolve({
            rows: [{
              productId: 'prod_1',
              productName: '1GB Non-Expiry',
              sku: 'MTN-1GB',
              network: 'MTN',
              dataAmountMb: 1024,
              basePricePesewas: '600',
              defaultAgentPricePesewas: '500',
              customPricePesewas: '480',
              isActive: true,
              updatedAt: new Date().toISOString(),
            }],
          });
        }

        // 6. Agent Creation
        if (sql.includes('SELECT uuid FROM users WHERE LOWER(email) = LOWER($1)')) {
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('SELECT id FROM agents WHERE slug = $1')) {
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [{
              id: 'usr_new_99',
              email: 'kofi@example.com',
              phone: '0240001122',
              fullName: 'Kofi Manu',
              createdAt: new Date(),
            }],
          });
        }

        if (sql.includes('INSERT INTO agents')) {
          return Promise.resolve({
            rows: [{
              id: 'agt_new_99',
              userId: 'usr_new_99',
              businessName: 'Kofi Tele',
              slug: 'kofi-tele',
              agentTier: 'STANDARD',
              status: 'ACTIVE',
              apiAccessEnabled: true,
              createdAt: new Date(),
            }],
          });
        }

        // 7. Agent Status Update
        if (sql.includes('SELECT id, user_id as "userId", status FROM agents WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'agt_uuid_101', userId: 'usr_agt_101', status: 'ACTIVE' }],
          });
        }

        if (sql.includes('UPDATE agents SET status = $1')) {
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('UPDATE users SET status = $1')) {
          return Promise.resolve({ rows: [] });
        }

        // 8. Agent Wallet Adjustment
        if (sql.includes('SELECT a.id, a.user_id as "userId", u.wallet_balance_pesewas') && sql.includes('FROM agents a')) {
          return Promise.resolve({
            rows: [{ id: 'agt_uuid_101', userId: 'usr_agt_101', walletBalancePesewas: 125000 }],
          });
        }

        // 9. Store Stats Query
        if (sql.includes('COUNT(*) as "totalStores"') && sql.includes('FROM stores')) {
          return Promise.resolve({
            rows: [{
              totalStores: '30',
              activeStores: '25',
              pendingReviewStores: '3',
              suspendedStores: '2',
              rejectedStores: '1',
              pendingWithdrawalsCount: '4',
              pendingWithdrawalPesewas: '150000',
              totalSalesPesewas: '35000000',
              totalRevenuePesewas: '35000000',
              totalPayoutsPesewas: '12000000',
            }],
          });
        }

        // 10. Store Count Query
        if (sql.includes('SELECT COUNT(*) as total FROM stores s')) {
          return Promise.resolve({
            rows: [{ total: '1' }],
          });
        }

        // 11. Store List Query
        if (sql.includes('FROM stores s') && sql.includes('ORDER BY s.created_at DESC')) {
          return Promise.resolve({
            rows: [mockStoreRow],
          });
        }

        // 12. Single Store Detail Query
        if (sql.includes('FROM stores s WHERE s.id = $1 OR s.slug = $1')) {
          return Promise.resolve({
            rows: [mockStoreRow],
          });
        }

        if (sql.includes('FROM store_products sp JOIN catalog_products cp')) {
          return Promise.resolve({
            rows: [{
              id: 'sp_1',
              storeId: 'str_uuid_201',
              catalogProductId: 'prod_1',
              productName: '1GB Non-Expiry',
              sku: 'MTN-1GB',
              network: 'MTN',
              dataAmountMb: 1024,
              basePricePesewas: '600',
              agentPricePesewas: '500',
              markupPesewas: '100',
              customPricePesewas: null,
              isAvailable: true,
              isVisible: true,
            }],
          });
        }

        if (sql.includes('FROM orders WHERE store_id = $1')) {
          return Promise.resolve({
            rows: [{
              totalOrders: '45',
              completedOrders: '44',
              grossSalesPesewas: '22000',
              refundedPesewas: '0',
            }],
          });
        }

        if (sql.includes('FROM store_payouts WHERE store_id = $1')) {
          return Promise.resolve({
            rows: [],
          });
        }

        // 13. Store Application Approve/Reject
        if (sql.includes('UPDATE stores SET approval_status = $1')) {
          return Promise.resolve({
            rows: [{
              id: 'str_uuid_201',
              storeName: 'Yaw Express Store',
              slug: 'yaw-express',
              approvalStatus: 'APPROVED',
              storeStatus: 'ACTIVE',
            }],
          });
        }

        if (sql.includes('UPDATE stores SET approval_status = \'APPROVED\'')) {
          return Promise.resolve({
            rows: [{
              id: 'str_uuid_201',
              storeName: 'Yaw Express Store',
              slug: 'yaw-express',
              approvalStatus: 'APPROVED',
              storeStatus: 'ACTIVE',
            }],
          });
        }

        if (sql.includes('UPDATE stores SET approval_status = \'REJECTED\'')) {
          return Promise.resolve({
            rows: [{
              id: 'str_uuid_201',
              storeName: 'Yaw Express Store',
              slug: 'yaw-express',
              approvalStatus: 'REJECTED',
              storeStatus: 'INACTIVE',
            }],
          });
        }

        // 14. Store Payout Action
        if (sql.includes('UPDATE store_payouts SET status = $1')) {
          return Promise.resolve({
            rows: [{
              id: 'payout_501',
              storeId: 'str_uuid_201',
              amountPesewas: '25000',
              status: 'PAID',
              destinationAccount: '0244123456',
            }],
          });
        }

        // 15. Export Queries
        if (sql.includes('SELECT a.id as "agentId"')) {
          return Promise.resolve({
            rows: [{
              agentId: 'agt_uuid_101',
              fullName: 'Yaw Mensah',
              email: 'yaw@example.com',
              phone: '0244123456',
              businessName: 'Yaw Telecom',
              slug: 'yaw-telecom',
              status: 'ACTIVE',
              walletBalanceGhs: 1250,
              ordersCount: 438,
              revenueGhs: 7820,
              createdAt: new Date().toISOString(),
            }],
          });
        }

        if (sql.includes('SELECT s.id as "storeId"')) {
          return Promise.resolve({
            rows: [{
              storeId: 'str_uuid_201',
              storeName: 'Yaw Express Store',
              slug: 'yaw-express',
              ownerName: 'Yaw Mensah',
              ownerEmail: 'yaw@example.com',
              phone: '0244123456',
              storeStatus: 'ACTIVE',
              approvalStatus: 'APPROVED',
              paymentStatus: 'PAID',
              salesGhs: 8430,
              createdAt: new Date().toISOString(),
            }],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    mockTokenService = {
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'usr_admin_1',
        email: 'admin@bytebeacon.com',
        role: UserRole.ADMIN,
        domain: SecurityDomain.ADMIN,
        sessionId: 'sess_admin_1',
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
      recordJournalEntries: vi.fn().mockResolvedValue([]),
    } as unknown as FinancialLedgerService;

    mockPasswordHasher = {
      hashPassword: vi.fn().mockResolvedValue('$2b$12$hashed_temp_pw'),
    } as unknown as PasswordHasher;

    await adminAgentsRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
      passwordHasher: mockPasswordHasher,
    });

    await adminStoresRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
    });

    await app.ready();
  });

  // --- 1. Agent Control Plane Tests ---

  it('GET /admin/agents/stats should return accurate 8 KPI counters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/agents/stats',
      headers: { authorization: 'Bearer mock_admin_jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalAgents).toBe(42);
    expect(body.data.activeAgents).toBe(38);
    expect(body.data.agentsWithStores).toBe(25);
    expect(body.data.agentsWithApi).toBe(12);
    expect(body.data.totalWalletFloatPesewas).toBe(8500000);
    expect(body.data.totalRevenuePesewas).toBe(145000000);
  });

  it('GET /admin/agents should support server-side search and filtering', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/agents?search=Yaw&status=ACTIVE&page=1&limit=10',
      headers: { authorization: 'Bearer mock_admin_jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].fullName).toBe('Yaw Mensah');
    expect(body.data.items[0].businessName).toBe('Yaw Telecom');
    expect(body.data.items[0].walletBalancePesewas).toBe(125000);
    expect(body.data.pagination.total).toBe(1);
  });

  it('GET /admin/agents/:id should return complete dossier with wallet, stores, subagents, and pricing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/agents/agt_uuid_101',
      headers: { authorization: 'Bearer mock_admin_jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.agent.id).toBe('agt_uuid_101');
    expect(body.data.wallet.balancePesewas).toBe(125000);
    expect(body.data.ordersSummary.completed).toBe(430);
    expect(body.data.apiSummary.activeKeys).toBe(2);
    expect(body.data.customPricing.length).toBe(1);
  });

  it('POST /admin/agents should register a new agent and audit event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/agents',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: {
        fullName: 'Kofi Manu',
        email: 'kofi@example.com',
        phone: '0240001122',
        businessName: 'Kofi Tele',
        slug: 'kofi-tele',
        agentTier: 'STANDARD',
        enableApiAccess: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('agt_new_99');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_CREATE_AGENT' }),
    );
  });

  it('PATCH /admin/agents/:id/status should update agent status and require reason', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/agents/agt_uuid_101/status',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: {
        status: AgentAccountStatus.SUSPENDED,
        reason: 'Suspended pending compliance review',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe(AgentAccountStatus.SUSPENDED);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_CHANGE_AGENT_STATUS' }),
    );
  });

  it('POST /admin/agents/:id/wallet/adjust should post balanced double-entry voucher', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/agents/agt_uuid_101/wallet/adjust',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: {
        amountPesewas: 50000,
        direction: 'CREDIT',
        reason: 'Direct bank float deposit ref #12345',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(mockFinancialLedgerService.recordJournalEntries).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          referenceType: 'MANUAL_ADJUSTMENT',
          accountType: 'CUSTOMER_WALLET',
          amountPesewas: 50000,
        }),
      ]),
    );
  });

  // --- 2. Agent Store Control Plane Tests ---

  it('GET /admin/stores/stats should return accurate store counters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/stores/stats',
      headers: { authorization: 'Bearer mock_admin_jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalStores).toBe(30);
    expect(body.data.activeStores).toBe(25);
    expect(body.data.pendingReviewStores).toBe(3);
    expect(body.data.pendingWithdrawalPesewas).toBe(150000);
  });

  it('POST /admin/stores/:id/approve should activate storefront and log audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/stores/str_uuid_201/approve',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: { adminNotes: 'KYC verified and approved' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.approvalStatus).toBe('APPROVED');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_APPROVE_STORE' }),
    );
  });

  it('POST /admin/stores/:id/reject should reject application with reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/stores/str_uuid_201/reject',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: { reason: 'Duplicate store name and unverified phone' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.approvalStatus).toBe('REJECTED');
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_REJECT_STORE' }),
    );
  });

  it('POST /admin/stores/:id/payouts/:payoutId/action should process payout with ledger settlement', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/stores/str_uuid_201/payouts/payout_501/action',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: {
        action: 'APPROVE',
        reason: 'Momo payout reference #PAY-998822 verified',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PAID');
    expect(mockFinancialLedgerService.recordJournalEntries).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          referenceType: 'MERCHANT_PAYOUT',
          referenceId: 'payout_501',
          amountPesewas: 25000,
        }),
      ]),
    );
  });

  it('POST /admin/agents/export and /admin/stores/export should generate CSV attachments', async () => {
    const agentsRes = await app.inject({
      method: 'POST',
      url: '/admin/agents/export',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: { format: 'csv' },
    });

    expect(agentsRes.statusCode).toBe(200);
    expect(agentsRes.headers['content-type']).toContain('text/csv');
    expect(agentsRes.body).toContain('Yaw Mensah');

    const storesRes = await app.inject({
      method: 'POST',
      url: '/admin/stores/export',
      headers: { authorization: 'Bearer mock_admin_jwt' },
      payload: { format: 'csv' },
    });

    expect(storesRes.statusCode).toBe(200);
    expect(storesRes.headers['content-type']).toContain('text/csv');
    expect(storesRes.body).toContain('Yaw Express Store');
  });
});
