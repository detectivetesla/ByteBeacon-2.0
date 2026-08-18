import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { PaymentStatusBadge } from '../../components/ui/Badge/Badge.js';
import { PaymentStatus } from '@bytebeacon/shared';
import { Download } from 'lucide-react';

interface PaymentRow {
  id: string;
  reference: string;
  externalRef: string;
  channel: string;
  payer: string;
  amount: string;
  fee: string;
  net: string;
  status: PaymentStatus;
  createdAt: string;
}

const SAMPLE_PAYMENTS: PaymentRow[] = [
  { id: '1', reference: 'PAY-902194', externalRef: 'MM-88421049', channel: 'MTN MoMo', payer: '024 123 4567', amount: 'GH₵ 25.00', fee: 'GH₵ 0.25', net: 'GH₵ 24.75', status: PaymentStatus.PAID, createdAt: 'Today, 14:12' },
  { id: '2', reference: 'PAY-902193', externalRef: 'TC-99120481', channel: 'Telecel Cash', payer: '020 987 6543', amount: 'GH₵ 45.00', fee: 'GH₵ 0.45', net: 'GH₵ 44.55', status: PaymentStatus.PAID, createdAt: 'Today, 13:40' },
  { id: '3', reference: 'PAY-902192', externalRef: 'MM-77192048', channel: 'MTN MoMo', payer: '054 888 1122', amount: 'GH₵ 12.00', fee: 'GH₵ 0.12', net: 'GH₵ 11.88', status: PaymentStatus.PAID, createdAt: 'Yesterday, 18:30' },
  { id: '4', reference: 'PAY-902191', externalRef: 'AT-66190283', channel: 'AT Money', payer: '026 555 9900', amount: 'GH₵ 80.00', fee: 'GH₵ 0.80', net: 'GH₵ 79.20', status: PaymentStatus.PAID, createdAt: 'Aug 12, 2026' },
];

export const AdminPaymentsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = SAMPLE_PAYMENTS.filter(
    (p) =>
      p.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.externalRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payer.includes(searchQuery),
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Financial Gateway
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            Payment Transactions
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Verify incoming mobile money deposits, gateway transaction fees, and net settlement reconciliations.
          </p>
        </div>

        <Button variant="outline" size="sm" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Download size={16} />
          Export Payments
        </Button>
      </div>

      {/* Filter */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <SearchInput
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by reference or payer..."
          />
        </div>
      </Card>

      {/* Table */}
      <Table headers={['Payment Ref', 'MoMo External Ref', 'Channel', 'Payer Number', 'Gross Amount', 'Gateway Fee', 'Net Settlement', 'Status', 'Timestamp']}>
        {filtered.map((p) => (
          <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
              {p.reference}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {p.externalRef}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{p.channel}</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{p.payer}</td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{p.amount}</td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{p.fee}</td>
            <td style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>{p.net}</td>
            <td>
              <PaymentStatusBadge status={p.status} />
            </td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{p.createdAt}</td>
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
