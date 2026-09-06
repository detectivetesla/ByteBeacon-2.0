import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import {
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  History,
} from 'lucide-react';
import { walletApi, WalletTransactionDto } from '../../api/wallet.api.js';

interface TransactionRow {
  id: string;
  reference: string;
  type: 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'COMMISSION' | 'ADJUSTMENT' | 'WITHDRAWAL';
  channel: string;
  amountDisplay: string;
  amountPesewas: number;
  balanceAfter: string;
  status: string;
  dateDisplay: string;
  createdAtMs: number;
  createdAtIso: string;
}

export const TransactionsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const PAGE_SIZE = 10;

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await walletApi.getTransactions({ limit: 100, dateRange, sortBy });
      if (res && Array.isArray(res.transactions)) {
        const mapped: TransactionRow[] = res.transactions.map((t: WalletTransactionDto) => {
          const rawDate = t.createdAt ? new Date(t.createdAt) : new Date();
          return {
            id: t.id,
            reference: t.referenceId || t.id.slice(0, 10).toUpperCase(),
            type: t.type,
            channel: t.description || 'Wallet',
            amountPesewas: t.amountPesewas,
            amountDisplay: `${t.type === 'DEPOSIT' || t.type === 'REFUND' ? '+' : '-'}GH₵ ${(t.amountPesewas / 100).toFixed(2)}`,
            balanceAfter: `GH₵ ${(t.balanceAfterPesewas / 100).toFixed(2)}`,
            status: t.status,
            createdAtMs: rawDate.getTime(),
            createdAtIso: rawDate.toISOString(),
            dateDisplay: t.createdAt
              ? rawDate.toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—',
          };
        });
        setTransactions(mapped);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, sortBy]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCopyReference = (ref: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 2000);
    }
  };

  const filtered = useMemo(() => {
    const list = transactions.filter((t) => {
      const matchesSearch =
        !searchQuery.trim() ||
        t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;

      let matchesDate = true;
      if (dateRange !== 'all') {
        const now = Date.now();
        if (dateRange === 'today') {
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          matchesDate = t.createdAtMs >= startOfToday;
        } else if (dateRange === '7d') {
          matchesDate = t.createdAtMs >= now - 7 * 24 * 60 * 60 * 1000;
        } else if (dateRange === '30d') {
          matchesDate = t.createdAtMs >= now - 30 * 24 * 60 * 60 * 1000;
        } else if (dateRange === '90d') {
          matchesDate = t.createdAtMs >= now - 90 * 24 * 60 * 60 * 1000;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });

    // Sort order
    list.sort((a, b) => {
      if (sortBy === 'newest') return b.createdAtMs - a.createdAtMs;
      if (sortBy === 'oldest') return a.createdAtMs - b.createdAtMs;
      if (sortBy === 'highest') return b.amountPesewas - a.amountPesewas;
      if (sortBy === 'lowest') return a.amountPesewas - b.amountPesewas;
      return 0;
    });

    return list;
  }, [transactions, searchQuery, typeFilter, dateRange, sortBy]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, dateRange, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedTransactions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats calculation based on filtered subset
  const totalInflowGhs = useMemo(() => {
    return (
      filtered
        .filter((t) => t.type === 'DEPOSIT' || t.type === 'REFUND')
        .reduce((sum, t) => sum + (t.amountPesewas || 0), 0) / 100
    );
  }, [filtered]);

  const totalOutflowGhs = useMemo(() => {
    return (
      filtered
        .filter((t) => t.type === 'PURCHASE' || t.type === 'WITHDRAWAL')
        .reduce((sum, t) => sum + (t.amountPesewas || 0), 0) / 100
    );
  }, [filtered]);

  const handleExportStatement = () => {
    const csvHeader = 'Reference,Type,Description,Amount,Balance After,Status,Date\n';
    const rows = filtered
      .map(
        (t) =>
          `"${t.reference}","${t.type}","${t.channel}","${t.amountDisplay}","${t.balanceAfter}","${t.status}","${t.dateDisplay}"`,
      )
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Financial Ledger
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            Transactions History
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Comprehensive audit record of all deposits, order payments, and reversals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={fetchTransactions} isLoading={isLoading} leftIcon={<RefreshCw size={14} />}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportStatement} leftIcon={<Download size={14} />}>
            Export Statement
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
            <History size={20} />
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              Ledger Entries ({dateRange === '30d' ? '30 days' : dateRange === '7d' ? '7 days' : dateRange === 'today' ? 'Today' : dateRange === '90d' ? '90 days' : 'All time'})
            </span>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {filtered.length}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
            <TrendingDown size={20} />
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              Inflow ({dateRange === '30d' ? '30 days' : dateRange === '7d' ? '7 days' : dateRange === 'today' ? 'Today' : dateRange === '90d' ? '90 days' : 'All time'})
            </span>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px', fontFamily: 'var(--font-data)' }}>
              GH₵ {totalInflowGhs.toFixed(2)}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-accent-red)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              Outflow ({dateRange === '30d' ? '30 days' : dateRange === '7d' ? '7 days' : dateRange === 'today' ? 'Today' : dateRange === '90d' ? '90 days' : 'All time'})
            </span>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px', fontFamily: 'var(--font-data)' }}>
              GH₵ {totalOutflowGhs.toFixed(2)}
            </div>
          </div>
        </Card>
      </div>

      {/* Filters & Sorting Card */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
            {/* Search Input */}
            <div style={{ width: '280px', maxWidth: '100%' }}>
              <SearchInput
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Search reference, description, or type..."
              />
            </div>

            {/* Date Range Selector: 30 days, Today, 7 days, 90 days, All time */}
            <div style={{ width: '150px' }}>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                options={[
                  { label: '30 days', value: '30d' },
                  { label: 'Today', value: 'today' },
                  { label: '7 days', value: '7d' },
                  { label: '90 days', value: '90d' },
                  { label: 'All time', value: 'all' },
                ]}
              />
            </div>

            {/* Sort Selector: Newest, Oldest, Highest Amount, Lowest Amount */}
            <div style={{ width: '160px' }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                options={[
                  { label: 'Newest', value: 'newest' },
                  { label: 'Oldest', value: 'oldest' },
                  { label: 'Highest Amount', value: 'highest' },
                  { label: 'Lowest Amount', value: 'lowest' },
                ]}
              />
            </div>

            {/* Type Filter */}
            <div style={{ width: '160px' }}>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { label: 'All Types', value: 'ALL' },
                  { label: 'Deposits', value: 'DEPOSIT' },
                  { label: 'Purchases', value: 'PURCHASE' },
                  { label: 'Refunds', value: 'REFUND' },
                  { label: 'Adjustments', value: 'ADJUSTMENT' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(searchQuery || typeFilter !== 'ALL' || dateRange !== '30d' || sortBy !== 'newest') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                  setDateRange('30d');
                  setSortBy('newest');
                }}
              >
                Reset
              </Button>
            )}
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              Showing <strong>{paginatedTransactions.length}</strong> of <strong>{filtered.length}</strong> entries
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions Table or Empty State */}
      {filtered.length === 0 ? (
        <Card style={{ padding: 'var(--space-12)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
            <FileText size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              No transactions found
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              {searchQuery || typeFilter !== 'ALL' || dateRange !== '30d' || sortBy !== 'newest'
                ? 'No transactions matching your selected timeframe (30 days) or search filters.'
                : 'Wallet deposits and purchase deductions will appear here once initiated.'}
            </p>
          </div>
          {(searchQuery || typeFilter !== 'ALL' || dateRange !== '30d' || sortBy !== 'newest') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setDateRange('30d');
                setSortBy('newest');
              }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
            <Table
              minWidth="980px"
              headers={['Reference', 'Type', 'Description / Channel', 'Amount', 'Balance After', 'Status', 'Date']}
            >
              {paginatedTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    transition: 'background-color 150ms ease',
                  }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          backgroundColor: 'var(--color-bg-base)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--color-border-subtle)',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}
                        title={tx.reference}
                      >
                        {tx.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyReference(tx.reference)}
                        title={copiedRef === tx.reference ? 'Copied!' : 'Copy reference'}
                        aria-label="Copy reference"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: copiedRef === tx.reference ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          padding: '0.2rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        {copiedRef === tx.reference ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? (
                        <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
                          <ArrowDownLeft size={14} strokeWidth={2.8} />
                        </div>
                      ) : (
                        <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-accent-red)' }}>
                          <ArrowUpRight size={14} strokeWidth={2.8} />
                        </div>
                      )}
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                        {tx.type}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      maxWidth: '280px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={tx.channel}
                  >
                    {tx.channel}
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      fontWeight: 800,
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'var(--font-data)',
                      whiteSpace: 'nowrap',
                      color: tx.amountDisplay.startsWith('+') ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    }}
                  >
                    {tx.amountDisplay}
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tx.balanceAfter}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontSize: 'var(--font-size-3xs)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor:
                          tx.status === 'SUCCESSFUL' || tx.status === 'COMPLETED'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : tx.status === 'PENDING'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        color:
                          tx.status === 'SUCCESSFUL' || tx.status === 'COMPLETED'
                            ? 'var(--color-primary)'
                            : tx.status === 'PENDING'
                            ? '#F59E0B'
                            : 'var(--color-accent-red)',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                      }}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--font-size-2xs)',
                      color: 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tx.dateDisplay}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filtered.length}
            itemsPerPage={PAGE_SIZE}
          />
        </div>
      )}
    </div>
  );
};

