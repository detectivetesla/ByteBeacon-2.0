import React from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider } from './context/AuthContext.js';
import { PlatformStatusProvider } from './context/PlatformStatusContext.js';
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
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </PlatformStatusProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
