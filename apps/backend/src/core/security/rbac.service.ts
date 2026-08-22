import type pg from 'pg';
import {
  Permission,
  UserRole,
  AdminSubRole,
  ADMIN_ROLE_PERMISSIONS,
  PermissionCategory,
  ConfigRiskLevel,
  PermissionMatrixEntryDto,
  AdminRolePermissionMatrixDto,
  AuditCategory,
  AuditSeverity,
  AuditResult,
} from '@bytebeacon/shared';
import type { AuditService } from './audit.service.js';

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

export const PERMISSION_METADATA: Record<
  Permission,
  {
    category: PermissionCategory;
    name: string;
    description: string;
    riskLevel: ConfigRiskLevel;
    requiresStepUp: boolean;
  }
> = {
  // Orders & Telecom Operations
  [Permission.ORDERS_READ]: {
    category: PermissionCategory.ORDERS,
    name: 'Read Orders',
    description: 'View order status, recipient phone numbers, data bundles, and fulfillment tracking.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.ORDERS_CREATE]: {
    category: PermissionCategory.ORDERS,
    name: 'Create Orders',
    description: 'Initiate single or bulk data bundle purchases and fulfillment submissions.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.ORDERS_REFUND]: {
    category: PermissionCategory.ORDERS,
    name: 'Refund Orders',
    description: 'Execute financial refunds for failed or unfulfilled telecom orders to user wallets.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.ORDERS_RECONCILE]: {
    category: PermissionCategory.ORDERS,
    name: 'Reconcile Orders',
    description: 'Force manual reconciliation with carrier gateways and resolve order status mismatches.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.ORDERS_RETRY]: {
    category: PermissionCategory.ORDERS,
    name: 'Retry Orders',
    description: 'Replay failed carrier fulfillment attempts through authoritative telecom queues.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.PENDING_MTN_MANAGE]: {
    category: PermissionCategory.ORDERS,
    name: 'Manage MTN Approvals',
    description: 'Review, approve, or reject pre-approval required high-volume MTN data orders.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },

  // Wallet & Finance
  [Permission.WALLET_READ]: {
    category: PermissionCategory.WALLET_FINANCE,
    name: 'Read Wallet Balances',
    description: 'View wallet balances, float reserves, and historical ledger transaction lines.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.WALLET_ADJUST]: {
    category: PermissionCategory.WALLET_FINANCE,
    name: 'Adjust Wallets',
    description: 'Post manual credit/debit double-entry financial ledger adjustments to user balances.',
    riskLevel: ConfigRiskLevel.CRITICAL,
    requiresStepUp: true,
  },
  [Permission.PAYMENTS_MANAGE]: {
    category: PermissionCategory.WALLET_FINANCE,
    name: 'Manage Payments',
    description: 'Initiate, verify, and reconcile Paystack payment intents and financial collections.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: false,
  },
  [Permission.LEDGER_READ]: {
    category: PermissionCategory.WALLET_FINANCE,
    name: 'Read Financial Ledger',
    description: 'Inspect authoritative double-entry journal entries, trial balance, and audit integrity.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.PRICING_MANAGE]: {
    category: PermissionCategory.WALLET_FINANCE,
    name: 'Manage Agent Pricing',
    description: 'Configure agent wholesale pricing tiers, discount bands, and custom margin structures.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },

  // User & Agent Management
  [Permission.USERS_READ]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Read Users',
    description: 'Browse customer, agent, and administrator profiles, session counts, and verification status.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.USERS_MANAGE]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Manage Users',
    description: 'Update user profiles, phone numbers, email verification, and account lifecycle status.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.USERS_CREATE]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Create Users / Admins',
    description: 'Provision new operational administrators, support accounts, or agent profiles.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.USERS_ROLE_PROMOTE]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Promote User Roles',
    description: 'Elevate customer accounts to agent, or promote administrators to privileged roles.',
    riskLevel: ConfigRiskLevel.CRITICAL,
    requiresStepUp: true,
  },
  [Permission.USERS_SECURITY_MANAGE]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Manage User Security',
    description: 'Force password resets, revoke active authentication sessions, and reset 2FA devices.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.AGENTS_READ]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Read Agents & Stores',
    description: 'View agent store domains, commission earnings, product catalog overrides, and sub-agents.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
  [Permission.AGENTS_SUSPEND]: {
    category: PermissionCategory.USERS_AGENTS,
    name: 'Suspend Agents / Stores',
    description: 'Freeze agent store operations, disable public storefronts, and suspend API key traffic.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },

  // Catalog & Telecom Providers
  [Permission.CATALOG_PRICING_MANAGE]: {
    category: PermissionCategory.CATALOG_TELECOM,
    name: 'Manage Global Data Plans',
    description: 'Create, update, activate, and deactivate carrier data bundle plans and retail markups.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.PROVIDERS_MANAGE]: {
    category: PermissionCategory.CATALOG_TELECOM,
    name: 'Manage Telecom Providers',
    description: 'Switch authoritative upstream provider (DataHouse vs Secondary), circuit breakers, and endpoints.',
    riskLevel: ConfigRiskLevel.CRITICAL,
    requiresStepUp: true,
  },
  [Permission.PROVIDERS_CREDENTIALS_READ]: {
    category: PermissionCategory.CATALOG_TELECOM,
    name: 'Read Provider Credentials Status',
    description: 'Check carrier API vault configuration status and rotation schedules.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },

  // Developer & Infrastructure
  [Permission.API_KEYS_MANAGE]: {
    category: PermissionCategory.DEVELOPER_APIS,
    name: 'Manage API Keys',
    description: 'Issue, rotate, and revoke developer and agent REST API authentication keys.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.WEBHOOKS_MANAGE]: {
    category: PermissionCategory.DEVELOPER_APIS,
    name: 'Manage Webhooks',
    description: 'Configure carrier and partner webhook subscriptions, signing secrets, and retry rules.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.SANDBOX_MANAGE]: {
    category: PermissionCategory.DEVELOPER_APIS,
    name: 'Manage Sandbox Simulator',
    description: 'Simulate mock carrier transactions and simulate webhook event deliveries.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },

  // Communication
  [Permission.COMMUNICATION_BROADCAST]: {
    category: PermissionCategory.COMMUNICATION,
    name: 'Broadcast System Messages',
    description: 'Compose and dispatch mass push notifications, SMS announcements, and system alerts.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.COMMUNICATION_TEMPLATES_MANAGE]: {
    category: PermissionCategory.COMMUNICATION,
    name: 'Manage Communication Templates',
    description: 'Create, edit, and publish reusable transactional email, SMS, and notification templates.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },

  // Platform & Security Governance
  [Permission.AUDIT_READ]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'Read Security Audit Stream',
    description: 'Inspect cryptographic SHA-256 tamper-evident audit logs, IP tracking, and forensic events.',
    riskLevel: ConfigRiskLevel.MEDIUM,
    requiresStepUp: false,
  },
  [Permission.SETTINGS_MANAGE]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'Manage System Settings',
    description: 'Update platform operational configuration, rate limits, timeouts, and financial policies.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.FEATURE_FLAGS_MANAGE]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'Manage Feature Flags',
    description: 'Toggle runtime platform feature flags, beta rollouts, and environment switches.',
    riskLevel: ConfigRiskLevel.HIGH,
    requiresStepUp: true,
  },
  [Permission.MAINTENANCE_MANAGE]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'Manage Maintenance Mode',
    description: 'Engage platform-wide emergency maintenance mode and pause checkout operations.',
    riskLevel: ConfigRiskLevel.CRITICAL,
    requiresStepUp: true,
  },
  [Permission.SYSTEM_MAINTENANCE_TOGGLE]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'Toggle Maintenance',
    description: 'Immediate switch for emergency maintenance shutdown.',
    riskLevel: ConfigRiskLevel.CRITICAL,
    requiresStepUp: true,
  },
  [Permission.REPORTS_VIEW]: {
    category: PermissionCategory.PLATFORM_GOVERNANCE,
    name: 'View Analytics & Reports',
    description: 'Access high-level revenue summaries, carrier volume charts, and operational KPIs.',
    riskLevel: ConfigRiskLevel.LOW,
    requiresStepUp: false,
  },
};

export class RbacService {
  private readonly db: pg.Pool;
  private readonly rolePermissionsCache = new Map<string, Set<Permission>>();

  constructor(db: pg.Pool) {
    this.db = db;
  }

  /**
   * Authoritative permission evaluation for an actor.
   * Super Admin permissions are evaluated explicitly via ADMIN_ROLE_PERMISSIONS.
   */
  public async hasPermission(
    role: UserRole,
    permission: Permission,
    subRole?: AdminSubRole,
  ): Promise<boolean> {
    const permissions = await this.getEffectivePermissionsSet(role, subRole);
    return permissions.has(permission);
  }

  /**
   * Returns the set of permissions for a role and optional administrative sub-role.
   */
  public async getEffectivePermissionsSet(
    role: UserRole,
    subRole?: AdminSubRole,
  ): Promise<Set<Permission>> {
    const cacheKey = `${role}:${subRole || 'default'}`;
    if (this.rolePermissionsCache.has(cacheKey)) {
      return this.rolePermissionsCache.get(cacheKey)!;
    }

    // 1. If Admin with specific sub-role
    if (role === UserRole.ADMIN && subRole && ADMIN_ROLE_PERMISSIONS[subRole]) {
      const subRoleSet = new Set<Permission>(ADMIN_ROLE_PERMISSIONS[subRole]);
      this.rolePermissionsCache.set(cacheKey, subRoleSet);
      return subRoleSet;
    }

    // 2. If Super Admin
    if (role === UserRole.SUPER_ADMIN) {
      const superAdminSet = new Set<Permission>(Object.values(Permission));
      this.rolePermissionsCache.set(cacheKey, superAdminSet);
      return superAdminSet;
    }

    // 3. Database custom role permissions if configured
    try {
      const query = `
        SELECT permission_id as "permissionId"
        FROM role_permissions
        WHERE role = $1
      `;
      const result = await this.db.query<{ permissionId: Permission }>(query, [role]);
      if (result.rows && result.rows.length > 0) {
        const permissionSet = new Set<Permission>(result.rows.map((r) => r.permissionId));
        this.rolePermissionsCache.set(cacheKey, permissionSet);
        return permissionSet;
      }
    } catch {
      // Fallback to static in-memory permissions
    }

    const fallbackSet = DEFAULT_ROLE_PERMISSIONS[role] || new Set<Permission>();
    this.rolePermissionsCache.set(cacheKey, fallbackSet);
    return fallbackSet;
  }

  /**
   * Returns array of effective permissions for client serialization.
   */
  public async getEffectivePermissions(
    role: UserRole,
    subRole?: AdminSubRole,
  ): Promise<Permission[]> {
    const set = await this.getEffectivePermissionsSet(role, subRole);
    return Array.from(set);
  }

  /**
   * Anti-IDOR Resource-Level Authorization Enforcement:
   * Determines if the actor possesses the permission AND owns or has tenant authority over the resource.
   */
  public authorizeResource(
    actorId: string,
    actorRole: UserRole,
    resourceOwnerId: string,
    permission: Permission,
    subRole?: AdminSubRole,
  ): boolean {
    // Super Admin has platform-wide authority
    if (actorRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Admin has operational authority for orders, users, catalog, payments
    if (actorRole === UserRole.ADMIN) {
      const perms = subRole && ADMIN_ROLE_PERMISSIONS[subRole]
        ? ADMIN_ROLE_PERMISSIONS[subRole]
        : Array.from(DEFAULT_ROLE_PERMISSIONS[UserRole.ADMIN]);
      return perms.includes(permission);
    }

    // Agent can only access their own resources or their customer orders
    if (actorRole === UserRole.AGENT) {
      return actorId === resourceOwnerId;
    }

    // Customer can strictly access only their own resources
    if (actorRole === UserRole.CUSTOMER) {
      return actorId === resourceOwnerId;
    }

    return false;
  }

  /**
   * Last-Super-Admin Protection:
   * Prevents accidental removal, suspension, or demotion of the final active Super Admin.
   */
  public async isLastActiveSuperAdmin(targetUserId: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM users
        WHERE (role = 'super_admin' OR role = 'SUPER_ADMIN')
          AND (is_active = true OR status = 'ACTIVE')
          AND uuid != $1
      `;
      const result = await this.db.query<{ count: string }>(query, [targetUserId]);
      const otherSuperAdmins = parseInt(result.rows[0]?.count || '0', 10);
      return otherSuperAdmins === 0;
    } catch {
      return false;
    }
  }

  /**
   * Enforces privilege hierarchy rules:
   * 1. SUPER_ADMIN can manage any target user/role.
   * 2. ADMIN can manage CUSTOMER and AGENT users.
   * 3. ADMIN cannot modify, suspend, or change roles of ADMIN or SUPER_ADMIN users.
   * 4. ADMIN cannot promote anyone to ADMIN or SUPER_ADMIN.
   */
  public canManageTargetUser(
    actorRole: UserRole,
    targetUserRole: UserRole,
    proposedRole?: UserRole,
  ): boolean {
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

  /**
   * Detailed privilege hierarchy and anti-self-escalation evaluation.
   */
  public canManageTargetUserDetailed(
    actorRole: UserRole,
    actorId: string,
    targetUserId: string,
    targetUserRole: UserRole,
    proposedRole?: UserRole,
  ): { allowed: boolean; reason?: string } {
    // Self-escalation check
    if (actorId === targetUserId && proposedRole && proposedRole !== actorRole) {
      return { allowed: false, reason: 'Self-role escalation is strictly prohibited.' };
    }

    if (actorRole === UserRole.SUPER_ADMIN) {
      return { allowed: true };
    }

    if (actorRole === UserRole.ADMIN) {
      if (targetUserRole === UserRole.ADMIN || targetUserRole === UserRole.SUPER_ADMIN) {
        return {
          allowed: false,
          reason: 'Administrators cannot modify, suspend, or edit other Administrators or Super Administrators.',
        };
      }
      if (proposedRole && (proposedRole === UserRole.ADMIN || proposedRole === UserRole.SUPER_ADMIN)) {
        return {
          allowed: false,
          reason: 'Only Super Administrators can promote users to Administrator or Super Administrator.',
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'Insufficient role privileges.' };
  }

  /**
   * Generates the authoritative complete permission matrix with domain mappings.
   */
  public getRolePermissionMatrix(): AdminRolePermissionMatrixDto {
    const allPermissions = Object.values(Permission);
    const registry: PermissionMatrixEntryDto[] = allPermissions.map((perm) => {
      const meta = PERMISSION_METADATA[perm] || {
        category: PermissionCategory.PLATFORM_GOVERNANCE,
        name: perm,
        description: 'System operational permission',
        riskLevel: ConfigRiskLevel.MEDIUM,
        requiresStepUp: false,
      };

      return {
        permission: perm,
        category: meta.category,
        name: meta.name,
        description: meta.description,
        riskLevel: meta.riskLevel,
        requiresStepUp: meta.requiresStepUp,
        allowedRoles: {
          customer: DEFAULT_ROLE_PERMISSIONS[UserRole.CUSTOMER].has(perm),
          agent: DEFAULT_ROLE_PERMISSIONS[UserRole.AGENT].has(perm),
          operationsAdmin: ADMIN_ROLE_PERMISSIONS[AdminSubRole.OPERATIONS_ADMIN].includes(perm),
          financeAdmin: ADMIN_ROLE_PERMISSIONS[AdminSubRole.FINANCE_ADMIN].includes(perm),
          supportAdmin: ADMIN_ROLE_PERMISSIONS[AdminSubRole.SUPPORT_ADMIN].includes(perm),
          developerAdmin: ADMIN_ROLE_PERMISSIONS[AdminSubRole.DEVELOPER_ADMIN].includes(perm),
          superAdmin: true,
        },
      };
    });

    const roleBreakdown = [
      {
        role: UserRole.SUPER_ADMIN,
        displayName: 'Super Administrator',
        totalPermissions: allPermissions.length,
        effectivePermissions: allPermissions,
      },
      {
        role: UserRole.ADMIN,
        adminSubRole: AdminSubRole.OPERATIONS_ADMIN,
        displayName: 'Operations Administrator',
        totalPermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.OPERATIONS_ADMIN].length,
        effectivePermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.OPERATIONS_ADMIN],
      },
      {
        role: UserRole.ADMIN,
        adminSubRole: AdminSubRole.FINANCE_ADMIN,
        displayName: 'Finance Administrator',
        totalPermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.FINANCE_ADMIN].length,
        effectivePermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.FINANCE_ADMIN],
      },
      {
        role: UserRole.ADMIN,
        adminSubRole: AdminSubRole.SUPPORT_ADMIN,
        displayName: 'Support Administrator',
        totalPermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.SUPPORT_ADMIN].length,
        effectivePermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.SUPPORT_ADMIN],
      },
      {
        role: UserRole.ADMIN,
        adminSubRole: AdminSubRole.DEVELOPER_ADMIN,
        displayName: 'Developer / Infrastructure Admin',
        totalPermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.DEVELOPER_ADMIN].length,
        effectivePermissions: ADMIN_ROLE_PERMISSIONS[AdminSubRole.DEVELOPER_ADMIN],
      },
      {
        role: UserRole.AGENT,
        displayName: 'Agent / Reseller',
        totalPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.AGENT].size,
        effectivePermissions: Array.from(DEFAULT_ROLE_PERMISSIONS[UserRole.AGENT]),
      },
      {
        role: UserRole.CUSTOMER,
        displayName: 'Retail Customer',
        totalPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.CUSTOMER].size,
        effectivePermissions: Array.from(DEFAULT_ROLE_PERMISSIONS[UserRole.CUSTOMER]),
      },
    ];

    return {
      registry,
      roleBreakdown,
      totalPermissionsCount: allPermissions.length,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Cryptographic Audit Logging for Authorization Denials:
   * Dispatches AUTHORIZATION_DENIED event into the immutable audit stream.
   */
  public async logAuthorizationDenial(
    auditService: AuditService,
    correlationId: string,
    actor: { id: string; role: string; email?: string },
    action: string,
    resource: string,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const actorType = actor.role.toUpperCase().includes('ADMIN') ? 'ADMIN' : actor.role.toUpperCase().includes('AGENT') ? 'AGENT' : 'CUSTOMER';
      await auditService.logEvent({
        correlationId: correlationId || `denial_${Date.now()}`,
        actorId: actor.id,
        actorType: actorType as any,
        action: 'AUTHORIZATION_DENIED',
        resourceType: resource,
        resourceId: actor.id,
        severity: AuditSeverity.HIGH,
        category: AuditCategory.AUTHORIZATION,
        result: AuditResult.DENIED,
        ipAddress: ipAddress || '127.0.0.1',
        metadata: {
          attemptedAction: action,
          actorEmail: actor.email,
          rejectionReason: reason,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Audit log non-blocking fallback
    }
  }

  public clearCache(): void {
    this.rolePermissionsCache.clear();
  }
}
