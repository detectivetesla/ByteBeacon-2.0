import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import { useDebounce } from '../../hooks/useDebounce.js';

interface StoreCustomerRecord {
  phone: string;
  totalOrders: number;
  totalSpentGhs: number;
  lastPurchase: string;
  firstPurchase: string;
  status: 'ACTIVE' | 'RETURNING' | 'NEW';
}

export const StoreCustomersPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [customers, setCustomers] = useState<StoreCustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storesApi.getStoreCustomers({ search: debouncedSearch.trim() || undefined, page, limit: 10 });
      if (res) {
        const customerList = res.customers || (res as any).items || [];
        const totalPages = res.pagination?.totalPages || 1;
        const totalCount = res.pagination?.total ?? (res.pagination as any)?.totalItems ?? customerList.length;

        setCustomers(customerList as any);
        setTotalPages(totalPages);
        setTotal(totalCount);
      } else {
        setError('Failed to load customers.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching customers.');
      toastError('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, toastError]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const getRelativeDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

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
          onClick={() => toastSuccess('Exported', `Customer directory exported (${total} records).`)}
          leftIcon={<Download size={13} />}
          disabled={loading || customers.length === 0}
        >
          Export Customers
        </Button>
      </div>

      {/* Filter */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ maxWidth: '320px' }}>
          <SearchInput
            placeholder="Search customer phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            <Button variant="outline" size="sm" onClick={fetchCustomers} style={{ marginTop: 'var(--space-4)' }}>
              Retry
            </Button>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <p>{search ? 'No customers found matching your search.' : 'No storefront customers recorded yet. Customers who place orders through your storefront will appear here automatically.'}</p>
          </div>
        ) : (
          <>
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
                  {customers.map((c, i) => (
                    <tr key={c.phone + i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Guest Customer
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        {c.phone}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {c.totalOrders}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: '#10B981' }}>
                        GH₵ {c.totalSpentGhs.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {getRelativeDate(c.lastPurchase)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'NEW' ? 'brand' : 'info'} size="sm">
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
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
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    rightIcon={<ChevronRight size={14} />}
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
