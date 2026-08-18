import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'busy' | 'offline' | 'away';
export type AvatarRole = 'customer' | 'agent' | 'admin' | 'super_admin';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  role?: AvatarRole;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'cyan';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const SIZE_MAP: Record<AvatarSize, { dimension: number; fontSize: string; statusSize: number }> = {
  xs: { dimension: 24, fontSize: '0.625rem', statusSize: 6 },
  sm: { dimension: 32, fontSize: '0.75rem', statusSize: 8 },
  md: { dimension: 40, fontSize: '0.875rem', statusSize: 10 },
  lg: { dimension: 48, fontSize: '1.125rem', statusSize: 12 },
  xl: { dimension: 64, fontSize: '1.5rem', statusSize: 14 },
};

const COLOR_GRADIENTS: Record<string, { bg: string; text: string; border: string }> = {
  blue: {
    bg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    text: '#FFFFFF',
    border: 'rgba(59, 130, 246, 0.4)',
  },
  green: {
    bg: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
    text: '#FFFFFF',
    border: 'rgba(34, 197, 94, 0.4)',
  },
  amber: {
    bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    text: '#FFFFFF',
    border: 'rgba(245, 158, 11, 0.4)',
  },
  purple: {
    bg: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    text: '#FFFFFF',
    border: 'rgba(139, 92, 246, 0.4)',
  },
  orange: {
    bg: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    text: '#FFFFFF',
    border: 'rgba(249, 115, 22, 0.4)',
  },
  cyan: {
    bg: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    text: '#FFFFFF',
    border: 'rgba(6, 182, 212, 0.4)',
  },
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  online: '#22C55E',
  busy: '#F59E0B',
  away: '#FBBF24',
  offline: '#94A3B8',
};

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getDefaultColor(name: string, role?: AvatarRole): 'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'cyan' {
  if (role === 'agent') return 'orange';
  if (role === 'admin' || role === 'super_admin') return 'purple';
  if (role === 'customer') return 'blue';

  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors: Array<'blue' | 'green' | 'amber' | 'purple' | 'orange' | 'cyan'> = ['blue', 'green', 'amber', 'purple', 'orange', 'cyan'];
  return colors[hash % colors.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status,
  role,
  color,
  className = '',
  style,
  onClick,
}) => {
  const { dimension, fontSize, statusSize } = SIZE_MAP[size];
  const colorKey = color || getDefaultColor(name, role);
  const colorStyle = COLOR_GRADIENTS[colorKey];
  const initials = getInitials(name);

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${dimension}px`,
        height: `${dimension}px`,
        borderRadius: 'var(--radius-full)',
        background: colorStyle.bg,
        color: colorStyle.text,
        fontSize,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        boxShadow: `0 2px 6px ${colorStyle.border}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
        border: `1.5px solid ${colorStyle.border}`,
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'var(--radius-full)',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span>{initials}</span>
      )}

      {status && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: `${statusSize}px`,
            height: `${statusSize}px`,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS[status],
            border: '2px solid var(--color-bg-surface)',
            boxShadow: '0 0 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      )}
    </div>
  );
};
