import React from 'react';

export interface ResponsiveChartProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  height?: number | string;
  minHeight?: number;
  accessibleSummary?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveChart: React.FC<ResponsiveChartProps> = ({
  title,
  subtitle,
  action,
  height = 240,
  minHeight = 160,
  accessibleSummary,
  children,
  className = '',
  style,
}) => {
  return (
    <div
      className={`bb-responsive-chart-container ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-card-p, clamp(0.875rem, 2vw, 1.5rem))',
        boxShadow: 'var(--shadow-tactile-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style,
      }}
    >
      <style>{`
        .bb-chart-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .bb-chart-viewport {
          width: 100%;
          position: relative;
          min-height: ${minHeight}px;
          height: ${typeof height === 'number' ? `${height}px` : height};
          overflow: hidden;
        }
        @media (max-width: 639px) {
          .bb-chart-viewport {
            height: ${typeof height === 'number' ? `${Math.max(minHeight, height * 0.75)}px` : height};
          }
        }
      `}</style>

      {(title || subtitle || action) && (
        <div className="bb-chart-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <h4
                style={{
                  fontSize: 'var(--font-size-base, 1rem)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  margin: 0,
                  overflowWrap: 'break-word',
                }}
              >
                {title}
              </h4>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs, 0.75rem)',
                  color: 'var(--color-text-secondary)',
                  margin: '0.15rem 0 0 0',
                  overflowWrap: 'break-word',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}

      {/* Accessible text summary for assistive technology */}
      {accessibleSummary && (
        <div className="sr-only" aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          {accessibleSummary}
        </div>
      )}

      {/* Chart Viewport */}
      <div className="bb-chart-viewport">
        {children}
      </div>
    </div>
  );
};
