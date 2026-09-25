import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Download, ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { ResponsiveTable } from '../../components/ui/responsive/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { exportToCSV } from '../../utils/exportUtils.js';

interface StoreCustomerRecord {
  phone: string;
  totalOrders: number;
  totalSpentGhs: number;
  lastPurchase: string;
  firstPurchase: string;
  status: 'ACTIVE' | 'RETURNING' | 'NEW' | 'INACTIVE';
}

export const StoreCustomersPage: React.FC = () => {
  const { toastSuccess, toastError, toastInfo } = useToast();
  const [customers, setCustomers] = useState<StoreCustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortFilter, setSortFilter] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (dateFilter !== 'ALL' || startDate || endDate ? 1 : 0) +
    (sortFilter !== 'newest' ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setDateFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSortFilter('newest');
  };

  const fetchCustomers = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError(null);
      const res = await storesApi.getStoreCustomers({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        dateRange: dateFilter !== 'ALL' && dateFilter !== 'custom' ? dateFilter : undefined,
        startDate: dateFilter === 'custom' && startDate ? startDate : undefined,
        endDate: dateFilter === 'custom' && endDate ? endDate : undefined,
        sort: sortFilter !== 'newest' ? sortFilter : undefined,
        page,
        limit: 10,
      });
      if (res) {
        const customerList = res.customers || (res as any).items || [];
        const totalPages = res.pagination?.totalPages || 1;
        const totalCount = res.pagination?.total ?? (res.pagination as any)?.totalItems ?? customerList.length;

        setCustomers(customerList as any);
        setTotalPages(totalPages);
        setTotal(totalCount);
      } else if (!isPolling) {
        setError('Failed to load customers.');
      }
    } catch (err: any) {
      if (!isPolling) {
        setError(err.message || 'An error occurred while fetching customers.');
        toastError('Error', 'Failed to load customers');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, dateFilter, startDate, endDate, sortFilter, page, toastError]);

  useEffect(() => {
    fetchCustomers();
    const interval = setInterval(() => {
      fetchCustomers(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFilter, startDate, endDate, sortFilter]);

  const getRelativeDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const handleExportCsv = () => {
    if (!customers.length) {
      toastInfo('No Data', 'There are no customer records to export.');
      return;
    }
    try {
      exportToCSV({
        filename: `storefront_customers_${new Date().toISOString().slice(0, 10)}.csv`,
        headers: ['Phone', 'Total Orders', 'Total Spent (GHS)', 'Last Purchase', 'First Purchase', 'Status'],
        rows: customers.map((c) => [
          c.phone,
          c.totalOrders,
          c.totalSpentGhs.toFixed(2),
          c.lastPurchase || '',
          c.firstPurchase || '',
          c.status,
        ]),
      });
      toastSuccess('Export Complete', `Exported ${customers.length} customer records.`);
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Failed to export customer records');
    }
  };

  const totalSpentAcrossVisible = customers.reduce((sum, c) => sum + (c.totalSpentGhs || 0), 0);
  const repeatBuyersCount = customers.filter((c) => c.totalOrders > 1).length;

  return (
    <div className="store-page-container">
      <div className="store-header-row">
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#06B6D4' }}>
            Store Audience
          </span>
          <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Storefront Customers
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
            View and manage recurring data buyers who place orders on your storefront.
          </p>
        </div>

        <div className="store-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download size={13} />}
            disabled={loading || customers.length === 0}
            style={{ minHeight: '44px', flex: '1 1 auto' }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="store-kpis-grid">
        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Total Customers
          </span>
          <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            {total}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Unique phone recipients</span>
        </Card>

        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Page Sales Volume
          </span>
          <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            GH₵ {totalSpentAcrossVisible.toFixed(2)}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Spent by listed customers</span>
        </Card>

        <Card style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)' }}>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Repeat Buyers
          </span>
          <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 900, color: '#06B6D4', fontFamily: 'var(--font-data)', margin: '0.25rem 0' }}>
            {repeatBuyersCount}
          </div>
          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Customers with 2+ orders</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div className="store-filter-bar">
          {/* Search */}
          <div style={{ minWidth: 'min(100%, 180px)', flex: '2 1 200px' }}>
            <SearchInput
              placeholder="Search customer phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Customer Status Filter */}
          <div style={{ minWidth: 'min(100%, 130px)', flex: '1 1 130px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Customers', value: 'ALL' },
                { label: 'Active (< 30d)', value: 'ACTIVE' },
                { label: 'Returning (2+)', value: 'RETURNING' },
                { label: 'New Customer', value: 'NEW' },
                { label: 'Inactive (> 30d)', value: 'INACTIVE' },
              ]}
            />
          </div>

          {/* Last Purchase Date Filter */}
          <div style={{ minWidth: 'min(100%, 130px)', flex: '1 1 130px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
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
                  minHeight: '38px',
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
                  minHeight: '38px',
                }}
              />
            </div>
          )}

          {/* Sort Filter */}
          <div style={{ minWidth: 'min(100%, 130px)', flex: '1 1 130px' }}>
            <Select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Highest Spent', value: 'highest' },
                { label: 'Lowest Spent', value: 'lowest' },
                { label: 'Most Orders', value: 'most_orders' },
                { label: 'Least Orders', value: 'least_orders' },
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
              style={{ fontSize: 'var(--font-size-2xs)', whiteSpace: 'nowrap', minHeight: '38px' }}
            >
              Reset ({activeFilterCount})
            </Button>
          )}
        </div>
      </Card>

      {/* Customers Table */}
      <Card style={{ padding: 0, backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto', marginBottom: 'var(--space-4)' }} />
            <p>Loading customers...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-danger)' }}>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchCustomers()} style={{ marginTop: 'var(--space-4)' }}>
              Retry
            </Button>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <p>{search ? 'No customers found matching your search.' : 'No storefront customers recorded yet. Customers who place orders through your storefront will appear here automatically.'}</p>
          </div>
        ) : (
          <>
            <ResponsiveTable<StoreCustomerRecord>
              columns={[
                {
                  header: 'Customer',
                  accessor: () => 'Guest Customer',
                  render: () => (
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Guest Customer</span>
                  ),
                  priority: 'secondary',
                },
                {
                  header: 'Phone',
                  accessor: 'phone',
                  render: (c) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                      {c.phone}
                    </span>
                  ),
                  priority: 'always',
                },
                {
                  header: 'Orders',
                  accessor: (c) => String(c.totalOrders),
                  render: (c) => (
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.totalOrders}</span>
                  ),
                  priority: 'always',
                },
                {
                  header: 'Total Spent',
                  accessor: (c) => `GH₵ ${c.totalSpentGhs.toFixed(2)}`,
                  render: (c) => (
                    <span style={{ fontFamily: 'var(--font-data)', fontWeight: 800, color: '#10B981' }}>
                      GH₵ {c.totalSpentGhs.toFixed(2)}
                    </span>
                  ),
                  priority: 'always',
                },
                {
                  header: 'Last Order',
                  accessor: (c) => getRelativeDate(c.lastPurchase),
                  render: (c) => (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                      {getRelativeDate(c.lastPurchase)}
                    </span>
                  ),
                  priority: 'secondary',
                },
                {
                  header: 'Status',
                  accessor: 'status',
                  render: (c) => (
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'NEW' ? 'brand' : 'info'} size="sm">
                      {c.status}
                    </Badge>
                  ),
                  priority: 'always',
                },
              ]}
              data={customers}
              keyExtractor={(c, i) => c.phone + i}
              enableCardView={true}
              cardTitle={(c) => c.phone}
              cardSubtitle={(c) => `${c.totalOrders} total order(s) • Last active: ${getRelativeDate(c.lastPurchase)}`}
              cardBadge={(c) => (
                <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'NEW' ? 'brand' : 'info'} size="sm">
                  {c.status}
                </Badge>
              )}
              cardActions={(c) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Lifetime Spend:</span>
                  <span style={{ fontFamily: 'var(--font-data)', fontWeight: 900, color: '#10B981', fontSize: 'var(--font-size-sm)' }}>
                    GH₵ {c.totalSpentGhs.toFixed(2)}
                  </span>
                </div>
              )}
            />
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing page {page} of {totalPages} ({total} total customers)
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft size={14} />}
                    style={{ minHeight: '38px' }}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    rightIcon={<ChevronRight size={14} />}
                    style={{ minHeight: '38px' }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
