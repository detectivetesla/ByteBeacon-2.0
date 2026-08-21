import { UserRole, AdminSubRole } from '@bytebeacon/shared';

export type PermissionKey =
  // Customer Permissions
  | 'dashboard.view'
  | 'bundles.browse'
  | 'orders.create'
  | 'orders.view_own'
  | 'wallet.view_own'
  | 'transactions.view_own'
  | 'profile.manage'
  // Agent & Reseller Permissions
  | 'agent_store.manage'
  | 'agent_orders.manage'
  | 'agent_wallet.manage'
  | 'agent_customers.manage'
  | 'agent_api.manage'
  | 'analytics.view'
  // Admin Permissions
  | 'admin.dashboard.view'
  | 'admin.analytics.view'
  | 'admin.users.manage'
  | 'admin.agents.manage'
  | 'admin.orders.manage'
  | 'admin.bundles.manage'
  | 'admin.payments.manage'
  | 'admin.ledger.view'
  | 'admin.reconciliation.manage'
  | 'admin.provider.manage'
  | 'admin.dlq.manage'
  | 'admin.audit.view'
  | 'admin.communications.manage'
  | 'admin.settings.manage'
  | 'admin.super.governance';

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  [UserRole.CUSTOMER]: [
    'dashboard.view',
    'bundles.browse',
    'orders.create',
    'orders.view_own',
    'wallet.view_own',
    'transactions.view_own',
    'profile.manage',
  ],
  [UserRole.AGENT]: [
    'dashboard.view',
    'bundles.browse',
    'orders.create',
    'orders.view_own',
    'wallet.view_own',
    'transactions.view_own',
    'profile.manage',
    'agent_store.manage',
    'agent_orders.manage',
    'agent_wallet.manage',
    'agent_customers.manage',
    'agent_api.manage',
    'analytics.view',
  ],
  [UserRole.ADMIN]: [
    'dashboard.view',
    'bundles.browse',
    'orders.create',
    'orders.view_own',
    'wallet.view_own',
    'transactions.view_own',
    'profile.manage',
    'agent_store.manage',
    'agent_orders.manage',
    'agent_wallet.manage',
    'agent_customers.manage',
    'agent_api.manage',
    'analytics.view',
    'admin.dashboard.view',
    'admin.analytics.view',
    'admin.users.manage',
    'admin.agents.manage',
    'admin.orders.manage',
    'admin.bundles.manage',
    'admin.payments.manage',
    'admin.ledger.view',
    'admin.reconciliation.manage',
    'admin.provider.manage',
    'admin.dlq.manage',
    'admin.audit.view',
    'admin.communications.manage',
    'admin.settings.manage',
  ],
  [UserRole.SUPER_ADMIN]: [
    'dashboard.view',
    'bundles.browse',
    'orders.create',
    'orders.view_own',
    'wallet.view_own',
    'transactions.view_own',
    'profile.manage',
    'agent_store.manage',
    'agent_orders.manage',
    'agent_wallet.manage',
    'agent_customers.manage',
    'agent_api.manage',
    'analytics.view',
    'admin.dashboard.view',
    'admin.analytics.view',
    'admin.users.manage',
    'admin.agents.manage',
    'admin.orders.manage',
    'admin.bundles.manage',
    'admin.payments.manage',
    'admin.ledger.view',
    'admin.reconciliation.manage',
    'admin.provider.manage',
    'admin.dlq.manage',
    'admin.audit.view',
    'admin.communications.manage',
    'admin.settings.manage',
    'admin.super.governance',
  ],
  // Sub-Roles
  [AdminSubRole.SUPER_ADMIN]: [
    'admin.dashboard.view',
    'admin.users.manage',
    'admin.orders.manage',
    'admin.payments.manage',
    'admin.ledger.view',
    'admin.reconciliation.manage',
    'admin.provider.manage',
    'admin.dlq.manage',
    'admin.audit.view',
    'admin.settings.manage',
  ],
  [AdminSubRole.OPERATIONS_ADMIN]: [
    'admin.dashboard.view',
    'admin.orders.manage',
    'admin.reconciliation.manage',
    'admin.provider.manage',
    'admin.dlq.manage',
    'admin.audit.view',
  ],
  [AdminSubRole.FINANCE_ADMIN]: [
    'admin.dashboard.view',
    'admin.payments.manage',
    'admin.ledger.view',
    'admin.orders.manage',
    'admin.audit.view',
  ],
  [AdminSubRole.SUPPORT_ADMIN]: [
    'admin.dashboard.view',
    'admin.users.manage',
    'admin.orders.manage',
    'admin.payments.manage',
  ],
  [AdminSubRole.DEVELOPER_ADMIN]: [
    'admin.dashboard.view',
    'admin.provider.manage',
    'admin.settings.manage',
    'admin.audit.view',
  ],
  [AdminSubRole.READ_ONLY_ANALYST]: [
    'admin.dashboard.view',
    'admin.ledger.view',
    'admin.audit.view',
  ],
};

export function getPermissionsForRole(role: string | null | undefined): PermissionKey[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: string | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: string | null | undefined, permissions: PermissionKey[]): boolean {
  if (!role) return false;
  const userPerms = ROLE_PERMISSIONS[role] || [];
  return permissions.some((p) => userPerms.includes(p));
}

export function hasAllPermissions(role: string | null | undefined, permissions: PermissionKey[]): boolean {
  if (!role) return false;
  const userPerms = ROLE_PERMISSIONS[role] || [];
  return permissions.every((p) => userPerms.includes(p));
}

export function filterNavigationByRole<T extends { permission: PermissionKey }>(
  items: T[],
  role: string | null | undefined,
): T[] {
  if (!role) return [];
  const permissions = ROLE_PERMISSIONS[role] || [];
  return items.filter((item) => permissions.includes(item.permission));
}
