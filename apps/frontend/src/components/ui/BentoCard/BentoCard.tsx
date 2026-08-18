import React from 'react';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: number;
  rowSpan?: number;
  accent?: 'green' | 'cyan' | 'indigo' | 'amber' | 'violet' | 'emerald' | 'none';
  tag?: string;
  tagBg?: string;
  tagColor?: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  colSpan = 4,
  rowSpan = 1,
  accent = 'none',
  tag,
  tagBg,
  tagColor,
  title,
  subtitle,
  headerAction,
  footer,
  interactive = false,
  className = '',
  style,
  ...props
}) => {
  const getAccentBorder = () => {
    switch (accent) {
      case 'green':
        return 'rgba(132, 204, 22, 0.35)';
      case 'cyan':
        return 'rgba(6, 182, 212, 0.35)';
      case 'indigo':
        return 'rgba(99, 102, 241, 0.35)';
      case 'violet':
        return 'rgba(139, 92, 246, 0.35)';
      case 'amber':
        return 'rgba(245, 158, 11, 0.35)';
      case 'emerald':
        return 'rgba(16, 185, 129, 0.35)';
      case 'none':
      default:
        return 'var(--color-border-default)';
    }
  };

  const getAccentGlow = () => {
    switch (accent) {
      case 'green':
        return '0 0 20px rgba(132, 204, 22, 0.08)';
      case 'cyan':
        return '0 0 20px rgba(6, 182, 212, 0.08)';
      case 'indigo':
        return '0 0 20px rgba(99, 102, 241, 0.08)';
      case 'violet':
        return '0 0 20px rgba(139, 92, 246, 0.08)';
      case 'none':
      default:
        return 'none';
    }
  };

  return (
    <div
      className={`bento-card ${className}`}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        backgroundColor: 'var(--color-bg-surface)',
        border: `1px solid ${getAccentBorder()}`,
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        boxShadow: getAccentGlow(),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'all var(--transition-normal)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = 'var(--color-border-hover)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = getAccentBorder();
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      {...props}
    >
      <div>
        {/* Header with Tag or Actions */}
        {(tag || headerAction) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            {tag ? (
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: tagBg || 'rgba(148, 163, 184, 0.12)',
                  color: tagColor || 'var(--color-text-secondary)',
                }}
              >
                {tag}
              </span>
            ) : <div />}

            {headerAction}
          </div>
        )}

        {/* Title & Subtitle */}
        {title && (
          <h3
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 'var(--line-height-snug)',
            }}
          >
            {title}
          </h3>
        )}

        {subtitle && (
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: '0.375rem',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Body Content */}
        <div style={{ marginTop: title || subtitle ? 'var(--space-4)' : 0 }}>
          {children}
        </div>
      </div>

      {/* Footer Area */}
      {footer && (
        <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          {footer}
        </div>
      )}
    </div>
  );
};
