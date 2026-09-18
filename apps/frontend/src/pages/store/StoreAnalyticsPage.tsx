import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';

interface AnalyticsData {
  monthlyRevenueGhs: number;
  completedOrders: number;
  totalOrders: number;
  successRate: number;
  averageOrderValueGhs: number;
  networkBreakdown: {
    network: string;
    revenueGhs: number;
    orderCount: number;
    percentage: number;
  }[];
  revenueTrend: {
    date: string;
    revenueGhs: number;
  }[];
}

const NETWORK_COLORS: Record<string, string> = {
  MTN: '#FFCC00',
  TELECEL: '#E11D48',
  AIRTELTIGO: '#2563EB',
};

const NETWORK_LABELS: Record<string, string> = {
  MTN: 'MTN',
  TELECEL: 'TELECEL',
  AIRTELTIGO: 'AT',
};

export const StoreAnalyticsPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await storesApi.getStoreAnalytics({ period });
      if (res) {
        const monthlyRevenueGhs = res.monthlyRevenueGhs !== undefined
          ? res.monthlyRevenueGhs
          : Number(((res as any).monthlyRevenuePesewas || 0) / 100);
        const averageOrderValueGhs = res.averageOrderValueGhs !== undefined
          ? res.averageOrderValueGhs
          : Number(((res as any).averageOrderValuePesewas || 0) / 100);
        const networkBreakdown = (res.networkBreakdown || (res as any).networks || []).map((nb: any) => ({
          network: nb.network,
          revenueGhs: nb.revenueGhs !== undefined ? nb.revenueGhs : Number((nb.revenuePesewas || 0) / 100),
          orderCount: nb.orderCount || 0,
          percentage: nb.percentage || 0,
        }));
        const revenueTrend = (res.revenueTrend || (res as any).dailyTrend || []).map((rt: any) => ({
          date: rt.date,
          revenueGhs: rt.revenueGhs !== undefined ? rt.revenueGhs : Number((rt.revenuePesewas || 0) / 100),
          orderCount: (rt as any).orderCount || 0,
        }));

        setData({
          monthlyRevenueGhs,
          completedOrders: res.completedOrders || 0,
          totalOrders: res.totalOrders || 0,
          successRate: res.successRate || 0,
          averageOrderValueGhs,
          networkBreakdown,
          revenueTrend,
        });
      } else if (!isPolling) {
        setError('Failed to load analytics.');
      }
    } catch (err: any) {
      if (!isPolling) {
        setError(err.message || 'An error occurred while fetching analytics.');
        toastError('Error', 'Failed to load store analytics');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [period, toastError]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const handleExportReport = () => {
    if (!data) return;
    const header = 'Date,Revenue (GHS)\n';
    const trendRows = data.revenueTrend.map((r) => `${r.date},${r.revenueGhs.toFixed(2)}`).join('\n');
    const carrierHeader = '\n\nNetwork Carrier,Orders,Revenue (GHS),Share (%)\n';
    const carrierRows = data.networkBreakdown.map((n) => `${n.network},${n.orderCount},${n.revenueGhs.toFixed(2)},${n.percentage.toFixed(1)}%`).join('\n');
    
    const blob = new Blob([header + trendRows + carrierHeader + carrierRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_analytics_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Report Exported', `Analytics report for ${period} downloaded.`);
  };

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Period Selector Tabs */}
          <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-surface-elevated)', padding: '3px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: period === tab.id ? 800 : 600,
                  color: period === tab.id ? '#FFFFFF' : 'var(--color-text-secondary)',
                  backgroundColor: period === tab.id ? '#A855F7' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            leftIcon={<Download size={13} />}
            disabled={loading || !data}
          >
            Export Report
          </Button>
        </div>
      </div>

      {loading ? (
        <Card style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto', marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading analytics...</p>
        </Card>
      ) : error ? (
        <Card style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface)' }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics} style={{ marginTop: 'var(--space-4)' }}>
            Retry
          </Button>
        </Card>
      ) : data ? (
        <>
          {/* Top Analytics Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Monthly Revenue</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {data.monthlyRevenueGhs.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Completed Orders</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                {data.completedOrders}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{data.successRate.toFixed(1)}% success rate</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Orders</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                {data.totalOrders}
              </div>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Average Order Value</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {data.averageOrderValueGhs.toFixed(2)}
              </div>
            </Card>
          </div>

          {/* Revenue Velocity Trend Chart */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Storefront Revenue Trajectory
                </h2>
                <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Daily sales velocity across {period === '7d' ? 'the past 7 days' : period === '30d' ? 'the past 30 days' : 'all-time record'}.
                </p>
              </div>
              <Badge variant="brand" size="sm">
                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
              </Badge>
            </div>

            <div style={{ width: '100%', height: '200px', position: 'relative', marginTop: 'var(--space-4)' }}>
              {data.revenueTrend && data.revenueTrend.length > 0 ? (() => {
                const maxRev = Math.max(...data.revenueTrend.map(r => r.revenueGhs), 1);
                const len = data.revenueTrend.length;
                const getX = (i: number) => 25 + (i * 450 / Math.max(len - 1, 1));
                const getY = (val: number) => 145 - ((val / maxRev) * 120);

                const points = data.revenueTrend.map((r, i) => [getX(i), getY(r.revenueGhs)]);
                const pathD = `M ${points.map(p => p.join(' ')).join(' L ')}`;
                const areaD = `${pathD} L ${getX(len - 1)} 165 L 25 165 Z`;

                return (
                  <svg viewBox="0 0 500 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#A855F7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="20" y1="30" x2="480" y2="30" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
                    <line x1="20" y1="85" x2="480" y2="85" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
                    <line x1="20" y1="145" x2="480" y2="145" stroke="var(--color-border-subtle)" strokeDasharray="3 3" />

                    {/* Area fill */}
                    <path d={areaD} fill="url(#analyticsRevenueGrad)" />

                    {/* Line stroke */}
                    <path d={pathD} fill="none" stroke="#A855F7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data Points */}
                    {points.map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="4" fill="#FFFFFF" stroke="#A855F7" strokeWidth="2.5" />
                    ))}
                  </svg>
                );
              })() : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  No revenue trend data recorded for this period.
                </div>
              )}

              {/* X-axis date labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                {data.revenueTrend && data.revenueTrend.length > 0 ? (
                  <>
                    <span>{data.revenueTrend[0].date}</span>
                    {data.revenueTrend.length > 2 && (
                      <span>{data.revenueTrend[Math.floor(data.revenueTrend.length / 2)].date}</span>
                    )}
                    <span>{data.revenueTrend[data.revenueTrend.length - 1].date}</span>
                  </>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Network Share Breakdown */}
          <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Revenue by Network Carrier
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 var(--space-5) 0' }}>
              Breakdown of data bundles purchased through your storefront.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {data.networkBreakdown.length > 0 ? data.networkBreakdown.map((item) => {
                const color = NETWORK_COLORS[item.network] || '#888888';
                const label = NETWORK_LABELS[item.network] || item.network;
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);

                return (
                  <div key={item.network} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', backgroundColor: `rgba(${r}, ${g}, ${b}, 0.08)`, border: `1px solid rgba(${r}, ${g}, ${b}, 0.3)` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: color, color: item.network === 'MTN' ? '#000000' : '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>{label}</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)' }}>GH₵ {item.revenueGhs.toFixed(2)}</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.percentage}%`, height: '100%', backgroundColor: color }} />
                    </div>
                    <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.35rem' }}>{item.percentage.toFixed(1)}% of total volume ({item.orderCount} orders)</span>
                  </div>
                );
              }) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                  No network data available for this period.
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};
