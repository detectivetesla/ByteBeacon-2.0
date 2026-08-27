import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button.js';

export interface AdminRouteGuardProps {
  children: React.ReactNode;
  stealthMode?: boolean; // When true, renders a 404 lockout rather than redirecting to login
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  children,
  stealthMode = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div
        data-testid="admin-guard-loading"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-base)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--color-brand)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'guardSpinner 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes guardSpinner { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 1. Unauthenticated Visitors
  if (!isAuthenticated || !user) {
    if (stealthMode) {
      return (
        <div
          data-testid="admin-stealth-lockout"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            backgroundColor: '#090D16',
            color: '#F1F5F9',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em', color: '#64748B' }}>
              404
            </h1>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
              Page Not Found
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: '0 0 var(--space-6) 0', lineHeight: 1.5 }}>
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/')}
              style={{ width: '100%', minHeight: '44px' }}
            >
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Navigate
        to={`/admin-auth/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // 2. Non-Administrative Authenticated Users (Customers / Agents attempting access)
  const isAdminRole = user.role === 'admin' || user.role === 'super_admin';
  if (!isAdminRole) {
    return (
      <div
        data-testid="admin-unauthorized-lockout"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6)',
          backgroundColor: '#090D16',
          color: '#F1F5F9',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              marginBottom: 'var(--space-4)',
            }}
          >
            <ShieldAlert size={28} strokeWidth={2.4} />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            Administrative Privileges Required
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Your active account (<code style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{user.email}</code>) does not hold administrative clearance. All unauthorized access attempts are logged.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.75rem',
              color: '#F87171',
              fontWeight: 600,
              marginBottom: 'var(--space-6)',
            }}
          >
            Security Domain: {user.securityDomain || 'RESTRICTED'} • Role: {user.role?.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Button
              variant="outline"
              onClick={() => navigate(user.role === 'agent' ? '/agent' : '/app/dashboard')}
              style={{ flex: 1, minHeight: '42px' }}
            >
              <ArrowLeft size={16} /> Return to Portal
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/admin-auth/login')}
              style={{ flex: 1, minHeight: '42px' }}
            >
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. User is authorized administrator
  return <>{children}</>;
};
