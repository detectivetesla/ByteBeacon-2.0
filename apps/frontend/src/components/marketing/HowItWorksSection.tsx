import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card/Card.js';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import {
  Smartphone,
  Layers,
  CreditCard,
  Zap,
} from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      icon: Smartphone,
      color: 'orders' as const,
      accentColor: '#3B82F6',
      title: 'Choose Network',
      description: 'Select your preferred carrier across MTN, Telecel, or AirtelTigo directly on the platform.',
    },
    {
      number: '02',
      icon: Layers,
      color: 'analytics' as const,
      accentColor: '#06B6D4',
      title: 'Select Data Bundle',
      description: 'Pick your desired non-expiry package size with wholesale pricing and live inventory status.',
    },
    {
      number: '03',
      icon: CreditCard,
      color: 'payments' as const,
      accentColor: '#F59E0B',
      title: 'Authorize Payment',
      description: 'Enter the recipient phone number and authorize the secure Mobile Money USSD prompt on your phone.',
    },
    {
      number: '04',
      icon: Zap,
      color: 'speed' as const,
      accentColor: '#10B981',
      title: 'Instant Delivery',
      description: 'Data is provisioned directly to the recipient SIM within seconds with real-time SMS tracking.',
    },
  ];

  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: 'var(--color-bg-surface-muted)',
        borderTop: '1px solid var(--color-border-default)',
        borderBottom: '1px solid var(--color-border-default)',
        padding: 'var(--space-20) var(--space-6)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto var(--space-16)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(34, 197, 94, 0.10)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-3)',
            }}
          >
            HOW IT WORKS
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
            How ByteBeacon Works
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
            Four direct steps from carrier selection to confirmed mobile data delivery on your phone.
          </p>
        </div>

        {/* 4 Steps Structural Grid with Connecting Progression */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-5)',
            position: 'relative',
          }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.35, delay: index * 0.1 }}
              whileHover={{ y: -3 }}
            >
              <Card
                elevated
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 'var(--space-6)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-tactile-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                }}
              >
                {/* Step Header: Tactile Icon + Large Step Number */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-5)',
                  }}
                >
                  <TactileIcon icon={step.icon} color={step.color} size="md" />

                  <span
                    style={{
                      fontSize: 'var(--font-size-2xl)',
                      fontWeight: 900,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-muted)',
                      opacity: 0.45,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {step.number}
                  </span>
                </div>

                {/* Step Content */}
                <h3
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 var(--space-2) 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {step.title}
                </h3>

                <p
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.55,
                    margin: 0,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {step.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
