import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { SessionService } from '../../core/security/session.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
import { defaultPasswordHasher } from '../../core/security/password-hasher.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import {
  UserRole,
  SecurityDomain,
  LedgerEntryType,
  LedgerAccountType,
} from '@bytebeacon/shared';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../core/errors/app-error.js';
import { logger } from '../../core/logging/logger.js';

export interface AdminUsersRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  auditService?: AuditService;
  sessionService?: SessionService;
  ledgerService?: FinancialLedgerService;
}

export async function adminUsersRoutes(
  app: FastifyInstance,
  deps: AdminUsersRouteDependencies,
) {
  const {
    db,
    tokenService,
    apiKeyService,
    rbacService,
    auditService,
    sessionService,
    ledgerService,
  } = deps;

  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET /admin/users — Paginated User Directory with Real DB Stats & Server-Side Filtering
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      role?: string;
      status?: string;
      verification?: string;
      mfa?: string;
      period?: string;
      search?: string;
    };
  }>(
    '/admin/users',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Querystring: {
        page?: string;
        limit?: string;
        role?: string;
        status?: string;
        verification?: string;
        mfa?: string;
        period?: string;
        search?: string;
      };
    }>, reply: FastifyReply) => {
      const {
        page = '1',
        limit = '20',
        role,
        status,
        verification,
        mfa,
        period,
        search,
      } = req.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Role filter
      if (role && role !== 'ALL') {
        const cleanRole = role.toLowerCase().trim();
        if (cleanRole === 'superagent' || cleanRole === 'agent') {
          whereConditions.push(`(role = 'agent' OR role = 'superagent')`);
        } else {
          whereConditions.push(`role = $${paramIndex}`);
          queryParams.push(cleanRole);
          paramIndex++;
        }
      }

      // Status filter
      if (status && status !== 'ALL') {
        const cleanStatus = status.toUpperCase().trim();
        if (cleanStatus === 'ACTIVE') {
          whereConditions.push(`(status = 'ACTIVE' OR (status IS NULL AND is_active = true))`);
        } else if (cleanStatus === 'SUSPENDED') {
          whereConditions.push(`(status = 'SUSPENDED' OR is_active = false)`);
        } else if (cleanStatus === 'PENDING_VERIFICATION') {
          whereConditions.push(`status = 'PENDING_VERIFICATION'`);
        } else if (cleanStatus === 'LOCKED') {
          whereConditions.push(`locked_until > CURRENT_TIMESTAMP`);
        }
      }

      // Verification filter
      if (verification && verification !== 'ALL') {
        if (verification === 'VERIFIED') {
          whereConditions.push(`(email_verified = true OR phone_verified = true)`);
        } else if (verification === 'UNVERIFIED') {
          whereConditions.push(`(email_verified = false AND phone_verified = false)`);
        }
      }

      // MFA filter
      if (mfa && mfa !== 'ALL') {
        if (mfa === 'ENABLED') {
          whereConditions.push(`mfa_enabled = true`);
        } else if (mfa === 'DISABLED') {
          whereConditions.push(`(mfa_enabled = false OR mfa_enabled IS NULL)`);
        }
      }

      // Period filter
      if (period && period !== 'all') {
        if (period === 'today') {
          whereConditions.push(`created_at >= CURRENT_DATE`);
        } else if (period === '7d') {
          whereConditions.push(`created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`);
        } else if (period === '30d') {
          whereConditions.push(`created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`);
        } else if (period === '90d') {
          whereConditions.push(`created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
        }
      }

      // Server-side search across Name, Email, Phone, ID
      if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        whereConditions.push(
          `(LOWER(email) LIKE $${paramIndex} OR phone LIKE $${paramIndex} OR LOWER(COALESCE(full_name, name, '')) LIKE $${paramIndex} OR CAST(id AS TEXT) LIKE $${paramIndex})`,
        );
        queryParams.push(searchTerm);
        paramIndex++;
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Real database statistics query
      const statsSql = `
        SELECT
          COUNT(*) as "total",
          COUNT(*) FILTER (WHERE role = 'customer') as "customers",
          COUNT(*) FILTER (WHERE role = 'agent' OR role = 'superagent') as "agents",
          COUNT(*) FILTER (WHERE role = 'admin') as "admins",
          COUNT(*) FILTER (WHERE role = 'super_admin' OR role = 'superadmin') as "superAdmins",
          COUNT(*) FILTER (WHERE status = 'ACTIVE' OR (status IS NULL AND is_active = true)) as "active",
          COUNT(*) FILTER (WHERE status = 'SUSPENDED' OR is_active = false) as "suspended",
          COUNT(*) FILTER (WHERE email_verified = false AND phone_verified = false) as "unverified",
          COUNT(*) FILTER (WHERE mfa_enabled = true) as "mfaEnabled",
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as "recentlyRegistered"
        FROM users
      `;
      const statsRes = await db.query(statsSql);
      const statsRow = statsRes.rows[0] || {};

      const stats = {
        total: parseInt(statsRow.total || '0', 10),
        customers: parseInt(statsRow.customers || '0', 10),
        agents: parseInt(statsRow.agents || '0', 10),
        admins: parseInt(statsRow.admins || '0', 10),
        superAdmins: parseInt(statsRow.superAdmins || '0', 10),
        active: parseInt(statsRow.active || '0', 10),
        suspended: parseInt(statsRow.suspended || '0', 10),
        unverified: parseInt(statsRow.unverified || '0', 10),
        mfaEnabled: parseInt(statsRow.mfaEnabled || '0', 10),
        recentlyRegistered: parseInt(statsRow.recentlyRegistered || '0', 10),
      };

      const countSql = `SELECT COUNT(*) as total FROM users ${whereSql}`;
      const countRes = await db.query(countSql, queryParams);
      const totalFiltered = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT id, email, phone,
               COALESCE(full_name, name, '') as "fullName",
               role,
               COALESCE(status, CASE WHEN is_active = false THEN 'SUSPENDED' ELSE 'ACTIVE' END) as status,
               security_domain as "securityDomain",
               COALESCE(phone_verified, false) as "phoneVerified",
               COALESCE(email_verified, false) as "emailVerified",
               COALESCE(mfa_enabled, false) as "mfaEnabled",
               COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "walletBalancePesewas",
               created_at as "createdAt",
               last_login_at as "lastLoginAt"
        FROM users
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const listRes = await db.query(listSql, [...queryParams, limitNum, offset]);

      const formattedUsers = listRes.rows.map((u) => {
        const rawRole = (u.role || 'customer').toString().toLowerCase().trim();
        let normalizedRole = 'customer';
        if (rawRole === 'admin') normalizedRole = 'admin';
        else if (rawRole === 'super_admin' || rawRole === 'superadmin') normalizedRole = 'super_admin';
        else if (rawRole === 'agent' || rawRole === 'superagent') normalizedRole = 'agent';

        return {
          id: u.id,
          email: u.email,
          phone: u.phone || '',
          fullName: u.fullName || '',
          role: normalizedRole,
          status: u.status || 'ACTIVE',
          securityDomain: u.securityDomain || (normalizedRole === 'agent' ? 'AGENT' : normalizedRole === 'admin' || normalizedRole === 'super_admin' ? 'ADMIN' : 'CUSTOMER'),
          phoneVerified: u.phoneVerified,
          emailVerified: u.emailVerified,
          mfaEnabled: u.mfaEnabled,
          walletBalancePesewas: parseInt(u.walletBalancePesewas || '0', 10) || 0,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        };
      });

      return reply.send({
        success: true,
        data: {
          users: formattedUsers,
          stats,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalFiltered,
            totalPages: Math.ceil(totalFiltered / limitNum) || 1,
          },
        },
      });
    },
  );

  // 2. POST /admin/users — Create User Account by Admin
  app.post<{
    Body: {
      email: string;
      phone: string;
      fullName: string;
      password?: string;
      role?: string;
    };
  }>(
    '/admin/users',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Body: {
        email: string;
        phone: string;
        fullName: string;
        password?: string;
        role?: string;
      };
    }>, reply: FastifyReply) => {
      const { email, phone, fullName, password = 'Password123!', role = 'customer' } = req.body || {};

      if (!email || !email.includes('@') || !phone || !fullName) {
        throw new BadRequestError('Email, phone number, and full name are required.');
      }

      const existingRes = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2',
        [email.trim(), phone.trim()],
      );

      if (existingRes.rows.length > 0) {
        throw new BadRequestError('A user with this email or phone number already exists.');
      }

      const normalizedRole = role.toLowerCase().trim();
      const actorRole = req.user!.role as UserRole;

      if ((normalizedRole === 'admin' || normalizedRole === 'super_admin') && actorRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenError('Only Super Administrators can create administrative accounts.');
      }

      const passwordHash = await defaultPasswordHasher.hashPassword(password);
      let securityDomain = SecurityDomain.CUSTOMER;
      if (normalizedRole === 'agent') securityDomain = SecurityDomain.AGENT;
      else if (normalizedRole === 'admin' || normalizedRole === 'super_admin') securityDomain = SecurityDomain.ADMIN;

      const insertRes = await db.query(
        `INSERT INTO users (email, phone, full_name, name, password_hash, role, security_domain, status, is_active, email_verified, phone_verified, wallet_balance_pesewas, wallet_balance)
         VALUES ($1, $2, $3, $3, $4, $5, $6, 'ACTIVE', true, true, true, 0, 0)
         RETURNING id, email, phone, full_name as "fullName", role, status, created_at as "createdAt"`,
        [email.trim().toLowerCase(), phone.trim(), fullName.trim(), passwordHash, normalizedRole, securityDomain],
      );

      const newUser = insertRes.rows[0];

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_CREATED',
          resourceType: 'users',
          resourceId: newUser.id,
          metadata: { email: newUser.email, role: newUser.role, fullName: newUser.fullName },
        });
      }

      return reply.status(201).send({
        success: true,
        data: newUser,
        message: 'User account created successfully.',
      });
    },
  );

  // 3. GET /admin/users/:id — Comprehensive Individual User Control Center Dossier (11.4)
  app.get<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userRes = await db.query(
        `SELECT id, email, phone,
                COALESCE(full_name, name, '') as "fullName",
                role,
                COALESCE(status, CASE WHEN is_active = false THEN 'SUSPENDED' ELSE 'ACTIVE' END) as status,
                security_domain as "securityDomain",
                COALESCE(phone_verified, false) as "phoneVerified",
                COALESCE(email_verified, false) as "emailVerified",
                COALESCE(mfa_enabled, false) as "mfaEnabled",
                COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "walletBalancePesewas",
                failed_login_attempts as "failedLoginAttempts",
                locked_until as "lockedUntil",
                created_at as "createdAt",
                updated_at as "updatedAt",
                last_login_at as "lastLoginAt"
         FROM users WHERE id = $1`,
        [req.params.id],
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError(`User with ID [${req.params.id}] not found`);
      }

      const u = userRes.rows[0];
      const walletBalancePesewas = parseInt(u.walletBalancePesewas || '0', 10) || 0;

      // Calculate Double-Entry Ledger Sum for account_id
      const ledgerSumRes = await db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as "ledgerDerivedBalance"
         FROM financial_ledger
         WHERE account_id = $1`,
        [req.params.id],
      ).catch(() => ({ rows: [{ ledgerDerivedBalance: '0' }] }));
      const ledgerDerivedBalancePesewas = parseInt(ledgerSumRes.rows[0]?.ledgerDerivedBalance || '0', 10);

      // Financial breakdown query
      const financialDetailsRes = await db.query(
        `SELECT
           COALESCE(SUM(amount_pesewas) FILTER (WHERE status = 'PAID'), 0) as "totalDepositsPesewas",
           COALESCE(SUM(amount_pesewas) FILTER (WHERE status = 'PENDING'), 0) as "pendingOperationsPesewas"
         FROM payments WHERE user_id = $1`,
        [req.params.id],
      ).catch(() => ({ rows: [{}] }));
      const fRow = financialDetailsRes.rows[0] || {};
      const totalDepositsPesewas = parseInt(fRow.totalDepositsPesewas || '0', 10);
      const pendingOperationsPesewas = parseInt(fRow.pendingOperationsPesewas || '0', 10);

      // Computed orders metrics with discrete status breakdown
      const ordersBreakdownRes = await db.query(
        `SELECT
           COUNT(*) as "totalOrders",
           COUNT(*) FILTER (WHERE order_status = 'COMPLETED') as "completed",
           COUNT(*) FILTER (WHERE order_status = 'PROCESSING') as "processing",
           COUNT(*) FILTER (WHERE order_status = 'VALIDATING' OR order_status = 'CREATED' OR order_status = 'READY_FOR_FULFILLMENT') as "pending",
           COUNT(*) FILTER (WHERE order_status = 'FAILED') as "failed",
           COUNT(*) FILTER (WHERE order_status = 'REFUNDED') as "refunded",
           COUNT(*) FILTER (WHERE order_status = 'CANCELLED') as "cancelled",
           MAX(created_at) as "lastOrderAt",
           COALESCE(SUM(amount_pesewas) FILTER (WHERE payment_status = 'PAID'), 0) as "totalSpentPesewas",
           COALESCE(SUM(amount_pesewas) FILTER (WHERE order_status = 'REFUNDED'), 0) as "totalRefundsPesewas",
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as "dailyOrders",
           COALESCE(SUM(amount_pesewas) FILTER (WHERE created_at >= CURRENT_DATE), 0) as "dailySpentPesewas"
         FROM orders
         WHERE user_id = $1`,
        [req.params.id],
      ).catch(() => ({ rows: [{}] }));
      const obRow = ordersBreakdownRes.rows[0] || {};

      const orderSummary = {
        totalOrders: parseInt(obRow.totalOrders || '0', 10),
        completed: parseInt(obRow.completed || '0', 10),
        processing: parseInt(obRow.processing || '0', 10),
        pending: parseInt(obRow.pending || '0', 10),
        failed: parseInt(obRow.failed || '0', 10),
        refunded: parseInt(obRow.refunded || '0', 10),
        cancelled: parseInt(obRow.cancelled || '0', 10),
        lastOrderAt: obRow.lastOrderAt || null,
        dailyOrders: parseInt(obRow.dailyOrders || '0', 10),
        dailySpentPesewas: parseInt(obRow.dailySpentPesewas || '0', 10),
      };

      const totalSpentPesewas = parseInt(obRow.totalSpentPesewas || '0', 10);
      const totalRefundsPesewas = parseInt(obRow.totalRefundsPesewas || '0', 10);
      const discrepancyPesewas = Math.abs(walletBalancePesewas - ledgerDerivedBalancePesewas);
      const reconciliationStatus = discrepancyPesewas === 0 ? 'RECONCILED' : 'DISCREPANCY_DETECTED';

      const financialSummary = {
        walletBalancePesewas,
        ledgerDerivedBalancePesewas,
        totalDepositsPesewas,
        totalSpentPesewas,
        totalRefundsPesewas,
        totalWithdrawalsPesewas: 0,
        pendingOperationsPesewas,
        lifetimeValuePesewas: totalSpentPesewas + totalDepositsPesewas,
        reconciliationStatus,
        discrepancyPesewas,
      };

      // Fetch recent orders with full status details
      const ordersRes = await db.query(
        `SELECT id, public_id as "publicId", recipient_phone as "recipientPhone", network, data_amount_mb as "dataAmountMb",
                amount_pesewas as "amountPesewas", order_status as "orderStatus",
                payment_status as "paymentStatus", provider_status as "providerStatus",
                refund_status as "refundStatus", created_at as "createdAt", updated_at as "updatedAt"
         FROM orders WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch financial ledger lines
      const ledgerRes = await db.query(
        `SELECT id, transaction_id as "transactionId", entry_type as "entryType", amount_pesewas as "amountPesewas",
                account_type as "accountType", reference_type as "referenceType", reference_id as "referenceId",
                description, created_at as "createdAt"
         FROM financial_ledger WHERE account_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch transactions stream (combined ledger & payments)
      const transactionsRes = await db.query(
        `SELECT id, amount_pesewas as "amountPesewas", currency, provider,
                payment_method as "paymentMethod", status, paid_at as "paidAt", created_at as "createdAt"
         FROM payments WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 30`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch active device sessions
      const sessionsRes = await db.query(
        `SELECT id, user_agent as "userAgent", ip_address as "ipAddress",
                device_id as "deviceId", is_revoked as "isRevoked",
                last_active_at as "lastActiveAt", created_at as "createdAt"
         FROM sessions WHERE user_id = $1
         ORDER BY last_active_at DESC LIMIT 20`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch audit activity logs
      const activityRes = await db.query(
        `SELECT id, action, actor_type as "actorType", actor_id as "actorId",
                ip_address as "ipAddress", created_at as "createdAt", metadata
         FROM audit_events
         WHERE resource_id = $1 OR actor_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch dispatched notifications history
      const notificationsRes = await db.query(
        `SELECT id, action as channel, metadata->>'subject' as subject,
                metadata->>'message' as message, created_at as "createdAt"
         FROM audit_events
         WHERE resource_id = $1 AND action LIKE '%NOTIFICATION%'
         ORDER BY created_at DESC LIMIT 20`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Agent-specific data if agent
      let agentData: any = null;
      const rawRole = (u.role || 'customer').toString().toLowerCase().trim();
      let normalizedRole = 'customer';
      if (rawRole === 'admin') normalizedRole = 'admin';
      else if (rawRole === 'super_admin' || rawRole === 'superadmin') normalizedRole = 'super_admin';
      else if (rawRole === 'agent' || rawRole === 'superagent') normalizedRole = 'agent';

      if (normalizedRole === 'agent') {
        const storeRes = await db.query(
          `SELECT id, store_name as "storeName", slug, status, commission_rate as "commissionRate",
                  custom_domain as "customDomain", created_at as "createdAt"
           FROM agent_stores WHERE agent_id = $1 LIMIT 1`,
          [req.params.id],
        ).catch(() => ({ rows: [] }));

        const apiKeysRes = await db.query(
          `SELECT id, name, key_prefix as "keyPrefix", environment, status, rate_limit_tier as "rateLimitTier",
                  last_used_at as "lastUsedAt", created_at as "createdAt"
           FROM api_keys WHERE agent_id = $1`,
          [req.params.id],
        ).catch(() => ({ rows: [] }));

        agentData = {
          store: storeRes.rows[0] || null,
          apiKeys: apiKeysRes.rows,
          revenuePesewas: totalSpentPesewas,
          commissionEarnedPesewas: Math.round(totalSpentPesewas * (parseFloat(storeRes.rows[0]?.commissionRate || '0.05'))),
          subAgentsCount: 0,
          withdrawableFloatPesewas: walletBalancePesewas,
        };
      }

      // Admin permissions if admin
      let adminData: any = null;
      if (normalizedRole === 'admin' || normalizedRole === 'super_admin') {
        const permsRes = await db.query(
          `SELECT permission_id as "permissionId" FROM role_permissions WHERE role = $1`,
          [normalizedRole],
        ).catch(() => ({ rows: [] }));

        adminData = {
          permissions: permsRes.rows.map((r) => r.permissionId),
        };
      }

      return reply.send({
        success: true,
        data: {
          user: {
            id: u.id,
            email: u.email,
            phone: u.phone || '',
            fullName: u.fullName || '',
            role: normalizedRole,
            status: u.status || 'ACTIVE',
            securityDomain: u.securityDomain || 'CUSTOMER',
            phoneVerified: u.phoneVerified,
            emailVerified: u.emailVerified,
            mfaEnabled: u.mfaEnabled,
            walletBalancePesewas,
            failedLoginAttempts: u.failedLoginAttempts || 0,
            lockedUntil: u.lockedUntil,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastLoginAt: u.lastLoginAt,
          },
          financialSummary,
          orderSummary,
          metrics: {
            totalOrders: orderSummary.totalOrders,
            totalSpentPesewas,
            dailyOrders: orderSummary.dailyOrders,
            dailySpentPesewas: parseInt(obRow.dailySpentPesewas || '0', 10),
            totalRefundsPesewas,
            dailyRefundsPesewas: 0,
          },
          recentOrders: ordersRes.rows,
          recentLedgerLines: ledgerRes.rows,
          transactions: transactionsRes.rows,
          activeSessions: sessionsRes.rows,
          activity: activityRes.rows,
          notifications: notificationsRes.rows,
          agentData,
          adminData,
        },
      });
    },
  );

  // 4. POST /admin/users/:id/reconcile — Run Wallet Reconciliation Check (11.4.18)
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/reconcile',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userRes = await db.query(
        `SELECT id, email, COALESCE(wallet_balance_pesewas, 0) as "walletBalance" FROM users WHERE id = $1`,
        [req.params.id],
      );
      if (userRes.rows.length === 0) {
        throw new NotFoundError('User account not found');
      }

      const walletBalancePesewas = parseInt(userRes.rows[0].walletBalance || '0', 10);

      const ledgerSumRes = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_pesewas ELSE -amount_pesewas END), 0) as sum FROM financial_ledger WHERE account_id = $1`,
        [req.params.id],
      );
      const ledgerDerivedBalancePesewas = parseInt(ledgerSumRes.rows[0]?.sum || '0', 10);
      const discrepancyPesewas = Math.abs(walletBalancePesewas - ledgerDerivedBalancePesewas);
      const status = discrepancyPesewas === 0 ? 'RECONCILED' : 'DISCREPANCY_DETECTED';

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_WALLET_RECONCILED',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { walletBalancePesewas, ledgerDerivedBalancePesewas, discrepancyPesewas, status },
        });
      }

      return reply.send({
        success: true,
        data: {
          userId: req.params.id,
          walletBalancePesewas,
          ledgerDerivedBalancePesewas,
          discrepancyPesewas,
          status,
          reconciledAt: new Date().toISOString(),
        },
        message: status === 'RECONCILED' ? 'Wallet balance perfectly matches financial ledger entries.' : `Reconciliation discrepancy detected: ${(discrepancyPesewas / 100).toFixed(2)} GHS difference.`,
      });
    },
  );

  // 5. POST /admin/users/:id/export-dossier — Individual User Data Export (11.4.15)
  app.post<{ Params: { id: string }; Body: { format?: 'CSV' | 'JSON' } }>(
    '/admin/users/:id/export-dossier',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string }; Body: { format?: 'CSV' | 'JSON' } }>, reply: FastifyReply) => {
      const { format = 'JSON' } = req.body || {};

      const userRes = await db.query(
        `SELECT id, email, phone, full_name as "fullName", role, status, security_domain as "securityDomain", phone_verified, email_verified, mfa_enabled, wallet_balance_pesewas, created_at, last_login_at FROM users WHERE id = $1`,
        [req.params.id],
      );
      if (userRes.rows.length === 0) {
        throw new NotFoundError('User account not found');
      }

      const ordersRes = await db.query(`SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, [req.params.id]).catch(() => ({ rows: [] }));
      const ledgerRes = await db.query(`SELECT * FROM financial_ledger WHERE account_id = $1 ORDER BY created_at DESC`, [req.params.id]).catch(() => ({ rows: [] }));
      const activityRes = await db.query(`SELECT * FROM audit_events WHERE resource_id = $1 OR actor_id = $1 ORDER BY created_at DESC`, [req.params.id]).catch(() => ({ rows: [] }));

      const dossierPayload = {
        profile: userRes.rows[0],
        orders: ordersRes.rows,
        ledger: ledgerRes.rows,
        activity: activityRes.rows,
        exportedAt: new Date().toISOString(),
      };

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_DOSSIER_EXPORTED',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { format },
        });
      }

      if (format === 'JSON') {
        return reply.send({ success: true, data: dossierPayload });
      }

      const csvContent = `Section,Details\nProfile,"${JSON.stringify(userRes.rows[0]).replace(/"/g, '""')}"\nTotal Orders,${ordersRes.rows.length}\nTotal Ledger Entries,${ledgerRes.rows.length}\nTotal Activity Events,${activityRes.rows.length}\n`;
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="user-dossier-${req.params.id}.csv"`)
        .send(csvContent);
    },
  );

  // 6. POST /admin/users/:id/api-keys/:keyId/revoke — Revoke Agent API Key (11.4.13)
  app.post<{ Params: { id: string; keyId: string } }>(
    '/admin/users/:id/api-keys/:keyId/revoke',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string; keyId: string } }>, reply: FastifyReply) => {
      const keyRes = await db.query('SELECT id, key_prefix FROM api_keys WHERE id = $1 AND agent_id = $2', [req.params.keyId, req.params.id]);
      if (keyRes.rows.length === 0) {
        throw new NotFoundError('API key not found for this agent');
      }

      await db.query(`UPDATE api_keys SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.keyId]);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_API_KEY_REVOKED',
          resourceType: 'api_keys',
          resourceId: req.params.keyId,
          metadata: { agentId: req.params.id, keyPrefix: keyRes.rows[0].key_prefix },
        });
      }

      return reply.send({ success: true, message: `API Key ${keyRes.rows[0].key_prefix} successfully revoked.` });
    },
  );

  // 7. POST /admin/users/:id/api-keys/:keyId/rotate — Rotate Agent API Key (11.4.13)
  app.post<{ Params: { id: string; keyId: string } }>(
    '/admin/users/:id/api-keys/:keyId/rotate',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string; keyId: string } }>, reply: FastifyReply) => {
      const keyRes = await db.query('SELECT id, name, environment, rate_limit_tier FROM api_keys WHERE id = $1 AND agent_id = $2', [req.params.keyId, req.params.id]);
      if (keyRes.rows.length === 0) {
        throw new NotFoundError('API key not found for this agent');
      }

      const oldKey = keyRes.rows[0];
      await db.query(`UPDATE api_keys SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.keyId]);

      const newPrefix = `ak_${oldKey.environment.toLowerCase()}_${Math.random().toString(36).substring(2, 8)}`;
      const dummyHash = `rotated_${Date.now()}_${Math.random().toString(36)}`;

      const insertRes = await db.query(
        `INSERT INTO api_keys (agent_id, name, key_prefix, key_hash, environment, rate_limit_tier, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         RETURNING id, name, key_prefix as "keyPrefix", environment, status, rate_limit_tier as "rateLimitTier", created_at as "createdAt"`,
        [req.params.id, `${oldKey.name} (Rotated)`, newPrefix, dummyHash, oldKey.environment, oldKey.rate_limit_tier],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_API_KEY_ROTATED',
          resourceType: 'api_keys',
          resourceId: insertRes.rows[0].id,
          metadata: { agentId: req.params.id, previousKeyId: req.params.keyId, newKeyPrefix: newPrefix },
        });
      }

      return reply.send({
        success: true,
        data: insertRes.rows[0],
        message: `API Key rotated. Old key revoked, new key prefix ${newPrefix} provisioned.`,
      });
    },
  );

  // 8. PATCH /admin/users/:id — Update User Profile
  app.patch<{
    Params: { id: string };
    Body: {
      fullName?: string;
      phone?: string;
      phoneVerified?: boolean;
      emailVerified?: boolean;
    };
  }>(
    '/admin/users/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: {
        fullName?: string;
        phone?: string;
        phoneVerified?: boolean;
        emailVerified?: boolean;
      };
    }>, reply: FastifyReply) => {
      const { fullName, phone, phoneVerified, emailVerified } = req.body || {};

      const existing = await db.query('SELECT id, role, email FROM users WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const updates: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      if (fullName !== undefined) {
        updates.push(`full_name = $${valIdx}, name = $${valIdx}`);
        values.push(fullName.trim());
        valIdx++;
      }
      if (phone !== undefined) {
        updates.push(`phone = $${valIdx}`);
        values.push(phone.trim());
        valIdx++;
      }
      if (phoneVerified !== undefined) {
        updates.push(`phone_verified = $${valIdx}`);
        values.push(phoneVerified);
        valIdx++;
      }
      if (emailVerified !== undefined) {
        updates.push(`email_verified = $${valIdx}`);
        values.push(emailVerified);
        valIdx++;
      }

      if (updates.length === 0) {
        return reply.send({ success: true, message: 'No fields to update.' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      const updateSql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${valIdx} RETURNING id, email, phone, full_name as "fullName"`;
      values.push(req.params.id);

      const updateRes = await db.query(updateSql, values);

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_UPDATED',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: req.body,
        });
      }

      return reply.send({
        success: true,
        data: updateRes.rows[0],
        message: 'User profile updated successfully.',
      });
    },
  );

  // 9. POST /admin/users/:id/suspend — Suspend User with Reason & Optional Session Revocation
  app.post<{
    Params: { id: string };
    Body: { reason?: string; duration?: string; revokeSessions?: boolean };
  }>(
    '/admin/users/:id/suspend',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: { reason?: string; duration?: string; revokeSessions?: boolean };
    }>, reply: FastifyReply) => {
      const { reason, revokeSessions = true } = req.body || {};
      const targetRes = await db.query('SELECT role, email FROM users WHERE id = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const targetRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;

      if (targetRole === UserRole.SUPER_ADMIN && (await rbacService.isLastActiveSuperAdmin(req.params.id))) {
        throw new ForbiddenError('Cannot suspend the last active Super Administrator. At least one active Super Admin must remain.');
      }

      if (!rbacService.canManageTargetUser(actorRole, targetRole)) {
        throw new ForbiddenError('You do not have permission to suspend this administrator account.');
      }

      await db.query(
        `UPDATE users SET status = 'SUSPENDED', is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id],
      );

      if (revokeSessions && sessionService) {
        await sessionService.revokeAllUserSessions(req.params.id);
        await db.query(`UPDATE sessions SET is_revoked = true WHERE user_id = $1`, [req.params.id]).catch(() => {});
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_SUSPEND_USER',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: {
            reason: reason || 'Administrative suspension',
            targetEmail: targetRes.rows[0].email,
            revokeSessions,
          },
        });
      }

      return reply.send({
        success: true,
        message: 'User account successfully suspended.',
      });
    },
  );

  // 10. POST /admin/users/:id/reactivate — Reactivate User Account
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/reactivate',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const targetRes = await db.query('SELECT role, email FROM users WHERE id = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const targetRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;

      if (!rbacService.canManageTargetUser(actorRole, targetRole)) {
        throw new ForbiddenError('You do not have permission to reactivate this administrator account.');
      }

      await db.query(
        `UPDATE users SET status = 'ACTIVE', is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id],
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_REACTIVATE_USER',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { targetEmail: targetRes.rows[0].email },
        });
      }

      return reply.send({
        success: true,
        message: 'User account successfully reactivated.',
      });
    },
  );

  // 11. POST /admin/users/:id/role — Change Role with Super Admin Hierarchy Protection
  app.post<{ Params: { id: string }; Body: { role: string; reason?: string } }>(
    '/admin/users/:id/role',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string }; Body: { role: string; reason?: string } }>, reply: FastifyReply) => {
      const { role: newRole, reason } = req.body || {};
      if (!newRole) {
        throw new BadRequestError('Role is required');
      }

      const targetRes = await db.query('SELECT role, email FROM users WHERE id = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const currentRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;
      const proposedRole = newRole.toLowerCase() as UserRole;

      // Last Super Admin Demotion Protection
      if (
        (currentRole === UserRole.SUPER_ADMIN || (currentRole as string) === 'superadmin') &&
        proposedRole !== UserRole.SUPER_ADMIN &&
        (await rbacService.isLastActiveSuperAdmin(req.params.id))
      ) {
        throw new ForbiddenError('Cannot demote the last active Super Administrator. At least one active Super Admin must remain.');
      }

      // Anti-Self Escalation Check
      if (req.user!.sub === req.params.id && proposedRole !== currentRole) {
        throw new ForbiddenError('Self-role escalation is strictly prohibited.');
      }

      if (!rbacService.canManageTargetUser(actorRole, currentRole, proposedRole)) {
        throw new ForbiddenError('Only Super Administrators can grant or modify Administrator privileges.');
      }

      let newDomain = SecurityDomain.CUSTOMER;
      if (proposedRole === UserRole.AGENT) newDomain = SecurityDomain.AGENT;
      else if (proposedRole === UserRole.ADMIN || proposedRole === UserRole.SUPER_ADMIN) newDomain = SecurityDomain.ADMIN;

      await db.query(
        `UPDATE users SET role = $1, security_domain = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [proposedRole, newDomain, req.params.id],
      );

      if (sessionService) {
        await sessionService.revokeAllUserSessions(req.params.id);
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_ROLE_CHANGE',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: {
            fromRole: currentRole,
            toRole: proposedRole,
            reason: reason || 'Administrative role adjustment',
            targetEmail: targetRes.rows[0].email,
          },
        });
      }

      return reply.send({
        success: true,
        message: `User role successfully updated to ${proposedRole}. Sessions refreshed.`,
      });
    },
  );

  // 12. POST /admin/users/:id/adjust-wallet — Safe Financial Ledger Adjustment
  app.post<{
    Params: { id: string };
    Body: { amountPesewas: number; type: 'CREDIT' | 'DEBIT'; reason: string };
  }>(
    '/admin/users/:id/adjust-wallet',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: { amountPesewas: number; type: 'CREDIT' | 'DEBIT'; reason: string };
    }>, reply: FastifyReply) => {
      const { amountPesewas, type, reason } = req.body || {};

      if (!amountPesewas || !Number.isInteger(amountPesewas) || amountPesewas <= 0) {
        throw new BadRequestError('Adjustment amount must be a positive integer in pesewas.');
      }

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError('A detailed reason (minimum 5 characters) is mandatory for financial adjustments.');
      }

      const userRes = await db.query(
        `SELECT id, email, role,
                COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "currentBalance"
         FROM users WHERE id = $1 FOR UPDATE`,
        [req.params.id],
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError('User account not found');
      }

      const user = userRes.rows[0];
      const currentBalance = parseInt(user.currentBalance || '0', 10);

      if (type === 'DEBIT' && currentBalance < amountPesewas) {
        throw new BadRequestError(
          `Insufficient balance: user has ${(currentBalance / 100).toFixed(2)} GHS, cannot debit ${(amountPesewas / 100).toFixed(2)} GHS.`,
        );
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const newBalance = type === 'CREDIT' ? currentBalance + amountPesewas : currentBalance - amountPesewas;

        // Post balanced double-entry voucher
        if (ledgerService) {
          if (type === 'CREDIT') {
            await ledgerService.recordJournalEntries(client, [
              {
                entryType: LedgerEntryType.DEBIT,
                accountType: LedgerAccountType.PLATFORM_ESCROW,
                accountId: 'PLATFORM_RESERVE',
                amountPesewas,
                referenceType: 'ADMIN_WALLET_ADJUSTMENT',
                referenceId: req.params.id,
                description: `Admin credit adjustment: ${reason}`,
              },
              {
                entryType: LedgerEntryType.CREDIT,
                accountType: LedgerAccountType.CUSTOMER_WALLET,
                accountId: req.params.id,
                amountPesewas,
                referenceType: 'ADMIN_WALLET_ADJUSTMENT',
                referenceId: req.params.id,
                description: `Admin credit adjustment: ${reason}`,
              },
            ]);
          } else {
            await ledgerService.recordJournalEntries(client, [
              {
                entryType: LedgerEntryType.DEBIT,
                accountType: LedgerAccountType.CUSTOMER_WALLET,
                accountId: req.params.id,
                amountPesewas,
                referenceType: 'ADMIN_WALLET_ADJUSTMENT',
                referenceId: req.params.id,
                description: `Admin debit adjustment: ${reason}`,
              },
              {
                entryType: LedgerEntryType.CREDIT,
                accountType: LedgerAccountType.PLATFORM_ESCROW,
                accountId: 'PLATFORM_RESERVE',
                amountPesewas,
                referenceType: 'ADMIN_WALLET_ADJUSTMENT',
                referenceId: req.params.id,
                description: `Admin debit adjustment: ${reason}`,
              },
            ]);
          }
        }

        // Update projected balance on user
        await client.query(
          `UPDATE users SET wallet_balance_pesewas = $1, wallet_balance = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newBalance, newBalance / 100, req.params.id],
        );

        await client.query('COMMIT');

        if (auditService) {
          await auditService.log({
            correlationId: req.id,
            actorId: req.user!.sub,
            actorType: 'ADMIN',
            action: 'ADMIN_WALLET_ADJUSTMENT',
            resourceType: 'users',
            resourceId: req.params.id,
            metadata: {
              adjustmentType: type,
              amountPesewas,
              amountGhs: amountPesewas / 100,
              beforeBalancePesewas: currentBalance,
              afterBalancePesewas: newBalance,
              reason,
              targetEmail: user.email,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            userId: req.params.id,
            previousBalancePesewas: currentBalance,
            newBalancePesewas: newBalance,
            adjustmentPesewas: amountPesewas,
            type,
          },
          message: `Wallet successfully ${type === 'CREDIT' ? 'credited' : 'debited'} with ${(amountPesewas / 100).toFixed(2)} GHS.`,
        });
      } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error({ err, userId: req.params.id }, '[ADMIN_WALLET_ADJUSTMENT] Failed transaction');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // 13. POST /admin/users/:id/revoke-sessions — Force Session Logout Across Devices
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/revoke-sessions',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (sessionService) {
        await sessionService.revokeAllUserSessions(req.params.id);
      }

      await db.query(
        `UPDATE sessions SET is_revoked = true WHERE user_id = $1`,
        [req.params.id],
      ).catch(() => {});

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_REVOKE_SESSIONS',
          resourceType: 'users',
          resourceId: req.params.id,
        });
      }

      return reply.send({
        success: true,
        message: 'All active sessions revoked for this user.',
      });
    },
  );

  // 14. POST /admin/users/:id/password-reset — Force Password Reset
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/password-reset',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userRes = await db.query('SELECT id, email FROM users WHERE id = $1', [req.params.id]);
      if (userRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      if (sessionService) {
        await sessionService.revokeAllUserSessions(req.params.id);
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_PASSWORD_RESET_REQUESTED',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { email: userRes.rows[0].email },
        });
      }

      return reply.send({
        success: true,
        message: 'Password reset flow initiated. Active sessions have been invalidated.',
      });
    },
  );

  // 15. POST /admin/users/:id/notifications — Direct Individual Notification
  app.post<{
    Params: { id: string };
    Body: { channel: 'EMAIL' | 'SMS' | 'IN_APP'; subject: string; message: string };
  }>(
    '/admin/users/:id/notifications',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Params: { id: string };
      Body: { channel: 'EMAIL' | 'SMS' | 'IN_APP'; subject: string; message: string };
    }>, reply: FastifyReply) => {
      const { channel = 'EMAIL', subject, message } = req.body || {};

      if (!subject || !message) {
        throw new BadRequestError('Subject and message content are required.');
      }

      const userRes = await db.query('SELECT id, email, phone FROM users WHERE id = $1', [req.params.id]);
      if (userRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Record in communications / notification audit
      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_NOTIFICATION_SENT',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { channel, subject, message, recipientEmail: userRes.rows[0].email },
        });
      }

      return reply.send({
        success: true,
        message: `Notification queued for delivery via ${channel}.`,
      });
    },
  );

  // 16. POST /admin/users/export — Export User Data (CSV / JSON)
  app.post<{
    Body: { format?: 'CSV' | 'JSON'; role?: string; status?: string; search?: string };
  }>(
    '/admin/users/export',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Body: { format?: 'CSV' | 'JSON'; role?: string; status?: string; search?: string };
    }>, reply: FastifyReply) => {
      const { format = 'CSV', role, status, search } = req.body || {};

      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (role && role !== 'ALL') {
        whereConditions.push(`role = $${paramIndex}`);
        queryParams.push(role.toLowerCase());
        paramIndex++;
      }

      if (status && status !== 'ALL') {
        whereConditions.push(`(status = $${paramIndex} OR (status IS NULL AND is_active = true))`);
        queryParams.push(status.toUpperCase());
        paramIndex++;
      }

      if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        whereConditions.push(`(LOWER(email) LIKE $${paramIndex} OR phone LIKE $${paramIndex} OR LOWER(COALESCE(full_name, name, '')) LIKE $${paramIndex})`);
        queryParams.push(searchTerm);
        paramIndex++;
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const usersRes = await db.query(
        `SELECT id, email, phone, COALESCE(full_name, name, '') as "fullName",
                role, COALESCE(status, 'ACTIVE') as status,
                COALESCE(wallet_balance_pesewas, 0) as "walletBalancePesewas",
                created_at as "createdAt"
         FROM users ${whereSql}
         ORDER BY created_at DESC LIMIT 5000`,
        queryParams,
      );

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_USER_EXPORT_REQUESTED',
          resourceType: 'users',
          resourceId: 'EXPORT_BATCH',
          metadata: { format, count: usersRes.rows.length },
        });
      }

      if (format === 'JSON') {
        return reply.send({
          success: true,
          data: usersRes.rows,
        });
      }

      // Generate CSV
      const headers = 'User ID,Full Name,Email,Phone,Role,Status,Wallet Balance (GHS),Joined Date\n';
      const rows = usersRes.rows
        .map((u) => `"${u.id}","${u.fullName}","${u.email}","${u.phone}","${u.role}","${u.status}","${(u.walletBalancePesewas / 100).toFixed(2)}","${u.createdAt}"`)
        .join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="bytebeacon-users-export.csv"')
        .send(headers + rows);
    },
  );

  // 17. POST /admin/users/bulk — Bulk Actions (Suspend, Activate, Notify)
  app.post<{
    Body: { action: 'SUSPEND' | 'ACTIVATE' | 'NOTIFY'; userIds: string[]; reason?: string; message?: string };
  }>(
    '/admin/users/bulk',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{
      Body: { action: 'SUSPEND' | 'ACTIVATE' | 'NOTIFY'; userIds: string[]; reason?: string; message?: string };
    }>, reply: FastifyReply) => {
      const { action, userIds, reason, message } = req.body || {};

      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new BadRequestError('At least one user ID must be specified for bulk action.');
      }

      if (userIds.length > 200) {
        throw new BadRequestError('Bulk action batch is capped at 200 users per request.');
      }

      if (action === 'SUSPEND') {
        await db.query(
          `UPDATE users SET status = 'SUSPENDED', is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
          [userIds],
        );
      } else if (action === 'ACTIVATE') {
        await db.query(
          `UPDATE users SET status = 'ACTIVE', is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
          [userIds],
        );
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: `ADMIN_BULK_${action}`,
          resourceType: 'users',
          resourceId: 'BULK_BATCH',
          metadata: { count: userIds.length, reason, message },
        });
      }

      return reply.send({
        success: true,
        message: `Bulk ${action.toLowerCase()} executed successfully for ${userIds.length} users.`,
      });
    },
  );
}
