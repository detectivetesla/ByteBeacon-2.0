import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { CreditCard, RefreshCw, DollarSign } from 'lucide-react';
import { adminApi } from '../../api/admin.api.js';

export const AdminPaymentsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [payments, setPayments] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getPayments({
        page,
        limit: 25,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      if (res && Array.isArray(res.items)) {
        setPayments(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalPayments(res.pagination?.total || res.items.length);
      } else {
        setPayments([]);
        setTotalPages(1);
        setTotalPayments(0);
      }
    } catch {
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filtered = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.providerReference && p.providerReference.toLowerCase().includes(q)) ||
      (p.phoneNumber && p.phoneNumber.includes(q)) ||
      (p.customerEmail && p.customerEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <CreditCard size={22} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Payment Inflow & Gateway Transactions
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Live records of mobile money collections, Paystack webhook settlements, and gateway processing fees. Total: {totalPayments.toLocaleString()} records.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchPayments} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '320px', maxWidth: '100%' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference or phone..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Payment Statuses', value: 'ALL' },
                { label: 'Successful / Paid', value: 'PAID' },
                { label: 'Pending / Processing', value: 'PENDING' },
                { label: 'Failed / Cancelled', value: 'FAILED' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Table
        headers={[
          'Payment ID',
          'External Gateway Ref',
          'Channel / Method',
          'Payer Account',
          'Gross Amount',
          'Fees',
          'Net Settled',
          'Status',
          'Timestamp',
        ]}
      >
        {filtered.map((p) => {
          const grossGhs = ((p.amountPesewas || p.amount || 0) / 100).toFixed(2);
          const feeGhs = ((p.feePesewas || p.fee || 0) / 100).toFixed(2);
          const netGhs = (parseFloat(grossGhs) - parseFloat(feeGhs)).toFixed(2);

          return (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                {p.id ? `${p.id.slice(0, 10)}...` : '—'}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {p.providerReference || p.externalReference || '—'}
              </td>
              <td>
                <Badge variant="neutral" size="sm">
                  {p.channel || p.paymentMethod || 'MOMO'}
                </Badge>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                {p.phoneNumber || p.customerEmail || '—'}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                GH₵ {grossGhs}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                GH₵ {feeGhs}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)' }}>
                GH₵ {netGhs}
              </td>
              <td>
                <Badge
                  variant={
                    p.status === 'PAID' || p.status === 'SUCCESSFUL'
                      ? 'success'
                      : p.status === 'FAILED'
                      ? 'danger'
                      : 'warning'
                  }
                  size="sm"
                >
                  {p.status || 'PENDING'}
                </Badge>
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {p.createdAt ? new Date(p.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
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
        totalItems={totalPayments}
        itemsPerPage={25}
      />
    </div>
  );
};
