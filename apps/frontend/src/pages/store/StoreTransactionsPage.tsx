import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import {
  Download,
  Loader2,
  Copy,
  Check,
  ArrowDownToLine,
  History,
  TrendingUp,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { storesApi, StoreTransactionRecordDto } from '../../api/stores.api.js';
import { useDebounce } from '../../hooks/useDebounce.js';

export const StoreTransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  const [transactions, setTransactions] = useState<StoreTransactionRecordDto[]>([]);
  const [summary, setSummary] = useState<{ totalCount: number; totalGrossGhs: number; totalProfitGhs: number }>({
    totalCount: 0,
    totalGrossGhs: 0,
    totalProfitGhs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('30d');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTransactions = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      const res = await storesApi.getStoreTransactions({
        search: debouncedSearch.trim() || undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        dateRange: dateRange !== 'ALL' ? dateRange : undefined,
        page,
        limit: pageSize,
      });

      if (res && Array.isArray(res.transactions)) {
        setTransactions(res.transactions);
        if (res.summary) setSummary(res.summary);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      } else if (!isPolling) {
        setTransactions([]);
      }
    } catch (err: any) {
      if (!isPolling) {
        toastError('Error', err.message || 'Failed to load store transactions.');
        setTransactions([]);
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [debouncedSearch, typeFilter, statusFilter, dateRange, page, pageSize, toastError]);

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(() => {
      fetchTransactions(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter, dateRange, pageSize]);

  const handleCopy = (ref: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 2000);
    }
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      toastError('No Data', 'No transactions to export.');
      return;
    }

    const headers = ['Reference', 'Type', 'Details', 'Customer / Destination', 'Gross Amount (GHS)', 'Profit (GHS)', 'Status', 'Date'];
    const rows = transactions.map((t) => [
      `"${t.reference}"`,
      `"${t.typeLabel || t.type}"`,
      `"${t.details}"`,
      `"${t.recipient}"`,
      t.grossAmountGhs.toFixed(2),
      t.profitGhs.toFixed(2),
      `"${t.status}"`,
      `"${new Date(t.createdAt).toLocaleString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Export Complete', 'Transactions ledger exported successfully.');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F59E0B' }}>
            Store Finance & Ledger
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Transactions
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Authoritative audit trail of customer bundle purchases, markup profit earnings, and Saturday payouts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download size={13} />}
            disabled={loading || transactions.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agent/withdrawals')}
            leftIcon={<ArrowDownToLine size={13} />}
            style={{ backgroundColor: '#10B981', color: '#000000', fontWeight: 800 }}
          >
            Withdraw Profit
          </Button>
        </div>
      </div>

      {/* Top Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Transactions Logged
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={14} color="#F59E0B" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            {summary.totalCount}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Store orders and disbursements</span>
        </Card>

        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Gross Sales Processed
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={14} color="#3B82F6" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            GH₵ {summary.totalGrossGhs.toFixed(2)}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>100% routed through Paystack</span>
        </Card>

        <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Reseller Profit Earned
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={14} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            GH₵ {summary.totalProfitGhs.toFixed(2)}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>Eligible for Saturday payout</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <SearchInput
              placeholder="Search reference, recipient, bundle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { label: 'All Types', value: 'ALL' },
                { label: 'Customer Purchases', value: 'SALE' },
                { label: 'Profit Withdrawals', value: 'WITHDRAWAL' },
              ]}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Paid / Settled', value: 'PAID' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Refunded', value: 'REFUNDED' },
              ]}
            />
          </div>

          <div style={{ minWidth: '130px' }}>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Last 7 Days', value: '7d' },
                { label: 'Last 30 Days', value: '30d' },
                { label: 'Last 90 Days', value: '90d' },
                { label: 'All Time', value: 'ALL' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Transactions Audit Ledger Table */}
      <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto', marginBottom: 'var(--space-4)' }} />
            <p>Loading transactions ledger...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <p style={{ margin: 0, fontWeight: 700 }}>No store transactions found matching your filter criteria.</p>
            <p style={{ fontSize: 'var(--font-size-xs)', marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
              Completed purchases from your customer storefront and Saturday payouts will automatically appear here.
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reference</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Type</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Details</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Recipient / Account</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Gross Sales</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reseller Profit</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id + t.reference} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {t.reference}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(t.reference)}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                            title="Copy Reference"
                          >
                            {copiedRef === t.reference ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={t.type === 'SALE' ? 'success' : 'brand'} size="xs">
                          {t.type === 'SALE' ? 'Store Sale' : 'Withdrawal'}
                        </Badge>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {t.details}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        {t.recipient}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        GH₵ {t.grossAmountGhs.toFixed(2)}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800 }}>
                        <span style={{ color: t.type === 'SALE' ? '#10B981' : '#8B5CF6' }}>
                          {t.type === 'SALE' ? '+' : '-'}GH₵ {t.profitGhs.toFixed(2)}
                        </span>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge
                          variant={
                            t.status === 'PAID' || t.status === 'COMPLETED'
                              ? 'success'
                              : t.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                          }
                          size="xs"
                        >
                          {t.status}
                        </Badge>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {new Date(t.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing {totalCount > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} of {totalCount} transactions
                </span>
                <div style={{ width: '90px' }}>
                  <Select
                    value={String(pageSize)}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    options={[
                      { label: '10 / page', value: '10' },
                      { label: '25 / page', value: '25' },
                      { label: '50 / page', value: '50' },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft size={14} />}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
