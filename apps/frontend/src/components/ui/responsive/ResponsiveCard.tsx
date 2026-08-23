import React from 'react';

export interface ResponsiveCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  accentColor?: 'brand' | 'blue' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'red' | 'indigo' | string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  subtitle,
  action,
  footer,
  accentColor,
  padding = 'md',
  className = '',
  style,
  children,
  ...props
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return 'var(--space-3, 0.75rem)';
      case 'lg': return 'var(--space-6, 1.5rem)';
      case 'md':
      default:
        return 'var(--space-card-p, clamp(0.875rem, 2vw, 1.5rem))';
    }
  };

  const getAccentBorder = () => {
    if (!accentColor) return '1px solid var(--color-border-default)';
    switch (accentColor) {
      case 'brand':
      case 'emerald': return '1px solid rgba(16, 185, 129, 0.35)';
      case 'blue': return '1px solid rgba(59, 130, 246, 0.35)';
      case 'purple':
      case 'indigo': return '1px solid rgba(139, 92, 246, 0.35)';
      case 'amber': return '1px solid rgba(245, 158, 11, 0.35)';
      case 'cyan': return '1px solid rgba(6, 182, 212, 0.35)';
      case 'red': return '1px solid rgba(239, 68, 68, 0.35)';
      default: return `1px solid ${accentColor}`;
    }
  };

  return (
    <div
      className={`bb-responsive-card ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: getAccentBorder(),
        borderRadius: 'var(--radius-xl, 20px)',
        boxShadow: 'var(--shadow-tactile-sm)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      {/* Header Slot */}
      {(title || subtitle || action) && (
        <div
          style={{
            padding: getPadding(),
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <div
                style={{
                  fontSize: 'var(--font-size-base, 1rem)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  overflowWrap: 'break-word',
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: 'var(--font-size-xs, 0.75rem)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '0.15rem',
                  overflowWrap: 'break-word',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}

      {/* Card Content Body */}
      <div style={{ padding: getPadding(), flex: 1, minWidth: 0 }}>
        {children}
      </div>

      {/* Footer Slot */}
      {footer && (
        <div
          style={{
            padding: getPadding(),
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
