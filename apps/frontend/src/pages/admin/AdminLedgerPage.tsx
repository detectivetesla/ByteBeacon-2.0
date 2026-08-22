import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { Select, SearchInput, Modal } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Database,
  RefreshCw,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  AlertTriangle,
  FileText,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Eye,
  PlusCircle,
  Download,
  Activity,
} from 'lucide-react';
import {
  adminApi,
  AdminFinanceStats,
  AdminTransactionListItem,
  AdminTransactionDetailDto,
  AdminLedgerAnomalyDto,
  FinancialAdjustmentDto,
} from '../../api/admin.api.js';

export const AdminLedgerPage: React.FC = () => {
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

  // --- Transaction Detail Modal ---
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<AdminTransactionDetailDto | null>(null);
  const [txDetailLoading, setTxDetailLoading] = useState(false);

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
        search: txSearch || undefined,
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
      alert('Failed to scan ledger anomalies.');
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

  // View Transaction Detail
  const handleOpenTxDetail = async (id: string) => {
    setSelectedTxId(id);
    setTxDetailLoading(true);
    try {
      const res = await adminApi.getFinanceTransactionDetail(id);
      setTxDetail(res);
    } catch {
      alert('Could not fetch transaction dossier.');
      setSelectedTxId(null);
    } finally {
      setTxDetailLoading(false);
    }
  };

  // Submit Float Adjustment Request
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjUserId || !adjAmountGhs || !adjReason) {
      alert('Please fill all required fields.');
      return;
    }
    setAdjSubmitting(true);
    try {
      const amountPesewas = Math.round(parseFloat(adjAmountGhs) * 100);
      await adminApi.requestFinancialAdjustment({
        userId: adjUserId,
        amountPesewas,
        direction: adjDirection,
        reason: adjReason,
      });
      alert('Adjustment request submitted successfully. Queued for Super Admin approval.');
      setIsAdjModalOpen(false);
      setAdjUserId('');
      setAdjAmountGhs('');
      setAdjReason('');
      fetchAdjustments();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to submit adjustment.');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Review Float Adjustment (Super Admin)
  const handleReviewAdjustment = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const reason = prompt(`Enter reason for ${action.toLowerCase()}ing this adjustment request:`);
    if (reason === null) return;
    try {
      await adminApi.reviewFinancialAdjustment(id, { action, reason: reason || 'Reviewed by Super Admin' });
      alert(`Adjustment ${action.toLowerCase()}d successfully.`);
      fetchAdjustments();
      fetchOverview();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Action failed.');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Database} color="security" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Core Financial Engine & Audit
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Finance, Transactions & Ledger
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Authoritative double-entry general ledger, transaction explorer, and float adjustment administration.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="secondary" size="sm" onClick={() => { fetchOverview(); if (activeTab === 'TRANSACTIONS') fetchTransactions(); else if (activeTab === 'LEDGER') fetchLedger(); else fetchAdjustments(); }}>
            <RefreshCw size={14} style={{ marginRight: '0.35rem' }} /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={scanAnomalies}>
            <ShieldCheck size={14} style={{ marginRight: '0.35rem' }} /> Scan Ledger
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsAdjModalOpen(true)}>
            <PlusCircle size={14} style={{ marginRight: '0.35rem' }} /> Request Float Adj.
          </Button>
        </div>
      </div>

      {/* 12 Core Authoritative Financial KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          label="Total Platform Float"
          value={`GHS ${(((stats?.totalPlatformBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Customer + Agent combined reserves"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          label="Customer Float"
          value={`GHS ${(((stats?.customerWalletBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="End-user active balances"
          accent="blue"
          icon={<TactileIcon icon={User} color="orders" size="sm" />}
        />
        <MetricCard
          label="Agent Float"
          value={`GHS ${(((stats?.agentWalletBalancePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Agent & SuperAgent balances"
          accent="orange"
          icon={<TactileIcon icon={Layers} color="speed" size="sm" />}
        />
        <MetricCard
          label="Lifetime Revenue"
          value={`GHS ${(((stats?.totalRevenuePesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Completed order gross value"
          accent="green"
          icon={<TactileIcon icon={CreditCard} color="security" size="sm" />}
        />
        <MetricCard
          label="Total Deposits"
          value={`GHS ${(((stats?.totalDepositsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Verified external gateway inflows"
          accent="blue"
          icon={<TactileIcon icon={ArrowDownLeft} color="api" size="sm" />}
        />
        <MetricCard
          label="Total Withdrawals"
          value={`GHS ${(((stats?.totalWithdrawalsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Settled agent store payouts"
          accent="purple"
          icon={<TactileIcon icon={ArrowUpRight} color="payments" size="sm" />}
        />
        <MetricCard
          label="Total Refunds"
          value={`GHS ${(((stats?.totalRefundsPesewas || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`}
          helperText="Processed order reversals"
          accent="amber"
          icon={<TactileIcon icon={AlertTriangle} color="amber" size="sm" />}
        />
        <MetricCard
          label="Ledger Invariant"
          value={stats?.ledgerBalanceStatus === 'BALANCED' ? 'BALANCED' : 'ANOMALY DETECTED'}
          helperText="Continuous zero-sum verification"
          accent={stats?.ledgerBalanceStatus === 'BALANCED' ? 'green' : 'red'}
          icon={<TactileIcon icon={ShieldCheck} color={stats?.ledgerBalanceStatus === 'BALANCED' ? 'security' : 'red'} size="sm" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '1.5rem', marginBottom: 'var(--space-2)' }}>
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'TRANSACTIONS' ? 700 : 500,
            color: activeTab === 'TRANSACTIONS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'TRANSACTIONS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CreditCard size={16} /> Unified Transactions Explorer
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'LEDGER' ? 700 : 500,
            color: activeTab === 'LEDGER' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'LEDGER' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Database size={16} /> General Ledger Journal Lines
        </button>
        <button
          onClick={() => setActiveTab('ADJUSTMENTS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            fontSize: 'var(--font-size-sm)',
            fontWeight: activeTab === 'ADJUSTMENTS' ? 700 : 500,
            color: activeTab === 'ADJUSTMENTS' ? 'var(--color-brand-bright)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'ADJUSTMENTS' ? '2px solid var(--color-brand-bright)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <PlusCircle size={16} /> Two-Person Float Adjustments ({adjustments.filter(a => a.status === 'PENDING').length})
        </button>
      </div>

      {/* --- TAB 1: TRANSACTIONS --- */}
      {activeTab === 'TRANSACTIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filters Bar */}
          <Card accentColor="blue">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Search Query</label>
                <SearchInput
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="ID, reference, order public ID, email, phone..."
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Transaction Status</label>
                <Select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'PAID', label: 'Completed / Paid' },
                    { value: 'PROCESSING', label: 'Processing' },
                    { value: 'FAILED', label: 'Failed' },
                    { value: 'REFUNDED', label: 'Refunded' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Transaction Type</label>
                <Select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Types' },
                    { value: 'DATA_PURCHASE', label: 'Data Plan Purchase' },
                    { value: 'DEPOSIT', label: 'Float Deposit' },
                    { value: 'ADJUSTMENT', label: 'Manual Adjustment' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Network Carrier</label>
                <Select
                  value={txNetworkFilter}
                  onChange={(e) => setTxNetworkFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Carriers' },
                    { value: 'MTN', label: 'MTN Ghana' },
                    { value: 'TELECEL', label: 'Telecel' },
                    { value: 'AIRTELTIGO', label: 'AT Ghana' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          <Card>
            <Table
              headers={['Reference / ID', 'Type', 'Customer / Agent', 'Amount (GHS)', 'Carrier', 'Status', 'Date', 'Action']}
              data={transactions.map((tx) => [
                <div key="ref" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                    {tx.reference}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>ID: {tx.id.slice(0, 13)}...</span>
                </div>,
                <Badge key="type" variant={tx.type === 'DATA_PURCHASE' ? 'primary' : tx.type === 'DEPOSIT' ? 'success' : 'neutral'}>
                  {tx.type}
                </Badge>,
                <div key="user" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{tx.userName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{tx.userEmail || tx.userPhone}</span>
                </div>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  GHS {(tx.amountPesewas / 100).toFixed(2)}
                </span>,
                <span key="net" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{tx.network || '—'}</span>,
                <Badge
                  key="st"
                  variant={tx.status === 'PAID' ? 'success' : tx.status === 'PROCESSING' ? 'warning' : 'danger'}
                >
                  {tx.status}
                </Badge>,
                <span key="dt" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(tx.createdAt).toLocaleString()}
                </span>,
                <Button key="act" variant="secondary" size="sm" onClick={() => handleOpenTxDetail(tx.id)}>
                  <Eye size={12} style={{ marginRight: '0.25rem' }} /> Audit
                </Button>,
              ])}
              loading={isLoading}
              emptyMessage="No financial transactions matching the selected criteria."
            />

            <Pagination
              currentPage={txPage}
              totalPages={txTotalPages}
              totalItems={txTotal}
              onPageChange={(p) => setTxPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 2: GENERAL LEDGER --- */}
      {activeTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Balance Invariant Notification Bar */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: ledgerBalanced ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${ledgerBalanced ? 'var(--color-success)' : 'var(--color-danger)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {ledgerBalanced ? (
                <CheckCircle size={20} color="var(--color-success)" />
              ) : (
                <AlertTriangle size={20} color="var(--color-danger)" />
              )}
              <div>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: ledgerBalanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {ledgerBalanced ? 'Double-Entry Invariant VALIDATED' : 'CRITICAL LEDGER IMBALANCE DETECTED'}
                </span>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Total Debits: GHS {(totalDebitsPesewas / 100).toFixed(2)} | Total Credits: GHS {(totalCreditsPesewas / 100).toFixed(2)} | Net Diff: GHS {Math.abs((totalDebitsPesewas - totalCreditsPesewas) / 100).toFixed(2)}
                </p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={scanAnomalies}>
              View Anomaly Details
            </Button>
          </div>

          {/* Ledger Filters */}
          <Card accentColor="green">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Entry Type</label>
                <Select
                  value={ledgerEntryType}
                  onChange={(e) => setLedgerEntryType(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Entries' },
                    { value: 'DEBIT', label: 'DEBIT (DR)' },
                    { value: 'CREDIT', label: 'CREDIT (CR)' },
                  ]}
                />
              </div>

              <div style={{ minWidth: '200px' }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Account Type</label>
                <Select
                  value={ledgerAccountType}
                  onChange={(e) => setLedgerAccountType(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Accounts' },
                    { value: 'CUSTOMER_WALLET', label: 'Customer Wallet' },
                    { value: 'AGENT_WALLET', label: 'Agent Wallet' },
                    { value: 'PLATFORM_ESCROW', label: 'Platform Escrow Reserve' },
                    { value: 'PROVIDER_PAYABLE', label: 'Provider Payable' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Ledger Table */}
          <Card>
            <Table
              headers={['Journal ID', 'Entry Type', 'Account', 'Account ID', 'Amount (GHS)', 'Ref Type / ID', 'Description', 'Timestamp']}
              data={ledgerLines.map((line) => [
                <span key="jid" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
                  {line.transactionId?.slice(0, 12)}...
                </span>,
                <Badge key="et" variant={line.entryType === 'DEBIT' ? 'danger' : 'success'}>
                  {line.entryType}
                </Badge>,
                <span key="ac" style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{line.accountType}</span>,
                <span key="acid" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {line.accountId?.slice(0, 10)}...
                </span>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: line.entryType === 'DEBIT' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {line.entryType === 'DEBIT' ? '-' : '+'} GHS {(line.amountPesewas / 100).toFixed(2)}
                </span>,
                <div key="ref" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '11px' }}>{line.referenceType}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{line.referenceId?.slice(0, 12)}</span>
                </div>,
                <span key="desc" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {line.description}
                </span>,
                <span key="ts" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(line.createdAt).toLocaleString()}
                </span>,
              ])}
              loading={isLoading}
              emptyMessage="No ledger journal entries found."
            />

            <Pagination
              currentPage={ledgerPage}
              totalPages={ledgerTotalPages}
              totalItems={ledgerTotal}
              onPageChange={(p) => setLedgerPage(p)}
            />
          </Card>
        </div>
      )}

      {/* --- TAB 3: TWO-PERSON FLOAT ADJUSTMENTS --- */}
      {activeTab === 'ADJUSTMENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card accentColor="purple">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Two-Person Dual Control Protocol</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Direct wallet overrides are blocked by system invariant. Adjustments must be requested by Admin and approved by Super Admin.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setIsAdjModalOpen(true)}>
                <PlusCircle size={14} style={{ marginRight: '0.35rem' }} /> Create Request
              </Button>
            </div>
          </Card>

          <Card>
            <Table
              headers={['Adjustment #', 'Target User', 'Amount', 'Direction', 'Requested By', 'Reason', 'Status', 'Super Admin Action']}
              data={adjustments.map((adj) => [
                <span key="num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  {adj.adjustmentNumber}
                </span>,
                <div key="user" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{adj.userName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{adj.userEmail} ({adj.userRole})</span>
                </div>,
                <span key="amt" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  GHS {(adj.amountPesewas / 100).toFixed(2)}
                </span>,
                <Badge key="dir" variant={adj.direction === 'CREDIT' ? 'success' : 'danger'}>
                  {adj.direction}
                </Badge>,
                <span key="req" style={{ fontSize: 'var(--font-size-xs)' }}>{adj.requestedByName}</span>,
                <span key="rsn" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '200px', display: 'block' }}>{adj.reason}</span>,
                <Badge key="st" variant={adj.status === 'APPROVED' ? 'success' : adj.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {adj.status}
                </Badge>,
                <div key="act" style={{ display: 'flex', gap: '0.35rem' }}>
                  {adj.status === 'PENDING' ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => handleReviewAdjustment(adj.id, 'APPROVE')}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleReviewAdjustment(adj.id, 'REJECT')}>
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                      {adj.status} by {adj.approvedByName || 'Super Admin'}
                    </span>
                  )}
                </div>,
              ])}
              emptyMessage="No float adjustment requests in queue."
            />
          </Card>
        </div>
      )}

      {/* --- TRANSACTION AUDIT DOSSIER MODAL --- */}
      {selectedTxId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTxId(null)}
          title={`Financial Transaction Dossier: ${txDetail?.transaction?.reference || selectedTxId}`}
        >
          {txDetailLoading || !txDetail ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading transaction audit trail...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Core Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', backgroundColor: 'var(--color-surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Amount</span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-mono)' }}>
                    GHS {(txDetail.transaction.amountPesewas / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status</span>
                  <p style={{ margin: 0 }}><Badge variant={txDetail.transaction.status === 'PAID' ? 'success' : 'warning'}>{txDetail.transaction.status}</Badge></p>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>User / Role</span>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{txDetail.transaction.userName} ({txDetail.transaction.userRole})</p>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Payment Gateway</span>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{txDetail.externalPayment?.provider || 'Paystack'}</p>
                </div>
              </div>

              {/* Financial Movement (Double-Entry Posting) */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Double-Entry Journal Postings</h4>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Journal ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{txDetail.financialMovement.ledgerJournalId || 'N/A'}</code>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-danger)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 700 }}>DEBIT ACCOUNT</span>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{txDetail.financialMovement.debitAccount}</p>
                      <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>GHS {(txDetail.financialMovement.debitAmountPesewas / 100).toFixed(2)}</p>
                    </div>
                    <div style={{ padding: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-success)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 700 }}>CREDIT ACCOUNT</span>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{txDetail.financialMovement.creditAccount}</p>
                      <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>GHS {(txDetail.financialMovement.creditAmountPesewas / 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* External Verification & Webhooks */}
              {txDetail.externalPayment && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>External Payment & Webhook Verification</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider Ref</span>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{txDetail.externalPayment.providerReference || '—'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Verification Status</span>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{txDetail.externalPayment.verificationStatus}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Webhook Delivery</span>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{txDetail.externalPayment.webhookStatus || 'DELIVERED'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Related Order */}
              {txDetail.relatedOrder && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Related Commerce Order</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', backgroundColor: 'var(--color-surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Order #</span>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{txDetail.relatedOrder.publicId}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Carrier / Phone</span>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>{txDetail.relatedOrder.network} ({txDetail.relatedOrder.recipientPhone})</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Fulfillment</span>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{txDetail.relatedOrder.fulfillmentStatus || 'COMPLETED'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Immutable Security Audit Trail */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Immutable Security Audit Trail</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {txDetail.auditTrail && txDetail.auditTrail.length > 0 ? (
                    txDetail.auditTrail.map((ev, idx) => (
                      <div key={idx} style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--color-brand-bright)' }}>{ev.action}</span>
                          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>by {ev.actorType} ({ev.actorId?.slice(0, 8)})</span>
                        </div>
                        <span style={{ color: 'var(--color-text-muted)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>No audit events logged for this resource.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* --- REQUEST FLOAT ADJUSTMENT MODAL --- */}
      {isAdjModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAdjModalOpen(false)}
          title="Request Float Adjustment (Dual Control)"
        >
          <form onSubmit={handleSubmitAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Target User UUID *</label>
              <SearchInput
                value={adjUserId}
                onChange={(e) => setAdjUserId(e.target.value)}
                placeholder="Enter customer or agent UUID..."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Adjustment Direction *</label>
                <Select
                  value={adjDirection}
                  onChange={(e) => setAdjDirection(e.target.value as 'CREDIT' | 'DEBIT')}
                  options={[
                    { value: 'CREDIT', label: 'CREDIT (Increase Float)' },
                    { value: 'DEBIT', label: 'DEBIT (Decrease Float)' },
                  ]}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Amount in GHS *</label>
                <SearchInput
                  type="number"
                  step="0.01"
                  min="0.10"
                  value={adjAmountGhs}
                  onChange={(e) => setAdjAmountGhs(e.target.value)}
                  placeholder="e.g. 50.00"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem' }}>Audit Justification / Reason (min 5 chars) *</label>
              <textarea
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Detailed reason for this manual adjustment..."
                rows={3}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsAdjModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={adjSubmitting}>
                {adjSubmitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- ANOMALIES SCANNER MODAL --- */}
      {anomaliesModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setAnomaliesModalOpen(false)}
          title={`Ledger Anomaly Scanner (${anomalies.length} detected)`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
            {anomalies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={40} color="var(--color-success)" style={{ margin: '0 auto 0.5rem' }} />
                <h4 style={{ margin: 0, fontWeight: 700 }}>General Ledger is 100% Balanced</h4>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  All double-entry journals strictly satisfy the sum(debits) == sum(credits) invariant.
                </p>
              </div>
            ) : (
              anomalies.map((anom, idx) => (
                <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>Journal ID: {anom.transactionId}</span>
                    <Badge variant="danger">{anom.severity}</Badge>
                  </div>
                  <p style={{ margin: '0.25rem 0', fontSize: 'var(--font-size-xs)' }}>
                    Debits: GHS {(anom.totalDebitsPesewas / 100).toFixed(2)} | Credits: GHS {(anom.totalCreditsPesewas / 100).toFixed(2)} | Discrepancy: GHS {(anom.discrepancyPesewas / 100).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminLedgerPage;
