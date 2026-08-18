import React from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Eye,
  ArrowUpRight,
  TrendingUp,
  Package,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

export const StoreDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const storeSlug = 'datahub-express';
  const publicStoreUrl = `/store/${storeSlug}`;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header & Live Storefront Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3B82F6' }}>
            Storefront Intelligence
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Overview
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Real-time sales velocity, customer traffic, and telecom order health for your storefront.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/store-console/products')}>
            Manage Products
          </Button>
          <a
            href={publicStoreUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
            }}
          >
            <span>Preview Store</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      {/* 2. Top-Level 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Today's Sales */}
        <Card
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '6px 6px 16px rgba(16, 24, 40, 0.04), -4px -4px 12px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Today's Sales
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={15} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            GH₵ 420.00
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>
            <TrendingUp size={12} />
            <span>+18.4% vs yesterday</span>
          </div>
        </Card>

        {/* Orders */}
        <Card
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '6px 6px 16px rgba(16, 24, 40, 0.04), -4px -4px 12px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Orders Today
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={15} color="#8B5CF6" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            24
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
            <span>Avg GHS 17.50 / order</span>
          </div>
        </Card>

        {/* Customers */}
        <Card
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '6px 6px 16px rgba(16, 24, 40, 0.04), -4px -4px 12px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Customers
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(6, 182, 212, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={15} color="#06B6D4" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            18
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
            <span>6 new buyers this week</span>
          </div>
        </Card>

        {/* Store Visits */}
        <Card
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '6px 6px 16px rgba(16, 24, 40, 0.04), -4px -4px 12px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Store Visits
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={15} color="#EC4899" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            142
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>
            <span>16.9% conversion rate</span>
          </div>
        </Card>
      </div>

      {/* 3. Revenue Trajectory & Order Health Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left: Revenue Trajectory Chart */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Storefront Revenue Velocity
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                7-day sales breakdown generated from customer orders.
              </p>
            </div>
            <Badge variant="success" size="sm">7 Days</Badge>
          </div>

          {/* Minimal Clean SVG Chart */}
          <div style={{ width: '100%', height: '180px', position: 'relative', marginTop: 'var(--space-4)' }}>
            <svg viewBox="0 0 500 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="storeRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />

              {/* Area */}
              <path
                d="M 20 120 Q 90 95, 160 105 T 300 65 T 440 35 L 480 20 L 480 150 L 20 150 Z"
                fill="url(#storeRevenueGrad)"
              />

              {/* Line */}
              <path
                d="M 20 120 Q 90 95, 160 105 T 300 65 T 440 35 L 480 20"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3.2"
                strokeLinecap="round"
              />

              {/* Data points */}
              {[[20, 120], [90, 95], [160, 105], [230, 85], [300, 65], [370, 50], [440, 35], [480, 20]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="4.5" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2.5" />
              ))}
            </svg>

            {/* X-Axis labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </Card>

        {/* Right: Order Health (Thick rounded progress bars) */}
        <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Order Fulfillment Health
          </h2>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
            Instant telecom delivery status for customer bundle orders.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
            {/* Delivered */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  <CheckCircle2 size={13} color="#10B981" />
                  Delivered
                </span>
                <strong style={{ color: '#10B981', fontFamily: 'var(--font-data)' }}>28 Orders (93.3%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '93.3%', height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Processing */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  <Clock size={13} color="#3B82F6" />
                  Processing
                </span>
                <strong style={{ color: '#3B82F6', fontFamily: 'var(--font-data)' }}>2 Orders (6.7%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '6.7%', height: '100%', background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  <RotateCcw size={13} color="#F59E0B" />
                  Pending
                </span>
                <strong style={{ color: '#F59E0B', fontFamily: 'var(--font-data)' }}>0 Orders (0.0%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '0%', height: '100%', backgroundColor: '#F59E0B', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Failed */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                  <Package size={13} color="var(--color-danger)" />
                  Failed
                </span>
                <strong style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-data)' }}>0 Orders (0.0%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '0%', height: '100%', backgroundColor: 'var(--color-danger)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/store-console/orders')} rightIcon={<ArrowRight size={13} />}>
              View All Store Orders
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
