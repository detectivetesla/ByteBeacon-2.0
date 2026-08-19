import React, { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, PhoneInput, AmountInput, Select, DateInput, SearchInput } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  ArrowDownToLine,
  Wallet,
  DollarSign,
  RotateCcw,
  Download,
  Building,
  Layers,
  X,
  AlertCircle,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

export type PayoutStatus = 'COMPLETED' | 'PROCESSING' | 'PENDING' | 'FAILED' | 'REVERSED';
export type LedgerEntryType = 'Profit Earned' | 'Profit Adjustment' | 'Withdrawal' | 'Refund Adjustment' | 'Reversal';

export interface PayoutRecord {
  id: string;
  reference: string;
  amountPesewas: number;
  feePesewas: number;
  method: string;
  recipientAccount: string;
  recipientName: string;
  date: string;
  rawDate: string;
  status: PayoutStatus;
}

export interface ProfitLedgerRecord {
  id: string;
  date: string;
  rawDate: string;
  reference: string;
  type: LedgerEntryType;
  amountPesewas: number;
  balanceAfterPesewas: number;
  status: 'POSTED' | 'REVERSED';
  isCredit: boolean;
}

export const PayoutStatusBadge: React.FC<{ status: PayoutStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success" size={size} dot>Completed</Badge>;
    case 'PROCESSING':
      return <Badge variant="info" size={size} dot>Processing</Badge>;
    case 'PENDING':
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case 'FAILED':
      return <Badge variant="danger" size={size} dot>Failed</Badge>;
    case 'REVERSED':
      return <Badge variant="neutral" size={size}>Reversed</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const AgentWithdrawalsPage: React.FC = () => {
  const { user } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Authoritative Reseller Financial Balances
  const [availableProfitPesewas, setAvailableProfitPesewas] = useState<number>(0);
  const [totalProfitEarnedPesewas] = useState<number>(0);
  const [totalWithdrawnPesewas, setTotalWithdrawnPesewas] = useState<number>(0);

  // In-Place Withdraw Form Drawer / Panel State
  const [isWithdrawPanelOpen, setIsWithdrawPanelOpen] = useState(false);
  const [withdrawAmountGhs, setWithdrawAmountGhs] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'MTN_MOMO' | 'TELECEL_CASH' | 'AT_MONEY' | 'BANK'>('MTN_MOMO');
  const [payoutPhone, setPayoutPhone] = useState(user?.phone || '');
  const [accountName, setAccountName] = useState(user?.fullName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('GCB Bank Ghana');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(10);

  // Payout History & Profit Ledger
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [ledger, setLedger] = useState<ProfitLedgerRecord[]>([]);

  const availableProfitGhs = availableProfitPesewas / 100;
  const totalProfitEarnedGhs = totalProfitEarnedPesewas / 100;
  const totalWithdrawnGhs = totalWithdrawnPesewas / 100;

  const parsedWithdrawAmount = parseFloat(withdrawAmountGhs) || 0;
  const withdrawalFeeGhs = 0.00; // Zero fee for reseller payouts
  const netDisbursementGhs = Math.max(0, parsedWithdrawAmount - withdrawalFeeGhs);

  // Payout History Filtering & Sorting
  const filteredPayouts = useMemo(() => {
    let list = [...payouts];

    if (statusFilter !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.recipientAccount.includes(q) ||
          p.recipientName.toLowerCase().includes(q),
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date().getTime();
      list = list.filter((p) => {
        const pTime = new Date(p.rawDate).getTime();
        if (dateFilter === 'custom') {
          if (customStartDate && new Date(p.rawDate) < new Date(customStartDate)) return false;
          if (customEndDate && new Date(p.rawDate) > new Date(customEndDate + 'T23:59:59Z')) return false;
          return true;
        }
        const diffDays = (now - pTime) / (1000 * 60 * 60 * 24);
        if (dateFilter === 'today') return diffDays <= 1;
        if (dateFilter === '7d') return diffDays <= 7;
        if (dateFilter === '30d') return diffDays <= 30;
        if (dateFilter === '90d') return diffDays <= 90;
        if (dateFilter === '1y') return diffDays <= 365;
        return true;
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
      if (sortBy === 'oldest') return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
      if (sortBy === 'highest') return b.amountPesewas - a.amountPesewas;
      if (sortBy === 'lowest') return a.amountPesewas - b.amountPesewas;
      return 0;
    });

    return list;
  }, [payouts, statusFilter, searchQuery, dateFilter, customStartDate, customEndDate, sortBy]);

  const totalPayoutPages = Math.ceil(filteredPayouts.length / historyPageSize) || 1;
  const paginatedPayouts = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredPayouts.slice(start, start + historyPageSize);
  }, [filteredPayouts, historyPage, historyPageSize]);

  // Profit Ledger Filtering & Sorting
  const paginatedLedger = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPageSize;
    return ledger.slice(start, start + ledgerPageSize);
  }, [ledger, ledgerPage, ledgerPageSize]);
  const totalLedgerPages = Math.ceil(ledger.length / ledgerPageSize) || 1;

  // Handle Form Submission
  const handleConfirmWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();

    if (availableProfitGhs <= 0) {
      toastError('No Withdrawable Profit', 'You have no eligible profit available for payout.');
      return;
    }

    if (parsedWithdrawAmount < 10) {
      toastError('Minimum Required', 'Minimum profit withdrawal amount is GHS 10.00.');
      return;
    }

    if (parsedWithdrawAmount > availableProfitGhs) {
      toastError('Insufficient Profit', `Requested amount exceeds available profit of GHS ${availableProfitGhs.toFixed(2)}.`);
      return;
    }

    setIsSubmittingWithdrawal(true);

    setTimeout(() => {
      setIsSubmittingWithdrawal(false);
      const newPayout: PayoutRecord = {
        id: `WTH-${Math.floor(10000 + Math.random() * 90000)}`,
        reference: `PAYOUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        amountPesewas: Math.round(parsedWithdrawAmount * 100),
        feePesewas: 0,
        method: payoutMethod === 'BANK' ? `${bankName} Bank` : payoutMethod.replace('_', ' '),
        recipientAccount: payoutMethod === 'BANK' ? bankAccountNumber : payoutPhone,
        recipientName: accountName,
        date: 'Today, Just now',
        rawDate: new Date().toISOString(),
        status: 'PROCESSING',
      };

      const newLedgerEntry: ProfitLedgerRecord = {
        id: `LED-${Math.floor(1000 + Math.random() * 9000)}`,
        date: 'Today, Just now',
        rawDate: new Date().toISOString(),
        reference: newPayout.id,
        type: 'Withdrawal',
        amountPesewas: Math.round(parsedWithdrawAmount * 100),
        balanceAfterPesewas: availableProfitPesewas - Math.round(parsedWithdrawAmount * 100),
        status: 'POSTED',
        isCredit: false,
      };

      setAvailableProfitPesewas((prev) => Math.max(0, prev - Math.round(parsedWithdrawAmount * 100)));
      setTotalWithdrawnPesewas((prev) => prev + Math.round(parsedWithdrawAmount * 100));
      setPayouts((prev) => [newPayout, ...prev]);
      setLedger((prev) => [newLedgerEntry, ...prev]);
      setIsWithdrawPanelOpen(false);
      setWithdrawAmountGhs('');

      toastSuccess(
        'Payout Processing',
        `GH₵ ${parsedWithdrawAmount.toFixed(2)} payout initiated to ${payoutMethod === 'BANK' ? bankAccountNumber : payoutPhone}.`,
      );
    }, 1200);
  };

  const handleExportPayouts = (format: 'CSV' | 'EXCEL') => {
    const csvHeader = 'Withdrawal ID,Reference,Amount (GHS),Fee (GHS),Payout Method,Recipient Account,Recipient Name,Status,Date\n';
    const rows = filteredPayouts
      .map(
        (p) =>
          `${p.id},${p.reference},${(p.amountPesewas / 100).toFixed(2)},${(p.feePesewas / 100).toFixed(2)},"${p.method}","${p.recipientAccount}","${p.recipientName}",${p.status},"${p.date}"`,
      )
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payout_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Export Complete', `Payout history exported to ${format}.`);
  };

  const handleRefresh = () => {
    toastInfo('Refreshed', 'Withdrawal records and profit ledger synchronized.');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Earnings & Settlement
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Withdrawals
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage your reseller profit, available earnings, and payout history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={handleRefresh} leftIcon={<RotateCcw size={13} />}>
            Refresh ↻
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsWithdrawPanelOpen(true)}
            leftIcon={<ArrowDownToLine size={14} />}
          >
            Withdraw Profit →
          </Button>
        </div>
      </div>

      {/* 2. Top Summary Cards (Authoritative Reseller Financial Split) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Card 1: Available Profit (Green Tactile Financial Surface) */}
        <div
          style={{
            background: 'linear-gradient(145deg, #064E3B 0%, #022C22 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            color: '#FFFFFF',
            boxShadow: '0 8px 24px -4px rgba(6, 78, 59, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Available Profit
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <DollarSign size={15} color="#34D399" />
              </div>
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              GHS {availableProfitGhs.toFixed(2)}
            </div>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: '#A7F3D0', margin: '4px 0 0 0', fontWeight: 700 }}>
              Available for withdrawal
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-3xs)', color: 'rgba(255, 255, 255, 0.75)' }}>
            <span>Eligible reseller earnings from completed store orders.</span>
          </div>
        </div>

        {/* Card 2: Total Profit Earned */}
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Total Profit Earned
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={15} color="#3B82F6" />
              </div>
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              GHS {totalProfitEarnedGhs.toFixed(2)}
            </div>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Lifetime cumulative reseller profit
            </p>
          </div>

          <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
            Calculated directly from verified order sales and markup margins.
          </div>
        </Card>

        {/* Card 3: Total Withdrawn */}
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '180px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Total Withdrawn
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowDownToLine size={15} color="#8B5CF6" />
              </div>
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              GHS {totalWithdrawnGhs.toFixed(2)}
            </div>
            <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Successfully paid out profit
            </p>
          </div>

          <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
            Disbursed via automated MoMo & GHIPSS gateway rails.
          </div>
        </Card>
      </div>

      {/* 3. In-Place Withdraw Profit Interface Panel (Embedded & Expandable) */}
      {isWithdrawPanelOpen && (
        <Card
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1.5px solid var(--color-primary)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-tactile-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowDownToLine size={18} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Withdraw Reseller Profit
                </h2>
              </div>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                Disburse your withdrawable earnings directly to your mobile money or bank account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsWithdrawPanelOpen(false)}
              style={{
                background: 'none',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {availableProfitGhs <= 0 ? (
            /* Zero Withdrawable Profit Alert Guard */
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
              <AlertCircle size={28} color="var(--color-warning)" style={{ margin: '0 auto var(--space-2) auto' }} />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                No withdrawable profit available
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Your eligible reseller earnings will appear here once they become available.
              </p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Button variant="outline" size="sm" onClick={() => setIsWithdrawPanelOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* Active Withdrawal Form */
            <form onSubmit={handleConfirmWithdrawal} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Available Profit Status Callout */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>Available Profit:</span>
                <strong style={{ color: 'var(--color-success)', fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-sm)' }}>
                  GHS {availableProfitGhs.toFixed(2)}
                </strong>
              </div>

              {/* Payout Method Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Payout Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { id: 'MTN_MOMO', label: 'MTN MoMo', icon: Smartphone },
                    { id: 'TELECEL_CASH', label: 'Telecel Cash', icon: Smartphone },
                    { id: 'AT_MONEY', label: 'AT Money', icon: Smartphone },
                    { id: 'BANK', label: 'Bank Transfer', icon: Building },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = payoutMethod === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setPayoutMethod(m.id as any)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-bg-surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Icon size={14} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: isSelected ? 800 : 600, color: 'var(--color-text-primary)' }}>
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Account / Phone Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
                {payoutMethod !== 'BANK' ? (
                  <PhoneInput
                    label="Mobile Money Number"
                    value={payoutPhone}
                    onChange={(e) => setPayoutPhone(e.target.value)}
                    placeholder="024 123 4567"
                    required
                  />
                ) : (
                  <>
                    <Input
                      label="Bank Name"
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. GCB Bank"
                      required
                    />
                    <Input
                      label="Bank Account Number"
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="10-digit account number"
                      required
                    />
                  </>
                )}

                <Input
                  label="Account Holder Name"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Full legal name"
                  required
                />
              </div>

              {/* Amount to Withdraw */}
              <AmountInput
                label="Withdrawal Amount"
                placeholder="10.00"
                value={withdrawAmountGhs}
                onChange={(e) => setWithdrawAmountGhs(e.target.value)}
                min={10}
                max={availableProfitGhs}
                quickAmounts={[20, 50, 100, 200, 500]}
                required
              />

              {/* Summary Breakdown */}
              {parsedWithdrawAmount > 0 && (
                <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                    <span>Gross Withdrawal:</span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>GHS {parsedWithdrawAmount.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                    <span>Disbursement Fee:</span>
                    <span style={{ color: 'var(--color-success)' }}>GHS 0.00 (Free)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '3px', marginTop: '2px' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>Net to Receive:</strong>
                    <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)' }}>
                      GHS {netDisbursementGhs.toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Submit Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
                <Button variant="outline" size="md" type="button" onClick={() => setIsWithdrawPanelOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  isLoading={isSubmittingWithdrawal}
                  disabled={parsedWithdrawAmount <= 0 || parsedWithdrawAmount > availableProfitGhs}
                >
                  Confirm Withdrawal
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* 4. Financial Wallet Ledger (Dedicated Reseller Profit Ledger Section) */}
      <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Financial Wallet Ledger
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Authoritative double-entry audit records affecting reseller profit balances.
            </p>
          </div>
        </div>

        {ledger.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-lg)' }}>
            <Wallet size={24} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No ledger entries recorded yet.
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Completed reseller orders and payouts will record immutable ledger lines here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reference</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Type</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Balance</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLedger.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {row.reference}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-3xs)',
                          fontWeight: 800,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: row.isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: row.isCredit ? '#10B981' : 'var(--color-danger)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontFamily: 'var(--font-data)',
                        fontWeight: 800,
                        color: row.isCredit ? '#10B981' : 'var(--color-danger)',
                      }}
                    >
                      {row.isCredit ? '+' : '-'}GH₵ {(row.amountPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      GH₵ {(row.balanceAfterPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant="success" size="sm" dot>Posted</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ledger Pagination Bar */}
        {ledger.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-3) 0 0 0', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Showing {ledger.length > 0 ? (ledgerPage - 1) * ledgerPageSize + 1 : 0}–
                {Math.min(ledgerPage * ledgerPageSize, ledger.length)} of {ledger.length} entries
              </span>
              <div style={{ minWidth: '95px' }}>
                <Select
                  value={String(ledgerPageSize)}
                  onChange={(e) => {
                    setLedgerPageSize(Number(e.target.value));
                    setLedgerPage(1);
                  }}
                  options={[
                    { label: '10 / page', value: '10' },
                    { label: '25 / page', value: '25' },
                    { label: '50 / page', value: '50' },
                  ]}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                disabled={ledgerPage === 1}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  cursor: ledgerPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage === 1 ? 0.5 : 1,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
                disabled={ledgerPage === totalLedgerPages}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  cursor: ledgerPage === totalLedgerPages ? 'not-allowed' : 'pointer',
                  opacity: ledgerPage === totalLedgerPages ? 0.5 : 1,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Payout History Section (Filterable, Sortable, Paginated Table) */}
      <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Payout History
            </h2>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Historical payout requests and automated disbursement records.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={() => handleExportPayouts('CSV')} leftIcon={<Download size={13} />}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {/* Status Filter */}
          <div style={{ minWidth: '130px' }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setHistoryPage(1);
              }}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Completed', value: 'COMPLETED' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Reversed', value: 'REVERSED' },
              ]}
            />
          </div>

          {/* Date Filter */}
          <div style={{ minWidth: '120px' }}>
            <Select
              label="Date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setHistoryPage(1);
              }}
              options={[
                { label: 'Today', value: 'today' },
                { label: '7 days', value: '7d' },
                { label: '30 days', value: '30d' },
                { label: '90 days', value: '90d' },
                { label: '1 year', value: '1y' },
                { label: 'All Time', value: 'all' },
                { label: 'Custom Range', value: 'custom' },
              ]}
            />
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <DateInput
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setHistoryPage(1);
                }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>to</span>
              <DateInput
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setHistoryPage(1);
                }}
              />
            </div>
          )}

          {/* Search Keyword */}
          <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
            <SearchInput
              placeholder="Search reference or account..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHistoryPage(1);
              }}
            />
          </div>

          {/* Sort By Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto', minWidth: '150px' }}>
            <ArrowUpDown size={13} color="var(--color-text-muted)" />
            <Select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setHistoryPage(1);
              }}
              options={[
                { label: 'Sort: Newest', value: 'newest' },
                { label: 'Sort: Oldest', value: 'oldest' },
                { label: 'Highest Amount', value: 'highest' },
                { label: 'Lowest Amount', value: 'lowest' },
              ]}
            />
          </div>
        </div>

        {/* Payout Table */}
        {filteredPayouts.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-lg)' }}>
            <ArrowDownToLine size={28} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No withdrawal history.
            </h3>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Completed and previous withdrawal requests will appear here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Withdrawal ID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Method</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayouts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {p.id}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      GH₵ {(p.amountPesewas / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{p.method}</strong>
                        <span style={{ display: 'block', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {p.recipientAccount} ({p.recipientName})
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <PayoutStatusBadge status={p.status} size="sm" />
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                      {p.date}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)' }}>
                      {p.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredPayouts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-3) 0 0 0', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Showing {filteredPayouts.length > 0 ? (historyPage - 1) * historyPageSize + 1 : 0}–
                {Math.min(historyPage * historyPageSize, filteredPayouts.length)} of {filteredPayouts.length} payouts
              </span>
              <div style={{ minWidth: '95px' }}>
                <Select
                  value={String(historyPageSize)}
                  onChange={(e) => {
                    setHistoryPageSize(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  options={[
                    { label: '10 / page', value: '10' },
                    { label: '25 / page', value: '25' },
                    { label: '50 / page', value: '50' },
                  ]}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: historyPage === 1 ? 0.5 : 1,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(totalPayoutPages, p + 1))}
                disabled={historyPage === totalPayoutPages}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  cursor: historyPage === totalPayoutPages ? 'not-allowed' : 'pointer',
                  opacity: historyPage === totalPayoutPages ? 0.5 : 1,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
