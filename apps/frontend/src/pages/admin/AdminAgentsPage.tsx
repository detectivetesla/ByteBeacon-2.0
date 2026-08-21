import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { adminApi, AdminUserListItem } from '../../api/admin.api.js';
import {
  Users,
  Store,
  DollarSign,
  TrendingUp,
  Search,
  ExternalLink,
  RefreshCw,
  Eye,
  Briefcase,
} from 'lucide-react';

export const AdminAgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers({ role: 'agent', search: search.trim() || undefined, limit: 50 });
      if (res?.users) {
        setAgents(res.users);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const totalAgentWalletGhs = agents.reduce((sum, a) => sum + (a.walletBalancePesewas || 0), 0) / 100;

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Store} color="speed" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-agent-bright)' }}>
              Partner Operations & Commerce
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Agent Reseller Console
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Manage registered agents, storefront activations, wallet balances, and reseller volume across Ghana.
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchAgents} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Registered Agents"
          value={agents.length.toString()}
          subvalue="Authorized Resellers"
          accent="blue"
          icon={<TactileIcon icon={Users} color="orders" size="sm" />}
        />
        <MetricCard
          title="Combined Agent Float"
          value={`GH₵ ${totalAgentWalletGhs.toFixed(2)}`}
          subvalue="Total Float Liabilities"
          accent="green"
          icon={<TactileIcon icon={DollarSign} color="security" size="sm" />}
        />
        <MetricCard
          title="Active Reseller Stores"
          value={agents.filter(a => a.status === 'ACTIVE').length.toString()}
          subvalue="Live Storefronts"
          accent="orange"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
        />
      </div>

      {/* Agents Table Card */}
      <Card elevated accentColor="orange" style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ maxWidth: '320px', width: '100%' }}>
            <Input
              placeholder="Search by agent name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={15} color="var(--color-text-muted)" />}
            />
          </div>
        </div>

        <Table
          columns={[
            {
              header: 'Agent Name',
              accessor: 'fullName',
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                    {row.fullName || 'Unnamed Agent'}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                    {row.email}
                  </span>
                </div>
              ),
            },
            {
              header: 'Phone Number',
              accessor: 'phone',
              render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.phone || 'N/A'}</span>,
            },
            {
              header: 'Wallet Float',
              accessor: 'walletBalancePesewas',
              render: (row) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-brand)', fontSize: 'var(--font-size-xs)' }}>
                  GH₵ {((row.walletBalancePesewas || 0) / 100).toFixed(2)}
                </span>
              ),
            },
            {
              header: 'Status',
              accessor: 'status',
              render: (row) => (
                <Badge variant={row.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                  {row.status}
                </Badge>
              ),
            },
            {
              header: 'Joined Date',
              accessor: 'createdAt',
              render: (row) => (
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              ),
            },
            {
              header: 'Actions',
              accessor: 'id',
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/users/${row.id}`)}
                  leftIcon={<Eye size={13} />}
                >
                  Manage
                </Button>
              ),
            },
          ]}
          data={agents}
          keyExtractor={(item) => item.id}
          emptyText="No agents found matching your query."
        />
      </Card>
    </div>
  );
};
