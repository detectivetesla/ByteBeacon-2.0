import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NetworkProvider, OrderStatus, PaymentStatus } from '@bytebeacon/shared';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { SearchInput, Select, DateInput } from '../../components/ui/index.js';
import { OrderStatusBadge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { OrderDetailsModal, OrderDetailsItem, SourceIndicator } from '../../components/commerce/OrderDetailsModal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  ShoppingCart,
  RefreshCw,
  Download,
  Plus,
  Filter,
  Package,
  Wallet,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

interface OrderRowData extends OrderDetailsItem {}

const INITIAL_SAMPLE_ORDERS: OrderRowData[] = [
  {
    id: '1',
    orderNumber: 'BB-84920',
    network: NetworkProvider.MTN,
    recipient: '024 111 2233',
    dataDisplay: '10 GB',
    amountDisplay: 'GH₵ 55.00',
    source: 'Wallet',
    paidDisplay: '₵55.00',
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    dateDisplay: 'Aug 16, 2026 15:10',
  },
  {
    id: '2',
    orderNumber: 'BB-84919',
    network: NetworkProvider.TELECEL,
    recipient: '020 444 5566',
    dataDisplay: '5 GB',
    amountDisplay: 'GH₵ 24.00',
    source: 'MoMo',
    paidDisplay: '₵24.00',
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    dateDisplay: 'Aug 16, 2026 14:02',
  },
  {
    id: '3',
    orderNumber: 'BB-84918',
    network: NetworkProvider.MTN,
    recipient: '054 777 8899',
    dataDisplay: '20 GB',
    amountDisplay: 'GH₵ 100.00',
    source: 'Wallet',
    paidDisplay: '₵100.00',
    orderStatus: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.PAID,
    dateDisplay: 'Aug 16, 2026 13:45',
  },
  {
    id: '4',
    orderNumber: 'BB-84917',
    network: NetworkProvider.AIRTELTIGO,
    recipient: '026 333 1122',
    dataDisplay: '15 GB',
    amountDisplay: 'GH₵ 60.00',
    source: 'Card',
    paidDisplay: '₵60.00',
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    dateDisplay: 'Aug 15, 2026 19:20',
  },
  {
    id: '5',
    orderNumber: 'BB-84916',
    network: NetworkProvider.MTN,
    recipient: '024 888 9900',
    dataDisplay: '2.5 GB',
    amountDisplay: 'GH₵ 15.00',
    source: 'Wallet',
    paidDisplay: '₵15.00',
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,
    dateDisplay: 'Aug 15, 2026 11:05',
  },
];

export const AgentOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastInfo } = useToast();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'status'>('newest');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Pagination & Modal
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<OrderRowData | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate Real Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let processingCount = 0;
    let failedCount = 0;

    INITIAL_SAMPLE_ORDERS.forEach((o) => {
      const match = o.paidDisplay?.match(/[\d.]+/);
      const val = match ? parseFloat(match[0]) : 0;
      totalRevenue += val;

      if (o.orderStatus === OrderStatus.PROCESSING) processingCount++;
      if (o.orderStatus === OrderStatus.FAILED) failedCount++;
    });

    return {
      revenueDisplay: `₵${totalRevenue.toFixed(2)}`,
      ordersCount: INITIAL_SAMPLE_ORDERS.length,
      processingCount,
      failedCount,
    };
  }, []);

  // Filter & Sort Logic
  const filteredOrders = useMemo(() => {
    let result = INITIAL_SAMPLE_ORDERS.filter((order) => {
      if (statusFilter !== 'ALL' && order.orderStatus !== statusFilter) return false;
      if (paymentFilter !== 'ALL' && order.paymentStatus !== paymentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.orderNumber.toLowerCase().includes(q);
        const matchesPhone = order.recipient.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        if (!matchesId && !matchesPhone) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') return b.id.localeCompare(a.id);
      if (sortBy === 'oldest') return a.id.localeCompare(b.id);
      if (sortBy === 'highest') {
        const aVal = parseFloat((a.paidDisplay || a.amountDisplay).replace(/[^\d.]/g, '')) || 0;
        const bVal = parseFloat((b.paidDisplay || b.amountDisplay).replace(/[^\d.]/g, '')) || 0;
        return bVal - aVal;
      }
      if (sortBy === 'lowest') {
        const aVal = parseFloat((a.paidDisplay || a.amountDisplay).replace(/[^\d.]/g, '')) || 0;
        const bVal = parseFloat((b.paidDisplay || b.amountDisplay).replace(/[^\d.]/g, '')) || 0;
        return aVal - bVal;
      }
      if (sortBy === 'status') return a.orderStatus.localeCompare(b.orderStatus);
      return 0;
    });

    return result;
  }, [statusFilter, paymentFilter, searchQuery, sortBy]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (paymentFilter !== 'ALL') count++;
    if (dateRange !== '30d') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [statusFilter, paymentFilter, dateRange, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toastInfo('Updated', 'Order list refreshed with latest data.');
    }, 600);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const csvHeader = 'Order ID,Size,Recipient,Network,Status,Source,Paid,Date\n';
      const rows = filteredOrders
        .map((o) => `${o.orderNumber},${o.dataDisplay},${o.recipient},${o.network},${o.orderStatus},${o.source || 'Wallet'},${o.paidDisplay || o.amountDisplay},${o.dateDisplay}`)
        .join('\n');
      const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bytebeacon_orders_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess('Export Ready', `Exported ${filteredOrders.length} orders to CSV.`);
    }, 800);
  };

  const handleViewDetails = (order: OrderRowData) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  const handleClearFilters = () => {
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDateRange('30d');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
    setSortBy('newest');
    setMobileFilterOpen(false);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={ShoppingCart} color="orders" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Orders
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage and track your data bundle orders.
          </p>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={isRefreshing} leftIcon={<RefreshCw size={14} />}>
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} isLoading={isExporting} leftIcon={<Download size={14} />}>
            Export
          </Button>

          <Button variant="primary" size="sm" onClick={() => navigate('/agent/buy-data')} leftIcon={<Plus size={15} />}>
            New Purchase
          </Button>
        </div>
      </div>

      {/* 2. Four Premium Distinct Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Card 1: Revenue (Deep Emerald) */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-success-surface), var(--color-bg-surface))',
            border: '1px solid var(--color-success-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
              Revenue
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-success-surface)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {metrics.revenueDisplay}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              30 days
            </span>
          </div>
        </div>

        {/* Card 2: Orders (Deep Royal Blue) */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(145deg, var(--color-info-surface), var(--color-bg-surface))',
            border: '1px solid var(--color-info-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
              Orders
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-info-surface)',
                border: '1px solid var(--color-info-border)',
                color: 'var(--color-info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {metrics.ordersCount}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              30 days
            </span>
          </div>
        </div>

        {/* Card 3: Processing (Deep Amber - Interactive Quick Filter) */}
        <div
          onClick={() => setStatusFilter(statusFilter === OrderStatus.PROCESSING ? 'ALL' : OrderStatus.PROCESSING)}
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: statusFilter === OrderStatus.PROCESSING ? 'var(--color-warning-surface)' : 'linear-gradient(145deg, var(--color-warning-surface), var(--color-bg-surface))',
            border: statusFilter === OrderStatus.PROCESSING ? '2px solid var(--color-warning)' : '1px solid var(--color-warning-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
              Processing
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-warning-surface)',
                border: '1px solid var(--color-warning-border)',
                color: 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Clock size={16} strokeWidth={2.5} />
              {metrics.processingCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-warning)',
                    boxShadow: '0 0 6px var(--color-warning)',
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {metrics.processingCount}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              Currently processing
            </span>
          </div>
        </div>

        {/* Card 4: Failed (Deep Crimson - Interactive Quick Filter) */}
        <div
          onClick={() => setStatusFilter(statusFilter === OrderStatus.FAILED ? 'ALL' : OrderStatus.FAILED)}
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            background: statusFilter === OrderStatus.FAILED ? 'var(--color-danger-surface)' : 'linear-gradient(145deg, var(--color-danger-surface), var(--color-bg-surface))',
            border: statusFilter === OrderStatus.FAILED ? '2px solid var(--color-danger)' : '1px solid var(--color-danger-border)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '130px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
              Failed
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-surface)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {metrics.failedCount}
            </div>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              Failed orders
            </span>
          </div>
        </div>
      </div>

      {/* 3. Unified Filter Toolbar */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            {/* Search Input */}
            <div style={{ minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <SearchInput
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Desktop Status Segmented Controls */}
            <div className="desktop-only" style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg-base)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', flexWrap: 'wrap' }}>
              {[
                { label: 'All', value: 'ALL' },
                { label: 'Processing', value: OrderStatus.PROCESSING },
                { label: 'Delivered', value: OrderStatus.COMPLETED },
                { label: 'Failed', value: OrderStatus.FAILED },
                { label: 'Submitted', value: OrderStatus.SUBMITTED },
                { label: 'Cancelled', value: OrderStatus.CANCELLED },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: statusFilter === tab.value ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    backgroundColor: statusFilter === tab.value ? 'var(--color-bg-surface)' : 'transparent',
                    color: statusFilter === tab.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    boxShadow: statusFilter === tab.value ? 'var(--shadow-tactile-sm)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Payment Dropdown */}
            <div className="desktop-only" style={{ minWidth: '130px' }}>
              <Select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                options={[
                  { label: 'All payments', value: 'ALL' },
                  { label: 'Paid', value: PaymentStatus.PAID },
                  { label: 'Partial refund', value: PaymentStatus.PARTIALLY_REFUNDED },
                  { label: 'Refunded', value: PaymentStatus.REFUNDED },
                ]}
              />
            </div>

            {/* Date Dropdown */}
            <div className="desktop-only" style={{ minWidth: '120px' }}>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                options={[
                  { label: 'Today', value: 'today' },
                  { label: 'Yesterday', value: 'yesterday' },
                  { label: '7 days', value: '7d' },
                  { label: '14 days', value: '14d' },
                  { label: '30 days', value: '30d' },
                  { label: 'All time', value: 'all' },
                  { label: 'Custom', value: 'custom' },
                ]}
              />
            </div>

            {/* Custom Date Inputs */}
            {dateRange === 'custom' && (
              <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <DateInput
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>to</span>
                <DateInput
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}

            {/* Mobile Filter Toggle */}
            <div className="mobile-only">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                leftIcon={<Filter size={13} />}
              >
                {activeFiltersCount > 0 ? `Filters • ${activeFiltersCount}` : 'Filters'}
              </Button>
            </div>
          </div>

          {/* Right: Sort & Clear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: '130px' }}>
              <ArrowUpDown size={13} color="var(--color-text-muted)" />
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                options={[
                  { label: 'Newest', value: 'newest' },
                  { label: 'Oldest', value: 'oldest' },
                  { label: 'Highest amount', value: 'highest' },
                  { label: 'Lowest amount', value: 'lowest' },
                  { label: 'Status', value: 'status' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Mobile Filter Panel */}
        {mobileFilterOpen && (
          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All statuses', value: 'ALL' },
                { label: 'Processing', value: OrderStatus.PROCESSING },
                { label: 'Delivered', value: OrderStatus.COMPLETED },
                { label: 'Failed', value: OrderStatus.FAILED },
                { label: 'Submitted', value: OrderStatus.SUBMITTED },
                { label: 'Cancelled', value: OrderStatus.CANCELLED },
              ]}
            />

            <Select
              label="Payment"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              options={[
                { label: 'All payments', value: 'ALL' },
                { label: 'Paid', value: PaymentStatus.PAID },
                { label: 'Refunded', value: PaymentStatus.REFUNDED },
              ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={() => setMobileFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Single Authoritative Order History Section (Responsive table with Source & Paid) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Order History
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
            View your data bundle purchases and delivery status.
          </p>
        </div>

        {filteredOrders.length === 0 ? (
          <Card style={{ padding: 'var(--space-12)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <Package size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                No orders yet
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Your purchases will appear here.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/agent/buy-data')}>
              Buy Data
            </Button>
          </Card>
        ) : (
          <>
            {/* Authoritative Order History Table (Horizontal scroll on smaller viewports) */}
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Order ID</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Size</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Recipient</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Network</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Source</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Paid</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => handleViewDetails(order)}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 120ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {order.orderNumber}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {order.dataDisplay}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        {order.recipient}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <NetworkBadge network={order.network} size="sm" />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <OrderStatusBadge status={order.orderStatus} size="sm" />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <SourceIndicator source={order.source} />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {order.paidDisplay || order.amountDisplay}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {order.dateDisplay}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(order);
                          }}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface-elevated)',
                            fontSize: 'var(--font-size-3xs)',
                            fontWeight: 700,
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 5. Pagination Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-3) 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ width: '130px' }}>
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: '10 / page', value: '10' },
                      { label: '20 / page', value: '20' },
                      { label: '50 / page', value: '50' },
                      { label: '100 / page', value: '100' },
                    ]}
                  />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing {filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-sm)',
                      border: currentPage === pg ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                      backgroundColor: currentPage === pg ? 'var(--color-brand)' : 'var(--color-bg-surface)',
                      color: currentPage === pg ? '#FFFFFF' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 6. Order Inspection Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
};
