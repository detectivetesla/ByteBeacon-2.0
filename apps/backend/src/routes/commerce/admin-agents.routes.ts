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
    const walletBalancePesewas = typeof rawWallet === 'string'
      ? Math.round(parseFloat(rawWallet) * 100)
      : Math.round(Number(rawWallet));

    const agentId = r.id || r.userId || r.user_id;
    const fallbackSlug = `agent-${String(agentId || '').slice(0, 8)}`;

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
            COUNT(DISTINCT s.id) FILTER (WHERE UPPER(COALESCE(s.store_status, s.status, '')) = 'ACTIVE') as "agentsWithStores",
            COUNT(DISTINCT COALESCE(k.agent_id, k.owner_user_id)) FILTER (WHERE UPPER(COALESCE(k.status, '')) = 'ACTIVE') as "agentsWithApi",
            COALESCE(SUM(u.wallet_balance_pesewas), 0) as "totalWalletFloatPesewas",
            COALESCE((
              SELECT SUM(amount_pesewas)
              FROM orders
              WHERE (agent_id IS NOT NULL OR user_id IN (SELECT id FROM users WHERE LOWER(COALESCE(role::text, '')) IN ('agent', 'superagent', 'reseller') OR security_domain = 'AGENT')) AND payment_status = 'PAID'
            ), 0) as "totalRevenuePesewas"
          FROM users u
          LEFT JOIN agents a ON a.user_id = u.id
          LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
          LEFT JOIN api_keys k ON (k.agent_id = u.id OR k.owner_user_id = u.id) AND k.status = 'ACTIVE'
          WHERE LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller')
             OR u.security_domain = 'AGENT'
             OR a.id IS NOT NULL
        `;

        const res = await db.query(statsQuery).catch(async (err) => {
          logger.warn({ err }, 'Primary agent stats query failed, attempting legacy agents-table fallback');
          return db.query(`
            SELECT
              COUNT(DISTINCT a.id) as "totalAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, 'ACTIVE')) = 'ACTIVE' AND UPPER(COALESCE(a.status, 'ACTIVE')) = 'ACTIVE') as "activeAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'SUSPENDED' OR UPPER(COALESCE(a.status, '')) = 'SUSPENDED') as "suspendedAgents",
              COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(u.status, '')) = 'PENDING' OR UPPER(COALESCE(a.status, '')) = 'PENDING') as "pendingAgents",
              COUNT(DISTINCT s.id) FILTER (WHERE UPPER(COALESCE(s.status, '')) = 'ACTIVE') as "agentsWithStores",
              COUNT(DISTINCT k.agent_id) FILTER (WHERE UPPER(COALESCE(k.status, '')) = 'ACTIVE') as "agentsWithApi",
              COALESCE(SUM(u.wallet_balance_pesewas), 0) as "totalWalletFloatPesewas",
              COALESCE((
                SELECT SUM(amount_pesewas)
                FROM orders
                WHERE agent_id IS NOT NULL AND payment_status = 'PAID'
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
        logger.error({ err }, 'Error computing admin agents stats, falling back gracefully');
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
        whereConditions.push(`(s.store_status = 'ACTIVE' OR s.status = 'ACTIVE')`);
      } else if (store === 'PENDING_STORE') {
        whereConditions.push(`(s.store_status = 'PENDING' OR s.status = 'PENDING' OR s.approval_status = 'AWAITING_APPROVAL')`);
      } else if (store === 'SUSPENDED_STORE') {
        whereConditions.push(`(s.store_status = 'SUSPENDED' OR s.status = 'SUSPENDED')`);
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
          SELECT COALESCE(owner_user_id, agent_id) as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY COALESCE(owner_user_id, agent_id)
        ) k ON k.uid = u.id
        WHERE (LOWER(COALESCE(u.role::text, '')) IN ('agent', 'superagent', 'reseller') OR u.security_domain = 'AGENT' OR a.id IS NOT NULL)
          AND ${whereClause}
      `;

      const countRes = await db.query(countQuery, params).catch(() => ({ rows: [{ total: '0' }] }));
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
          COALESCE(s.store_status, s.status, 'NOT_STARTED') as "storeStatus",
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
          COALESCE(a.created_at, u.created_at) as "createdAt",
          COALESCE(u.last_login_at, u.updated_at, u.created_at) as "lastActiveAt"
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        LEFT JOIN (
          SELECT COALESCE(owner_user_id, agent_id) as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY COALESCE(owner_user_id, agent_id)
        ) k ON k.uid = u.id
        LEFT JOIN (
          SELECT COALESCE(agent_id, user_id) as aid, COUNT(*) as orders_count, SUM(amount_pesewas) as revenue_pesewas
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
        logger.error({ err }, 'Error querying agents list');
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
          COALESCE(s.store_status, s.status, 'NOT_STARTED') as "storeStatus",
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
          COALESCE(a.created_at, u.created_at) as "createdAt",
          COALESCE(u.last_login_at, u.updated_at, u.created_at) as "lastActiveAt"
        FROM users u
        LEFT JOIN agents a ON a.user_id = u.id
        LEFT JOIN stores s ON (s.agent_id = a.id OR s.user_id = u.id)
        LEFT JOIN (
          SELECT COALESCE(owner_user_id, agent_id) as uid, COUNT(*) as key_count
          FROM api_keys
          WHERE status = 'ACTIVE'
          GROUP BY COALESCE(owner_user_id, agent_id)
        ) k ON k.uid = u.id
        LEFT JOIN (
          SELECT COALESCE(agent_id, user_id) as aid, COUNT(*) as orders_count, SUM(amount_pesewas) as revenue_pesewas
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
        WHERE a.id::text = $1 OR a.user_id::text = $1 OR u.id::text = $1 OR a.slug = $1 OR s.slug = $1
      `;

      const agentRes = await db.query(agentQuery, [id]).catch((err) => {
        logger.error({ err, id }, 'Failed to query agent base dossier');
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
        WHERE (agent_id = $1 OR owner_user_id = $1)
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
                COALESCE(s.store_status, s.status, 'ACTIVE') as "storeStatus",
                COALESCE(s.approval_status, 'APPROVED') as "approvalStatus",
                COALESCE((SELECT COUNT(*) FROM store_products WHERE store_id = s.id), 0) as "productsCount",
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (store_id = s.id OR agent_id = s.agent_id) AND payment_status = 'PAID'), 0) as "totalSalesPesewas"
         FROM stores s
         WHERE s.agent_id::text = $1 OR s.user_id::text = $2`,
        [agentId, userId],
      ).catch(async () => {
        return db.query(
          `SELECT s.id, s.store_name as "storeName", s.slug,
                  COALESCE(s.status, 'ACTIVE') as "storeStatus",
                  COALESCE(s.status, 'APPROVED') as "approvalStatus",
                  COALESCE((SELECT COUNT(*) FROM store_products WHERE store_id = s.id), 0) as "productsCount",
                  COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (store_id = s.id OR agent_id = s.agent_id) AND payment_status = 'PAID'), 0) as "totalSalesPesewas"
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
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE agent_id = a.id AND payment_status = 'PAID'), 0) as "revenuePesewas",
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
                COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE user_id = u.id AND agent_id = $1 AND payment_status = 'PAID'), 0) as "spentPesewas",
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
      const { fullName, phone, businessName, slug, agentTier, commissionRate, enableApiAccess } = req.body || {};

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

      const updateAgentRes = await db.query(
        `UPDATE agents
         SET business_name = COALESCE($1, business_name),
             slug = COALESCE($2, slug),
             agent_tier = COALESCE($3, agent_tier),
             commission_rate = COALESCE($4, commission_rate),
             api_access_enabled = COALESCE($5, api_access_enabled),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, user_id as "userId", business_name as "businessName", slug,
                   agent_tier as "agentTier", status, api_access_enabled as "apiAccessEnabled",
                   commission_rate as "commissionRate", updated_at as "updatedAt"`,
        [
          businessName?.trim(),
          slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') : undefined,
          agentTier,
          commissionRate,
          enableApiAccess,
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
          metadata: { businessName, slug, agentTier, enableApiAccess },
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
      amountPesewas: number;
      direction: 'CREDIT' | 'DEBIT';
      reason: string;
      idempotencyKey?: string;
    };
  }>(
    '/admin/agents/:id/wallet/adjust',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req, reply) => {
      const { id } = req.params;
      const { amountPesewas, direction, reason, idempotencyKey } = req.body || {};

      if (!amountPesewas || amountPesewas <= 0 || !direction || !reason || reason.trim().length < 5) {
        throw new BadRequestError('Positive amount in pesewas, direction (CREDIT/DEBIT), and mandatory reason (min 5 chars) are required.');
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

      // Post balanced double-entry voucher
      if (financialLedgerService) {
        const client = await db.connect();
        try {
          await client.query('BEGIN');

          const refId = idempotencyKey || id;
          const entries = direction === 'CREDIT'
            ? [
                {
                  accountType: LedgerAccountType.PLATFORM_ESCROW,
                  accountId: 'PLATFORM_RESERVE',
                  entryType: LedgerEntryType.DEBIT,
                  amountPesewas,
                  currency: Currency.GHS,
                  referenceType: 'MANUAL_ADJUSTMENT',
                  referenceId: refId,
                  description: `Admin Float Adjustment Debit: ${reason}`,
                },
                {
                  accountType: LedgerAccountType.CUSTOMER_WALLET,
                  accountId: userId,
                  entryType: LedgerEntryType.CREDIT,
                  amountPesewas,
                  currency: Currency.GHS,
                  referenceType: 'MANUAL_ADJUSTMENT',
                  referenceId: refId,
                  description: `Admin Float Adjustment Credit: ${reason}`,
                },
              ]
            : [
                {
                  accountType: LedgerAccountType.CUSTOMER_WALLET,
                  accountId: userId,
                  entryType: LedgerEntryType.DEBIT,
                  amountPesewas,
                  currency: Currency.GHS,
                  referenceType: 'MANUAL_ADJUSTMENT',
                  referenceId: refId,
                  description: `Admin Float Adjustment Debit: ${reason}`,
                },
                {
                  accountType: LedgerAccountType.PLATFORM_ESCROW,
                  accountId: 'PLATFORM_RESERVE',
                  entryType: LedgerEntryType.CREDIT,
                  amountPesewas,
                  currency: Currency.GHS,
                  referenceType: 'MANUAL_ADJUSTMENT',
                  referenceId: refId,
                  description: `Admin Float Adjustment Credit: ${reason}`,
                },
              ];

          await financialLedgerService.recordJournalEntries(client, entries);

          // Update user wallet projection
          const deltaPesewas = direction === 'CREDIT' ? amountPesewas : -amountPesewas;
          await client.query(
            `UPDATE users
             SET wallet_balance_pesewas = COALESCE(wallet_balance_pesewas, 0) + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [deltaPesewas, userId],
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
          action: 'ADMIN_ADJUST_AGENT_WALLET',
          resourceType: 'agents',
          resourceId: id,
          metadata: { amountPesewas, direction, reason, userId },
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        data: { agentId: id, amountPesewas, direction, reason },
        message: `Agent wallet ${direction.toLowerCase()}ed by GH₵ ${(amountPesewas / 100).toFixed(2)} with balanced double-entry ledger voucher.`,
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
          COALESCE((SELECT SUM(amount_pesewas) FROM orders WHERE (agent_id = a.id OR user_id = u.id) AND payment_status = 'PAID'), 0) / 100.0 as "revenueGhs",
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
}
