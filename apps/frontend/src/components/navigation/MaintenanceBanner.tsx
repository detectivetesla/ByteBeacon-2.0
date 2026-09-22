import React from 'react';

export interface MaintenanceBannerProps {
  isMaintenanceMode?: boolean;
  message?: string;
  isOrderProcessingPaused?: boolean;
  orderProcessingMessage?: string;
}

export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  isMaintenanceMode = false,
  message,
  isOrderProcessingPaused = false,
  orderProcessingMessage,
}) => {
  if (isMaintenanceMode) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '0.625rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontSize: 'var(--font-size-xs)',
          color: '#FBBF24',
          textAlign: 'center',
          zIndex: 'var(--z-sticky)',
          width: '100%',
        }}
      >
        <span style={{ fontSize: '1rem' }}>⚠️</span>
        <span>
          <strong>Scheduled Maintenance in Progress:</strong>{' '}
          {message || 'Telecom fulfillment is temporarily queued. You can still browse bundles, track past orders, and access your account.'}
        </span>
      </div>
    );
  }

  if (isOrderProcessingPaused) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '0.625rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontSize: 'var(--font-size-xs)',
          color: '#EF4444',
          textAlign: 'center',
          zIndex: 'var(--z-sticky)',
          width: '100%',
        }}
      >
        <span style={{ fontSize: '1rem' }}>⏸️</span>
        <span>
          <strong>Order Operations Paused:</strong>{' '}
          {orderProcessingMessage || 'Order checkouts, bulk purchases, and Excel uploads are temporarily paused by administrators. Browsing and account access remain operational.'}
        </span>
      </div>
    );
  }

  return null;
};
