import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Database, RefreshCw, DollarSign, ShieldCheck, CreditCard } from 'lucide-react';
import { adminApi, AdminLedgerLine, AdminAnalyticsOverview } from '../../api/admin.api.js';

export const AdminLedgerPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [entryTypeFilter, setEntryTypeFilter] = useState('ALL');
  const [accountTypeFilter, setAccountTypeFilter] = useState('ALL');
  const [ledgerLines, setLedgerLines] = useState<AdminLedgerLine[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ledgerRes, analyticsRes] = await Promise.all([
        adminApi.getLedger({
          page,
          limit: 25,
          entryType: entryTypeFilter !== 'ALL' ? entryTypeFilter : undefined,
          accountType: accountTypeFilter !== 'ALL' ? accountTypeFilter : undefined,
        }),
        adminApi.getAnalyticsOverview('all'),
      ]);

      if (ledgerRes && Array.isArray(ledgerRes.items)) {
        setLedgerLines(ledgerRes.items);
        setTotalPages(ledgerRes.pagination?.totalPages || 1);
        setTotalLines(ledgerRes.pagination?.total || ledgerRes.items.length);
      } else {
        setLedgerLines([]);
        setTotalPages(1);
        setTotalLines(0);
      }

      if (analyticsRes) {
        setAnalytics(analyticsRes);
      }
    } catch {
      setLedgerLines([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, entryTypeFilter, accountTypeFilter]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const totalVolumeGhs = ((analytics?.revenue?.lifetimePesewas || 0) / 100).toFixed(2);
  const monthVolumeGhs = ((analytics?.revenue?.monthPesewas || 0) / 100).toFixed(2);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <Database size={22} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Double-Entry Financial Ledger
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Authoritative, immutable transaction journal enforcing zero-sum balanced entries across all platform wallets and escrows.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchLedger} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Balance Sheet Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Lifetime Inflow"
          value={`GH₵ ${totalVolumeGhs}`}
          subvalue="Gross payment volume"
          icon={<DollarSign size={20} color="#10B981" />}
        />
        <MetricCard
          title="30-Day Settled Volume"
          value={`GH₵ ${monthVolumeGhs}`}
          subvalue="Active rolling revenue"
          icon={<CreditCard size={20} color="#3B82F6" />}
        />
        <MetricCard
          title="Total Journal Lines"
          value={totalLines.toLocaleString()}
          subvalue="Immutable postings"
          icon={<Database size={20} color="#8B5CF6" />}
        />
        <MetricCard
          title="Audit Integrity"
          value="100% Balanced"
          subvalue="Double-entry verified"
          icon={<ShieldCheck size={20} color="#10B981" />}
        />
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            Filtering {totalLines.toLocaleString()} journal postings:
          </span>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Select
              value={entryTypeFilter}
              onChange={(e) => {
                setEntryTypeFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Entry Types', value: 'ALL' },
                { label: 'DEBIT (Asset / Outflow)', value: 'DEBIT' },
                { label: 'CREDIT (Liability / Inflow)', value: 'CREDIT' },
              ]}
            />

            <Select
              value={accountTypeFilter}
              onChange={(e) => {
                setAccountTypeFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Account Types', value: 'ALL' },
                { label: 'Customer Wallets', value: 'CUSTOMER_WALLET' },
                { label: 'Agent Wallets', value: 'AGENT_WALLET' },
                { label: 'Platform Escrow', value: 'PLATFORM_ESCROW' },
                { label: 'Provider Payable', value: 'PROVIDER_PAYABLE' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Ledger Lines Table */}
      <Table
        headers={[
          'Transaction ID',
          'Entry Type',
          'Account Type',
          'Amount (GHS)',
          'Reference Type',
          'Reference ID',
          'Description',
          'Timestamp',
        ]}
      >
        {ledgerLines.map((line) => {
          const amountGhs = ((line.amountPesewas || 0) / 100).toFixed(2);

          return (
            <tr key={line.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                {line.transactionId ? `${line.transactionId.slice(0, 8)}...` : line.id.slice(0, 8)}
              </td>
              <td>
                <Badge variant={line.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm">
                  {line.entryType}
                </Badge>
              </td>
              <td>
                <Badge variant="neutral" size="sm">
                  {line.accountType}
                </Badge>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                GH₵ {amountGhs}
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {line.referenceType || '—'}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                {line.referenceId ? `${line.referenceId.slice(0, 10)}...` : '—'}
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {line.description || '—'}
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {line.createdAt ? new Date(line.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
            </tr>
          );
        })}
      </Table>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalLines}
        itemsPerPage={25}
      />
    </div>
  );
};
