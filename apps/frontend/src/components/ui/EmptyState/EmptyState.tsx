import React from 'react';
import { Button } from '../Button/Button.js';
import { TactileIcon, TactileIconColor } from '../TactileIcon/TactileIcon.js';
import { PackageOpen, LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon | React.ReactNode;
  color?: 'orders' | 'wallet' | 'api' | 'security' | 'speed' | 'analytics';
  actionText?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No orders yet',
  description = 'Your completed purchases will appear here.',
  icon,
  color = 'orders',
  actionText,
  onAction,
  style,
}) => {
  const renderIcon = () => {
    if (!icon) {
      return <TactileIcon icon={PackageOpen} color={color as TactileIconColor} size="lg" />;
    }
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return <TactileIcon icon={IconComponent} color={color as TactileIconColor} size="lg" />;
    }
    return icon;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-6)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px dashed var(--color-border-hover)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-tactile-sm)',
        ...style,
      }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        {renderIcon()}
      </div>

      <h3
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-display)',
          marginBottom: '0.375rem',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          maxWidth: '380px',
          marginBottom: actionText ? 'var(--space-6)' : 0,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {actionText && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
