import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Select, SearchInput, Modal } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi, StoreOrdersResponseDto, StoreOrderRecordDto } from '../../api/stores.api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  ShoppingBag,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
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
  return mb >= 1024 ? (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) + ' GB' : mb + ' MB';
};

export const StoreOrdersPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  
  const [data, setData] = useState<StoreOrdersResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrderRecordDto | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortFilter, setSortFilter] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (paymentFilter !== 'ALL' ? 1 : 0) +
    (networkFilter !== 'ALL' ? 1 : 0) +
    (dateFilter !== 'ALL' || startDate || endDate ? 1 : 0) +
    (sortFilter !== 'newest' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setNetworkFilter('ALL');
    setDateFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSortFilter('newest');
    setSearchQuery('');
  };

  const fetchOrders = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const res = await storesApi.getStoreOrders({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        dateRange: dateFilter !== 'ALL' && dateFilter !== 'custom' ? dateFilter : undefined,
        startDate: dateFilter === 'custom' && startDate ? startDate : undefined,
        endDate: dateFilter === 'custom' && endDate ? endDate : undefined,
        sort: sortFilter !== 'newest' ? sortFilter : undefined,
        page,
        limit,
      });
      if (res && res.orders) {
        setData(res);
      } else if (!isPolling) {
        toastError('Failed to fetch', 'Could not load store orders.');
      }
    } catch (err: any) {
      if (!isPolling) {
        toastError('Error', err.message || 'An error occurred while loading orders.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [statusFilter, paymentFilter, networkFilter, debouncedSearch, dateFilter, startDate, endDate, sortFilter, page, limit, toastError]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter, networkFilter, dateFilter, startDate, endDate, sortFilter, searchQuery]);

  const orders = data?.orders || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  const handleExportCsv = () => {
    if (!orders.length) return;
    const header = 'Order ID,Recipient Phone,Network,Bundle,Amount (GHS),Reseller Profit (GHS),Payment Status,Fulfillment Status,Date\n';
    const rows = orders
      .map((o) => {
        const profit = o.profitGhs !== undefined ? o.profitGhs : (o.profitPesewas ? o.profitPesewas / 100 : 0);
        return `${o.publicId},${o.recipientPhone},${o.network},${formatBundleSize(o.dataAmountMb)},${(o.amountPesewas / 100).toFixed(2)},${profit.toFixed(2)},${o.paymentStatus},${o.orderStatus},"${new Date(o.createdAt).toLocaleString()}"`;
      })
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

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success" size="xs">PAID</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size="xs">PENDING</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="xs">CANCELLED</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="xs">FAILED</Badge>;
      default:
        return <Badge variant="neutral" size="xs">{status}</Badge>;
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
            Real-time track and manage customer bundle orders placed on your storefront.
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
                { label: 'All Fulfillment', value: 'ALL' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Delivered', value: 'COMPLETED' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Submitted', value: 'SUBMITTED' },
                { label: 'Cancelled', value: 'CANCELLED' },
                { label: 'Ready to Process', value: 'READY_FOR_FULFILLMENT' },
                { label: 'Created', value: 'CREATED' },
              ]}
            />
          </div>

          {/* Payment Status Filter */}
          <div style={{ minWidth: '130px' }}>
            <Select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              options={[
                { label: 'All Payments', value: 'ALL' },
                { label: 'Paid', value: 'PAID' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Cancelled', value: 'CANCELLED' },
              ]}
            />
          </div>

          {/* Date Range Filter */}
          <div style={{ minWidth: '130px' }}>
            <Select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                if (e.target.value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              options={[
                { label: 'All Time', value: 'ALL' },
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'Last 7 Days', value: '7d' },
                { label: 'Last 14 Days', value: '14d' },
                { label: 'Last 30 Days', value: '30d' },
                { label: 'Custom Range...', value: 'custom' },
              ]}
            />
          </div>

          {/* Custom Date Range Inputs */}
          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: 'var(--font-size-xs)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: 'var(--font-size-xs)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          )}

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

          {/* Sort Filter */}
          <div style={{ minWidth: '130px' }}>
            <Select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Highest Amount', value: 'highest' },
                { label: 'Lowest Amount', value: 'lowest' },
              ]}
            />
          </div>

          {/* Search Query */}
          <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
            <SearchInput
              placeholder="Search phone, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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
              Your storefront orders will appear here in real-time once customers make a purchase.
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
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Your Profit</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Payment</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Fulfillment</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const profitGhs = o.profitGhs !== undefined ? o.profitGhs : (o.profitPesewas ? o.profitPesewas / 100 : 0);
                  const isPaid = o.paymentStatus === 'PAID';

                  return (
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
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 900, color: isPaid ? '#10B981' : 'var(--color-text-muted)' }}>
                        {isPaid ? `+GH₵ ${profitGhs.toFixed(2)}` : 'GH₵ 0.00'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {getPaymentBadge(o.paymentStatus)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED' ? 'success' : o.orderStatus === 'PROCESSING' ? 'info' : o.orderStatus === 'CANCELLED' ? 'danger' : 'warning'} size="xs" dot>
                          {o.orderStatus}
                        </Badge>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {formatRelativeDate(o.createdAt)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedOrder(o)}
                          leftIcon={<Eye size={12} />}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order Details #${selectedOrder.publicId}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-lg)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Payment Status</span>
                <div style={{ marginTop: '0.2rem' }}>{getPaymentBadge(selectedOrder.paymentStatus)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Fulfillment Status</span>
                <div style={{ marginTop: '0.2rem' }}>
                  <Badge variant={selectedOrder.orderStatus === 'COMPLETED' ? 'success' : 'info'} size="sm">
                    {selectedOrder.orderStatus}
                  </Badge>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Recipient SIM:</span>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedOrder.recipientPhone}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Network Carrier:</span>
                <div style={{ marginTop: '0.15rem' }}>{getNetworkBadge(selectedOrder.network)}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Bundle Package:</span>
                <div style={{ fontWeight: 700 }}>{formatBundleSize(selectedOrder.dataAmountMb)} Data</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Date Placed:</span>
                <div>{new Date(selectedOrder.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Financial Breakdown
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: 'var(--font-size-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Customer Retail Price:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-data)' }}>GH₵ {(selectedOrder.amountPesewas / 100).toFixed(2)}</span>
                </div>
                {selectedOrder.basePricePesewas !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Wholesale Cost:</span>
                    <span style={{ fontFamily: 'var(--font-data)' }}>GH₵ {(selectedOrder.basePricePesewas / 100).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '0.4rem' }}>
                  <strong style={{ color: '#10B981' }}>Your Reseller Profit Markup:</strong>
                  <strong style={{ color: '#10B981', fontFamily: 'var(--font-data)' }}>
                    +GH₵ {((selectedOrder.profitGhs !== undefined ? selectedOrder.profitGhs : (selectedOrder.profitPesewas ? selectedOrder.profitPesewas / 100 : 0))).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

