import { useAuth } from '../../context/AuthContext.js';
import {
  PermissionKey,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../permissions.js';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  const permissions = getPermissionsForRole(role);

  return {
    permissions,
    can: (permission: PermissionKey) => hasPermission(role, permission),
    canAny: (perms: PermissionKey[]) => hasAnyPermission(role, perms),
    canAll: (perms: PermissionKey[]) => hasAllPermissions(role, perms),
    isCustomer: role === 'customer',
    isAgent: role === 'agent',
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
  };
}
