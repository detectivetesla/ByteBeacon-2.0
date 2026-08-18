import React, { useState } from 'react';
import { MetricCard, Card } from '../../components/ui/Card/Card.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Badge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
import { OrderDetailDrawer, OrderDetailData } from '../../components/commerce/OrderDetailDrawer.js';
import { RevenueTrendChart, ChartPeriod } from '../../components/dashboard/RevenueTrendChart.js';
import { OrderHealthProgressBar } from '../../components/dashboard/OrderHealthProgressBar.js';
import { NetworkProvider } from '@bytebeacon/shared';
import {
  Wallet,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Clock,
  ArrowDownToLine,
  ShieldCheck,
  Zap,
  CreditCard,
} from 'lucide-react';

interface AgentOrderRow {
  id: string;
  orderReference: string;
  recipient: string;
  network: NetworkProvider;
  dataVolume: string;
  amount: string;
  status: 'Delivered' | 'Pending' | 'Failed';
  timeAgo: string;
}

const AGENT_SAMPLE_ORDERS: AgentOrderRow[] = [
  { id: '1', orderReference: 'TXN-0D3FD4534305', recipient: '0549055308', network: NetworkProvider.MTN, dataVolume: '10 GB', amount: 'GH₵ 57.00', status: 'Delivered', timeAgo: '29m ago' },
  { id: '2', orderReference: 'TXN-966B2A394533', recipient: '0202453213', network: NetworkProvider.TELECEL, dataVolume: '5 GB', amount: 'GH₵ 35.50', status: 'Delivered', timeAgo: '2h ago' },
  { id: '3', orderReference: 'TXN-E1E1DEBBD317', recipient: '0534109200', network: NetworkProvider.MTN, dataVolume: '2 GB', amount: 'GH₵ 15.20', status: 'Delivered', timeAgo: '4h ago' },
  { id: '4', orderReference: 'TXN-60598656AC6A', recipient: '0549055308', network: NetworkProvider.MTN, dataVolume: '3 GB', amount: 'GH₵ 19.00', status: 'Delivered', timeAgo: '1d ago' },
  { id: '5', orderReference: 'TXN-25AA64F95035', recipient: '0550124482', network: NetworkProvider.MTN, dataVolume: '1 GB', amount: 'GH₵ 3.80', status: 'Delivered', timeAgo: '1d ago' },
  { id: '6', orderReference: 'TXN-5652E19ACEBB', recipient: '0549420473', network: NetworkProvider.MTN, dataVolume: '3 GB', amount: 'GH₵ 19.00', status: 'Delivered', timeAgo: '2d ago' },
];

const PERIOD_METRICS: Record<
  ChartPeriod,
  {
    revenue: string;
    revenueTrend: string;
    orderCount: number;
    orderTrend: string;
    processing: number;
    delivered: number;
    failed: number;
  }
> = {
  '7D': {
    revenue: 'GH₵ 6,420.00',
    revenueTrend: '↑ 8.4%',
    orderCount: 34,
    orderTrend: '↑ 2.1%',
    processing: 1,
    delivered: 33,
    failed: 0,
  },
  '30D': {
    revenue: 'GH₵ 28,450.00',
    revenueTrend: '↑ 14.2%',
    orderCount: 142,
    orderTrend: '↑ 4.1%',
    processing: 3,
    delivered: 138,
    failed: 1,
  },
  '90D': {
    revenue: 'GH₵ 82,100.00',
    revenueTrend: '↑ 22.5%',
    orderCount: 418,
    orderTrend: '↑ 11.2%',
    processing: 6,
    delivered: 409,
    failed: 3,
  },
  '1Y': {
    revenue: 'GH₵ 312,800.00',
    revenueTrend: '↑ 35.1%',
    orderCount: 1620,
    orderTrend: '↑ 28.4%',
    processing: 18,
    delivered: 1588,
    failed: 14,
  },
};

const RECENT_DEPOSITS = [
  { id: 'dep-1', amount: 'GH₵ 500.00', method: 'Mobile Money', status: 'Successful', time: '1h ago' },
  { id: 'dep-2', amount: 'GH₵ 200.00', method: 'Mobile Money', status: 'Successful', time: 'Yesterday' },
  { id: 'dep-3', amount: 'GH₵ 100.00', method: 'Card Payment', status: 'Successful', time: '3d ago' },
];

const TOP_PACKAGES = [
  { id: 'tp-1', network: NetworkProvider.MTN, name: 'MTN 10GB', sold: 42, color: '#EAB308', pct: 85 },
  { id: 'tp-2', network: NetworkProvider.MTN, name: 'MTN 5GB', sold: 31, color: '#EAB308', pct: 62 },
  { id: 'tp-3', network: NetworkProvider.TELECEL, name: 'Telecel 5GB', sold: 24, color: '#EF4444', pct: 48 },
  { id: 'tp-4', network: NetworkProvider.AIRTELTIGO, name: 'AirtelTigo 10GB', sold: 18, color: '#3B82F6', pct: 36 },
];

export const AgentDashboard: React.FC = () => {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('30D');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const metrics = PERIOD_METRICS[activePeriod];
  const deliveredPct = metrics.orderCount > 0 ? ((metrics.delivered / metrics.orderCount) * 100).toFixed(1) : '0';
  const failedPct = metrics.orderCount > 0 ? ((metrics.failed / metrics.orderCount) * 100).toFixed(1) : '0';

  const handleRowClick = (row: AgentOrderRow) => {
    setSelectedOrder({
      id: row.id,
      orderNumber: row.orderReference,
      network: row.network,
      recipient: row.recipient,
      dataDisplay: row.dataVolume,
      amountDisplay: row.amount,
      paymentStatus: 'Paid',
      orderStatus: row.status,
      dateDisplay: row.timeAgo,
      carrierLatency: '1.2s',
    });
    setDrawerOpen(true);
  };

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header Bar: Compact & Minimal */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <Avatar name="Kofi Reseller" role="agent" status="online" size="md" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Store Dashboard
              </h1>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-agent-surface)',
                  border: '1px solid var(--color-agent-border)',
                  color: 'var(--color-agent)',
                  textTransform: 'uppercase',
                }}
              >
                RESELLER
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <Button variant="primary" size="sm" onClick={() => (window.location.href = '/agent/buy-data')} rightIcon={<PlusCircle size={15} strokeWidth={2.4} />}>
            + Buy Data
          </Button>
        </div>
      </div>

      {/* 2. Top 5 Metric Cards (Wallet, Orders, Processing, Delivered, Failed) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Wallet Balance Card */}
        <Card
          elevated
          style={{
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-warning-border)',
            background: 'linear-gradient(145deg, var(--color-warning-surface), var(--color-bg-surface))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Wallet
            </span>
            <TactileIcon icon={Wallet} color="wallet" size="sm" />
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              GH₵ 1,450.00
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
              Available balance
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => (window.location.href = '/agent/wallet')}
              style={{
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 800,
                color: 'var(--color-warning)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              + Deposit
            </button>
            <span style={{ color: 'var(--color-border-default)' }}>|</span>
            <button
              type="button"
              onClick={() => (window.location.href = '/agent/withdrawals')}
              style={{
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 800,
                color: 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Withdraw →
            </button>
          </div>
        </Card>

        {/* Total Orders Card */}
        <MetricCard
          title="Total Orders"
          value={String(metrics.orderCount)}
          subtitle={`${activePeriod === '1Y' ? '12 months' : activePeriod.toLowerCase()} ${metrics.orderTrend}`}
          accent="blue"
          icon={<TactileIcon icon={ShoppingBag} color="orders" size="sm" />}
        />

        {/* Processing Card (Amber Pulse) */}
        <Card
          elevated
          style={{
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-warning-border)',
            background: 'linear-gradient(145deg, var(--color-warning-surface), var(--color-bg-surface))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 0 8px #F59E0B',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Processing
              </span>
            </div>
            <TactileIcon icon={Clock} color="speed" size="sm" />
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              {metrics.processing}
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-warning)', fontWeight: 700 }}>
              Orders in progress
            </div>
          </div>
        </Card>

        {/* Delivered Card */}
        <MetricCard
          title="Delivered"
          value={String(metrics.delivered)}
          subtitle={`${deliveredPct}% fulfillment`}
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />

        {/* Failed Card */}
        <MetricCard
          title="Failed"
          value={String(metrics.failed)}
          subtitle={`${failedPct}% refunded`}
          accent="red"
          icon={<TactileIcon icon={AlertCircle} color="speed" size="sm" />}
        />
      </div>

      {/* 3. Performance & Order Health Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1.2fr)',
          gap: 'var(--space-6)',
          alignItems: 'stretch',
        }}
      >
        {/* Left: Dominant Order Health Card */}
        <OrderHealthProgressBar
          data={{ delivered: metrics.delivered, pending: metrics.processing, failed: metrics.failed, total: metrics.orderCount }}
          title="Order Health"
          badgeLabel="Live"
          tooltipText="Proportion of delivered, processing, and failed orders across telecom carriers."
        />

        {/* Right: Revenue Trend SVG Area Chart */}
        <RevenueTrendChart
          initialPeriod={activePeriod}
          onPeriodChange={(p) => setActivePeriod(p)}
          title="Revenue Trend"
        />
      </div>

      {/* 4. Mid Row: Recent Deposits & Top Packages */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 'var(--space-6)',
          alignItems: 'stretch',
        }}
      >
        {/* Recent Deposits Card */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={ArrowDownToLine} color="wallet" size="sm" />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Recent Deposits
              </h2>
            </div>

            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/agent/wallet')}>
              View all →
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {RECENT_DEPOSITS.map((dep) => (
              <div
                key={dep.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <CreditCard size={16} color="var(--color-warning)" />
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                      {dep.amount}
                    </strong>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>
                      {dep.method}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Badge variant="success" size="sm">
                    {dep.status}
                  </Badge>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.15rem' }}>
                    {dep.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Packages Card */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={Zap} color="security" size="sm" />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Top Packages
              </h2>
            </div>

            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/agent/buy-data')}>
              View all →
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {TOP_PACKAGES.map((pkg) => (
              <div key={pkg.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <NetworkBadge network={pkg.network} size="sm" />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {pkg.name}
                    </span>
                  </div>
                  <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                    {pkg.sold} sold
                  </strong>
                </div>

                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-bg-base)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${pkg.pct}%`, height: '100%', backgroundColor: pkg.color, borderRadius: '999px' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 5. Recent Orders Table */}
      <Card elevated style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Recent Orders
          </h2>

          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/agent/orders')}>
            View all orders →
          </Button>
        </div>

        <Table<AgentOrderRow>
          columns={[
            {
              header: 'Network',
              accessor: 'network',
              render: (row) => <NetworkBadge network={row.network} size="sm" />,
            },
            {
              header: 'Recipient',
              accessor: 'recipient',
              render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.recipient}</span>,
            },
            {
              header: 'Bundle',
              accessor: 'dataVolume',
              render: (row) => <strong style={{ color: 'var(--color-text-primary)' }}>{row.dataVolume}</strong>,
            },
            {
              header: 'Amount',
              accessor: 'amount',
              render: (row) => (
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)' }}>{row.amount}</span>
              ),
            },
            {
              header: 'Status',
              accessor: 'status',
              render: (row) => (
                <Badge variant={row.status === 'Delivered' ? 'success' : row.status === 'Pending' ? 'warning' : 'danger'} size="sm">
                  {row.status}
                </Badge>
              ),
            },
            {
              header: 'Age',
              accessor: 'timeAgo',
              render: (row) => (
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  {row.timeAgo}
                </span>
              ),
            },
          ]}
          data={AGENT_SAMPLE_ORDERS}
          keyExtractor={(item) => item.id}
          onRowClick={handleRowClick}
        />
      </Card>

      {/* 6. Compact Operational Information Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Card
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <TactileIcon icon={Clock} color="speed" size="sm" />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Working Hours
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
              7:00 AM – 10:00 PM daily. Off-hours orders queue for next-day dispatch.
            </div>
          </div>
        </Card>

        <Card
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <TactileIcon icon={Zap} color="security" size="sm" />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Delivery Time
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
              Instant to 15 seconds. Peak network congestions may take up to 2 hours.
            </div>
          </div>
        </Card>

        <Card
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <TactileIcon icon={ShieldCheck} color="analytics" size="sm" />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Security Tips
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
              Never share login credentials or API keys. Always verify SIM numbers before submitting.
            </div>
          </div>
        </Card>
      </div>

      {/* Modal & Drawer */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialNetwork={NetworkProvider.MTN}
      />

      <OrderDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
};
