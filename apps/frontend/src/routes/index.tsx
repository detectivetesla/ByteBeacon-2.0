import { RouteObject, Navigate } from 'react-router-dom';
import { publicRoutes } from './public.routes.js';
import { authRoutes } from './auth.routes.js';
import { customerRoutes } from './customer.routes.js';
import { agentRoutes } from './agent.routes.js';
import { storeRoutes } from './store.routes.js';
import { adminRoutes } from './admin.routes.js';

export const routes: RouteObject[] = [
  // Public Marketing & Tracking Routes
  publicRoutes,

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

  // Fallback Wildcard
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];
