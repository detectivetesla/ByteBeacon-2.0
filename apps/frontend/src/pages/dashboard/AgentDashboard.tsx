import React, { useState, useEffect, useCallback } from 'react';
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
import { NetworkProvider, OrderStatus } from '@bytebeacon/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useWalletBalance } from '../../hooks/useWalletBalance.js';
import { ordersApi } from '../../api/orders.api.js';
import { walletApi, WalletTransactionDto, analyticsApi } from '../../api/wallet.api.js';
import { PeriodStats } from '../../components/dashboard/RevenueTrendChart.js';
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
  PackageX,
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

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { balanceGhs } = useWalletBalance();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('30D');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [orders, setOrders] = useState<AgentOrderRow[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<WalletTransactionDto[]>([]);
  const [revenueData, setRevenueData] = useState<Record<ChartPeriod, PeriodStats> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAgentDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch live agent orders
      const ordersRes = await ordersApi.listAgentOrders({ limit: 20 }).catch(() => null);
      if (ordersRes) {
        const orderList = Array.isArray(ordersRes.orders)
          ? ordersRes.orders
          : Array.isArray(ordersRes.items)
          ? ordersRes.items
          : Array.isArray(ordersRes)
          ? ordersRes
          : [];
        const mapped: AgentOrderRow[] = orderList.map((o: any) => ({
          id: o.id,
          orderReference: o.publicId || o.reference || o.id.slice(0, 8).toUpperCase(),
          recipient: o.recipientPhone || '—',
          network: o.network,
          dataVolume: `${((o.dataAmountMb || 0) / 1024).toFixed(1)} GB`,
          amount: `GH₵ ${((o.amountPesewas || 0) / 100).toFixed(2)}`,
          status: o.orderStatus === OrderStatus.COMPLETED
            ? 'Delivered'
            : o.orderStatus === OrderStatus.FAILED || o.orderStatus === OrderStatus.CANCELLED
            ? 'Failed'
            : 'Pending',
          timeAgo: o.createdAt
            ? new Date(o.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Recently',
        }));
        setOrders(mapped);
      } else {
        setOrders([]);
      }

      // Fetch live deposit ledger
      const txRes = await walletApi.getTransactions({ type: 'DEPOSIT', limit: 5 }).catch(() => null);
      if (txRes && Array.isArray(txRes.transactions)) {
        setRecentDeposits(txRes.transactions);
      } else {
        setRecentDeposits([]);
      }

      // Fetch live revenue trend analytics
      const revRes = await analyticsApi.getRevenueTrend().catch(() => null);
      if (revRes) {
        setRevenueData(revRes as Record<ChartPeriod, PeriodStats>);
      }
    } catch {
      setOrders([]);
      setRecentDeposits([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentDashboardData();
  }, [fetchAgentDashboardData]);


  // Derived live metrics from real backend database data
  const orderCount = orders.length;
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;
  const processingCount = orders.filter((o) => o.status === 'Pending').length;
  const failedCount = orders.filter((o) => o.status === 'Failed').length;
  const deliveredPct = orderCount > 0 ? ((deliveredCount / orderCount) * 100).toFixed(1) : '0';
  const failedPct = orderCount > 0 ? ((failedCount / orderCount) * 100).toFixed(1) : '0';

  const handleRowClick = (row: AgentOrderRow) => {
    setSelectedOrder({
      id: row.id,
      orderNumber: row.orderReference,
      network: row.network,
      recipient: row.recipient,
      dataDisplay: row.dataVolume,
      amountDisplay: row.amount,
      paymentStatus: 'Paid',
      orderStatus: row.status as any,
      dateDisplay: row.timeAgo,
      carrierLatency: '1.2s',
    });
    setDrawerOpen(true);
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || 'Reseller Agent';

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', overflowX: 'hidden' }}>
      <style>{`
        .agent-two-col-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.2fr);
          gap: var(--space-6);
          align-items: stretch;
        }
        .agent-mid-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: var(--space-6);
          align-items: stretch;
        }
        @media (max-width: 1023px) {
          .agent-two-col-grid,
          .agent-mid-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          <Avatar name={displayName} role="agent" status="online" size="md" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
              {user?.email || 'Instant multi-network reseller operations'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" onClick={() => (window.location.href = '/agent/buy-data')} rightIcon={<PlusCircle size={15} strokeWidth={2.4} />}>
            + Buy Data
          </Button>
        </div>
      </div>

      {/* 2. Top 5 Metric Cards (Wallet, Orders, Processing, Delivered, Failed) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
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
              GH₵ {balanceGhs.toFixed(2)}
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
          value={String(orderCount)}
          subtitle="Lifetime fulfilled"
          accent="blue"
          icon={<TactileIcon icon={ShoppingBag} color="orders" size="sm" />}
        />

        {/* Processing Card */}
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
              {processingCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-warning)', fontWeight: 700 }}>
              Orders in progress
            </div>
          </div>
        </Card>

        {/* Delivered Card */}
        <MetricCard
          title="Delivered"
          value={String(deliveredCount)}
          subtitle={`${deliveredPct}% fulfillment`}
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />

        {/* Failed Card */}
        <MetricCard
          title="Failed"
          value={String(failedCount)}
          subtitle={`${failedPct}% refunded`}
          accent="red"
          icon={<TactileIcon icon={AlertCircle} color="speed" size="sm" />}
        />
      </div>

      {/* 3. Performance & Order Health Section */}
      <div className="agent-two-col-grid">
        {/* Left: Dominant Order Health Card */}
        <OrderHealthProgressBar
          data={{ delivered: deliveredCount, pending: processingCount, failed: failedCount, total: orderCount }}
          title="Order Health"
          badgeLabel="Live"
          tooltipText="Proportion of delivered, processing, and failed orders across telecom carriers."
        />

        {/* Right: Revenue Trend SVG Area Chart */}
        <RevenueTrendChart
          data={revenueData}
          initialPeriod={activePeriod}
          onPeriodChange={(p) => setActivePeriod(p)}
          title="Revenue Trend"
        />
      </div>


      {/* 4. Mid Row: Recent Deposits & Operations Stream */}
      <div className="agent-mid-grid">
        {/* Recent Deposits Card */}
        <Card elevated style={{ padding: 'var(--space-5)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
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

          {recentDeposits.length === 0 ? (
            <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
              No deposits recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recentDeposits.map((dep) => (
                <div
                  key={dep.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
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
                        GH₵ {((dep.amountPesewas || 0) / 100).toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block' }}>
                        {dep.description || 'Wallet Top-Up'}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <Badge variant={dep.status === 'COMPLETED' ? 'success' : dep.status === 'PENDING' ? 'warning' : 'danger'} size="sm">
                      {dep.status}
                    </Badge>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.15rem' }}>
                      {dep.createdAt ? new Date(dep.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recently'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Operational Security & Tips Card */}
        <Card elevated style={{ padding: 'var(--space-5)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TactileIcon icon={Zap} color="security" size="sm" />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Operations & SLAs
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Carrier Dispatch Speed</div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                Instant automated delivery across MTN, Telecel, and AT networks.
              </div>
            </div>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Direct Reseller Support</div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                24/7 dedicated support channel for wholesale float inquiries and reconciliations.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. Recent Orders Table */}
      <Card elevated style={{ padding: 'var(--space-5)', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Recent Orders
          </h2>

          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/agent/orders')}>
            View all orders →
          </Button>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Loading recent orders...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
              <PackageX size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                No recent orders
              </h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                Orders placed via your reseller account will stream here in real time.
              </p>
            </div>
          </div>
        ) : (
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
            data={orders}
            keyExtractor={(item) => item.id}
            onRowClick={handleRowClick}
          />
        )}
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
