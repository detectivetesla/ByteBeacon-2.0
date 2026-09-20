import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Modal } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Database,
  RefreshCw,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  User,
  CheckCircle,
  Eye,
  PlusCircle,
  Check,
  X,
  ExternalLink,
  Copy,
  Clock,
} from 'lucide-react';
import {
  adminApi,
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminTransactionDetailDto,
  AdminLedgerAnomalyDto,
  FinancialAdjustmentDto,
} from '../../api/admin.api.js';

// Standardized Tactile Button & Input Styles
const tactileButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.45rem 0.85rem',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  boxShadow: 'var(--shadow-tactile-sm)',
};

const primaryButtonStyle: React.CSSProperties = {
  ...tactileButtonStyle,
  background: 'linear-gradient(180deg, var(--color-primary-bright, #22C55E) 0%, var(--color-primary, #16A34A) 100%)',
  backgroundColor: 'var(--color-brand, #16A34A)',
  color: '#FFFFFF',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  boxShadow: 'var(--shadow-tactile-btn, 0 4px 14px rgba(22, 163, 74, 0.35))',
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  ...tactileButtonStyle,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--color-danger, #EF4444)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  fontWeight: 700,
};

const selectStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  backgroundColor: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  minWidth: '135px',
  boxShadow: 'var(--shadow-tactile-sm)',
};

export const AdminLedgerPage: React.FC = () => {
  const { toastSuccess, toastError, toastWarning, toastInfo: _toastInfo } = useToast();

  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'LEDGER' | 'ADJUSTMENTS'>('TRANSACTIONS');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AdminFinanceStats | null>(null);

  // --- Transactions State ---
  const [txPage, setTxPage] = useState(1);
  const [txSearch, setTxSearch] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState('ALL');
  const [txNetworkFilter, setTxNetworkFilter] = useState('ALL');
  const [transactions, setTransactions] = useState<AdminTransactionListItem[]>([]);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  // --- Transaction Dossier Drawer State ---
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<AdminTransactionDetailDto | null>(null);
  const [txDetailLoading, setTxDetailLoading] = useState(false);
  const [txDossierTab, setTxDossierTab] = useState<'OVERVIEW' | 'FINANCIAL' | 'GATEWAY' | 'ORDER_AUDIT'>('OVERVIEW');

  // --- Ledger State ---
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerEntryType, setLedgerEntryType] = useState('ALL');
  const [ledgerAccountType, setLedgerAccountType] = useState('ALL');
  const [ledgerLines, setLedgerLines] = useState<any[]>([]);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerBalanced, setLedgerBalanced] = useState(true);
  const [totalDebitsPesewas, setTotalDebitsPesewas] = useState(0);
  const [totalCreditsPesewas, setTotalCreditsPesewas] = useState(0);

  // --- Anomalies State ---
  const [anomalies, setAnomalies] = useState<AdminLedgerAnomalyDto[]>([]);
  const [anomaliesModalOpen, setAnomaliesModalOpen] = useState(false);

  // --- Adjustments State ---
  const [adjustments, setAdjustments] = useState<FinancialAdjustmentDto[]>([]);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjUserId, setAdjUserId] = useState('');
  const [adjAmountGhs, setAdjAmountGhs] = useState('');
  const [adjDirection, setAdjDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjReason, setAdjReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // --- Review Adjustment Modal State ---
  const [reviewAdjTarget, setReviewAdjTarget] = useState<{ id: string; adj: FinancialAdjustmentDto; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [reviewAdjReason, setReviewAdjReason] = useState('');
  const [reviewAdjSubmitting, setReviewAdjSubmitting] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toastSuccess('Copied', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Fetch High-Level Overview Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await adminApi.getFinanceOverview();
      setStats(res);
    } catch {
      // Fallback
    }
  }, []);

  // 2. Fetch Transactions List
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceTransactions({
        page: txPage,
        limit: 20,
        search: txSearch.trim() || undefined,
        status: txStatusFilter !== 'ALL' ? txStatusFilter : undefined,
        type: txTypeFilter !== 'ALL' ? txTypeFilter : undefined,
        network: txNetworkFilter !== 'ALL' ? txNetworkFilter : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setTransactions(res.items);
        setTxTotalPages(res.pagination?.totalPages || 1);
        setTxTotal(res.pagination?.total || res.items.length);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [txPage, txSearch, txStatusFilter, txTypeFilter, txNetworkFilter]);

  // 3. Fetch Ledger Entries
  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getFinanceLedger({
        page: ledgerPage,
        limit: 25,
        entryType: ledgerEntryType !== 'ALL' ? ledgerEntryType : undefined,
        accountType: ledgerAccountType !== 'ALL' ? ledgerAccountType : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setLedgerLines(res.items);
        setLedgerTotalPages(res.pagination?.totalPages || 1);
        setLedgerTotal(res.pagination?.total || res.items.length);
        setLedgerBalanced(res.isBalanced);
        setTotalDebitsPesewas(res.totalDebitsPesewas);
        setTotalCreditsPesewas(res.totalCreditsPesewas);
      }
    } catch {
      setLedgerLines([]);
    } finally {
      setIsLoading(false);
    }
  }, [ledgerPage, ledgerEntryType, ledgerAccountType]);

  // 4. Fetch Adjustments
  const fetchAdjustments = useCallback(async () => {
    try {
      const res = await adminApi.getFinanceAdjustments();
      setAdjustments(res || []);
    } catch {
      setAdjustments([]);
    }
  }, []);

  // 5. Fetch Anomalies Scanner
  const scanAnomalies = async () => {
    try {
      const res = await adminApi.getFinanceLedgerAnomalies();
      setAnomalies(res.anomalies || []);
      setAnomaliesModalOpen(true);
    } catch {
      toastError('Scanner Error', 'Failed to scan ledger anomalies.');
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'TRANSACTIONS') fetchTransactions();
    if (activeTab === 'LEDGER') fetchLedger();
    if (activeTab === 'ADJUSTMENTS') fetchAdjustments();
  }, [activeTab, fetchTransactions, fetchLedger, fetchAdjustments]);

  // Open Transaction Dossier Drawer
  const handleOpenTxDetail = async (id: string) => {
    setSelectedTxId(id);
    setTxDossierTab('OVERVIEW');
    setTxDetailLoading(true);
    try {
      const res = await adminApi.getFinanceTransactionDetail(id);
      setTxDetail(res);
    } catch (err: any) {
      toastError('Dossier Error', err.message || 'Could not fetch transaction dossier.');
    } finally {
      setTxDetailLoading(false);
    }
  };

  // Submit Float Adjustment Request
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjUserId.trim() || !adjAmountGhs.trim() || !adjReason.trim()) {
      toastWarning('Missing Information', 'Please fill all required adjustment fields.');
      return;
    }
    setAdjSubmitting(true);
    try {
      const amountPesewas = Math.round(parseFloat(adjAmountGhs) * 100);
      await adminApi.requestFinancialAdjustment({
        userId: adjUserId.trim(),
        amountPesewas,
        direction: adjDirection,
        reason: adjReason.trim(),
      });
      toastSuccess('Adjustment Submitted', 'Float adjustment request queued for Super Admin dual authorization.');
      setIsAdjModalOpen(false);
      setAdjUserId('');
      setAdjAmountGhs('');
      setAdjReason('');
      fetchAdjustments();
      fetchOverview();
    } catch (err: any) {
      toastError('Submission Failed', err.response?.data?.message || err.message || 'Failed to submit adjustment.');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Confirm Review Float Adjustment
  const handleConfirmReviewAdjustment = async () => {
    if (!reviewAdjTarget) return;
    if (!reviewAdjReason.trim() || reviewAdjReason.trim().length < 4) {
      toastError('Reason Required', 'A clear audit reason is required (min 4 characters).');
      return;
    }
    setReviewAdjSubmitting(true);
    try {
      await adminApi.reviewFinancialAdjustment(reviewAdjTarget.id, {
        action: reviewAdjTarget.action,
        reason: reviewAdjReason.trim(),
      });
      toastSuccess(
        `Adjustment ${reviewAdjTarget.action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        `Successfully processed adjustment #${reviewAdjTarget.adj.adjustmentNumber}.`
      );
      setReviewAdjTarget(null);
      setReviewAdjReason('');
      fetchAdjustments();
      fetchOverview();
    } catch (err: any) {
      toastError('Review Failed', err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setReviewAdjSubmitting(false);
    }
  };

  // Active filter chips for Transactions
  const activeTxFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (txSearch.trim()) {
      chips.push({ id: 'search', label: `Search: "${txSearch}"`, onRemove: () => { setTxSearch(''); setTxPage(1); } });
    }
    if (txStatusFilter !== 'ALL') {
      chips.push({ id: 'status', label: `Status: ${txStatusFilter}`, onRemove: () => { setTxStatusFilter('ALL'); setTxPage(1); } });
    }
    if (txTypeFilter !== 'ALL') {
      chips.push({ id: 'type', label: `Type: ${txTypeFilter}`, onRemove: () => { setTxTypeFilter('ALL'); setTxPage(1); } });
    }
    if (txNetworkFilter !== 'ALL') {
      chips.push({ id: 'network', label: `Carrier: ${txNetworkFilter}`, onRemove: () => { setTxNetworkFilter('ALL'); setTxPage(1); } });
    }
    return chips;
  }, [txSearch, txStatusFilter, txTypeFilter, txNetworkFilter]);

  // Active filter chips for Ledger
  const activeLedgerFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (ledgerEntryType !== 'ALL') {
      chips.push({ id: 'entryType', label: `Entry: ${ledgerEntryType}`, onRemove: () => { setLedgerEntryType('ALL'); setLedgerPage(1); } });
    }
    if (ledgerAccountType !== 'ALL') {
      chips.push({ id: 'accountType', label: `Account: ${ledgerAccountType}`, onRemove: () => { setLedgerAccountType('ALL'); setLedgerPage(1); } });
    }
    return chips;
  }, [ledgerEntryType, ledgerAccountType]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header (Standardized with Tactile Buttons) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Database} color="security" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Core Financial Engine & Audit
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Finance, Transactions & Ledger
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Authoritative double-entry general ledger, transaction explorer, and float adjustment administration.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              fetchOverview();
              if (activeTab === 'TRANSACTIONS') fetchTransactions();
              else if (activeTab === 'LEDGER') fetchLedger();
              else fetchAdjustments();
            }}
            disabled={isLoading}
            style={tactileButtonStyle}
            title="Refresh Active Ledger Dataset"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={scanAnomalies}
            style={tactileButtonStyle}
            title="Run Real-time Ledger Invariant Verification"
          >
            <ShieldCheck size={14} />
            <span>Scan Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdjModalOpen(true)}
            style={primaryButtonStyle}
            title="Request Dual-Control Float Adjustment"
          >
            <PlusCircle size={14} />
            <span>Request Float Adj.</span>
          </button>
        </div>
      </div>

      {/* 2. 8 Authoritative Financial KPI Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Platform Float"
          value={`GH₵ ${(((stats?.totalPlatformBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Customer + Agent combined reserves"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          title="Customer Float"
          value={`GH₵ ${(((stats?.customerWalletBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="End-user active balances"
          accent="blue"
          icon={<TactileIcon icon={User} color="orders" size="sm" />}
        />
        <MetricCard
          title="Agent Float"
          value={`GH₵ ${(((stats?.agentWalletBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Agent & SuperAgent balances"
          accent="orange"
          icon={<TactileIcon icon={Layers} color="speed" size="sm" />}
        />
        <MetricCard
          title="Lifetime Revenue"
          value={`GH₵ ${(((stats?.totalRevenuePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Completed order gross value"
          accent="green"
          icon={<TactileIcon icon={CreditCard} color="security" size="sm" />}
        />
        <MetricCard
          title="Total Deposits"
          value={`GH₵ ${(((stats?.totalDepositsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Verified external gateway inflows"
          accent="blue"
          icon={<TactileIcon icon={ArrowDownLeft} color="api" size="sm" />}
        />
        <MetricCard
          title="Total Withdrawals"
          value={`GH₵ ${(((stats?.totalWithdrawalsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Settled agent store payouts"
          accent="purple"
          icon={<TactileIcon icon={ArrowUpRight} color="payments" size="sm" />}
        />
        <MetricCard
          title="Total Refunds"
          value={`GH₵ ${(((stats?.totalRefundsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          subvalue="Processed order reversals"
          accent="amber"
          icon={<TactileIcon icon={AlertTriangle} color="amber" size="sm" />}
        />
        <div onClick={scanAnomalies} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Ledger Invariant"
            value={stats?.ledgerBalanceStatus === 'BALANCED' ? 'BALANCED' : 'ANOMALY DETECTED'}
            subvalue="Continuous zero-sum verification"
            accent={stats?.ledgerBalanceStatus === 'BALANCED' ? 'green' : 'red'}
            icon={<TactileIcon icon={ShieldCheck} color={stats?.ledgerBalanceStatus === 'BALANCED' ? 'security' : 'red'} size="sm" />}
          />
        </div>
      </div>

      {/* 3. Segmented Tactile Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          padding: '0.25rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'TRANSACTIONS', label: 'Unified Transactions Explorer', icon: <CreditCard size={13} />, count: stats?.totalDepositsCount ?? (transactions.length ? txTotal : undefined) },
          { id: 'LEDGER', label: 'General Ledger Journal Lines', icon: <Database size={13} />, count: ledgerTotal || undefined },
          { id: 'ADJUSTMENTS', label: 'Two-Person Float Adjustments', icon: <PlusCircle size={13} />, count: adjustments.filter(a => a.status === 'PENDING').length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: UNIFIED TRANSACTIONS EXPLORER --- */}
      {activeTab === 'TRANSACTIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Compact Filter Toolbar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 260px', maxWidth: '380px' }}>
                <SearchInput
                  value={txSearch}
                  onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
                  placeholder="Reference, transaction ID, email, phone..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <select
                  value={txStatusFilter}
                  onChange={(e) => { setTxStatusFilter(e.target.value); setTxPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Transaction Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Completed / Paid</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>

                <select
                  value={txTypeFilter}
                  onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Transaction Type"
                >
                  <option value="ALL">All Types</option>
                  <option value="DATA_PURCHASE">Data Purchase</option>
                  <option value="DEPOSIT">Float Deposit</option>
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                </select>

                <select
                  value={txNetworkFilter}
                  onChange={(e) => { setTxNetworkFilter(e.target.value); setTxPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Network Carrier"
                >
                  <option value="ALL">All Carriers</option>
                  <option value="MTN">MTN Ghana</option>
                  <option value="TELECEL">Telecel</option>
                  <option value="AIRTELTIGO">AT Ghana</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchTransactions()}
                  disabled={isLoading}
                  style={{ ...tactileButtonStyle, padding: '0.45rem 0.6rem', color: 'var(--color-text-muted)' }}
                  title="Refresh Transactions"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeTxFilters.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                  paddingTop: '0.25rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                  Active Filters:
                </span>
                {activeTxFilters.map((chip) => (
                  <span
                    key={chip.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.2rem 0.55rem',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => { setTxSearch(''); setTxStatusFilter('ALL'); setTxTypeFilter('ALL'); setTxNetworkFilter('ALL'); setTxPage(1); }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Transactions Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Unified Ledger Transactions
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Complete transaction activity across wallet deposits, data purchases, and dual-control float adjustments.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {transactions.length} of {txTotal} transactions
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Reference & ID</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Type</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Customer / Agent</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Carrier</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Date</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                        <span>Loading transactions from double-entry ledger...</span>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No financial transactions matching the selected filter criteria.</span>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => handleOpenTxDetail(tx.id)}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-primary)' }}>
                                {tx.reference.length > 28 ? `${tx.reference.slice(0, 16)}...${tx.reference.slice(-8)}` : tx.reference}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCopy(tx.reference, `ref_${tx.id}`); }}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === `ref_${tx.id}` ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                                title="Copy reference"
                              >
                                {copiedKey === `ref_${tx.id}` ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              ID: {tx.id.slice(0, 12)}...
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge
                            variant={tx.type === 'DATA_PURCHASE' ? 'brand' : tx.type === 'DEPOSIT' ? 'success' : 'purple'}
                            size="sm"
                          >
                            {tx.type}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--color-brand-primary)',
                              }}
                            >
                              {(tx.userName || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                                {tx.userName}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                {tx.userEmail || tx.userPhone || '—'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(tx.amountPesewas / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>
                            {tx.network ? (
                              <Badge variant="neutral" size="xs">{tx.network}</Badge>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={tx.status === 'PAID' ? 'success' : tx.status === 'PROCESSING' ? 'warning' : 'danger'} size="sm">
                            {tx.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenTxDetail(tx.id); }}
                            style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                            title="Inspect Financial Dossier"
                          >
                            <Eye size={12} />
                            <span>Audit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Pagination
                currentPage={txPage}
                totalPages={txTotalPages}
                totalItems={txTotal}
                onPageChange={(p) => setTxPage(p)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* --- TAB 2: GENERAL LEDGER AUDIT TRAIL --- */}
      {activeTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Balance Invariant Notification Banner */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              backgroundColor: ledgerBalanced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${ledgerBalanced ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {ledgerBalanced ? (
                <CheckCircle size={20} color="var(--color-success)" />
              ) : (
                <AlertTriangle size={20} color="var(--color-danger)" />
              )}
              <div>
                <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: ledgerBalanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {ledgerBalanced ? 'Double-Entry Invariant VALIDATED (Zero-Sum Invariant Satisfied)' : 'CRITICAL LEDGER IMBALANCE DETECTED'}
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Total Debits: <strong>GH₵ {(totalDebitsPesewas / 100).toFixed(2)}</strong> | Total Credits: <strong>GH₵ {(totalCreditsPesewas / 100).toFixed(2)}</strong> | Net Variance: <strong>GH₵ {Math.abs((totalDebitsPesewas - totalCreditsPesewas) / 100).toFixed(2)}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={scanAnomalies}
              style={{ ...tactileButtonStyle, padding: '0.4rem 0.75rem' }}
            >
              <ShieldCheck size={13} />
              <span>Inspect Anomalies ({anomalies.length})</span>
            </button>
          </div>

          {/* Compact Ledger Filter Toolbar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Entry Type:
                </span>
                <select
                  value={ledgerEntryType}
                  onChange={(e) => { setLedgerEntryType(e.target.value); setLedgerPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Entry Type"
                >
                  <option value="ALL">All Entries</option>
                  <option value="DEBIT">DEBIT (Asset Outflow / Exp)</option>
                  <option value="CREDIT">CREDIT (Inflow / Liability)</option>
                </select>

                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginLeft: '0.5rem' }}>
                  Account Class:
                </span>
                <select
                  value={ledgerAccountType}
                  onChange={(e) => { setLedgerAccountType(e.target.value); setLedgerPage(1); }}
                  style={selectStyle}
                  aria-label="Filter Account Type"
                >
                  <option value="ALL">All Accounts</option>
                  <option value="CUSTOMER_WALLET">Customer Wallet</option>
                  <option value="AGENT_WALLET">Agent Wallet</option>
                  <option value="PLATFORM_ESCROW">Platform Escrow Reserve</option>
                  <option value="PROVIDER_PAYABLE">Provider Payable</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => fetchLedger()}
                disabled={isLoading}
                style={{ ...tactileButtonStyle, padding: '0.45rem 0.6rem', color: 'var(--color-text-muted)' }}
                title="Refresh Ledger Lines"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Active Filter Chips */}
            {activeLedgerFilters.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                  paddingTop: '0.25rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                  Active Filters:
                </span>
                {activeLedgerFilters.map((chip) => (
                  <span
                    key={chip.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.2rem 0.55rem',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => { setLedgerEntryType('ALL'); setLedgerAccountType('ALL'); setLedgerPage(1); }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Ledger Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Authoritative Double-Entry Ledger Lines
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Granular debit and credit vouchers validating financial equilibrium across all user and operational accounts.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {ledgerLines.length} of {ledgerTotal} ledger lines
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Journal ID</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Entry Type</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Account</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Account ID</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Reference</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Description</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                        <span>Loading ledger journal entries...</span>
                      </td>
                    </tr>
                  ) : ledgerLines.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No ledger journal entries found matching the filter.</span>
                      </td>
                    </tr>
                  ) : (
                    ledgerLines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {line.transactionId ? `${line.transactionId.slice(0, 12)}...` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={line.entryType === 'DEBIT' ? 'danger' : 'success'} size="xs">
                            {line.entryType}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '11px' }}>{line.accountType}</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {line.accountId ? `${line.accountId.slice(0, 10)}...` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: '11px', color: line.entryType === 'DEBIT' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {line.entryType === 'DEBIT' ? '-' : '+'} GH₵ {(line.amountPesewas / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: '11px' }}>{line.referenceType || 'TX'}</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {line.referenceId ? line.referenceId.slice(0, 12) : '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', maxWidth: '240px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={line.description}>
                            {line.description}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(line.createdAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Pagination
                currentPage={ledgerPage}
                totalPages={ledgerTotalPages}
                totalItems={ledgerTotal}
                onPageChange={(p) => setLedgerPage(p)}
              />
            </div>
          </Card>
        </div>
      )}

      {/* --- TAB 3: TWO-PERSON FLOAT ADJUSTMENTS --- */}
      {activeTab === 'ADJUSTMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header Protocol Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Two-Person Dual Control Protocol
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Direct wallet overrides are blocked by platform invariant. Adjustments must be requested by Admin and authorized by Super Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAdjModalOpen(true)}
              style={primaryButtonStyle}
            >
              <PlusCircle size={14} />
              <span>Create Adjustment Request</span>
            </button>
          </Card>

          {/* Adjustments Queue Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Dual Control Authorization Queue
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Pending and historical balance adjustments requiring multi-party verification.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {adjustments.length} requests on record
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Adjustment #</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Target User</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Direction</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Requested By</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Reason</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span>No float adjustment requests in queue.</span>
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => (
                      <tr key={adj.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '11px', color: 'var(--color-brand-primary)' }}>
                            {adj.adjustmentNumber}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{adj.userName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {adj.userEmail} ({adj.userRole})
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(adj.amountPesewas / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={adj.direction === 'CREDIT' ? 'success' : 'danger'} size="xs">
                            {adj.direction}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: '11px' }}>{adj.requestedByName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {new Date(adj.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', maxWidth: '220px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={adj.reason}>
                            {adj.reason}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <Badge variant={adj.status === 'APPROVED' ? 'success' : adj.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                            {adj.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            {adj.status === 'PENDING' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewAdjTarget({ id: adj.id, adj, action: 'APPROVE' });
                                    setReviewAdjReason(`Approved float adjustment #${adj.adjustmentNumber}`);
                                  }}
                                  style={{ ...primaryButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                  title="Approve Float Adjustment"
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewAdjTarget({ id: adj.id, adj, action: 'REJECT' });
                                    setReviewAdjReason('');
                                  }}
                                  style={{ ...dangerButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                  title="Reject Float Adjustment"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                {adj.status} by {adj.approvedByName || 'Super Admin'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TRANSACTION DOSSIER DRAWER & BACKDROP (zIndex 250 / 260)              */}
      {/* ========================================================================= */}
      {selectedTxId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedTxId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-xl, 0 20px 50px rgba(0,0,0,0.5))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand-primary)',
                  }}
                >
                  <CreditCard size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      Transaction Audit Dossier
                    </h2>
                    {txDetail?.transaction.status && (
                      <Badge variant={txDetail.transaction.status === 'PAID' ? 'success' : txDetail.transaction.status === 'PROCESSING' ? 'warning' : 'danger'} size="sm">
                        {txDetail.transaction.status}
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Ref: {txDetail?.transaction.reference || selectedTxId}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTxId(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.4rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  borderRadius: 'var(--radius-sm)',
                }}
                title="Close Dossier"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dossier Tabs Switcher */}
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                padding: '0.5rem var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
              }}
            >
              {[
                { id: 'OVERVIEW', label: 'Overview & Profile', icon: <Layers size={13} /> },
                { id: 'FINANCIAL', label: 'Double-Entry Journal', icon: <DollarSign size={13} /> },
                { id: 'GATEWAY', label: 'Gateway Telemetry', icon: <ShieldCheck size={13} /> },
                { id: 'ORDER_AUDIT', label: 'Order & Security Audit', icon: <Clock size={13} /> },
              ].map((tab) => {
                const isActive = txDossierTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTxDossierTab(tab.id as any)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                      backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '11px',
                      cursor: 'pointer',
                      boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dossier Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {txDetailLoading ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-3)' }} />
                  <span>Loading transaction records from double-entry ledger...</span>
                </div>
              ) : !txDetail ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <span>Transaction details could not be loaded.</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {txDossierTab === 'OVERVIEW' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Metric Summary Strip */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Settled Amount</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                            GH₵ {(txDetail.transaction.amountPesewas / 100).toFixed(2)}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Payment Gateway</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {txDetail.externalPayment?.provider || 'Paystack'}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Channel / Type</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {txDetail.transaction.type || 'DEPOSIT'}
                          </p>
                        </div>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Timestamp</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            {new Date(txDetail.transaction.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Customer / Agent Profile Card */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Customer & Agent Profile
                          </h4>
                          {txDetail.transaction.userId && (
                            <a
                              href={`/admin/users/${txDetail.transaction.userId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', textDecoration: 'none' }}
                            >
                              <span>View Full Dossier</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Full Name</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                              {txDetail.transaction.userName}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Email Address</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.transaction.userEmail || '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Phone Number</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.transaction.userPhone || '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Account Role</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant={txDetail.transaction.userRole === 'AGENT' ? 'success' : txDetail.transaction.userRole === 'ADMIN' ? 'warning' : 'neutral'} size="xs">
                                {txDetail.transaction.userRole || 'CUSTOMER'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Authoritative Identifiers Card */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Authoritative Identifiers
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Provider Reference:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{txDetail.transaction.reference}</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(txDetail.transaction.reference, 'dossier_ref')}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === 'dossier_ref' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                              >
                                {copiedKey === 'dossier_ref' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Transaction ID:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{txDetail.transaction.id}</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(txDetail.transaction.id, 'dossier_txid')}
                                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedKey === 'dossier_txid' ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                              >
                                {copiedKey === 'dossier_txid' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FINANCIAL / JOURNAL */}
                  {txDossierTab === 'FINANCIAL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Double-Entry Journal Postings
                          </h4>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            Journal ID: {txDetail.financialMovement?.ledgerJournalId || 'N/A'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-danger)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 800 }}>DEBIT ACCOUNT</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                              {txDetail.financialMovement?.debitAccount || '1010-GATEWAY-SETTLEMENT'}
                            </p>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-sm)' }}>
                              GH₵ {((txDetail.financialMovement?.debitAmountPesewas || txDetail.transaction.amountPesewas) / 100).toFixed(2)}
                            </p>
                          </div>

                          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 800 }}>CREDIT ACCOUNT</span>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                              {txDetail.financialMovement?.creditAccount || '2010-USER-WALLET-LIABILITY'}
                            </p>
                            <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-data)', fontSize: 'var(--font-size-sm)' }}>
                              GH₵ {((txDetail.financialMovement?.creditAmountPesewas || txDetail.transaction.amountPesewas) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {txDetail.financialMovement?.balanceBeforePesewas !== undefined && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', fontSize: '11px' }}>
                            <span>Balance Before: <strong>GH₵ {((txDetail.financialMovement.balanceBeforePesewas || 0) / 100).toFixed(2)}</strong></span>
                            <span>Balance After: <strong>GH₵ {((txDetail.financialMovement.balanceAfterPesewas || 0) / 100).toFixed(2)}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Ledger Lines Table if present */}
                      {txDetail.financialMovement?.ledgerLines && txDetail.financialMovement.ledgerLines.length > 0 && (
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            General Ledger Line Entries ({txDetail.financialMovement.ledgerLines.length})
                          </h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                  <th style={{ padding: '0.4rem' }}>Type</th>
                                  <th style={{ padding: '0.4rem' }}>Account</th>
                                  <th style={{ padding: '0.4rem' }}>Amount</th>
                                  <th style={{ padding: '0.4rem' }}>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {txDetail.financialMovement.ledgerLines.map((line: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                    <td style={{ padding: '0.4rem' }}>
                                      <Badge variant={line.entryType === 'DEBIT' ? 'danger' : 'success'} size="xs">{line.entryType}</Badge>
                                    </td>
                                    <td style={{ padding: '0.4rem', fontFamily: 'var(--font-mono)' }}>{line.accountType || line.accountId}</td>
                                    <td style={{ padding: '0.4rem', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                                      GH₵ {((line.amountPesewas || 0) / 100).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '0.4rem', color: 'var(--color-text-muted)' }}>{line.description || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: GATEWAY TELEMETRY */}
                  {txDossierTab === 'GATEWAY' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          External Gateway Verification
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Gateway Provider</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                              {txDetail.externalPayment?.provider || 'Paystack'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider Ref</span>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {txDetail.externalPayment?.providerReference || txDetail.transaction.reference}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Verification State</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant={txDetail.externalPayment?.verificationStatus === 'VERIFIED' ? 'success' : 'warning'} size="xs">
                                {txDetail.externalPayment?.verificationStatus || 'VERIFIED'}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Webhook Delivery</span>
                            <p style={{ margin: '0.15rem 0 0 0' }}>
                              <Badge variant="success" size="xs">
                                {txDetail.externalPayment?.webhookStatus || 'DELIVERED'}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Raw Metadata Explorer */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Raw Gateway Payload & Headers
                        </h4>
                        <pre
                          style={{
                            margin: 0,
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-text-primary)',
                            overflowX: 'auto',
                            maxHeight: '260px',
                          }}
                        >
                          {JSON.stringify(txDetail.externalPayment?.rawMetadata || { reference: txDetail.transaction.reference, gateway: 'paystack', verified: true }, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ORDER & SECURITY AUDIT */}
                  {txDossierTab === 'ORDER_AUDIT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Related Commerce Order if exists */}
                      {txDetail.relatedOrder && (
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                            Related Commerce Order
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Order #</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-primary)' }}>
                                {txDetail.relatedOrder.publicId}
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Network & Phone</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px' }}>
                                {txDetail.relatedOrder.network} ({txDetail.relatedOrder.recipientPhone})
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Data Bundle</span>
                              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', fontWeight: 700 }}>
                                {txDetail.relatedOrder.productName || `${txDetail.relatedOrder.dataAmountMb} MB`}
                              </p>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Fulfillment Status</span>
                              <p style={{ margin: '0.15rem 0 0 0' }}>
                                <Badge variant={txDetail.relatedOrder.fulfillmentStatus === 'COMPLETED' ? 'success' : 'warning'} size="xs">
                                  {txDetail.relatedOrder.fulfillmentStatus || 'COMPLETED'}
                                </Badge>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Security Audit Trail */}
                      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          Immutable Security Audit Trail
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {txDetail.auditTrail && txDetail.auditTrail.length > 0 ? (
                            txDetail.auditTrail.map((ev: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '0.55rem 0.75rem',
                                  backgroundColor: 'var(--color-bg-surface)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--color-border-subtle)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '11px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <ShieldCheck size={13} color="var(--color-brand-primary)" />
                                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{ev.action}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                                    by {ev.actorType} ({ev.actorId?.slice(0, 8)})
                                  </span>
                                </div>
                                <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                                  {new Date(ev.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Settlement verified and posted automatically into general ledger.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE MODALS (Clean Accessible Modals replacing prompt/alert)   */}
      {/* ========================================================================= */}

      {/* A. REQUEST FLOAT ADJUSTMENT MODAL */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title="Request Float Adjustment (Dual Control)"
        subtitle="Two-person approval requirement for balance overrides"
        maxWidth="520px"
      >
        <form onSubmit={handleSubmitAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Target User UUID *
            </label>
            <SearchInput
              value={adjUserId}
              onChange={(e) => setAdjUserId(e.target.value)}
              placeholder="Paste customer or agent user UUID..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Adjustment Direction *
              </label>
              <select
                value={adjDirection}
                onChange={(e) => setAdjDirection(e.target.value as 'CREDIT' | 'DEBIT')}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="CREDIT">CREDIT (+ Increase Float)</option>
                <option value="DEBIT">DEBIT (- Decrease Float)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Amount in GH₵ *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.10"
                value={adjAmountGhs}
                onChange={(e) => setAdjAmountGhs(e.target.value)}
                placeholder="e.g. 50.00"
                required
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Audit Justification / Reason * (min 5 chars)
            </label>
            <textarea
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="Detailed reason for manual float adjustment..."
              rows={3}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsAdjModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={adjSubmitting} style={primaryButtonStyle}>
              {adjSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </Modal>

      {/* B. REVIEW FLOAT ADJUSTMENT MODAL (Replacing prompt) */}
      <Modal
        isOpen={!!reviewAdjTarget}
        onClose={() => setReviewAdjTarget(null)}
        title={`${reviewAdjTarget?.action === 'APPROVE' ? 'Approve' : 'Reject'} Float Adjustment`}
        subtitle="Super Admin dual-control decision"
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          {reviewAdjTarget && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Adjustment: <strong style={{ fontFamily: 'var(--font-mono)' }}>{reviewAdjTarget.adj.adjustmentNumber}</strong></span>
                <span>Amount: <strong style={{ fontFamily: 'var(--font-data)' }}>GH₵ {(reviewAdjTarget.adj.amountPesewas / 100).toFixed(2)} ({reviewAdjTarget.adj.direction})</strong></span>
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                Target User: {reviewAdjTarget.adj.userName} ({reviewAdjTarget.adj.userEmail})
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                Original Reason: <em>"{reviewAdjTarget.adj.reason}"</em>
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Super Admin Audit Reason * (min 4 characters)
            </label>
            <textarea
              rows={3}
              value={reviewAdjReason}
              onChange={(e) => setReviewAdjReason(e.target.value)}
              placeholder="Audit rationale for this decision..."
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                fontSize: '11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setReviewAdjTarget(null)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReviewAdjustment}
              disabled={reviewAdjSubmitting}
              style={reviewAdjTarget?.action === 'APPROVE' ? primaryButtonStyle : dangerButtonStyle}
            >
              {reviewAdjSubmitting ? 'Processing...' : `Confirm ${reviewAdjTarget?.action === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* C. ANOMALIES SCANNER MODAL */}
      <Modal
        isOpen={anomaliesModalOpen}
        onClose={() => setAnomaliesModalOpen(false)}
        title={`Ledger Invariant Scanner (${anomalies.length} detected)`}
        subtitle="Zero-sum continuous audit across all double-entry postings"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', padding: 'var(--space-1)' }}>
          {anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <CheckCircle size={44} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                General Ledger is 100% Balanced
              </h4>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                All double-entry journals strictly satisfy the fundamental accounting invariant: sum(debits) == sum(credits).
              </p>
            </div>
          ) : (
            anomalies.map((anom, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.85rem',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-primary)' }}>
                    Journal ID: {anom.transactionId}
                  </span>
                  <Badge variant="danger" size="xs">{anom.severity}</Badge>
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Debits: <strong>GH₵ {(anom.totalDebitsPesewas / 100).toFixed(2)}</strong> | Credits: <strong>GH₵ {(anom.totalCreditsPesewas / 100).toFixed(2)}</strong>
                </div>
                <div style={{ marginTop: '0.2rem', fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)' }}>
                  Discrepancy: GH₵ {(anom.discrepancyPesewas / 100).toFixed(2)}
                </div>
              </div>
            ))
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setAnomaliesModalOpen(false)} style={tactileButtonStyle}>
              Close Scanner
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminLedgerPage;
