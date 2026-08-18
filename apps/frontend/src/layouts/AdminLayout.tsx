import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { AppShell } from './AppShell.js';
import { ADMIN_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { ShieldCheck } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AppShell
      portalTitle="ByteBeacon"
      portalSubtitle="Control Center"
      portalLogoIcon={<ShieldCheck size={18} strokeWidth={2.6} />}
      portalRoleBadge={isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN OPERATOR'}
      portalRoleColor={isSuperAdmin ? 'var(--color-warning)' : 'var(--color-api)'}
      navigationGroups={ADMIN_NAVIGATION_GROUPS}
      userRole={isSuperAdmin ? 'super_admin' : 'admin'}
    >
      <Outlet />
    </AppShell>
  );
};
