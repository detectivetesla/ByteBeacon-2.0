import React, { useState } from 'react';
import { Card } from '../ui/Card/Card.js';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import { ShieldCheck, Info } from 'lucide-react';

export interface OrderHealthData {
  delivered: number;
  pending: number;
  failed: number;
  total?: number;
}

export interface OrderHealthProgressBarProps {
  data: OrderHealthData;
  title?: string;
  badgeLabel?: string;
  tooltipText?: string;
  style?: React.CSSProperties;
}

export const OrderHealthProgressBar: React.FC<OrderHealthProgressBarProps> = ({
  data,
  title = 'Order Health',
  badgeLabel = 'Live',
  tooltipText = 'Shows the proportion of delivered, queued, and failed orders across telecom carriers.',
  style,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const total = data.total !== undefined ? data.total : (data.delivered + data.pending + data.failed);

  // Safe percentage calculation avoiding NaN / Infinity on 0 orders
  const deliveredPct = total > 0 ? (data.delivered / total) * 100 : 0;
  const pendingPct = total > 0 ? (data.pending / total) * 100 : 0;
  const failedPct = total > 0 ? (data.failed / total) * 100 : 0;

  const deliveredDisplay = total > 0 ? `${deliveredPct.toFixed(1)}%` : '0%';
  const pendingDisplay = total > 0 ? `${pendingPct.toFixed(1)}%` : '0%';
  const failedDisplay = total > 0 ? `${failedPct.toFixed(1)}%` : '0%';

  return (
    <Card
      elevated
      style={{
        padding: 'var(--space-card-p, var(--space-6))',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
        boxShadow: 'var(--shadow-tactile-md)',
        position: 'relative',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...style,
      }}
    >
      <style>{`
        .health-legend-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
          gap: var(--space-2);
          padding-top: var(--space-1);
        }
        @media (max-width: 420px) {
          .health-legend-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      {/* Header Row: Title, Live Pill, Tooltip, and Total Orders */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <TactileIcon icon={ShieldCheck} color="security" size="sm" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                {title}
              </h3>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-brand-surface)',
                  border: '1px solid var(--color-brand-border)',
                  color: 'var(--color-brand)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {badgeLabel}
              </span>

              {/* Tooltip Trigger */}
              <div
                style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
              >
                <Info size={14} style={{ color: 'var(--color-text-muted)', transition: 'color var(--transition-fast)' }} />
                {showTooltip && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 'calc(100% + 6px)',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border-hover)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--font-size-2xs)',
                      color: 'var(--color-text-primary)',
                      maxWidth: 'min(260px, 80vw)',
                      width: 'max-content',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      boxShadow: 'var(--shadow-tactile-lg)',
                      zIndex: 50,
                      pointerEvents: 'none',
                    }}
                  >
                    {tooltipText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Prominent Order Total */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', lineHeight: 1 }}>
            {total} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Orders</span>
          </div>
        </div>
      </div>

      {/* Visually Dominant Segmented Fulfillment Bar (18px Height, 999px Radius) */}
      <div
        style={{
          width: '100%',
          height: '18px',
          backgroundColor: 'var(--color-bg-base)',
          borderRadius: '999px',
          padding: '2px',
          display: 'flex',
          gap: '2px',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.25)',
        }}
      >
        {total === 0 ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: '999px',
            }}
          />
        ) : (
          <>
            {/* Delivered Segment */}
            {deliveredPct > 0 && (
              <div
                style={{
                  width: `${deliveredPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #16A34A 0%, #22C55E 100%)',
                  borderRadius: pendingPct === 0 && failedPct === 0 ? '999px' : '999px 0 0 999px',
                  transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)',
                }}
                title={`Delivered: ${data.delivered} (${deliveredDisplay})`}
              />
            )}

            {/* Pending Segment */}
            {pendingPct > 0 && (
              <div
                style={{
                  width: `${pendingPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)',
                  borderRadius: deliveredPct === 0 && failedPct === 0 ? '999px' : '0',
                  transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)',
                }}
                title={`Pending: ${data.pending} (${pendingDisplay})`}
              />
            )}

            {/* Failed Segment */}
            {failedPct > 0 && (
              <div
                style={{
                  width: `${failedPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #DC2626 0%, #F43F5E 100%)',
                  borderRadius: deliveredPct === 0 && pendingPct === 0 ? '999px' : '0 999px 999px 0',
                  transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.3)',
                }}
                title={`Failed: ${data.failed} (${failedDisplay})`}
              />
            )}
          </>
        )}
      </div>

      {/* Order Health Legend (Clean, Compact, Responsive Grid with Zero Paragraph Clutter) */}
      <div className="health-legend-grid">
        {/* Delivered Item */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-bg-base)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Delivered</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>{data.delivered}</strong>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 800 }}>({deliveredDisplay})</span>
          </div>
        </div>

        {/* Pending Item */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-bg-base)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Pending</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>{data.pending}</strong>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-warning)', fontWeight: 800 }}>({pendingDisplay})</span>
          </div>
        </div>

        {/* Failed Item */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-bg-base)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Failed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>{data.failed}</strong>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-danger)', fontWeight: 800 }}>({failedDisplay})</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
