import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import {
  UserRole,
  AdminSubRole,
  Permission,
  AdminUserEffectiveAuthorizationDto,
} from '@bytebeacon/shared';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';

interface AdminPermissionsRouteOptions {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
}

export async function adminPermissionsRoutes(
  app: FastifyInstance,
  opts: AdminPermissionsRouteOptions,
): Promise<void> {
  const { db, apiKeyService, tokenService, rbacService, auditService } = opts;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET /admin/permissions/registry — Authoritative Permission Registry & Role Matrix
  app.get(
    '/admin/permissions/registry',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const actorRole = req.user!.role as UserRole;
      const actorSubRole = (req.user as any)?.adminSubRole as AdminSubRole | undefined;

      const hasRead = (await rbacService.hasPermission(actorRole, Permission.AUDIT_READ, actorSubRole)) ||
                      (await rbacService.hasPermission(actorRole, Permission.SETTINGS_MANAGE, actorSubRole)) ||
                      (await rbacService.hasPermission(actorRole, Permission.USERS_READ, actorSubRole));

      if (!hasRead) {
        await rbacService.logAuthorizationDenial(
          auditService,
          req.id,
          { id: req.user!.sub, role: actorRole, email: req.user!.email },
          'READ_PERMISSION_REGISTRY',
          'permissions',
          'Missing AUDIT_READ or SETTINGS_MANAGE permission',
          req.ip,
        );
        throw new ForbiddenError('You do not have permission to view the permission registry.');
      }

      const matrix = rbacService.getRolePermissionMatrix();

      return reply.send({
        success: true,
        data: matrix,
      });
    },
  );

  // 2. GET /admin/permissions/matrix — Role Comparison Matrix
  app.get(
    '/admin/permissions/matrix',
    { preHandler: [authHooks.authenticateAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const matrix = rbacService.getRolePermissionMatrix();
      return reply.send({
        success: true,
        data: matrix,
      });
    },
  );

  // 3. GET /admin/permissions/users/:userId/effective — Evaluate Live Effective Permissions for User
  app.get<{ Params: { userId: string } }>(
    '/admin/permissions/users/:userId/effective',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = req.params;
      const actorRole = req.user!.role as UserRole;
      const actorSubRole = (req.user as any)?.adminSubRole as AdminSubRole | undefined;

      const hasRead = await rbacService.hasPermission(actorRole, Permission.USERS_READ, actorSubRole);
      if (!hasRead) {
        await rbacService.logAuthorizationDenial(
          auditService,
          req.id,
          { id: req.user!.sub, role: actorRole, email: req.user!.email },
          'EVALUATE_USER_PERMISSIONS',
          'users',
          'Missing USERS_READ permission',
          req.ip,
        );
        throw new ForbiddenError('You do not have permission to inspect user authorization profiles.');
      }

      // Fetch user profile from database
      const userRes = await db.query<any>(
        `SELECT id, email, full_name as "fullName", name, role, admin_sub_role as "adminSubRole", status, is_active, mfa_enabled, security_domain
         FROM users
         WHERE id = $1`,
        [userId],
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError(`User '${userId}' not found.`);
      }

      const targetUser = userRes.rows[0];
      const targetRole = targetUser.role as UserRole;
      const targetSubRole = targetUser.adminSubRole as AdminSubRole | undefined;

      const effectivePermissions = await rbacService.getEffectivePermissions(targetRole, targetSubRole);
      const isLastSuperAdmin = (targetRole === UserRole.SUPER_ADMIN || (targetRole as string) === 'superadmin')
        ? await rbacService.isLastActiveSuperAdmin(userId)
        : false;

      let tenantScope: {
        scopeType: 'GLOBAL' | 'AGENT_STORE' | 'CUSTOMER_SELF';
        description: string;
        resourceOwnerId?: string;
      } = {
        scopeType: 'CUSTOMER_SELF',
        description: 'Bound strictly to personal account resources, orders, and wallet ledger.',
        resourceOwnerId: userId,
      };

      if (targetRole === UserRole.SUPER_ADMIN) {
        tenantScope = {
          scopeType: 'GLOBAL',
          description: 'Full unconstrained platform-wide governance and administrative scope.',
        };
      } else if (targetRole === UserRole.ADMIN) {
        tenantScope = {
          scopeType: 'GLOBAL',
          description: 'Operational administration scoped by assigned role permissions.',
        };
      } else if (targetRole === UserRole.AGENT) {
        tenantScope = {
          scopeType: 'AGENT_STORE',
          description: 'Scoped to owned storefront, agent orders, custom product catalog, and managed API keys.',
          resourceOwnerId: userId,
        };
      }

      const canManage = rbacService.canManageTargetUser(actorRole, targetRole);

      const responseData: AdminUserEffectiveAuthorizationDto = {
        userId: targetUser.id,
        userName: targetUser.fullName || targetUser.name || 'User',
        userEmail: targetUser.email,
        role: targetRole,
        adminSubRole: targetSubRole,
        status: targetUser.status || (targetUser.is_active ? 'ACTIVE' : 'SUSPENDED'),
        effectivePermissions,
        tenantScope,
        mfaEnforced: Boolean(targetUser.mfa_enabled),
        isLastSuperAdmin,
        canManageTargetUser: canManage,
      };

      return reply.send({
        success: true,
        data: responseData,
      });
    },
  );
}
