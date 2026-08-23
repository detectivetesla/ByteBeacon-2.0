import React from 'react';

export interface MaintenanceBannerProps {
  isMaintenanceMode?: boolean;
  message?: string;
}

export const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({
  isMaintenanceMode = false,
  message,
}) => {
  if (!isMaintenanceMode) return null;

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
};
