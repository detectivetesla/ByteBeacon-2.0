import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '520px',
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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 'var(--z-modal)',
      }}
      onClick={onClose}
    >
      <style>{`
        .bb-responsive-modal {
          background-color: var(--color-bg-surface);
          border: 1px solid var(--color-border-hover);
          border-radius: var(--radius-2xl);
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
        @media (max-width: 639px) {
          .bb-modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .bb-responsive-modal {
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
            display: block !important;
          }
        }
      `}</style>

      <div
        className="bb-responsive-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Indicator */}
        <div
          className="bb-modal-drag-handle"
          style={{
            display: 'none',
            width: '36px',
            height: '4px',
            backgroundColor: 'var(--color-border-hover)',
            borderRadius: 'var(--radius-full)',
            margin: '0.625rem auto 0',
          }}
        />

        {title && (
          <div
            style={{
              padding: 'var(--space-4) var(--space-6)',
              borderBottom: '1px solid var(--color-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.125rem', marginBottom: 0 }}>
                  {subtitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-default)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}

        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
