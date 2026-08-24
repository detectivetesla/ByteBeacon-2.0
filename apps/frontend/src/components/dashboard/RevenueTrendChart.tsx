import React, { useState } from 'react';
import { Card } from '../ui/Card/Card.js';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import { PackageOpen, Wallet } from 'lucide-react';

export type ChartPeriod = '7D' | '30D' | '90D' | '1Y';

export interface RevenueDataPoint {
  label: string;
  revenue: number; // in cedis
  orders: number;
}

export interface PeriodStats {
  label: string;
  revenueDisplay: string;
  orderCount: number;
  trendDisplay: string;
  points: RevenueDataPoint[];
}

export interface RevenueTrendChartProps {
  data?: Partial<Record<ChartPeriod, PeriodStats>>;
  initialPeriod?: ChartPeriod;
  onPeriodChange?: (period: ChartPeriod) => void;
  title?: string;
  style?: React.CSSProperties;
}

const EMPTY_DATA: Record<ChartPeriod, PeriodStats> = {
  '7D': {
    label: '7 days',
    revenueDisplay: 'GH₵ 0.00',
    orderCount: 0,
    trendDisplay: '0.0%',
    points: [],
  },
  '30D': {
    label: '30 days',
    revenueDisplay: 'GH₵ 0.00',
    orderCount: 0,
    trendDisplay: '0.0%',
    points: [],
  },
  '90D': {
    label: '90 days',
    revenueDisplay: 'GH₵ 0.00',
    orderCount: 0,
    trendDisplay: '0.0%',
    points: [],
  },
  '1Y': {
    label: '12 months',
    revenueDisplay: 'GH₵ 0.00',
    orderCount: 0,
    trendDisplay: '0.0%',
    points: [],
  },
};

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data,
  initialPeriod = '30D',
  onPeriodChange,
  title = 'Revenue',
  style,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>(initialPeriod);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeStats = data?.[selectedPeriod] || EMPTY_DATA[selectedPeriod];
  const points = activeStats.points || [];
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const hasSales = activeStats.orderCount > 0 && points.length > 0 && points.some((p) => p.revenue > 0);


  const handlePeriodClick = (p: ChartPeriod) => {
    setSelectedPeriod(p);
    onPeriodChange?.(p);
  };

  // Generate SVG smooth bezier path
  const svgWidth = 420;
  const svgHeight = 110;
  const paddingX = 20;
  const paddingY = 16;

  const getCoordinates = () => {
    if (points.length === 0) return [];
    return points.map((p, idx) => {
      const x = paddingX + (idx / Math.max(points.length - 1, 1)) * (svgWidth - paddingX * 2);
      const y = svgHeight - paddingY - (p.revenue / maxRevenue) * (svgHeight - paddingY * 2);
      return { x, y, ...p };
    });
  };

  const coords = getCoordinates();

  const generateLinePath = () => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cx = (curr.x + next.x) / 2;
      path += ` C ${cx} ${curr.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const linePath = generateLinePath();
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} ${svgHeight} L ${coords[0].x} ${svgHeight} Z`
    : '';

  return (
    <Card
      elevated
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
        boxShadow: 'var(--shadow-tactile-md)',
        ...style,
      }}
    >
      <div>
        {/* Top Row: Title, Period Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TactileIcon icon={Wallet} color="security" size="sm" />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {title}
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
            }}
          >
            {(['7D', '30D', '90D', '1Y'] as ChartPeriod[]).map((period) => {
              const isSelected = selectedPeriod === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => handlePeriodClick(period)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: isSelected ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--color-info-surface)' : 'transparent',
                    color: isSelected ? 'var(--color-info)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {period}
                </button>
              );
            })}
          </div>
        </div>

        {/* Revenue Value & Compact Trend Badge */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {activeStats.revenueDisplay}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              {activeStats.label}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 800,
                color: 'var(--color-success)',
                backgroundColor: 'var(--color-success-surface)',
                border: '1px solid var(--color-success-border)',
                padding: '0.1rem 0.4rem',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {activeStats.trendDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart Area */}
      {hasSales ? (
        <div style={{ position: 'relative', width: '100%', height: `${svgHeight}px`, marginTop: 'var(--space-2)' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="revAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                <stop offset="70%" stopColor="#06B6D4" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="revLineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>

            {/* Subtle Grid Lines */}
            <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="3 3" />

            {/* Area Fill */}
            <path d={areaPath} fill="url(#revAreaGradient)" />

            {/* Line Curve */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#revLineGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Data Points */}
            {coords.map((c, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <g key={c.label}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isHovered ? 5 : 3.5}
                    fill={isHovered ? '#06B6D4' : 'var(--color-bg-surface)'}
                    stroke="#2563EB"
                    strokeWidth={isHovered ? 2.5 : 2}
                    style={{ cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {/* Bottom Label */}
                  <text
                    x={c.x}
                    y={svgHeight}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="var(--font-sans)"
                  >
                    {c.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Float */}
          {hoveredIndex !== null && coords[hoveredIndex] && (
            <div
              style={{
                position: 'absolute',
                left: `${(coords[hoveredIndex].x / svgWidth) * 100}%`,
                top: `${(coords[hoveredIndex].y / svgHeight) * 100}%`,
                transform: 'translate(-50%, -120%)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-hover)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-tactile-lg)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              GH₵ {coords[hoveredIndex].revenue.toLocaleString()} · {coords[hoveredIndex].orders} orders
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
          <PackageOpen size={24} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2)' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            No sales recorded yet
          </span>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.15rem' }}>
            0 orders in selected window
          </span>
        </div>
      )}
    </Card>
  );
};
