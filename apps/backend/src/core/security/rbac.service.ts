import type pg from 'pg';
import { Permission, UserRole } from '@bytebeacon/shared';

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  [UserRole.SUPER_ADMIN]: new Set(Object.values(Permission)),
  [UserRole.ADMIN]: new Set([
    Permission.ORDERS_READ,
    Permission.ORDERS_RETRY,
    Permission.ORDERS_REFUND,
    Permission.PENDING_MTN_MANAGE,
    Permission.ORDERS_RECONCILE,
    Permission.USERS_READ,
    Permission.USERS_MANAGE,
    Permission.AGENTS_READ,
    Permission.AGENTS_SUSPEND,
    Permission.WALLET_READ,
    Permission.WALLET_ADJUST,
    Permission.PAYMENTS_MANAGE,
    Permission.LEDGER_READ,
    Permission.PRICING_MANAGE,
    Permission.CATALOG_PRICING_MANAGE,
    Permission.PROVIDERS_MANAGE,
    Permission.AUDIT_READ,
    Permission.REPORTS_VIEW,
    Permission.API_KEYS_MANAGE,
    Permission.WEBHOOKS_MANAGE,
    Permission.SANDBOX_MANAGE,
    Permission.COMMUNICATION_BROADCAST,
    Permission.COMMUNICATION_TEMPLATES_MANAGE,
  ]),
  [UserRole.AGENT]: new Set([
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.WALLET_READ,
    Permission.AGENTS_READ,
    Permission.API_KEYS_MANAGE,
    Permission.WEBHOOKS_MANAGE,
    Permission.SANDBOX_MANAGE,
  ]),
  [UserRole.CUSTOMER]: new Set([
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.WALLET_READ,
  ]),
};

export class RbacService {
  private readonly db: pg.Pool;
  private readonly rolePermissionsCache = new Map<UserRole, Set<Permission>>();

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async hasPermission(role: UserRole, permission: Permission): Promise<boolean> {
    const permissions = await this.getRolePermissions(role);
    return permissions.has(permission);
  }

  public async getRolePermissions(role: UserRole): Promise<Set<Permission>> {
    if (this.rolePermissionsCache.has(role)) {
      return this.rolePermissionsCache.get(role)!;
    }

    try {
      const query = `
        SELECT permission_id as "permissionId"
        FROM role_permissions
        WHERE role = $1
      `;

      const result = await this.db.query<{ permissionId: Permission }>(query, [role]);
      if (result.rows && result.rows.length > 0) {
        const permissionSet = new Set<Permission>(result.rows.map((r) => r.permissionId));
        this.rolePermissionsCache.set(role, permissionSet);
        return permissionSet;
      }
    } catch {
      // Fallback to static in-memory permissions matrix
    }

    const fallbackSet = DEFAULT_ROLE_PERMISSIONS[role] || new Set<Permission>();
    this.rolePermissionsCache.set(role, fallbackSet);
    return fallbackSet;
  }

  /**
   * Enforces privilege hierarchy rules:
   * 1. SUPER_ADMIN can manage any target user/role.
   * 2. ADMIN can manage CUSTOMER and AGENT users.
   * 3. ADMIN cannot modify, suspend, or change roles of ADMIN or SUPER_ADMIN users.
   * 4. ADMIN cannot promote anyone to ADMIN or SUPER_ADMIN.
   */
  public canManageTargetUser(actorRole: UserRole, targetUserRole: UserRole, proposedRole?: UserRole): boolean {
    if (actorRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (actorRole === UserRole.ADMIN) {
      if (targetUserRole === UserRole.ADMIN || targetUserRole === UserRole.SUPER_ADMIN) {
        return false;
      }
      if (proposedRole && (proposedRole === UserRole.ADMIN || proposedRole === UserRole.SUPER_ADMIN)) {
        return false;
      }
      return true;
    }

    return false;
  }

  public clearCache(): void {
    this.rolePermissionsCache.clear();
  }
}
