import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { Table } from '../../components/ui/Table/Table.js';
import { useNavigate } from 'react-router-dom';
import { storesApi, StoreDashboardDto, StoreOrderRecordDto } from '../../api/stores.api.js';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Eye,
  ArrowUpRight,
  Package,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Filter,
  PackageX,
} from 'lucide-react';

export const StoreDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<StoreDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [storeOrders, setStoreOrders] = useState<StoreOrderRecordDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterNetwork, setFilterNetwork] = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSort, setFilterSort] = useState('newest');

  const activeFilterCount =
    (filterStatus ? 1 : 0) +
    (filterPayment ? 1 : 0) +
    (filterNetwork ? 1 : 0) +
    (filterDatePreset || filterStartDate || filterEndDate ? 1 : 0) +
    (filterSort !== 'newest' ? 1 : 0);

  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterStatus('');
    setFilterPayment('');
    setFilterNetwork('');
    setFilterDatePreset('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSort('newest');
  };

  useEffect(() => {
    let mounted = true;
    const fetchDashboard = () => {
      storesApi.getStoreDashboard().then((res) => {
        if (!mounted) return;
        if (res && res.kpis) {
          setData(res);
        } else {
          if (!data) setError('Failed to load dashboard data');
        }
        setLoading(false);
      }).catch((err) => {
        if (!mounted) return;
        if (!data) setError(err.message || 'Error loading data');
        setLoading(false);
      });
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch filtered orders
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await storesApi.getStoreOrders({
        limit: 20,
        ...(filterSearch ? { search: filterSearch } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterPayment ? { paymentStatus: filterPayment } : {}),
        ...(filterNetwork ? { network: filterNetwork } : {}),
        ...(filterDatePreset && filterDatePreset !== 'custom' ? { dateRange: filterDatePreset } : {}),
        ...(filterDatePreset === 'custom' && filterStartDate ? { startDate: filterStartDate } : {}),
        ...(filterDatePreset === 'custom' && filterEndDate ? { endDate: filterEndDate } : {}),
        ...(filterSort ? { sort: filterSort } : {}),
      });
      setStoreOrders(Array.isArray(res?.orders) ? res.orders : []);
    } catch {
      setStoreOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [filterStatus, filterPayment, filterNetwork, filterDatePreset, filterStartDate, filterEndDate, filterSort]);

  // Re-fetch when dropdown filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { fetchOrders(); }, 400);
    return () => clearTimeout(timer);
  }, [filterSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '2rem', textAlign: 'center' }}>
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '2rem', textAlign: 'center', color: 'var(--color-danger)' }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { store, kpis, orderHealth, revenueTrend } = data;
  const storeSlug = store?.slug || '';
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

      {/* 2. Top-Level KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={15} color="#3B82F6" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            GH₵ {kpis.todaySalesGhs.toFixed(2)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', minHeight: '18px' }}>
            <span>Total: GH₵ {(kpis.totalSalesGhs || 0).toFixed(2)}</span>
          </div>
        </Card>

        {/* Reseller Profit Markup */}
        <Card
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '6px 6px 16px rgba(16, 24, 40, 0.04), -4px -4px 12px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Reseller Profit
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={15} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            GH₵ {((kpis.totalProfitGhs !== undefined ? kpis.totalProfitGhs : (kpis.todayProfitGhs || 0))).toFixed(2)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>Saturday payout</span>
            <button
              type="button"
              onClick={() => navigate('/agent/withdrawals')}
              style={{ background: 'none', border: 'none', color: '#10B981', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Withdraw &rarr;
            </button>
          </div>
        </Card>

        {/* Orders Today */}
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
            {kpis.ordersTodayCount !== undefined ? kpis.ordersTodayCount : kpis.ordersCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', minHeight: '18px' }}>
            <span>Total: {kpis.totalOrdersCount !== undefined ? kpis.totalOrdersCount : kpis.ordersCount} orders</span>
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
            {kpis.customersCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', minHeight: '18px' }}>
            <span>Unique buyers</span>
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
            {kpis.storeVisits || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700, minHeight: '18px' }}>
            <span>{(kpis.storeVisits || 0) > 0 ? ((((kpis.totalOrdersCount !== undefined ? kpis.totalOrdersCount : kpis.ordersCount)) / kpis.storeVisits) * 100).toFixed(1) : '0.0'}% conversion rate</span>
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
            {revenueTrend && revenueTrend.length > 0 ? (() => {
              const maxRev = Math.max(...revenueTrend.map(r => r.revenueGhs), 1);
              const getX = (i: number) => 20 + (i * 460 / Math.max(revenueTrend.length - 1, 1));
              const getY = (val: number) => 130 - ((val / maxRev) * 110);
              
              const points = revenueTrend.map((r, i) => [getX(i), getY(r.revenueGhs)]);
              const pathD = `M ${points.map(p => p.join(' ')).join(' L ')}`;
              const areaD = `${pathD} L 480 150 L 20 150 Z`;

              return (
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
                  <path d={areaD} fill="url(#storeRevenueGrad)" />

                  {/* Line */}
                  <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="3.2" strokeLinecap="round" />

                  {/* Data points */}
                  {points.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="4.5" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2.5" />
                  ))}
                </svg>
              );
            })() : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                No revenue data available
              </div>
            )}

            {/* X-Axis labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
              {revenueTrend && revenueTrend.length > 0 ? revenueTrend.map((r, i) => (
                <span key={i}>{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              )) : null}
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
            {(() => {
              const totalOrders = orderHealth.completed + orderHealth.processing + orderHealth.pending + orderHealth.failed;
              const safePercent = (val: number) => totalOrders > 0 ? ((val / totalOrders) * 100).toFixed(1) : '0.0';

              return (
                <>
                  {/* Delivered */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                        <CheckCircle2 size={13} color="#10B981" />
                        Delivered
                      </span>
                      <strong style={{ color: '#10B981', fontFamily: 'var(--font-data)' }}>{orderHealth.completed} Orders ({safePercent(orderHealth.completed)}%)</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${safePercent(orderHealth.completed)}%`, height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Processing */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                        <Clock size={13} color="#3B82F6" />
                        Processing
                      </span>
                      <strong style={{ color: '#3B82F6', fontFamily: 'var(--font-data)' }}>{orderHealth.processing} Orders ({safePercent(orderHealth.processing)}%)</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${safePercent(orderHealth.processing)}%`, height: '100%', background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Pending */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                        <RotateCcw size={13} color="#F59E0B" />
                        Pending
                      </span>
                      <strong style={{ color: '#F59E0B', fontFamily: 'var(--font-data)' }}>{orderHealth.pending} Orders ({safePercent(orderHealth.pending)}%)</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${safePercent(orderHealth.pending)}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Failed */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                        <Package size={13} color="var(--color-danger)" />
                        Failed
                      </span>
                      <strong style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-data)' }}>{orderHealth.failed} Orders ({safePercent(orderHealth.failed)}%)</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${safePercent(orderHealth.failed)}%`, height: '100%', backgroundColor: 'var(--color-danger)', borderRadius: '4px' }} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <Button variant="outline" size="sm" fullWidth onClick={() => navigate('/store-console/orders')} rightIcon={<ArrowRight size={13} />}>
              View All Store Orders
            </Button>
          </div>
        </Card>
      </div>

      {/* 4. Recent Store Orders with Filters */}
      <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Recent Store Orders
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/store-console/orders')} rightIcon={<ArrowRight size={13} />}>
            View All Orders
          </Button>
        </div>

        {/* Filter Bar */}
        <style>{`
          .store-filter-bar {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            flex-wrap: wrap;
            margin-bottom: var(--space-4);
            padding: var(--space-3) var(--space-4);
            background: var(--color-bg-base);
            border-radius: var(--radius-xl);
            border: 1px solid var(--color-border-subtle);
          }
          .store-filter-bar .sf-search-input {
            flex: 1;
            min-width: 180px;
            max-width: 280px;
            padding: 0.45rem 0.7rem 0.45rem 2rem;
            font-size: var(--font-size-xs);
            border-radius: var(--radius-lg);
            border: 1px solid var(--color-border-default);
            background: var(--color-bg-surface);
            color: var(--color-text-primary);
            font-family: inherit;
            outline: none;
            transition: border-color 0.15s;
          }
          .store-filter-bar .sf-search-input:focus {
            border-color: #3B82F6;
          }
          .store-filter-bar .sf-search-input::placeholder {
            color: var(--color-text-muted);
          }
          .store-filter-bar select.sf-select {
            padding: 0.45rem 0.6rem;
            font-size: var(--font-size-xs);
            border-radius: var(--radius-lg);
            border: 1px solid var(--color-border-default);
            background: var(--color-bg-surface);
            color: var(--color-text-primary);
            font-family: inherit;
            cursor: pointer;
            min-width: 120px;
            outline: none;
          }
          .store-filter-bar select.sf-select:focus {
            border-color: #3B82F6;
          }
          @media (max-width: 767px) {
            .store-filter-bar {
              flex-direction: column;
              align-items: stretch;
            }
            .store-filter-bar .sf-search-input {
              max-width: 100%;
            }
          }
        `}</style>
        <div className="store-filter-bar">
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="sf-search-input"
              placeholder="Search phone, ref..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="sf-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Delivered</option>
            <option value="FAILED">Failed</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="READY_FOR_FULFILLMENT">Ready to Process</option>
          </select>

          {/* Payment Status Filter */}
          <select
            className="sf-select"
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Date Filter */}
          <select
            className="sf-select"
            value={filterDatePreset}
            onChange={(e) => {
              setFilterDatePreset(e.target.value);
              if (e.target.value !== 'custom') {
                setFilterStartDate('');
                setFilterEndDate('');
              }
            }}
          >
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="14d">Last 14 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range...</option>
          </select>

          {/* Custom Date Inputs */}
          {filterDatePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="date"
                className="sf-select"
                style={{ padding: '0.35rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                placeholder="Start date"
              />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>to</span>
              <input
                type="date"
                className="sf-select"
                style={{ padding: '0.35rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                placeholder="End date"
              />
            </div>
          )}

          {/* Network Filter */}
          <select
            className="sf-select"
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
          >
            <option value="">All Networks</option>
            <option value="MTN">MTN</option>
            <option value="TELECEL">Telecel</option>
            <option value="AIRTELTIGO">AirtelTigo</option>
          </select>

          {/* Sort Filter */}
          <select
            className="sf-select"
            value={filterSort}
            onChange={(e) => setFilterSort(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>

          {/* Reset Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RotateCcw size={12} />}
              style={{ fontSize: 'var(--font-size-2xs)', whiteSpace: 'nowrap' }}
            >
              Reset ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* Orders Table */}
        {ordersLoading ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Loading orders...
          </div>
        ) : storeOrders.length === 0 ? (
          <div style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
              <PackageX size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                {activeFilterCount > 0 || filterSearch ? 'No orders match your filters' : 'No store orders yet'}
              </h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                {activeFilterCount > 0 || filterSearch ? 'Try adjusting your search or filter criteria.' : 'Customer orders will appear here once your store receives its first order.'}
              </p>
            </div>
          </div>
        ) : (
          <Table<StoreOrderRecordDto>
            columns={[
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => <NetworkBadge network={row.network as any} size="sm" />,
              },
              {
                header: 'Recipient',
                accessor: 'recipientPhone',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.recipientPhone}</span>,
              },
              {
                header: 'Bundle',
                accessor: 'dataAmountMb',
                render: (row) => <strong style={{ color: 'var(--color-text-primary)' }}>{row.dataLabel || `${(row.dataAmountMb / 1024).toFixed(1)} GB`}</strong>,
              },
              {
                header: 'Amount',
                accessor: 'amountPesewas',
                render: (row) => (
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)' }}>GH₵ {(row.amountPesewas / 100).toFixed(2)}</span>
                ),
              },
              {
                header: 'Profit',
                accessor: 'profitPesewas' as any,
                render: (row) => (
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)', color: '#10B981' }}>
                    {row.profitPesewas != null ? `GH₵ ${(row.profitPesewas / 100).toFixed(2)}` : '—'}
                  </span>
                ),
              },
              {
                header: 'Status',
                accessor: 'orderStatus',
                render: (row) => (
                  <Badge variant={row.orderStatus === 'COMPLETED' ? 'success' : row.orderStatus === 'FAILED' || row.orderStatus === 'CANCELLED' ? 'danger' : 'warning'} size="sm">
                    {row.orderStatus === 'COMPLETED' ? 'Delivered' : row.orderStatus === 'FAILED' ? 'Failed' : row.orderStatus === 'CANCELLED' ? 'Cancelled' : 'Pending'}
                  </Badge>
                ),
              },
              {
                header: 'Date',
                accessor: 'createdAt',
                render: (row) => (
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                ),
              },
            ]}
            data={storeOrders}
            keyExtractor={(item) => item.id}
          />
        )}
      </Card>
    </div>
  );
};
