import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions.js';
import { PermissionKey } from '../permissions.js';

export interface PermissionGuardProps {
  requiredPermission?: PermissionKey;
  requiredPermissions?: PermissionKey[];
  mode?: 'any' | 'all';
  fallbackPath?: string;
  fallbackComponent?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredPermission,
  requiredPermissions,
  mode = 'all',
  fallbackPath,
  fallbackComponent,
  children,
}) => {
  const { can, canAny, canAll } = usePermissions();

  let isPermitted = true;

  if (requiredPermission) {
    isPermitted = can(requiredPermission);
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    isPermitted = mode === 'any' ? canAny(requiredPermissions) : canAll(requiredPermissions);
  }

  if (!isPermitted) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
