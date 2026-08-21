import React, { useState } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input, Select } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { ShoppingBag, Edit3, Plus, TrendingUp, DollarSign, Layers } from 'lucide-react';

interface BundlePlan {
  id: string;
  network: NetworkProvider;
  dataAmountMb: number;
  validity: string;
  customerPriceGhs: number;
  agentPriceGhs: number;
  isActive: boolean;
}

const INITIAL_PLANS: BundlePlan[] = [
  { id: 'mtn-1', network: NetworkProvider.MTN, dataAmountMb: 1024, validity: 'Non-Expiry', customerPriceGhs: 6.0, agentPriceGhs: 3.8, isActive: true },
  { id: 'mtn-2', network: NetworkProvider.MTN, dataAmountMb: 2048, validity: 'Non-Expiry', customerPriceGhs: 12.0, agentPriceGhs: 7.6, isActive: true },
  { id: 'mtn-3', network: NetworkProvider.MTN, dataAmountMb: 3072, validity: 'Non-Expiry', customerPriceGhs: 18.0, agentPriceGhs: 11.4, isActive: true },
  { id: 'mtn-5', network: NetworkProvider.MTN, dataAmountMb: 5120, validity: 'Non-Expiry', customerPriceGhs: 28.0, agentPriceGhs: 19.0, isActive: true },
  { id: 'mtn-10', network: NetworkProvider.MTN, dataAmountMb: 10240, validity: 'Non-Expiry', customerPriceGhs: 55.0, agentPriceGhs: 38.0, isActive: true },
  { id: 'mtn-20', network: NetworkProvider.MTN, dataAmountMb: 20480, validity: 'Non-Expiry', customerPriceGhs: 100.0, agentPriceGhs: 72.0, isActive: true },
  { id: 'mtn-50', network: NetworkProvider.MTN, dataAmountMb: 51200, validity: 'Non-Expiry', customerPriceGhs: 240.0, agentPriceGhs: 175.0, isActive: true },

  { id: 'tel-2', network: NetworkProvider.TELECEL, dataAmountMb: 2048, validity: 'Non-Expiry', customerPriceGhs: 10.0, agentPriceGhs: 6.8, isActive: true },
  { id: 'tel-5', network: NetworkProvider.TELECEL, dataAmountMb: 5120, validity: 'Non-Expiry', customerPriceGhs: 24.0, agentPriceGhs: 16.5, isActive: true },
  { id: 'tel-10', network: NetworkProvider.TELECEL, dataAmountMb: 10240, validity: 'Non-Expiry', customerPriceGhs: 45.0, agentPriceGhs: 32.0, isActive: true },
  { id: 'tel-25', network: NetworkProvider.TELECEL, dataAmountMb: 25600, validity: 'Non-Expiry', customerPriceGhs: 110.0, agentPriceGhs: 78.0, isActive: true },

  { id: 'at-2', network: NetworkProvider.AIRTELTIGO, dataAmountMb: 2048, validity: 'Non-Expiry', customerPriceGhs: 8.0, agentPriceGhs: 5.5, isActive: true },
  { id: 'at-5', network: NetworkProvider.AIRTELTIGO, dataAmountMb: 5120, validity: 'Non-Expiry', customerPriceGhs: 20.0, agentPriceGhs: 14.0, isActive: true },
  { id: 'at-10', network: NetworkProvider.AIRTELTIGO, dataAmountMb: 10240, validity: 'Non-Expiry', customerPriceGhs: 38.0, agentPriceGhs: 27.0, isActive: true },
  { id: 'at-20', network: NetworkProvider.AIRTELTIGO, dataAmountMb: 20480, validity: 'Non-Expiry', customerPriceGhs: 75.0, agentPriceGhs: 52.0, isActive: true },
];

export const AdminDataPlansPage: React.FC = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [plans, setPlans] = useState<BundlePlan[]>(INITIAL_PLANS);
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [editingPlan, setEditingPlan] = useState<BundlePlan | null>(null);
  const [editCustomerPrice, setEditCustomerPrice] = useState('');
  const [editAgentPrice, setEditAgentPrice] = useState('');

  const filtered = plans.filter((p) => networkFilter === 'ALL' || p.network === networkFilter);

  const handleOpenEdit = (plan: BundlePlan) => {
    setEditingPlan(plan);
    setEditCustomerPrice(plan.customerPriceGhs.toFixed(2));
    setEditAgentPrice(plan.agentPriceGhs.toFixed(2));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const cust = parseFloat(editCustomerPrice);
    const agent = parseFloat(editAgentPrice);

    if (isNaN(cust) || cust <= 0 || isNaN(agent) || agent <= 0) {
      toastError('Invalid Pricing', 'Please enter valid positive numbers.');
      return;
    }

    if (agent >= cust) {
      toastError('Pricing Rule Violation', 'Agent wholesale price must be less than customer retail price.');
      return;
    }

    setPlans((prev) =>
      prev.map((p) =>
        p.id === editingPlan.id
          ? { ...p, customerPriceGhs: cust, agentPriceGhs: agent }
          : p
      )
    );

    toastSuccess('Catalog Updated', `Pricing for ${editingPlan.network} ${(editingPlan.dataAmountMb / 1024).toFixed(1)} GB updated.`);
    setEditingPlan(null);
  };

  const handleToggleActive = (planId: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, isActive: !p.isActive } : p))
    );
    toastSuccess('Status Changed', 'Data plan availability updated.');
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <ShoppingBag size={22} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Data Plans & Catalog Pricing
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Manage bundle catalog items, non-expiry packages, retail pricing, and wholesale agent margins across all carriers.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Active Bundle Packages"
          value={plans.filter((p) => p.isActive).length.toString()}
          subvalue={`${plans.length} total catalog packages`}
          icon={<Layers size={20} color="#3B82F6" />}
        />
        <MetricCard
          title="Supported Carriers"
          value="3 Networks"
          subvalue="MTN, Telecel, AirtelTigo"
          icon={<ShoppingBag size={20} color="#10B981" />}
        />
        <MetricCard
          title="Average Reseller Margin"
          value="34.2%"
          subvalue="Wholesale discount spread"
          icon={<TrendingUp size={20} color="#8B5CF6" />}
        />
      </div>

      {/* Plans Card */}
      <Card elevated style={{ padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO].map((net) => (
              <Button
                key={net}
                variant={networkFilter === net ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setNetworkFilter(net)}
              >
                {net === 'ALL' ? 'All Networks' : net}
              </Button>
            ))}
          </div>
        </div>

        <Table
          columns={[
            {
              header: 'Network',
              accessor: 'network',
              render: (row) => (
                <Badge
                  variant={
                    row.network === NetworkProvider.MTN
                      ? 'warning'
                      : row.network === NetworkProvider.TELECEL
                      ? 'danger'
                      : 'info'
                  }
                  size="sm"
                >
                  {row.network}
                </Badge>
              ),
            },
            {
              header: 'Data Volume',
              accessor: 'dataAmountMb',
              render: (row) => (
                <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                  {(row.dataAmountMb / 1024).toFixed(row.dataAmountMb % 1024 === 0 ? 0 : 1)} GB
                </span>
              ),
            },
            {
              header: 'Validity',
              accessor: 'validity',
              render: (row) => <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{row.validity}</span>,
            },
            {
              header: 'Customer Retail Price',
              accessor: 'customerPriceGhs',
              render: (row) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  GH₵ {row.customerPriceGhs.toFixed(2)}
                </span>
              ),
            },
            {
              header: 'Agent Wholesale Price',
              accessor: 'agentPriceGhs',
              render: (row) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-brand)', fontSize: 'var(--font-size-xs)' }}>
                  GH₵ {row.agentPriceGhs.toFixed(2)}
                </span>
              ),
            },
            {
              header: 'Reseller Margin',
              accessor: 'id',
              render: (row) => {
                const margin = row.customerPriceGhs - row.agentPriceGhs;
                const marginPct = ((margin / row.customerPriceGhs) * 100).toFixed(0);
                return (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: '#10B981', fontWeight: 700 }}>
                    +GH₵ {margin.toFixed(2)} ({marginPct}%)
                  </span>
                );
              },
            },
            {
              header: 'Status',
              accessor: 'isActive',
              render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">
                  {row.isActive ? 'ACTIVE' : 'DISABLED'}
                </Badge>
              ),
            },
            {
              header: 'Actions',
              accessor: 'id',
              render: (row) => (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(row)}
                    leftIcon={<Edit3 size={13} />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(row.id)}
                    style={{ fontSize: 'var(--font-size-2xs)' }}
                  >
                    {row.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.id}
          emptyText="No data plans found for this network."
        />
      </Card>

      {/* Edit Price Modal */}
      {editingPlan && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated style={{ maxWidth: '420px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              Edit Plan Pricing
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              {editingPlan.network} - {(editingPlan.dataAmountMb / 1024).toFixed(1)} GB Package
            </p>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                label="Customer Retail Price (GHS)"
                type="number"
                step="0.01"
                min="0.01"
                value={editCustomerPrice}
                onChange={(e) => setEditCustomerPrice(e.target.value)}
                required
              />

              <Input
                label="Agent Wholesale Price (GHS)"
                type="number"
                step="0.01"
                min="0.01"
                value={editAgentPrice}
                onChange={(e) => setEditAgentPrice(e.target.value)}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPlan(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
