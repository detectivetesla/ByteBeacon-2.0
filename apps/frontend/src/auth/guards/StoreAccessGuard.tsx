import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { storesApi } from '../../api/stores.api.js';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import {
  Store,
  CreditCard,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Headphones,
} from 'lucide-react';

export type StoreEntitlementState =
  | 'NOT_STARTED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_PENDING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED';

interface StoreAccessGuardProps {
  children?: React.ReactNode;
}

export const StoreAccessGuard: React.FC<StoreAccessGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [entitlementState, setEntitlementState] = useState<StoreEntitlementState>('ACTIVE');
  const [checkingEntitlement, setCheckingEntitlement] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setCheckingEntitlement(false);
      return;
    }

    storesApi
      .getStore()
      .then((store) => {
        if (!store) {
          setEntitlementState('NOT_STARTED');
        } else if (store.storeStatus === 'ACTIVE' && store.approvalStatus === 'APPROVED') {
          setEntitlementState('ACTIVE');
        } else if (store.storeStatus === 'SUSPENDED') {
          setEntitlementState('SUSPENDED');
        } else if (store.approvalStatus === 'REJECTED') {
          setEntitlementState('REJECTED');
        } else if (store.approvalStatus === 'AWAITING_APPROVAL') {
          setEntitlementState('AWAITING_APPROVAL');
        } else if (store.paymentStatus === 'PAYMENT_PENDING') {
          setEntitlementState('PAYMENT_PENDING');
        } else if (store.paymentStatus === 'PAYMENT_REQUIRED') {
          setEntitlementState('PAYMENT_REQUIRED');
        } else {
          setEntitlementState('NOT_STARTED');
        }
      })
      .catch(() => {
        // In case of network error, preserve access if previously authenticated
        setEntitlementState('ACTIVE');
      })
      .finally(() => {
        setCheckingEntitlement(false);
      });
  }, [isAuthenticated]);


  if (isLoading || checkingEntitlement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-app)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
            Verifying Store Entitlement...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/store-auth/login" replace />;
  }

  // Handle various unauthorized states
  if (entitlementState === 'NOT_STARTED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-app)' }}>
        <Card style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-tactile-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Store size={24} color="#3B82F6" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Your Agent Store isn't active yet.
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Complete StoreFront Setup in your Agent Console to create and launch your branded data storefront.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="primary" size="md" fullWidth onClick={() => navigate('/agent/store')} rightIcon={<ArrowRight size={14} />}>
              Go to StoreFront Setup
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (entitlementState === 'PAYMENT_REQUIRED' || entitlementState === 'PAYMENT_PENDING') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-app)' }}>
        <Card style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-tactile-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <CreditCard size={24} color="#F59E0B" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Store activation required.
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Complete your storefront activation payment in the Agent Console to submit your store for review.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="primary" size="md" fullWidth onClick={() => navigate('/agent/store')} rightIcon={<ArrowRight size={14} />}>
              Complete Payment
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (entitlementState === 'AWAITING_APPROVAL') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-app)' }}>
        <Card style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-tactile-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Clock size={24} color="#8B5CF6" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Store awaiting approval.
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Your activation payment has been verified. Your store is currently under review by ByteBeacon administrators.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="outline" size="md" fullWidth onClick={() => navigate('/agent/store')}>
              View Status in Agent Console
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (entitlementState === 'REJECTED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-app)' }}>
        <Card style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-tactile-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <AlertTriangle size={24} color="var(--color-danger)" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Store application not approved.
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Please review application requirements or contact support for further guidance.
          </p>
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Button variant="outline" size="md" fullWidth onClick={() => navigate('/agent/store')}>
              View Application Details
            </Button>
            <Button variant="ghost" size="md" fullWidth leftIcon={<Headphones size={14} />}>
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (entitlementState === 'SUSPENDED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-app)' }}>
        <Card style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-tactile-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <ShieldAlert size={24} color="var(--color-danger)" />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
            Your store is temporarily unavailable.
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            This storefront has been suspended. Please contact ByteBeacon compliance support for assistance.
          </p>
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="primary" size="md" fullWidth leftIcon={<Headphones size={14} />}>
              Contact Support Desk
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
