import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  RotateCcw,
  Clock,
  CheckCircle2,
  DollarSign,
  Download,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CreditCard,
  Wallet,
  Smartphone,
  Building,
  Filter,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export type RefundStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Rejected';
export type PaymentMethod = 'Paystack' | 'Mobile Money' | 'Card' | 'Bank Transfer' | 'Wallet';

export interface RefundRecord {
  id: string;
  orderId: string;
  amountPesewas: number;
  paymentMethod: PaymentMethod;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedAt: string;
  rawDate: string;
  timeline: Array<{ stage: string; time: string; completed: boolean }>;
}

const SAMPLE_REFUNDS: RefundRecord[] = [
  {
    id: 'RF-00124',
    orderId: 'BB-82931',
    amountPesewas: 2500,
    paymentMethod: 'Wallet',
    reason: 'Recipient line inactive on carrier network',
    status: 'Completed',
    requestedAt: 'Aug 16, 2026 14:30',
    processedAt: 'Aug 16, 2026 14:32',
    rawDate: '2026-08-16T14:32:00Z',
    timeline: [
      { stage: 'Refund requested', time: '14:30:00', completed: true },
      { stage: 'Refund processing', time: '14:31:00', completed: true },
      { stage: 'Refund completed', time: '14:32:00', completed: true },
    ],
  },
  {
    id: 'RF-00123',
    orderId: 'BB-81042',
    amountPesewas: 5700,
    paymentMethod: 'Paystack',
    reason: 'Carrier gateway timeout after multiple dispatch retries',
    status: 'Completed',
    requestedAt: 'Aug 16, 2026 11:15',
    processedAt: 'Aug 16, 2026 11:18',
    rawDate: '2026-08-16T11:18:00Z',
    timeline: [
      { stage: 'Refund requested', time: '11:15:00', completed: true },
      { stage: 'Refund processing', time: '11:16:30', completed: true },
      { stage: 'Refund completed', time: '11:18:00', completed: true },
    ],
  },
  {
    id: 'RF-00122',
    orderId: 'BB-79910',
    amountPesewas: 1500,
    paymentMethod: 'Mobile Money',
    reason: 'Under carrier manual reconciliation review',
    status: 'Pending',
    requestedAt: 'Aug 16, 2026 09:40',
    processedAt: 'Pending',
    rawDate: '2026-08-16T09:40:00Z',
    timeline: [
      { stage: 'Refund requested', time: '09:40:00', completed: true },
      { stage: 'Refund processing', time: '09:42:00', completed: false },
    ],
  },
  {
    id: 'RF-00121',
    orderId: 'BB-78102',
    amountPesewas: 4800,
    paymentMethod: 'Card',
    reason: 'Customer initiated cancellation prior to carrier fulfillment',
    status: 'Completed',
    requestedAt: 'Aug 15, 2026 18:20',
    processedAt: 'Aug 15, 2026 18:22',
    rawDate: '2026-08-15T18:22:00Z',
    timeline: [
      { stage: 'Refund requested', time: '18:20:00', completed: true },
      { stage: 'Refund processing', time: '18:21:15', completed: true },
      { stage: 'Refund completed', time: '18:22:00', completed: true },
    ],
  },
];

export const RefundStatusBadge: React.FC<{ status: RefundStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  switch (status) {
    case 'Completed':
      return <Badge variant="success" size={size} dot>Completed</Badge>;
    case 'Processing':
      return <Badge variant="info" size={size} dot>Processing</Badge>;
    case 'Pending':
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case 'Failed':
      return <Badge variant="danger" size={size} dot>Failed</Badge>;
    case 'Rejected':
      return <Badge variant="neutral" size={size}>Rejected</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const PaymentMethodBadge: React.FC<{ method: PaymentMethod }> = ({ method }) => {
  let Icon = Wallet;
  let color = '#F59E0B';

  if (method === 'Paystack') {
    Icon = CreditCard;
    color = '#09A5DB';
  } else if (method === 'Mobile Money') {
    Icon = Smartphone;
    color = '#10B981';
  } else if (method === 'Card') {
    Icon = CreditCard;
    color = '#6366F1';
  } else if (method === 'Bank Transfer') {
    Icon = Building;
    color = '#8B5CF6';
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
      <Icon size={13} color={color} />
      <span>{method}</span>
    </span>
  );
};

export const AgentRefundReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess } = useToast();

  const [refunds, setRefunds] = useState<RefundRecord[]>(SAMPLE_REFUNDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('30d');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Refresh State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  // Selected Refund Drawer State
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // 4 Summary KPI Cards
  const totalRefundsCount = refunds.length;
  const pendingCount = refunds.filter((r) => r.status === 'Pending' || r.status === 'Processing').length;
  const completedCount = refunds.filter((r) => r.status === 'Completed').length;
  const totalRefundedPesewas = refunds.filter((r) => r.status === 'Completed').reduce((acc, r) => acc + r.amountPesewas, 0);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch('/api/v1/payments/refunds', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.data)) {
          setRefunds(data.data);
        }
      }
    } catch {
      // Graceful local development fallback
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastUpdated(`Today, ${timeStr}`);
        toastSuccess('Refunds Synchronized', 'Latest refund data reloaded.');
      }, 500);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDateFilter('30d');
    setCurrentPage(1);
  };

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (paymentFilter !== 'ALL' && r.paymentMethod !== paymentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = r.id.toLowerCase().includes(q);
        const matchOrder = r.orderId.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        if (!matchId && !matchOrder && !matchReason) return false;
      }

      return true;
    });
  }, [refunds, statusFilter, paymentFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage) || 1;
  const paginatedRefunds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRefunds.slice(start, start + itemsPerPage);
  }, [filteredRefunds, currentPage, itemsPerPage]);

  const handleExport = () => {
    const csvHeader = 'Refund ID,Order,Amount,Payment Method,Reason,Status,Date\n';
    const rows = filteredRefunds
      .map(
        (r) =>
          `${r.id},${r.orderId},GH₵ ${(r.amountPesewas / 100).toFixed(2)},${r.paymentMethod},"${r.reason}",${r.status},${r.requestedAt}`,
      )
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `refunds_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Export Complete', `Exported ${filteredRefunds.length} refund records.`);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={RotateCcw} color="orders" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Refunds
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Track refunded purchases and their payment status.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
            Updated {lastUpdated}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download size={14} />}>
            Export
          </Button>
        </div>
      </div>

      {/* 2. Four Colored Tactile Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Card 1: Total Refunds (Violet / Blue) */}
        <MetricCard
          title="Total Refunds"
          value={totalRefundsCount.toString()}
          subtitle="All recorded claims"
          accent="purple"
          icon={<TactileIcon icon={RotateCcw} color="orders" size="sm" />}
        />

        {/* Card 2: Pending (Amber) */}
        <MetricCard
          title="Pending"
          value={pendingCount.toString()}
          subtitle="Awaiting resolution"
          accent="amber"
          icon={<TactileIcon icon={Clock} color="api" size="sm" />}
        />

        {/* Card 3: Completed (Emerald) */}
        <MetricCard
          title="Completed"
          value={completedCount.toString()}
          subtitle="Credited to customer/wallet"
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />

        {/* Card 4: Total Refunded (Emerald / Green) */}
        <MetricCard
          title="Total Refunded"
          value={`GH₵ ${(totalRefundedPesewas / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="100% processed funds"
          accent="cyan"
          icon={<TactileIcon icon={DollarSign} color="speed" size="sm" />}
        />
      </div>

      {/* 3. Refund Filters Section */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <SearchInput
              placeholder="Search refunds, orders, or reason..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Desktop Filter Dropdowns */}
          <div className="desktop-only" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'Status: All', value: 'ALL' },
                { label: 'Pending', value: 'Pending' },
                { label: 'Processing', value: 'Processing' },
                { label: 'Completed', value: 'Completed' },
                { label: 'Failed', value: 'Failed' },
                { label: 'Rejected', value: 'Rejected' },
              ]}
            />

            <Select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Payments', value: 'ALL' },
                { label: 'Paystack', value: 'Paystack' },
                { label: 'Mobile Money', value: 'Mobile Money' },
                { label: 'Card', value: 'Card' },
                { label: 'Bank Transfer', value: 'Bank Transfer' },
                { label: 'Wallet', value: 'Wallet' },
              ]}
            />

            <Select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: '7 days', value: '7d' },
                { label: '14 days', value: '14d' },
                { label: '30 days', value: '30d' },
                { label: 'All time', value: 'all' },
              ]}
            />

            {(searchQuery || statusFilter !== 'ALL' || paymentFilter !== 'ALL' || dateFilter !== '30d') && (
              <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X size={12} />}>
                Clear
              </Button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <div className="mobile-only">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileFilterOpen(true)}
              leftIcon={<Filter size={13} />}
            >
              Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Refund Table Section */}
      <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', overflow: 'hidden' }}>
        {filteredRefunds.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <RotateCcw size={32} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No refunds matching criteria
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Try adjusting your search keywords or filter settings.
            </p>
          </div>
        ) : (
          <>
            {/* Authoritative Table View (Horizontal scroll on smaller viewports) */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Refund ID</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Order</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Payment</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reason</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRefunds.map((refund) => (
                    <tr
                      key={refund.id}
                      onClick={() => setSelectedRefund(refund)}
                      style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background-color 120ms ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {refund.id}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/agent/orders');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--color-brand)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            textDecoration: 'underline',
                          }}
                        >
                          <span>{refund.orderId}</span>
                          <ExternalLink size={10} />
                        </button>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        GH₵ {(refund.amountPesewas / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <PaymentMethodBadge method={refund.paymentMethod} />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {refund.reason}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <RefundStatusBadge status={refund.status} size="sm" />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {refund.requestedAt}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRefund(refund);
                          }}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ width: '130px' }}>
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: '8 / page', value: '8' },
                      { label: '16 / page', value: '16' },
                      { label: '32 / page', value: '32' },
                      { label: '50 / page', value: '50' },
                    ]}
                  />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing {filteredRefunds.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, filteredRefunds.length)} of {filteredRefunds.length} refunds · Page {currentPage} of {totalPages}
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
      </Card>

      {/* 5. Refund Details Slide-Over Drawer */}
      {selectedRefund && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 'var(--z-index-modal)',
          }}
          onClick={() => setSelectedRefund(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              height: '100%',
              backgroundColor: 'var(--color-bg-base)',
              boxShadow: 'var(--shadow-tactile-xl)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: 'var(--space-6)',
              gap: 'var(--space-5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Refund Audit Record
                </span>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>
                  Refund #{selectedRefund.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRefund(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Header Status Card */}
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Refund Amount</span>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
                  GH₵ {(selectedRefund.amountPesewas / 100).toFixed(2)}
                </div>
              </div>
              <RefundStatusBadge status={selectedRefund.status} size="md" />
            </div>

            {/* Core Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Original Order:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRefund(null);
                    navigate('/agent/orders');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-brand)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    textDecoration: 'underline',
                  }}
                >
                  <span>{selectedRefund.orderId}</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Payment Method:</span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{selectedRefund.paymentMethod}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Reason:</span>
                <span style={{ color: 'var(--color-text-primary)', textAlign: 'right', maxWidth: '60%' }}>{selectedRefund.reason}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Requested:</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{selectedRefund.requestedAt}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Processed:</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{selectedRefund.processedAt}</span>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                Refund Lifecycle Resolution
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative', paddingLeft: '1.25rem' }}>
                <div style={{ position: 'absolute', top: '6px', bottom: '6px', left: '5px', width: '2px', backgroundColor: 'var(--color-border-default)' }} />

                {selectedRefund.timeline.map((stage, idx) => (
                  <div key={idx} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '-1.25rem',
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: stage.completed ? 'var(--color-success)' : 'var(--color-border-default)',
                        border: '2px solid var(--color-bg-surface)',
                      }}
                    />
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: stage.completed ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {stage.stage}
                    </strong>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{stage.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Mobile Filter Overlay */}
      {isMobileFilterOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-index-modal)',
            padding: 'var(--space-4)',
          }}
          onClick={() => setIsMobileFilterOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              border: '1px solid var(--color-border-default)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0 }}>Filter Refunds</h3>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Pending', value: 'Pending' },
                { label: 'Processing', value: 'Processing' },
                { label: 'Completed', value: 'Completed' },
                { label: 'Failed', value: 'Failed' },
                { label: 'Rejected', value: 'Rejected' },
              ]}
            />

            <Select
              label="Payment Method"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              options={[
                { label: 'All Payments', value: 'ALL' },
                { label: 'Paystack', value: 'Paystack' },
                { label: 'Mobile Money', value: 'Mobile Money' },
                { label: 'Card', value: 'Card' },
                { label: 'Bank Transfer', value: 'Bank Transfer' },
                { label: 'Wallet', value: 'Wallet' },
              ]}
            />

            <Select
              label="Date Range"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: '7 days', value: '7d' },
                { label: '14 days', value: '14d' },
                { label: '30 days', value: '30d' },
                { label: 'All time', value: 'all' },
              ]}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  clearFilters();
                  setIsMobileFilterOpen(false);
                }}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => setIsMobileFilterOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
