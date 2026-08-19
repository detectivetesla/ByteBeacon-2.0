import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { OrderStatusBadge, PaymentStatusBadge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { Download, RefreshCw, PackageX } from 'lucide-react';
import { ordersApi } from '../../api/orders.api.js';

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

export const AdminOrdersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.listOrders({ page, limit: 50, search: searchQuery || undefined });
      if (res && Array.isArray(res.orders)) {
        const mapped: AdminOrderRow[] = res.orders.map((o: any) => ({
          id: o.id,
          orderNumber: o.publicId || o.reference || o.id.slice(0, 8).toUpperCase(),
          network: o.network,
          customerEmail: o.userEmail || o.customerEmail || '—',
          recipient: o.recipientPhone || '—',
          packageDisplay: `${((o.dataAmountMb || 0) / 1024).toFixed(1)} GB`,
          amountDisplay: `GH₵ ${((o.amountPesewas || 0) / 100).toFixed(2)}`,
          paymentStatus: o.paymentStatus || PaymentStatus.PENDING,
          orderStatus: o.orderStatus || OrderStatus.PENDING,
          providerSync: o.orderStatus === OrderStatus.COMPLETED ? 'CONFIRMED' : 'QUEUED',
          createdAt: o.createdAt
            ? new Date(o.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—',
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
  }, [page, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = orders.filter(
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
