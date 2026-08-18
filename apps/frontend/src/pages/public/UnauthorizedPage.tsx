import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Button } from '../../components/ui/Button/Button.js';
import { ShieldAlert, ArrowLeft, Home, LogOut } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (!user) return '/';
    if (user.role === 'admin' || user.role === 'super_admin') return '/admin';
    if (user.role === 'agent') return '/agent';
    return '/app/dashboard';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-floating)',
          padding: 'var(--space-10) var(--space-8)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--color-accent-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-6)',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
          }}
        >
          <ShieldAlert size={32} strokeWidth={2.5} />
        </div>

        <span
          style={{
            fontSize: 'var(--font-size-3xs)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-accent-red)',
            marginBottom: '0.25rem',
          }}
        >
          403 ACCESS RESTRICTED
        </span>

        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-display)',
          }}
        >
          Permission Required
        </h1>

        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            marginTop: '0.5rem',
            marginBottom: 'var(--space-8)',
          }}
        >
          You do not have permission to access this administrative or role-restricted area. If you believe this is an error, please switch accounts or contact your platform administrator.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(getDashboardPath())}
            leftIcon={<Home size={18} strokeWidth={2.5} />}
          >
            Go to My Dashboard
          </Button>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => navigate('/')}
            leftIcon={<ArrowLeft size={18} strokeWidth={2.5} />}
          >
            Public Home
          </Button>

          {user && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => {
                logout();
                navigate('/signin');
              }}
              leftIcon={<LogOut size={16} strokeWidth={2.5} />}
              style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}
            >
              Sign Out & Switch Account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
