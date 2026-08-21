import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { adminApi, AdminAnalyticsOverview } from '../../api/admin.api.js';
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Cpu,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<string>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAnalyticsOverview(range);
      if (res) {
        setAnalytics(res);
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

  const totalVolumeGhs = ((analytics?.revenue?.lifetimePesewas || 0) / 100).toFixed(2);
  const monthVolumeGhs = ((analytics?.revenue?.monthPesewas || 0) / 100).toFixed(2);
  const todayVolumeGhs = ((analytics?.revenue?.todayPesewas || 0) / 100).toFixed(2);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <BarChart3 size={22} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Platform Analytics
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Authoritative order volume, telecom network distribution, and revenue growth across ByteBeacon 2.0.
          </p>
        </div>

        {/* Range Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-surface)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
          {['7d', '30d', '90d', 'all'].map((r) => (
            <Button
              key={r}
              variant={range === r ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setRange(r)}
              style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: 'var(--font-size-2xs)' }}
            >
              {r === 'all' ? 'All Time' : `${r.replace('d', ' Days')}`}
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
          marginBottom: 'var(--space-6)',
        }}
      >
        <MetricCard
          title="Period Revenue"
          value={`GH₵ ${monthVolumeGhs}`}
          subvalue={`Today: GH₵ ${todayVolumeGhs}`}
          icon={<DollarSign size={20} color="#10B981" />}
        />
        <MetricCard
          title="Total Orders"
          value={(analytics?.orders?.total || 0).toLocaleString()}
          subvalue={`${analytics?.orders?.completionRate || 100}% Completion Rate`}
          icon={<Package size={20} color="#3B82F6" />}
        />
        <MetricCard
          title="Total User Base"
          value={(analytics?.users?.total || 0).toLocaleString()}
          subvalue={`${analytics?.users?.agents || 0} Agents • ${analytics?.users?.customers || 0} Customers`}
          icon={<Users size={20} color="#8B5CF6" />}
        />
        <MetricCard
          title="Active Storefronts"
          value={(analytics?.stores?.active || 0).toLocaleString()}
          subvalue={`${analytics?.stores?.total || 0} Registered Stores`}
          icon={<TrendingUp size={20} color="#F97316" />}
        />
      </div>

      {/* Grid: Network Breakdown & Order Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Network Breakdown Card */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Telecom Network Distribution
            </h3>
            <Badge variant="brand" size="sm">Real Volume</Badge>
          </div>

          <Table
            columns={[
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          row.network === 'MTN'
                            ? '#FBBF24'
                            : row.network === 'TELECEL'
                            ? '#EF4444'
                            : '#3B82F6',
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{row.network}</span>
                  </div>
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
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Order Lifecycle Breakdown
            </h3>
            <Badge variant="success" size="sm">Settled</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Completed / Delivered</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10B981' }}>
                {analytics?.orders?.completed || 0}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Processing / In Flight</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#3B82F6' }}>
                {analytics?.orders?.processing || 0}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Failed / Cancelled</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#EF4444' }}>
                {analytics?.orders?.failed || 0}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Refunded to Wallets</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#8B5CF6' }}>
                {analytics?.orders?.refunded || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
