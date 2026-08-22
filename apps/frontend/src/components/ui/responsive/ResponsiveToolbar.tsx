import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ToolbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isPrimary?: boolean;
  disabled?: boolean;
}

export interface ResponsiveToolbarProps {
  primaryAction?: React.ReactNode;
  secondaryActions?: ToolbarAction[];
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveToolbar: React.FC<ResponsiveToolbarProps> = ({
  primaryAction,
  secondaryActions = [],
  className = '',
  style,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`bb-responsive-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <style>{`
        .bb-toolbar-desktop-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .bb-toolbar-mobile-dropdown-trigger {
          display: none;
        }
        @media (max-width: 639px) {
          .bb-toolbar-desktop-actions {
            display: none !important;
          }
          .bb-toolbar-mobile-dropdown-trigger {
            display: block !important;
          }
        }
      `}</style>

      {/* Primary Action always visible */}
      {primaryAction}

      {/* Desktop Secondary Actions */}
      {secondaryActions.length > 0 && (
        <div className="bb-toolbar-desktop-actions">
          {secondaryActions.map((act, i) => (
            <button
              key={i}
              type="button"
              onClick={act.onClick}
              disabled={act.disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: '1px solid var(--color-border-default)',
                backgroundColor: act.variant === 'danger' ? 'var(--color-danger-surface, rgba(239,68,68,0.1))' : 'var(--color-bg-surface)',
                color: act.variant === 'danger' ? 'var(--color-danger, #EF4444)' : 'var(--color-text-primary)',
                cursor: act.disabled ? 'not-allowed' : 'pointer',
                opacity: act.disabled ? 0.6 : 1,
              }}
            >
              {act.icon}
              {act.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Context Menu for Secondary Actions */}
      {secondaryActions.length > 0 && (
        <div className="bb-toolbar-mobile-dropdown-trigger" style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="More actions"
          >
            <MoreHorizontal size={18} />
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: '180px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-tactile-lg)',
                padding: 'var(--space-2)',
                zIndex: 100,
              }}
            >
              {secondaryActions.map((act, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    act.onClick();
                    setDropdownOpen(false);
                  }}
                  disabled={act.disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: act.variant === 'danger' ? 'var(--color-danger, #EF4444)' : 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: act.disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {act.icon}
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
