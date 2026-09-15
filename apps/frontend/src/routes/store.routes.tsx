import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { RoleGuard } from '../auth/guards/RoleGuard.js';
import { StoreAccessGuard } from '../auth/guards/StoreAccessGuard.js';
import { StoreLayout } from '../layouts/StoreLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';

const StoreDashboardPage = withLazy(() => import('../pages/store/StoreDashboardPage.js'), 'StoreDashboardPage');
const StoreOrdersPage = withLazy(() => import('../pages/store/StoreOrdersPage.js'), 'StoreOrdersPage');
const StoreProductsPage = withLazy(() => import('../pages/store/StoreProductsPage.js'), 'StoreProductsPage');
const StoreCustomersPage = withLazy(() => import('../pages/store/StoreCustomersPage.js'), 'StoreCustomersPage');
const StoreAnalyticsPage = withLazy(() => import('../pages/store/StoreAnalyticsPage.js'), 'StoreAnalyticsPage');
const StoreProfilePage = withLazy(() => import('../pages/store/StoreProfilePage.js'), 'StoreProfilePage');
const StoreAppearancePage = withLazy(() => import('../pages/store/StoreAppearancePage.js'), 'StoreAppearancePage');
const StoreFinancePage = withLazy(() => import('../pages/store/StoreFinancePage.js'), 'StoreFinancePage');
const StoreSettingsPage = withLazy(() => import('../pages/store/StoreSettingsPage.js'), 'StoreSettingsPage');
const NotificationsPage = withLazy(() => import('../pages/shared/NotificationsPage.js'), 'NotificationsPage');

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
