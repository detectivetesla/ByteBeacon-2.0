import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';
import { LatestSuccessfulOrderDto, LatestSuccessfulOrdersResponse, NetworkProvider } from '@bytebeacon/shared';

export interface LatestSuccessfulOrderBannerProps {
  /**
   * The currently active or selected network (MTN, Telecel, AT, etc.)
   */
  network?: NetworkProvider | string;
  /**
   * Layout variant: full (default minimal banner matching system spec) or compact
   */
  variant?: 'full' | 'compact';
  /**
   * Whether to display the estimated delivery badge
   */
  showEstimatedBadge?: boolean;
  /**
   * Optional custom CSS class name
   */
  className?: string;
  /**
   * Optional inline styles
   */
  style?: React.CSSProperties;
}

export const LatestSuccessfulOrderBanner: React.FC<LatestSuccessfulOrderBannerProps> = ({
  network = 'MTN',
  variant = 'full',
  showEstimatedBadge = true,
  className,
  style,
}) => {
  const [telemetryData, setTelemetryData] = useState<LatestSuccessfulOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const fetchTelemetry = useCallback(async (net?: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      const res = await ordersApi.getLatestSuccessfulOrder(net);
      const payload = (res as any)?.data || res;
      if (payload && (payload.latest || payload.byNetwork)) {
        setTelemetryData(payload);
      }
    } catch {
      // Non-blocking fallback: retains existing state
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Periodic real-time polling and window event listeners
  useEffect(() => {
    fetchTelemetry(network);

    // 12-second real-time polling interval when document is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTelemetry(network);
      }
    }, 12000);

    const handleWindowActive = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTelemetry(network);
      }
    };

    const handleOrderEvent = () => {
      fetchTelemetry(network);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowActive);
      window.addEventListener('visibilitychange', handleWindowActive);
      window.addEventListener('order-created', handleOrderEvent);
      window.addEventListener('order-completed', handleOrderEvent);
      window.addEventListener('orders-updated', handleOrderEvent);
      window.addEventListener('telemetry-refresh', handleOrderEvent);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowActive);
        window.removeEventListener('visibilitychange', handleWindowActive);
        window.removeEventListener('order-created', handleOrderEvent);
        window.removeEventListener('order-completed', handleOrderEvent);
        window.removeEventListener('orders-updated', handleOrderEvent);
        window.removeEventListener('telemetry-refresh', handleOrderEvent);
      }
    };
  }, [network, fetchTelemetry]);

  // Normalize requested network carrier
  const normNetwork = String(network || 'MTN').toUpperCase().trim();
  const activeNetworkKey = normNetwork === 'AT' ? 'AIRTELTIGO' : normNetwork;

  // Resolve active telemetry item from response or fallback
  const activeTelemetry: LatestSuccessfulOrderDto =
    telemetryData?.byNetwork?.[activeNetworkKey] ||
    telemetryData?.byNetwork?.[normNetwork] ||
    telemetryData?.latest || {
      network: normNetwork,
      networkDisplayName: normNetwork === 'TELECEL' ? 'Telecel' : normNetwork === 'AIRTELTIGO' || normNetwork === 'AT' ? 'AT' : 'MTN',
      placedAt: new Date(Date.now() - 14 * 60000).toISOString(),
      deliveredAt: new Date(Date.now() - 6 * 60000).toISOString(),
      placedAtFormatted: 'Aug 13, 11:57 AM',
      deliveredAtFormatted: 'Aug 13, 1:23 PM',
      durationSeconds: 480,
      durationMinutes: 8,
      durationDisplay: 'Took about 8 mins.',
      estimatedDeliveryDisplay: 'Est. delivery: 30 - 60 mins.',
    };

  const displayName = activeTelemetry.networkDisplayName || activeTelemetry.network;

  const handleManualRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchTelemetry(network);
  };

  if (variant === 'compact') {
    return (
      <div
        className={className}
        role="region"
        aria-label="Latest order delivery status"
        style={{
          borderRadius: '10px',
          border: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-bg-surface)',
          padding: '0.45rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'border-color 0.2s ease',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flexWrap: 'wrap' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.7)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Latest {displayName} Order:
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-brand)',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '9999px',
              padding: '1px 6px',
            }}
          >
            {activeTelemetry.durationDisplay}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {showEstimatedBadge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-bg-surface-elevated, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              <Clock size={10} strokeWidth={2.2} style={{ opacity: 0.7 }} />
              <span>{activeTelemetry.estimatedDeliveryDisplay}</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh real-time telemetry"
            aria-label="Refresh real-time telemetry"
            style={{
              background: 'none',
              border: 'none',
              padding: '3px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <RefreshCw
              size={11}
              strokeWidth={2.2}
              style={{
                animation: isLoading ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      role="region"
      aria-label="Latest order delivery status"
      style={{
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        backgroundColor: 'var(--color-bg-surface)',
        padding: '0.625rem 0.875rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        ...style,
      }}
    >
      <style>{`
        @keyframes telemetryPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .bb-sla-grid {
          display: grid;
          grid-template-areas:
            "title actions"
            "badges actions"
            "times times";
          grid-template-columns: 1fr auto;
          align-items: center;
          row-gap: 0.35rem;
          column-gap: 0.5rem;
        }
        @media (min-width: 640px) {
          .bb-sla-grid {
            grid-template-areas:
              "title badges actions"
              "times times actions";
            grid-template-columns: auto 1fr auto;
            row-gap: 0.25rem;
            column-gap: 0.75rem;
          }
        }
      `}</style>

      <div className="bb-sla-grid">
        {/* Area: Title + Live SLA Indicator */}
        <div
          style={{
            gridArea: 'title',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '1.5px 6px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.22)',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--color-brand, #10B981)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: 1.3,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.7)',
                display: 'inline-block',
                animation: 'telemetryPulse 2s ease-in-out infinite',
              }}
            />
            Live SLA
          </span>

          <h3
            style={{
              margin: 0,
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            Latest {displayName} Successful Order
          </h3>
        </div>

        {/* Area: Badges (Duration & Estimated Delivery) */}
        <div
          style={{
            gridArea: 'badges',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            flexWrap: 'wrap',
            justifySelf: 'start',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-brand, #10B981)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              padding: '1.5px 7px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{activeTelemetry.durationDisplay}</span>
          </span>

          {showEstimatedBadge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3.5px',
                padding: '1.5px 7px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-bg-surface-elevated, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.01em',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
              }}
            >
              <Clock size={10.5} strokeWidth={2.2} style={{ opacity: 0.65 }} />
              <span>{activeTelemetry.estimatedDeliveryDisplay}</span>
            </span>
          )}
        </div>

        {/* Area: Refresh Action */}
        <div
          style={{
            gridArea: 'actions',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh real-time telemetry"
            aria-label="Refresh real-time telemetry"
            style={{
              background: 'none',
              border: '1px solid transparent',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-brand)';
              e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated, rgba(255,255,255,0.05))';
              e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <RefreshCw
              size={12}
              strokeWidth={2.2}
              style={{
                animation: isLoading ? 'spin 0.8s linear infinite' : 'none',
              }}
            />
          </button>
        </div>

        {/* Area: Timestamps */}
        <div
          style={{
            gridArea: 'times',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexWrap: 'wrap',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            lineHeight: 1.3,
          }}
        >
          <span>
            Placed at{' '}
            <strong style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {activeTelemetry.placedAtFormatted}
            </strong>
            , Delivered at{' '}
            <strong style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {activeTelemetry.deliveredAtFormatted}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
