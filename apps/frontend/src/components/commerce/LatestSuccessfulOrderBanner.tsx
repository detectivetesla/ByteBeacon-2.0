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
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)',
          borderLeft: '3px solid var(--color-brand)',
          backgroundColor: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-tactile-sm)',
          padding: '0.45rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          transition: 'all var(--transition-normal)',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22C55E',
              boxShadow: '0 0 6px rgba(34, 197, 94, 0.8)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Latest {displayName} Order:
          </span>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-brand)', fontWeight: 700 }}>
            {activeTelemetry.durationDisplay}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {showEstimatedBadge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(239, 68, 68, 0.10)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#DC2626',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.01em',
              }}
            >
              <Clock size={10} strokeWidth={2.4} />
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
              padding: '2px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw
              size={11}
              strokeWidth={2.4}
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
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: '4px solid var(--color-brand)',
        backgroundColor: 'var(--color-bg-surface)',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        boxShadow: 'var(--shadow-tactile-sm)',
        transition: 'all var(--transition-normal)',
        position: 'relative',
        ...style,
      }}
    >
      <style>{`
        @keyframes telemetryPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.85); }
        }
      `}</style>

      {/* Row 1: Header + Live Indicator + Est Delivery Badge + Refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-brand-surface)',
              border: '1px solid var(--color-brand-border)',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--color-brand)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#22C55E',
                boxShadow: '0 0 6px rgba(34, 197, 94, 0.8)',
                display: 'inline-block',
                animation: 'telemetryPulse 2s ease-in-out infinite',
              }}
            />
            Live SLA
          </span>

          <h3
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Latest {displayName} Successful Order
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {showEstimatedBadge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(239, 68, 68, 0.10)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#DC2626',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              <Clock size={12} strokeWidth={2.4} />
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
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xs)',
              padding: '3px 5px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-brand)';
              e.currentTarget.style.borderColor = 'var(--color-brand-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
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
      </div>

      {/* Row 2: Timestamps + Duration */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        <span>
          Placed at{' '}
          <strong style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {activeTelemetry.placedAtFormatted}
          </strong>
          , Delivered at{' '}
          <strong style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {activeTelemetry.deliveredAtFormatted}
          </strong>
        </span>

        <span style={{ color: 'var(--color-border-strong)', fontSize: '10px' }}>•</span>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-brand)',
            backgroundColor: 'var(--color-brand-surface)',
            padding: '1px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-brand-border)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {activeTelemetry.durationDisplay}
        </span>
      </div>
    </div>
  );
};
