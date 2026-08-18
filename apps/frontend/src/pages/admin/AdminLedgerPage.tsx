import React from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { BentoCard } from '../../components/ui/BentoCard/BentoCard.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Database } from 'lucide-react';

export const AdminLedgerPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Financial Architecture
        </span>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
          Double-Entry Financial Ledger
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Immutable balance sheet tracking system float, escrow reserves, customer liabilities, and carrier settlement accounts.
        </p>
      </div>

      {/* Balance Sheet Stats */}
      <div className="bento-grid">
        <BentoCard
          colSpan={3}
          accent="green"
          tag="System Carrier Float"
          title="GH₵ 84,200.00"
          subtitle="Pre-funded carrier balance"
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
            MTN (60%), Telecel (25%), AT (15%)
          </div>
        </BentoCard>

        <BentoCard
          colSpan={3}
          accent="cyan"
          tag="Customer Escrow"
          title="GH₵ 32,450.00"
          subtitle="Active customer wallet float"
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-cyan)', fontWeight: 600 }}>
            Held in designated settlement escrow
          </div>
        </BentoCard>

        <BentoCard
          colSpan={3}
          accent="indigo"
          tag="Agent Liabilities"
          title="GH₵ 12,800.00"
          subtitle="Unwithdrawn reseller commissions"
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-indigo)', fontWeight: 600 }}>
            Payable on-demand
          </div>
        </BentoCard>

        <BentoCard
          colSpan={3}
          accent="amber"
          tag="Net Platform Profit"
          title="GH₵ 18,920.00"
          subtitle="Settled operator margin"
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-amber)', fontWeight: 600 }}>
            Audit reconciled: 100%
          </div>
        </BentoCard>
      </div>

      {/* Ledger Accounts Table */}
      <Card style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} color="var(--color-primary)" />
          Chart of Accounts Summary
        </h2>
        <Table headers={['Account Code', 'Account Name', 'Classification', 'Debit Balance', 'Credit Balance', 'Status']}>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>1010-CASH</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Hubtel / MoMo Gateway Escrow</td>
            <td style={{ fontSize: 'var(--font-size-xs)' }}>Asset</td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>GH₵ 129,450.00</td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>GH₵ 0.00</td>
            <td><span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-3xs)' }}>BALANCED</span></td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>1020-FLOAT</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Telecom Carrier Pre-funded Float</td>
            <td style={{ fontSize: 'var(--font-size-xs)' }}>Asset</td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>GH₵ 84,200.00</td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>GH₵ 0.00</td>
            <td><span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-3xs)' }}>BALANCED</span></td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>2010-ESCROW</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Customer Prepaid Deposits</td>
            <td style={{ fontSize: 'var(--font-size-xs)' }}>Liability</td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>GH₵ 0.00</td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>GH₵ 32,450.00</td>
            <td><span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-3xs)' }}>BALANCED</span></td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>2020-COMM</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Agent Withdrawable Commissions</td>
            <td style={{ fontSize: 'var(--font-size-xs)' }}>Liability</td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>GH₵ 0.00</td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>GH₵ 12,800.00</td>
            <td><span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-3xs)' }}>BALANCED</span></td>
          </tr>
        </Table>
      </Card>
    </div>
  );
};
