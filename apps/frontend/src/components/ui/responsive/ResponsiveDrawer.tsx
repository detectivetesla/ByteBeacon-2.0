import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ResponsiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  position?: 'right' | 'left' | 'bottom';
}

export const ResponsiveDrawer: React.FC<ResponsiveDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = '480px',
  position = 'right',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 'var(--z-drawer, 200)',
        display: 'flex',
        justifyContent: position === 'left' ? 'flex-start' : 'flex-end',
      }}
      onClick={onClose}
    >
      <style>{`
        .bb-responsive-drawer-body {
          position: relative;
          width: 100%;
          max-width: ${width};
          height: 100%;
          background-color: var(--color-bg-surface);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-floating);
          animation: bbDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes bbDrawerSlideIn {
          from { transform: translateX(${position === 'left' ? '-100%' : '100%'}); }
          to { transform: translateX(0); }
        }
        @media (max-width: 639px) {
          .bb-responsive-drawer-body {
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div
        className="bb-responsive-drawer-body"
        style={{
          borderLeft: position === 'right' ? '1px solid var(--color-border-default)' : 'none',
          borderRight: position === 'left' ? '1px solid var(--color-border-default)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                fontSize: 'var(--font-size-lg, 1.125rem)',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-display)',
                margin: 0,
                overflowWrap: 'break-word',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs, 0.75rem)',
                  color: 'var(--color-text-secondary)',
                  margin: '0.2rem 0 0 0',
                  overflowWrap: 'break-word',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}
            aria-label="Close drawer"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {children}
        </div>

        {/* Footer if present */}
        {footer && (
          <div
            style={{
              padding: 'var(--space-4) var(--space-6)',
              borderTop: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
