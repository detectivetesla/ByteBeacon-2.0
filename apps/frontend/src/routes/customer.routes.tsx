import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { CustomerLayout } from '../layouts/CustomerLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';
import { CustomerDashboard } from '../pages/dashboard/CustomerDashboard.js';

const BuyDataPage = withLazy(() => import('../pages/customer/BuyDataPage.js'), 'BuyDataPage');
const OrdersPage = withLazy(() => import('../pages/customer/OrdersPage.js'), 'OrdersPage');
const WalletPage = withLazy(() => import('../pages/customer/WalletPage.js'), 'WalletPage');
const TransactionsPage = withLazy(() => import('../pages/customer/TransactionsPage.js'), 'TransactionsPage');
const SettingsPage = withLazy(() => import('../pages/customer/SettingsPage.js'), 'SettingsPage');
const CustomerProfilePage = withLazy(() => import('../pages/customer/CustomerProfilePage.js'), 'CustomerProfilePage');
const NotificationsPage = withLazy(() => import('../pages/shared/NotificationsPage.js'), 'NotificationsPage');
const OrderTrackingPage = withLazy(() => import('../pages/public/OrderTrackingPage.js'), 'OrderTrackingPage');
const CustomerPendingApprovalsPage = withLazy(() => import('../pages/customer/CustomerPendingApprovalsPage.js'), 'CustomerPendingApprovalsPage');

export const customerRoutes: RouteObject[] = [
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <CustomerLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: '',
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <CustomerDashboard />,
      },
      {
        path: 'buy-data',
        element: <BuyDataPage />,
      },
      {
        path: 'bundles',
        element: <Navigate to="/app/buy-data" replace />,
      },
      {
        path: 'orders',
        element: <OrdersPage />,
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
        element: <Navigate to="/app/track" replace />,
      },
      {
        path: 'pending-approvals',
        element: <CustomerPendingApprovalsPage />,
      },
      {
        path: 'pending-orders',
        element: <CustomerPendingApprovalsPage />,
      },
      {
        path: 'wallet',
        element: <WalletPage />,
      },
      {
        path: 'transactions',
        element: <TransactionsPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'profile',
        element: <CustomerProfilePage />,
      },
    ],
  },
  // Backward compatibility alias for /dashboard -> /app/dashboard
  {
    path: '/dashboard',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/customer/wallet',
    element: <Navigate to="/app/wallet" replace />,
  },
  {
    path: '/customer/transactions',
    element: <Navigate to="/app/transactions" replace />,
  },
];
