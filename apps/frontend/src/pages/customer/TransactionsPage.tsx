import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface TransactionRow {
  id: string;
  reference: string;
  type: 'DEPOSIT' | 'PURCHASE' | 'REFUND';
  channel: string;
  amountDisplay: string;
  balanceAfter: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  dateDisplay: string;
}

const SAMPLE_TXS: TransactionRow[] = [
  { id: '1', reference: 'TX-984210', type: 'PURCHASE', channel: 'Wallet', amountDisplay: '-GH₵ 25.00', balanceAfter: 'GH₵ 475.00', status: 'SUCCESS', dateDisplay: 'Aug 14, 2026 14:12' },
  { id: '2', reference: 'TX-984209', type: 'PURCHASE', channel: 'Wallet', amountDisplay: '-GH₵ 45.00', balanceAfter: 'GH₵ 500.00', status: 'SUCCESS', dateDisplay: 'Aug 14, 2026 13:40' },
  { id: '3', reference: 'TX-984180', type: 'DEPOSIT', channel: 'MTN MoMo', amountDisplay: '+GH₵ 200.00', balanceAfter: 'GH₵ 545.00', status: 'SUCCESS', dateDisplay: 'Aug 13, 2026 11:20' },
  { id: '4', reference: 'TX-984155', type: 'PURCHASE', channel: 'Wallet', amountDisplay: '-GH₵ 80.00', balanceAfter: 'GH₵ 345.00', status: 'SUCCESS', dateDisplay: 'Aug 12, 2026 09:15' },
  { id: '5', reference: 'TX-984112', type: 'REFUND', channel: 'System', amountDisplay: '+GH₵ 12.00', balanceAfter: 'GH₵ 425.00', status: 'SUCCESS', dateDisplay: 'Aug 10, 2026 17:05' },
];

export const TransactionsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = SAMPLE_TXS.filter(
    (t) =>
      t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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

        <Button variant="outline" size="sm" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Download size={16} />
          Export Statement
        </Button>
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

      {/* Transactions Table */}
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
    </div>
  );
};
