import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ResponsivePageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'fluid';
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsivePage: React.FC<ResponsivePageProps> = ({
  title,
  subtitle,
  icon,
  badge,
  actions,
  breadcrumbs,
  children,
  maxWidth = '2xl',
  className = '',
  style,
}) => {
  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'sm': return 'var(--container-sm, 640px)';
      case 'md': return 'var(--container-md, 768px)';
      case 'lg': return 'var(--container-lg, 1024px)';
      case 'xl': return 'var(--container-xl, 1200px)';
      case '2xl': return 'var(--container-2xl, 1360px)';
      case 'fluid': return '100%';
      default: return 'var(--container-2xl, 1360px)';
    }
  };

  return (
    <div
      className={`bb-responsive-page ${className}`}
      style={{
        width: '100%',
        maxWidth: getMaxWidth(),
        marginInline: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-gap-responsive, var(--space-6))',
        ...style,
      }}
    >
      <style>{`
        .bb-page-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        @media (min-width: 768px) {
          .bb-page-header {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }
        .bb-page-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        @media (max-width: 639px) {
          .bb-page-actions {
            width: 100%;
            justify-content: stretch;
          }
          .bb-page-actions > * {
            flex: 1 1 auto;
          }
        }
      `}</style>

      {/* Breadcrumbs if present */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ opacity: 0.5 }}>/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  style={{
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                >
                  {crumb.label}
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header with Title, Icon, Badge, and Actions */}
      <header className="bb-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', minWidth: 0, flex: 1 }}>
          {icon && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', marginTop: '2px' }}>
              {icon}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h1
                style={{
                  fontSize: 'var(--font-size-title-1, clamp(1.375rem, 2.5vw + 0.625rem, 2.25rem))',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  margin: 0,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                }}
              >
                {title}
              </h1>
              {badge && <div style={{ display: 'inline-flex', alignItems: 'center' }}>{badge}</div>}
            </div>

            {subtitle && (
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  lineHeight: 1.45,
                  overflowWrap: 'break-word',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="bb-page-actions">{actions}</div>}
      </header>

      {/* Main Page Content */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-gap-responsive, var(--space-6))', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};
