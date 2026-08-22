import React from 'react';

export interface ResponsiveStatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  subtitle?: string;
  accentColor?: 'brand' | 'blue' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'red' | 'indigo' | string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveStatCard: React.FC<ResponsiveStatCardProps> = ({
  label,
  value,
  icon,
  trend,
  subtitle,
  accentColor = 'brand',
  onClick,
  className = '',
  style,
}) => {
  const getAccentBorder = () => {
    switch (accentColor) {
      case 'brand':
      case 'emerald': return '1px solid rgba(16, 185, 129, 0.3)';
      case 'blue': return '1px solid rgba(59, 130, 246, 0.3)';
      case 'purple':
      case 'indigo': return '1px solid rgba(139, 92, 246, 0.3)';
      case 'amber': return '1px solid rgba(245, 158, 11, 0.3)';
      case 'cyan': return '1px solid rgba(6, 182, 212, 0.3)';
      case 'red': return '1px solid rgba(239, 68, 68, 0.3)';
      default: return `1px solid ${accentColor}`;
    }
  };

  const getAccentBg = () => {
    switch (accentColor) {
      case 'brand':
      case 'emerald': return 'rgba(16, 185, 129, 0.05)';
      case 'blue': return 'rgba(59, 130, 246, 0.05)';
      case 'purple':
      case 'indigo': return 'rgba(139, 92, 246, 0.05)';
      case 'amber': return 'rgba(245, 158, 11, 0.05)';
      case 'cyan': return 'rgba(6, 182, 212, 0.05)';
      case 'red': return 'rgba(239, 68, 68, 0.05)';
      default: return 'transparent';
    }
  };

  return (
    <div
      className={`bb-responsive-stat-card ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        backgroundImage: `linear-gradient(135deg, ${getAccentBg()} 0%, transparent 60%)`,
        border: getAccentBorder(),
        borderRadius: 'var(--radius-xl, 20px)',
        padding: 'var(--space-card-p, clamp(0.875rem, 2vw, 1.5rem))',
        boxShadow: 'var(--shadow-tactile-sm)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Top row: Label + Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
        <span
          style={{
            fontSize: 'var(--font-size-xs, 0.75rem)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {icon && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</div>}
      </div>

      {/* Middle row: Big Metric Value */}
      <div
        style={{
          fontSize: 'var(--font-size-kpi, clamp(1.5rem, 3vw + 0.5rem, 2.25rem))',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: 'var(--space-2)',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>

      {/* Bottom row: Trend badge or subtitle */}
      {(trend || subtitle) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.375rem', marginTop: 'var(--space-1)' }}>
          {trend && (
            <span
              style={{
                fontSize: 'var(--font-size-3xs, 0.625rem)',
                fontWeight: 700,
                padding: '0.125rem 0.375rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: trend.isPositive
                  ? 'var(--color-success-surface, rgba(16, 185, 129, 0.12))'
                  : 'var(--color-danger-surface, rgba(239, 68, 68, 0.12))',
                color: trend.isPositive ? 'var(--color-success, #10B981)' : 'var(--color-danger, #EF4444)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: 'var(--font-size-2xs, 0.6875rem)', color: 'var(--color-text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
