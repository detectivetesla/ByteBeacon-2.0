import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'hero-secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(180deg, var(--color-primary-bright) 0%, var(--color-primary) 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.20)',
          boxShadow: 'var(--shadow-tactile-btn)',
          fontWeight: 700,
        };
      case 'hero-secondary':
        return {
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
          fontWeight: 600,
        };
      case 'secondary':
        return {
          background: 'linear-gradient(180deg, var(--color-bg-surface-elevated) 0%, var(--color-bg-surface) 100%)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-tactile-sm)',
          fontWeight: 600,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'none',
          fontWeight: 600,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text-secondary)',
          border: '1px solid transparent',
          boxShadow: 'none',
          fontWeight: 600,
        };
      case 'danger':
        return {
          background: 'linear-gradient(180deg, #F87171 0%, var(--color-accent-red) 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.20)',
          boxShadow: '0 4px 14px rgba(239, 68, 68, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
          fontWeight: 700,
        };
      default:
        return {};
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          minHeight: '36px',
          padding: '0 14px',
          fontSize: 'var(--font-size-xs)',
          borderRadius: 'var(--radius-sm)',
        };
      case 'lg':
        return {
          minHeight: '48px',
          padding: '0 24px',
          fontSize: 'var(--font-size-base)',
          borderRadius: 'var(--radius-md)',
        };
      case 'md':
      default:
        return {
          minHeight: '44px',
          padding: '0 18px',
          fontSize: 'var(--font-size-sm)',
          borderRadius: 'var(--radius-sm)',
        };
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      className={`btn-tactile ${className}`}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.01em',
        userSelect: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          if (variant === 'primary') {
            e.currentTarget.style.filter = 'brightness(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px var(--color-primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.45)';
          } else if (variant === 'hero-secondary') {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.filter = 'none';
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = 'var(--shadow-tactile-btn)';
          } else if (variant === 'hero-secondary') {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
          }
        }
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(1px)';
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = '0 2px 6px var(--color-primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
          }
        }
      }}
      onMouseUp={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: '#FFFFFF',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      ) : (
        <>
          {leftIcon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
