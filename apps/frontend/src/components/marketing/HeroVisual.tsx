import React, { useState, useEffect, useRef } from 'react';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import { Zap, ShieldCheck, CheckCircle2, Smartphone, Radio } from 'lucide-react';

export const HeroVisual: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || window.innerWidth < 768) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    // Subtle dampening
    setMouseOffset({ x: x * 12, y: y * 12 });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        perspective: '1000px',
      }}
    >
      {/* Ambient Radial Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(22, 163, 74, 0.16) 0%, rgba(22, 163, 74, 0) 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main Floating Terminal / Visual Surface */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-floating)',
          transform: reducedMotion
            ? 'none'
            : `rotateY(${mouseOffset.x}deg) rotateX(${-mouseOffset.y}deg) translateY(${mouseOffset.y * 0.5}px)`,
          transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Visual Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border-subtle)',
            paddingBottom: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={Radio} color="primary" size="sm" />
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Direct Network Pipeline
              </div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Multi-carrier provisioner
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 700,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
            Active
          </div>
        </div>

        {/* Interactive Order Card Preview */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#FEFCE8',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <img src="/mtn-logo.png" alt="MTN" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  MTN Ghana 10 GB
                </div>
                <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  024 123 4567
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-data)' }}>
                GH₵ 48.00
              </div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                30 Days
              </div>
            </div>
          </div>

          {/* Delivery Milestone Progression */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
              <CheckCircle2 size={14} strokeWidth={2.8} /> Paid
            </div>
            <div style={{ width: '24px', height: '2px', backgroundColor: 'var(--color-primary)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
              <Zap size={14} strokeWidth={2.8} /> Dispatched
            </div>
            <div style={{ width: '24px', height: '2px', backgroundColor: 'var(--color-primary)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-accent-emerald)' }}>
              <Smartphone size={14} strokeWidth={2.8} /> Delivered
            </div>
          </div>
        </div>

        {/* Floating Stat Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'var(--space-4)' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <ShieldCheck size={16} strokeWidth={2.6} color="var(--color-primary)" />
            <div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>PAYMENTS</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>MoMo & Cards</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <Zap size={16} strokeWidth={2.6} color="var(--color-accent-cyan)" />
            <div>
              <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>FULFILLMENT</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>Automated</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
