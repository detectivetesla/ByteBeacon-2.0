import React from 'react';

export interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'fluid';
  padding?: boolean;
  children: React.ReactNode;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  maxWidth = '2xl',
  padding = true,
  className = '',
  style,
  children,
  ...props
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
      className={`bb-responsive-container ${className}`}
      style={{
        width: '100%',
        maxWidth: getMaxWidth(),
        marginInline: 'auto',
        paddingInline: padding ? 'var(--space-page-x, clamp(0.875rem, 3vw, 2rem))' : 0,
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
