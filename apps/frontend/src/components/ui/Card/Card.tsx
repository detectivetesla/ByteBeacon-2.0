import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'accent' | 'feature';
export type CardAccentColor = 'brand' | 'blue' | 'amber' | 'green' | 'purple' | 'cyan' | 'orange' | 'red';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glass?: boolean;
  variant?: CardVariant;
  accentColor?: CardAccentColor;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevated = false,
  bordered = true,
  padding = 'md',
  glass = false,
  variant = 'default',
  accentColor,
  className = '',
  style,
  ...props
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return 'clamp(0.5rem, 1.5vw, var(--space-3))';
      case 'md':
        return 'var(--space-card-p, var(--space-5))';
      case 'lg':
        return 'clamp(1.125rem, 2.5vw + 0.25rem, var(--space-8))';
    }
  };

  const getAccentStyles = () => {
    if (!accentColor) return {};
    switch (accentColor) {
      case 'blue':
        return {
          backgroundColor: 'var(--color-info-surface)',
          borderColor: 'var(--color-info-border)',
        };
      case 'amber':
        return {
          backgroundColor: 'var(--color-warning-surface)',
          borderColor: 'var(--color-warning-border)',
        };
      case 'green':
      case 'brand':
        return {
          backgroundColor: 'var(--color-brand-surface)',
          borderColor: 'var(--color-brand-border)',
        };
      case 'purple':
        return {
          backgroundColor: 'var(--color-api-surface)',
          borderColor: 'var(--color-api-border)',
        };
      case 'cyan':
        return {
          backgroundColor: 'var(--color-analytics-surface)',
          borderColor: 'var(--color-analytics-border)',
        };
      case 'orange':
        return {
          backgroundColor: 'var(--color-agent-surface)',
          borderColor: 'var(--color-agent-border)',
        };
      case 'red':
        return {
          backgroundColor: 'var(--color-danger-surface)',
          borderColor: 'var(--color-danger-border)',
        };
    }
  };

  const getBackgroundAndShadow = () => {
    if (glass) {
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
      };
    }

    if (variant === 'feature') {
      return {
        background: 'linear-gradient(145deg, #0A1020 0%, #060A14 100%)',
        color: '#FFFFFF',
        boxShadow: 'var(--shadow-tactile-lg)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
      };
    }

    if (variant === 'accent' || accentColor) {
      return {
        boxShadow: 'var(--shadow-tactile-sm)',
        border: bordered ? '1px solid var(--color-border-default)' : 'none',
        ...getAccentStyles(),
      };
    }

    if (elevated || variant === 'elevated') {
      return {
        background: 'linear-gradient(145deg, var(--color-bg-surface-elevated) 0%, var(--color-bg-surface) 100%)',
        boxShadow: 'var(--shadow-tactile-md)',
        border: bordered ? '1px solid var(--color-border-default)' : 'none',
      };
    }

    return {
      background: 'linear-gradient(145deg, var(--color-bg-surface-elevated) 0%, var(--color-bg-surface) 100%)',
      boxShadow: 'var(--shadow-tactile-sm)',
      border: bordered ? '1px solid var(--color-border-default)' : 'none',
    };
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: getPadding(),
        maxWidth: '100%',
        boxSizing: 'border-box',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast)',
        position: 'relative',
        ...getBackgroundAndShadow(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  accent?: 'green' | 'cyan' | 'amber' | 'violet' | 'red' | 'blue' | 'orange' | 'purple';
  variant?: CardVariant;
  style?: React.CSSProperties;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  accent,
  variant = 'default',
  style,
}) => {
  const mapAccentToCardAccent = (a?: string): CardAccentColor | undefined => {
    if (!a) return undefined;
    if (a === 'violet') return 'purple';
    return a as CardAccentColor;
  };

  return (
    <Card
      elevated
      variant={variant}
      accentColor={mapAccentToCardAccent(accent)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '120px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </span>
        {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 800,
            fontFamily: 'var(--font-data)',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>

        {(subtitle || trend) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)' }}>
            {trend && (
              <span
                style={{
                  fontSize: 'var(--font-size-2xs)',
                  fontWeight: 700,
                  color: trend.isPositive ? 'var(--color-status-success)' : 'var(--color-status-failed)',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {subtitle && (
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
