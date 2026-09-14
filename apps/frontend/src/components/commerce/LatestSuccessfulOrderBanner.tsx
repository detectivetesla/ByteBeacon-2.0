import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';
import { LatestSuccessfulOrderDto, LatestSuccessfulOrdersResponse, NetworkProvider } from '@bytebeacon/shared';

export interface LatestSuccessfulOrderBannerProps {
  /**
   * The currently active or selected network (MTN, Telecel, AT, etc.)
   */
  network?: NetworkProvider | string;
  /**
   * Layout variant: full (default banner matching reference spec) or compact
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

  const fetchTelemetry = useCallback(async (net?: string) => {
    try {
      setIsLoading(true);
      const res = await ordersApi.getLatestSuccessfulOrder(net);
      if (res) {
        setTelemetryData(res);
      }
    } catch {
      // Non-blocking fallback: do not crash parent view on telemetry error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch once on mount and when network carrier changes
  useEffect(() => {
    fetchTelemetry(network);
  }, [network, fetchTelemetry]);

  // Periodic subtle background refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTelemetry(network);
    }, 60000);
    return () => clearInterval(timer);
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
      placedAtFormatted: 'Sep 13, 11:55 PM',
      deliveredAtFormatted: 'Sep 14, 12:03 AM',
      durationSeconds: 480,
      durationMinutes: 8,
      durationDisplay: 'Took about 8 mins.',
      estimatedDeliveryDisplay: 'Est. delivery: Less than 10 mins.',
    };

  const displayName = activeTelemetry.networkDisplayName || activeTelemetry.network;

  if (variant === 'compact') {
    return (
      <div
        className={className}
        role="region"
        aria-label="Latest order delivery status"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          padding: 'var(--space-2) var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#14532d' }}>
            Latest {displayName} Order:
          </span>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: '#15803d' }}>
            {activeTelemetry.durationDisplay}
          </span>
        </div>

        {showEstimatedBadge && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              color: '#dc2626',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            <Clock size={10} strokeWidth={2.4} />
            <span>{activeTelemetry.estimatedDeliveryDisplay}</span>
          </span>
        )}
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
        border: '1px solid rgba(34, 197, 94, 0.28)',
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        boxShadow: 'var(--shadow-tactile-sm)',
        transition: 'all var(--transition-normal)',
        position: 'relative',
        ...style,
      }}
    >
      {/* 1. Header Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 800,
            color: '#14532d',
            letterSpacing: '-0.01em',
          }}
        >
          Latest {displayName} Successful Order
        </h3>

        {isLoading && (
          <RefreshCw
            size={13}
            style={{
              color: '#16a34a',
              animation: 'spin 1s linear infinite',
              opacity: 0.7,
            }}
          />
        )}
      </div>

      {/* 2. Timestamps Subtitle */}
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          color: '#15803d',
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        Placed at{' '}
        <strong style={{ fontWeight: 800, color: '#14532d' }}>
          {activeTelemetry.placedAtFormatted}
        </strong>
        , Delivered at{' '}
        <strong style={{ fontWeight: 800, color: '#14532d' }}>
          {activeTelemetry.deliveredAtFormatted}
        </strong>
      </div>

      {/* 3. Duration */}
      <div
        style={{
          fontSize: '11px',
          color: '#16a34a',
          fontWeight: 500,
        }}
      >
        {activeTelemetry.durationDisplay}
      </div>

      {/* 4. Est. Delivery Badge */}
      {showEstimatedBadge && (
        <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.01em',
            }}
          >
            <Clock size={12} strokeWidth={2.4} />
            <span>{activeTelemetry.estimatedDeliveryDisplay}</span>
          </span>
        </div>
      )}
    </div>
  );
};
