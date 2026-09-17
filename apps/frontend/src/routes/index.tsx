import React from 'react';
import { RouteObject, Navigate, useParams } from 'react-router-dom';
import { publicRoutes } from './public.routes.js';
import { authRoutes } from './auth.routes.js';
import { customerRoutes } from './customer.routes.js';
import { agentRoutes } from './agent.routes.js';
import { storeRoutes } from './store.routes.js';
import { adminRoutes } from './admin.routes.js';
import { withLazy } from '../components/common/LazyRoute.js';
import { isStorefrontHostname } from '../config/storefront.config.js';

const PublicStorefrontPage = withLazy(() => import('../pages/public/PublicStorefrontPage.js'), 'PublicStorefrontPage');

const RESERVED_APP_PATHS = new Set([
  'app',
  'agent',
  'admin',
  'store-console',
  'signin',
  'signup',
  'forgot-password',
  'reset-password',
  'verify-email',
  'mfa',
  'buy',
  'track',
  'info',
  'docs',
  'developer',
  'portal',
  'store',
  'api',
  'assets',
  'unauthorized',
  'buy-data',
  'bundles',
]);

/**
 * Renders custom agent storefront slug (e.g. apisolutions.store/:slug or localhost:5173/:slug).
 * If accessed on the main ByteBeacon domain in production, redirects to apisolutions.store/:slug.
 */
const StorefrontSlugRoute: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  if (slug && RESERVED_APP_PATHS.has(slug.toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  if (isStorefrontHostname()) {
    return <PublicStorefrontPage />;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalhost) {
      return <PublicStorefrontPage />;
    }
    // On main domain, redirect to canonical apisolutions.store with the custom slug
    const targetUrl = slug ? `https://apisolutions.store/${slug}` : 'https://apisolutions.store';
    window.location.replace(targetUrl);
    return null;
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
  {
    path: '/:slug/:page',
    element: <StorefrontSlugRoute />,
  },

  // Fallback Wildcard
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

