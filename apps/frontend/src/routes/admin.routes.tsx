import { RouteObject, Navigate } from 'react-router-dom';
import { AdminRouteGuard } from '../auth/guards/AdminRouteGuard.js';
import { AdminLayout } from '../layouts/AdminLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';

const AdminDashboard = withLazy(() => import('../pages/admin/AdminDashboard.js'), 'AdminDashboard');
const AdminAnalyticsPage = withLazy(() => import('../pages/admin/AdminAnalyticsPage.js'), 'AdminAnalyticsPage');
const AdminUsersPage = withLazy(() => import('../pages/admin/AdminUsersPage.js'), 'AdminUsersPage');
const AdminUserDetailPage = withLazy(() => import('../pages/admin/AdminUserDetailPage.js'), 'AdminUserDetailPage');
const AdminAgentsPage = withLazy(() => import('../pages/admin/AdminAgentsPage.js'), 'AdminAgentsPage');
const AdminCommunicationsPage = withLazy(() => import('../pages/admin/AdminCommunicationsPage.js'), 'AdminCommunicationsPage');
const AdminOrdersPage = withLazy(() => import('../pages/admin/AdminOrdersPage.js'), 'AdminOrdersPage');
const AdminPaymentsPage = withLazy(() => import('../pages/admin/AdminPaymentsPage.js'), 'AdminPaymentsPage');
const AdminLedgerPage = withLazy(() => import('../pages/admin/AdminLedgerPage.js'), 'AdminLedgerPage');
const AdminReconciliationPage = withLazy(() => import('../pages/admin/AdminReconciliationPage.js'), 'AdminReconciliationPage');
const AdminProviderPage = withLazy(() => import('../pages/admin/AdminProviderPage.js'), 'AdminProviderPage');
const AdminDlqPage = withLazy(() => import('../pages/admin/AdminDlqPage.js'), 'AdminDlqPage');
const AdminAuditPage = withLazy(() => import('../pages/admin/AdminAuditPage.js'), 'AdminAuditPage');
const AdminSettingsPage = withLazy(() => import('../pages/admin/AdminSettingsPage.js'), 'AdminSettingsPage');
const AdminApiManagementPage = withLazy(() => import('../pages/admin/AdminApiManagementPage.js'), 'AdminApiManagementPage');
const AdminStoresPage = withLazy(() => import('../pages/admin/AdminStoresPage.js'), 'AdminStoresPage');
const AdminDataPlansPage = withLazy(() => import('../pages/admin/AdminDataPlansPage.js'), 'AdminDataPlansPage');
const AdminPendingApprovalsPage = withLazy(() => import('../pages/admin/AdminPendingApprovalsPage.js'), 'AdminPendingApprovalsPage');
const AdminNotificationsPage = withLazy(() => import('../pages/admin/AdminNotificationsPage.js'), 'AdminNotificationsPage');

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <AdminRouteGuard>
        <AdminLayout />
      </AdminRouteGuard>
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
        path: 'activity',
        element: <AdminAuditPage />,
      },
      {
        path: 'activity-and-audit',
        element: <Navigate to="/admin/activity" replace />,
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
