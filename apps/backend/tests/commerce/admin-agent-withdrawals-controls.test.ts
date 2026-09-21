import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { adminAgentsRoutes } from '../../src/routes/commerce/admin-agents.routes.js';
import { agentRoutes } from '../../src/routes/commerce/agent.routes.js';
import { TokenService } from '../../src/core/security/token.service.js';
import { ApiKeyService } from '../../src/core/security/api-key.service.js';
import { RbacService } from '../../src/core/security/rbac.service.js';
import { AuditService } from '../../src/core/security/audit.service.js';
import { FinancialLedgerService } from '../../src/core/payments/financial-ledger.service.js';
import { PasswordHasher } from '../../src/core/security/password-hasher.js';
import { UserRole, SecurityDomain } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Agent Withdrawal Controls, Schedules, and Mass Configuration Suite', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let mockTokenService: TokenService;
  let mockApiKeyService: ApiKeyService;
  let mockRbacService: RbacService;
  let mockAuditService: AuditService;
  let mockFinancialLedgerService: FinancialLedgerService;
  let mockPasswordHasher: PasswordHasher;

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

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockFinancialLedgerService = {} as unknown as FinancialLedgerService;
    mockPasswordHasher = {} as unknown as PasswordHasher;
  });

  it('1. GET /admin/agents/withdrawal-settings returns the platform policy and schedule window', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM system_configurations')) {
          return {
            rows: [
              { config_key: 'agent_min_withdrawal_pesewas', value: 1500 },
              { config_key: 'agent_max_withdrawal_pesewas', value: 800000 },
              { config_key: 'daily_withdrawal_limit_pesewas', value: 1500000 },
              { config_key: 'agent_withdrawal_schedule_enabled', value: true },
              { config_key: 'agent_withdrawal_allowed_days', value: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
              { config_key: 'agent_withdrawal_start_time', value: '08:00' },
              { config_key: 'agent_withdrawal_end_time', value: '18:00' },
              { config_key: 'allow_agent_withdrawals', value: true },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    await app.register(adminAgentsRoutes, {
      db: mockDb as unknown as pg.Pool,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
      passwordHasher: mockPasswordHasher,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/admin/agents/withdrawal-settings',
      headers: { authorization: 'Bearer admin_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.globalMinWithdrawalPesewas).toBe(1500);
    expect(body.data.globalMaxWithdrawalPesewas).toBe(800000);
    expect(body.data.globalDailyLimitPesewas).toBe(1500000);
    expect(body.data.scheduleEnabled).toBe(true);
    expect(body.data.allowedDays).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    expect(body.data.startTime).toBe('08:00');
    expect(body.data.endTime).toBe('18:00');
  });

  it('2. PUT /admin/agents/withdrawal-settings updates platform policy and logs audit', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO system_configurations')) {
          return { rowCount: 1 };
        }
        if (sql.includes('FROM system_configurations')) {
          return {
            rows: [
              { config_key: 'agent_min_withdrawal_pesewas', value: 2000 },
              { config_key: 'agent_max_withdrawal_pesewas', value: 1000000 },
              { config_key: 'daily_withdrawal_limit_pesewas', value: 2000000 },
              { config_key: 'agent_withdrawal_schedule_enabled', value: true },
              { config_key: 'agent_withdrawal_allowed_days', value: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
              { config_key: 'agent_withdrawal_start_time', value: '07:00' },
              { config_key: 'agent_withdrawal_end_time', value: '20:00' },
              { config_key: 'allow_agent_withdrawals', value: true },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    await app.register(adminAgentsRoutes, {
      db: mockDb as unknown as pg.Pool,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
      passwordHasher: mockPasswordHasher,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/admin/agents/withdrawal-settings',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        globalMinWithdrawalPesewas: 2000,
        globalMaxWithdrawalPesewas: 1000000,
        globalDailyLimitPesewas: 2000000,
        scheduleEnabled: true,
        allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
        startTime: '07:00',
        endTime: '20:00',
        allowAgentWithdrawals: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.globalMinWithdrawalPesewas).toBe(2000);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_AGENT_WITHDRAWAL_POLICY_UPDATED',
      })
    );
  });

  it('3. POST /admin/agents/mass-withdrawal-limits updates batch agents across tier or platform', async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('UPDATE agents SET')) {
          return { rowCount: 12 };
        }
        return { rows: [] };
      }),
    };

    await app.register(adminAgentsRoutes, {
      db: mockDb as unknown as pg.Pool,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
      auditService: mockAuditService,
      financialLedgerService: mockFinancialLedgerService,
      passwordHasher: mockPasswordHasher,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/admin/agents/mass-withdrawal-limits',
      headers: { authorization: 'Bearer admin_token' },
      payload: {
        target: 'TIER',
        agentTier: 'PRO',
        customMinWithdrawalPesewas: 500,
        customDailyLimitPesewas: 2000000,
        withdrawalsEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.updatedCount).toBe(12);
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_AGENT_MASS_WITHDRAWAL_LIMITS_UPDATED',
      })
    );
  });

  it('4. GET /agents/withdrawals returns limits that enforce custom agent limits', async () => {
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
        if (sql.includes('FROM agents')) {
          return {
            rows: [
              {
                id: 'agent_1',
                user_id: 'agent_user_1',
                tier: 'PRO',
                custom_min_withdrawal_pesewas: 500,
                custom_withdrawal_limit_pesewas: 400000,
                custom_daily_limit_pesewas: 300000,
                withdrawals_enabled: true,
                allow_anytime_withdrawals: false,
              },
            ],
          };
        }
        if (sql.includes('FROM system_configurations')) {
          return {
            rows: [
              { config_key: 'agent_min_withdrawal_pesewas', value: 1000 },
              { config_key: 'agent_max_withdrawal_pesewas', value: 500000 },
              { config_key: 'daily_withdrawal_limit_pesewas', value: 500000 },
              { config_key: 'agent_withdrawal_schedule_enabled', value: false }, // schedule disabled
              { config_key: 'allow_agent_withdrawals', value: true },
            ],
          };
        }
        if (sql.includes('FROM store_payouts')) {
          return {
            rows: [{ total_pesewas: '0' }],
          };
        }
        if (sql.includes('FROM orders o')) {
          return {
            rows: [{ total_profit_pesewas: '50000', sales_count: '10', sales_volume_pesewas: '200000' }],
          };
        }
        return { rows: [] };
      }),
    };

    await app.register(agentRoutes, {
      db: mockDb as unknown as pg.Pool,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.limits.minWithdrawalPesewas).toBe(500); // custom override!
    expect(body.data.limits.dailyLimitPesewas).toBe(300000); // custom override!
    expect(body.data.limits.isCustomLimit).toBe(true);
    expect(body.data.limits.withdrawalsPaused).toBe(false);
  });

  it('5. GET /agents/withdrawals allows 24/7 VIP anytime withdrawals even when schedule is closed', async () => {
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
        if (sql.includes('FROM agents')) {
          return {
            rows: [
              {
                id: 'agent_1',
                user_id: 'agent_user_1',
                tier: 'PRO',
                custom_min_withdrawal_pesewas: null,
                custom_withdrawal_limit_pesewas: null,
                custom_daily_limit_pesewas: null,
                withdrawals_enabled: true,
                allow_anytime_withdrawals: true, // VIP access!
              },
            ],
          };
        }
        if (sql.includes('FROM system_configurations')) {
          return {
            rows: [
              { config_key: 'agent_min_withdrawal_pesewas', value: 1000 },
              { config_key: 'agent_max_withdrawal_pesewas', value: 500000 },
              { config_key: 'daily_withdrawal_limit_pesewas', value: 500000 },
              { config_key: 'agent_withdrawal_schedule_enabled', value: true },
              { config_key: 'agent_withdrawal_allowed_days', value: [] }, // no days allowed! window closed
              { config_key: 'agent_withdrawal_start_time', value: '01:00' },
              { config_key: 'agent_withdrawal_end_time', value: '02:00' },
              { config_key: 'allow_agent_withdrawals', value: true },
            ],
          };
        }
        if (sql.includes('FROM store_payouts')) {
          return {
            rows: [{ total_pesewas: '0' }],
          };
        }
        if (sql.includes('FROM orders o')) {
          return {
            rows: [{ total_profit_pesewas: '50000', sales_count: '10', sales_volume_pesewas: '200000' }],
          };
        }
        return { rows: [] };
      }),
    };

    await app.register(agentRoutes, {
      db: mockDb as unknown as pg.Pool,
      tokenService: mockTokenService,
      apiKeyService: mockApiKeyService,
      rbacService: mockRbacService,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/agents/withdrawals',
      headers: { authorization: 'Bearer agent_token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.limits.isWindowOpen).toBe(true);
    expect(body.data.limits.allowAnytimeWithdrawals).toBe(true);
    // VIP bypasses the closed window, so withdrawals are NOT paused for them!
    expect(body.data.limits.withdrawalsPaused).toBe(false);
  });
});
