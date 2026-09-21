import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { adminFinanceRoutes } from '../../src/routes/commerce/admin-finance.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Agent Storefront Profit Withdrawals & Admin Payout Tracking Suite', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;

  beforeEach(async () => {
    app = Fastify();

    mockTokenService = {
      verifyAccessToken: vi.fn().mockImplementation((token: string) => {
        if (token === 'admin_token') {
          return {
            sub: 'admin_user_1',
            email: 'admin@bytebeacon.online',
            role: UserRole.SUPER_ADMIN,
            domain: SecurityDomain.ADMIN,
            sessionId: 'sess_admin',
          };
        }
        return {
          sub: 'agent_user_1',
          email: 'agent@bytebeacon.online',
          role: UserRole.AGENT,
          domain: SecurityDomain.AGENT,
          sessionId: 'sess_agent',
        };
      }),
    } as unknown as TokenService;

    mockApiKeyService = {
      validateKey: vi.fn().mockResolvedValue(null),
    } as unknown as ApiKeyService;

    mockRbacService = {
      hasPermission: vi.fn().mockReturnValue(true),
    } as unknown as RbacService;
  });

  it('1. GET /agents/withdrawals/summary calculates available profit strictly from storefront orders', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'agent_user_1', role: UserRole.AGENT, status: 'ACTIVE', wallet_balance_pesewas: 50000 }],
          };
        }
        if (sql.includes('FROM stores')) {
          return {
            rows: [{ id: 'store_1', store_name: 'FastData Gh', slug: 'fastdata', store_status: 'ACTIVE' }],
          };
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return {
            rows: [{ id: 'agent_1', user_id: 'agent_user_1', tier: 'PRO' }],
          };
        }
        if (sql.includes('FROM orders o') && sql.includes('o.store_id = $1')) {
          // Storefront profit: GHS 120.00 (12,000 pesewas)
          return {
            rows: [{ total_profit_pesewas: '12000', sales_count: '5', sales_volume_pesewas: '50000' }],
          };
        }
        if (sql.includes('FROM store_payouts')) {
          // Already withdrawn: GHS 20.00 (2,000 pesewas)
          return {
            rows: [{ total_withdrawn_pesewas: '2000', pending_withdrawn_pesewas: '0', settled_withdrawn_pesewas: '2000' }],
          };
        }
        return { rows: [] };
      }),
    };

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: {} as any,
      paymentProvider: {} as any,
      orderService: {} as any,
      stateMachine: {} as any,
      webhookDispatcher: {} as any,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/agents/withdrawals/summary',
      headers: { authorization: 'Bearer agent_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.hasStore).toBe(true);
    expect(body.data.storeName).toBe('FastData Gh');
    expect(body.data.totalProfitEarnedPesewas).toBe(12000);
    expect(body.data.totalWithdrawnPesewas).toBe(2000);
    expect(body.data.availableProfitPesewas).toBe(10000); // GHS 100 available
  });

  it('2. POST /agents/withdrawals rejects request exceeding available storefront profit', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'agent_user_1', role: UserRole.AGENT, status: 'ACTIVE', wallet_balance_pesewas: 999999 }],
          };
        }
        if (sql.includes('FROM stores')) {
          return { rows: [{ id: 'store_1', store_name: 'FastData Gh', slug: 'fastdata', store_status: 'ACTIVE' }] };
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return { rows: [{ id: 'agent_1', user_id: 'agent_user_1' }] };
        }
        if (sql.includes('FROM orders o') && sql.includes('o.store_id = $1')) {
          return { rows: [{ total_profit_pesewas: '5000', sales_count: '2', sales_volume_pesewas: '20000' }] }; // GHS 50 profit
        }
        if (sql.includes('FROM store_payouts')) {
          return { rows: [{ total_withdrawn_pesewas: '0', pending_withdrawn_pesewas: '0', settled_withdrawn_pesewas: '0' }] };
        }
        return { rows: [] };
      }),
    };

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: {} as any,
      paymentProvider: {} as any,
      orderService: {} as any,
      stateMachine: {} as any,
      webhookDispatcher: {} as any,
    });

    // Requesting GHS 100 (10,000 pesewas) when only GHS 50 profit exists
    const res = await app.inject({
      method: 'POST',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
      payload: {
        amountPesewas: 10000,
        payoutMethod: 'MTN_MOMO',
        accountNumber: '0241234567',
        accountName: 'Agent Kwesi',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Insufficient storefront profit');
  });

  it('3. POST /agents/withdrawals successfully inserts into store_payouts with destination details without touching wallet', async () => {
    let insertedPayout: any = null;
    let walletUpdated = false;

    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('UPDATE users SET wallet_balance_pesewas')) {
          walletUpdated = true;
          return { rows: [] };
        }
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'agent_user_1', role: UserRole.AGENT, status: 'ACTIVE', wallet_balance_pesewas: 5000 }],
          };
        }
        if (sql.includes('FROM stores')) {
          return { rows: [{ id: 'store_1', store_name: 'FastData Gh', slug: 'fastdata', store_status: 'ACTIVE' }] };
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return { rows: [{ id: 'agent_1', user_id: 'agent_user_1' }] };
        }
        if (sql.includes('FROM orders o') && sql.includes('o.store_id = $1')) {
          return { rows: [{ total_profit_pesewas: '20000', sales_count: '10', sales_volume_pesewas: '100000' }] }; // GHS 200 profit
        }
        if (sql.includes('FROM store_payouts')) {
          return { rows: [{ total_withdrawn_pesewas: '0', pending_withdrawn_pesewas: '0', settled_withdrawn_pesewas: '0' }] };
        }
        if (sql.includes('INSERT INTO store_payouts')) {
          insertedPayout = {
            id: 'payout_123',
            store_id: params[0],
            agent_id: params[1],
            amount_pesewas: params[2],
            destination_account: params[3],
            destination_provider: params[4],
            account_name: params[5],
            bank_name: params[6],
            reference: params[7],
            status: 'PENDING',
            created_at: new Date().toISOString(),
          };
          return { rows: [insertedPayout] };
        }
        return { rows: [] };
      }),
    };

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: {} as any,
      paymentProvider: {} as any,
      orderService: {} as any,
      stateMachine: {} as any,
      webhookDispatcher: {} as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
      payload: {
        amountPesewas: 5000,
        payoutMethod: 'BANK',
        accountNumber: '1441001234567',
        accountName: 'Agent Kwesi',
        bankName: 'GCB Bank Ghana',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.amountPesewas).toBe(5000);
    expect(body.data.destinationAccount).toBe('1441001234567');
    expect(body.data.bankName).toBe('GCB Bank Ghana');
    expect(walletUpdated).toBe(false); // CRITICAL: operational purchasing wallet untouched!
  });

  it('4. GET /admin/finance/withdrawals & POST /admin/finance/withdrawals/:id/action tracks and settles withdrawals', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'admin_user_1', role: UserRole.SUPER_ADMIN, status: 'ACTIVE' }],
          };
        }
        if (sql.includes('SELECT COUNT(*) as total FROM store_payouts')) {
          return { rows: [{ total: '1' }] };
        }
        if (sql.includes('SELECT') && sql.includes('FROM store_payouts p')) {
          return {
            rows: [
              {
                id: 'payout_123',
                storeId: 'store_1',
                storeName: 'FastData Gh',
                storeSlug: 'fastdata',
                agentId: 'agent_1',
                agentName: 'Agent Kwesi',
                agentEmail: 'agent@bytebeacon.online',
                amountPesewas: 5000,
                destinationAccount: '0241234567',
                destinationProvider: 'MTN_MOMO',
                accountName: 'Kwesi Mensah',
                bankName: null,
                reference: 'WDR-123456',
                status: 'PENDING',
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }
        if (sql.includes('UPDATE store_payouts')) {
          return {
            rows: [
              {
                id: 'payout_123',
                status: params[0],
                destinationAccount: '0241234567',
                destinationProvider: 'MTN_MOMO',
                paidAt: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    await adminFinanceRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: {} as any,
      ledgerService: {} as any,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/admin/finance/withdrawals',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0].destinationAccount).toBe('0241234567');
    expect(listBody.data.items[0].accountName).toBe('Kwesi Mensah');

    const actionRes = await app.inject({
      method: 'POST',
      url: '/admin/finance/withdrawals/payout_123/action',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        action: 'PAID',
        notes: 'Disbursed via MTN MoMo terminal ref MOMO-99123',
      },
    });

    expect(actionRes.statusCode).toBe(200);
    const actionBody = JSON.parse(actionRes.payload);
    expect(actionBody.success).toBe(true);
    expect(actionBody.data.status).toBe('PAID');
  });

  it('5. POST /agents/withdrawals enforces min, max, and daily limits configured by admin', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'agent_user_1', role: UserRole.AGENT, status: 'ACTIVE', wallet_balance_pesewas: 5000 }],
          };
        }
        if (sql.includes('FROM stores')) {
          return { rows: [{ id: 'store_1', store_name: 'FastData Gh', slug: 'fastdata', store_status: 'ACTIVE' }] };
        }
        if (sql.includes('FROM agents')) {
          // Custom limit of 10,000 pesewas (GH₵ 100)
          return { rows: [{ id: 'agent_1', user_id: 'agent_user_1', custom_withdrawal_limit_pesewas: 10000 }] };
        }
        if (sql.includes('FROM orders o') && sql.includes('o.store_id = $1')) {
          return { rows: [{ total_profit_pesewas: '500000', sales_count: '50', sales_volume_pesewas: '2000000' }] }; // GH₵ 5,000 profit
        }
        if (sql.includes('FROM store_payouts') && sql.includes('status NOT IN')) {
          // Daily withdrawn so far: 0
          return { rows: [{ daily_withdrawn_pesewas: '0' }] };
        }
        if (sql.includes('FROM store_payouts')) {
          return { rows: [{ total_withdrawn_pesewas: '0', pending_withdrawn_pesewas: '0', settled_withdrawn_pesewas: '0' }] };
        }
        if (sql.includes('FROM financial_safety_settings')) {
          return {
            rows: [
              {
                min_withdrawal_pesewas: 2000, // min GH₵ 20.00
                max_single_withdrawal_pesewas: 50000, // default max GH₵ 500.00
                max_daily_withdrawal_pesewas: 200000,
                emergency_withdrawal_freeze: false,
              },
            ],
          };
        }
        if (sql.includes('FROM system_configurations')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: {} as any,
      paymentProvider: {} as any,
      orderService: {} as any,
      stateMachine: {} as any,
      webhookDispatcher: {} as any,
    });

    // Test 5a: Amount below min (1,500 < 2,000 pesewas)
    const minRes = await app.inject({
      method: 'POST',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
      payload: {
        amountPesewas: 1500,
        payoutMethod: 'MTN_MOMO',
        accountNumber: '0241234567',
        accountName: 'Agent Kwesi',
      },
    });
    expect(minRes.statusCode).toBe(400);
    expect(JSON.parse(minRes.payload).message).toContain('Minimum withdrawal amount');

    // Test 5b: Amount exceeding custom override (15,000 > 10,000 pesewas)
    const maxRes = await app.inject({
      method: 'POST',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
      payload: {
        amountPesewas: 15000,
        payoutMethod: 'MTN_MOMO',
        accountNumber: '0241234567',
        accountName: 'Agent Kwesi',
      },
    });
    expect(maxRes.statusCode).toBe(400);
    expect(JSON.parse(maxRes.payload).message).toContain('maximum allowed single withdrawal limit');
  });

  it('6. POST /agents/withdrawals rejects request when admin has paused withdrawals', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE uuid = $1') || sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'agent_user_1', role: UserRole.AGENT, status: 'ACTIVE', wallet_balance_pesewas: 5000 }],
          };
        }
        if (sql.includes('FROM stores')) {
          return { rows: [{ id: 'store_1', store_name: 'FastData Gh', slug: 'fastdata', store_status: 'ACTIVE' }] };
        }
        if (sql.includes('FROM agents WHERE user_id = $1')) {
          return { rows: [{ id: 'agent_1', user_id: 'agent_user_1', custom_withdrawal_limit_pesewas: null }] };
        }
        if (sql.includes('FROM orders o') && sql.includes('o.store_id = $1')) {
          return { rows: [{ total_profit_pesewas: '50000', sales_count: '5', sales_volume_pesewas: '200000' }] };
        }
        if (sql.includes('FROM store_payouts')) {
          return { rows: [{ total_withdrawn_pesewas: '0', pending_withdrawn_pesewas: '0', settled_withdrawn_pesewas: '0' }] };
        }
        if (sql.includes('FROM financial_safety_settings')) {
          return {
            rows: [
              {
                min_withdrawal_pesewas: 1000,
                max_single_withdrawal_pesewas: 500000,
                max_daily_withdrawal_pesewas: 2000000,
                emergency_withdrawal_freeze: true, // ADMIN FREEZE ACTIVE
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    await agentRoutes(app, {
      db: mockDb,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      ledgerService: {} as any,
      paymentProvider: {} as any,
      orderService: {} as any,
      stateMachine: {} as any,
      webhookDispatcher: {} as any,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
      payload: {
        amountPesewas: 5000,
        payoutMethod: 'MTN_MOMO',
        accountNumber: '0241234567',
        accountName: 'Agent Kwesi',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('currently paused');
  });
});
