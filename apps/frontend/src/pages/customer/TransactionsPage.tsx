import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Download, ArrowDownLeft, ArrowUpRight, RefreshCw, FileText } from 'lucide-react';
import { walletApi, WalletTransactionDto } from '../../api/wallet.api.js';

interface TransactionRow {
  id: string;
  reference: string;
  type: 'DEPOSIT' | 'PURCHASE' | 'REFUND' | 'COMMISSION' | 'ADJUSTMENT' | 'WITHDRAWAL';
  channel: string;
  amountDisplay: string;
  balanceAfter: string;
  status: string;
  dateDisplay: string;
}

export const TransactionsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await walletApi.getTransactions({ limit: 100 });
      if (res && Array.isArray(res.transactions)) {
        const mapped: TransactionRow[] = res.transactions.map((t: WalletTransactionDto) => ({
          id: t.id,
          reference: t.referenceId || t.id.slice(0, 10).toUpperCase(),
          type: t.type,
          channel: t.description || 'Wallet',
          amountDisplay: `${t.type === 'DEPOSIT' || t.type === 'REFUND' ? '+' : '-'}GH₵ ${(t.amountPesewas / 100).toFixed(2)}`,
          balanceAfter: `GH₵ ${(t.balanceAfterPesewas / 100).toFixed(2)}`,
          status: t.status,
          dateDisplay: t.createdAt
            ? new Date(t.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—',
        }));
        setTransactions(mapped);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = transactions.filter(
    (t) =>
      t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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

      {/* Filters Card */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <SearchInput
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by transaction reference..."
          />
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
              No transactions recorded
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              {searchQuery ? `No records matching "${searchQuery}"` : 'Wallet deposits and purchase deductions will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Table headers={['Reference', 'Type', 'Channel', 'Amount', 'Balance After', 'Status', 'Date']}>
            {filtered.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                  {tx.reference}
                </td>
                <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? (
                    <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
                      <ArrowDownLeft size={14} strokeWidth={2.8} />
                    </div>
                  ) : (
                    <div style={{ padding: '0.25rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-accent-red)' }}>
                      <ArrowUpRight size={14} strokeWidth={2.8} />
                    </div>
                  )}
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{tx.type}</span>
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{tx.channel}</td>
                <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: tx.amountDisplay.startsWith('+') ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                  {tx.amountDisplay}
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {tx.balanceAfter}
                </td>
                <td>
                  <span style={{ fontSize: 'var(--font-size-3xs)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {tx.status}
                  </span>
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{tx.dateDisplay}</td>
              </tr>
            ))}
          </Table>

          <Pagination
            currentPage={page}
            totalPages={1}
            onPageChange={setPage}
            totalItems={filtered.length}
            itemsPerPage={10}
          />
        </>
      )}
    </div>
  );
};
