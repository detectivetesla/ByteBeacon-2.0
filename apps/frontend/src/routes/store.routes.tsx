import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { StoreAccessGuard } from '../auth/guards/StoreAccessGuard.js';
import { StoreLayout } from '../layouts/StoreLayout.js';
import { StoreDashboardPage } from '../pages/store/StoreDashboardPage.js';
import { StoreOrdersPage } from '../pages/store/StoreOrdersPage.js';
import { StoreProductsPage } from '../pages/store/StoreProductsPage.js';
import { StoreCustomersPage } from '../pages/store/StoreCustomersPage.js';
import { StoreAnalyticsPage } from '../pages/store/StoreAnalyticsPage.js';
import { StoreProfilePage } from '../pages/store/StoreProfilePage.js';
import { StoreAppearancePage } from '../pages/store/StoreAppearancePage.js';
import { StoreFinancePage } from '../pages/store/StoreFinancePage.js';
import { StoreSettingsPage } from '../pages/store/StoreSettingsPage.js';
import { NotificationsPage } from '../pages/shared/NotificationsPage.js';

export const storeRoutes: RouteObject[] = [
  {
    path: '/store-console',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={['agent', 'admin', 'super_admin']} fallbackPath="/unauthorized">
          <StoreAccessGuard>
            <StoreLayout />
          </StoreAccessGuard>
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Navigate to="/store-console/overview" replace />,
      },
      {
        path: 'overview',
        element: <StoreDashboardPage />,
      },
      {
        path: 'dashboard',
        element: <Navigate to="/store-console/overview" replace />,
      },
      {
        path: 'orders',
        element: <StoreOrdersPage />,
      },
      {
        path: 'products',
        element: <StoreProductsPage />,
      },
      {
        path: 'customers',
        element: <StoreCustomersPage />,
      },
      {
        path: 'analytics',
        element: <StoreAnalyticsPage />,
      },
      {
        path: 'profile',
        element: <StoreProfilePage />,
      },
      {
        path: 'appearance',
        element: <StoreAppearancePage />,
      },
      {
        path: 'link',
        element: <StoreProfilePage />,
      },
      {
        path: 'finance',
        element: <StoreFinancePage />,
      },
      {
        path: 'transactions',
        element: <StoreFinancePage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'settings',
        element: <StoreSettingsPage />,
      },
    ],
  },
];
