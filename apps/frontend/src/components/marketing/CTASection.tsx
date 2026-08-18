import React from 'react';
import { Button } from '../ui/Button/Button.js';
import { ArrowRight } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section
      style={{
        padding: 'var(--space-16) var(--space-6)',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-16) var(--space-8)',
            textAlign: 'center',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-tactile-lg)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          {/* Background Ambient Glows */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '350px',
              height: '350px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '300px',
              height: '300px',
              backgroundColor: 'rgba(255, 255, 255, 0.10)',
              borderRadius: '50%',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <h2
              style={{
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              Ready to Save on Data?
            </h2>

            <p
              style={{
                fontSize: 'var(--font-size-lg)',
                color: 'rgba(255, 255, 255, 0.9)',
                marginTop: 'var(--space-4)',
                marginBottom: 'var(--space-8)',
                lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Join thousands of Ghanaians paying less for instant, non-expiry mobile data bundles.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => (window.location.href = '/signup')}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: 'var(--color-primary-active)',
                  fontWeight: 800,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                }}
                rightIcon={<ArrowRight size={18} strokeWidth={2.8} />}
              >
                Create Free Account
              </Button>

              <Button
                variant="hero-secondary"
                size="lg"
                onClick={() => {
                  const pricingEl = document.getElementById('networks');
                  pricingEl?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                  color: '#FFFFFF',
                }}
              >
                Browse Bundles
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
