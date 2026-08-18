import React from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Check, ArrowRight } from 'lucide-react';

export interface NetworkSelectorProps {
  selectedNetwork: NetworkProvider;
  onSelect: (network: NetworkProvider) => void;
  networkAvailability?: Record<NetworkProvider, 'AVAILABLE' | 'LOW' | 'UNAVAILABLE'>;
  isLoading?: boolean;
}

interface NetworkCardConfig {
  provider: NetworkProvider;
  name: string;
  shortName: string;
  service: string;
  brandColor: string;
  accentBg: string;
  selectedBg: string;
  borderColor: string;
  glowColor: string;
}

const NETWORKS: NetworkCardConfig[] = [
  {
    provider: NetworkProvider.MTN,
    name: 'MTN Ghana',
    shortName: 'MTN',
    service: 'Non-Expiry 4G/5G Turbo Data',
    brandColor: '#FFCC00',
    accentBg: 'rgba(255, 204, 0, 0.08)',
    selectedBg: 'linear-gradient(145deg, rgba(255, 204, 0, 0.12) 0%, var(--color-bg-surface) 100%)',
    borderColor: '#FFCC00',
    glowColor: 'rgba(255, 204, 0, 0.35)',
  },
  {
    provider: NetworkProvider.TELECEL,
    name: 'Telecel Ghana',
    shortName: 'Telecel',
    service: 'Instant High-Speed Mobile Data',
    brandColor: '#E7192D',
    accentBg: 'rgba(231, 25, 45, 0.08)',
    selectedBg: 'linear-gradient(145deg, rgba(231, 25, 45, 0.12) 0%, var(--color-bg-surface) 100%)',
    borderColor: '#E7192D',
    glowColor: 'rgba(231, 25, 45, 0.35)',
  },
  {
    provider: NetworkProvider.AIRTELTIGO,
    name: 'AirtelTigo',
    shortName: 'AirtelTigo',
    service: 'Reliable Big-Time Data Packages',
    brandColor: '#0066B2',
    accentBg: 'rgba(0, 102, 178, 0.08)',
    selectedBg: 'linear-gradient(145deg, rgba(0, 102, 178, 0.12) 0%, var(--color-bg-surface) 100%)',
    borderColor: '#0066B2',
    glowColor: 'rgba(0, 102, 178, 0.35)',
  },
];

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  selectedNetwork,
  onSelect,
  networkAvailability = {
    [NetworkProvider.MTN]: 'AVAILABLE',
    [NetworkProvider.TELECEL]: 'AVAILABLE',
    [NetworkProvider.AIRTELTIGO]: 'AVAILABLE',
  },
  isLoading = false,
}) => {
  const renderAvailabilityBadge = (provider: NetworkProvider) => {
    const status = networkAvailability[provider] || 'AVAILABLE';

    if (status === 'UNAVAILABLE') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--font-size-3xs)',
            fontWeight: 800,
            color: 'var(--color-danger)',
            backgroundColor: 'var(--color-danger-surface)',
            border: '1px solid var(--color-danger-border)',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
          Unavailable
        </span>
      );
    }

    if (status === 'LOW') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--font-size-3xs)',
            fontWeight: 800,
            color: 'var(--color-warning)',
            backgroundColor: 'var(--color-warning-surface)',
            border: '1px solid var(--color-warning-border)',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} />
          Limited
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: 'var(--font-size-3xs)',
          fontWeight: 800,
          color: 'var(--color-success)',
          backgroundColor: 'var(--color-success-surface)',
          border: '1px solid var(--color-success-border)',
          padding: '0.15rem 0.5rem',
          borderRadius: 'var(--radius-full)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
        Available
      </span>
    );
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              height: '140px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {NETWORKS.map((net) => {
        const isSelected = selectedNetwork === net.provider;
        const isUnavailable = networkAvailability[net.provider] === 'UNAVAILABLE';

        return (
          <div
            key={net.provider}
            onClick={() => !isUnavailable && onSelect(net.provider)}
            role="button"
            tabIndex={isUnavailable ? -1 : 0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isUnavailable) {
                e.preventDefault();
                onSelect(net.provider);
              }
            }}
            style={{
              position: 'relative',
              background: isSelected
                ? net.selectedBg
                : 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
              border: isSelected
                ? `2px solid ${net.borderColor}`
                : '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-5)',
              boxShadow: isSelected
                ? `0 8px 24px ${net.glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.4)`
                : 'var(--shadow-tactile-sm)',
              cursor: isUnavailable ? 'not-allowed' : 'pointer',
              opacity: isUnavailable ? 0.6 : 1,
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '145px',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isUnavailable && !isSelected) {
                e.currentTarget.style.borderColor = net.borderColor;
                e.currentTarget.style.backgroundColor = net.accentBg;
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                e.currentTarget.style.boxShadow = `0 10px 20px ${net.glowColor}`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isUnavailable && !isSelected) {
                e.currentTarget.style.borderColor = 'var(--color-border-default)';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = 'var(--shadow-tactile-sm)';
              }
            }}
          >
            {/* Top Row: Network Identity badge, Name, and Availability */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: net.brandColor,
                      color: net.provider === NetworkProvider.MTN ? '#000000' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      boxShadow: `0 2px 8px ${net.glowColor}`,
                      flexShrink: 0,
                    }}
                  >
                    {net.shortName.slice(0, 3)}
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 900,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                        margin: 0,
                      }}
                    >
                      {net.name}
                    </h3>
                  </div>
                </div>

                {renderAvailabilityBadge(net.provider)}
              </div>

              {/* Service Subtitle */}
              <p
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.4,
                  margin: '0.25rem 0 0 0',
                }}
              >
                {net.service}
              </p>
            </div>

            {/* Bottom Row: Selection Indicator */}
            <div
              style={{
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
                borderTop: isSelected ? `1px solid ${net.borderColor}` : '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 800,
                  color: isSelected ? net.brandColor : 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isSelected ? (
                  <>
                    <Check size={15} strokeWidth={3} />
                    <span>Selected</span>
                  </>
                ) : (
                  <>
                    <span>Select {net.shortName}</span>
                    <ArrowRight size={13} strokeWidth={2.4} />
                  </>
                )}
              </span>

              {isSelected && (
                <span
                  style={{
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: net.brandColor,
                    color: net.provider === NetworkProvider.MTN ? '#000000' : '#FFFFFF',
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
