import { RouteObject, Navigate } from 'react-router-dom';
import { PublicOnlyRoute } from '../auth/guards/PublicOnlyRoute.js';
import { SignInPage } from '../pages/auth/SignInPage.js';
import { SignUpPage } from '../pages/auth/SignUpPage.js';
import { AgentSignUpPage } from '../pages/auth/AgentSignUpPage.js';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage.js';
import { StoreLoginPage } from '../pages/store/StoreLoginPage.js';

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
