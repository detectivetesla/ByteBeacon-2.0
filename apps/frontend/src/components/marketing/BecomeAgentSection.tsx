import React from 'react';
import { motion } from 'framer-motion';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import {
  Store,
  TrendingUp,
  Code2,
  Zap,
  Sparkles,
  ShieldCheck,
  Headphones,
} from 'lucide-react';

export const BecomeAgentSection: React.FC = () => {
  const features = [
    {
      icon: TrendingUp,
      color: 'security' as const,
      title: 'Top Reseller Margins',
      description: 'Earn high reseller margins on every bundle sale with volume-based wholesale tier discounts.',
    },
    {
      icon: Store,
      color: 'analytics' as const,
      title: 'Branded Storefronts',
      description: 'Deploy white-labeled retail storefronts and share unified float across all Ghanaian carriers.',
    },
    {
      icon: Code2,
      color: 'api' as const,
      title: 'Developer REST API',
      description: 'Automated fulfillment API with HMAC-signed webhooks, idempotent keys, and instant dispatch.',
    },
    {
      icon: Zap,
      color: 'wallet' as const,
      title: 'Instant MoMo Payouts',
      description: 'Instant on-demand MoMo withdrawals and automated wallet settlement directly to your phone.',
    },
  ];

  return (
    <section
      id="become-agent"
      style={{
        width: '100%',
        backgroundColor: '#050914',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 15%, rgba(16, 185, 129, 0.08) 0%, rgba(5, 9, 20, 0.95) 75%)',
        color: '#FFFFFF',
        padding: 'var(--space-16) 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.07)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Radial Ambient Green Glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.07) 0%, rgba(6, 182, 212, 0.03) 50%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 'var(--container-xl)',
          margin: '0 auto',
          padding: '0 var(--space-6)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header Block: Section Indicator + Heading + Subtitle (Minimal UI) */}
        <div style={{ maxWidth: '720px', marginBottom: 'var(--space-10)' }}>
          {/* Eyebrow Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              color: 'var(--color-primary-bright)',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Sparkles size={13} color="#FBBF24" strokeWidth={2.6} />
            <span>RESELLER & AGENT PLATFORM</span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.85rem, 3.2vw, 2.5rem)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#FFFFFF',
              lineHeight: 1.18,
              letterSpacing: '-0.03em',
              margin: 0,
            }}
          >
            Start Reselling <span style={{ color: 'var(--color-primary-bright)' }}>Mobile Data</span> Today
          </h2>

          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'rgba(255, 255, 255, 0.72)',
              marginTop: 'var(--space-3)',
              lineHeight: 1.6,
              fontWeight: 400,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Launch your branded data storefront with maximum wholesale discounts, unified float management across all Ghanaian carriers, and developer API tools.
          </p>
        </div>

        {/* 4 Distinct Value Propositions in a Balanced 2x2 Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.35, delay: index * 0.1 }}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-4)',
                transition: 'border-color 150ms ease, background-color 150ms ease',
              }}
            >
              <TactileIcon icon={feature.icon} color={feature.color} size="md" />

              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: '#FFFFFF',
                    margin: '0 0 var(--space-1) 0',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'rgba(255, 255, 255, 0.65)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Minimal Information Footer (No action buttons) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            gap: '1.75rem',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 'var(--font-size-2xs)', color: 'rgba(255, 255, 255, 0.65)' }}>
            <ShieldCheck size={14} color="var(--color-primary-bright)" />
            <span>Wholesale Reseller Pricing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 'var(--font-size-2xs)', color: 'rgba(255, 255, 255, 0.65)' }}>
            <Zap size={14} color="var(--color-primary-bright)" />
            <span>Instant Automated Fulfillment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 'var(--font-size-2xs)', color: 'rgba(255, 255, 255, 0.65)' }}>
            <Headphones size={14} color="var(--color-primary-bright)" />
            <span>24/7 Dedicated Support</span>
          </div>
        </div>
      </div>
    </section>
  );
};
