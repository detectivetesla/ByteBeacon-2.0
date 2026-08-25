import { RouteObject } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.js';
import { LandingPage } from '../pages/public/LandingPage.js';
import { OrderTrackingPage } from '../pages/public/OrderTrackingPage.js';
import { DeveloperPortal } from '../pages/developer/DeveloperPortal.js';
import { UnauthorizedPage } from '../pages/public/UnauthorizedPage.js';
import { PublicStorefrontPage } from '../pages/public/PublicStorefrontPage.js';

export const publicRoutes: RouteObject = {
  element: <PublicLayout />,
  children: [
    {
      path: '/',
      element: <LandingPage />,
    },
    {
      path: '/store',
      element: <PublicStorefrontPage />,
    },
    {
      path: '/store/:slug',
      element: <PublicStorefrontPage />,
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
};
