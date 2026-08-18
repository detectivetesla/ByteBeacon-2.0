import React, { useState } from 'react';
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
import {
  Wallet,
  Smartphone,
  CheckCircle2,
  Clock,
  PlusCircle,
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

const SAMPLE_ORDERS: CustomerOrderRow[] = [
  { id: '1', orderNumber: 'BB-1029', network: NetworkProvider.MTN, recipient: '024 123 4567', dataDisplay: '5 GB', amountDisplay: 'GH₵ 25.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, dateDisplay: 'Today, 14:12' },
  { id: '2', orderNumber: 'BB-1028', network: NetworkProvider.TELECEL, recipient: '020 987 6543', dataDisplay: '10 GB', amountDisplay: 'GH₵ 45.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.PROCESSING, dateDisplay: 'Today, 13:40' },
  { id: '3', orderNumber: 'BB-1027', network: NetworkProvider.MTN, recipient: '054 888 1122', dataDisplay: '2 GB', amountDisplay: 'GH₵ 12.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, dateDisplay: 'Yesterday' },
  { id: '4', orderNumber: 'BB-1026', network: NetworkProvider.AIRTELTIGO, recipient: '026 555 9900', dataDisplay: '20 GB', amountDisplay: 'GH₵ 80.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, dateDisplay: 'Aug 12, 2026' },
  { id: '5', orderNumber: 'BB-1025', network: NetworkProvider.MTN, recipient: '024 333 4455', dataDisplay: '1 GB', amountDisplay: 'GH₵ 6.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, dateDisplay: 'Aug 11, 2026' },
];

const RECENT_ACTIVITIES = [
  { id: 'a1', title: '5 GB MTN Delivered', time: '14m ago', type: 'success' },
  { id: 'a2', title: 'MoMo Payment Authorized', time: '16m ago', type: 'info' },
  { id: 'a3', title: 'GH₵ 100 Wallet Top-up', time: '2h ago', type: 'wallet' },
];

export const CustomerDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredOrders = SAMPLE_ORDERS.filter(
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
      carrierLatency: '1.4s',
    });
    setDrawerOpen(true);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <Avatar name="Caleb Adzokatse" role="customer" status="online" size="md" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Customer Dashboard
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
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <MetricCard
          title="Wallet"
          value="GH₵ 120.00"
          subtitle="Instant checkout"
          accent="amber"
          icon={<TactileIcon icon={Wallet} color="wallet" size="sm" />}
        />

        <MetricCard
          title="Orders"
          value="1,284"
          subtitle="Lifetime purchases"
          accent="blue"
          icon={<TactileIcon icon={Smartphone} color="orders" size="sm" />}
        />

        <MetricCard
          title="Delivered"
          value="1,279"
          subtitle="99.6% delivery rate"
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />

        <MetricCard
          title="Pending"
          value="1"
          subtitle="Queued in carrier"
          accent="orange"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
      </div>

      {/* Order Health Segmented Bar */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <OrderHealthProgressBar
          data={{ delivered: 1279, pending: 1, failed: 4 }}
          title="Order Health"
          badgeLabel="Live"
          tooltipText="Fulfillment confirmation on your mobile data purchases."
        />
      </div>

      {/* Main Workspace: Recent Orders Table + Recent Activity Sidebar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left: Orders Table with Drawer trigger */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
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

            <div style={{ width: '220px' }}>
              <SearchInput
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

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
        </Card>

        {/* Right: Activity Stream */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Live Feed
            </h3>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand)', fontWeight: 800 }}>
              ● REALTIME
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {RECENT_ACTIVITIES.map((act) => {
              const dotColor = act.type === 'success' ? '#22C55E' : act.type === 'info' ? '#3B82F6' : '#F59E0B';
              return (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 'var(--space-2)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {act.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {act.time}
                  </span>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            fullWidth
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => (window.location.href = '/app/transactions')}
          >
            Transactions →
          </Button>
        </Card>
      </div>

      {/* Modal & Detail Drawer */}
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
