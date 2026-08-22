import React from 'react';

export interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  } | number;
  minItemWidth?: string;
  gap?: string;
  children: React.ReactNode;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  columns,
  minItemWidth,
  gap = 'var(--space-gap-responsive, var(--space-4))',
  className = '',
  style,
  children,
  ...props
}) => {
  // If minItemWidth is provided, use CSS grid auto-fit/auto-fill
  if (minItemWidth) {
    return (
      <div
        className={`bb-responsive-grid ${className}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidth}), 1fr))`,
          gap,
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }

  const numCols = typeof columns === 'number' ? columns : undefined;
  const colConfig = typeof columns === 'object' ? columns : undefined;

  const xsCols = colConfig?.xs || 1;
  const smCols = colConfig?.sm || (numCols ? Math.min(numCols, 2) : 2);
  const mdCols = colConfig?.md || (numCols ? Math.min(numCols, 2) : 2);
  const lgCols = colConfig?.lg || (numCols ? Math.min(numCols, 3) : 3);
  const xlCols = colConfig?.xl || (numCols ? numCols : 4);

  const gridId = React.useId().replace(/:/g, '');

  return (
    <div
      id={`grid-${gridId}`}
      className={`bb-responsive-grid bb-grid-${gridId} ${className}`}
      style={{
        display: 'grid',
        gap,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      <style>{`
        .bb-grid-${gridId} {
          grid-template-columns: repeat(${xsCols}, minmax(0, 1fr));
        }
        @media (min-width: 640px) {
          .bb-grid-${gridId} {
            grid-template-columns: repeat(${smCols}, minmax(0, 1fr));
          }
        }
        @media (min-width: 768px) {
          .bb-grid-${gridId} {
            grid-template-columns: repeat(${mdCols}, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .bb-grid-${gridId} {
            grid-template-columns: repeat(${lgCols}, minmax(0, 1fr));
          }
        }
        @media (min-width: 1280px) {
          .bb-grid-${gridId} {
            grid-template-columns: repeat(${xlCols}, minmax(0, 1fr));
          }
        }
      `}</style>
      {children}
    </div>
  );
};
