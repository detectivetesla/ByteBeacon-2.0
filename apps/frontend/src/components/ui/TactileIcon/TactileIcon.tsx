import React from 'react';
import { LucideIcon } from 'lucide-react';

export type TactileIconColor =
  | 'speed'
  | 'security'
  | 'payments'
  | 'analytics'
  | 'api'
  | 'support'
  | 'wallet'
  | 'orders'
  | 'primary'
  | 'emerald'
  | 'cyan'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'red'
  | 'mtn'
  | 'telecel'
  | 'airteltigo';

export type TactileIconSize = 'sm' | 'md' | 'lg' | 'xl';

export interface TactileIconProps {
  icon: LucideIcon;
  color?: TactileIconColor;
  size?: TactileIconSize;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

interface ColorStyleConfig {
  bgGradient: string;
  border: string;
  iconGradient: string;
  iconColor: string;
  shadow: string;
  innerHighlight: string;
}

const COLOR_CONFIGS: Record<TactileIconColor, ColorStyleConfig> = {
  speed: {
    bgGradient: 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(234, 88, 12, 0.08) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    iconGradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
    iconColor: '#EA580C',
    shadow: '0 4px 12px rgba(234, 88, 12, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  security: {
    bgGradient: 'linear-gradient(145deg, rgba(22, 163, 74, 0.16) 0%, rgba(5, 150, 105, 0.08) 100%)',
    border: '1px solid rgba(22, 163, 74, 0.35)',
    iconGradient: 'linear-gradient(135deg, #16A34A 0%, #059669 100%)',
    iconColor: '#16A34A',
    shadow: '0 4px 12px rgba(22, 163, 74, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  payments: {
    bgGradient: 'linear-gradient(145deg, rgba(139, 92, 246, 0.16) 0%, rgba(99, 102, 241, 0.08) 100%)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    iconGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
    iconColor: '#8B5CF6',
    shadow: '0 4px 12px rgba(139, 92, 246, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  analytics: {
    bgGradient: 'linear-gradient(145deg, rgba(6, 182, 212, 0.16) 0%, rgba(2, 132, 199, 0.08) 100%)',
    border: '1px solid rgba(6, 182, 212, 0.35)',
    iconGradient: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
    iconColor: '#0284C7',
    shadow: '0 4px 12px rgba(6, 182, 212, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  api: {
    bgGradient: 'linear-gradient(145deg, rgba(168, 85, 247, 0.16) 0%, rgba(126, 34, 206, 0.08) 100%)',
    border: '1px solid rgba(168, 85, 247, 0.35)',
    iconGradient: 'linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)',
    iconColor: '#9333EA',
    shadow: '0 4px 12px rgba(168, 85, 247, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  support: {
    bgGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.16) 0%, rgba(4, 120, 87, 0.08) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    iconGradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    iconColor: '#059669',
    shadow: '0 4px 12px rgba(16, 185, 129, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  wallet: {
    bgGradient: 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    iconGradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    iconColor: '#D97706',
    shadow: '0 4px 12px rgba(245, 158, 11, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  orders: {
    bgGradient: 'linear-gradient(145deg, rgba(59, 130, 246, 0.16) 0%, rgba(29, 78, 216, 0.08) 100%)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    iconGradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    iconColor: '#2563EB',
    shadow: '0 4px 12px rgba(59, 130, 246, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  primary: {
    bgGradient: 'linear-gradient(145deg, rgba(22, 163, 74, 0.16) 0%, rgba(22, 163, 74, 0.06) 100%)',
    border: '1px solid rgba(22, 163, 74, 0.32)',
    iconGradient: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
    iconColor: 'var(--color-primary)',
    shadow: '0 4px 12px rgba(22, 163, 74, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  emerald: {
    bgGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.16) 0%, rgba(4, 120, 87, 0.08) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    iconGradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    iconColor: '#059669',
    shadow: '0 4px 12px rgba(16, 185, 129, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  cyan: {
    bgGradient: 'linear-gradient(145deg, rgba(6, 182, 212, 0.16) 0%, rgba(2, 132, 199, 0.08) 100%)',
    border: '1px solid rgba(6, 182, 212, 0.35)',
    iconGradient: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
    iconColor: '#0284C7',
    shadow: '0 4px 12px rgba(6, 182, 212, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  indigo: {
    bgGradient: 'linear-gradient(145deg, rgba(99, 102, 241, 0.16) 0%, rgba(79, 70, 229, 0.08) 100%)',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    iconGradient: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
    iconColor: '#6366F1',
    shadow: '0 4px 12px rgba(99, 102, 241, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  violet: {
    bgGradient: 'linear-gradient(145deg, rgba(139, 92, 246, 0.16) 0%, rgba(109, 40, 217, 0.08) 100%)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    iconGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    iconColor: '#8B5CF6',
    shadow: '0 4px 12px rgba(139, 92, 246, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  amber: {
    bgGradient: 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    iconGradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    iconColor: '#D97706',
    shadow: '0 4px 12px rgba(245, 158, 11, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  red: {
    bgGradient: 'linear-gradient(145deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.08) 100%)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    iconGradient: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    iconColor: '#DC2626',
    shadow: '0 4px 12px rgba(239, 68, 68, 0.18)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },
  mtn: {
    bgGradient: 'linear-gradient(145deg, rgba(255, 204, 0, 0.22) 0%, rgba(212, 160, 0, 0.10) 100%)',
    border: '1px solid rgba(255, 204, 0, 0.50)',
    iconGradient: 'linear-gradient(135deg, #D4A000 0%, #A17900 100%)',
    iconColor: '#A17900',
    shadow: '0 4px 14px rgba(255, 204, 0, 0.25)',
    innerHighlight: 'rgba(255, 255, 255, 0.9)',
  },
  telecel: {
    bgGradient: 'linear-gradient(145deg, rgba(231, 25, 45, 0.20) 0%, rgba(196, 18, 35, 0.10) 100%)',
    border: '1px solid rgba(231, 25, 45, 0.45)',
    iconGradient: 'linear-gradient(135deg, #E7192D 0%, #C41223 100%)',
    iconColor: '#E7192D',
    shadow: '0 4px 14px rgba(231, 25, 45, 0.25)',
    innerHighlight: 'rgba(255, 255, 255, 0.9)',
  },
  airteltigo: {
    bgGradient: 'linear-gradient(145deg, rgba(0, 102, 178, 0.20) 0%, rgba(0, 77, 133, 0.10) 100%)',
    border: '1px solid rgba(0, 102, 178, 0.45)',
    iconGradient: 'linear-gradient(135deg, #0066B2 0%, #004D85 100%)',
    iconColor: '#0066B2',
    shadow: '0 4px 14px rgba(0, 102, 178, 0.25)',
    innerHighlight: 'rgba(255, 255, 255, 0.9)',
  },
};

const SIZE_CONFIGS: Record<
  TactileIconSize,
  {
    containerSize: number;
    iconSize: number;
    radius: string;
  }
> = {
  sm: {
    containerSize: 36,
    iconSize: 18,
    radius: 'var(--radius-sm)',
  },
  md: {
    containerSize: 46,
    iconSize: 22,
    radius: 'var(--radius-md)',
  },
  lg: {
    containerSize: 56,
    iconSize: 28,
    radius: 'var(--radius-lg)',
  },
  xl: {
    containerSize: 68,
    iconSize: 36,
    radius: 'var(--radius-xl)',
  },
};

export const TactileIcon: React.FC<TactileIconProps> = ({
  icon: Icon,
  color = 'primary',
  size = 'md',
  strokeWidth = 2.6,
  className = '',
  style,
  'aria-label': ariaLabel,
}) => {
  const colorCfg = COLOR_CONFIGS[color] || COLOR_CONFIGS.primary;
  const sizeCfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  return (
    <div
      className={className}
      aria-label={ariaLabel}
      style={{
        width: `${sizeCfg.containerSize}px`,
        height: `${sizeCfg.containerSize}px`,
        borderRadius: sizeCfg.radius,
        background: colorCfg.bgGradient,
        border: colorCfg.border,
        boxShadow: `${colorCfg.shadow}, inset 0 1px 0 ${colorCfg.innerHighlight}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
        ...style,
      }}
    >
      <Icon
        size={sizeCfg.iconSize}
        strokeWidth={strokeWidth}
        color={colorCfg.iconColor}
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12))',
          display: 'block',
        }}
      />
    </div>
  );
};
