import React from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';

export const AdminProviderPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Telecom Infrastructure
        </span>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
          Provider Operations & Gateway Health
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Monitor live telecom carrier fulfillment interfaces, circuit breaker thresholds, and latency metrics.
        </p>
      </div>

      {/* Provider Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* MTN Carrier */}
        <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFCC00' }} />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                MTN Direct Interface
              </h2>
            </div>
            <Badge variant="success">HEALTHY</Badge>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Circuit Breaker State</span>
              <strong style={{ color: 'var(--color-primary)' }}>CLOSED (Normal)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Average Dispatch Latency</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>420ms</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Success Rate (24h)</span>
              <strong style={{ color: 'var(--color-primary)' }}>99.85%</strong>
            </div>
          </div>
        </Card>

        {/* Telecel Carrier */}
        <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E7192D' }} />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Telecel Direct Interface
              </h2>
            </div>
            <Badge variant="success">HEALTHY</Badge>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Circuit Breaker State</span>
              <strong style={{ color: 'var(--color-primary)' }}>CLOSED (Normal)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Average Dispatch Latency</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>610ms</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Success Rate (24h)</span>
              <strong style={{ color: 'var(--color-primary)' }}>99.40%</strong>
            </div>
          </div>
        </Card>

        {/* AirtelTigo Carrier */}
        <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0066B2' }} />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                AirtelTigo Direct Interface
              </h2>
            </div>
            <Badge variant="success">HEALTHY</Badge>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Circuit Breaker State</span>
              <strong style={{ color: 'var(--color-primary)' }}>CLOSED (Normal)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Average Dispatch Latency</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>380ms</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Success Rate (24h)</span>
              <strong style={{ color: 'var(--color-primary)' }}>99.90%</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
