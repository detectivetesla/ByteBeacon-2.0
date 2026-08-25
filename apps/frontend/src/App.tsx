import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider } from './context/AuthContext.js';
import { PlatformStatusProvider } from './context/PlatformStatusContext.js';
import { PendingApprovalsProvider } from './context/PendingApprovalsContext.js';
import { routes } from './routes/index.js';

const AppRoutes: React.FC = () => {
  return useRoutes(routes);
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <PlatformStatusProvider>
            <PendingApprovalsProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </PendingApprovalsProvider>
          </PlatformStatusProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
