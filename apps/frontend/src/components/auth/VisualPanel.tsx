import React from 'react';

export interface VisualPanelProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  activeSlideIndex?: number;
}

export const VisualPanel: React.FC<VisualPanelProps> = ({
  title = 'One Platform to Streamline All Mobile Data Delivery',
  subtitle = 'Instant multi-network fulfillment, live tracking, and verified Mobile Money payments across Ghana.',
  activeSlideIndex = 0,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#0A0D14',
        color: '#FFFFFF',
        padding: 'var(--space-12) var(--space-8)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: '480px',
        height: '100%',
        borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)',
      }}
    >
      {/* Top-Right Warm Subtle Radial Glow matching screenshot */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle at center, rgba(234, 179, 8, 0.16) 0%, rgba(22, 163, 74, 0.08) 45%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Center Tactile Emblem Card matching screenshot */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '76px',
          height: '76px',
          borderRadius: '20px',
          backgroundColor: '#161B26',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-10)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
            padding: '4px',
          }}
        >
          <img
            src="/logo.png"
            alt="ByteBeacon"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>

      {/* Editorial Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '380px' }}>
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 2.5vw, 1.875rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            color: '#FFFFFF',
            fontFamily: 'var(--font-display)',
            marginBottom: 'var(--space-3)',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.6,
            fontWeight: 400,
            marginBottom: 'var(--space-8)',
          }}
        >
          {subtitle}
        </p>

        {/* Carousel Pagination Dots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
          {[0, 1, 2].map((idx) => {
            const isActive = idx === activeSlideIndex;
            return (
              <span
                key={idx}
                style={{
                  width: isActive ? '18px' : '6px',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)',
                  transition: 'all var(--transition-fast)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
