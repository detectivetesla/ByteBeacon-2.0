import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VisualPanel } from './VisualPanel.js';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  visualTitle?: string;
  visualSubtitle?: string;
  topActionText?: string;
  topActionLinkText?: string;
  topActionHref?: string;
  backHref?: string;
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
  backHref,
}) => {
  const navigate = useNavigate();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  const isAccountSecurityPage = visualTitle === 'Account Security & Access Recovery';
  const effectiveBackHref = backHref || (isAccountSecurityPage ? '/signin' : '/');

  const handleBack = () => {
    navigate(effectiveBackHref);
  };

  return (
    <div className="auth-page-wrapper">
      <style>{`
        .auth-page-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justifyContent: center;
          padding: 2.5rem 1.5rem;
          background-color: var(--color-bg-base);
          background-image: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 65%), url(/auth/auth-bg.jpg);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          box-sizing: border-box;
        }

        .auth-split-card {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
          max-width: 480px;
          min-height: auto;
          background-color: var(--color-bg-surface);
          border-radius: 1.25rem;
          border: 1px solid var(--color-border-default);
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.04);
          overflow: hidden;
          transition: max-width 0.2s ease;
        }

        .auth-visual-col {
          display: none;
        }

        .auth-form-surface {
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          padding: 2.25rem 2rem;
          background-color: var(--color-bg-surface);
          box-sizing: border-box;
          width: 100%;
        }

        .auth-header-wrapper {
          width: 100%;
          margin-bottom: 1.75rem;
        }

        .auth-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 0.75rem;
        }

        .auth-brand-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .auth-back-button {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          height: 36px;
          padding: 0 0.75rem;
          border-radius: 0.5rem;
          background-color: var(--color-bg-surface-elevated);
          border: 1px solid var(--color-border-default);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          flex-shrink: 0;
        }

        .auth-back-button:hover {
          color: var(--color-text-primary);
          border-color: var(--color-border-strong);
          background-color: var(--color-bg-surface);
          transform: translateY(-1px);
        }

        .auth-logo-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          flex-shrink: 0;
        }

        .auth-logo-img {
          width: 36px;
          height: 36px;
          object-fit: contain;
          transition: transform 0.15s ease;
        }

        .auth-logo-link:hover .auth-logo-img {
          transform: scale(1.04);
        }

        /* Desktop Switcher Link */
        .auth-switcher-desktop {
          display: none;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          text-align: right;
          white-space: nowrap;
        }

        /* Mobile Switcher Banner */
        .auth-switcher-mobile {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          padding: 0.5rem 0.875rem;
          margin-top: 1rem;
          border-radius: 9999px;
          background-color: var(--color-bg-surface-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
          text-align: center;
          line-height: 1.4;
        }

        .auth-switcher-link {
          font-weight: 700;
          color: var(--color-primary);
          text-decoration: none;
        }

        .auth-switcher-link:hover {
          text-decoration: underline;
        }

        .auth-form-core {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
        }

        .auth-title-block {
          text-align: center;
          margin-bottom: 1.75rem;
        }

        .auth-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.25;
          color: var(--color-text-primary);
          font-family: var(--font-display);
          margin: 0;
        }

        .auth-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-top: 0.5rem;
          line-height: 1.5;
        }

        .auth-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 1.5rem;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          border-top: 1px solid var(--color-border-subtle);
          margin-top: 1.75rem;
        }

        /* Responsive Breakpoints */
        @media (min-width: 640px) {
          .auth-switcher-desktop {
            display: block;
          }
          .auth-switcher-mobile {
            display: none;
          }
          .auth-title {
            font-size: 1.625rem;
          }
        }

        @media (min-width: 960px) {
          .auth-split-card {
            grid-template-columns: 440px 1fr;
            max-width: 1020px;
            min-height: 640px;
            border-radius: 1.5rem;
          }
          .auth-visual-col {
            display: block;
          }
          .auth-form-surface {
            padding: 2.75rem 3rem;
          }
          .auth-title {
            font-size: 1.75rem;
          }
        }

        @media (max-width: 480px) {
          .auth-page-wrapper {
            padding: 1rem 0.75rem;
          }
          .auth-split-card {
            border-radius: 1rem;
          }
          .auth-form-surface {
            padding: 1.25rem 1rem;
          }
          .auth-title {
            font-size: 1.375rem;
          }
          .auth-subtitle {
            font-size: 0.8125rem;
          }
          .auth-header-wrapper {
            margin-bottom: 1.25rem;
          }
          .auth-title-block {
            margin-bottom: 1.25rem;
          }
          .auth-footer {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
            padding-top: 1.25rem;
            margin-top: 1.25rem;
          }
        }
      `}</style>

      {/* Main Split Authentication Card */}
      <div className="auth-split-card">
        {/* Left Column: Visual / Editorial Panel (desktop only) */}
        <div className="auth-visual-col">
          <VisualPanel title={visualTitle} subtitle={visualSubtitle} />
        </div>

        {/* Right Column: Form & Interaction Surface */}
        <div className="auth-form-surface">
          {/* Top Header: Back Button + Logo + Switcher Link */}
          <div className="auth-header-wrapper">
            <div className="auth-top-bar">
              {/* Back Navigation & Brand Logo */}
              <div className="auth-brand-group">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={effectiveBackHref === '/signin' ? 'Go Back to Sign In' : 'Go Back to Landing Page'}
                  className="auth-back-button"
                >
                  <ArrowLeft size={15} strokeWidth={2.2} />
                  <span>Go Back</span>
                </button>

                <Link to="/" className="auth-logo-link" aria-label="ByteBeacon Home">
                  <img
                    src="/logo.png"
                    alt="ByteBeacon"
                    className="auth-logo-img"
                  />
                </Link>
              </div>

              {/* Desktop Switcher Link (hidden on mobile) */}
              {topActionLinkText && topActionHref && (
                <div className="auth-switcher-desktop">
                  <span>{topActionText} </span>
                  <Link to={topActionHref} className="auth-switcher-link">
                    {topActionLinkText}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Switcher Banner (visible only on mobile) */}
            {topActionLinkText && topActionHref && (
              <div className="auth-switcher-mobile">
                <span>{topActionText} </span>
                <Link to={topActionHref} className="auth-switcher-link">
                  {topActionLinkText}
                </Link>
              </div>
            )}
          </div>

          {/* Form Core Container */}
          <div className="auth-form-core">
            {/* Form Title & Subtitle */}
            {title && (
              <div className="auth-title-block">
                <h1 className="auth-title">{title}</h1>
                {subtitle && <p className="auth-subtitle">{subtitle}</p>}
              </div>
            )}

            {/* Maintenance Mode Amber Notification Banner */}
            {isMaintenanceMode && (
              <div
                role="alert"
                data-testid="auth-maintenance-alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: 'var(--font-size-xs)', lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 800, color: '#D97706', marginBottom: '0.125rem' }}>
                    Scheduled Maintenance in Progress
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-3xs)' }}>
                    {maintenanceMessage || 'Platform upgrades are currently underway. Customer & Agent portal access is temporarily offline.'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: '#D97706', fontWeight: 700, marginTop: '0.375rem' }}>
                    Administrator sign-in remains active.
                  </div>
                </div>
              </div>
            )}

            {/* Injected Form Controls */}
            {children}
          </div>

          {/* Bottom Footer: Copyright & Legal */}
          <div className="auth-footer">
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
