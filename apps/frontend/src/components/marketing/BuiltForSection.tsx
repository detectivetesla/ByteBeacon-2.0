import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card/Card.js';
import { Button } from '../ui/Button/Button.js';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import {
  Smartphone,
  Store,
  Code2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const BuiltForSection: React.FC = () => {
  const segments = [
    {
      badge: 'Personal Connectivity',
      title: 'For Individuals',
      icon: Smartphone,
      color: 'orders' as const,
      accentColor: '#0284C7',
      bgGradient: 'linear-gradient(145deg, rgba(2, 132, 199, 0.06) 0%, rgba(2, 132, 199, 0.01) 100%)',
      borderColor: 'rgba(2, 132, 199, 0.25)',
      description: 'Get fast, reliable, non-expiry mobile data bundles with direct Mobile Money payment and instant delivery.',
      perks: [
        'Instant non-expiry bundle purchases',
        'Direct USSD payment prompt on your phone',
        'Real-time live SMS & online delivery tracking',
        'Transparent wholesale rates with no hidden fees',
      ],
      ctaText: 'Browse Data Packages',
      ctaHref: '#networks',
      ctaVariant: 'outline' as const,
    },
    {
      badge: 'High-Margin Business',
      title: 'For Resellers & Agents',
      icon: Store,
      color: 'security' as const,
      accentColor: '#10B981',
      bgGradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      description: 'Turn connectivity into a profitable retail business with automated storefronts, high margins, and unified float.',
      perks: [
        'Top reseller margins on every bundle sale',
        'Deploy white-labeled storefronts in minutes',
        'Single unified wallet balance for all 3 carriers',
        'Instant on-demand MoMo withdrawals',
      ],
      ctaText: 'Start Reselling Today',
      ctaHref: '/agent',
      ctaVariant: 'primary' as const,
    },
    {
      badge: 'Automated Infrastructure',
      title: 'For Developers & Fintechs',
      icon: Code2,
      color: 'api' as const,
      accentColor: '#8B5CF6',
      bgGradient: 'linear-gradient(145deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.01) 100%)',
      borderColor: 'rgba(139, 92, 246, 0.25)',
      description: 'Integrate automated telecom bundle fulfillment directly into your apps and platforms with our robust REST API.',
      perks: [
        'HMAC-SHA256 authenticated REST endpoints',
        'Real-time webhook notifications with retries',
        'Isolated Sandbox simulation environment',
        'Idempotency protection & high throughput',
      ],
      ctaText: 'Read API Docs',
      ctaHref: '/developer',
      ctaVariant: 'outline' as const,
    },
  ];

  return (
    <section
      id="built-for"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        padding: 'var(--space-20) var(--space-6)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto var(--space-16)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(2, 132, 199, 0.10)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              color: 'var(--color-accent-analytics)',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-3)',
            }}
          >
            BUILT FOR YOU
          </div>

          <h2
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              margin: 0,
            }}
          >
            Built for Individuals, Resellers & Developers
          </h2>

          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-3)',
              lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
            }}
          >
            A single unified telecom platform tailored for personal purchases, commercial distribution, and automated software integrations.
          </p>
        </div>

        {/* 3 User Segment Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-8)',
          }}
        >
          {segments.map((segment, index) => (
            <motion.div
              key={segment.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.12 }}
              whileHover={{ y: -4 }}
            >
              <Card
                elevated
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 'var(--space-8)',
                  background: segment.bgGradient,
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  border: `1px solid ${segment.borderColor}`,
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-tactile-md)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                  <TactileIcon icon={segment.icon} color={segment.color} size="lg" />
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xs)',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: segment.accentColor,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {segment.badge}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 var(--space-2) 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {segment.title}
                </h3>

                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    margin: '0 0 var(--space-6) 0',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {segment.description}
                </p>

                {/* Feature Perks List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)', flexGrow: 1 }}>
                  {segment.perks.map((perk, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                      <CheckCircle2 size={15} color={segment.accentColor} strokeWidth={2.6} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
                        {perk}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div style={{ marginTop: 'auto' }}>
                  <Button
                    variant={segment.ctaVariant}
                    size="md"
                    fullWidth
                    onClick={() => {
                      if (segment.ctaHref.startsWith('#')) {
                        const el = document.getElementById(segment.ctaHref.replace('#', ''));
                        el?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        window.location.href = segment.ctaHref;
                      }
                    }}
                    rightIcon={<ArrowRight size={15} strokeWidth={2.4} />}
                  >
                    {segment.ctaText}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
