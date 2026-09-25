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
        padding: 'var(--space-8) var(--space-4)',
        backgroundColor: 'transparent',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--color-border-subtle)',
        ...style,
      }}
    >
      <div style={{ marginBottom: 'var(--space-3)' }}>
        {renderIcon()}
      </div>

      <h3
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-display)',
          marginBottom: '0.25rem',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          maxWidth: '360px',
          marginBottom: actionText ? 'var(--space-4)' : 0,
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
