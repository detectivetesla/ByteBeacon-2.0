import React from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { useAuth } from '../../context/AuthContext.js';
import { Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';

interface WalletTransaction {
  id: string;
  type: 'TOPUP' | 'PURCHASE' | 'REFUND';
  description: string;
  amountDisplay: string;
  dateDisplay: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

const SAMPLE_TXS: WalletTransaction[] = [
  { id: '1', type: 'TOPUP', description: 'Wallet Deposit (MoMo)', amountDisplay: '+GH₵ 100.00', dateDisplay: 'Today, 10:15', status: 'COMPLETED' },
  { id: '2', type: 'PURCHASE', description: 'Data Bundle MTN 5GB', amountDisplay: '-GH₵ 25.00', dateDisplay: 'Today, 14:12', status: 'COMPLETED' },
  { id: '3', type: 'PURCHASE', description: 'Data Bundle Telecel 10GB', amountDisplay: '-GH₵ 45.00', dateDisplay: 'Yesterday, 13:40', status: 'COMPLETED' },
  { id: '4', type: 'REFUND', description: 'Order BB-1011 Reversal', amountDisplay: '+GH₵ 12.00', dateDisplay: 'Aug 10, 2026', status: 'COMPLETED' },
];

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const balance = ((user?.walletBalancePesewas || 50000) / 100).toFixed(2);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Prepaid Balance
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            My Wallet
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Manage your prepaid balance for one-click checkout and seamless bulk dispatch.
          </p>
        </div>

        <Button variant="primary" size="md">
          + Top Up Wallet
        </Button>
      </div>

      {/* Balance Card & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        <Card
          style={{
            padding: 'var(--space-6)',
            background: 'linear-gradient(135deg, var(--color-bg-surface) 0%, var(--color-bg-surface-elevated) 100%)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Balance
              </span>
              <div style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                <Wallet size={18} strokeWidth={2.6} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
              GH₵ {balance}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'var(--space-4)' }}>
            <Button variant="primary" size="sm">
              Top Up
            </Button>
            <Button variant="outline" size="sm">
              Auto Top-Up Settings
            </Button>
          </div>
        </Card>

        {/* Security & Instant Float Guarantee */}
        <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)' }}>
              <ShieldCheck size={22} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Escrow Protected Balance
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
                Wallet funds are held securely and deducted only upon verified carrier confirmation.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          Recent Wallet Activity
        </h2>
        <Table headers={['Type', 'Description', 'Amount', 'Date', 'Status']}>
          {SAMPLE_TXS.map((tx) => (
            <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {tx.type === 'TOPUP' || tx.type === 'REFUND' ? (
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
              <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{tx.description}</td>
              <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: tx.amountDisplay.startsWith('+') ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                {tx.amountDisplay}
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{tx.dateDisplay}</td>
              <td>
                <span style={{ fontSize: 'var(--font-size-3xs)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  COMPLETED
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
};
