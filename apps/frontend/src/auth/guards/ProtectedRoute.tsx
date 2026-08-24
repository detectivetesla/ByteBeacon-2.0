import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';
import { AlertTriangle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button.js';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { isMaintenanceMode, maintenanceMessage, refetch } = usePlatformStatus();
  const [isChecking, setIsChecking] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-base)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'guardSpinner 0.8s linear infinite' }} />
        <style>{`@keyframes guardSpinner { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/signin?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // If maintenance mode is active, non-admin accounts are locked out of portal access
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  if (isMaintenanceMode && !isAdmin) {
    const handleCheckStatus = async () => {
      setIsChecking(true);
      try {
        await refetch();
      } finally {
        setIsChecking(false);
      }
    };

    return (
      <div
        data-testid="maintenance-lockout-screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-base)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-floating)',
            padding: 'var(--space-8)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <AlertTriangle size={32} style={{ color: '#F59E0B' }} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#D97706',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--space-3)',
            }}
          >
            <ShieldAlert size={12} />
            <span>Platform Maintenance Mode Active</span>
          </div>

          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 900,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 'var(--space-2)',
            }}
          >
            System Temporarily Inaccessible
          </h1>

          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: 'var(--space-6)',
            }}
          >
            {maintenanceMessage ||
              'ByteBeacon is currently undergoing scheduled platform upgrades and database optimizations. Customer and Agent portal operations are temporarily suspended.'}
          </p>

          <div
            style={{
              padding: '0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface-muted)',
              border: '1px solid var(--color-border-default)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-6)',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
              Current Session Details:
            </div>
            <div>Account: <strong>{user?.email || user?.fullName || 'Active User'}</strong></div>
            <div>Role: <span style={{ textTransform: 'capitalize' }}>{user?.role || 'Customer'}</span></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCheckStatus}
              isLoading={isChecking}
              leftIcon={<RefreshCw size={16} />}
            >
              Check Platform Status
            </Button>

            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => logout()}
              leftIcon={<LogOut size={15} />}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
