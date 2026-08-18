import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { OrderStatusBadge, PaymentStatusBadge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { Download, RefreshCw } from 'lucide-react';

interface AdminOrderRow {
  id: string;
  orderNumber: string;
  network: NetworkProvider;
  customerEmail: string;
  recipient: string;
  packageDisplay: string;
  amountDisplay: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  providerSync: string;
  createdAt: string;
}

const SAMPLE_ORDERS: AdminOrderRow[] = [
  { id: '1', orderNumber: 'BB-1029', network: NetworkProvider.MTN, customerEmail: 'dev.customer@bytebeacon.local', recipient: '024 123 4567', packageDisplay: '5 GB', amountDisplay: 'GH₵ 25.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, providerSync: 'CONFIRMED', createdAt: 'Today, 14:12' },
  { id: '2', orderNumber: 'BB-1028', network: NetworkProvider.TELECEL, customerEmail: 'dev.agent@bytebeacon.local', recipient: '020 987 6543', packageDisplay: '10 GB', amountDisplay: 'GH₵ 45.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.PROCESSING, providerSync: 'QUEUED', createdAt: 'Today, 13:40' },
  { id: '3', orderNumber: 'BB-1027', network: NetworkProvider.MTN, customerEmail: 'kwame@example.com', recipient: '054 888 1122', packageDisplay: '2 GB', amountDisplay: 'GH₵ 12.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, providerSync: 'CONFIRMED', createdAt: 'Yesterday, 18:30' },
  { id: '4', orderNumber: 'BB-1026', network: NetworkProvider.AIRTELTIGO, customerEmail: 'abena@example.com', recipient: '026 555 9900', packageDisplay: '20 GB', amountDisplay: 'GH₵ 80.00', paymentStatus: PaymentStatus.PAID, orderStatus: OrderStatus.COMPLETED, providerSync: 'CONFIRMED', createdAt: 'Aug 12, 2026' },
];

export const AdminOrdersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = SAMPLE_ORDERS.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.recipient.includes(searchQuery),
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Operations & Queue
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            System Orders & Fulfillment
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Monitor real-time fulfillment pipelines across all telecom carriers and customer accounts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" size="sm" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Download size={16} />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <RefreshCw size={16} />
            Sync Provider
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <SearchInput
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, email, recipient..."
          />
        </div>
      </Card>

      {/* Orders Table */}
      <Table headers={['Order #', 'Carrier', 'Customer', 'Recipient', 'Package', 'Amount', 'Payment', 'Status', 'Sync', 'Created']}>
        {filtered.map((order) => (
          <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
              {order.orderNumber}
            </td>
            <td>
              <NetworkBadge network={order.network} />
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
              {order.customerEmail}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {order.recipient}
            </td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{order.packageDisplay}</td>
            <td style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{order.amountDisplay}</td>
            <td>
              <PaymentStatusBadge status={order.paymentStatus} />
            </td>
            <td>
              <OrderStatusBadge status={order.orderStatus} />
            </td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {order.providerSync}
            </td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              {order.createdAt}
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        currentPage={page}
        totalPages={1}
        onPageChange={setPage}
        totalItems={filtered.length}
        itemsPerPage={10}
      />
    </div>
  );
};
