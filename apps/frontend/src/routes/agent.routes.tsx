import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { AgentLayout } from '../layouts/AgentLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';

const AgentDashboard = withLazy(() => import('../pages/dashboard/AgentDashboard.js'), 'AgentDashboard');
const AgentStorePage = withLazy(() => import('../pages/agent/AgentStorePage.js'), 'AgentStorePage');
const AgentOrdersPage = withLazy(() => import('../pages/agent/AgentOrdersPage.js'), 'AgentOrdersPage');
const AgentWalletPage = withLazy(() => import('../pages/agent/AgentWalletPage.js'), 'AgentWalletPage');
const AgentWithdrawalsPage = withLazy(() => import('../pages/agent/AgentWithdrawalsPage.js'), 'AgentWithdrawalsPage');
const AgentCustomersPage = withLazy(() => import('../pages/agent/AgentCustomersPage.js'), 'AgentCustomersPage');
const AgentApiPage = withLazy(() => import('../pages/agent/AgentApiPage.js'), 'AgentApiPage');
const AgentAnalyticsPage = withLazy(() => import('../pages/agent/AgentAnalyticsPage.js'), 'AgentAnalyticsPage');
const AgentSettingsPage = withLazy(() => import('../pages/agent/AgentSettingsPage.js'), 'AgentSettingsPage');
const AgentProfilePage = withLazy(() => import('../pages/agent/AgentProfilePage.js'), 'AgentProfilePage');
const AgentPendingOrdersPage = withLazy(() => import('../pages/agent/AgentPendingOrdersPage.js'), 'AgentPendingOrdersPage');
const AgentRefundReportsPage = withLazy(() => import('../pages/agent/AgentRefundReportsPage.js'), 'AgentRefundReportsPage');
const AgentSandboxPage = withLazy(() => import('../pages/agent/AgentSandboxPage.js'), 'AgentSandboxPage');
const AgentWebhooksPage = withLazy(() => import('../pages/agent/AgentWebhooksPage.js'), 'AgentWebhooksPage');
const AgentApiUsagePage = withLazy(() => import('../pages/agent/AgentApiUsagePage.js'), 'AgentApiUsagePage');
const NotificationsPage = withLazy(() => import('../pages/shared/NotificationsPage.js'), 'NotificationsPage');
const BuyDataPage = withLazy(() => import('../pages/customer/BuyDataPage.js'), 'BuyDataPage');
const DeveloperPortal = withLazy(() => import('../pages/developer/DeveloperPortal.js'), 'DeveloperPortal');
const OrderTrackingPage = withLazy(() => import('../pages/public/OrderTrackingPage.js'), 'OrderTrackingPage');

export const agentRoutes: RouteObject[] = [
  {
    path: '/agent',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={['agent', 'admin', 'super_admin']}>
          <AgentLayout />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/agent/dashboard" replace />,
      },
      {
        path: '',
        element: <Navigate to="/agent/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AgentDashboard />,
      },
      {
        path: 'buy-data',
        element: <BuyDataPage />,
      },
      {
        path: 'bundles',
        element: <Navigate to="/agent/buy-data" replace />,
      },
      {
        path: 'store',
        element: <AgentStorePage />,
      },
      {
        path: 'orders',
        element: <AgentOrdersPage />,
      },
      {
        path: 'track',
        element: <OrderTrackingPage />,
      },
      {
        path: 'track/:orderId',
        element: <OrderTrackingPage />,
      },
      {
        path: 'track-order',
        element: <Navigate to="/agent/track" replace />,
      },
      {
        path: 'pending-approvals',
        element: <AgentPendingOrdersPage />,
      },
      {
        path: 'pending-orders',
        element: <AgentPendingOrdersPage />,
      },
      {
        path: 'wallet',
        element: <AgentWalletPage />,
      },
      {
        path: 'withdrawals',
        element: <AgentWithdrawalsPage />,
      },
      {
        path: 'refund-reports',
        element: <AgentRefundReportsPage />,
      },
      {
        path: 'customers',
        element: <AgentCustomersPage />,
      },
      {
        path: 'sub-agents',
        element: <AgentCustomersPage />,
      },
      {
        path: 'api',
        element: <AgentApiPage />,
      },
      {
        path: 'sandbox',
        element: <AgentSandboxPage />,
      },
      {
        path: 'api-usage',
        element: <AgentApiUsagePage />,
      },
      {
        path: 'webhooks',
        element: <AgentWebhooksPage />,
      },
      {
        path: 'docs',
        element: <DeveloperPortal />,
      },
      {
        path: 'developers',
        element: <DeveloperPortal />,
      },
      {
        path: 'analytics',
        element: <AgentAnalyticsPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'profile',
        element: <AgentProfilePage />,
      },
      {
        path: 'settings',
        element: <AgentSettingsPage />,
      },
    ],
  },
];
