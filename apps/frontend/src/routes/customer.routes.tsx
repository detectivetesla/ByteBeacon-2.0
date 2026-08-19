import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../auth/guards/ProtectedRoute.js';
import { CustomerLayout } from '../layouts/CustomerLayout.js';
import { CustomerDashboard } from '../pages/dashboard/CustomerDashboard.js';
import { BuyDataPage } from '../pages/customer/BuyDataPage.js';
import { OrdersPage } from '../pages/customer/OrdersPage.js';
import { WalletPage } from '../pages/customer/WalletPage.js';
import { TransactionsPage } from '../pages/customer/TransactionsPage.js';
import { SettingsPage } from '../pages/customer/SettingsPage.js';
import { CustomerProfilePage } from '../pages/customer/CustomerProfilePage.js';
import { NotificationsPage } from '../pages/shared/NotificationsPage.js';
import { OrderTrackingPage } from '../pages/public/OrderTrackingPage.js';

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
];
