import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { adminApi, AdminAnalyticsOverview } from '../../api/admin.api.js';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  Activity,
  PieChart,
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<string>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAnalyticsOverview(range);
      const analyticsData = (res as any)?.data || res;
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const periodVolumeGhs = (((analytics?.revenue?.periodPesewas ?? analytics?.revenue?.monthPesewas ?? 0)) / 100).toFixed(2);
  const totalVolumeGhs = ((analytics?.revenue?.lifetimePesewas || 0) / 100).toFixed(2);
  const todayVolumeGhs = ((analytics?.revenue?.todayPesewas || 0) / 100).toFixed(2);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={BarChart3} color="analytics" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-analytics-bright)' }}>
              Intelligence & Telemetry
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Platform Analytics
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative order volume, telecom network distribution, and revenue growth across ByteBeacon 2.0.
            </p>
          </div>
        </div>

        {/* Range Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-surface)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
          {['today', '7d', '30d', '90d', 'all'].map((r) => (
            <Button
              key={r}
              variant={range === r ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRange(r)}
              style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: 'var(--font-size-2xs)' }}
            >
              {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : `${r.replace('d', ' Days')}`}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <MetricCard
          title="Period Revenue"
          value={`GH₵ ${range === 'all' ? totalVolumeGhs : range === 'today' ? todayVolumeGhs : periodVolumeGhs}`}
          subvalue={`Lifetime: GH₵ ${totalVolumeGhs} • Today: GH₵ ${todayVolumeGhs}`}
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          title="Total Orders"
          value={(analytics?.orders?.total || 0).toLocaleString()}
          subvalue={`${analytics?.orders?.completionRate || 100}% Completion Rate`}
          accent="cyan"
          icon={<TactileIcon icon={Package} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Total User Base"
          value={(analytics?.users?.total || 0).toLocaleString()}
          subvalue={`${analytics?.users?.agents || 0} Agents • ${analytics?.users?.customers || 0} Customers`}
          accent="purple"
          icon={<TactileIcon icon={Users} color="api" size="sm" />}
        />
        <MetricCard
          title="Active Storefronts"
          value={(analytics?.stores?.active || 0).toLocaleString()}
          subvalue={`${analytics?.stores?.total || 0} Registered Stores`}
          accent="orange"
          icon={<TactileIcon icon={TrendingUp} color="speed" size="sm" />}
        />
      </div>

      {/* Grid: Network Breakdown & Order Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Network Breakdown Card */}
        <Card elevated accentColor="cyan" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={PieChart} color="analytics" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Telecom Network Distribution
              </h3>
            </div>
            <Badge variant="brand" size="sm">Real Volume</Badge>
          </div>

          <Table
            columns={[
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => (
                  <Badge variant={row.network === 'MTN' ? 'warning' : row.network === 'TELECEL' ? 'danger' : 'info'} size="sm">
                    {row.network}
                  </Badge>
                ),
              },
              {
                header: 'Orders',
                accessor: 'orderCount',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                    {row.orderCount.toLocaleString()}
                  </span>
                ),
              },
              {
                header: 'Volume (GHS)',
                accessor: 'volumePesewas',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                    GH₵ {(row.volumePesewas / 100).toFixed(2)}
                  </span>
                ),
              },
            ]}
            data={analytics?.networks || []}
            keyExtractor={(item) => item.network}
            emptyText="No orders recorded for this period."
          />
        </Card>

        {/* Order Health Summary */}
        <Card elevated accentColor="blue" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={Activity} color="orders" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Order Lifecycle Breakdown
              </h3>
            </div>
            <Badge variant="success" size="sm">Settled</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Card accentColor="green" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Completed / Delivered</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10B981', fontSize: 'var(--font-size-sm)' }}>
                {analytics?.orders?.completed || 0}
              </span>
            </Card>

            <Card accentColor="blue" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Processing / In Flight</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#3B82F6', fontSize: 'var(--font-size-sm)' }}>
                {analytics?.orders?.processing || 0}
              </span>
            </Card>

            <Card accentColor="red" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Failed / Cancelled</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#EF4444', fontSize: 'var(--font-size-sm)' }}>
                {analytics?.orders?.failed || 0}
              </span>
            </Card>

            <Card accentColor="purple" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Refunded to Wallets</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#8B5CF6', fontSize: 'var(--font-size-sm)' }}>
                {analytics?.orders?.refunded || 0}
              </span>
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
};
