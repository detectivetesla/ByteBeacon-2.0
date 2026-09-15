import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Select, SearchInput } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi, StoreOrdersResponseDto } from '../../api/stores.api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  ShoppingBag,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Format relative date
const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24 && now.getDate() === date.getDate()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffInHours < 48 && now.getDate() - date.getDate() === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Format bundle size
const formatBundleSize = (mb: number) => {
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
};

export const StoreOrdersPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  
  const [data, setData] = useState<StoreOrdersResponseDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storesApi.getStoreOrders({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      });
      if (res && res.orders) {
        setData(res);
      } else {
        toastError('Failed to fetch', 'Could not load store orders.');
      }
    } catch (err: any) {
      toastError('Error', err.message || 'An error occurred while loading orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, networkFilter, debouncedSearch, page, limit, toastError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, networkFilter, searchQuery]);

  const orders = data?.orders || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  const handleExportCsv = () => {
    if (!orders.length) return;
    const header = 'Order ID,Recipient Phone,Network,Bundle,Amount (GHS),Payment,Status,Date\n';
    const rows = orders
      .map(
        (o) =>
          `${o.publicId},${o.recipientPhone},${o.network},${formatBundleSize(o.dataAmountMb)},${(o.amountPesewas / 100).toFixed(2)},${o.paymentStatus},${o.orderStatus},"${new Date(o.createdAt).toLocaleString()}"`,
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
    switch (network.toUpperCase()) {
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
          <Button variant="outline" size="sm" onClick={handleExportCsv} leftIcon={<Download size={13} />} disabled={orders.length === 0}>
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
                { label: 'AirtelTIGO', value: 'AIRTELTIGO' },
              ]}
            />
          </div>

          {/* Search Query */}
          <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
            <SearchInput
              placeholder="Search phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card style={{ padding: '0', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        {loading && orders.length === 0 ? (
           <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
             Loading orders...
           </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <ShoppingBag size={28} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No store orders found
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Your storefront orders will appear here once customers make a purchase matching the filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Order ID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Recipient</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Network</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Bundle</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {o.publicId}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {o.recipientPhone}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {getNetworkBadge(o.network)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {formatBundleSize(o.dataAmountMb)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      GH₵ {(o.amountPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant={o.orderStatus === 'COMPLETED' ? 'success' : o.orderStatus === 'PROCESSING' ? 'info' : 'warning'} size="sm" dot>
                        {o.orderStatus}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                      {formatRelativeDate(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPage(p => p - 1)}
                    leftIcon={<ChevronLeft size={14} />}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() => setPage(p => p + 1)}
                    rightIcon={<ChevronRight size={14} />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
