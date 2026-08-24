import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Select } from '../../components/ui/Select/Select.js';
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
} from 'lucide-react';

export const AdminAgentsPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SUSPENDED' | 'API' | 'PRICING'>('ALL');
  const [stats, setStats] = useState<AdminAgentStats | null>(null);
  const [agents, setAgents] = useState<AdminAgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalAgents, setTotalAgents] = useState<number>(0);

  // Filters
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
  const [dossierTab, setDossierTab] = useState<'OVERVIEW' | 'PROFILE' | 'WALLET' | 'ORDERS' | 'PRICING' | 'STORE' | 'API' | 'SUBAGENTS' | 'CUSTOMERS' | 'AUDIT'>('OVERVIEW');

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

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await adminApi.getAgentStats();
      setStats(data);
    } catch {
      // Fallback
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

      if (res?.items) {
        setAgents(res.items);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalAgents(res.pagination.total || 0);
      }
    } catch (err: any) {
      toastError('Failed to Load Agents', err.message || 'Error communicating with backend');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, storeFilter, apiFilter, financialFilter, dateRange, page, search, toastError]);

  useEffect(() => {
    fetchStats();
    fetchAgents();
  }, [fetchStats, fetchAgents]);

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
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative management of agent accounts, float liabilities, storefronts, API keys, custom wholesale pricing, and sub-agents.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} style={{ marginRight: '6px' }} />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={14} style={{ marginRight: '6px' }} />
            Register Agent
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { fetchStats(); fetchAgents(); }} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 8 KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
          value={stats ? stats.pendingAgents.toLocaleString() : '—'}
          subvalue="Awaiting Approval"
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

      {/* Internal Navigation Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
        {[
          { id: 'ALL', label: 'All Registered Agents' },
          { id: 'PENDING', label: 'Pending Applications' },
          { id: 'SUSPENDED', label: 'Suspended / Restricted' },
          { id: 'API', label: 'API Developer Access' },
          { id: 'PRICING', label: 'Custom Pricing' },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.4rem 1.1rem' }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Main Table Card */}
      <Card elevated accentColor="orange" style={{ padding: 'var(--space-5)' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: '280px', flex: 1 }}>
              <Input
                placeholder="Search by agent name, email, phone, business, slug, or ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                leftIcon={<Search size={15} color="var(--color-text-muted)" />}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'RESTRICTED', label: 'Restricted' },
                  { value: 'DISABLED', label: 'Disabled' },
                ]}
              />
              <Select
                value={storeFilter}
                onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Storefronts' },
                  { value: 'HAS_STORE', label: 'Has Storefront' },
                  { value: 'NO_STORE', label: 'No Storefront' },
                  { value: 'ACTIVE_STORE', label: 'Active Store' },
                  { value: 'PENDING_STORE', label: 'Pending Store' },
                  { value: 'SUSPENDED_STORE', label: 'Suspended Store' },
                ]}
              />
              <Select
                value={apiFilter}
                onChange={(e) => { setApiFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All API Access' },
                  { value: 'ENABLED', label: 'API Enabled' },
                  { value: 'DISABLED', label: 'API Disabled' },
                ]}
              />
              <Select
                value={financialFilter}
                onChange={(e) => { setFinancialFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Balances' },
                  { value: 'POSITIVE', label: 'Positive Balance' },
                  { value: 'ZERO', label: 'Zero Balance' },
                  { value: 'NEGATIVE', label: 'Negative / Anomaly' },
                ]}
              />
              <Select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Registration Dates' },
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: '90d', label: 'Last 90 Days' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <Table
          columns={[
            {
              header: 'Agent & Business',
              accessor: 'fullName',
              render: (row: AdminAgentListItem) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                    color: 'var(--color-brand)', fontSize: 'var(--font-size-xs)'
                  }}>
                    {row.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {row.fullName}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {row.businessName} {row.slug && `• /${row.slug}`}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: 'Contact Info',
              accessor: 'email',
              render: (row: AdminAgentListItem) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={12} color="var(--color-text-muted)" /> {row.email}
                  </span>
                  {row.phone && (
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <Phone size={10} style={{ display: 'inline', marginRight: '3px' }} />{row.phone}
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: 'Status',
              accessor: 'status',
              render: (row: AdminAgentListItem) => {
                let badgeVariant: 'success' | 'danger' | 'warning' | 'info' | 'default' = 'default';
                if (row.status === 'ACTIVE') badgeVariant = 'success';
                else if (row.status === 'SUSPENDED' || row.status === 'DISABLED') badgeVariant = 'danger';
                else if (row.status === 'PENDING') badgeVariant = 'warning';
                else if (row.status === 'RESTRICTED') badgeVariant = 'info';

                return <Badge variant={badgeVariant} size="sm">{row.status}</Badge>;
              },
            },
            {
              header: 'Storefront',
              accessor: 'storeStatus',
              render: (row: AdminAgentListItem) => {
                if (!row.hasStore) {
                  return <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>None</span>;
                }
                const isStoreActive = row.storeStatus === 'ACTIVE';
                return (
                  <Badge variant={isStoreActive ? 'success' : 'warning'} size="sm">
                    {row.storeName ? `${row.storeName}` : row.storeStatus}
                  </Badge>
                );
              },
            },
            {
              header: 'Wallet Float',
              accessor: 'walletBalancePesewas',
              render: (row: AdminAgentListItem) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: row.walletBalancePesewas >= 0 ? 'var(--color-brand)' : 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                  GH₵ {(row.walletBalancePesewas / 100).toFixed(2)}
                </span>
              ),
            },
            {
              header: 'Sales & Orders',
              accessor: 'ordersCount',
              render: (row: AdminAgentListItem) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                    {row.ordersCount.toLocaleString()} orders
                  </span>
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    GH₵ {(row.revenuePesewas / 100).toFixed(2)}
                  </span>
                </div>
              ),
            },
            {
              header: 'API Access',
              accessor: 'apiEnabled',
              render: (row: AdminAgentListItem) => (
                <Badge variant={row.apiEnabled ? 'info' : 'default'} size="sm">
                  {row.apiEnabled ? `${row.activeKeysCount} Active Key(s)` : 'Disabled'}
                </Badge>
              ),
            },
            {
              header: 'Joined',
              accessor: 'createdAt',
              render: (row: AdminAgentListItem) => (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              header: 'Actions',
              accessor: 'id',
              render: (row: AdminAgentListItem) => (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="outline" size="sm" onClick={() => openAgentDossier(row.id)}>
                    <Eye size={13} style={{ marginRight: '4px' }} />
                    Dossier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWalletTargetAgent(row);
                      setIsWalletModalOpen(true);
                    }}
                    title="Adjust Wallet"
                  >
                    <DollarSign size={14} color="var(--color-brand)" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCustomPricingModal(row)}
                    title="Wholesale Pricing"
                  >
                    <Sliders size={14} color="var(--color-speed-bright)" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusTargetAgent(row);
                      setNewStatus(row.status as any);
                      setIsStatusModalOpen(true);
                    }}
                    title="Change Status"
                  >
                    <Shield size={14} color="var(--color-text-muted)" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={agents}
          keyExtractor={(row) => row.id}
          emptyMessage={isLoading ? 'Loading agents from authoritative database...' : 'No agents match your filter criteria.'}
        />

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {agents.length} of {totalAgents} registered agents
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* CREATE AGENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Agent Reseller"
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
              <Select
                value={createForm.agentTier}
                onChange={(e) => setCreateForm({ ...createForm, agentTier: e.target.value })}
                options={[
                  { value: 'STANDARD', label: 'Standard Agent' },
                  { value: 'SILVER', label: 'Silver Agent' },
                  { value: 'GOLD', label: 'Gold SuperAgent' },
                  { value: 'ENTERPRISE', label: 'Enterprise API Partner' },
                ]}
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Initial Temporary Password</label>
              <Input
                type="password"
                value={createForm.initialPassword}
                onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                placeholder="TempPassword123!"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <input
              type="checkbox"
              id="enableApiCheck"
              checked={createForm.enableApiAccess}
              onChange={(e) => setCreateForm({ ...createForm, enableApiAccess: e.target.checked })}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="enableApiCheck" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer' }}>
              Grant Developer API Access Immediately
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateAgent} disabled={isCreating}>
              {isCreating ? 'Registering Agent...' : 'Confirm Registration'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AGENT STATUS CHANGE MODAL */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Change Status: ${statusTargetAgent?.fullName || 'Agent'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>New Operational Status *</label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE — Fully Authorized' },
                { value: 'PENDING', label: 'PENDING — Under Verification' },
                { value: 'SUSPENDED', label: 'SUSPENDED — Block All Commerce & API' },
                { value: 'RESTRICTED', label: 'RESTRICTED — Limited Fulfillment' },
                { value: 'DISABLED', label: 'DISABLED — Terminated Account' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Audit Reason * (min 4 chars)</label>
            <Input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Agent KYC verified, or suspended due to suspicious chargebacks"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdateStatus} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Updating Status...' : 'Apply Status Change'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* DOUBLE-ENTRY WALLET ADJUSTMENT MODAL */}
      <Modal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        title={`Wallet Adjustment: ${walletTargetAgent?.fullName || 'Agent'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Current Authoritative Balance:</span>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
              GH₵ {((walletTargetAgent?.walletBalancePesewas || 0) / 100).toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Adjustment Direction</label>
              <Select
                value={adjDirection}
                onChange={(e) => setAdjDirection(e.target.value as any)}
                options={[
                  { value: 'CREDIT', label: 'CREDIT (Increase Float)' },
                  { value: 'DEBIT', label: 'DEBIT (Decrease Float)' },
                ]}
              />
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
              placeholder="e.g. Direct bank float deposit confirmation ref #99812"
            />
          </div>

          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
            🔒 Invariant: This action posts a balanced double-entry voucher pairing <code>CUSTOMER_WALLET</code> against <code>PLATFORM_RESERVE</code>. Direct database mutations are forbidden.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsWalletModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAdjustWallet} disabled={isAdjustingWallet}>
              {isAdjustingWallet ? 'Posting Voucher...' : 'Execute Balanced Adjustment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CUSTOM PRICING MODAL */}
      <Modal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        title={`Custom Wholesale Pricing: ${pricingTargetAgent?.fullName || 'Agent'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)', maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Override standard wholesale prices for this specific agent. Leave empty to use the default agent price.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
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
                    <td style={{ padding: '8px', fontWeight: 600 }}>{plan.productName}</td>
                    <td style={{ padding: '8px' }}>
                      <Badge variant="default" size="sm">{plan.network}</Badge>
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>GH₵ {retailGhs}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>GH₵ {defaultWholesaleGhs}</td>
                    <td style={{ padding: '8px' }}>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={defaultWholesaleGhs}
                        value={val}
                        onChange={(e) => setCustomPriceEdits({ ...customPriceEdits, [plan.productId]: e.target.value })}
                        style={{ height: '30px', fontSize: '12px' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsPricingModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveCustomPricing} disabled={isSavingPricing}>
              {isSavingPricing ? 'Saving Pricing...' : 'Save Wholesale Rules'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* AGENT DOSSIER DRAWER */}
      {selectedAgentId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '850px',
          background: 'var(--color-bg-primary)', borderLeft: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-2xl)', zIndex: 1000, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', animation: 'slideInRight 0.25s ease-out'
        }}>
          {/* Drawer Header */}
          <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '18px' }}>
                {agentDetail?.agent.fullName?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  {agentDetail?.agent.fullName || 'Loading Agent...'}
                </h2>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {agentDetail?.agent.businessName} • {agentDetail?.agent.email}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setSelectedAgentId(null)}>
              ✕ Close
            </Button>
          </div>

          {/* Drawer Tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', overflowX: 'auto', background: 'var(--color-bg-primary)' }}>
            {[
              { id: 'OVERVIEW', label: 'Overview' },
              { id: 'WALLET', label: 'Wallet & Ledger' },
              { id: 'ORDERS', label: 'Orders History' },
              { id: 'PRICING', label: 'Custom Pricing' },
              { id: 'STORE', label: 'Storefront' },
              { id: 'API', label: 'API Keys' },
              { id: 'SUBAGENTS', label: 'Sub-Agents' },
              { id: 'CUSTOMERS', label: 'Customers' },
              { id: 'AUDIT', label: 'Audit Trail' },
            ].map((t) => (
              <Button
                key={t.id}
                variant={dossierTab === t.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDossierTab(t.id as any)}
                style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {isLoadingDetail ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <RefreshCw size={24} className="animate-spin" color="var(--color-brand)" />
              </div>
            ) : agentDetail ? (
              <>
                {dossierTab === 'OVERVIEW' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Snapshot Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Wallet Float</span>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-brand)' }}>
                          GH₵ {(agentDetail.wallet.balancePesewas / 100).toFixed(2)}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Orders</span>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>
                          {agentDetail.ordersSummary.total.toLocaleString()}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Gross Revenue</span>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-purple-bright)' }}>
                          GH₵ {(agentDetail.wallet.totalRevenuePesewas / 100).toFixed(2)}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sub-Agents</span>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>
                          {agentDetail.subAgents.length}
                        </div>
                      </Card>
                    </div>

                    {/* Agent Status & Actions */}
                    <Card elevated style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>Operational Status: </span>
                        <Badge variant={agentDetail.agent.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {agentDetail.agent.status}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWalletTargetAgent(agentDetail.agent);
                            setIsWalletModalOpen(true);
                          }}
                        >
                          <DollarSign size={13} style={{ marginRight: '4px' }} />
                          Adjust Float
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setStatusTargetAgent(agentDetail.agent);
                            setNewStatus(agentDetail.agent.status as any);
                            setIsStatusModalOpen(true);
                          }}
                        >
                          <Shield size={13} style={{ marginRight: '4px' }} />
                          Change Status
                        </Button>
                      </div>
                    </Card>

                    {/* Recent Orders in Dossier */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Recent Order Activity</h3>
                      <Table
                        columns={[
                          { header: 'Public ID', accessor: 'publicId' },
                          { header: 'Recipient', accessor: 'recipientPhone' },
                          { header: 'Network', accessor: 'network' },
                          { header: 'Amount', accessor: 'amountPesewas', render: (r: any) => `GH₵ ${(r.amountPesewas / 100).toFixed(2)}` },
                          { header: 'Status', accessor: 'orderStatus', render: (r: any) => <Badge variant={r.orderStatus === 'COMPLETED' ? 'success' : 'warning'} size="sm">{r.orderStatus}</Badge> },
                          { header: 'Date', accessor: 'createdAt', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
                        ]}
                        data={agentDetail.recentOrders}
                        keyExtractor={(r: any) => r.id}
                        emptyMessage="No recent orders for this agent."
                      />
                    </div>
                  </div>
                )}

                {dossierTab === 'WALLET' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-4)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Authoritative Wallet Balance</span>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-brand)' }}>
                          GH₵ {(agentDetail.wallet.balancePesewas / 100).toFixed(2)}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-4)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ledger-Derived Balance</span>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          GH₵ {(agentDetail.wallet.ledgerBalancePesewas / 100).toFixed(2)}
                        </div>
                      </Card>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Deposited</span>
                        <div style={{ fontWeight: 700 }}>GH₵ {(agentDetail.wallet.totalDepositsPesewas / 100).toFixed(2)}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Purchases</span>
                        <div style={{ fontWeight: 700 }}>GH₵ {(agentDetail.wallet.totalSpentPesewas / 100).toFixed(2)}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Withdrawals</span>
                        <div style={{ fontWeight: 700 }}>GH₵ {(agentDetail.wallet.totalWithdrawalsPesewas / 100).toFixed(2)}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Refunds</span>
                        <div style={{ fontWeight: 700 }}>GH₵ {(agentDetail.wallet.totalRefundsPesewas / 100).toFixed(2)}</div>
                      </Card>
                    </div>

                    <Button variant="primary" onClick={() => { setWalletTargetAgent(agentDetail.agent); setIsWalletModalOpen(true); }}>
                      <DollarSign size={14} style={{ marginRight: '6px' }} />
                      Make Controlled Double-Entry Float Adjustment
                    </Button>
                  </div>
                )}

                {dossierTab === 'PRICING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Wholesale Price Overrides</span>
                      <Button variant="outline" size="sm" onClick={() => openCustomPricingModal(agentDetail.agent)}>
                        <Sliders size={13} style={{ marginRight: '4px' }} />
                        Edit Wholesale Rules
                      </Button>
                    </div>

                    <Table
                      columns={[
                        { header: 'Product Name', accessor: 'productName' },
                        { header: 'Network', accessor: 'network' },
                        { header: 'Retail Price', accessor: 'basePricePesewas', render: (r: any) => `GH₵ ${(r.basePricePesewas / 100).toFixed(2)}` },
                        { header: 'Default Wholesale', accessor: 'defaultAgentPricePesewas', render: (r: any) => `GH₵ ${(r.defaultAgentPricePesewas / 100).toFixed(2)}` },
                        { header: 'Custom Wholesale', accessor: 'customPricePesewas', render: (r: any) => r.customPricePesewas ? <span style={{ fontWeight: 800, color: 'var(--color-brand)' }}>GH₵ {(r.customPricePesewas / 100).toFixed(2)}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Default</span> },
                        { header: 'Effective Margin', accessor: 'effectivePricePesewas', render: (r: any) => `GH₵ ${((r.basePricePesewas - r.effectivePricePesewas) / 100).toFixed(2)}` },
                      ]}
                      data={agentDetail.customPricing}
                      keyExtractor={(r: any) => r.productId}
                      emptyMessage="No custom pricing overrides defined for this agent."
                    />
                  </div>
                )}

                {dossierTab === 'API' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>Developer API Keys</span>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                          Keys belong to the agent. Full secrets are never displayed.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>API Status</span>
                        <div style={{ fontWeight: 800, color: agentDetail.apiSummary.enabled ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
                          {agentDetail.apiSummary.enabled ? '● Enabled' : '○ Disabled'}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Active Keys</span>
                        <div style={{ fontWeight: 800 }}>{agentDetail.apiSummary.activeKeys}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Success Rate</span>
                        <div style={{ fontWeight: 800, color: 'var(--color-success)' }}>{agentDetail.apiSummary.successRate.toFixed(1)}%</div>
                      </Card>
                    </div>
                  </div>
                )}

                {dossierTab === 'SUBAGENTS' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Hierarchical Sub-Agents ({agentDetail.subAgents.length})</h3>
                    <Table
                      columns={[
                        { header: 'Sub-Agent', accessor: 'fullName' },
                        { header: 'Business', accessor: 'businessName' },
                        { header: 'Status', accessor: 'status', render: (r: any) => <Badge variant={r.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">{r.status}</Badge> },
                        { header: 'Orders', accessor: 'ordersCount' },
                        { header: 'Revenue', accessor: 'revenuePesewas', render: (r: any) => `GH₵ ${(r.revenuePesewas / 100).toFixed(2)}` },
                        { header: 'Joined', accessor: 'createdAt', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
                      ]}
                      data={agentDetail.subAgents}
                      keyExtractor={(r) => r.id}
                      emptyMessage="This agent has no registered sub-agents."
                    />
                  </div>
                )}

                {dossierTab === 'CUSTOMERS' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Tenant Isolated Customers ({agentDetail.customers.length})</h3>
                    <Table
                      columns={[
                        { header: 'Customer', accessor: 'fullName' },
                        { header: 'Email', accessor: 'email' },
                        { header: 'Phone', accessor: 'phone' },
                        { header: 'Orders', accessor: 'ordersCount' },
                        { header: 'Spent', accessor: 'spentPesewas', render: (r: any) => `GH₵ ${(r.spentPesewas / 100).toFixed(2)}` },
                        { header: 'Last Order', accessor: 'lastOrderDate', render: (r: any) => r.lastOrderDate ? new Date(r.lastOrderDate).toLocaleDateString() : 'N/A' },
                      ]}
                      data={agentDetail.customers}
                      keyExtractor={(r) => r.id}
                      emptyMessage="No direct customer relationships recorded for this agent."
                    />
                  </div>
                )}

                {dossierTab === 'AUDIT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Security & Administrative Audit Stream</h3>
                    <Table
                      columns={[
                        { header: 'Action', accessor: 'action', render: (r: any) => <Badge variant="info" size="sm">{r.action}</Badge> },
                        { header: 'Correlation ID', accessor: 'correlationId', render: (r: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{r.correlationId}</span> },
                        { header: 'Timestamp', accessor: 'occurredAt', render: (r: any) => new Date(r.occurredAt).toLocaleString() },
                      ]}
                      data={agentDetail.auditLogs}
                      keyExtractor={(r: any) => r.id}
                      emptyMessage="No audit logs recorded for this agent."
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
