import React from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { publicRoutes } from './public.routes.js';
import { authRoutes } from './auth.routes.js';
import { customerRoutes } from './customer.routes.js';
import { agentRoutes } from './agent.routes.js';
import { storeRoutes } from './store.routes.js';
import { adminRoutes } from './admin.routes.js';
import { PublicStorefrontPage } from '../pages/public/PublicStorefrontPage.js';
import { isStorefrontHostname } from '../config/storefront.config.js';

/**
 * Only render the storefront slug route on storefront domains (e.g. apisolutions.store/fastdata).
 * On the main platform domain, redirect unknown paths to home.
 */
const StorefrontSlugRoute: React.FC = () => {
  if (isStorefrontHostname()) {
    return <PublicStorefrontPage />;
  }
  return <Navigate to="/" replace />;
};

export const routes: RouteObject[] = [
  // Public Marketing & Tracking Routes
  ...publicRoutes,

  // Authentication Routes
  ...authRoutes,

  // Protected Customer Portal Routes
  ...customerRoutes,

  // Protected Agent Store Routes (Agent Console Bridge)
  ...agentRoutes,

  // Protected Standalone Agent Store Platform
  ...storeRoutes,

  // Protected Admin Operations Routes
  ...adminRoutes,

  // Global Route Aliases
  {
    path: '/buy-data',
    element: <Navigate to="/app/buy-data" replace />,
  },
  {
    path: '/bundles',
    element: <Navigate to="/app/buy-data" replace />,
  },

  // Standalone Custom Agent Storefront Direct Slug (only on storefront domains)
  {
    path: '/:slug',
    element: <StorefrontSlugRoute />,
  },

  // Fallback Wildcard
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

