import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Select, SearchInput } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ShoppingBag,
  Download,
} from 'lucide-react';

interface StoreOrderRecord {
  id: string;
  publicId: string;
  customerName: string;
  recipientPhone: string;
  network: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
  bundleSize: string;
  amountGhs: number;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  orderStatus: 'COMPLETED' | 'PROCESSING' | 'PENDING' | 'FAILED';
  date: string;
}

const SAMPLE_STORE_ORDERS: StoreOrderRecord[] = [
  {
    id: 'so-1',
    publicId: 'BB-98412',
    customerName: 'Ama Serwaa',
    recipientPhone: '024 456 7890',
    network: 'MTN',
    bundleSize: '5.0 GB',
    amountGhs: 25.00,
    paymentStatus: 'PAID',
    orderStatus: 'COMPLETED',
    date: 'Today, 14:22',
  },
  {
    id: 'so-2',
    publicId: 'BB-98411',
    customerName: 'Kwame Mensah',
    recipientPhone: '020 123 4567',
    network: 'TELECEL',
    bundleSize: '10.0 GB',
    amountGhs: 45.00,
    paymentStatus: 'PAID',
    orderStatus: 'COMPLETED',
    date: 'Today, 12:10',
  },
  {
    id: 'so-3',
    publicId: 'BB-98409',
    customerName: 'Kofi Asante',
    recipientPhone: '026 789 0123',
    network: 'AIRTELTIGO',
    bundleSize: '15.0 GB',
    amountGhs: 60.00,
    paymentStatus: 'PAID',
    orderStatus: 'PROCESSING',
    date: 'Today, 10:05',
  },
  {
    id: 'so-4',
    publicId: 'BB-98402',
    customerName: 'Akosua Darko',
    recipientPhone: '054 998 8776',
    network: 'MTN',
    bundleSize: '2.0 GB',
    amountGhs: 12.00,
    paymentStatus: 'PAID',
    orderStatus: 'COMPLETED',
    date: 'Yesterday, 19:40',
  },
  {
    id: 'so-5',
    publicId: 'BB-98398',
    customerName: 'Yaw Osei',
    recipientPhone: '055 112 2334',
    network: 'MTN',
    bundleSize: '20.0 GB',
    amountGhs: 85.00,
    paymentStatus: 'PAID',
    orderStatus: 'COMPLETED',
    date: 'Yesterday, 15:30',
  },
];

export const StoreOrdersPage: React.FC = () => {
  const { toastSuccess } = useToast();
  const [orders] = useState<StoreOrderRecord[]>(SAMPLE_STORE_ORDERS);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.orderStatus !== statusFilter) return false;
      if (networkFilter !== 'ALL' && o.network !== networkFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          o.publicId.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.recipientPhone.includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, networkFilter, searchQuery]);

  const handleExportCsv = () => {
    const header = 'Order ID,Customer,Recipient Phone,Network,Bundle,Amount (GHS),Payment,Status,Date\n';
    const rows = filteredOrders
      .map(
        (o) =>
          `${o.publicId},"${o.customerName}",${o.recipientPhone},${o.network},${o.bundleSize},${o.amountGhs.toFixed(2)},${o.paymentStatus},${o.orderStatus},"${o.date}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Export Complete', 'Storefront orders exported to CSV.');
  };

  const getNetworkBadge = (network: string) => {
    switch (network) {
      case 'MTN':
        return <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#FFCC00', color: '#000000', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>MTN</span>;
      case 'TELECEL':
        return <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#E11D48', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>TELECEL</span>;
      case 'AIRTELTIGO':
        return <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>AT</span>;
      default:
        return <span>{network}</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B5CF6' }}>
            Store Fulfillment
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Storefront Orders
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Track and manage bundle orders placed directly by customers on your public store.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={handleExportCsv} leftIcon={<Download size={13} />}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* Status Filter */}
          <div style={{ minWidth: '130px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Completed', value: 'COMPLETED' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Failed', value: 'FAILED' },
              ]}
            />
          </div>

          {/* Network Filter */}
          <div style={{ minWidth: '120px' }}>
            <Select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              options={[
                { label: 'All Networks', value: 'ALL' },
                { label: 'MTN', value: 'MTN' },
                { label: 'Telecel', value: 'TELECEL' },
                { label: 'AirtelTigo', value: 'AIRTELTIGO' },
              ]}
            />
          </div>

          {/* Search Query */}
          <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
            <SearchInput
              placeholder="Search customer, phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card style={{ padding: '0', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <ShoppingBag size={28} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No store orders yet
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Your first storefront order will appear here once customers make a purchase.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Order ID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Customer</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Recipient</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Network</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Bundle</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {o.publicId}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {o.customerName}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {o.recipientPhone}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {getNetworkBadge(o.network)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {o.bundleSize}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      GH₵ {o.amountGhs.toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant={o.orderStatus === 'COMPLETED' ? 'success' : o.orderStatus === 'PROCESSING' ? 'info' : 'warning'} size="sm" dot>
                        {o.orderStatus}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                      {o.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
