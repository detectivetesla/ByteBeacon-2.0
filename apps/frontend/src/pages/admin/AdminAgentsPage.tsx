import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { SearchInput, Avatar } from '../../components/ui/index.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  adminApi,
  AdminAgentStats,
  AdminAgentListItem,
  AdminAgentDetail,
  CreateAgentAdminRequest,
  AgentCustomPricingItemDto,
  AgentAccountStatus,
} from '../../api/admin.api.js';
import {
  Users,
  Store,
  DollarSign,
  TrendingUp,
  Search,
  RefreshCw,
  Eye,
  Plus,
  Download,
  Shield,
  Key,
  Clock,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Sliders,
  ExternalLink,
  X,
  ChevronRight,
  Check,
  Filter,
  Layers,
  FileText,
  AlertCircle,
  Building,
} from 'lucide-react';

export const AdminAgentsPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();

  // Primary State
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPLICATIONS' | 'PENDING' | 'SUSPENDED' | 'API' | 'PRICING'>('ALL');
  const [stats, setStats] = useState<AdminAgentStats | null>(null);
  const [agents, setAgents] = useState<AdminAgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalAgents, setTotalAgents] = useState<number>(0);

  // Agent Applications State
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState<boolean>(false);
  const [applicationsPage, setApplicationsPage] = useState<number>(1);
  const [applicationsTotalPages, setApplicationsTotalPages] = useState<number>(1);
  const [totalApplications, setTotalApplications] = useState<number>(0);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number>(0);
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<string>('ALL');

  // Application Review Modal State
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isApprovingApp, setIsApprovingApp] = useState<boolean>(false);
  const [isRejectingApp, setIsRejectingApp] = useState<boolean>(false);

  // Application Fee Management State
  const [isFeeModalOpen, setIsFeeModalOpen] = useState<boolean>(false);
  const [currentAppFeeGhs, setCurrentAppFeeGhs] = useState<number>(100);
  const [newAppFeeInput, setNewAppFeeInput] = useState<string>('100');
  const [feeChangeReason, setFeeChangeReason] = useState<string>('');
  const [isUpdatingFee, setIsUpdatingFee] = useState<boolean>(false);

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [apiFilter, setApiFilter] = useState<string>('ALL');
  const [financialFilter, setFinancialFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<string>('ALL');

  // Drawer / Modals State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<AdminAgentDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [dossierTab, setDossierTab] = useState<
    'OVERVIEW' | 'WALLET' | 'ORDERS' | 'PRICING' | 'STORE' | 'API' | 'SUBAGENTS' | 'CUSTOMERS' | 'AUDIT'
  >('OVERVIEW');

  // Create Agent Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreateAgentAdminRequest>({
    fullName: '',
    email: '',
    phone: '',
    businessName: '',
    slug: '',
    agentTier: 'STANDARD',
    initialPassword: 'TempPassword123!',
    enableApiAccess: false,
  });
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetAgent, setStatusTargetAgent] = useState<AdminAgentListItem | null>(null);
  const [newStatus, setNewStatus] = useState<AgentAccountStatus>(AgentAccountStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Wallet Adjustment Modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [walletTargetAgent, setWalletTargetAgent] = useState<AdminAgentListItem | null>(null);
  const [adjAmountGhs, setAdjAmountGhs] = useState<string>('');
  const [adjDirection, setAdjDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjReason, setAdjReason] = useState<string>('');
  const [isAdjustingWallet, setIsAdjustingWallet] = useState<boolean>(false);

  // Custom Pricing Modal
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
  const [pricingTargetAgent, setPricingTargetAgent] = useState<AdminAgentListItem | null>(null);
  const [customPricingList, setCustomPricingList] = useState<AgentCustomPricingItemDto[]>([]);
  const [customPriceEdits, setCustomPriceEdits] = useState<Record<string, string>>({});
  const [isSavingPricing, setIsSavingPricing] = useState<boolean>(false);

  // Common Button Styles
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
    minWidth: '125px',
    boxShadow: 'var(--shadow-tactile-sm)',
  };

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await adminApi.getAgentStats();
      if (data) {
        setStats(data);
      }
    } catch (err: any) {
      console.error('[ADMIN_AGENTS_PAGE] Failed to fetch agent stats:', err);
    }
  }, []);

  // Fetch Agents List
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      let resolvedStatus = statusFilter;
      if (activeTab === 'PENDING') resolvedStatus = 'PENDING';
      if (activeTab === 'SUSPENDED') resolvedStatus = 'SUSPENDED';

      let resolvedApi = apiFilter;
      if (activeTab === 'API') resolvedApi = 'ENABLED';

      const res = await adminApi.getAgentsList({
        search: search.trim() || undefined,
        status: resolvedStatus !== 'ALL' ? resolvedStatus : undefined,
        store: storeFilter !== 'ALL' ? storeFilter : undefined,
        api: resolvedApi !== 'ALL' ? resolvedApi : undefined,
        financial: financialFilter !== 'ALL' ? financialFilter : undefined,
        dateRange: dateRange !== 'ALL' ? dateRange : undefined,
        page,
        limit: 20,
      });

      const items = (res as any)?.items || (res as any)?.data?.items || (Array.isArray(res) ? res : []);
      const pagination = (res as any)?.pagination || (res as any)?.data?.pagination;

      setAgents(items);
      setTotalPages(pagination?.totalPages || 1);
      setTotalAgents(pagination?.total !== undefined ? pagination.total : items.length);
    } catch (err: any) {
      toastError('Failed to Load Agents', err.message || 'Error communicating with backend');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, storeFilter, apiFilter, financialFilter, dateRange, page, search, toastError]);

  // Fetch Agent Applications
  const fetchApplications = useCallback(async () => {
    setIsLoadingApplications(true);
    try {
      const res = await adminApi.getAgentApplications({
        status: applicationStatusFilter !== 'ALL' ? applicationStatusFilter : undefined,
        search: search.trim() || undefined,
        page: applicationsPage,
        limit: 15,
      });

      const items = (res as any)?.items || (res as any)?.data?.items || [];
      const pagination = (res as any)?.pagination || (res as any)?.data?.pagination;
      const pendingCount = (res as any)?.pendingCount ?? (res as any)?.data?.pendingCount ?? 0;

      setApplications(items);
      setApplicationsTotalPages(pagination?.totalPages || 1);
      setTotalApplications(pagination?.total !== undefined ? pagination.total : items.length);
      setPendingApplicationsCount(pendingCount);
    } catch (err: any) {
      console.error('[ADMIN_AGENTS_PAGE] Failed to load agent applications:', err);
    } finally {
      setIsLoadingApplications(false);
    }
  }, [applicationStatusFilter, search, applicationsPage]);

  // Fetch Current Application Fee
  const fetchApplicationFee = useCallback(async () => {
    try {
      const res = await adminApi.getAgentApplicationFee();
      const feeGhs = (res as any)?.applicationFeeGhs ?? ((res as any)?.applicationFeePesewas ? (res as any).applicationFeePesewas / 100 : 100);
      setCurrentAppFeeGhs(feeGhs);
      setNewAppFeeInput(feeGhs.toString());
    } catch (err: any) {
      console.error('[ADMIN_AGENTS_PAGE] Failed to load agent application fee:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAgents();
    fetchApplicationFee();
  }, [fetchStats, fetchAgents, fetchApplicationFee]);

  useEffect(() => {
    if (activeTab === 'APPLICATIONS') {
      fetchApplications();
    }
  }, [activeTab, fetchApplications]);

  // Watch URL params for tab=APPLICATIONS (e.g. from admin notification bell click)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'APPLICATIONS') {
      setActiveTab('APPLICATIONS');
    }
  }, [searchParams]);

  // Approve Application Handler
  const handleApproveApplication = async (appId: string) => {
    setIsApprovingApp(true);
    try {
      await adminApi.approveAgentApplication(appId);
      toastSuccess('Application Approved', 'Agent account created & activated. Applicant has been notified.');
      setIsReviewModalOpen(false);
      setSelectedApplication(null);
      fetchApplications();
      fetchStats();
      fetchAgents();
    } catch (err: any) {
      toastError('Approval Failed', err.message || 'Could not approve agent application.');
    } finally {
      setIsApprovingApp(false);
    }
  };

  // Reject Application Handler
  const handleRejectApplication = async (appId: string) => {
    if (!rejectionReason.trim()) {
      toastError('Feedback Required', 'Please provide a brief reason or feedback for the applicant.');
      return;
    }
    setIsRejectingApp(true);
    try {
      await adminApi.rejectAgentApplication(appId, {
        reason: rejectionReason.trim(),
        adminNotes: rejectionReason.trim(),
      });
      toastSuccess('Application Rejected', 'Applicant notified with the rejection notes.');
      setIsReviewModalOpen(false);
      setSelectedApplication(null);
      setRejectionReason('');
      fetchApplications();
    } catch (err: any) {
      toastError('Rejection Failed', err.message || 'Could not reject application.');
    } finally {
      setIsRejectingApp(false);
    }
  };

  // Update Application Fee Handler
  const handleUpdateApplicationFee = async () => {
    const feeNumber = parseFloat(newAppFeeInput);
    if (isNaN(feeNumber) || feeNumber < 0) {
      toastError('Invalid Fee', 'Please enter a valid non-negative fee in Ghana Cedis (GH₵).');
      return;
    }
    setIsUpdatingFee(true);
    try {
      const res = await adminApi.updateAgentApplicationFee({
        applicationFeeGhs: feeNumber,
        reason: feeChangeReason.trim() || 'Updated agent application fee via admin console',
      });
      const updatedGhs = (res as any)?.applicationFeeGhs ?? feeNumber;
      setCurrentAppFeeGhs(updatedGhs);
      toastSuccess('Fee Updated', `Agent application fee set to GH₵ ${updatedGhs.toFixed(2)}.`);
      setIsFeeModalOpen(false);
      setFeeChangeReason('');
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not update agent application fee.');
    } finally {
      setIsUpdatingFee(false);
    }
  };

  // Fetch Individual Agent Dossier
  const openAgentDossier = async (agentId: string) => {
    setSelectedAgentId(agentId);
    setDossierTab('OVERVIEW');
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getAgentDetail(agentId);
      const detail = (res as any)?.data || res;
      setAgentDetail(detail);
    } catch (err: any) {
      toastError('Failed to load agent dossier', err.message || 'Could not fetch details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle Create Agent
  const handleCreateAgent = async () => {
    if (!createForm.fullName || !createForm.email || !createForm.phone || !createForm.businessName || !createForm.slug) {
      toastError('Missing Fields', 'Please fill in all required agent details.');
      return;
    }

    setIsCreating(true);
    try {
      await adminApi.createAgent(createForm);
      toastSuccess('Agent Created', `Agent '${createForm.fullName}' registered successfully.`);
      setIsCreateModalOpen(false);
      setCreateForm({
        fullName: '',
        email: '',
        phone: '',
        businessName: '',
        slug: '',
        agentTier: 'STANDARD',
        initialPassword: 'TempPassword123!',
        enableApiAccess: false,
      });
      fetchStats();
      fetchAgents();
    } catch (err: any) {
      toastError('Registration Failed', err.message || 'Could not create agent account');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!statusTargetAgent || !statusReason || statusReason.trim().length < 4) {
      toastError('Reason Required', 'Please provide a clear reason for the status change (min 4 characters).');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await adminApi.updateAgentStatus(statusTargetAgent.id, {
        status: newStatus,
        reason: statusReason.trim(),
      });
      toastSuccess('Status Updated', `Agent '${statusTargetAgent.fullName}' status changed to ${newStatus}.`);
      setIsStatusModalOpen(false);
      setStatusReason('');
      fetchStats();
      fetchAgents();
      if (selectedAgentId === statusTargetAgent.id) {
        openAgentDossier(statusTargetAgent.id);
      }
    } catch (err: any) {
      toastError('Status Update Failed', err.message || 'Could not update agent status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Wallet Adjustment
  const handleAdjustWallet = async () => {
    const amount = parseFloat(adjAmountGhs);
    if (isNaN(amount) || amount <= 0) {
      toastError('Invalid Amount', 'Please enter a valid positive amount in GHS.');
      return;
    }
    if (!adjReason || adjReason.trim().length < 5) {
      toastError('Reason Required', 'Please provide a mandatory audit reason (min 5 characters).');
      return;
    }

    const amountPesewas = Math.round(amount * 100);

    setIsAdjustingWallet(true);
    try {
      await adminApi.adjustAgentWallet(walletTargetAgent!.id, {
        amountPesewas,
        direction: adjDirection,
        reason: adjReason.trim(),
      });
      toastSuccess('Wallet Adjusted', `Agent wallet successfully ${adjDirection.toLowerCase()}ed by GH₵ ${amount.toFixed(2)}.`);
      setIsWalletModalOpen(false);
      setAdjAmountGhs('');
      setAdjReason('');
      fetchStats();
      fetchAgents();
      if (selectedAgentId === walletTargetAgent!.id) {
        openAgentDossier(walletTargetAgent!.id);
      }
    } catch (err: any) {
      toastError('Adjustment Failed', err.message || 'Could not post double-entry voucher');
    } finally {
      setIsAdjustingWallet(false);
    }
  };

  // Open Custom Pricing Modal
  const openCustomPricingModal = async (agent: AdminAgentListItem) => {
    setPricingTargetAgent(agent);
    setIsPricingModalOpen(true);
    try {
      const pricing = await adminApi.getAgentCustomPricing(agent.id);
      setCustomPricingList(pricing);
      const edits: Record<string, string> = {};
      pricing.forEach((p) => {
        if (p.customPricePesewas !== null) {
          edits[p.productId] = (p.customPricePesewas / 100).toFixed(2);
        }
      });
      setCustomPriceEdits(edits);
    } catch (err: any) {
      toastError('Failed to load pricing', err.message || 'Error fetching custom pricing');
    }
  };

  // Save Custom Pricing
  const handleSaveCustomPricing = async () => {
    if (!pricingTargetAgent) return;
    setIsSavingPricing(true);
    try {
      const pricingPayload = customPricingList.map((p) => {
        const val = customPriceEdits[p.productId];
        if (val !== undefined && val.trim() !== '') {
          const num = parseFloat(val);
          return {
            productId: p.productId,
            customPricePesewas: isNaN(num) || num <= 0 ? null : Math.round(num * 100),
          };
        }
        return {
          productId: p.productId,
          customPricePesewas: null,
        };
      });

      await adminApi.updateAgentCustomPricing(pricingTargetAgent.id, { pricing: pricingPayload });
      toastSuccess('Pricing Saved', `Custom wholesale pricing updated for '${pricingTargetAgent.fullName}'.`);
      setIsPricingModalOpen(false);
      if (selectedAgentId === pricingTargetAgent.id) {
        openAgentDossier(pricingTargetAgent.id);
      }
    } catch (err: any) {
      toastError('Failed to save pricing', err.message || 'Could not update pricing');
    } finally {
      setIsSavingPricing(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      toastSuccess('Exporting Agents', 'Downloading agent records CSV...');
      await adminApi.exportAgents({ format: 'csv', status: statusFilter });
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export agents data');
    }
  };

  // Active Filter Pills
  const activeFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (search.trim()) {
      filters.push({
        id: 'search',
        label: `Search: "${search.trim()}"`,
        onRemove: () => setSearch(''),
      });
    }

    if (activeTab === 'APPLICATIONS') {
      if (applicationStatusFilter !== 'ALL') {
        const appStatusLabels: Record<string, string> = {
          PENDING_APPROVAL: 'Pending Approval',
          APPROVED: 'Approved',
          REJECTED: 'Rejected',
          PAYMENT_PENDING: 'Payment Pending',
        };
        filters.push({
          id: 'appStatus',
          label: `App Status: ${appStatusLabels[applicationStatusFilter] || applicationStatusFilter}`,
          onRemove: () => setApplicationStatusFilter('ALL'),
        });
      }
      return filters;
    }

    if (statusFilter !== 'ALL') {
      filters.push({
        id: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => setStatusFilter('ALL'),
      });
    }

    if (storeFilter !== 'ALL') {
      const labels: Record<string, string> = {
        HAS_STORE: 'Has Storefront',
        NO_STORE: 'No Storefront',
        ACTIVE_STORE: 'Active Store',
        PENDING_STORE: 'Pending Store',
        SUSPENDED_STORE: 'Suspended Store',
      };
      filters.push({
        id: 'store',
        label: `Store: ${labels[storeFilter] || storeFilter}`,
        onRemove: () => setStoreFilter('ALL'),
      });
    }

    if (apiFilter !== 'ALL') {
      filters.push({
        id: 'api',
        label: `API: ${apiFilter === 'ENABLED' ? 'Enabled' : 'Disabled'}`,
        onRemove: () => setApiFilter('ALL'),
      });
    }

    if (financialFilter !== 'ALL') {
      const labels: Record<string, string> = {
        POSITIVE: 'Positive Float',
        ZERO: 'Zero Float',
        NEGATIVE: 'Negative / Anomaly',
      };
      filters.push({
        id: 'financial',
        label: `Balance: ${labels[financialFilter] || financialFilter}`,
        onRemove: () => setFinancialFilter('ALL'),
      });
    }

    if (dateRange !== 'ALL') {
      const labels: Record<string, string> = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
      };
      filters.push({
        id: 'dateRange',
        label: `Period: ${labels[dateRange] || dateRange}`,
        onRemove: () => setDateRange('ALL'),
      });
    }

    return filters;
  }, [search, activeTab, applicationStatusFilter, statusFilter, storeFilter, apiFilter, financialFilter, dateRange]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setStoreFilter('ALL');
    setApiFilter('ALL');
    setFinancialFilter('ALL');
    setDateRange('ALL');
    setApplicationStatusFilter('ALL');
    setPage(1);
    setApplicationsPage(1);
  };

  const getTierBadgeVariant = (tier?: string): 'neutral' | 'info' | 'warning' | 'purple' => {
    switch ((tier || '').toUpperCase()) {
      case 'ENTERPRISE':
        return 'purple';
      case 'GOLD':
        return 'warning';
      case 'SILVER':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Store} color="speed" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-agent-bright)' }}>
              Commercial Network & Resellers
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Agent & Reseller Administration
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative management of agent accounts, float liabilities, storefronts, API keys, custom wholesale pricing, and sub-agents.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setNewAppFeeInput(currentAppFeeGhs.toString());
              setIsFeeModalOpen(true);
            }}
            style={tactileButtonStyle}
            title="Configure Agent Onboarding Application Fee"
          >
            <DollarSign size={14} color="var(--color-brand-primary)" />
            <span>App Fee: GH₵ {currentAppFeeGhs.toFixed(2)}</span>
          </button>
          <button type="button" onClick={handleExport} style={tactileButtonStyle}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={primaryButtonStyle}
            title="Register New Agent Reseller"
          >
            <Plus size={14} />
            <span>Register Agent</span>
          </button>
          <button
            type="button"
            onClick={() => { fetchStats(); fetchAgents(); if (activeTab === 'APPLICATIONS') fetchApplications(); }}
            disabled={isLoading || isLoadingApplications}
            style={{
              ...tactileButtonStyle,
              padding: '0.45rem 0.6rem',
              color: 'var(--color-text-muted)',
            }}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={(isLoading || isLoadingApplications) ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 8 KPI Summary Cards (Standard Auto-fit Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Agents"
          value={stats ? stats.totalAgents.toLocaleString() : '—'}
          subvalue="Authorized Resellers"
          accent="blue"
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
        />
        <MetricCard
          title="Active Agents"
          value={stats ? stats.activeAgents.toLocaleString() : '—'}
          subvalue="Fully Operational"
          accent="green"
          icon={<TactileIcon icon={UserCheck} color="security" size="sm" />}
        />
        <MetricCard
          title="Suspended / Restricted"
          value={stats ? stats.suspendedAgents.toLocaleString() : '—'}
          subvalue="Blocked from Commerce"
          accent="red"
          icon={<TactileIcon icon={UserX} color="red" size="sm" />}
        />
        <MetricCard
          title="Pending Applications"
          value={pendingApplicationsCount > 0 ? pendingApplicationsCount.toLocaleString() : (stats ? stats.pendingAgents.toLocaleString() : '0')}
          subvalue="Awaiting Verification"
          accent="amber"
          icon={<TactileIcon icon={Clock} color="amber" size="sm" />}
        />
        <MetricCard
          title="Agents with Stores"
          value={stats ? stats.agentsWithStores.toLocaleString() : '—'}
          subvalue="Active Storefronts"
          accent="orange"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
        />
        <MetricCard
          title="API Integration"
          value={stats ? stats.agentsWithApi.toLocaleString() : '—'}
          subvalue="Active Key Owners"
          accent="cyan"
          icon={<TactileIcon icon={Key} color="api" size="sm" />}
        />
        <MetricCard
          title="Total Float Liabilities"
          value={stats ? `GH₵ ${(stats.totalWalletFloatPesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          subvalue="Authoritative Balances"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          title="Total Reseller Volume"
          value={stats ? `GH₵ ${(stats.totalRevenuePesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          subvalue="Gross Processed Sales"
          accent="purple"
          icon={<TactileIcon icon={TrendingUp} color="analytics" size="sm" />}
        />
      </div>

      {/* Internal Navigation Tabs (Standard Tactile Segmented Bar) */}
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
          { id: 'ALL', label: 'All Registered Agents', count: stats?.totalAgents ?? totalAgents, icon: <Users size={13} /> },
          { id: 'APPLICATIONS', label: 'Agent Applications', count: pendingApplicationsCount, icon: <FileText size={13} /> },
          { id: 'PENDING', label: 'Pending Accounts', count: stats?.pendingAgents ?? 0, icon: <Clock size={13} /> },
          { id: 'SUSPENDED', label: 'Suspended / Restricted', count: stats?.suspendedAgents ?? 0, icon: <UserX size={13} /> },
          { id: 'API', label: 'API Developer Access', count: stats?.agentsWithApi ?? 0, icon: <Key size={13} /> },
          { id: 'PRICING', label: 'Custom Wholesale Pricing', count: undefined, icon: <Sliders size={13} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
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

      {/* Standardized Filter Card (Compact, Non-overlapping, Clean Inline Row) */}
      <Card
        elevated
        style={{
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
            <SearchInput
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearch(e.target.value);
                setPage(1);
                setApplicationsPage(1);
              }}
              placeholder={
                activeTab === 'APPLICATIONS'
                  ? 'Search applications by applicant, email, business, or slug...'
                  : 'Search by agent name, email, phone, business, slug, or ID...'
              }
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab === 'APPLICATIONS' ? (
              /* Applications Status Filter */
              <select
                value={applicationStatusFilter}
                onChange={(e) => { setApplicationStatusFilter(e.target.value); setApplicationsPage(1); }}
                style={selectStyle}
                aria-label="Filter Applications by Status"
              >
                <option value="ALL">All Application Statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAYMENT_PENDING">Payment Pending</option>
              </select>
            ) : (
              <>
                {/* Status Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="RESTRICTED">Restricted</option>
                  <option value="DISABLED">Disabled</option>
                </select>

                {/* Storefront Dropdown */}
                <select
                  value={storeFilter}
                  onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Storefront"
                >
                  <option value="ALL">All Storefronts</option>
                  <option value="HAS_STORE">Has Storefront</option>
                  <option value="NO_STORE">No Storefront</option>
                  <option value="ACTIVE_STORE">Active Store</option>
                  <option value="PENDING_STORE">Pending Store</option>
                  <option value="SUSPENDED_STORE">Suspended Store</option>
                </select>

                {/* API Access Dropdown */}
                <select
                  value={apiFilter}
                  onChange={(e) => { setApiFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by API Access"
                >
                  <option value="ALL">All API Access</option>
                  <option value="ENABLED">API Enabled</option>
                  <option value="DISABLED">API Disabled</option>
                </select>

                {/* Balances Dropdown */}
                <select
                  value={financialFilter}
                  onChange={(e) => { setFinancialFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Wallet Float"
                >
                  <option value="ALL">All Balances</option>
                  <option value="POSITIVE">Positive Float</option>
                  <option value="ZERO">Zero Float</option>
                  <option value="NEGATIVE">Negative / Anomaly</option>
                </select>

                {/* Date Range Dropdown */}
                <select
                  value={dateRange}
                  onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Registration Date"
                >
                  <option value="ALL">All Registration Dates</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
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
            {activeFilters.map((af) => (
              <span
                key={af.id}
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
                {af.label}
                <button
                  type="button"
                  onClick={af.onRemove}
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
                  title="Remove filter"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={handleResetFilters}
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

      {/* Agent Applications Table Card OR Main Agent Table Card */}
      {activeTab === 'APPLICATIONS' ? (
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
                Prospective Agent Applications & Verifications
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                Review onboarding requests, verify application fees, and approve users as authorized ByteBeacon agents.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {applications.length} of {totalApplications} applications ({pendingApplicationsCount} pending review)
              </span>
            </div>
          </div>

          <Table
            minWidth="1050px"
            headers={[
              'Applicant',
              'Business & Store Slug',
              'Phone & Region',
              'Application Fee',
              'Status',
              'Submitted',
              'Actions',
            ]}
          >
            {isLoadingApplications ? (
              <tr>
                <td colSpan={7} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading agent applications...</p>
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <FileText size={24} />
                    </div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      No Applications Found
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', maxWidth: '420px' }}>
                      No agent applications match your filter or search criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              applications.map((app) => {
                const feeGhs = ((app.feePesewas || 10000) / 100).toFixed(2);
                let statusVariant: 'success' | 'danger' | 'warning' | 'neutral' = 'neutral';
                if (app.status === 'APPROVED') statusVariant = 'success';
                else if (app.status === 'REJECTED') statusVariant = 'danger';
                else if (app.status === 'PENDING_APPROVAL') statusVariant = 'warning';

                return (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color var(--transition-fast)' }}>
                    {/* Applicant */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={app.fullName} size="sm" />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {app.fullName}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '0.1rem' }}>
                            {app.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Business & Slug */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          {app.businessName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-brand-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                          /{app.slug}
                        </span>
                      </div>
                    </td>

                    {/* Phone & Region */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {app.phone}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                          {app.locationRegion || 'Unspecified'}
                        </span>
                      </div>
                    </td>

                    {/* Application Fee */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                          GH₵ {feeGhs}
                        </span>
                        <Badge variant={app.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                          {app.paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT PENDING'}
                        </Badge>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={statusVariant} size="sm">
                        {app.status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : app.status}
                      </Badge>
                    </td>

                    {/* Submitted */}
                    <td style={{ padding: '0.85rem 1rem', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApplication(app);
                          setRejectionReason(app.adminNotes || '');
                          setIsReviewModalOpen(true);
                        }}
                        style={{
                          ...tactileButtonStyle,
                          padding: '0.35rem 0.65rem',
                          fontSize: '11px',
                          color: app.status === 'PENDING_APPROVAL' ? '#FFFFFF' : 'var(--color-text-primary)',
                          backgroundColor: app.status === 'PENDING_APPROVAL' ? 'var(--color-brand, #16A34A)' : 'var(--color-bg-surface)',
                          borderColor: app.status === 'PENDING_APPROVAL' ? 'transparent' : 'var(--color-border-subtle)',
                        }}
                      >
                        <Eye size={12} />
                        <span>{app.status === 'PENDING_APPROVAL' ? 'Review & Verify' : 'View Application'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </Table>

          {/* Applications Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              Showing {applications.length} of {totalApplications} applications
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                disabled={applicationsPage <= 1}
                onClick={() => setApplicationsPage((p) => Math.max(1, p - 1))}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                  opacity: applicationsPage <= 1 ? 0.5 : 1,
                  cursor: applicationsPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', padding: '0 0.5rem' }}>
                Page {applicationsPage} of {applicationsTotalPages}
              </span>
              <button
                type="button"
                disabled={applicationsPage >= applicationsTotalPages}
                onClick={() => setApplicationsPage((p) => Math.min(applicationsTotalPages, p + 1))}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                  opacity: applicationsPage >= applicationsTotalPages ? 0.5 : 1,
                  cursor: applicationsPage >= applicationsTotalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      ) : (
        /* Main Agent Table Card */
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
              Authorized Reseller & Agent Directory
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Authoritative float balances, merchant storefronts, developer API credentials, and hierarchical sub-agents.
            </p>
          </div>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {agents.length} of {totalAgents} records
          </span>
        </div>

        <Table
          minWidth="1180px"
          headers={[
            'Agent & Business',
            'Contact Info',
            'Status',
            'Storefront',
            'Wallet Float',
            'Sales & Orders',
            'API Access',
            'Joined Date',
            'Actions',
          ]}
        >
          {isLoading ? (
            <tr>
              <td colSpan={9} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading agents from database...</p>
              </td>
            </tr>
          ) : agents.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 'var(--space-10) var(--space-4)', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <UserX size={24} />
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    No Agents Found
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', maxWidth: '420px' }}>
                    No agent records match the current filter criteria or search query.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            agents.map((row) => {
              const floatGhs = (row.walletBalancePesewas / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const revenueGhs = (row.revenuePesewas / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

              let statusVariant: 'success' | 'danger' | 'warning' | 'info' | 'default' = 'default';
              if (row.status === 'ACTIVE') statusVariant = 'success';
              else if (row.status === 'SUSPENDED' || row.status === 'DISABLED') statusVariant = 'danger';
              else if (row.status === 'PENDING') statusVariant = 'warning';
              else if (row.status === 'RESTRICTED') statusVariant = 'info';

              return (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color var(--transition-fast)' }}>
                  {/* Agent & Business */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar name={row.fullName} size="sm" status={row.status === 'ACTIVE' ? 'online' : 'offline'} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {row.fullName}
                          </span>
                          {row.agentTier && row.agentTier !== 'STANDARD' && (
                            <Badge variant={getTierBadgeVariant(row.agentTier)} size="sm">
                              {row.agentTier}
                            </Badge>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '0.1rem' }}>
                          {row.businessName} {row.slug && <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>• /{row.slug}</span>}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Contact Info */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-primary)' }}>
                        <Mail size={11} color="var(--color-text-muted)" /> {row.email}
                      </span>
                      {row.phone && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          <Phone size={10} style={{ display: 'inline', marginRight: '3px' }} />{row.phone}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge variant={statusVariant} size="sm" dot>
                      {row.status}
                    </Badge>
                  </td>

                  {/* Storefront */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {row.hasStore ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Badge variant={row.storeStatus === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                          <Store size={10} style={{ marginRight: '3px' }} />
                          {row.storeName || row.storeStatus}
                        </Badge>
                        {row.storeSlug && (
                          <a
                            href={`/store/${row.storeSlug}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center' }}
                            title="Open storefront in new tab"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>None</span>
                    )}
                  </td>

                  {/* Wallet Float */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: row.walletBalancePesewas >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      GH₵ {floatGhs}
                    </span>
                  </td>

                  {/* Sales & Orders */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                        {row.ordersCount.toLocaleString()} orders
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        GH₵ {revenueGhs}
                      </span>
                    </div>
                  </td>

                  {/* API Access */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge variant={row.apiEnabled ? 'info' : 'neutral'} size="sm">
                      {row.apiEnabled ? `${row.activeKeysCount} Active Key(s)` : 'Disabled'}
                    </Badge>
                  </td>

                  {/* Joined Date */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => openAgentDossier(row.id)}
                        style={{
                          ...tactileButtonStyle,
                          padding: '0.35rem 0.65rem',
                          fontSize: '11px',
                        }}
                      >
                        <Eye size={12} />
                        <span>Dossier</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWalletTargetAgent(row);
                          setIsWalletModalOpen(true);
                        }}
                        style={{
                          ...tactileButtonStyle,
                          padding: '0.35rem 0.5rem',
                          color: 'var(--color-brand-primary)',
                        }}
                        title="Adjust Float Balance"
                      >
                        <DollarSign size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openCustomPricingModal(row)}
                        style={{
                          ...tactileButtonStyle,
                          padding: '0.35rem 0.5rem',
                          color: 'var(--color-speed-bright)',
                        }}
                        title="Custom Wholesale Pricing"
                      >
                        <Sliders size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStatusTargetAgent(row);
                          setNewStatus(row.status as any);
                          setIsStatusModalOpen(true);
                        }}
                        style={{
                          ...tactileButtonStyle,
                          padding: '0.35rem 0.5rem',
                          color: 'var(--color-text-muted)',
                        }}
                        title="Change Account Status"
                      >
                        <Shield size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </Table>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
            Showing {agents.length} of {totalAgents} registered agents
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                ...tactileButtonStyle,
                padding: '0.35rem 0.65rem',
                opacity: page <= 1 ? 0.5 : 1,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', padding: '0 0.5rem' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                ...tactileButtonStyle,
                padding: '0.35rem 0.65rem',
                opacity: page >= totalPages ? 0.5 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </Card>
      )}

      {/* CREATE AGENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Agent Reseller"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Full Name *</label>
            <Input
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              placeholder="e.g. Yaw Mensah"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Email Address *</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="yaw@example.com"
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Phone Number *</label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="0244123456"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Business / Store Name *</label>
              <Input
                value={createForm.businessName}
                onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                placeholder="Yaw Telecom Services"
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Store Slug *</label>
              <Input
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="yaw-telecom"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Agent Tier</label>
              <select
                value={createForm.agentTier}
                onChange={(e) => setCreateForm({ ...createForm, agentTier: e.target.value })}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="STANDARD">Standard Agent</option>
                <option value="SILVER">Silver Agent</option>
                <option value="GOLD">Gold SuperAgent</option>
                <option value="ENTERPRISE">Enterprise API Partner</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Initial Password</label>
              <Input
                type="password"
                value={createForm.initialPassword}
                onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                placeholder="TempPassword123!"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-1)' }}>
            <input
              type="checkbox"
              id="enableApiCheck"
              checked={createForm.enableApiAccess}
              onChange={(e) => setCreateForm({ ...createForm, enableApiAccess: e.target.checked })}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="enableApiCheck" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer' }}>
              Grant Developer API Access Immediately
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateAgent}
              disabled={isCreating}
              style={{
                ...primaryButtonStyle,
                opacity: isCreating ? 0.6 : 1,
              }}
            >
              {isCreating ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </div>
      </Modal>

      {/* AGENT STATUS CHANGE MODAL */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Change Status: ${statusTargetAgent?.fullName || 'Agent'}`}
        maxWidth="520px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>New Operational Status *</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              style={{ ...selectStyle, width: '100%' }}
            >
              <option value="ACTIVE">ACTIVE — Fully Authorized</option>
              <option value="PENDING">PENDING — Under Verification</option>
              <option value="SUSPENDED">SUSPENDED — Block All Commerce & API</option>
              <option value="RESTRICTED">RESTRICTED — Limited Fulfillment</option>
              <option value="DISABLED">DISABLED — Terminated Account</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Audit Reason * (min 4 chars)</label>
            <Input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Agent KYC verified, or suspended due to dispute"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
            <button type="button" onClick={() => setIsStatusModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={isUpdatingStatus}
              style={{
                ...primaryButtonStyle,
                opacity: isUpdatingStatus ? 0.6 : 1,
              }}
            >
              {isUpdatingStatus ? 'Updating...' : 'Apply Status Change'}
            </button>
          </div>
        </div>
      </Modal>

      {/* DOUBLE-ENTRY WALLET ADJUSTMENT MODAL */}
      <Modal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        title={`Wallet Float Adjustment: ${walletTargetAgent?.fullName || 'Agent'}`}
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Current Authoritative Float Balance:</span>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              GH₵ {((walletTargetAgent?.walletBalancePesewas || 0) / 100).toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Adjustment Direction</label>
              <select
                value={adjDirection}
                onChange={(e) => setAdjDirection(e.target.value as any)}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="CREDIT">CREDIT (Increase Float)</option>
                <option value="DEBIT">DEBIT (Decrease Float)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Amount in GHS *</label>
              <Input
                type="number"
                step="0.01"
                value={adjAmountGhs}
                onChange={(e) => setAdjAmountGhs(e.target.value)}
                placeholder="50.00"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Audit Reason * (min 5 chars)</label>
            <Input
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="e.g. Bank deposit voucher confirmation ref #12345"
            />
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
            🔒 Invariant: This operation posts a double-entry ledger entry between <code>CUSTOMER_WALLET</code> and <code>PLATFORM_RESERVE</code>.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
            <button type="button" onClick={() => setIsWalletModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdjustWallet}
              disabled={isAdjustingWallet}
              style={{
                ...primaryButtonStyle,
                opacity: isAdjustingWallet ? 0.6 : 1,
              }}
            >
              {isAdjustingWallet ? 'Posting Voucher...' : 'Execute Balanced Adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CUSTOM WHOLESALE PRICING MODAL */}
      <Modal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        title={`Custom Wholesale Pricing: ${pricingTargetAgent?.fullName || 'Agent'}`}
        maxWidth="760px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)', maxHeight: '72vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Override standard wholesale prices for this specific agent. Leave empty to use default agent wholesale pricing.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '8px' }}>Plan / SKU</th>
                <th style={{ padding: '8px' }}>Network</th>
                <th style={{ padding: '8px' }}>Retail Price</th>
                <th style={{ padding: '8px' }}>Default Wholesale</th>
                <th style={{ padding: '8px', minWidth: '130px' }}>Custom Wholesale (GH₵)</th>
              </tr>
            </thead>
            <tbody>
              {customPricingList.map((plan) => {
                const retailGhs = (plan.basePricePesewas / 100).toFixed(2);
                const defaultWholesaleGhs = (plan.defaultAgentPricePesewas / 100).toFixed(2);
                const val = customPriceEdits[plan.productId] || '';

                return (
                  <tr key={plan.productId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{plan.productName}</td>
                    <td style={{ padding: '8px' }}>
                      <Badge variant="neutral" size="sm">{plan.network}</Badge>
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>GH₵ {retailGhs}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>GH₵ {defaultWholesaleGhs}</td>
                    <td style={{ padding: '8px' }}>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={defaultWholesaleGhs}
                        value={val}
                        onChange={(e) => setCustomPriceEdits({ ...customPriceEdits, [plan.productId]: e.target.value })}
                        style={{ height: '32px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
            <button type="button" onClick={() => setIsPricingModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustomPricing}
              disabled={isSavingPricing}
              style={{
                ...primaryButtonStyle,
                opacity: isSavingPricing ? 0.6 : 1,
              }}
            >
              {isSavingPricing ? 'Saving...' : 'Save Wholesale Rules'}
            </button>
          </div>
        </div>
      </Modal>

      {/* AGENT APPLICATION REVIEW MODAL */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedApplication(null);
          setRejectionReason('');
        }}
        title={selectedApplication ? `Review Application: ${selectedApplication.fullName}` : 'Review Agent Application'}
        maxWidth="720px"
      >
        {selectedApplication && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
            {/* Applicant Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
                background: 'var(--color-bg-subtle)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Applicant Name</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {selectedApplication.fullName}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Email Address</span>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  {selectedApplication.email}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Contact Phone</span>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedApplication.phone}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Location / Region</span>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  {selectedApplication.locationRegion || 'Unspecified'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Proposed Business</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-primary)' }}>
                  {selectedApplication.businessName}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Proposed Store Slug</span>
                <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  /{selectedApplication.slug}
                </p>
              </div>
            </div>

            {/* Experience & Motivation */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Business Experience & Statement
              </span>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-subtle)',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedApplication.experienceDescription || 'No statement provided.'}
              </p>
            </div>

            {/* Payment & Fee Status Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: selectedApplication.paymentStatus === 'PAID' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${selectedApplication.paymentStatus === 'PAID' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 'var(--font-size-xs)',
                      color: selectedApplication.paymentStatus === 'PAID' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  >
                    {selectedApplication.paymentStatus === 'PAID' ? '✓ Application Fee Paid' : '⚠ Payment Pending'}
                  </span>
                  <Badge variant={selectedApplication.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                    GH₵ {((selectedApplication.feePesewas || 10000) / 100).toFixed(2)}
                  </Badge>
                </div>
                {selectedApplication.paystackReference && (
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block' }}>
                    Payment Reference: {selectedApplication.paystackReference}
                  </span>
                )}
              </div>
              <Badge
                variant={
                  selectedApplication.status === 'APPROVED'
                    ? 'success'
                    : selectedApplication.status === 'REJECTED'
                    ? 'danger'
                    : 'warning'
                }
              >
                {selectedApplication.status}
              </Badge>
            </div>

            {/* Rejection / Admin Notes Field */}
            {selectedApplication.status === 'PENDING_APPROVAL' ? (
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px', color: 'var(--color-text-primary)' }}>
                  Admin Review Notes (Required if Rejecting)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide review feedback or rejection reason to be sent to the applicant..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : selectedApplication.adminNotes ? (
              <div style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700 }}>Admin Decision Notes:</span>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                  {selectedApplication.adminNotes}
                </p>
                {selectedApplication.reviewedAt && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    Decided on: {new Date(selectedApplication.reviewedAt).toLocaleString()}
                  </span>
                )}
              </div>
            ) : null}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedApplication(null);
                  setRejectionReason('');
                }}
                style={tactileButtonStyle}
              >
                Close
              </button>

              {selectedApplication.status === 'PENDING_APPROVAL' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleRejectApplication(selectedApplication.id)}
                    disabled={isRejectingApp || isApprovingApp}
                    style={{
                      ...tactileButtonStyle,
                      color: 'var(--color-danger, #EF4444)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <UserX size={14} />
                    <span>{isRejectingApp ? 'Rejecting...' : 'Reject Application'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApproveApplication(selectedApplication.id)}
                    disabled={isApprovingApp || isRejectingApp}
                    style={primaryButtonStyle}
                  >
                    <UserCheck size={14} />
                    <span>{isApprovingApp ? 'Promoting...' : 'Approve as Agent'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIGURE APPLICATION FEE MODAL */}
      <Modal
        isOpen={isFeeModalOpen}
        onClose={() => setIsFeeModalOpen(false)}
        title="Configure Agent Application Fee"
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Current Authoritative Application Fee:</span>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-brand-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              GH₵ {currentAppFeeGhs.toFixed(2)}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              All prospective agents must pay this non-refundable verification fee when applying to join the ByteBeacon agent network.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              New Application Fee in Ghana Cedis (GH₵) *
            </label>
            <Input
              type="number"
              step="1"
              min="0"
              value={newAppFeeInput}
              onChange={(e) => setNewAppFeeInput(e.target.value)}
              placeholder="100.00"
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Change Rationale / Audit Reason (Optional)
            </label>
            <Input
              value={feeChangeReason}
              onChange={(e) => setFeeChangeReason(e.target.value)}
              placeholder="e.g. Promotional campaign or adjusted operational verification cost"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
            <button type="button" onClick={() => setIsFeeModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateApplicationFee}
              disabled={isUpdatingFee}
              style={{
                ...primaryButtonStyle,
                opacity: isUpdatingFee ? 0.6 : 1,
              }}
            >
              {isUpdatingFee ? 'Saving Fee...' : 'Save Application Fee'}
            </button>
          </div>
        </div>
      </Modal>

      {/* AGENT DOSSIER DRAWER & BACKDROP (Non-Overlapping, zIndex 250/260) */}
      {selectedAgentId && (
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
          onClick={() => setSelectedAgentId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '860px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-2xl)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s ease-out',
              zIndex: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <Avatar name={agentDetail?.agent.fullName || 'Agent'} size="md" status={agentDetail?.agent.status === 'ACTIVE' ? 'online' : 'offline'} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                      {agentDetail?.agent.fullName || 'Loading Agent Dossier...'}
                    </h2>
                    {agentDetail?.agent.status && (
                      <Badge variant={agentDetail.agent.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                        {agentDetail.agent.status}
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {agentDetail?.agent.businessName} • {agentDetail?.agent.email} {agentDetail?.agent.phone ? `• ${agentDetail?.agent.phone}` : ''}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgentId(null)}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                }}
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Drawer Sub-Page Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0.3rem',
                padding: '0.4rem var(--space-5)',
                borderBottom: '1px solid var(--color-border-subtle)',
                overflowX: 'auto',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              {[
                { id: 'OVERVIEW', label: 'Overview', icon: <Eye size={12} /> },
                { id: 'WALLET', label: 'Wallet & Float', icon: <DollarSign size={12} /> },
                { id: 'ORDERS', label: 'Orders History', icon: <TrendingUp size={12} /> },
                { id: 'PRICING', label: 'Custom Pricing', icon: <Sliders size={12} /> },
                { id: 'STORE', label: 'Storefront', icon: <Store size={12} /> },
                { id: 'API', label: 'API Keys', icon: <Key size={12} /> },
                { id: 'SUBAGENTS', label: `Sub-Agents (${agentDetail?.subAgents?.length || 0})`, icon: <Users size={12} /> },
                { id: 'CUSTOMERS', label: `Customers (${agentDetail?.customers?.length || 0})`, icon: <UserCheck size={12} /> },
                { id: 'AUDIT', label: 'Audit Trail', icon: <Shield size={12} /> },
              ].map((t) => {
                const isActive = dossierTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDossierTab(t.id as any)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                      backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Body Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isLoadingDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '1rem' }}>
                  <RefreshCw size={24} className="animate-spin" color="var(--color-brand-primary)" />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Loading authoritative agent dossier...</span>
                </div>
              ) : agentDetail ? (
                <>
                  {/* TAB: OVERVIEW */}
                  {dossierTab === 'OVERVIEW' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {/* Snapshot Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                        <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Wallet Float Balance</span>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                            GH₵ {((agentDetail.wallet.balancePesewas || 0) / 100).toFixed(2)}
                          </div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Reseller Orders</span>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                            {agentDetail.ordersSummary.total.toLocaleString()}
                          </div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Gross Processed Volume</span>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-brand-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                            GH₵ {((agentDetail.wallet.totalRevenuePesewas || 0) / 100).toFixed(2)}
                          </div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Sub-Agents Network</span>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                            {agentDetail.subAgents.length}
                          </div>
                        </Card>
                      </div>

                      {/* Agent Operational Quick Controls */}
                      <Card elevated style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Operational Reseller Status:</span>
                          <div style={{ marginTop: '3px' }}>
                            <Badge variant={agentDetail.agent.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                              {agentDetail.agent.status}
                            </Badge>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setWalletTargetAgent(agentDetail.agent);
                              setIsWalletModalOpen(true);
                            }}
                            style={tactileButtonStyle}
                          >
                            <DollarSign size={13} color="var(--color-brand-primary)" />
                            <span>Adjust Float</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusTargetAgent(agentDetail.agent);
                              setNewStatus(agentDetail.agent.status as any);
                              setIsStatusModalOpen(true);
                            }}
                            style={tactileButtonStyle}
                          >
                            <Shield size={13} color="var(--color-text-muted)" />
                            <span>Change Status</span>
                          </button>
                        </div>
                      </Card>

                      {/* Recent Orders in Dossier */}
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>
                          Recent Order Activity
                        </h3>
                        <Table
                          minWidth="700px"
                          headers={['Public ID', 'Recipient', 'Network', 'Amount', 'Status', 'Date']}
                        >
                          {(agentDetail.recentOrders || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                                No recent orders recorded for this reseller.
                              </td>
                            </tr>
                          ) : (
                            agentDetail.recentOrders.map((r: any) => (
                              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                                  {r.publicId || r.id}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>
                                  {r.recipientPhone || 'N/A'}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                  <Badge variant="neutral" size="sm">{r.network || 'UNKNOWN'}</Badge>
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                                  GH₵ {((r.amountPesewas || 0) / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                  <Badge variant={r.orderStatus === 'COMPLETED' ? 'success' : r.orderStatus === 'FAILED' ? 'danger' : 'warning'} size="sm">
                                    {r.orderStatus}
                                  </Badge>
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  {new Date(r.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* TAB: WALLET */}
                  {dossierTab === 'WALLET' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <Card elevated style={{ padding: 'var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Authoritative Float Balance</span>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                            GH₵ {((agentDetail.wallet.balancePesewas || 0) / 100).toFixed(2)}
                          </div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-4)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ledger-Derived Balance</span>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                            GH₵ {((agentDetail.wallet.ledgerBalancePesewas || 0) / 100).toFixed(2)}
                          </div>
                        </Card>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Deposits</span>
                          <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>GH₵ {((agentDetail.wallet.totalDepositsPesewas || 0) / 100).toFixed(2)}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Purchases</span>
                          <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>GH₵ {((agentDetail.wallet.totalSpentPesewas || 0) / 100).toFixed(2)}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Withdrawals</span>
                          <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>GH₵ {((agentDetail.wallet.totalWithdrawalsPesewas || 0) / 100).toFixed(2)}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Refunds</span>
                          <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>GH₵ {((agentDetail.wallet.totalRefundsPesewas || 0) / 100).toFixed(2)}</div>
                        </Card>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setWalletTargetAgent(agentDetail.agent); setIsWalletModalOpen(true); }}
                        style={{
                          ...tactileButtonStyle,
                          backgroundColor: 'var(--color-brand-primary)',
                          color: '#fff',
                          border: 'none',
                          justifyContent: 'center',
                          padding: '0.65rem 1rem',
                        }}
                      >
                        <DollarSign size={14} />
                        <span>Make Controlled Double-Entry Float Adjustment</span>
                      </button>
                    </div>
                  )}

                  {/* TAB: ORDERS */}
                  {dossierTab === 'ORDERS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>{agentDetail.ordersSummary.total.toLocaleString()}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Completed</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>{agentDetail.ordersSummary.completed.toLocaleString()}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Processing</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-warning)', marginTop: '2px' }}>{agentDetail.ordersSummary.processing.toLocaleString()}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Failed</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-danger)', marginTop: '2px' }}>{agentDetail.ordersSummary.failed.toLocaleString()}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Refunded</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text-muted)', marginTop: '2px' }}>{agentDetail.ordersSummary.refunded.toLocaleString()}</div>
                        </Card>
                      </div>

                      <Table
                        minWidth="800px"
                        headers={['Public ID', 'Recipient', 'Network', 'Data Size', 'Amount', 'Order Status', 'Payment', 'Date']}
                      >
                        {(agentDetail.recentOrders || []).length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                              No order records found for this agent.
                            </td>
                          </tr>
                        ) : (
                          agentDetail.recentOrders.map((r: any) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                                {r.publicId || r.id}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>
                                {r.recipientPhone || 'N/A'}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant="neutral" size="sm">{r.network || 'UNKNOWN'}</Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>
                                {r.dataAmountMb >= 1000 ? `${(r.dataAmountMb / 1000).toFixed(1)} GB` : `${r.dataAmountMb} MB`}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                                GH₵ {((r.amountPesewas || 0) / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant={r.orderStatus === 'COMPLETED' ? 'success' : r.orderStatus === 'FAILED' ? 'danger' : 'warning'} size="sm">
                                  {r.orderStatus}
                                </Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant={r.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                                  {r.paymentStatus}
                                </Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </Table>
                    </div>
                  )}

                  {/* TAB: PRICING */}
                  {dossierTab === 'PRICING' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Wholesale Price Overrides</span>
                          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Custom discount tiers applied to this agent's purchases.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCustomPricingModal(agentDetail.agent)}
                          style={tactileButtonStyle}
                        >
                          <Sliders size={13} />
                          <span>Edit Wholesale Rules</span>
                        </button>
                      </div>

                      <Table
                        minWidth="700px"
                        headers={['Product Name', 'Network', 'Retail Price', 'Default Wholesale', 'Custom Wholesale', 'Effective Margin']}
                      >
                        {(agentDetail.customPricing || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                              No custom pricing overrides configured for this agent. Default rates apply.
                            </td>
                          </tr>
                        ) : (
                          agentDetail.customPricing.map((r: any) => (
                            <tr key={r.productId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, fontSize: '11px' }}>{r.productName}</td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant="neutral" size="sm">{r.network}</Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                GH₵ {((r.basePricePesewas || 0) / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                GH₵ {((r.defaultAgentPricePesewas || 0) / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                {r.customPricePesewas ? (
                                  <span style={{ fontWeight: 800, color: 'var(--color-brand-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                    GH₵ {(r.customPricePesewas / 100).toFixed(2)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Default</span>
                                )}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-success)' }}>
                                GH₵ {(((r.basePricePesewas || 0) - (r.effectivePricePesewas || 0)) / 100).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </Table>
                    </div>
                  )}

                  {/* TAB: STOREFRONT */}
                  {dossierTab === 'STORE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {agentDetail.storeSummary ? (
                        <>
                          <Card elevated style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: agentDetail.storeSummary.primaryColor || 'var(--color-brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <Store size={22} />
                              </div>
                              <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                                  {agentDetail.storeSummary.storeName || 'Custom Storefront'}
                                </h3>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  Slug: <code style={{ fontFamily: 'var(--font-mono)' }}>{agentDetail.storeSummary.slug}</code>
                                </span>
                              </div>
                            </div>
                            <div>
                              <a
                                href={`/store/${agentDetail.storeSummary.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: 'none' }}
                              >
                                <button type="button" style={tactileButtonStyle}>
                                  <ExternalLink size={13} />
                                  <span>View Live Storefront</span>
                                </button>
                              </a>
                            </div>
                          </Card>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                            <Card elevated style={{ padding: 'var(--space-3)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Store Status</span>
                              <div style={{ marginTop: '4px' }}>
                                <Badge variant={agentDetail.storeSummary.storeStatus === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                                  {agentDetail.storeSummary.storeStatus}
                                </Badge>
                              </div>
                            </Card>
                            <Card elevated style={{ padding: 'var(--space-3)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Approval Status</span>
                              <div style={{ marginTop: '4px' }}>
                                <Badge variant={agentDetail.storeSummary.approvalStatus === 'APPROVED' ? 'success' : 'warning'} size="sm">
                                  {agentDetail.storeSummary.approvalStatus}
                                </Badge>
                              </div>
                            </Card>
                            <Card elevated style={{ padding: 'var(--space-3)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Products Listed</span>
                              <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>{agentDetail.storeSummary.productsCount}</div>
                            </Card>
                            <Card elevated style={{ padding: 'var(--space-3)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Storefront Sales</span>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-brand-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                GH₵ {((agentDetail.storeSummary.totalSalesPesewas || 0) / 100).toFixed(2)}
                              </div>
                            </Card>
                          </div>
                        </>
                      ) : (
                        <Card elevated style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                          <Store size={36} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-3) auto' }} />
                          <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>No Active Storefront</h4>
                          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                            This reseller has not provisioned an online branded storefront yet.
                          </p>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* TAB: API */}
                  {dossierTab === 'API' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Developer API Integration</span>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>API credentials belonging to this reseller.</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>API Status</span>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: agentDetail.apiSummary.enabled ? 'var(--color-success)' : 'var(--color-text-muted)', marginTop: '2px' }}>
                            {agentDetail.apiSummary.enabled ? '● Enabled' : '○ Disabled'}
                          </div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Active Keys</span>
                          <div style={{ fontWeight: 800, fontSize: '16px', marginTop: '2px' }}>{agentDetail.apiSummary.activeKeys}</div>
                        </Card>
                        <Card elevated style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Success Rate</span>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--color-success)', marginTop: '2px' }}>{agentDetail.apiSummary.successRate.toFixed(1)}%</div>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* TAB: SUBAGENTS */}
                  {dossierTab === 'SUBAGENTS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Hierarchical Sub-Agents ({agentDetail.subAgents.length})</span>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Downline resellers recruited or managed by this agent.</p>
                      </div>
                      <Table
                        minWidth="700px"
                        headers={['Sub-Agent', 'Business', 'Status', 'Orders', 'Revenue', 'Joined']}
                      >
                        {(agentDetail.subAgents || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                              This agent has no registered sub-agents in their downline.
                            </td>
                          </tr>
                        ) : (
                          agentDetail.subAgents.map((r: any) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, fontSize: '11px' }}>{r.fullName}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>{r.businessName}</td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant={r.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                                  {r.status}
                                </Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>{r.ordersCount}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                GH₵ {((r.revenuePesewas || 0) / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </Table>
                    </div>
                  )}

                  {/* TAB: CUSTOMERS */}
                  {dossierTab === 'CUSTOMERS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Direct Customers ({agentDetail.customers.length})</span>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Customers affiliated with this agent storefront.</p>
                      </div>
                      <Table
                        minWidth="700px"
                        headers={['Customer', 'Email', 'Phone', 'Orders', 'Spent', 'Last Order']}
                      >
                        {(agentDetail.customers || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                              No direct customers associated with this agent.
                            </td>
                          </tr>
                        ) : (
                          agentDetail.customers.map((r: any) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, fontSize: '11px' }}>{r.fullName}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>{r.email}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{r.phone}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '11px' }}>{r.ordersCount}</td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                GH₵ {((r.spentPesewas || 0) / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {r.lastOrderDate ? new Date(r.lastOrderDate).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </Table>
                    </div>
                  )}

                  {/* TAB: AUDIT TRAIL */}
                  {dossierTab === 'AUDIT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Security & Administrative Audit Stream</span>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Audit events referencing this agent.</p>
                      </div>
                      <Table
                        minWidth="700px"
                        headers={['Action', 'Correlation ID', 'Timestamp']}
                      >
                        {(agentDetail.auditLogs || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                              No audit events recorded for this agent.
                            </td>
                          </tr>
                        ) : (
                          agentDetail.auditLogs.map((r: any) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <Badge variant="info" size="sm">{r.action}</Badge>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                {r.correlationId}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(r.occurredAt).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </Table>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminAgentsPage;
