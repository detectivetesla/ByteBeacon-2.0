import { RouteObject, Navigate } from 'react-router-dom';
import { PublicOnlyRoute } from '../auth/guards/PublicOnlyRoute.js';
import { withLazy } from '../components/common/LazyRoute.js';
import { SignInPage } from '../pages/auth/SignInPage.js';
import { SignUpPage } from '../pages/auth/SignUpPage.js';
import { AgentSignUpPage } from '../pages/auth/AgentSignUpPage.js';
import { AdminSignInPage } from '../pages/auth/AdminSignInPage.js';

const ForgotPasswordPage = withLazy(() => import('../pages/auth/ForgotPasswordPage.js'), 'ForgotPasswordPage');
const ResetPasswordPage = withLazy(() => import('../pages/auth/ResetPasswordPage.js'), 'ResetPasswordPage');
const StoreLoginPage = withLazy(() => import('../pages/store/StoreLoginPage.js'), 'StoreLoginPage');

export const authRoutes: RouteObject[] = [
  {
    path: '/signin',
    element: (
      <PublicOnlyRoute>
        <SignInPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/login',
    element: <Navigate to="/signin" replace />,
  },
  {
    path: '/auth/login',
    element: <Navigate to="/signin" replace />,
  },
  {
    path: '/admin-auth/login',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/admin/login',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/gateway/secure-admin-entry',
    element: <AdminSignInPage />,
  },
  {
    path: '/store-auth/login',
    element: <StoreLoginPage />,
  },
  {
    path: '/signup',
    element: (
      <PublicOnlyRoute>
        <SignUpPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: <Navigate to="/signup" replace />,
  },
  {
    path: '/agent/signup',
    element: (
      <PublicOnlyRoute>
        <AgentSignUpPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
];
