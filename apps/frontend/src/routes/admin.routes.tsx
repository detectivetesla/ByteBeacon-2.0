import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { AdminLayout } from '../layouts/AdminLayout.js';
import { AdminDashboard } from '../pages/admin/AdminDashboard.js';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage.js';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage.js';
import { AdminPaymentsPage } from '../pages/admin/AdminPaymentsPage.js';
import { AdminLedgerPage } from '../pages/admin/AdminLedgerPage.js';
import { AdminReconciliationPage } from '../pages/admin/AdminReconciliationPage.js';
import { AdminProviderPage } from '../pages/admin/AdminProviderPage.js';
import { AdminDlqPage } from '../pages/admin/AdminDlqPage.js';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage.js';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage.js';
import { AdminStoresPage } from '../pages/admin/AdminStoresPage.js';
import { AgentPendingOrdersPage } from '../pages/agent/AgentPendingOrdersPage.js';
import { NotificationsPage } from '../pages/shared/NotificationsPage.js';
import { DataBundlesPage } from '../pages/shared/DataBundlesPage.js';

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={['admin', 'super_admin']} fallbackPath="/unauthorized">
          <AdminLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AdminDashboard />,
      },
      {
        path: 'stores',
        element: <AdminStoresPage />,
      },
      {
        path: 'bundles',
        element: <DataBundlesPage />,
      },
      {
        path: 'users',
        element: <AdminUsersPage />,
      },
      {
        path: 'orders',
        element: <AdminOrdersPage />,
      },
      {
        path: 'pending-orders',
        element: <AgentPendingOrdersPage />,
      },
      {
        path: 'payments',
        element: <AdminPaymentsPage />,
      },
      {
        path: 'ledger',
        element: <AdminLedgerPage />,
      },
      {
        path: 'reconciliation',
        element: <AdminReconciliationPage />,
      },
      {
        path: 'provider',
        element: <AdminProviderPage />,
      },
      {
        path: 'dlq',
        element: <AdminDlqPage />,
      },
      {
        path: 'audit',
        element: <AdminAuditPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'settings',
        element: <AdminSettingsPage />,
      },
    ],
  },
];
