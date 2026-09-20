import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Download, Loader2, ArrowDownToLine, Calendar, History, RotateCcw } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';

export const StoreFinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortFilter, setSortFilter] = useState('newest');

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0) +
    (dateFilter !== 'ALL' || startDate || endDate ? 1 : 0) +
    (sortFilter !== 'newest' ? 1 : 0);

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSortFilter('newest');
  };

  useEffect(() => {
    let mounted = true;
    const loadFinance = async (isPolling = false) => {
      try {
        if (!isPolling) setLoading(true);
        const result = await storesApi.getStoreFinance({ page: 1, limit: 20 });
        if (mounted) setData(result);
      } catch (err: any) {
        if (mounted && !isPolling) {
          toastError('Failed to load', err.message || 'Unable to load finance data');
        }
      } finally {
        if (mounted && !isPolling) setLoading(false);
      }
    };

    loadFinance();
    const interval = setInterval(() => {
      loadFinance(true);
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [toastError]);

  const handleExportStatement = () => {
    if (!data?.transactions?.length) {
      toastError('No Data', 'No transaction settlements to export.');
      return;
    }
    const header = 'Reference,Type,Amount (GHS),Entry Type,Date\n';
    const rows = data.transactions
      .map(
        (tx: any) =>
          `"${tx.referenceId}","${tx.referenceType}",${(tx.amountPesewas / 100).toFixed(2)},${tx.entryType},"${new Date(tx.createdAt).toLocaleString()}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `store_settlements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Statement Exported', 'Store settlements statement downloaded.');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Store Treasury
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Store Revenue & Settlements
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Real-time customer sales gross receipts, markup profit, and automated payouts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/store-console/transactions')}
            leftIcon={<History size={13} />}
          >
            Transactions Ledger
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStatement}
            leftIcon={<Download size={13} />}
            disabled={!data?.transactions?.length}
          >
            Export Statement
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <>
          {/* Saturday Payout Schedule Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
              <Calendar size={16} />
            </div>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <strong style={{ color: '#10B981' }}>Weekly Settlement Cycle (Every Saturday):</strong>{' '}
              <span>Customer storefront payments settle into ByteBeacon Paystack. Your markup profit accumulates here in real-time. You can opt to request a payout anytime, reviewed and disbursed every Saturday.</span>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/agent/withdrawals')}
              style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981', fontWeight: 800 }}
            >
              Request Payout
            </Button>
          </div>

          {/* 4 Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Gross Store Sales
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.grossSalesGhs !== undefined ? data.grossSalesGhs : (data?.grossSalesPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Customer payments processed</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Wholesale Fulfillment Cost
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.costGhs !== undefined ? data.costGhs : (data?.costPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Base network cost</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Reseller Profit Markup
                </span>
                <Badge variant="success" size="xs">Withdrawable</Badge>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                GH₵ {((data?.profitGhs !== undefined ? data.profitGhs : (data?.profitPesewas || 0) / 100)).toFixed(2)}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 700 }}>Eligible for Saturday payout</span>
            </Card>

            <Card style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Total Bundles Fulfilled
              </span>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
                {data?.totalFulfilledOrders || 0}
              </div>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>100% automated delivery</span>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ minWidth: '180px', flex: '1 1 200px' }}>
                <SearchInput
                  placeholder="Search reference, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Type Filter */}
              <div style={{ minWidth: '140px' }}>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  options={[
                    { label: 'All Entries', value: 'ALL' },
                    { label: 'Credits (Store Sales)', value: 'CREDIT' },
                    { label: 'Debits (Payouts)', value: 'DEBIT' },
                  ]}
                />
              </div>

              {/* Date Filter */}
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

              {/* Custom Date Inputs */}
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

          {/* Settlements Table */}
          {(() => {
            const rawTransactions = data?.transactions || [];
            let list = [...rawTransactions];

            if (search.trim()) {
              const s = search.toLowerCase().trim();
              list = list.filter((tx: any) =>
                (tx.referenceId && String(tx.referenceId).toLowerCase().includes(s)) ||
                (tx.description && String(tx.description).toLowerCase().includes(s)) ||
                (tx.referenceType && String(tx.referenceType).toLowerCase().includes(s))
              );
            }

            if (typeFilter !== 'ALL') {
              list = list.filter((tx: any) => tx.entryType === typeFilter);
            }

            if (dateFilter === 'custom') {
              if (startDate) {
                const startMs = new Date(startDate).getTime();
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() >= startMs);
              }
              if (endDate) {
                const endMs = new Date(endDate).getTime() + 86400000;
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() <= endMs);
              }
            } else if (dateFilter !== 'ALL') {
              const now = Date.now();
              if (dateFilter === 'today') {
                const startOfToday = new Date().setHours(0, 0, 0, 0);
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() >= startOfToday);
              } else if (dateFilter === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const startOfYesterday = new Date(yesterday).setHours(0, 0, 0, 0);
                const startOfToday = new Date().setHours(0, 0, 0, 0);
                list = list.filter((tx: any) => {
                  const t = new Date(tx.createdAt).getTime();
                  return t >= startOfYesterday && t < startOfToday;
                });
              } else if (dateFilter === '7d') {
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() >= now - 7 * 86400000);
              } else if (dateFilter === '14d') {
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() >= now - 14 * 86400000);
              } else if (dateFilter === '30d') {
                list = list.filter((tx: any) => new Date(tx.createdAt).getTime() >= now - 30 * 86400000);
              }
            }

            if (sortFilter === 'oldest') {
              list.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            } else if (sortFilter === 'highest') {
              list.sort((a: any, b: any) => (b.amountPesewas || 0) - (a.amountPesewas || 0));
            } else if (sortFilter === 'lowest') {
              list.sort((a: any, b: any) => (a.amountPesewas || 0) - (b.amountPesewas || 0));
            } else {
              list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }

            return (
              <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                    Recent Storefront Settlements
                  </h3>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate('/store-console/transactions')}
                    style={{ color: '#10B981', fontWeight: 700 }}
                  >
                    View Full Ledger →
                  </Button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reference</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Type</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            {activeFilterCount > 0 ? 'No settlements found matching your filter criteria.' : 'No transactions found.'}
                          </td>
                        </tr>
                      ) : (
                        list.map((tx: any) => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              {tx.referenceId}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-primary)' }}>
                              {tx.referenceType}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 900, color: tx.entryType === 'CREDIT' ? '#10B981' : '#EF4444' }}>
                              {tx.entryType === 'CREDIT' ? '+' : '-'}GH₵ {(tx.amountPesewas / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <Badge variant={tx.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm">
                                {tx.entryType}
                              </Badge>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
};
