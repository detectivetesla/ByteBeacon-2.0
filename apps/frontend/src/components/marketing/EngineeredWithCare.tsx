import React from 'react';
import { Button } from '../ui/Button/Button.js';
import { TactileIcon } from '../ui/TactileIcon/TactileIcon.js';
import { Card } from '../ui/Card/Card.js';
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Smartphone,
  CreditCard,
  Terminal,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export const EngineeredWithCare: React.FC = () => {
  return (
    <section
      style={{
        maxWidth: 'var(--container-xl)',
        margin: '0 auto',
        padding: 'var(--space-20) var(--space-6)',
      }}
    >
      {/* Section Header */}
      <div style={{ maxWidth: '720px', marginBottom: 'var(--space-16)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <TactileIcon icon={Zap} color="primary" size="sm" />
          <span
            style={{
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-primary)',
            }}
          >
            ENGINEERED WITH CARE
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--color-text-primary)',
            lineHeight: 1.15,
            fontFamily: 'var(--font-display)',
          }}
        >
          Built around the way Ghana actually connects.
        </h2>
        <p
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginTop: '0.75rem',
            lineHeight: 1.6,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Every part of ByteBeacon is designed around a simple goal: making mobile connectivity easier, faster, and more dependable.
        </p>
      </div>

      {/* Structured Editorial Blocks (Divider-separated) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
        
        {/* =========================================================================
            FEATURE 01: FAST DELIVERY
            ========================================================================= */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-default)',
            paddingTop: 'var(--space-10)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-8)',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              01
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              FAST DELIVERY
            </span>
            <h3 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.375rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              Instant mobile data delivery
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: '440px' }}>
              Get data delivered directly to the recipient's phone immediately after a successful purchase with automated dispatch.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Card
              elevated
              style={{
                flex: 1,
                minWidth: '180px',
                padding: 'var(--space-5)',
              }}
            >
              <TactileIcon icon={Zap} color="speed" size="md" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                Automated
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Instant network dispatch
              </div>
            </Card>

            <Card
              elevated
              style={{
                flex: 1,
                minWidth: '180px',
                padding: 'var(--space-5)',
              }}
            >
              <TactileIcon icon={Clock} color="cyan" size="md" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                Sub-Minute
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Typical delivery speed
              </div>
            </Card>
          </div>
        </div>

        {/* =========================================================================
            FEATURE 02: PAYMENT SECURITY
            ========================================================================= */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-default)',
            paddingTop: 'var(--space-10)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-8)',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              02
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              PAYMENT SECURITY
            </span>
            <h3 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.375rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              Secure ways to pay
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: '440px' }}>
              Pay conveniently with Mobile Money across all Ghanaian carriers or with your Visa and Mastercard debit cards.
            </p>
          </div>

          <Card
            elevated
            style={{
              padding: 'var(--space-6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <TactileIcon icon={ShieldCheck} color="security" size="md" />
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Secure payment processing
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  Multi-channel MoMo and Card checkout
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-network-mtn-bg)', color: '#A17900', border: '1px solid var(--color-network-mtn-border)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                <Smartphone size={14} strokeWidth={2.5} /> MTN MoMo
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-network-telecel-bg)', color: 'var(--color-network-telecel)', border: '1px solid var(--color-network-telecel-border)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                <Smartphone size={14} strokeWidth={2.5} /> Telecel Cash
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-network-airteltigo-bg)', color: 'var(--color-network-airteltigo)', border: '1px solid var(--color-network-airteltigo-border)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                <Smartphone size={14} strokeWidth={2.5} /> AT Money
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-accent-payments)', border: '1px solid rgba(99, 102, 241, 0.35)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                <CreditCard size={14} strokeWidth={2.5} /> Debit Cards
              </span>
            </div>
          </Card>
        </div>

        {/* =========================================================================
            FEATURE 03: ORDER TRACKING
            ========================================================================= */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-default)',
            paddingTop: 'var(--space-10)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-8)',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              03
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              ORDER TRACKING
            </span>
            <h3 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.375rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              Know exactly where your order stands
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: '440px' }}>
              Real-time delivery progress keeps you informed at each milestone with clear status updates.
            </p>
          </div>

          <Card
            elevated
            style={{
              padding: 'var(--space-6)',
            }}
          >
            {/* Horizontal Milestone Timeline Flow */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <TactileIcon icon={CheckCircle2} color="security" size="sm" />
                <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.5rem' }}>
                  Payment confirmed
                </span>
              </div>

              <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--color-primary)', margin: '0 0.5rem', marginBottom: '1.25rem' }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <TactileIcon icon={Clock} color="analytics" size="sm" />
                <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.5rem' }}>
                  Processing
                </span>
              </div>

              <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--color-primary)', margin: '0 0.5rem', marginBottom: '1.25rem' }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <TactileIcon icon={CheckCircle2} color="primary" size="sm" />
                <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.5rem' }}>
                  Data delivered
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              style={{ marginTop: 'var(--space-6)' }}
              onClick={() => (window.location.href = '/track')}
              rightIcon={<ArrowRight size={14} strokeWidth={2.8} />}
            >
              Track an order
            </Button>
          </Card>
        </div>

        {/* =========================================================================
            FEATURE 04: BUILT FOR GROWTH (AGENTS & DEVELOPERS)
            ========================================================================= */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-default)',
            paddingTop: 'var(--space-10)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-8)',
          }}
        >
          {/* Left Column: Built for Growth */}
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              04
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              BUILT FOR GROWTH
            </span>
            <h3 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.375rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              Built for agents and developers
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: '440px' }}>
              Manage your data business with tools designed for scale, or integrate programmatic purchasing directly into your custom applications.
            </p>

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => (window.location.href = '/agent')}
                leftIcon={<UserCheck size={16} strokeWidth={2.5} />}
              >
                Become an agent
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => (window.location.href = '/developer')}
                leftIcon={<Terminal size={16} strokeWidth={2.5} />}
              >
                Developer API
              </Button>
            </div>
          </div>

          {/* Right Column: Split Features (Agents + Developers) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Agents Card */}
            <Card
              elevated
              style={{
                padding: 'var(--space-5)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AGENTS & RESELLERS
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>✓</span> Unified multi-network float
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>✓</span> Bulk recipient purchases
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>✓</span> Real-time sales analytics
                </li>
              </ul>
            </Card>

            {/* Developers Card */}
            <Card
              elevated
              style={{
                padding: 'var(--space-5)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-accent-api)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                DEVELOPERS & APIS
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-accent-api)', fontWeight: 800 }}>✓</span> Standard JSON REST API
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-accent-api)', fontWeight: 800 }}>✓</span> Programmatic data orders
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ color: 'var(--color-accent-api)', fontWeight: 800 }}>✓</span> Idempotent requests
                </li>
              </ul>
            </Card>
          </div>
        </div>

      </div>
    </section>
  );
};
