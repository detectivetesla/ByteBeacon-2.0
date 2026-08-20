import React, { useState, useEffect } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { NetworkSelector } from '../../components/commerce/NetworkSelector.js';
import { BundleSelector, BundleItem, SAMPLE_BUNDLES } from '../../components/commerce/BundleSelector.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
import { HolographicGlobe } from '../../components/marketing/HolographicGlobe.js';
import { HowItWorksSection } from '../../components/marketing/HowItWorksSection.js';
import { BuiltForSection } from '../../components/marketing/BuiltForSection.js';
import { BecomeAgentSection } from '../../components/marketing/BecomeAgentSection.js';
import { CTASection } from '../../components/marketing/CTASection.js';
import { Button } from '../../components/ui/Button/Button.js';
import {
  Zap,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { WhatsAppFloat } from '../../components/ui/WhatsAppFloat.js';

export const LandingPage: React.FC = () => {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [selectedBundle, setSelectedBundle] = useState<BundleItem>(SAMPLE_BUNDLES[NetworkProvider.MTN][2]);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* =========================================================================
          HERO SECTION — Open Composition, Atmospheric Navy Glow, Editorial Typography
          ========================================================================= */}
      <section
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-bg-hero)',
          color: '#FFFFFF',
          padding: 'var(--space-20) var(--space-page-x, var(--space-6)) var(--space-24)',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Layered Parallax Background Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            left: '50%',
            transform: `translateX(-50%) translateY(${scrollY * 0.03}px)`,
            width: 'min(900px, 100vw)',
            height: '500px',
            background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.16) 0%, rgba(2, 132, 199, 0.09) 45%, rgba(5, 8, 15, 0) 75%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 'var(--container-xl)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            alignItems: 'center',
            gap: 'var(--space-12)',
          }}
        >
          {/* Left Column: Editorial Headline & Actions */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              transform: `translateY(${scrollY * 0.025}px)`,
            }}
          >
            {/* Status Eyebrow Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: 'var(--color-primary-bright)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-6)',
              }}
            >
              <Zap size={14} strokeWidth={2.8} /> MOBILE DATA, SIMPLIFIED
            </div>

            {/* Editorial Headline */}
            <h1
              style={{
                fontSize: 'var(--font-size-hero)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.06,
                color: '#FFFFFF',
                fontFamily: 'var(--font-display)',
                margin: 0,
              }}
            >
              Data that moves. <br />
              <span style={{ color: 'var(--color-primary-bright)' }}>Delivered in seconds.</span>
            </h1>

            {/* Supporting Text */}
            <p
              style={{
                fontSize: 'var(--font-size-body-lead, var(--font-size-lg))',
                color: 'rgba(255, 255, 255, 0.75)',
                maxWidth: 'min(520px, 100%)',
                marginTop: 'var(--space-6)',
                lineHeight: 1.6,
                fontWeight: 400,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Reliable connectivity without the complexity. Pay with mobile money and get instant data fulfillment across all networks in Ghana.
            </p>

            {/* Primary & Secondary Hero CTAs */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                marginTop: 'var(--space-8)',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Button
                variant="primary"
                size="lg"
                onClick={() => (window.location.href = '/signup')}
                style={{ padding: '0 2rem' }}
                rightIcon={<ArrowRight size={18} strokeWidth={2.8} />}
              >
                Sign up
              </Button>

              <Button
                variant="hero-secondary"
                size="lg"
                onClick={() => (window.location.href = '/signin')}
                style={{ padding: '0 1.75rem' }}
              >
                Sign in
              </Button>

            </div>

            {/* Trust Micro-Metrics */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                marginTop: 'var(--space-10)',
                paddingTop: 'var(--space-6)',
                borderTop: '1px solid rgba(255, 255, 255, 0.10)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--color-primary-bright)" strokeWidth={2.8} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
                  MTN, Telecel & AT
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--color-primary-bright)" strokeWidth={2.8} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
                  Non-Expiry Data
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--color-primary-bright)" strokeWidth={2.8} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
                  Instant Fulfillment
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Holographic Parallax Globe */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transform: `translateY(${scrollY * 0.012}px)`,
            }}
          >
            <HolographicGlobe />
          </div>
        </div>
      </section>

      {/* =========================================================================
          NETWORK SELECTOR SECTION — Clean, Non-Bento, 3 Equal Autonomous Cards
          ========================================================================= */}
      <section id="networks" style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'var(--space-16) var(--space-page-x, var(--space-6)) var(--space-12)' }}>
        <div style={{ textAlign: 'center', maxWidth: 'min(640px, 100%)', margin: '0 auto var(--space-10)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-primary)',
            }}
          >
            Direct Carrier Pipelines
          </span>
          <h2
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              marginTop: '0.25rem',
              letterSpacing: '-0.03em',
            }}
          >
            Choose your network
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            Select a network to explore real-time non-expiry bundles with instant carrier delivery.
          </p>
        </div>

        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onSelect={(net) => {
            setSelectedNetwork(net);
            setSelectedBundle(SAMPLE_BUNDLES[net][2]);
          }}
        />
      </section>

      {/* =========================================================================
          DATA BUNDLE SELECTOR SECTION
          ========================================================================= */}
      <section style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: '0 var(--space-page-x, var(--space-6)) var(--space-16)' }}>
        <BundleSelector
          network={selectedNetwork}
          selectedBundleId={selectedBundle.id}
          onSelect={(b) => {
            setSelectedBundle(b);
            setPurchaseModalOpen(true);
          }}
        />
      </section>

      {/* =========================================================================
          HOW BYTEBEACON WORKS — Restored 3-Step Sequential Physical Tactile Cards
          ========================================================================= */}
      <HowItWorksSection />

      {/* =========================================================================
          BUILT FOR INDIVIDUALS, RESELLERS & DEVELOPERS — Restored 3-Segment Cards
          ========================================================================= */}
      <BuiltForSection />

      {/* =========================================================================
          AGENT & DEVELOPER PLATFORM — Restored & Polished Dark UI Section
          ========================================================================= */}
      <BecomeAgentSection />

      {/* =========================================================================
          CLOSING CONVERSION CTA — "Ready to Save on Data?"
          ========================================================================= */}
      <CTASection />

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialNetwork={selectedNetwork}
        initialBundleId={selectedBundle.id}
      />

      {/* Floating WhatsApp Community Button */}
      <WhatsAppFloat />
    </div>
  );
};
