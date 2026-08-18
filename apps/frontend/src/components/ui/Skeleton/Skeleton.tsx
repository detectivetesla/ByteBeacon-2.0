import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  style,
  className = '',
}) => {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
};

export const NetworkCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        minHeight: '140px',
      }}
      aria-label="Loading network card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <Skeleton width="32px" height="32px" borderRadius="var(--radius-md)" />
          <Skeleton width="110px" height="20px" />
        </div>
        <Skeleton width="75px" height="18px" borderRadius="var(--radius-full)" />
      </div>
      <Skeleton width="90%" height="14px" />
      <Skeleton width="60%" height="14px" />
    </div>
  );
};

export const BundleCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        minHeight: '160px',
      }}
      aria-label="Loading bundle package"
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <Skeleton width="60px" height="24px" />
          <Skeleton width="80px" height="24px" />
        </div>
        <Skeleton width="120px" height="14px" />
      </div>
      <Skeleton width="100%" height="36px" borderRadius="var(--radius-sm)" />
    </div>
  );
};

export const OrderCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
      aria-label="Loading order tracker"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="100px" height="18px" />
        <Skeleton width="60px" height="20px" borderRadius="var(--radius-full)" />
      </div>
      <Skeleton width="80%" height="14px" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
        <Skeleton width="70px" height="16px" />
        <Skeleton width="90px" height="14px" />
      </div>
    </div>
  );
};

export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={`${100 / cols - 4}%`} height="14px" />
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
      aria-label="Loading table data"
    >
      {/* Table Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols - 4}%`} height="16px" />
        ))}
      </div>

      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </div>
  );
};

export const MetricCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
      aria-label="Loading metric card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="80px" height="14px" />
        <Skeleton width="28px" height="28px" borderRadius="var(--radius-sm)" />
      </div>
      <Skeleton width="120px" height="28px" />
      <Skeleton width="90px" height="12px" />
    </div>
  );
};

export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
        gap: 'var(--space-4)',
      }}
      aria-label="Loading stats"
    >
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }} aria-label="Loading dashboard">
      {/* Top Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Skeleton width="180px" height="28px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton width="260px" height="16px" />
        </div>
        <Skeleton width="120px" height="40px" borderRadius="var(--radius-sm)" />
      </div>

      {/* Stats Grid */}
      <StatsSkeleton count={4} />

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
        <TableSkeleton rows={4} cols={4} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Skeleton height="160px" borderRadius="var(--radius-lg)" />
          <Skeleton height="160px" borderRadius="var(--radius-lg)" />
        </div>
      </div>
    </div>
  );
};

export const StoreOverviewSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} aria-label="Loading store overview">
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Skeleton width="48px" height="48px" borderRadius="var(--radius-full)" />
          <div>
            <Skeleton width="220px" height="26px" style={{ marginBottom: '0.375rem' }} />
            <Skeleton width="160px" height="14px" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Skeleton width="100px" height="36px" borderRadius="var(--radius-sm)" />
          <Skeleton width="140px" height="36px" borderRadius="var(--radius-sm)" />
        </div>
      </div>

      {/* Period Selector & Hero Performance Section Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--space-6)' }}>
        {/* Revenue Hero Card Skeleton */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '220px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="120px" height="16px" />
            <Skeleton width="140px" height="28px" borderRadius="var(--radius-full)" />
          </div>
          <div style={{ margin: 'var(--space-4) 0' }}>
            <Skeleton width="200px" height="36px" style={{ marginBottom: '0.375rem' }} />
            <Skeleton width="160px" height="14px" />
          </div>
          <Skeleton width="100%" height="40px" borderRadius="var(--radius-sm)" />
        </div>

        {/* 3 Order Health Cards Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '140px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width="28px" height="28px" borderRadius="var(--radius-sm)" />
                <Skeleton width="36px" height="18px" borderRadius="var(--radius-full)" />
              </div>
              <div>
                <Skeleton width="40px" height="24px" style={{ marginBottom: '0.25rem' }} />
                <Skeleton width="60px" height="12px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
      aria-label="Loading profile"
    >
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
        <Skeleton width="64px" height="64px" borderRadius="var(--radius-full)" />
        <div>
          <Skeleton width="160px" height="24px" style={{ marginBottom: '0.375rem' }} />
          <Skeleton width="220px" height="16px" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
      </div>
    </div>
  );
};
