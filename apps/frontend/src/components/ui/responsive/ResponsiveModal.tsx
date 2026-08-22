import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '540px',
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
      className="bb-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 'var(--z-modal, 310)',
      }}
      onClick={onClose}
    >
      <style>{`
        .bb-responsive-modal-body {
          background-color: var(--color-bg-surface);
          border: 1px solid var(--color-border-hover);
          border-radius: var(--radius-2xl, 24px);
          width: 100%;
          max-width: ${maxWidth};
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-floating);
          overflow: hidden;
          animation: bbModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes bbModalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .bb-modal-drag-handle {
          display: none;
        }
        @media (max-width: 639px) {
          .bb-modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .bb-responsive-modal-body {
            max-width: 100% !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            border-bottom: none !important;
            max-height: 88vh !important;
            animation: bbModalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          @keyframes bbModalSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .bb-modal-drag-handle {
            display: flex !important;
            justify-content: center;
            padding: 8px 0 2px 0;
          }
        }
      `}</style>

      <div
        className="bb-responsive-modal-body"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Indicator */}
        <div className="bb-modal-drag-handle">
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--color-border-default)',
            }}
          />
        </div>

        {/* Modal Header */}
        {(title || subtitle) && (
          <div
            style={{
              padding: 'var(--space-4) var(--space-6)',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <h3
                  style={{
                    fontSize: 'var(--font-size-lg, 1.125rem)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    overflowWrap: 'break-word',
                  }}
                >
                  {title}
                </h3>
              )}
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
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
              }}
              aria-label="Close dialog"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            flex: 1,
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
