import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { AgentLayout } from '../layouts/AgentLayout.js';
import { AgentDashboard } from '../pages/dashboard/AgentDashboard.js';
import { AgentStorePage } from '../pages/agent/AgentStorePage.js';
import { AgentOrdersPage } from '../pages/agent/AgentOrdersPage.js';
import { AgentWalletPage } from '../pages/agent/AgentWalletPage.js';
import { AgentWithdrawalsPage } from '../pages/agent/AgentWithdrawalsPage.js';
import { AgentCustomersPage } from '../pages/agent/AgentCustomersPage.js';
import { AgentApiPage } from '../pages/agent/AgentApiPage.js';
import { AgentAnalyticsPage } from '../pages/agent/AgentAnalyticsPage.js';
import { AgentSettingsPage } from '../pages/agent/AgentSettingsPage.js';
import { AgentProfilePage } from '../pages/agent/AgentProfilePage.js';
import { AgentPendingOrdersPage } from '../pages/agent/AgentPendingOrdersPage.js';
import { AgentRefundReportsPage } from '../pages/agent/AgentRefundReportsPage.js';
import { AgentSandboxPage } from '../pages/agent/AgentSandboxPage.js';
import { AgentWebhooksPage } from '../pages/agent/AgentWebhooksPage.js';
import { AgentApiUsagePage } from '../pages/agent/AgentApiUsagePage.js';
import { NotificationsPage } from '../pages/shared/NotificationsPage.js';
import { BuyDataPage } from '../pages/customer/BuyDataPage.js';
import { DeveloperPortal } from '../pages/developer/DeveloperPortal.js';

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
