import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { OrderStatusBadge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
import { OrderDetailDrawer, OrderDetailData } from '../../components/commerce/OrderDetailDrawer.js';
import { OrderHealthProgressBar } from '../../components/dashboard/OrderHealthProgressBar.js';
import { NetworkProvider, PaymentStatus, OrderStatus } from '@bytebeacon/shared';
import { useAuth } from '../../context/AuthContext.js';
import { useWalletBalance } from '../../hooks/useWalletBalance.js';
import { ordersApi } from '../../api/orders.api.js';
import {
  Wallet,
  Smartphone,
  CheckCircle2,
  Clock,
  PlusCircle,
  PackageX,
  Activity,
} from 'lucide-react';

interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  network: NetworkProvider;
  recipient: string;
  dataDisplay: string;
  amountDisplay: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  dateDisplay: string;
}

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { balanceGhs, refresh: refreshBalance } = useWalletBalance();
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      refreshBalance();

      // Fetch real user orders
      const ordersRes = await ordersApi.listOrders({ limit: 20 }).catch(() => null);
      if (ordersRes && Array.isArray(ordersRes.orders)) {
        const mapped: CustomerOrderRow[] = ordersRes.orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.publicId || o.reference || o.id.slice(0, 8).toUpperCase(),
          network: o.network,
          recipient: o.recipientPhone || '—',
          dataDisplay: `${((o.dataAmountMb || 0) / 1024).toFixed(1)} GB`,
          amountDisplay: `GH₵ ${((o.amountPesewas || 0) / 100).toFixed(2)}`,
          paymentStatus: o.paymentStatus || PaymentStatus.PENDING,
          orderStatus: o.orderStatus || OrderStatus.PENDING,
          dateDisplay: o.createdAt
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
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived metrics
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(
    (o) => o.orderStatus === OrderStatus.COMPLETED || o.orderStatus === OrderStatus.DELIVERED,
  ).length;
  const pendingOrders = orders.filter(
    (o) => o.orderStatus === OrderStatus.PENDING || o.orderStatus === OrderStatus.PROCESSING,
  ).length;
  const failedOrders = orders.filter(
    (o) => o.orderStatus === OrderStatus.FAILED || o.orderStatus === OrderStatus.CANCELLED,
  ).length;

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.recipient.includes(searchQuery) ||
      o.network.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRowClick = (row: CustomerOrderRow) => {
    setSelectedOrder({
      id: row.id,
      orderNumber: row.orderNumber,
      network: row.network,
      recipient: row.recipient,
      dataDisplay: row.dataDisplay,
      amountDisplay: row.amountDisplay,
      paymentStatus: row.paymentStatus,
      orderStatus: row.orderStatus,
      dateDisplay: row.dateDisplay,
      carrierLatency: '1.2s',
    });
    setDrawerOpen(true);
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || 'Customer';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .customer-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: var(--space-6);
          alignItems: start;
        }
        @media (max-width: 1023px) {
          .customer-dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          <Avatar name={displayName} role="customer" status="online" size="md" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome, {displayName}
              </h1>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-info-surface)',
                  border: '1px solid var(--color-info-border)',
                  color: 'var(--color-info)',
                  textTransform: 'uppercase',
                }}
              >
                CUSTOMER
              </span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
              {user?.email || 'Instant multi-network data fulfillment'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/app/wallet')}>
            Fund Wallet
          </Button>
          <Button variant="primary" size="sm" onClick={() => setPurchaseModalOpen(true)} rightIcon={<PlusCircle size={15} strokeWidth={2.4} />}>
            + Buy Data
          </Button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <MetricCard
          title="Wallet Balance"
          value={`GH₵ ${balanceGhs.toFixed(2)}`}
          subtitle="Instant checkout balance"
          accent="amber"
          icon={<TactileIcon icon={Wallet} color="wallet" size="sm" />}
        />

        <MetricCard
          title="Total Orders"
          value={String(totalOrders)}
          subtitle="Lifetime purchases"
          accent="blue"
          icon={<TactileIcon icon={Smartphone} color="orders" size="sm" />}
        />

        <MetricCard
          title="Delivered"
          value={String(deliveredOrders)}
          subtitle={totalOrders > 0 ? `${Math.round((deliveredOrders / totalOrders) * 100)}% delivery rate` : '100% SLA'}
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />

        <MetricCard
          title="In-Progress"
          value={String(pendingOrders)}
          subtitle="Awaiting carrier"
          accent="orange"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
      </div>

      {/* Order Health Segmented Bar */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <OrderHealthProgressBar
          data={{ delivered: deliveredOrders, pending: pendingOrders, failed: failedOrders }}
          title="Order Health"
          badgeLabel="Live"
          tooltipText="Real-time fulfillment metrics on your mobile data purchases."
        />
      </div>

      {/* Main Workspace: Recent Orders Table + Recent Activity Sidebar */}
      <div className="customer-dashboard-grid">
        {/* Left: Orders Table with Drawer trigger */}
        <Card elevated style={{ padding: 'var(--space-5)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Recent Orders
            </h2>

            <div style={{ width: 'min(240px, 100%)' }}>
              <SearchInput
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-10) var(--space-4)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <PackageX size={28} />
              </div>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  No orders found
                </h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                  {searchQuery ? `No records matching "${searchQuery}"` : 'You have not placed any mobile data orders yet.'}
                </p>
              </div>
              {!searchQuery && (
                <Button variant="primary" size="sm" onClick={() => setPurchaseModalOpen(true)} leftIcon={<PlusCircle size={14} />}>
                  Buy Data Bundle
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table<CustomerOrderRow>
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
                    accessor: 'dataDisplay',
                    render: (row) => <strong style={{ color: 'var(--color-text-primary)' }}>{row.dataDisplay}</strong>,
                  },
                  {
                    header: 'Amount',
                    accessor: 'amountDisplay',
                    render: (row) => (
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)' }}>{row.amountDisplay}</span>
                    ),
                  },
                  {
                    header: 'Delivery',
                    accessor: 'orderStatus',
                    render: (row) => <OrderStatusBadge status={row.orderStatus} size="sm" />,
                  },
                  {
                    header: 'Date',
                    accessor: 'dateDisplay',
                    render: (row) => (
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                        {row.dateDisplay}
                      </span>
                    ),
                  },
                ]}
                data={filteredOrders}
                keyExtractor={(item) => item.id}
                onRowClick={handleRowClick}
              />

              <div style={{ marginTop: 'var(--space-3)' }}>
                <Pagination
                  currentPage={1}
                  totalPages={1}
                  onPageChange={() => {}}
                  itemsPerPage={10}
                  totalItems={filteredOrders.length}
                />
              </div>
            </>
          )}
        </Card>

        {/* Right: Activity Stream */}
        <Card elevated style={{ padding: 'var(--space-5)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: '0.25rem' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Live Feed
            </h3>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand)', fontWeight: 800 }}>
              ● REALTIME
            </span>
          </div>

          {orders.length === 0 ? (
            <div style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}>
              <div style={{ padding: '0.5rem', display: 'inline-block', borderRadius: '50%', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                <Activity size={18} />
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                Live dispatch updates will stream here as you place orders.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {orders.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    paddingBottom: 'var(--space-2)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: o.orderStatus === OrderStatus.COMPLETED ? '#22C55E' : '#F59E0B',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                      {o.dataDisplay} {o.network}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {o.dateDisplay}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            fullWidth
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => (window.location.href = '/app/orders')}
          >
            All Orders →
          </Button>
        </Card>
      </div>

      {/* Modal & Detail Drawer */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false);
          fetchDashboardData();
        }}
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
