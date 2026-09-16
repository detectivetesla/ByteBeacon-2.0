import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';

export interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-base)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'guardSpinner 0.8s linear infinite' }} />
        <style>{`@keyframes guardSpinner { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const role = (user.role || '').toLowerCase().trim();
    if (role === 'admin' || role === 'super_admin' || user.securityDomain === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    if (role === 'agent' || user.securityDomain === 'AGENT') {
      return <Navigate to="/agent" replace />;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
};
