import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { SessionService } from '../../core/security/session.service.js';
import { FinancialLedgerService } from '../../core/payments/financial-ledger.service.js';
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

  // 1. GET /admin/users — Paginated User Directory with Search & Filtering
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      role?: string;
      status?: string;
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
        search?: string;
      };
    }>, reply: FastifyReply) => {
      const { page = '1', limit = '20', role, status, search } = req.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

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

      if (status && status !== 'ALL') {
        if (status === 'ACTIVE') {
          whereConditions.push(`(status = 'ACTIVE' OR (status IS NULL AND is_active = true))`);
        } else if (status === 'SUSPENDED') {
          whereConditions.push(`(status = 'SUSPENDED' OR is_active = false)`);
        }
      }

      if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        whereConditions.push(
          `(LOWER(email) LIKE $${paramIndex} OR phone LIKE $${paramIndex} OR LOWER(COALESCE(full_name, name, '')) LIKE $${paramIndex})`,
        );
        queryParams.push(searchTerm);
        paramIndex++;
      }

      const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM users ${whereSql}`;
      const countRes = await db.query(countSql, queryParams);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const listSql = `
        SELECT uuid as id, email, phone,
               COALESCE(full_name, name, '') as "fullName",
               role,
               COALESCE(status, CASE WHEN is_active = false THEN 'SUSPENDED' ELSE 'ACTIVE' END) as status,
               security_domain as "securityDomain",
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
          walletBalancePesewas: parseInt(u.walletBalancePesewas || '0', 10) || 0,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        };
      });

      return reply.send({
        success: true,
        data: {
          users: formattedUsers,
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

  // 2. GET /admin/users/:id — Comprehensive User Dossier
  app.get<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userRes = await db.query(
        `SELECT uuid as id, email, phone,
                COALESCE(full_name, name, '') as "fullName",
                role,
                COALESCE(status, CASE WHEN is_active = false THEN 'SUSPENDED' ELSE 'ACTIVE' END) as status,
                security_domain as "securityDomain",
                phone_verified as "phoneVerified",
                mfa_enabled as "mfaEnabled",
                COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "walletBalancePesewas",
                created_at as "createdAt",
                updated_at as "updatedAt",
                last_login_at as "lastLoginAt"
         FROM users WHERE uuid = $1`,
        [req.params.id],
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError(`User with ID [${req.params.id}] not found`);
      }

      const u = userRes.rows[0];

      // Fetch recent orders for user
      const ordersRes = await db.query(
        `SELECT id, recipient_phone as "recipientPhone", network, data_amount_mb as "dataAmountMb",
                amount_pesewas as "amountPesewas", order_status as "orderStatus", created_at as "createdAt"
         FROM orders WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch recent ledger lines for user
      const ledgerRes = await db.query(
        `SELECT id, entry_type as "entryType", amount_pesewas as "amountPesewas",
                reference_type as "referenceType", reference_id as "referenceId",
                description, created_at as "createdAt"
         FROM financial_ledger WHERE account_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      // Fetch active device sessions
      const sessionsRes = await db.query(
        `SELECT id, user_agent as "userAgent", ip_address as "ipAddress",
                device_id as "deviceId", is_revoked as "isRevoked",
                last_active_at as "lastActiveAt", created_at as "createdAt"
         FROM sessions WHERE user_id = $1 AND is_revoked = false
         ORDER BY last_active_at DESC LIMIT 10`,
        [req.params.id],
      ).catch(() => ({ rows: [] }));

      const rawRole = (u.role || 'customer').toString().toLowerCase().trim();
      let normalizedRole = 'customer';
      if (rawRole === 'admin') normalizedRole = 'admin';
      else if (rawRole === 'super_admin' || rawRole === 'superadmin') normalizedRole = 'super_admin';
      else if (rawRole === 'agent' || rawRole === 'superagent') normalizedRole = 'agent';

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
            phoneVerified: u.phoneVerified || false,
            mfaEnabled: u.mfaEnabled || false,
            walletBalancePesewas: parseInt(u.walletBalancePesewas || '0', 10) || 0,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastLoginAt: u.lastLoginAt,
          },
          recentOrders: ordersRes.rows,
          recentLedgerLines: ledgerRes.rows,
          activeSessions: sessionsRes.rows,
        },
      });
    },
  );

  // 3. POST /admin/users/:id/suspend — Suspend User Account
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/admin/users/:id/suspend',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) => {
      const targetRes = await db.query('SELECT role, email FROM users WHERE uuid = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const targetRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;

      if (!rbacService.canManageTargetUser(actorRole, targetRole)) {
        throw new ForbiddenError('You do not have permission to suspend this administrator account.');
      }

      await db.query(
        `UPDATE users SET status = 'SUSPENDED', is_active = false, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1`,
        [req.params.id],
      );

      if (sessionService) {
        await sessionService.revokeAllUserSessions(req.params.id);
      }

      if (auditService) {
        await auditService.log({
          correlationId: req.id,
          actorId: req.user!.sub,
          actorType: 'ADMIN',
          action: 'ADMIN_SUSPEND_USER',
          resourceType: 'users',
          resourceId: req.params.id,
          metadata: { reason: req.body?.reason || 'Administrative suspension', targetEmail: targetRes.rows[0].email },
        });
      }

      return reply.send({
        success: true,
        message: 'User account successfully suspended and active sessions terminated.',
      });
    },
  );

  // 4. POST /admin/users/:id/reactivate — Reactivate User Account
  app.post<{ Params: { id: string } }>(
    '/admin/users/:id/reactivate',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const targetRes = await db.query('SELECT role, email FROM users WHERE uuid = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const targetRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;

      if (!rbacService.canManageTargetUser(actorRole, targetRole)) {
        throw new ForbiddenError('You do not have permission to reactivate this administrator account.');
      }

      await db.query(
        `UPDATE users SET status = 'ACTIVE', is_active = true, updated_at = CURRENT_TIMESTAMP WHERE uuid = $1`,
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

  // 5. POST /admin/users/:id/role — Change User Role (Hierarchy Enforced)
  app.post<{ Params: { id: string }; Body: { role: string; reason?: string } }>(
    '/admin/users/:id/role',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { id: string }; Body: { role: string; reason?: string } }>, reply: FastifyReply) => {
      const { role: newRole, reason } = req.body || {};
      if (!newRole) {
        throw new BadRequestError('Role is required');
      }

      const targetRes = await db.query('SELECT role, email FROM users WHERE uuid = $1', [req.params.id]);
      if (targetRes.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const currentRole = targetRes.rows[0].role as UserRole;
      const actorRole = req.user!.role as UserRole;
      const proposedRole = newRole.toLowerCase() as UserRole;

      if (!rbacService.canManageTargetUser(actorRole, currentRole, proposedRole)) {
        throw new ForbiddenError('Only Super Administrators can grant or modify Administrator privileges.');
      }

      let newDomain = SecurityDomain.CUSTOMER;
      if (proposedRole === UserRole.AGENT) newDomain = SecurityDomain.AGENT;
      else if (proposedRole === UserRole.ADMIN || proposedRole === UserRole.SUPER_ADMIN) newDomain = SecurityDomain.ADMIN;

      await db.query(
        `UPDATE users SET role = $1, security_domain = $2, updated_at = CURRENT_TIMESTAMP WHERE uuid = $3`,
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

  // 6. POST /admin/users/:id/adjust-wallet — Double-Entry Financial Adjustment
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
        `SELECT uuid as id, email, role,
                COALESCE(wallet_balance_pesewas, ROUND(COALESCE(wallet_balance, 0) * 100)) as "currentBalance"
         FROM users WHERE uuid = $1 FOR UPDATE`,
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
            // Debit PLATFORM_ESCROW, Credit CUSTOMER_WALLET
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
            // Debit CUSTOMER_WALLET, Credit PLATFORM_ESCROW
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
          `UPDATE users SET wallet_balance_pesewas = $1, wallet_balance = $2, updated_at = CURRENT_TIMESTAMP WHERE uuid = $3`,
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

  // 7. POST /admin/users/:id/revoke-sessions — Force Logout Across Devices
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
}
