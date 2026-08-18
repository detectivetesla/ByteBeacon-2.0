import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

interface StoreCustomerRecord {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpentGhs: number;
  lastPurchase: string;
  status: 'ACTIVE' | 'RETURNING' | 'NEW';
}

const SAMPLE_STORE_CUSTOMERS: StoreCustomerRecord[] = [
  { id: 'c-1', name: 'Ama Serwaa', phone: '024 456 7890', totalOrders: 14, totalSpentGhs: 340.00, lastPurchase: 'Today', status: 'ACTIVE' },
  { id: 'c-2', name: 'Kwame Mensah', phone: '020 123 4567', totalOrders: 8, totalSpentGhs: 220.00, lastPurchase: 'Today', status: 'ACTIVE' },
  { id: 'c-3', name: 'Kofi Asante', phone: '026 789 0123', totalOrders: 5, totalSpentGhs: 145.00, lastPurchase: 'Yesterday', status: 'RETURNING' },
  { id: 'c-4', name: 'Akosua Darko', phone: '054 998 8776', totalOrders: 2, totalSpentGhs: 45.00, lastPurchase: '3 days ago', status: 'NEW' },
  { id: 'c-5', name: 'Yaw Osei', phone: '055 112 2334', totalOrders: 19, totalSpentGhs: 680.00, lastPurchase: '4 days ago', status: 'ACTIVE' },
];

export const StoreCustomersPage: React.FC = () => {
  const { toastSuccess } = useToast();
  const [customers] = useState<StoreCustomerRecord[]>(SAMPLE_STORE_CUSTOMERS);
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#06B6D4' }}>
            Store Audience
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Storefront Customers
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            View and manage recurring data buyers who place orders on your storefront.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => toastSuccess('Exported', 'Customer directory exported.')}
          leftIcon={<Download size={13} />}
        >
          Export Customers
        </Button>
      </div>

      {/* Filter */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ maxWidth: '320px' }}>
          <SearchInput
            placeholder="Search customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* Customers Table */}
      <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Customer</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Phone</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Orders</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Total Spent</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Last Order</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {c.name}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {c.phone}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {c.totalOrders}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: '#10B981' }}>
                    GH₵ {c.totalSpentGhs.toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                    {c.lastPurchase}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'info'} size="sm">
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
