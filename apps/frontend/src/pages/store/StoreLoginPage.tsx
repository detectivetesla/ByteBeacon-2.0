import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, PasswordInput } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { authApi } from '../../api/auth.api.js';
import { Store, ArrowLeft, Mail } from 'lucide-react';

export const StoreLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toastError('Missing fields', 'Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login({ identifier: email.trim(), password });

      if (data?.user && data?.tokens) {
        login(data.user, data.tokens);
        toastSuccess('Authenticated', 'Welcome back to your Agent Store Console.');
        navigate('/store-console/overview');
      } else {
        throw new Error('Malformed login response');
      }
    } catch (err: any) {
      toastError('Authentication Failed', err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-bg-app)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Back to ByteBeacon link */}
      <div style={{ maxWidth: '440px', width: '100%', marginBottom: 'var(--space-4)' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to ByteBeacon</span>
        </Link>
      </div>

      <Card
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: 'var(--space-8)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-tactile-lg)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4) auto',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.35)',
            }}
          >
            <Store size={26} strokeWidth={2.4} />
          </div>

          <span
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#3B82F6',
            }}
          >
            Agent Store
          </span>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 900,
              color: 'var(--color-text-primary)',
              margin: '0.125rem 0 0.25rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Sign in to manage your storefront
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="store-login-email"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@example.com"
            leftIcon={<Mail size={15} color="var(--color-text-muted)" />}
            required
            disabled={loading}
          />

          <PasswordInput
            id="store-login-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            disabled={loading}
          />

          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button variant="primary" size="lg" fullWidth type="submit" isLoading={loading}>
              Sign In to Store
            </Button>
          </div>
        </form>

        {/* Footer Note */}
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
            Uses your unified ByteBeacon merchant identity
          </span>
        </div>
      </Card>
    </div>
  );
};
