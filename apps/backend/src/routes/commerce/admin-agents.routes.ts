import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { PasswordHasher } from '../../core/security/password-hasher.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';
import {
  AdminAgentStats,
  AdminAgentListItem,
  AdminAgentDetail,
  CreateAgentAdminRequest,
  UpdateAgentAdminRequest,
  UpdateAgentStatusRequest,
  AgentCustomPricingItemDto,
  UpdateAgentPricingRequest,
  AgentSubAgentSummaryDto,
  AgentCustomerSummaryDto,
  ApiResponse,
  AgentAccountStatus,
  AgentApplicationDto,
  AgentWithdrawalPolicyDto,
  UpdateAgentWithdrawalPolicyRequest,
  MassAgentWithdrawalLimitsRequest,
  MassAgentWithdrawalLimitsResult,
  LedgerAccountType,
  LedgerEntryType,
  Currency,
} from '@bytebeacon/shared';

export interface AdminAgentsRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService: AuditService;
  financialLedgerService?: FinancialLedgerService;
  passwordHasher?: PasswordHasher;
}

export async function adminAgentsRoutes(
  app: FastifyInstance,
  deps: AdminAgentsRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService, auditService, financialLedgerService, passwordHasher } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // Helper to safely format dates
  const safeIsoDate = (d: any): string | undefined => {
    if (!d) return undefined;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  // Helper to map DB row to AdminAgentListItem
  const mapAgentRow = (r: any): AdminAgentListItem => {
    const rawWallet = r.walletBalancePesewas ?? r.wallet_balance_pesewas ?? 0;
    const walletBalancePesewas = Math.round(Number(rawWallet) || 0);

    const agentId = r.id || r.userId || r.user_id;
    const fallbackSlug = `agent-${String(agentId || '').slice(0, 8)}`;

    const customLimit = r.customWithdrawalLimitPesewas ?? r.custom_withdrawal_limit_pesewas;
    const customWithdrawalLimitPesewas = customLimit !== undefined && customLimit !== null
      ? parseInt(String(customLimit), 10)
      : null;

    const customMin = r.customMinWithdrawalPesewas ?? r.custom_min_withdrawal_pesewas;
    const customMinWithdrawalPesewas = customMin !== undefined && customMin !== null
      ? parseInt(String(customMin), 10)
      : null;

    const customDaily = r.customDailyLimitPesewas ?? r.custom_daily_limit_pesewas;
    const customDailyLimitPesewas = customDaily !== undefined && customDaily !== null
      ? parseInt(String(customDaily), 10)
      : null;

    const withdrawalsEnabled = r.withdrawalsEnabled ?? r.withdrawals_enabled ?? true;
    const allowAnytimeWithdrawals = r.allowAnytimeWithdrawals ?? r.allow_anytime_withdrawals ?? false;

    return {
      id: agentId,
      userId: r.userId || r.user_id || agentId,
      fullName: r.fullName || r.full_name || 'Unnamed Agent',
      email: r.email || '',
      phone: r.phone || undefined,
      businessName: r.businessName || r.business_name || r.fullName || r.full_name || 'Individual Reseller',
      slug: r.slug || fallbackSlug,
      status: (r.agentStatus || r.status || 'ACTIVE').toUpperCase(),
      storeStatus: (r.storeStatus || r.store_status || 'NOT_STARTED').toUpperCase(),
      hasStore: Boolean(r.storeId || r.store_id),
      storeName: r.storeName || r.store_name || undefined,
      storeSlug: r.storeSlug || r.store_slug || undefined,
      apiEnabled: Boolean(r.apiAccessEnabled || r.api_access_enabled || (Number(r.activeKeysCount || r.active_keys_count || 0) > 0)),
      activeKeysCount: parseInt(r.activeKeysCount || r.active_keys_count || '0', 10),
      walletBalancePesewas,
      ordersCount: parseInt(r.ordersCount || r.orders_count || '0', 10),
      revenuePesewas: parseInt(r.revenuePesewas || r.revenue_pesewas || '0', 10),
      subAgentsCount: parseInt(r.subAgentsCount || r.sub_agents_count || '0', 10),
      agentTier: r.agentTier || r.agent_tier || 'STANDARD',
      customWithdrawalLimitPesewas,
      customMinWithdrawalPesewas,
      customDailyLimitPesewas,
      withdrawalsEnabled: Boolean(withdrawalsEnabled),
      allowAnytimeWithdrawals: Boolean(allowAnytimeWithdrawals),
      createdAt: safeIsoDate(r.createdAt || r.created_at) || new Date().toISOString(),
      lastActiveAt: safeIsoDate(r.lastActiveAt || r.last_active_at || r.lastLoginAt || r.last_login_at || r.updatedAt || r.updated_at),
    };
  };

  // 1. GET AGENT STATS (/admin/agents/stats)
  app.get(
    '/admin/agents/stats',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const statsQuery = `
          SELECT
            COUNT(DISTINCT COALESCE(a.id, u.id)) as "totalAgents",
            COUNT(DISTINCT COALESCE(a.id, u.id)) FILTER (WHERE UPPER(COALESCE(u.status, 'ACTIVE')) = 'ACTIVE' AND UPPER(COALESCE(a.status, 'ACTIVE')) = 'ACTIVE') as "activeAgents",
            COUNT(DISTINCT COALESCE(a.id, u.id)) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'SUSPENDED' OR UPPER(COALESCE(a.status, '')) = 'SUSPENDED') as "suspendedAgents",
            COUNT(DISTINCT COALESCE(a.id, u.id)) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'PENDING' OR UPPER(COALESCE(a.status, '')) = 'PENDING') as "pendingAgents",
            COUNT(DISTINCT s.id) FILTER (WHERE UPPER(COALESCE(s.store_status, '')) = 'ACTIVE') as "agentsWithStores",
            COUNT(DISTINCT k.agent_id) FILTER (WHERE UPPER(COALESCE(k.status, '')) = 'ACTIVE') as "agentsWithApi",
            COALESCE(SUM(u.wallet_balance_pesewas), 0) as "totalWalletFloatPesewas",
            COALESCE((
              SELECT SUM(amount_pesewas)
              FROM orders
              WHERE (agent_id IS NOT NULL OR user_id IN (SELECT id FROM users WHERE LOWER(COALESCE(role::text, '')) IN ('agent', 'superagent', 'reseller') OR security_domain = 'AGENT'))
                AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'
            ), 0) as "totalRevenuePesewas"
          FROM users u
          LEFT JOIN agents a ON a.user_id = u.id
          LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
          LEFT JOIN api_keys k ON k.agent_id = u.id AND k.status = 'ACTIVE'
          WHERE LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller')
             OR u.security_domain = 'AGENT'
             OR a.id IS NOT NULL
        `;

        const res = await db.query(statsQuery).catch(async (err) => {
          logger.warn({ err }, '[ADMIN_AGENTS] Primary agent stats query failed, attempting fallback');
          return db.query(`
            SELECT
              COUNT(DISTINCT a.id) as "totalAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, 'ACTIVE')) = 'ACTIVE' AND UPPER(COALESCE(a.status, 'ACTIVE')) = 'ACTIVE') as "activeAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'SUSPENDED' OR UPPER(COALESCE(a.status, '')) = 'SUSPENDED') as "suspendedAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'PENDING' OR UPPER(COALESCE(a.status, '')) = 'PENDING') as "pendingAgents",
              COUNT(DISTINCT s.id) FILTER (WHERE UPPER(COALESCE(s.store_status, '')) = 'ACTIVE') as "agentsWithStores",
              COUNT(DISTINCT k.agent_id) FILTER (WHERE UPPER(COALESCE(k.status, '')) = 'ACTIVE') as "agentsWithApi",
              COALESCE(SUM(u.wallet_balance_pesewas), 0) as "totalWalletFloatPesewas",
              COALESCE((
                SELECT SUM(amount_pesewas)
                FROM orders
                WHERE agent_id IS NOT NULL
                  AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'
              ), 0) as "totalRevenuePesewas"
            FROM agents a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN stores s ON s.agent_id = a.id
            LEFT JOIN api_keys k ON k.agent_id = u.id AND k.status = 'ACTIVE'
          `);
        });

        const row = res.rows[0] || {};

        const stats: AdminAgentStats = {
          totalAgents: parseInt(row.totalAgents || '0', 10),
          activeAgents: parseInt(row.activeAgents || '0', 10),
          suspendedAgents: parseInt(row.suspendedAgents || '0', 10),
          pendingAgents: parseInt(row.pendingAgents || '0', 10),
          agentsWithStores: parseInt(row.agentsWithStores || '0', 10),
          agentsWithApi: parseInt(row.agentsWithApi || '0', 10),
          totalWalletFloatPesewas: parseInt(row.totalWalletFloatPesewas || '0', 10),
          totalRevenuePesewas: parseInt(row.totalRevenuePesewas || '0', 10),
        };

        const response: ApiResponse<AdminAgentStats> = {
          success: true,
          data: stats,
        };

        return reply.send(response);
      } catch (err) {
        logger.error({ err }, '[ADMIN_AGENTS] Error computing admin agents stats');
        return reply.send({
          success: true,
          data: {
            totalAgents: 0,
            activeAgents: 0,
            suspendedAgents: 0,
            pendingAgents: 0,
            agentsWithStores: 0,
            agentsWithApi: 0,
            totalWalletFloatPesewas: 0,
            totalRevenuePesewas: 0,
          },
        });
      }
    },
  );

  // 2. LIST AGENTS WITH MULTI-FILTERING & SEARCH (/admin/agents)
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
      store?: string;
      api?: string;
      financial?: string;
      dateRange?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/agents',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        search,
        status = 'ALL',
        store = 'ALL',
        api = 'ALL',
        financial = 'ALL',
        dateRange = 'ALL',
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const params: any[] = [];
      let paramIdx = 1;

      let whereConditions: string[] = ['1=1'];

      if (search && search.trim()) {
        const q = `%${search.trim().toLowerCase()}%`;
        whereConditions.push(`(
          LOWER(COALESCE(u.full_name, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(u.email, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(u.phone, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(a.business_name, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(a.slug, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(s.store_name, '')) LIKE $${paramIdx} OR
          LOWER(COALESCE(s.slug, '')) LIKE $${paramIdx} OR
          COALESCE(a.id, u.id)::text LIKE $${paramIdx}
        )`);
        params.push(q);
        paramIdx++;
      }

      if (status !== 'ALL') {
        whereConditions.push(`(UPPER(COALESCE(a.status, u.status, '')) = $${paramIdx})`);
        params.push(status.toUpperCase());
        paramIdx++;
      }

      if (store === 'HAS_STORE') {
        whereConditions.push(`s.id IS NOT NULL`);
      } else if (store === 'NO_STORE') {
        whereConditions.push(`s.id IS NULL`);
      } else if (store === 'ACTIVE_STORE') {
        whereConditions.push(`s.store_status = 'ACTIVE'`);
      } else if (store === 'PENDING_STORE') {
        whereConditions.push(`(s.store_status = 'PENDING' OR s.approval_status = 'AWAITING_APPROVAL')`);
      } else if (store === 'SUSPENDED_STORE') {
        whereConditions.push(`s.store_status = 'SUSPENDED'`);
      }

      if (api === 'ENABLED') {
        whereConditions.push(`(a.api_access_enabled = TRUE OR COALESCE(k.key_count, 0) > 0)`);
      } else if (api === 'DISABLED') {
        whereConditions.push(`((a.api_access_enabled IS NULL OR a.api_access_enabled = FALSE) AND (k.key_count IS NULL OR k.key_count = 0))`);
      }

      if (financial === 'POSITIVE') {
        whereConditions.push(`(COALESCE(u.wallet_balance_pesewas, 0) > 0)`);
      } else if (financial === 'ZERO') {
        whereConditions.push(`(COALESCE(u.wallet_balance_pesewas, 0) = 0)`);
      } else if (financial === 'NEGATIVE') {
        whereConditions.push(`(COALESCE(u.wallet_balance_pesewas, 0) < 0)`);
      }

      if (dateRange === '7d') {
        whereConditions.push(`COALESCE(a.created_at, u.created_at) >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
      } else if (dateRange === '30d') {
        whereConditions.push(`COALESCE(a.created_at, u.created_at) >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
      } else if (dateRange === '90d') {
        whereConditions.push(`COALESCE(a.created_at, u.created_at) >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
      }

      const whereClause = whereConditions.join(' AND ');

      const countQuery = `
        SELECT COUNT(DISTINCT COALESCE(a.id, u.id)) as total
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        LEFT JOIN (
          SELECT agent_id as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY agent_id
        ) k ON k.uid = u.id
        WHERE (LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller') OR u.security_domain = 'AGENT' OR a.id IS NOT NULL)
          AND ${whereClause}
      `;

      const countRes = await db.query(countQuery, params).catch((err) => {
        logger.error({ err }, '[ADMIN_AGENTS] Error counting agents');
        return { rows: [{ total: '0' }] };
      });
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listQuery = `
        SELECT
          COALESCE(a.id, u.id) as id,
          u.id as "userId",
          COALESCE(u.full_name, 'Unnamed Agent') as "fullName",
          u.email,
          u.phone,
          COALESCE(a.business_name, u.full_name, 'Individual Reseller') as "businessName",
          COALESCE(a.slug, s.slug, 'agent-' || SUBSTRING(u.id::text, 1, 8)) as slug,
          COALESCE(a.status, u.status, 'ACTIVE') as "agentStatus",
          COALESCE(s.store_status, 'NOT_STARTED') as "storeStatus",
          s.id as "storeId",
          s.store_name as "storeName",
          s.slug as "storeSlug",
          COALESCE(a.api_access_enabled, (COALESCE(k.key_count, 0) > 0), FALSE) as "apiAccessEnabled",
          COALESCE(k.key_count, 0) as "activeKeysCount",
          COALESCE(u.wallet_balance_pesewas, 0) as "walletBalancePesewas",
          COALESCE(o.orders_count, 0) as "ordersCount",
          COALESCE(o.revenue_pesewas, 0) as "revenuePesewas",
          COALESCE(sub.sub_count, 0) as "subAgentsCount",
          COALESCE(a.agent_tier, 'STANDARD') as "agentTier",
          a.custom_withdrawal_limit_pesewas as "customWithdrawalLimitPesewas",
          a.custom_min_withdrawal_pesewas as "customMinWithdrawalPesewas",
          a.custom_daily_limit_pesewas as "customDailyLimitPesewas",
          COALESCE(a.withdrawals_enabled, TRUE) as "withdrawalsEnabled",
          COALESCE(a.allow_anytime_withdrawals, FALSE) as "allowAnytimeWithdrawals",
          COALESCE(a.created_at, u.created_at) as "createdAt",
          COALESCE(u.last_login_at, u.updated_at, u.created_at) as "lastActiveAt"
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        LEFT JOIN (
          SELECT agent_id as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY agent_id
        ) k ON k.uid = u.id
        LEFT JOIN (
          SELECT COALESCE(agent_id, user_id) as aid, COUNT(*) as orders_count,
                 SUM(CASE WHEN order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED' THEN amount_pesewas ELSE 0 END) as revenue_pesewas
          FROM orders
          WHERE payment_status = 'PAID'
          GROUP BY COALESCE(agent_id, user_id)
        ) o ON (o.aid = a.id OR o.aid = u.id)
        LEFT JOIN (
          SELECT parent_agent_id, COUNT(*) as sub_count
          FROM agents
          WHERE parent_agent_id IS NOT NULL
          GROUP BY parent_agent_id
        ) sub ON sub.parent_agent_id = a.id
        WHERE (LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller') OR u.security_domain = 'AGENT' OR a.id IS NOT NULL)
          AND ${whereClause}
        ORDER BY COALESCE(a.created_at, u.created_at) DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;

      params.push(limitNum, offset);
      const listRes = await db.query(listQuery, params).catch((err) => {
        logger.error({ err }, '[ADMIN_AGENTS] Error querying agents list');
        return { rows: [] };
      });

      const items = listRes.rows.map(mapAgentRow);

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    },
  );

  // 3. GET AGENT DOSSIER (/admin/agents/:id)
  app.get<{ Params: { id: string } }>(
    '/admin/agents/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const agentQuery = `
        SELECT
          COALESCE(a.id, u.id) as id,
          u.id as "userId",
          COALESCE(u.full_name, 'Unnamed Agent') as "fullName",
          u.email,
          u.phone,
          COALESCE(a.business_name, u.full_name, 'Individual Reseller') as "businessName",
          COALESCE(a.slug, s.slug, 'agent-' || SUBSTRING(u.id::text, 1, 8)) as slug,
          COALESCE(a.status, u.status, 'ACTIVE') as "agentStatus",
          COALESCE(s.store_status, 'NOT_STARTED') as "storeStatus",
          s.id as "storeId",
          s.store_name as "storeName",
          s.slug as "storeSlug",
          COALESCE(a.api_access_enabled, (COALESCE(k.key_count, 0) > 0), FALSE) as "apiAccessEnabled",
          COALESCE(k.key_count, 0) as "activeKeysCount",
          COALESCE(u.wallet_balance_pesewas, 0) as "walletBalancePesewas",
          COALESCE(o.orders_count, 0) as "ordersCount",
          COALESCE(o.revenue_pesewas, 0) as "revenuePesewas",
          COALESCE(sub.sub_count, 0) as "subAgentsCount",
          COALESCE(a.agent_tier, 'STANDARD') as "agentTier",
          a.custom_withdrawal_limit_pesewas as "customWithdrawalLimitPesewas",
          a.custom_min_withdrawal_pesewas as "customMinWithdrawalPesewas",
          a.custom_daily_limit_pesewas as "customDailyLimitPesewas",
          COALESCE(a.withdrawals_enabled, TRUE) as "withdrawalsEnabled",
          COALESCE(a.allow_anytime_withdrawals, FALSE) as "allowAnytimeWithdrawals",
          COALESCE(a.created_at, u.created_at) as "createdAt",
          COALESCE(u.last_login_at, u.updated_at, u.created_at) as "lastActiveAt"
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        LEFT JOIN (
          SELECT agent_id as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY agent_id
        ) k ON k.uid = u.id
        LEFT JOIN (
          SELECT COALESCE(agent_id, user_id) as aid, COUNT(*) as orders_count, SUM(amount_pesewas) as revenue_pesewas
          FROM orders
          WHERE payment_status = 'PAID'
            AND order_status IN ('COMPLETED', 'DELIVERED')
            AND COALESCE(refund_status, 'NONE') NOT IN ('COMPLETED', 'REFUNDED')
          GROUP BY COALESCE(agent_id, user_id)
        ) o ON (o.aid = a.id OR o.aid = u.id)
        LEFT JOIN (
          SELECT parent_agent_id, COUNT(*) as sub_count
          FROM agents
          WHERE parent_agent_id IS NOT NULL
          GROUP BY parent_agent_id
        ) sub ON sub.parent_agent_id = a.id
        WHERE a.id::text = $1 OR a.user_id::text = $1 OR u.id::text = $1 OR a.slug = $1 OR s.slug = $1
      `;

      const agentRes = await db.query(agentQuery, [id]).catch((err) => {
        logger.error({ err, id }, '[ADMIN_AGENTS] Failed to query agent base dossier');
        return { rows: [] };
      });

      if (agentRes.rows.length === 0) {
        throw new NotFoundError(`Agent not found with identifier '${id}'`);
      }

      const agentItem = mapAgentRow(agentRes.rows[0]);
      const agentId = agentItem.id;
      const userId = agentItem.userId;

      // 1. Wallet ledger derived metrics
      const ledgerQuery = `
        SELECT
          COALESCE(SUM(amount_pesewas) FILTER (WHERE entry_type = 'CREDIT'), 0) -
          COALESCE(SUM(amount_pesewas) FILTER (WHERE entry_type = 'DEBIT'), 0) as "ledgerBalancePesewas",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE account_type = 'CUSTOMER_WALLET' AND entry_type = 'CREDIT'), 0) as "totalDepositsPesewas",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE account_type = 'CUSTOMER_WALLET' AND entry_type = 'DEBIT'), 0) as "totalSpentPesewas",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE account_type = 'MERCHANT_PAYOUT' AND entry_type = 'DEBIT'), 0) as "totalWithdrawalsPesewas",
          COALESCE(SUM(amount_pesewas) FILTER (WHERE account_type = 'PLATFORM_ESCROW' AND entry_type = 'CREDIT'), 0) as "totalRefundsPesewas"
        FROM financial_ledger
        WHERE account_id::text = $1 OR account_id::text = $2
      `;
      const ledgerRes = await db.query(ledgerQuery, [userId, agentId]).catch(() => ({ rows: [{}] }));
      const ledgerRow = ledgerRes.rows[0] || {};

      // 2. Orders summary
      const ordersSumQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE order_status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE order_status IN ('SUBMITTED', 'PROCESSING', 'READY_FOR_FULFILLMENT', 'CREATED', 'VALIDATING')) as processing,
          COUNT(*) FILTER (WHERE order_status = 'FAILED' OR order_status = 'CANCELLED') as failed,
          COUNT(*) FILTER (WHERE order_status = 'REFUNDED') as refunded
        FROM orders
        WHERE agent_id::text = $1 OR user_id::text = $2
      `;
      const ordersSumRes = await db.query(ordersSumQuery, [agentId, userId]).catch(() => ({ rows: [{}] }));
      const os = ordersSumRes.rows[0] || {};

      // 3. API summary
      const apiSumQuery = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as "activeKeys",
          MAX(last_used_at) as "lastRequestAt"
        FROM api_keys
        WHERE agent_id = $1
      `;
      const apiSumRes = await db.query(apiSumQuery, [userId]).catch(() => ({ rows: [{}] }));
      const as = apiSumRes.rows[0] || {};

      // 4. Store summary
      const storeRes = await db.query(
        `SELECT s.id, s.store_name as "storeName", s.slug,
                s.tagline, s.description, s.logo_url as "logoUrl", s.banner_url as "bannerUrl",
                s.primary_color as "primaryColor", s.accent_color as "accentColor",
                s.contact_email as "contactEmail", s.contact_phone as "contactPhone", s.contact_whatsapp as "contactWhatsapp",
                s.payment_status as "paymentStatus", s.activation_fee_pesewas as "activationFeePesewas",
                COALESCE(s.store_status, 'ACTIVE') as "storeStatus",
                COALESCE(s.approval_status, 'APPROVED') as "approvalStatus",
                COALESCE((SELECT COUNT(*) FROM store_products WHERE store_id = s.id), 0) as "productsCount",
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (store_id = s.id OR agent_id = s.agent_id) AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'), 0) as "totalSalesPesewas"
          FROM stores s
          WHERE s.agent_id::text = $1 OR s.user_id::text = $2`,
        [agentId, userId],
      ).catch(async () => {
        return db.query(
          `SELECT s.id, s.store_name as "storeName", s.slug,
                  COALESCE(s.status, 'ACTIVE') as "storeStatus",
                  COALESCE(s.status, 'APPROVED') as "approvalStatus",
                  COALESCE((SELECT COUNT(*) FROM store_products WHERE store_id = s.id), 0) as "productsCount",
                  COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (store_id = s.id OR agent_id = s.agent_id) AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'), 0) as "totalSalesPesewas"
            FROM agent_stores s
            WHERE s.agent_id::text = $1 OR s.user_id::text = $2`,
          [agentId, userId],
        ).catch(() => ({ rows: [] }));
      });

      const storeSummary = storeRes.rows[0] ? {
        id: storeRes.rows[0].id,
        storeName: storeRes.rows[0].storeName,
        slug: storeRes.rows[0].slug,
        tagline: storeRes.rows[0].tagline || undefined,
        description: storeRes.rows[0].description || undefined,
        logoUrl: storeRes.rows[0].logoUrl || undefined,
        bannerUrl: storeRes.rows[0].bannerUrl || undefined,
        primaryColor: storeRes.rows[0].primaryColor || '#0066FF',
        accentColor: storeRes.rows[0].accentColor || '#00E599',
        contactEmail: storeRes.rows[0].contactEmail || undefined,
        contactPhone: storeRes.rows[0].contactPhone || undefined,
        contactWhatsapp: storeRes.rows[0].contactWhatsapp || undefined,
        paymentStatus: storeRes.rows[0].paymentStatus || 'PAID',
        activationFeePesewas: parseInt(storeRes.rows[0].activationFeePesewas || '50000', 10),
        storeStatus: storeRes.rows[0].storeStatus,
        approvalStatus: storeRes.rows[0].approvalStatus,
        totalSalesPesewas: parseInt(storeRes.rows[0].totalSalesPesewas || '0', 10),
        productsCount: parseInt(storeRes.rows[0].productsCount || '0', 10),
      } : undefined;

      // 5. Sub-agents
      const subAgentsRes = await db.query(
        `SELECT a.id, a.user_id as "userId", COALESCE(u.full_name, 'Unnamed') as "fullName",
                u.email, u.phone, a.business_name as "businessName", COALESCE(a.status, 'ACTIVE') as status,
                COALESCE(u.wallet_balance_pesewas, 0) as "walletBalancePesewas",
                COALESCE((SELECT COUNT(*) FROM orders WHERE agent_id = a.id), 0) as "ordersCount",
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE agent_id = a.id AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'), 0) as "revenuePesewas",
                a.created_at as "createdAt"
         FROM agents a
         JOIN users u ON a.user_id = u.id
         WHERE a.parent_agent_id = $1
         ORDER BY a.created_at DESC`,
        [agentId],
      ).catch(() => ({ rows: [] }));

      const subAgents: AgentSubAgentSummaryDto[] = subAgentsRes.rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone || undefined,
        businessName: r.businessName,
        status: r.status,
        walletBalancePesewas: typeof r.walletBalancePesewas === 'string'
          ? Math.round(parseFloat(r.walletBalancePesewas) * 100)
          : Math.round(Number(r.walletBalancePesewas || 0)),
        ordersCount: parseInt(r.ordersCount || '0', 10),
        revenuePesewas: parseInt(r.revenuePesewas || '0', 10),
        createdAt: safeIsoDate(r.createdAt) || new Date().toISOString(),
      }));

      // 6. Customers
      const customersRes = await db.query(
        `SELECT ac.id, ac.customer_id as "customerId", COALESCE(u.full_name, 'Customer') as "fullName",
                u.email, u.phone,
                COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = u.id AND agent_id = $1), 0) as "ordersCount",
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE user_id = u.id AND agent_id = $1 AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'), 0) as "spentPesewas",
                (SELECT MAX(created_at) FROM orders WHERE user_id = u.id AND agent_id = $1) as "lastOrderDate",
                ac.created_at as "createdAt"
         FROM agent_customers ac
         JOIN users u ON ac.customer_id = u.id
         WHERE ac.agent_id = $1
         ORDER BY ac.created_at DESC
         LIMIT 20`,
        [agentId],
      ).catch(() => ({ rows: [] }));

      const customers: AgentCustomerSummaryDto[] = customersRes.rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone || undefined,
        ordersCount: parseInt(r.ordersCount || '0', 10),
        spentPesewas: parseInt(r.spentPesewas || '0', 10),
        lastOrderDate: safeIsoDate(r.lastOrderDate),
        createdAt: safeIsoDate(r.createdAt) || new Date().toISOString(),
      }));

      // 7. Custom pricing
      const pricingRes = await db.query(
        `SELECT cp.id as "productId", cp.name as "productName", cp.sku, cp.network,
                cp.data_amount_mb as "dataAmountMb", cp.base_price_pesewas as "basePricePesewas",
                cp.agent_price_pesewas as "defaultAgentPricePesewas",
                ap.id as "pricingId", ap.custom_price_pesewas as "customPricePesewas",
                COALESCE(ap.is_active, TRUE) as "isActive", ap.updated_at as "updatedAt"
         FROM catalog_products cp
         LEFT JOIN agent_pricing ap ON ap.product_id = cp.id AND ap.agent_id = $1
         WHERE cp.is_active = TRUE
         ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [agentId],
      ).catch(async () => {
        return db.query(`
          SELECT id as "productId", name as "productName", sku, network,
                 data_amount_mb as "dataAmountMb", base_price_pesewas as "basePricePesewas",
                 agent_price_pesewas as "defaultAgentPricePesewas",
                 NULL as "pricingId", NULL as "customPricePesewas",
                 TRUE as "isActive", updated_at as "updatedAt"
          FROM catalog_products
          WHERE is_active = TRUE
          ORDER BY network ASC, data_amount_mb ASC
        `).catch(() => ({ rows: [] }));
      });

      const customPricing: AgentCustomPricingItemDto[] = pricingRes.rows.map((r) => {
        const defaultAgent = parseInt(r.defaultAgentPricePesewas || r.basePricePesewas || '0', 10);
        const customPrice = r.customPricePesewas ? parseInt(r.customPricePesewas, 10) : null;
        return {
          id: r.pricingId || undefined,
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          network: r.network,
          dataAmountMb: parseInt(r.dataAmountMb || '0', 10),
          defaultAgentPricePesewas: defaultAgent,
          basePricePesewas: parseInt(r.basePricePesewas || '0', 10),
          customPricePesewas: customPrice,
          effectivePricePesewas: customPrice !== null ? customPrice : defaultAgent,
          isActive: Boolean(r.isActive),
          updatedAt: safeIsoDate(r.updatedAt),
        };
      });

      // 8. Recent orders
      const ordersRes = await db.query(
        `SELECT id, public_id as "publicId", recipient_phone as "recipientPhone", network,
                data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                order_status as "orderStatus", payment_status as "paymentStatus",
                COALESCE(provider_status, 'COMPLETED') as "providerStatus", created_at as "createdAt"
         FROM orders
         WHERE agent_id::text = $1 OR user_id::text = $2
         ORDER BY created_at DESC
         LIMIT 20`,
        [agentId, userId],
      ).catch(() => ({ rows: [] }));

      // 9. Audit logs
      const auditRes = await db.query(
        `SELECT id, correlation_id as "correlationId", action, resource_type as "resourceType",
                metadata, created_at as "occurredAt"
         FROM audit_logs
         WHERE actor_id::text = $1 OR resource_id::text = $1 OR resource_id::text = $2
         ORDER BY created_at DESC
         LIMIT 15`,
        [userId, agentId],
      ).catch(() => ({ rows: [] }));

      const detail: AdminAgentDetail = {
        agent: agentItem,
        wallet: {
          balancePesewas: agentItem.walletBalancePesewas,
          ledgerBalancePesewas: parseInt(ledgerRow.ledgerBalancePesewas || '0', 10),
          totalDepositsPesewas: parseInt(ledgerRow.totalDepositsPesewas || '0', 10),
          totalSpentPesewas: parseInt(ledgerRow.totalSpentPesewas || '0', 10),
          totalRevenuePesewas: agentItem.revenuePesewas,
          totalWithdrawalsPesewas: parseInt(ledgerRow.totalWithdrawalsPesewas || '0', 10),
          totalRefundsPesewas: parseInt(ledgerRow.totalRefundsPesewas || '0', 10),
        },
        ordersSummary: {
          total: parseInt(os.total || '0', 10),
          completed: parseInt(os.completed || '0', 10),
          processing: parseInt(os.processing || '0', 10),
          failed: parseInt(os.failed || '0', 10),
          refunded: parseInt(os.refunded || '0', 10),
        },
        apiSummary: {
          enabled: agentItem.apiEnabled,
          activeKeys: parseInt(as.activeKeys || '0', 10),
          totalRequests30d: 0,
          successRate: 100.0,
          lastRequestAt: safeIsoDate(as.lastRequestAt),
        },
        storeSummary,
        subAgents,
        customers,
        customPricing,
        recentOrders: ordersRes.rows,
        auditLogs: auditRes.rows,
      };

      return reply.send({
        success: true,
        data: detail,
      });
    },
  );

  // 4. CREATE AGENT WITH RBAC VALIDATION (/admin/agents)
  app.post<{ Body: CreateAgentAdminRequest }>(
    '/admin/agents',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { fullName, email, phone, businessName, slug, agentTier = 'STANDARD', initialPassword = 'TempPassword123!', enableApiAccess = false } = req.body || {};

      if (!fullName || !email || !phone || !businessName || !slug) {
        throw new BadRequestError('Full name, email, phone, business name, and store slug are required.');
      }

      // Check existing email
      const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('A user with this email address already exists.');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const existingSlug = await db.query('SELECT id FROM agents WHERE slug = $1', [cleanSlug]);
      if (existingSlug.rows.length > 0) {
        throw new ConflictError(`The agent storefront slug '${cleanSlug}' is already taken.`);
      }

      let passwordHash = '$2b$12$e8/W08g1qjB34L/0G.sJz.Xp3Hj6V1xY6rY8H1l1cQ7a3d9e0F5G6';
      if (passwordHasher) {
        passwordHash = await passwordHasher.hashPassword(initialPassword);
      }

      // Create user
      const userRes = await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, security_domain, status, wallet_balance_pesewas)
         VALUES ($1, $2, $3, $4, 'agent', 'AGENT', 'ACTIVE', 0)
         RETURNING id, email, phone, full_name as "fullName", created_at as "createdAt"`,
        [fullName.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash],
      );
      const newUser = userRes.rows[0];

      // Create agent
      const agentRes = await db.query(
        `INSERT INTO agents (user_id, business_name, slug, agent_tier, status, api_access_enabled, is_active)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, TRUE)
         RETURNING id, user_id as "userId", business_name as "businessName", slug, agent_tier as "agentTier",
                   status, api_access_enabled as "apiAccessEnabled", created_at as "createdAt"`,
        [newUser.id, businessName.trim(), cleanSlug, agentTier, enableApiAccess],
      );
      const newAgent = agentRes.rows[0];

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_CREATE_AGENT',
          resourceType: 'agents',
          resourceId: newAgent.id,
          metadata: { userId: newUser.id, businessName: newAgent.businessName, slug: newAgent.slug, tier: agentTier },
          ipAddress: req.ip,
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          id: newAgent.id,
          userId: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          phone: newUser.phone,
          businessName: newAgent.businessName,
          slug: newAgent.slug,
          status: 'ACTIVE',
          agentTier,
          apiEnabled: enableApiAccess,
          createdAt: safeIsoDate(newAgent.createdAt) || new Date().toISOString(),
        },
        message: 'Agent account created successfully.',
      });
    },
  );

  // 5. UPDATE AGENT PROFILE (/admin/agents/:id)
  app.put<{ Params: { id: string }; Body: UpdateAgentAdminRequest }>(
    '/admin/agents/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const {
        fullName,
        phone,
        businessName,
        slug,
        agentTier,
        commissionRate,
        enableApiAccess,
        customWithdrawalLimitPesewas,
        customMinWithdrawalPesewas,
        customDailyLimitPesewas,
        withdrawalsEnabled,
        allowAnytimeWithdrawals,
      } = req.body || {};

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId", a.slug, COALESCE(a.business_name, u.full_name) as "businessName"
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1 OR a.slug = $1`,
        [id],
      );
      if (lookupRes.rows.length === 0) {
        throw new NotFoundError(`Agent not found with ID '${id}'`);
      }

      const agent = lookupRes.rows[0];
      const targetUserId = agent.userId;
      let targetAgentId = agent.agentId;

      if (!targetAgentId) {
        const cleanDefaultSlug = `agent-${String(targetUserId).slice(0, 8)}`;
        const insAgent = await db.query(
          `INSERT INTO agents (user_id, business_name, slug, agent_tier, status, is_active)
           VALUES ($1, $2, $3, 'STANDARD', 'ACTIVE', TRUE)
           ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [targetUserId, businessName?.trim() || 'Individual Reseller', cleanDefaultSlug],
        );
        targetAgentId = insAgent.rows[0]?.id;
      }

      if (slug && slug !== agent.slug) {
        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const slugCheck = await db.query('SELECT id FROM agents WHERE slug = $1 AND id != $2', [cleanSlug, targetAgentId]);
        if (slugCheck.rows.length > 0) {
          throw new ConflictError(`Slug '${cleanSlug}' is already registered by another merchant.`);
        }
      }

      if (fullName || phone) {
        await db.query(
          `UPDATE users
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [fullName?.trim(), phone?.trim(), targetUserId],
        );
      }

      const hasCustomLimit = customWithdrawalLimitPesewas !== undefined;
      const parsedCustomLimit = customWithdrawalLimitPesewas === null
        ? null
        : (customWithdrawalLimitPesewas !== undefined ? parseInt(String(customWithdrawalLimitPesewas), 10) : null);

      const hasCustomMin = customMinWithdrawalPesewas !== undefined;
      const parsedCustomMin = customMinWithdrawalPesewas === null
        ? null
        : (customMinWithdrawalPesewas !== undefined ? parseInt(String(customMinWithdrawalPesewas), 10) : null);

      const hasCustomDaily = customDailyLimitPesewas !== undefined;
      const parsedCustomDaily = customDailyLimitPesewas === null
        ? null
        : (customDailyLimitPesewas !== undefined ? parseInt(String(customDailyLimitPesewas), 10) : null);

      const hasWithdrawalsEnabled = withdrawalsEnabled !== undefined;
      const parsedWithdrawalsEnabled = withdrawalsEnabled !== undefined ? Boolean(withdrawalsEnabled) : true;

      const hasAllowAnytime = allowAnytimeWithdrawals !== undefined;
      const parsedAllowAnytime = allowAnytimeWithdrawals !== undefined ? Boolean(allowAnytimeWithdrawals) : false;

      const updateAgentRes = await db.query(
        `UPDATE agents
         SET business_name = COALESCE($1, business_name),
             slug = COALESCE($2, slug),
             agent_tier = COALESCE($3, agent_tier),
             commission_rate = COALESCE($4, commission_rate),
             api_access_enabled = COALESCE($5, api_access_enabled),
             custom_withdrawal_limit_pesewas = CASE WHEN $6 = TRUE THEN $7::bigint ELSE custom_withdrawal_limit_pesewas END,
             custom_min_withdrawal_pesewas = CASE WHEN $8 = TRUE THEN $9::bigint ELSE custom_min_withdrawal_pesewas END,
             custom_daily_limit_pesewas = CASE WHEN $10 = TRUE THEN $11::bigint ELSE custom_daily_limit_pesewas END,
             withdrawals_enabled = CASE WHEN $12 = TRUE THEN $13::boolean ELSE withdrawals_enabled END,
             allow_anytime_withdrawals = CASE WHEN $14 = TRUE THEN $15::boolean ELSE allow_anytime_withdrawals END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $16
         RETURNING id, user_id as "userId", business_name as "businessName", slug,
                   agent_tier as "agentTier", status, api_access_enabled as "apiAccessEnabled",
                   commission_rate as "commissionRate",
                   custom_withdrawal_limit_pesewas as "customWithdrawalLimitPesewas",
                   custom_min_withdrawal_pesewas as "customMinWithdrawalPesewas",
                   custom_daily_limit_pesewas as "customDailyLimitPesewas",
                   withdrawals_enabled as "withdrawalsEnabled",
                   allow_anytime_withdrawals as "allowAnytimeWithdrawals",
                   updated_at as "updatedAt"`,
        [
          businessName?.trim(),
          slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') : undefined,
          agentTier,
          commissionRate,
          enableApiAccess,
          hasCustomLimit,
          parsedCustomLimit,
          hasCustomMin,
          parsedCustomMin,
          hasCustomDaily,
          parsedCustomDaily,
          hasWithdrawalsEnabled,
          parsedWithdrawalsEnabled,
          hasAllowAnytime,
          parsedAllowAnytime,
          targetAgentId,
        ],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_UPDATE_AGENT',
          resourceType: 'agents',
          resourceId: targetAgentId,
          metadata: {
            businessName,
            slug,
            agentTier,
            enableApiAccess,
            customWithdrawalLimitPesewas: parsedCustomLimit,
            customMinWithdrawalPesewas: parsedCustomMin,
            customDailyLimitPesewas: parsedCustomDaily,
            withdrawalsEnabled: hasWithdrawalsEnabled ? parsedWithdrawalsEnabled : undefined,
            allowAnytimeWithdrawals: hasAllowAnytime ? parsedAllowAnytime : undefined,
          },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: updateAgentRes.rows[0],
        message: 'Agent profile updated successfully.',
      });
    },
  );

  // 6. UPDATE AGENT STATUS (/admin/agents/:id/status)
  app.patch<{ Params: { id: string }; Body: UpdateAgentStatusRequest }>(
    '/admin/agents/:id/status',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { status, reason } = req.body || {};

      if (!status || !reason || reason.trim().length < 4) {
        throw new BadRequestError('Valid status and a mandatory reason (min 4 chars) are required.');
      }

      const validStatuses = Object.values(AgentAccountStatus);
      if (!validStatuses.includes(status)) {
        throw new BadRequestError(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
      }

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId", COALESCE(a.status, u.status) as status
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1 OR a.slug = $1`,
        [id],
      );
      if (lookupRes.rows.length === 0) {
        throw new NotFoundError(`Agent not found with ID '${id}'`);
      }

      const agent = lookupRes.rows[0];
      const targetUserId = agent.userId;
      let targetAgentId = agent.agentId;

      if (!targetAgentId) {
        const cleanDefaultSlug = `agent-${String(targetUserId).slice(0, 8)}`;
        const insAgent = await db.query(
          `INSERT INTO agents (user_id, business_name, slug, agent_tier, status, is_active)
           VALUES ($1, 'Individual Reseller', $2, 'STANDARD', $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [targetUserId, cleanDefaultSlug, status, status === AgentAccountStatus.ACTIVE],
        );
        targetAgentId = insAgent.rows[0]?.id;
      } else {
        await db.query(
          `UPDATE agents SET status = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [status, status === AgentAccountStatus.ACTIVE, targetAgentId],
        );
      }

      // Update user status
      await db.query(
        `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, targetUserId],
      );

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_CHANGE_AGENT_STATUS',
          resourceType: 'agents',
          resourceId: targetAgentId || id,
          metadata: { previousStatus: agent.status, newStatus: status, reason },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: { id, status, reason },
        message: `Agent operational status updated to ${status}.`,
      });
    },
  );

  // 7. DOUBLE-ENTRY WALLET ADJUSTMENT (/admin/agents/:id/wallet/adjust)
  app.post<{
    Params: { id: string };
    Body: {
      amountPesewas?: number;
      targetBalancePesewas?: number;
      direction: 'CREDIT' | 'DEBIT' | 'OVERRIDE';
      reason: string;
      idempotencyKey?: string;
    };
  }>(
    '/admin/agents/:id/wallet/adjust',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { amountPesewas, targetBalancePesewas, direction, reason, idempotencyKey } = req.body || {};

      if (!direction || (direction !== 'CREDIT' && direction !== 'DEBIT' && direction !== 'OVERRIDE')) {
        throw new BadRequestError('Adjustment direction must be CREDIT, DEBIT, or OVERRIDE.');
      }

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError('A detailed reason (minimum 5 characters) is mandatory.');
      }

      if (direction === 'CREDIT' || direction === 'DEBIT') {
        if (!amountPesewas || !Number.isInteger(amountPesewas) || amountPesewas <= 0) {
          throw new BadRequestError('Positive integer amount in pesewas is required.');
        }
      } else if (direction === 'OVERRIDE') {
        const target = targetBalancePesewas !== undefined ? targetBalancePesewas : amountPesewas;
        if (target === undefined || !Number.isInteger(target) || target < 0) {
          throw new BadRequestError('Override target balance must be a non-negative integer in pesewas (>= 0).');
        }
      }

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId", COALESCE(u.wallet_balance_pesewas, 0) as "walletBalancePesewas"
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1`,
        [id],
      );
      if (lookupRes.rows.length === 0) {
        throw new NotFoundError(`Agent not found with ID '${id}'`);
      }

      const agent = lookupRes.rows[0];
      const userId = agent.userId;
      const currentBalance = parseInt(agent.walletBalancePesewas || '0', 10);

      let newBalance = currentBalance;
      let deltaPesewas = 0;
      let effectiveDirection: 'CREDIT' | 'DEBIT' | 'NONE' = 'NONE';

      if (direction === 'CREDIT') {
        deltaPesewas = amountPesewas!;
        newBalance = currentBalance + deltaPesewas;
        effectiveDirection = 'CREDIT';
      } else if (direction === 'DEBIT') {
        deltaPesewas = amountPesewas!;
        if (currentBalance < deltaPesewas) {
          throw new BadRequestError(
            `Insufficient float balance: agent has ${(currentBalance / 100).toFixed(2)} GHS, cannot debit ${(deltaPesewas / 100).toFixed(2)} GHS.`,
          );
        }
        newBalance = currentBalance - deltaPesewas;
        effectiveDirection = 'DEBIT';
      } else if (direction === 'OVERRIDE') {
        const target = targetBalancePesewas !== undefined ? targetBalancePesewas : amountPesewas!;
        newBalance = target;
        const diff = target - currentBalance;
        if (diff > 0) {
          deltaPesewas = diff;
          effectiveDirection = 'CREDIT';
        } else if (diff < 0) {
          deltaPesewas = Math.abs(diff);
          effectiveDirection = 'DEBIT';
        } else {
          deltaPesewas = 0;
          effectiveDirection = 'NONE';
        }
      }

      // Post balanced double-entry voucher
      if (financialLedgerService) {
        const client = await db.connect();
        try {
          await client.query('BEGIN');

          if (direction === 'OVERRIDE') {
            let currentLedgerBalance = currentBalance;
            const ledgerSumRes = await client.query(
              `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as "currentLedgerBalance"
               FROM financial_ledger WHERE account_id = $1`,
              [userId],
            );
            if (ledgerSumRes.rows.length > 0 && ledgerSumRes.rows[0]?.currentLedgerBalance !== undefined) {
              currentLedgerBalance = parseInt(String(ledgerSumRes.rows[0].currentLedgerBalance), 10);
            }
            const target = targetBalancePesewas !== undefined ? targetBalancePesewas : amountPesewas!;
            const diff = target - currentLedgerBalance;
            if (diff > 0) {
              deltaPesewas = diff;
              effectiveDirection = 'CREDIT';
            } else if (diff < 0) {
              deltaPesewas = Math.abs(diff);
              effectiveDirection = 'DEBIT';
            } else {
              deltaPesewas = 0;
              effectiveDirection = 'NONE';
            }
          }

          const platformAccountId = '00000000-0000-0000-0000-000000000000';
          const refId = idempotencyKey || id;
          const refType = direction === 'OVERRIDE' ? 'MANUAL_OVERRIDE' : 'MANUAL_ADJUSTMENT';

          if (deltaPesewas > 0) {
            const entries = effectiveDirection === 'CREDIT'
              ? [
                  {
                    accountType: LedgerAccountType.PLATFORM_ESCROW,
                    accountId: platformAccountId,
                    entryType: LedgerEntryType.DEBIT,
                    amountPesewas: deltaPesewas,
                    currency: Currency.GHS,
                    referenceType: refType,
                    referenceId: refId,
                    description: direction === 'OVERRIDE'
                      ? `Admin Float Adjustment Override Credit (${(currentBalance / 100).toFixed(2)} -> ${(newBalance / 100).toFixed(2)} GHS): ${reason}`
                      : `Admin Float Adjustment Credit: ${reason}`,
                  },
                  {
                    accountType: LedgerAccountType.CUSTOMER_WALLET,
                    accountId: userId,
                    entryType: LedgerEntryType.CREDIT,
                    amountPesewas: deltaPesewas,
                    currency: Currency.GHS,
                    referenceType: refType,
                    referenceId: refId,
                    description: direction === 'OVERRIDE'
                      ? `Admin Float Adjustment Override Credit (${(currentBalance / 100).toFixed(2)} -> ${(newBalance / 100).toFixed(2)} GHS): ${reason}`
                      : `Admin Float Adjustment Credit: ${reason}`,
                  },
                ]
              : [
                  {
                    accountType: LedgerAccountType.CUSTOMER_WALLET,
                    accountId: userId,
                    entryType: LedgerEntryType.DEBIT,
                    amountPesewas: deltaPesewas,
                    currency: Currency.GHS,
                    referenceType: refType,
                    referenceId: refId,
                    description: direction === 'OVERRIDE'
                      ? `Admin Float Adjustment Override Debit (${(currentBalance / 100).toFixed(2)} -> ${(newBalance / 100).toFixed(2)} GHS): ${reason}`
                      : `Admin Float Adjustment Debit: ${reason}`,
                  },
                  {
                    accountType: LedgerAccountType.PLATFORM_ESCROW,
                    accountId: platformAccountId,
                    entryType: LedgerEntryType.CREDIT,
                    amountPesewas: deltaPesewas,
                    currency: Currency.GHS,
                    referenceType: refType,
                    referenceId: refId,
                    description: direction === 'OVERRIDE'
                      ? `Admin Float Adjustment Override Debit (${(currentBalance / 100).toFixed(2)} -> ${(newBalance / 100).toFixed(2)} GHS): ${reason}`
                      : `Admin Float Adjustment Debit: ${reason}`,
                  },
                ];

            await financialLedgerService.recordJournalEntries(client, entries);
          }

          // Update user wallet projection
          const newBalanceGhs = Number((newBalance / 100).toFixed(2));
          await client.query(
            `UPDATE users
             SET wallet_balance_pesewas = $1,
                 wallet_balance = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newBalance, newBalanceGhs, userId],
          );

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: direction === 'OVERRIDE' ? 'ADMIN_OVERRIDE_AGENT_WALLET' : 'ADMIN_ADJUST_AGENT_WALLET',
          resourceType: 'agents',
          resourceId: id,
          metadata: {
            direction,
            amountPesewas: deltaPesewas,
            beforeBalancePesewas: currentBalance,
            afterBalancePesewas: newBalance,
            reason,
            userId,
          },
          ipAddress: req.ip,
        });
      }

      const successMsg = direction === 'OVERRIDE'
        ? `Agent float balance successfully overridden from GH₵ ${(currentBalance / 100).toFixed(2)} to GH₵ ${(newBalance / 100).toFixed(2)}.`
        : `Agent wallet ${direction.toLowerCase()}ed by GH₵ ${(deltaPesewas / 100).toFixed(2)} with balanced double-entry ledger voucher.`;

      return reply.send({
        success: true,
        data: {
          agentId: id,
          previousBalancePesewas: currentBalance,
          newBalancePesewas: newBalance,
          amountPesewas: deltaPesewas,
          direction,
          reason,
        },
        message: successMsg,
      });
    },
  );

  // 8. GET AGENT CUSTOM PRICING (/admin/agents/:id/pricing)
  app.get<{ Params: { id: string } }>(
    '/admin/agents/:id/pricing',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId"
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1`,
        [id],
      );
      const targetAgentId = lookupRes.rows[0]?.agentId || id;

      const pricingRes = await db.query(
        `SELECT cp.id as "productId", cp.name as "productName", cp.sku, cp.network,
                cp.data_amount_mb as "dataAmountMb", cp.base_price_pesewas as "basePricePesewas",
                cp.agent_price_pesewas as "defaultAgentPricePesewas",
                ap.id as "pricingId", ap.custom_price_pesewas as "customPricePesewas",
                COALESCE(ap.is_active, TRUE) as "isActive", ap.updated_at as "updatedAt"
         FROM catalog_products cp
         LEFT JOIN agent_pricing ap ON ap.product_id = cp.id AND ap.agent_id = $1
         WHERE cp.is_active = TRUE
         ORDER BY cp.network ASC, cp.data_amount_mb ASC`,
        [targetAgentId],
      );

      const items: AgentCustomPricingItemDto[] = pricingRes.rows.map((r) => {
        const defaultAgent = parseInt(r.defaultAgentPricePesewas || r.basePricePesewas || '0', 10);
        const customPrice = r.customPricePesewas ? parseInt(r.customPricePesewas, 10) : null;
        return {
          id: r.pricingId || undefined,
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          network: r.network,
          dataAmountMb: parseInt(r.dataAmountMb || '0', 10),
          defaultAgentPricePesewas: defaultAgent,
          basePricePesewas: parseInt(r.basePricePesewas || '0', 10),
          customPricePesewas: customPrice,
          effectivePricePesewas: customPrice !== null ? customPrice : defaultAgent,
          isActive: Boolean(r.isActive),
          updatedAt: safeIsoDate(r.updatedAt),
        };
      });

      return reply.send({
        success: true,
        data: items,
      });
    },
  );

  // 9. UPDATE AGENT CUSTOM PRICING (/admin/agents/:id/pricing)
  app.put<{ Params: { id: string }; Body: UpdateAgentPricingRequest }>(
    '/admin/agents/:id/pricing',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { pricing } = req.body || {};

      if (!pricing || !Array.isArray(pricing)) {
        throw new BadRequestError('Pricing array is required.');
      }

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId", u.full_name as "fullName"
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1`,
        [id],
      );
      let targetAgentId = lookupRes.rows[0]?.agentId;

      if (!targetAgentId && lookupRes.rows[0]?.userId) {
        const targetUserId = lookupRes.rows[0].userId;
        const cleanDefaultSlug = `agent-${String(targetUserId).slice(0, 8)}`;
        const insAgent = await db.query(
          `INSERT INTO agents (user_id, business_name, slug, agent_tier, status, is_active)
           VALUES ($1, $2, $3, 'STANDARD', 'ACTIVE', TRUE)
           ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [targetUserId, lookupRes.rows[0].fullName || 'Individual Reseller', cleanDefaultSlug],
        );
        targetAgentId = insAgent.rows[0]?.id;
      }
      targetAgentId = targetAgentId || id;

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        for (const item of pricing) {
          if (item.customPricePesewas === null) {
            // Delete custom price override
            await client.query(
              'DELETE FROM agent_pricing WHERE agent_id = $1 AND product_id = $2',
              [targetAgentId, item.productId],
            );
          } else if (item.customPricePesewas > 0) {
            // Upsert custom price override
            await client.query(
              `INSERT INTO agent_pricing (agent_id, product_id, custom_price_pesewas, is_active, updated_at)
               VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
               ON CONFLICT (agent_id, product_id)
               DO UPDATE SET custom_price_pesewas = EXCLUDED.custom_price_pesewas, is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
              [targetAgentId, item.productId, item.customPricePesewas],
            );
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_UPDATE_AGENT_PRICING',
          resourceType: 'agents',
          resourceId: targetAgentId,
          metadata: { pricingUpdatesCount: pricing.length },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: 'Agent wholesale custom pricing updated successfully.',
      });
    },
  );

  // 10. GET AGENT API KEYS (/admin/agents/:id/api-keys)
  app.get<{ Params: { id: string } }>(
    '/admin/agents/:id/api-keys',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;

      const lookupRes = await db.query(
        `SELECT a.id as "agentId", u.id as "userId"
         FROM users u
         LEFT JOIN agents a ON a.user_id = u.id
         WHERE a.id::text = $1 OR u.id::text = $1`,
        [id],
      );
      if (lookupRes.rows.length === 0) {
        throw new NotFoundError(`Agent not found with ID '${id}'`);
      }
      const userId = lookupRes.rows[0].userId;

      const keysRes = await db.query(
        `SELECT id, name, key_prefix as "keyPrefix", environment, scopes,
                status, last_used_at as "lastUsedAt", expires_at as "expiresAt", created_at as "createdAt"
         FROM api_keys
         WHERE (agent_id = $1 OR owner_user_id = $1)
         ORDER BY created_at DESC`,
        [userId],
      );

      return reply.send({
        success: true,
        data: keysRes.rows.map((k) => ({
          ...k,
          createdAt: safeIsoDate(k.createdAt) || new Date().toISOString(),
          lastUsedAt: safeIsoDate(k.lastUsedAt) || null,
          expiresAt: safeIsoDate(k.expiresAt) || null,
        })),
      });
    },
  );

  // 11. REVOKE AGENT API KEY (/admin/agents/:id/api-keys/:keyId/revoke)
  app.post<{ Params: { id: string; keyId: string }; Body: { reason: string } }>(
    '/admin/agents/:id/api-keys/:keyId/revoke',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id, keyId } = req.params;
      const { reason = 'Revoked by administrator' } = req.body || {};

      const keyRes = await db.query(
        'UPDATE api_keys SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, key_prefix as "keyPrefix"',
        ['REVOKED', keyId],
      );

      if (keyRes.rows.length === 0) {
        throw new NotFoundError(`API Key not found with ID '${keyId}'`);
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_REVOKE_AGENT_API_KEY',
          resourceType: 'api_keys',
          resourceId: keyId,
          metadata: { agentId: id, reason, keyPrefix: keyRes.rows[0].keyPrefix },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: 'Agent API Key revoked successfully.',
      });
    },
  );

  // 12. EXPORT AGENTS (/admin/agents/export)
  app.post<{ Body: { format?: 'csv' | 'json'; status?: string } }>(
    '/admin/agents/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { format = 'csv', status = 'ALL' } = req.body || {};

      let query = `
        SELECT
          COALESCE(a.id, u.id) as "agentId",
          COALESCE(u.full_name, '') as "fullName",
          u.email,
          u.phone,
          COALESCE(a.business_name, u.full_name, 'Individual Reseller') as "businessName",
          COALESCE(a.slug, s.slug, 'agent-' || SUBSTRING(u.id::text, 1, 8)) as "slug",
          COALESCE(a.status, u.status, 'ACTIVE') as status,
          ROUND(COALESCE(u.wallet_balance_pesewas, 0) / 100.0, 2) as "walletBalanceGhs",
          COALESCE((SELECT COUNT(*) FROM orders WHERE agent_id = a.id OR user_id = u.id), 0) as "ordersCount",
          COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND order_status IN ('COMPLETED', 'DELIVERED') AND payment_status = 'PAID' AND COALESCE(refund_status, 'NONE') != 'COMPLETED'), 0) / 100.0 as "revenueGhs",
          COALESCE(a.created_at, u.created_at) as "createdAt"
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        WHERE (LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller') OR u.security_domain = 'AGENT' OR a.id IS NOT NULL)
      `;

      const params: any[] = [];
      if (status !== 'ALL') {
        query += ' AND UPPER(COALESCE(a.status, u.status, \'\')) = $1';
        params.push(status.toUpperCase());
      }
      query += ' ORDER BY COALESCE(a.created_at, u.created_at) DESC';

      const res = await db.query(query, params).catch(() => ({ rows: [] }));

      if (format === 'csv') {
        const headers = ['Agent ID', 'Full Name', 'Email', 'Phone', 'Business Name', 'Slug', 'Status', 'Wallet Balance GHS', 'Orders', 'Revenue GHS', 'Created At'];
        const rows = res.rows.map((r: any) => [
          `"${r.agentId}"`,
          `"${(r.fullName || '').replace(/"/g, '""')}"`,
          `"${r.email}"`,
          `"${r.phone || ''}"`,
          `"${(r.businessName || '').replace(/"/g, '""')}"`,
          `"${r.slug}"`,
          `"${r.status}"`,
          (Number(r.walletBalanceGhs) || 0).toFixed(2),
          r.ordersCount,
          (Number(r.revenueGhs) || 0).toFixed(2),
          `"${safeIsoDate(r.createdAt) || ''}"`,
        ]);

        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="bytebeacon-agents-${Date.now()}.csv"`);
        return reply.send(csvContent);
      }

      return reply.send({
        success: true,
        data: res.rows,
      });
    },
  );

  // =========================================================================
  // AGENT APPLICATIONS & ONBOARDING WORKFLOW ENDPOINTS
  // =========================================================================

  // Helper to map DB row to AgentApplicationDto
  const mapAppRow = (r: any): AgentApplicationDto => {
    const feePesewas = parseInt(r.fee_pesewas || r.feePesewas || '10000', 10);
    return {
      id: r.id,
      userId: r.user_id || r.userId,
      fullName: r.full_name || r.fullName || '',
      businessName: r.business_name || r.businessName || '',
      slug: r.slug || '',
      phone: r.phone || '',
      email: r.email || '',
      locationRegion: r.location_region || r.locationRegion || undefined,
      experienceDescription: r.experience_description || r.experienceDescription || undefined,
      feePesewas,
      feeGhs: Number((feePesewas / 100).toFixed(2)),
      paymentStatus: (r.payment_status || r.paymentStatus || 'PAYMENT_PENDING') as any,
      paystackReference: r.paystack_reference || r.paystackReference || undefined,
      status: (r.status || 'PENDING_APPROVAL') as any,
      adminNotes: r.admin_notes || r.adminNotes || undefined,
      reviewedBy: r.reviewed_by || r.reviewedBy || undefined,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  };

  // 1. LIST AGENT APPLICATIONS (/admin/agents/applications)
  app.get<{
    Querystring: {
      status?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/admin/agents/applications',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { status = 'ALL', search = '', page = '1', limit = '20' } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (status && status !== 'ALL') {
        conditions.push(`status = $${paramIdx++}`);
        params.push(status.toUpperCase());
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(`(full_name ILIKE $${paramIdx} OR business_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR phone ILIKE $${paramIdx} OR slug ILIKE $${paramIdx})`);
        params.push(term);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM agent_applications ${whereClause}`,
        params,
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const query = `
        SELECT * FROM agent_applications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `;
      params.push(limitNum, offset);

      const itemsRes = await db.query(query, params);
      const items = itemsRes.rows.map(mapAppRow);

      // Pending count helper
      const pendingCountRes = await db.query(
        `SELECT COUNT(*) as count FROM agent_applications WHERE status = 'PENDING_APPROVAL'`,
      ).catch(() => ({ rows: [{ count: '0' }] }));

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
          pendingCount: parseInt(pendingCountRes.rows[0]?.count || '0', 10),
        },
      });
    },
  );

  // 2. GET SINGLE AGENT APPLICATION DETAIL (/admin/agents/applications/:id)
  app.get<{ Params: { id: string } }>(
    '/admin/agents/applications/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const res = await db.query(`SELECT * FROM agent_applications WHERE id = $1`, [id]);
      if (res.rows.length === 0) {
        throw new NotFoundError('Agent application not found');
      }
      return reply.send({
        success: true,
        data: mapAppRow(res.rows[0]),
      });
    },
  );

  // 3. APPROVE AGENT APPLICATION (/admin/agents/applications/:id/approve)
  app.post<{ Params: { id: string } }>(
    '/admin/agents/applications/:id/approve',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const appRes = await db.query(`SELECT * FROM agent_applications WHERE id = $1`, [id]);
      if (appRes.rows.length === 0) {
        throw new NotFoundError('Agent application not found');
      }

      const application = appRes.rows[0];
      const adminId = req.user?.sub;
      const isUuid = adminId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId);

      // 1. Mark application as APPROVED
      await db.query(
        `UPDATE agent_applications
         SET status = 'APPROVED',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [isUuid ? adminId : null, id],
      );

      // 2. Register/activate in agents table
      const cleanSlug = application.slug || `agent-${String(application.user_id).slice(0, 8)}`;
      await db.query(
        `INSERT INTO agents (user_id, business_name, slug, is_active, status, agent_tier)
         VALUES ($1, $2, $3, TRUE, 'ACTIVE', 'STANDARD')
         ON CONFLICT (user_id)
         DO UPDATE SET
           business_name = EXCLUDED.business_name,
           slug = EXCLUDED.slug,
           is_active = TRUE,
           status = 'ACTIVE',
           updated_at = CURRENT_TIMESTAMP`,
        [application.user_id, application.business_name, cleanSlug],
      );

      // 3. Promote user role in users table
      await db.query(
        `UPDATE users
         SET role = 'agent', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [application.user_id],
      );

      // 4. Send celebratory notification to applicant
      await db.query(
        `INSERT INTO notifications (
           user_id, type, severity, title, body, message, action_url, channel, is_read, created_at, updated_at
         )
         VALUES ($1, 'AGENT_APPROVAL', 'SUCCESS', 'Agent Application Approved!',
           'Congratulations! Your agent application has been approved. You now have full access to reseller pricing and the Agent Portal.',
           'Congratulations! Your agent application has been approved. You now have full access to reseller pricing and the Agent Portal.',
           '/agent/dashboard', 'IN_APP', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [application.user_id],
      ).catch(() => {});

      // 5. Audit log event
      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'APPROVE_AGENT_APPLICATION',
          resourceType: 'agent_applications',
          resourceId: id,
          metadata: { userId: application.user_id, businessName: application.business_name, slug: cleanSlug },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        message: `Agent application for '${application.business_name}' approved successfully. User role promoted to Agent.`,
        data: {
          id,
          userId: application.user_id,
          status: 'APPROVED',
          businessName: application.business_name,
          slug: cleanSlug,
        },
      });
    },
  );

  // 4. REJECT AGENT APPLICATION (/admin/agents/applications/:id/reject)
  app.post<{ Params: { id: string }; Body: { reason?: string; adminNotes?: string } }>(
    '/admin/agents/applications/:id/reject',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { reason, adminNotes } = req.body || {};
      const note = reason || adminNotes || 'Application does not meet current reseller onboarding criteria.';

      const appRes = await db.query(`SELECT * FROM agent_applications WHERE id = $1`, [id]);
      if (appRes.rows.length === 0) {
        throw new NotFoundError('Agent application not found');
      }

      const application = appRes.rows[0];
      const adminId = req.user?.sub;
      const isUuid = adminId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId);

      // 1. Mark application as REJECTED
      await db.query(
        `UPDATE agent_applications
         SET status = 'REJECTED',
             admin_notes = $1,
             reviewed_by = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [note, isUuid ? adminId : null, id],
      );

      // 2. Notify applicant
      await db.query(
        `INSERT INTO notifications (
           user_id, type, severity, title, body, message, action_url, channel, is_read, created_at, updated_at
         )
         VALUES ($1, 'AGENT_REJECTION', 'WARNING', 'Agent Application Status Update',
           $2, $2, '/app/apply-agent', 'IN_APP', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [application.user_id, `Your agent application was reviewed: ${note}`],
      ).catch(() => {});

      // 3. Audit log
      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'REJECT_AGENT_APPLICATION',
          resourceType: 'agent_applications',
          resourceId: id,
          metadata: { userId: application.user_id, reason: note },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        message: 'Agent application has been marked as rejected.',
        data: {
          id,
          userId: application.user_id,
          status: 'REJECTED',
          adminNotes: note,
        },
      });
    },
  );

  // 5. GET AGENT APPLICATION FEE SETTING (/admin/agents/settings/application-fee)
  app.get(
    '/admin/agents/settings/application-fee',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      const configRes = await db.query(
        `SELECT value FROM system_configurations WHERE config_key = 'agent_application_fee_pesewas'`,
      );
      let feePesewas = 10000; // Default GH₵ 100.00
      if (configRes.rows.length > 0) {
        const val = configRes.rows[0].value;
        const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          feePesewas = parsed;
        }
      }
      return reply.send({
        success: true,
        data: {
          applicationFeePesewas: feePesewas,
          applicationFeeGhs: Number((feePesewas / 100).toFixed(2)),
          configKey: 'agent_application_fee_pesewas',
        },
      });
    },
  );

  // 6. UPDATE AGENT APPLICATION FEE SETTING (/admin/agents/settings/application-fee)
  app.put<{
    Body: { applicationFeeGhs?: number; applicationFeePesewas?: number; reason?: string };
  }>(
    '/admin/agents/settings/application-fee',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { applicationFeeGhs, applicationFeePesewas, reason } = req.body || {};
      let newPesewas: number;

      if (applicationFeeGhs !== undefined && !isNaN(Number(applicationFeeGhs))) {
        newPesewas = Math.round(Number(applicationFeeGhs) * 100);
      } else if (applicationFeePesewas !== undefined && !isNaN(Number(applicationFeePesewas))) {
        newPesewas = Math.round(Number(applicationFeePesewas));
      } else {
        throw new BadRequestError('applicationFeeGhs or applicationFeePesewas is required.');
      }

      if (newPesewas < 0) {
        throw new BadRequestError('Application fee cannot be negative.');
      }

      const actorId = req.user?.sub;
      const isUuid = actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);

      await db.query(
        `INSERT INTO system_configurations (
           scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version, last_modified_by, last_modified_at
         )
         VALUES (
           'AGENTS', 'agent_application_fee_pesewas', 'AGENTS', $1::jsonb, 'NUMBER', false, 'HIGH', true, 'One-time agent application fee in pesewas', 1, $2, CURRENT_TIMESTAMP
         )
         ON CONFLICT (config_key)
         DO UPDATE SET
           value = EXCLUDED.value,
           version = system_configurations.version + 1,
           last_modified_by = EXCLUDED.last_modified_by,
           last_modified_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(newPesewas), isUuid ? actorId : null],
      );

      // Record audit history in configuration_versions if exists
      await db.query(
        `INSERT INTO configuration_versions (config_key, version, new_value, change_reason, changed_by, changed_by_name)
         SELECT 'agent_application_fee_pesewas', version, value, $1, $2, $3
         FROM system_configurations
         WHERE config_key = 'agent_application_fee_pesewas'`,
        [reason || 'Updated agent application fee', isUuid ? actorId : null, req.user?.email || 'Admin'],
      ).catch(() => {});

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'UPDATE_SYSTEM_CONFIG',
          resourceType: 'system_configurations',
          resourceId: 'agent_application_fee_pesewas',
          metadata: { newPesewas, newGhs: newPesewas / 100, reason },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      return reply.send({
        success: true,
        data: {
          applicationFeePesewas: newPesewas,
          applicationFeeGhs: Number((newPesewas / 100).toFixed(2)),
          configKey: 'agent_application_fee_pesewas',
        },
        message: `Agent application fee updated to GH₵ ${(newPesewas / 100).toFixed(2)}.`,
      });
    },
  );

  // Helper to fetch current agent withdrawal policy
  const getAgentWithdrawalPolicyData = async (): Promise<AgentWithdrawalPolicyDto> => {
    const configRes = await db.query<{ config_key: string; value: any }>(
      `SELECT config_key, value
       FROM system_configurations
       WHERE config_key IN (
         'agent_min_withdrawal_pesewas',
         'agent_max_withdrawal_pesewas',
         'daily_withdrawal_limit_pesewas',
         'agent_withdrawal_schedule_enabled',
         'agent_withdrawal_allowed_days',
         'agent_withdrawal_start_time',
         'agent_withdrawal_end_time',
         'allow_agent_withdrawals'
       )`
    ).catch(() => ({ rows: [] }));

    const configMap = new Map<string, any>();
    for (const row of configRes.rows) {
      configMap.set(row.config_key, row.value);
    }

    const minConfig = configMap.get('agent_min_withdrawal_pesewas');
    const globalMinWithdrawalPesewas = minConfig !== undefined && !isNaN(Number(minConfig))
      ? parseInt(String(minConfig), 10)
      : 1000;

    const maxConfig = configMap.get('agent_max_withdrawal_pesewas');
    const globalMaxWithdrawalPesewas = maxConfig !== undefined && !isNaN(Number(maxConfig))
      ? parseInt(String(maxConfig), 10)
      : 500000;

    const dailyConfig = configMap.get('daily_withdrawal_limit_pesewas');
    const globalDailyLimitPesewas = dailyConfig !== undefined && !isNaN(Number(dailyConfig))
      ? parseInt(String(dailyConfig), 10)
      : 500000;

    const scheduleEnabled = configMap.get('agent_withdrawal_schedule_enabled') === undefined ||
      configMap.get('agent_withdrawal_schedule_enabled') === true ||
      configMap.get('agent_withdrawal_schedule_enabled') === 'true';

    let allowedDays: string[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const rawDays = configMap.get('agent_withdrawal_allowed_days');
    if (Array.isArray(rawDays)) {
      allowedDays = rawDays.map((d: any) => String(d).toUpperCase());
    } else if (typeof rawDays === 'string') {
      try {
        const parsed = JSON.parse(rawDays);
        if (Array.isArray(parsed)) allowedDays = parsed.map((d: any) => String(d).toUpperCase());
      } catch {
        allowedDays = rawDays.split(',').map((d: string) => d.trim().toUpperCase());
      }
    }

    const rawStartTime = configMap.get('agent_withdrawal_start_time');
    const startTime = (typeof rawStartTime === 'string' ? rawStartTime : '00:00').replace(/"/g, '').trim();

    const rawEndTime = configMap.get('agent_withdrawal_end_time');
    const endTime = (typeof rawEndTime === 'string' ? rawEndTime : '23:59').replace(/"/g, '').trim();

    const allowAgentWithdrawals = configMap.get('allow_agent_withdrawals') === undefined ||
      (configMap.get('allow_agent_withdrawals') !== false && configMap.get('allow_agent_withdrawals') !== 'false');

    const now = new Date();
    const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentGmtDay = DAYS_OF_WEEK[now.getUTCDay()];
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentGmtTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    const currentMinutesFromMidnight = currentHour * 60 + currentMinute;

    const [startH, startM] = startTime.split(':').map((n: string) => parseInt(n, 10) || 0);
    const [endH, endM] = endTime.split(':').map((n: string) => parseInt(n, 10) || 0);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let isWindowOpenNow = true;
    if (!allowAgentWithdrawals) {
      isWindowOpenNow = false;
    } else if (scheduleEnabled) {
      const isDayAllowed = allowedDays.includes(currentGmtDay);
      const isTimeAllowed = currentMinutesFromMidnight >= startMinutes && currentMinutesFromMidnight <= endMinutes;
      isWindowOpenNow = isDayAllowed && isTimeAllowed;
    }

    return {
      globalMinWithdrawalPesewas,
      globalMaxWithdrawalPesewas,
      globalDailyLimitPesewas,
      scheduleEnabled,
      allowedDays,
      startTime,
      endTime,
      allowAgentWithdrawals,
      isWindowOpenNow,
      currentGmtTime,
      currentGmtDay,
    };
  };

  // 7. GET AGENT WITHDRAWAL POLICY (/admin/agents/withdrawal-settings)
  app.get(
    '/admin/agents/withdrawal-settings',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req, reply) => {
      const policy = await getAgentWithdrawalPolicyData();
      return reply.send({
        success: true,
        data: policy,
      });
    },
  );

  // 8. UPDATE AGENT WITHDRAWAL POLICY (/admin/agents/withdrawal-settings)
  app.put<{ Body: UpdateAgentWithdrawalPolicyRequest }>(
    '/admin/agents/withdrawal-settings',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        globalMinWithdrawalPesewas,
        globalMaxWithdrawalPesewas,
        globalDailyLimitPesewas,
        scheduleEnabled,
        allowedDays,
        startTime,
        endTime,
        allowAgentWithdrawals,
        reason,
      } = req.body || {};

      if (globalMinWithdrawalPesewas !== undefined && (isNaN(Number(globalMinWithdrawalPesewas)) || Number(globalMinWithdrawalPesewas) < 0)) {
        throw new BadRequestError('globalMinWithdrawalPesewas must be a non-negative number.');
      }
      if (globalMaxWithdrawalPesewas !== undefined && (isNaN(Number(globalMaxWithdrawalPesewas)) || Number(globalMaxWithdrawalPesewas) <= 0)) {
        throw new BadRequestError('globalMaxWithdrawalPesewas must be a positive number.');
      }
      if (globalDailyLimitPesewas !== undefined && (isNaN(Number(globalDailyLimitPesewas)) || Number(globalDailyLimitPesewas) <= 0)) {
        throw new BadRequestError('globalDailyLimitPesewas must be a positive number.');
      }

      if (startTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime.trim())) {
        throw new BadRequestError('startTime must be in HH:MM format (24-hour).');
      }
      if (endTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime.trim())) {
        throw new BadRequestError('endTime must be in HH:MM format (24-hour).');
      }

      const VALID_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      if (allowedDays !== undefined) {
        if (!Array.isArray(allowedDays) || allowedDays.length === 0) {
          throw new BadRequestError('allowedDays must be a non-empty array of days (e.g. ["MON", "TUE", ...]).');
        }
        for (const day of allowedDays) {
          if (!VALID_DAYS.includes(String(day).toUpperCase())) {
            throw new BadRequestError(`Invalid day in allowedDays: '${day}'. Must be one of: ${VALID_DAYS.join(', ')}.`);
          }
        }
      }

      const actorId = req.user?.sub;
      const isUuid = actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);

      const upsertConfig = async (key: string, category: string, value: any, dataType: string, desc: string) => {
        await db.query(
          `INSERT INTO system_configurations (
             scope, config_key, category, value, data_type, is_secret, risk_level, requires_step_up, description, version, last_modified_by, last_modified_at
           )
           VALUES (
             'AGENTS', $1, $2, $3::jsonb, $4, false, 'HIGH', true, $5, 1, $6, CURRENT_TIMESTAMP
           )
           ON CONFLICT (config_key)
           DO UPDATE SET
             value = EXCLUDED.value,
             version = system_configurations.version + 1,
             last_modified_by = EXCLUDED.last_modified_by,
             last_modified_at = CURRENT_TIMESTAMP`,
          [key, category, JSON.stringify(value), dataType, desc, isUuid ? actorId : null],
        );

        await db.query(
          `INSERT INTO configuration_versions (config_key, version, new_value, change_reason, changed_by, changed_by_name)
           SELECT $1, version, value, $2, $3, $4
           FROM system_configurations
           WHERE config_key = $1`,
          [key, reason || 'Updated agent withdrawal policy', isUuid ? actorId : null, req.user?.email || 'Admin'],
        ).catch(() => {});
      };

      if (globalMinWithdrawalPesewas !== undefined) {
        await upsertConfig('agent_min_withdrawal_pesewas', 'AGENTS', Math.round(Number(globalMinWithdrawalPesewas)), 'NUMBER', 'Minimum profit withdrawal amount per request in pesewas');
      }
      if (globalMaxWithdrawalPesewas !== undefined) {
        await upsertConfig('agent_max_withdrawal_pesewas', 'AGENTS', Math.round(Number(globalMaxWithdrawalPesewas)), 'NUMBER', 'Maximum single profit withdrawal limit in pesewas');
      }
      if (globalDailyLimitPesewas !== undefined) {
        await upsertConfig('daily_withdrawal_limit_pesewas', 'PAYMENTS', Math.round(Number(globalDailyLimitPesewas)), 'NUMBER', 'Daily aggregated profit withdrawal limit per agent in pesewas');
      }
      if (scheduleEnabled !== undefined) {
        await upsertConfig('agent_withdrawal_schedule_enabled', 'AGENTS', Boolean(scheduleEnabled), 'BOOLEAN', 'Enforce time window and operating day restrictions on agent withdrawals');
      }
      if (allowedDays !== undefined) {
        const cleanedDays = allowedDays.map((d: string) => d.toUpperCase());
        await upsertConfig('agent_withdrawal_allowed_days', 'AGENTS', cleanedDays, 'JSON', 'Days of week when agent profit payouts are permitted');
      }
      if (startTime !== undefined) {
        await upsertConfig('agent_withdrawal_start_time', 'AGENTS', startTime.trim(), 'STRING', 'Daily withdrawal opening time in GMT (HH:MM)');
      }
      if (endTime !== undefined) {
        await upsertConfig('agent_withdrawal_end_time', 'AGENTS', endTime.trim(), 'STRING', 'Daily withdrawal closing time in GMT (HH:MM)');
      }
      if (allowAgentWithdrawals !== undefined) {
        await upsertConfig('allow_agent_withdrawals', 'PAYMENTS', Boolean(allowAgentWithdrawals), 'BOOLEAN', 'Global switch to permit or pause agent profit withdrawals platform-wide');
      }

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_AGENT_WITHDRAWAL_POLICY_UPDATED',
          resourceType: 'system_configurations',
          resourceId: 'agent_withdrawal_policy',
          metadata: {
            globalMinWithdrawalPesewas,
            globalMaxWithdrawalPesewas,
            globalDailyLimitPesewas,
            scheduleEnabled,
            allowedDays,
            startTime,
            endTime,
            allowAgentWithdrawals,
            reason,
          },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      const updatedPolicy = await getAgentWithdrawalPolicyData();
      return reply.send({
        success: true,
        data: updatedPolicy,
        message: 'Agent withdrawal policy and operating schedule updated successfully.',
      });
    },
  );

  // 9. MASS UPDATE AGENT WITHDRAWAL LIMITS (/admin/agents/mass-withdrawal-limits)
  app.post<{ Body: MassAgentWithdrawalLimitsRequest }>(
    '/admin/agents/mass-withdrawal-limits',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const {
        target,
        agentTier,
        agentIds,
        customMinWithdrawalPesewas,
        customWithdrawalLimitPesewas,
        customDailyLimitPesewas,
        withdrawalsEnabled,
        allowAnytimeWithdrawals,
        resetToDefaults,
        reason,
      } = req.body || {};

      if (!target || !['ALL', 'TIER', 'SELECTED'].includes(target)) {
        throw new BadRequestError("target must be 'ALL', 'TIER', or 'SELECTED'.");
      }

      if (target === 'TIER' && !agentTier) {
        throw new BadRequestError("agentTier is required when target is 'TIER'.");
      }

      if (target === 'SELECTED' && (!Array.isArray(agentIds) || agentIds.length === 0)) {
        throw new BadRequestError("agentIds array is required and cannot be empty when target is 'SELECTED'.");
      }

      // Build dynamic UPDATE query
      let updateSql = '';
      const params: any[] = [];
      let paramIdx = 1;

      if (resetToDefaults) {
        // Reset all custom overrides back to platform defaults
        updateSql = `
          UPDATE agents
          SET custom_min_withdrawal_pesewas = NULL,
              custom_withdrawal_limit_pesewas = NULL,
              custom_daily_limit_pesewas = NULL,
              withdrawals_enabled = TRUE,
              allow_anytime_withdrawals = FALSE,
              updated_at = CURRENT_TIMESTAMP
        `;
      } else {
        const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];

        if (customMinWithdrawalPesewas !== undefined) {
          const val = customMinWithdrawalPesewas === null ? null : Math.round(Number(customMinWithdrawalPesewas));
          params.push(val);
          setClauses.push(`custom_min_withdrawal_pesewas = $${paramIdx++}::bigint`);
        }

        if (customWithdrawalLimitPesewas !== undefined) {
          const val = customWithdrawalLimitPesewas === null ? null : Math.round(Number(customWithdrawalLimitPesewas));
          params.push(val);
          setClauses.push(`custom_withdrawal_limit_pesewas = $${paramIdx++}::bigint`);
        }

        if (customDailyLimitPesewas !== undefined) {
          const val = customDailyLimitPesewas === null ? null : Math.round(Number(customDailyLimitPesewas));
          params.push(val);
          setClauses.push(`custom_daily_limit_pesewas = $${paramIdx++}::bigint`);
        }

        if (withdrawalsEnabled !== undefined) {
          params.push(Boolean(withdrawalsEnabled));
          setClauses.push(`withdrawals_enabled = $${paramIdx++}::boolean`);
        }

        if (allowAnytimeWithdrawals !== undefined) {
          params.push(Boolean(allowAnytimeWithdrawals));
          setClauses.push(`allow_anytime_withdrawals = $${paramIdx++}::boolean`);
        }

        if (setClauses.length === 1) {
          throw new BadRequestError('At least one withdrawal limit, permission, or resetToDefaults must be provided.');
        }

        updateSql = `UPDATE agents SET ${setClauses.join(', ')}`;
      }

      // Append WHERE clause
      if (target === 'TIER') {
        params.push(agentTier!.toUpperCase());
        updateSql += ` WHERE UPPER(agent_tier) = $${paramIdx++}`;
      } else if (target === 'SELECTED') {
        params.push(agentIds);
        updateSql += ` WHERE id = ANY($${paramIdx++}::text[]) OR user_id = ANY($${paramIdx - 1}::text[])`;
      }

      const result = await db.query(updateSql, params);
      const updatedCount = result.rowCount || 0;

      if (auditService) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_AGENT_MASS_WITHDRAWAL_LIMITS_UPDATED',
          resourceType: 'agents',
          resourceId: target,
          metadata: {
            target,
            agentTier,
            agentIdsCount: agentIds?.length,
            customMinWithdrawalPesewas,
            customWithdrawalLimitPesewas,
            customDailyLimitPesewas,
            withdrawalsEnabled,
            allowAnytimeWithdrawals,
            resetToDefaults,
            reason,
            updatedCount,
          },
          ipAddress: req.ip,
        }).catch(() => {});
      }

      const responseData: MassAgentWithdrawalLimitsResult = {
        updatedCount,
        target,
        agentTier,
      };

      return reply.send({
        success: true,
        data: responseData,
        message: `Successfully updated withdrawal limits for ${updatedCount} agent${updatedCount === 1 ? '' : 's'}.`,
      });
    },
  );
}
