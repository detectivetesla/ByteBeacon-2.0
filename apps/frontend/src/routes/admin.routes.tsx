import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { AdminLayout } from '../layouts/AdminLayout.js';
import { AdminDashboard } from '../pages/admin/AdminDashboard.js';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage.js';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage.js';
import { AdminUserDetailPage } from '../pages/admin/AdminUserDetailPage.js';
import { AdminAgentsPage } from '../pages/admin/AdminAgentsPage.js';
import { AdminCommunicationsPage } from '../pages/admin/AdminCommunicationsPage.js';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage.js';
import { AdminPaymentsPage } from '../pages/admin/AdminPaymentsPage.js';
import { AdminLedgerPage } from '../pages/admin/AdminLedgerPage.js';
import { AdminReconciliationPage } from '../pages/admin/AdminReconciliationPage.js';
import { AdminProviderPage } from '../pages/admin/AdminProviderPage.js';
import { AdminDlqPage } from '../pages/admin/AdminDlqPage.js';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage.js';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage.js';
import { AdminApiManagementPage } from '../pages/admin/AdminApiManagementPage.js';
import { AdminStoresPage } from '../pages/admin/AdminStoresPage.js';
import { AdminDataPlansPage } from '../pages/admin/AdminDataPlansPage.js';
import { AdminPendingApprovalsPage } from '../pages/admin/AdminPendingApprovalsPage.js';
import { AdminNotificationsPage } from '../pages/admin/AdminNotificationsPage.js';

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
        element: <Navigate to="/admin/overview" replace />,
      },
      {
        path: 'overview',
        element: <AdminDashboard />,
      },
      {
        path: 'dashboard',
        element: <Navigate to="/admin/overview" replace />,
      },
      {
        path: 'analytics',
        element: <AdminAnalyticsPage />,
      },
      {
        path: 'stores',
        element: <AdminStoresPage />,
      },
      {
        path: 'bundles',
        element: <AdminDataPlansPage />,
      },
      {
        path: 'users',
        element: <AdminUsersPage />,
      },
      {
        path: 'users/:id',
        element: <AdminUserDetailPage />,
      },
      {
        path: 'agents',
        element: <AdminAgentsPage />,
      },
      {
        path: 'communications',
        element: <AdminCommunicationsPage />,
      },
      {
        path: 'notifications',
        element: <AdminNotificationsPage />,
      },
      {
        path: 'alerts',
        element: <AdminNotificationsPage />,
      },
      {
        path: 'campaigns',
        element: <AdminCommunicationsPage />,
      },
      {
        path: 'messages',
        element: <AdminCommunicationsPage />,
      },
      {
        path: 'orders',
        element: <AdminOrdersPage />,
      },
      {
        path: 'pending-approvals',
        element: <AdminPendingApprovalsPage />,
      },
      {
        path: 'pending-orders',
        element: <Navigate to="/admin/pending-approvals" replace />,
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
        path: 'security',
        element: <AdminAuditPage />,
      },
      {
        path: 'audit-stream',
        element: <AdminAuditPage />,
      },
      {
        path: 'incidents',
        element: <AdminAuditPage />,
      },
      {
        path: 'settings',
        element: <AdminSettingsPage />,
      },
      {
        path: 'api-management',
        element: <AdminApiManagementPage />,
      },
      {
        path: 'api-settings',
        element: <Navigate to="/admin/api-management" replace />,
      },
      {
        path: 'api-keys',
        element: <Navigate to="/admin/api-management" replace />,
      },
    ],
  },
];
