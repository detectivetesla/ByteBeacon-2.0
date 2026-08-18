import React from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import {
  Download,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export const StoreAnalyticsPage: React.FC = () => {
  const { toastSuccess } = useToast();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A855F7' }}>
            Store Performance
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Analytics & Metrics
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Sales conversions, average basket values, and carrier market share for your storefront.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => toastSuccess('Exported', 'Store performance report exported.')}
          leftIcon={<Download size={13} />}
        >
          Export Report
        </Button>
      </div>

      {/* Top Analytics Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Monthly Revenue</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            GH₵ 3,850.00
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>+24.2% vs last month</span>
        </Card>

        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Completed Orders</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            194
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>99.2% success rate</span>
        </Card>

        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Conversion Rate</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            16.8%
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>+3.1% this week</span>
        </Card>

        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Average Order Value</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            GH₵ 19.85
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Typical size: 5GB</span>
        </Card>
      </div>

      {/* Network Share Breakdown */}
      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
          Revenue by Network Carrier
        </h2>
        <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 var(--space-5) 0' }}>
          Breakdown of data bundles purchased through your storefront.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {/* MTN */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(255, 204, 0, 0.08)', border: '1px solid rgba(255, 204, 0, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#FFCC00', color: '#000000', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>MTN</span>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)' }}>GH₵ 2,420.00</strong>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '62.8%', height: '100%', backgroundColor: '#FFCC00' }} />
            </div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem' }}>62.8% of total volume (122 orders)</span>
          </div>

          {/* Telecel */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#E11D48', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>TELECEL</span>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)' }}>GH₵ 980.00</strong>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '25.4%', height: '100%', backgroundColor: '#E11D48' }} />
            </div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem' }}>25.4% of total volume (48 orders)</span>
          </div>

          {/* AirtelTigo */}
          <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>AT</span>
              <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)' }}>GH₵ 450.00</strong>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '11.8%', height: '100%', backgroundColor: '#2563EB' }} />
            </div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem' }}>11.8% of total volume (24 orders)</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
