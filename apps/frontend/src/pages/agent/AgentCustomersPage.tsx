import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { SearchInput, Input, PhoneInput, Select, Checkbox } from '../../components/ui/index.js';
import { Badge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Users,
  UserCheck,
  Clock,
  Ban,
  TrendingUp,
  DollarSign,
  Wallet,
  Plus,
  Download,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  Store,
  Phone,
  Mail,
  ArrowUpDown,
  Sparkles,
  Percent,
  Layers,
  Bell,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { NetworkProvider } from '@bytebeacon/shared';
import { walletApi } from '../../api/wallet.api.js';

// Feature Availability Flag: Set to true when ready to make Sub-Agent page fully available to agents
export const SUB_AGENTS_FEATURE_AVAILABLE = false;

export type SubAgentStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE';

export interface RecentSubAgentOrder {
  id: string;
  recipient: string;
  network: NetworkProvider;
  bundle: string;
  amount: string;
  source: 'Web' | 'API' | 'Agent Store' | 'Bulk' | 'Manual';
  paymentMethod: 'Paystack' | 'Wallet' | 'Mobile Money' | 'Card';
  status: 'DELIVERED' | 'PROCESSING' | 'FAILED';
  date: string;
}

export interface SubAgentItem {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  storeName: string;
  storeSlug: string;
  storeStatus: 'ONLINE' | 'MAINTENANCE' | 'OFFLINE';
  enabledProductsCount: number;
  dateJoined: string;
  lastActive: string;
  rawLastActive: string;
  status: SubAgentStatus;
  ordersCount: number;
  successfulOrdersCount: number;
  failedOrdersCount: number;
  totalSalesPesewas: number;
  totalCommissionPesewas: number;
  balancePesewas: number;
  totalDepositedPesewas: number;
  totalSpentPesewas: number;
  recentOrders: RecentSubAgentOrder[];
  activityLogs: Array<{ id: string; time: string; text: string }>;
}

export const SubAgentStatusBadge: React.FC<{ status: SubAgentStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="success" size={size} dot>Active</Badge>;
    case 'PENDING':
      return <Badge variant="warning" size={size} dot>Pending</Badge>;
    case 'SUSPENDED':
      return <Badge variant="danger" size={size} dot>Suspended</Badge>;
    case 'INACTIVE':
      return <Badge variant="neutral" size={size}>Inactive</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const AgentCustomersPage: React.FC = () => {
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [subAgents, setSubAgents] = useState<SubAgentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [dateFilter, setDateFilter] = useState<string>('30d');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Drawer detail state
  const [selectedAgent, setSelectedAgent] = useState<SubAgentItem | null>(null);

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('8');

  const fetchSubAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await walletApi.getSubAgents().catch(() => null);
      if (res && Array.isArray(res.subAgents)) {
        setSubAgents(res.subAgents);
      } else {
        setSubAgents([]);
      }
    } catch {
      setSubAgents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubAgents();
  }, [fetchSubAgents]);

  // KPI Calculations
  const totalSubAgents = subAgents.length;
  const activeSubAgents = subAgents.filter((a) => a.status === 'ACTIVE').length;
  const pendingSubAgents = subAgents.filter((a) => a.status === 'PENDING').length;
  const suspendedSubAgents = subAgents.filter((a) => a.status === 'SUSPENDED').length;
  const totalSalesPesewas = subAgents.reduce((acc, a) => acc + a.totalSalesPesewas, 0);
  const totalCommissionPesewas = subAgents.reduce((acc, a) => acc + a.totalCommissionPesewas, 0);
  const totalAvailableBalancePesewas = subAgents.reduce((acc, a) => acc + a.balancePesewas, 0);

  // Filter & Sort Logic (Server-side model simulated over dataset)
  const filteredSubAgents = useMemo(() => {
    let result = subAgents.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPhone = item.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        const matchesEmail = item.email.toLowerCase().includes(q);
        const matchesId = item.agentId.toLowerCase().includes(q);
        const matchesStore = item.storeName.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesId && !matchesStore) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.dateJoined).getTime() - new Date(a.dateJoined).getTime();
      if (sortBy === 'oldest') return new Date(a.dateJoined).getTime() - new Date(b.dateJoined).getTime();
      if (sortBy === 'highest_sales') return b.totalSalesPesewas - a.totalSalesPesewas;
      if (sortBy === 'lowest_sales') return a.totalSalesPesewas - b.totalSalesPesewas;
      if (sortBy === 'highest_commission') return b.totalCommissionPesewas - a.totalCommissionPesewas;
      if (sortBy === 'lowest_commission') return a.totalCommissionPesewas - b.totalCommissionPesewas;
      if (sortBy === 'most_orders') return b.ordersCount - a.ordersCount;
      if (sortBy === 'least_orders') return a.ordersCount - b.ordersCount;
      if (sortBy === 'recently_active') return new Date(b.rawLastActive).getTime() - new Date(a.rawLastActive).getTime();
      return 0;
    });

    return result;
  }, [subAgents, statusFilter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredSubAgents.length / itemsPerPage) || 1;
  const paginatedSubAgents = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredSubAgents.slice(start, start + itemsPerPage);
  }, [filteredSubAgents, page, itemsPerPage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredSubAgents.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkAction = async (action: 'activate' | 'suspend' | 'export') => {
    if (selectedIds.length === 0) return;
    if (action === 'activate') {
      const nextStatus = 'ACTIVE';
      setSubAgents((prev) => prev.map((a) => (selectedIds.includes(a.id) ? { ...a, status: nextStatus } : a)));
      toastSuccess('Sub-Agents Activated', `${selectedIds.length} sub-agents activated.`);
      Promise.allSettled(selectedIds.map((id) => walletApi.updateSubAgentStatus(id, nextStatus))).catch(() => {});
    } else if (action === 'suspend') {
      const nextStatus = 'SUSPENDED';
      setSubAgents((prev) => prev.map((a) => (selectedIds.includes(a.id) ? { ...a, status: nextStatus } : a)));
      toastInfo('Sub-Agents Suspended', `${selectedIds.length} sub-agents placed on suspension.`);
      Promise.allSettled(selectedIds.map((id) => walletApi.updateSubAgentStatus(id, nextStatus))).catch(() => {});
    } else if (action === 'export') {
      handleExport();
    }
    setSelectedIds([]);
  };

  const handleExport = () => {
    const csvHeader = 'Agent ID,Name,Email,Phone,Store Name,Orders,Total Sales,Commission,Balance,Status,Date Joined\n';
    const rows = filteredSubAgents
      .map(
        (a) =>
          `${a.agentId},${a.name},${a.email},${a.phone.replace(/\s+/g, '')},${a.storeName},${a.ordersCount},GH₵ ${(a.totalSalesPesewas / 100).toFixed(2)},GH₵ ${(a.totalCommissionPesewas / 100).toFixed(2)},GH₵ ${(a.balancePesewas / 100).toFixed(2)},${a.status},${a.dateJoined}`,
      )
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sub_agents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Export Complete', `Exported ${filteredSubAgents.length} sub-agents to CSV.`);
  };

  const handleCreateSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newEmail.trim()) {
      toastError('Required Fields', 'Please provide name, email, and phone number.');
      return;
    }

    try {
      await walletApi.createSubAgent({
        name: newName.trim(),
        email: newEmail.toLowerCase().trim(),
        phone: newPhone.trim(),
        storeName: newStoreName.trim() || undefined,
      });

      setAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewStoreName('');
      toastSuccess('Sub Agent Created', `${newName.trim()} has been enrolled as a sub-agent.`);
      fetchSubAgents();
    } catch (err: any) {
      toastError('Enrollment Failed', err.message || 'Unable to provision sub-agent account.');
    }
  };

  const handleToggleAgentStatus = async (agentId: string) => {
    const current = subAgents.find((a) => a.id === agentId);
    const nextStatus: SubAgentStatus = current?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    setSubAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          return { ...a, status: nextStatus };
        }
        return a;
      }),
    );
    if (selectedAgent && selectedAgent.id === agentId) {
      setSelectedAgent((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }
    toastInfo('Status Updated', `Sub-agent operational status changed to ${nextStatus.toLowerCase()}.`);

    try {
      await walletApi.updateSubAgentStatus(agentId, nextStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED');
    } catch {
      // Keep optimistic update or toast fallback
    }
  };

  if (!SUB_AGENTS_FEATURE_AVAILABLE) {
    return (
      <div style={{ maxWidth: '1050px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* 1. Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366F1' }}>
                AGENT PLATFORM
              </span>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>•</span>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                RESELLER HIERARCHY
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <TactileIcon icon={Users} color="primary" size="sm" />
              <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Sub Agents
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
              Build and oversee your partner reseller network with override commissions and storefront provisioning.
            </p>
          </div>

          <Badge variant="warning" size="md" dot>
            To Be Announced
          </Badge>
        </div>

        {/* 2. TBA Hero Showcase Card */}
        <Card
          style={{
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-2xl)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: 'var(--shadow-tactile-lg)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: '#6366F1',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
                }}
              >
                <Sparkles size={24} strokeWidth={2.4} />
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366F1' }}>
                  COMING SOON • TO BE ANNOUNCED
                </span>
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0' }}>
                  Sub-Agent Multi-Tier Reseller System
                </h2>
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#6366F1',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Clock size={13} />
              <span>In Staging & Rollout Preparation</span>
            </div>
          </div>

          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6) 0', maxWidth: '780px', lineHeight: 1.6 }}>
            We are finalizing the sub-agent multi-tier distribution network for ByteBeacon Agents.
            Once released, you will be able to recruit partner resellers, automatically issue branded storefronts, set custom margin tiers, and earn lifetime passive override commissions on all downstream data transactions.
          </p>

          {/* 4 Pillars of Sub-Agent Features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Users size={16} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Partner Onboarding
              </strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Enroll downstream sub-agents with instant credential generation and permissions.
              </span>
            </div>

            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Percent size={16} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Automated Overrides
              </strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Earn 5%, 8%, or 10% commission margin automatically on every bundle your sub-agents sell.
              </span>
            </div>

            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(249, 115, 22, 0.12)', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Store size={16} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Branded Sub-Stores
              </strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Equip each sub-agent with a public link, custom pricing, and mobile money payments.
              </span>
            </div>

            <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Layers size={16} />
              </div>
              <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                Real-Time Telemetry
              </strong>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                Track individual and network-wide volume, delivery tallies, and wallet balances.
              </span>
            </div>
          </div>

          {/* Action / Notification Banner */}
          <div
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366F1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Be First in Line
                </h4>
                <p style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                  This feature will be announced and made available to all agents upon official release.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => toastInfo('Sub-Agent Network', 'You will receive an in-app alert as soon as the Sub-Agent network is opened!')}
              leftIcon={<Bell size={14} />}
            >
              Notify Me On Launch
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={Users} color="primary" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Sub Agents
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage your sub-agents, monitor their activity, and track their performance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" onClick={() => setAddModalOpen(true)} leftIcon={<Plus size={15} />}>
            Add Sub Agent
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download size={14} />}>
            Export
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (7 Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Sub Agents"
          value={totalSubAgents.toString()}
          subtitle="Registered partners"
          accent="blue"
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
        />

        <MetricCard
          title="Active Sub Agents"
          value={activeSubAgents.toString()}
          subtitle="Currently transacting"
          accent="green"
          icon={<TactileIcon icon={UserCheck} color="security" size="sm" />}
        />

        <MetricCard
          title="Pending Approval"
          value={pendingSubAgents.toString()}
          subtitle="Awaiting review"
          accent="amber"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />

        <MetricCard
          title="Suspended"
          value={suspendedSubAgents.toString()}
          subtitle="Restricted access"
          accent="red"
          icon={<TactileIcon icon={Ban} color="red" size="sm" />}
        />

        <MetricCard
          title="Total Sales"
          value={`GH₵ ${(totalSalesPesewas / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Lifetime volume"
          accent="green"
          icon={<TactileIcon icon={TrendingUp} color="security" size="sm" />}
        />

        <MetricCard
          title="Total Commission"
          value={`GH₵ ${(totalCommissionPesewas / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Earned margin"
          accent="cyan"
          icon={<TactileIcon icon={DollarSign} color="analytics" size="sm" />}
        />

        <MetricCard
          title="Available Balance"
          value={`GH₵ ${(totalAvailableBalancePesewas / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Combined wallet float"
          accent="amber"
          icon={<TactileIcon icon={Wallet} color="speed" size="sm" />}
        />
      </div>

      {/* 3. Search, Filter & Bulk Actions Bar */}
      <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
            {/* Search */}
            <div style={{ minWidth: '220px', flex: 1, maxWidth: '300px' }}>
              <SearchInput
                placeholder="Search sub-agents..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Status Dropdown */}
            <div style={{ minWidth: '130px' }}>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'Status: All', value: 'ALL' },
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Suspended', value: 'SUSPENDED' },
                  { label: 'Inactive', value: 'INACTIVE' },
                ]}
              />
            </div>

            {/* Sort by Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: '170px' }}>
              <ArrowUpDown size={13} color="var(--color-text-muted)" />
              <Select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'Sort: Newest', value: 'newest' },
                  { label: 'Sort: Oldest', value: 'oldest' },
                  { label: 'Highest Sales', value: 'highest_sales' },
                  { label: 'Lowest Sales', value: 'lowest_sales' },
                  { label: 'Highest Commission', value: 'highest_commission' },
                  { label: 'Lowest Commission', value: 'lowest_commission' },
                  { label: 'Most Orders', value: 'most_orders' },
                  { label: 'Least Orders', value: 'least_orders' },
                  { label: 'Recently Active', value: 'recently_active' },
                ]}
              />
            </div>

            {/* Date Filter */}
            <div style={{ minWidth: '120px' }}>
              <Select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 Days', value: '7d' },
                  { label: 'Last 30 Days', value: '30d' },
                  { label: 'This Month', value: 'this_month' },
                ]}
              />
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-base)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-brand-border)' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 800, color: 'var(--color-brand)' }}>
                {selectedIds.length} selected
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction('activate')}>
                Activate
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction('suspend')}>
                Suspend
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction('export')}>
                Export
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Main Sub Agents Table */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filteredSubAgents.length === 0 ? (
          <Card style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'var(--color-bg-surface)' }}>
            <Users size={32} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-3) auto' }} />
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              No sub-agents found
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Try adjusting your search query or filters.
            </p>
          </Card>
        ) : (
          <>
            {/* Authoritative Sub-Agents Table (Horizontal scroll on smaller viewports) */}
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)', minWidth: '850px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', width: '36px' }}>
                      <Checkbox
                        checked={selectedIds.length === filteredSubAgents.length && filteredSubAgents.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Sub Agent</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Agent ID</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Store</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Orders</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Sales</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Commission</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Balance</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Last Active</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Loading sub-agents...
                      </td>
                    </tr>
                  ) : paginatedSubAgents.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        No sub-agents found.
                      </td>
                    </tr>
                  ) : (
                    paginatedSubAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 120ms ease',
                      }}
                      onClick={() => setSelectedAgent(agent)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(agent.id)}
                          onChange={() => handleToggleSelect(agent.id)}
                        />
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-brand-surface)', color: 'var(--color-brand)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)' }}>
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{agent.name}</strong>
                            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{agent.email}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {agent.agentId}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Store size={13} color="var(--color-primary)" />
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{agent.storeName}</span>
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                        {agent.ordersCount}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 800, color: 'var(--color-success)' }}>
                        GH₵ {(agent.totalSalesPesewas / 100).toFixed(2)}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--color-brand)' }}>
                        GH₵ {(agent.totalCommissionPesewas / 100).toFixed(2)}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--color-warning)' }}>
                        GH₵ {(agent.balancePesewas / 100).toFixed(2)}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <SubAgentStatusBadge status={agent.status} size="sm" />
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>
                        {agent.lastActive}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(agent)}>
                          View Details
                        </Button>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 'var(--space-3) 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ width: '130px' }}>
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    options={[
                      { label: '10 / page', value: '10' },
                      { label: '20 / page', value: '20' },
                      { label: '50 / page', value: '50' },
                      { label: '100 / page', value: '100' },
                    ]}
                  />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Showing {filteredSubAgents.length > 0 ? (page - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(page * itemsPerPage, filteredSubAgents.length)} of {filteredSubAgents.length} sub agents · Page {page} of {totalPages}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 5. Sub-Agent Profile Side Drawer */}
      {selectedAgent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedAgent(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              backgroundColor: 'var(--color-bg-base)',
              boxShadow: 'var(--shadow-tactile-xl)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: 'var(--space-6)',
              gap: 'var(--space-6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-brand-surface)', color: 'var(--color-brand)', fontWeight: 800, fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedAgent.name.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                      {selectedAgent.name}
                    </h2>
                    <SubAgentStatusBadge status={selectedAgent.status} size="sm" />
                  </div>
                  <span style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {selectedAgent.agentId} · Joined {selectedAgent.dateJoined}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Contact & Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant={selectedAgent.status === 'ACTIVE' ? 'outline' : 'primary'}
                size="sm"
                onClick={() => handleToggleAgentStatus(selectedAgent.id)}
              >
                {selectedAgent.status === 'ACTIVE' ? 'Suspend Access' : 'Activate Access'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(selectedAgent.phone);
                  toastSuccess('Copied', 'Phone number copied');
                }}
                leftIcon={<Phone size={13} />}
              >
                {selectedAgent.phone}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `mailto:${selectedAgent.email}`;
                }}
                leftIcon={<Mail size={13} />}
              >
                Email
              </Button>
            </div>

            {/* Performance KPIs */}
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-2)' }}>
                Performance Metrics
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Total Orders</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>{selectedAgent.ordersCount}</strong>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Successful</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-data)', color: 'var(--color-success)' }}>{selectedAgent.successfulOrdersCount}</strong>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Failed</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-data)', color: 'var(--color-danger)' }}>{selectedAgent.failedOrdersCount}</strong>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Total Sales</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>GH₵ {(selectedAgent.totalSalesPesewas / 100).toFixed(2)}</strong>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Commission</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)', color: 'var(--color-brand)' }}>GH₵ {(selectedAgent.totalCommissionPesewas / 100).toFixed(2)}</strong>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Avg Order Value</span>
                  <strong style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                    GH₵ {selectedAgent.ordersCount > 0 ? (selectedAgent.totalSalesPesewas / selectedAgent.ordersCount / 100).toFixed(2) : '0.00'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Sub-Agent Balance Breakdown */}
            <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
                <Wallet size={16} color="var(--color-warning)" />
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Wallet Balance & Ledger State
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)' }}>Current Balance</span>
                  <strong style={{ display: 'block', fontFamily: 'var(--font-data)', color: 'var(--color-warning)', fontSize: 'var(--font-size-base)' }}>
                    GH₵ {(selectedAgent.balancePesewas / 100).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)' }}>Total Deposited</span>
                  <strong style={{ display: 'block', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                    GH₵ {(selectedAgent.totalDepositedPesewas / 100).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)' }}>Total Spent</span>
                  <strong style={{ display: 'block', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                    GH₵ {(selectedAgent.totalSpentPesewas / 100).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-3xs)' }}>Total Commission Earned</span>
                  <strong style={{ display: 'block', fontFamily: 'var(--font-data)', color: 'var(--color-brand)' }}>
                    GH₵ {(selectedAgent.totalCommissionPesewas / 100).toFixed(2)}
                  </strong>
                </div>
              </div>
            </Card>

            {/* Sub-Agent Storefront */}
            <Card style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Store size={16} color="var(--color-primary)" />
                  <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                    Storefront: {selectedAgent.storeName}
                  </h3>
                </div>
                <Badge variant={selectedAgent.storeStatus === 'ONLINE' ? 'success' : 'neutral'} size="sm">
                  {selectedAgent.storeStatus}
                </Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-base)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', marginTop: 'var(--space-2)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  {typeof window !== 'undefined' && window.location?.origin
                    ? `${window.location.origin}/store/${selectedAgent.storeSlug}`
                    : `/store/${selectedAgent.storeSlug}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const fullUrl = typeof window !== 'undefined' && window.location?.origin
                      ? `${window.location.origin}/store/${selectedAgent.storeSlug}`
                      : `/store/${selectedAgent.storeSlug}`;
                    navigator.clipboard.writeText(fullUrl);
                    toastSuccess('Copied', 'Storefront link copied');
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-brand)' }}
                >
                  <Copy size={13} />
                </button>
              </div>
            </Card>

            {/* Recent Orders */}
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-2)' }}>
                Recent Order Activity
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {selectedAgent.recentOrders.map((ord) => (
                  <div key={ord.id} style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{ord.id}</strong>
                        <NetworkBadge network={ord.network} size="sm" />
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{ord.bundle}</span>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                        {ord.recipient} · {ord.source} · {ord.paymentMethod}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>{ord.amount}</strong>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{ord.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Timeline */}
            <div>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-2)' }}>
                Audit & Activity Timeline
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', borderLeft: '2px solid var(--color-border-default)', paddingLeft: 'var(--space-3)', marginLeft: '4px' }}>
                {selectedAgent.activityLogs.map((log) => (
                  <div key={log.id}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-brand)' }}>{log.time}</span>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', margin: '2px 0 0 0' }}>{log.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Add Sub Agent Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Sub Agent"
        subtitle="Provision a partner reseller account with storefront access."
      >
        <form onSubmit={handleCreateSubAgent} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Full Name"
            placeholder="e.g. Kwame Asante"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <PhoneInput
            label="Phone Number"
            placeholder="024 123 4567"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            placeholder="partner@example.com"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <Input
            label="Storefront Business Name"
            placeholder="e.g. Asante Express Hub"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
          />

          <Select
            label="Commission Tier"
            value={newCommissionRate}
            onChange={(e) => setNewCommissionRate(e.target.value)}
            options={[
              { label: 'Tier 1: 5% Commission Margin', value: '5' },
              { label: 'Tier 2: 8% Commission Margin (Standard)', value: '8' },
              { label: 'Tier 3: 10% Commission Margin (High Volume)', value: '10' },
            ]}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <Button variant="ghost" size="md" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit">
              Create Sub Agent
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
