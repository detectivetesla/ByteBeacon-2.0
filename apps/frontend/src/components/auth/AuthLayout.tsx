import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VisualPanel } from './VisualPanel.js';
import { ArrowLeft } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  visualTitle?: string;
  visualSubtitle?: string;
  topActionText?: string;
  topActionLinkText?: string;
  topActionHref?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  visualTitle,
  visualSubtitle,
  topActionText,
  topActionLinkText,
  topActionHref,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
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
        backgroundImage: 'url(/auth/auth-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <style>{`
        .auth-split-card {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
          max-width: 1040px;
          min-height: 640px;
          background-color: var(--color-bg-surface);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border-default);
          box-shadow: var(--shadow-floating);
          overflow: hidden;
        }

        .auth-visual-col {
          display: none;
        }

        @media (min-width: 960px) {
          .auth-split-card {
            grid-template-columns: 440px 1fr;
          }
          .auth-visual-col {
            display: block;
          }
        }
      `}</style>

      {/* Main Split Authentication Card */}
      <div className="auth-split-card">
        {/* Left Column: Visual / Editorial Panel */}
        <div className="auth-visual-col">
          <VisualPanel title={visualTitle} subtitle={visualSubtitle} />
        </div>

        {/* Right Column: Form & Interaction Surface */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 'var(--space-8) var(--space-8)',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          {/* Top Header: Back Button + Logo + Switcher Link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-6)',
            }}
          >
            {/* Top-Left: Back Navigation & Brand Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go Back to Landing Page"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-surface-muted)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                }}
              >
                <ArrowLeft size={14} strokeWidth={2.4} />
                <span>Go Back</span>
              </button>

              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img
                  src="/logo.png"
                  alt="ByteBeacon"
                  style={{
                    width: '42px',
                    height: '42px',
                    objectFit: 'contain',
                  }}
                />
              </Link>
            </div>

            {/* Top-Right Alternate Auth Switcher Link */}
            {topActionLinkText && topActionHref && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {topActionText}{' '}
                <Link
                  to={topActionHref}
                  style={{
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    textDecoration: 'underline',
                  }}
                >
                  {topActionLinkText}
                </Link>
              </div>
            )}
          </div>

          {/* Form Core Container */}
          <div style={{ maxWidth: '380px', width: '100%', margin: '0 auto', padding: 'var(--space-2) 0' }}>
            {/* Form Title & Subtitle */}
            {title && (
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <h1
                  style={{
                    fontSize: 'clamp(1.5rem, 3vw, 1.875rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      marginTop: '0.375rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Injected Form Controls */}
            {children}
          </div>

          {/* Bottom Footer: Copyright & Legal */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 'var(--space-6)',
              fontSize: 'var(--font-size-2xs)',
              color: 'var(--color-text-muted)',
              borderTop: '1px solid var(--color-border-subtle)',
              marginTop: 'var(--space-6)',
            }}
          >
            <div>© {new Date().getFullYear()} ByteBeacon</div>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => (window.location.href = '/')}>Privacy Policy</span>
              <span style={{ cursor: 'pointer' }} onClick={() => (window.location.href = '/')}>Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
