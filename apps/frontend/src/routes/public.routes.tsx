import React from 'react';
import { RouteObject } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';
import { isStorefrontHostname } from '../config/storefront.config.js';

const LandingPage = withLazy(() => import('../pages/public/LandingPage.js'), 'LandingPage');
const OrderTrackingPage = withLazy(() => import('../pages/public/OrderTrackingPage.js'), 'OrderTrackingPage');
const DeveloperPortal = withLazy(() => import('../pages/developer/DeveloperPortal.js'), 'DeveloperPortal');
const UnauthorizedPage = withLazy(() => import('../pages/public/UnauthorizedPage.js'), 'UnauthorizedPage');
const PublicStorefrontPage = withLazy(() => import('../pages/public/PublicStorefrontPage.js'), 'PublicStorefrontPage');

export const DynamicHomeRoute: React.FC = () => {
  if (isStorefrontHostname()) {
    // When accessed on apisolutions.store or its subdomains, render the customer storefront
    return <PublicStorefrontPage />;
  }
  // Otherwise on main platform, render the standard ByteBeacon marketing landing page
  return <LandingPage />;
};

export const publicRoutes: RouteObject[] = [
  // 1. Standalone Customer Storefront Routes (100% Isolated — No SaaS Navbar/Footer)
  {
    path: '/store',
    element: <PublicStorefrontPage />,
  },
  {
    path: '/store/:slug',
    element: <PublicStorefrontPage />,
  },

  // 2. Main Platform Public Routes (Wrapped in PublicLayout)
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <DynamicHomeRoute />,
      },
      {
        path: '/track',
        element: <OrderTrackingPage />,
      },
      {
        path: '/track/:orderId',
        element: <OrderTrackingPage />,
      },
      {
        path: '/developer',
        element: <DeveloperPortal />,
      },
      {
        path: '/docs',
        element: <DeveloperPortal />,
      },
      {
        path: '/unauthorized',
        element: <UnauthorizedPage />,
      },
    ],
  },
];


