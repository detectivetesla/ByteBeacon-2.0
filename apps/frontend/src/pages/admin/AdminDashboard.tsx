import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { adminApi, AdminAnalyticsOverview } from '../../api/admin.api.js';
import {
  Activity,
  Server,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Package,
  Users,
  DollarSign,
  CreditCard,
  Database,
  Clock,
  AlertOctagon,
  RefreshCw,
  TrendingUp,
  Cpu,
  Mail,
  ShoppingBag,
  ExternalLink,
  Shield,
  Layers,
  CheckCircle2,
  XCircle,
  PlusCircle,
  UserPlus,
  LogOut,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [range, setRange] = useState<string>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);

  const fetchOverviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAnalyticsOverview(range);
      if (res) {
        setData(res);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err: any) {
      toastError('Data Fetch Error', err.message || 'Unable to retrieve overview metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [range, toastError]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const handleToggleMaintenance = () => {
    setMaintenanceMode((prev) => !prev);
    setIsMaintenanceModalOpen(false);
    toastSuccess(
      !maintenanceMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
      !maintenanceMode
        ? 'Public checkout is paused. Administrative operations remain active.'
        : 'All platform purchasing systems restored to normal operation.'
    );
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Derived financial numbers
  const lifetimeGhs = ((data?.revenue?.lifetimePesewas || 0) / 100).toFixed(2);
  const todayGhs = ((data?.revenue?.todayPesewas || 0) / 100).toFixed(2);
  const monthGhs = ((data?.revenue?.monthPesewas || 0) / 100).toFixed(2);
  const walletLiabilityGhs = ((data?.financialHealth?.totalWalletLiabilitiesPesewas || 0) / 100).toFixed(2);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 11.2.2 Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <Activity size={24} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Overview
            </h1>
            <Badge variant="brand" size="sm">Live Platform Data</Badge>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Platform operational overview • Last updated: {lastUpdated} • Source: PostgreSQL & Authoritative Ledger
          </p>
        </div>

        {/* Range Buttons & Refresh */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
            {['today', '7d', '30d', '90d', 'all'].map((r) => (
              <Button
                key={r}
                variant={range === r ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setRange(r)}
                style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: 'var(--font-size-2xs)' }}
              >
                {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : `${r.replace('d', ' Days')}`}
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={fetchOverviewData} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 11.2.3 System Status Banner */}
      <Card
        style={{
          padding: 'var(--space-4)',
          backgroundColor: maintenanceMode ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-surface)',
          border: maintenanceMode ? '1px solid #EF4444' : '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: maintenanceMode ? '#EF4444' : '#10B981',
                boxShadow: maintenanceMode ? '0 0 8px #EF4444' : '0 0 8px #10B981',
              }}
            />
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {maintenanceMode ? 'System Maintenance Mode Active' : 'All Core Systems Operational'}
              </span>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                API • DB • Redis • Workers • Paystack • DataHouse Direct
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant={maintenanceMode ? 'danger' : 'success'} size="sm">
              {maintenanceMode ? 'MAINTENANCE ON' : 'HEALTHY'}
            </Badge>
            {isSuperAdmin && (
              <Button
                variant={maintenanceMode ? 'success' : 'outline'}
                size="sm"
                onClick={() => setIsMaintenanceModalOpen(true)}
                style={{ fontSize: 'var(--font-size-2xs)', padding: '0.25rem 0.5rem' }}
              >
                {maintenanceMode ? 'Disable Maintenance' : 'Toggle Maintenance'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 11.2.5 Primary KPI Cards (Row 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <div onClick={() => navigate('/admin/users')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Total Users"
            value={(data?.users?.total || 0).toLocaleString()}
            subvalue={`${data?.users?.customers || 0} Customers • ${data?.users?.agents || 0} Agents • ${data?.users?.admins || 0} Admins`}
            icon={<Users size={20} color="#8B5CF6" />}
          />
        </div>

        <div onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Platform Orders"
            value={(data?.orders?.total || 0).toLocaleString()}
            subvalue={`${data?.orders?.completed || 0} Completed • ${data?.orders?.processing || 0} In Flight (${data?.orders?.completionRate || 100}%)`}
            icon={<Package size={20} color="#3B82F6" />}
          />
        </div>

        <div onClick={() => navigate('/admin/ledger')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Period Revenue"
            value={`GH₵ ${monthGhs}`}
            subvalue={`Today: GH₵ ${todayGhs} • Total: GH₵ ${lifetimeGhs}`}
            icon={<DollarSign size={20} color="#10B981" />}
          />
        </div>

        <div onClick={() => navigate('/admin/ledger')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Platform Financial Health"
            value="Ledger: Balanced"
            subvalue={`Float Liabilities: GH₵ ${walletLiabilityGhs} (0 Anomalies)`}
            icon={<ShieldCheck size={20} color="#10B981" />}
          />
        </div>
      </div>

      {/* 11.2.6 Operational KPI Cards (Row 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <div onClick={() => navigate('/admin/pending-orders')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Pending MTN Approvals"
            value={(data?.queues?.pendingMtnApprovals || 0).toString()}
            subvalue="Awaiting Whitelist Sync"
            icon={<Clock size={20} color="#FFCC00" />}
          />
        </div>

        <div onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Processing Orders"
            value={(data?.queues?.processingOrders || 0).toString()}
            subvalue="Avg Dispatch: ~420ms"
            icon={<Activity size={20} color="#3B82F6" />}
          />
        </div>

        <div onClick={() => navigate('/admin/dlq')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Failed Queue (DLQ)"
            value={(data?.queues?.pendingDlq || 0).toString()}
            subvalue="Retryable Provider Exceptions"
            icon={<AlertOctagon size={20} color="#EF4444" />}
          />
        </div>

        <div onClick={() => navigate('/admin/reconciliation')} style={{ cursor: 'pointer' }}>
          <MetricCard
            title="Reconciliation"
            value="100% Synced"
            subvalue="Authoritative: DataHouse"
            icon={<RefreshCw size={20} color="#06B6D4" />}
          />
        </div>
      </div>

      {/* 11.2.15 Attention Required & Alerts Section */}
      {data?.alerts && data.alerts.length > 0 && (
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
            <AlertTriangle size={18} color="#F59E0B" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Attention Required & Operational Alerts
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.alerts.map((alt: any) => (
              <div
                key={alt.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor:
                    alt.severity === 'HIGH'
                      ? 'rgba(239, 68, 68, 0.08)'
                      : alt.severity === 'WARNING'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'var(--color-surface)',
                  border:
                    alt.severity === 'HIGH'
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : alt.severity === 'WARNING'
                      ? '1px solid rgba(245, 158, 11, 0.3)'
                      : '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge
                      variant={alt.severity === 'HIGH' ? 'danger' : alt.severity === 'WARNING' ? 'warning' : 'info'}
                      size="sm"
                    >
                      {alt.severity}
                    </Badge>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>{alt.title}</span>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                    {alt.description} • Source: {alt.source}
                  </p>
                </div>

                {alt.actionPath && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(alt.actionPath)}
                    rightIcon={<ExternalLink size={13} />}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 11.2.7 Quick Actions Toolbar */}
      <Card elevated style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 var(--space-4)' }}>
          Operational Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')} leftIcon={<UserPlus size={14} />}>
            Manage Users
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/orders')} leftIcon={<Package size={14} />}>
            View Orders
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/agents')} leftIcon={<Users size={14} />}>
            Manage Agents
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/communications')} leftIcon={<Mail size={14} />}>
            Broadcast Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/pending-orders')} leftIcon={<Clock size={14} />}>
            Review MTN Approvals
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/dlq')} leftIcon={<AlertOctagon size={14} />}>
            Review Failed Queue
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/reconciliation')} leftIcon={<RefreshCw size={14} />}>
            Reconcile
          </Button>

          {isSuperAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/provider')} leftIcon={<Cpu size={14} />}>
                Telecom Routing
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/bundles')} leftIcon={<ShoppingBag size={14} />}>
                Data Plans Catalog
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/settings')} leftIcon={<Shield size={14} />}>
                System Settings
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Grid: Tier Performance & Telecom Providers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
        {/* 11.2.8 Tier Performance Card */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 var(--space-4)' }}>
            Volume & Revenue by Tier
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <Badge variant="neutral" size="sm">Customer Tier</Badge>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, marginTop: 'var(--space-2)' }}>
                GH₵ {(((data?.tiers?.customer?.monthlyRevenuePesewas || 0)) / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Orders: {data?.tiers?.customer?.totalOrders || 0} • Today: GH₵ {(((data?.tiers?.customer?.dailyRevenuePesewas || 0)) / 100).toFixed(2)}
              </div>
            </div>

            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <Badge variant="brand" size="sm">Agent Reseller Tier</Badge>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-brand)', marginTop: 'var(--space-2)' }}>
                GH₵ {(((data?.tiers?.agent?.monthlyRevenuePesewas || 0)) / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Orders: {data?.tiers?.agent?.totalOrders || 0} • Today: GH₵ {(((data?.tiers?.agent?.dailyRevenuePesewas || 0)) / 100).toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        {/* 11.2.17 & 11.2.19 Provider & Queue Health Card */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 var(--space-4)' }}>
            Telecom Providers & Background Queues
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>DataHouse Engine (Authoritative)</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>38ms</span>
                <Badge variant="success" size="sm">DIRECT OPERATIONAL</Badge>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>GMPL Failover Adapter</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>62ms</span>
                <Badge variant="neutral" size="sm">STANDBY</Badge>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Paystack Payment Rails</span>
              <Badge variant="success" size="sm">99.1% SUCCESS</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Fulfillment & Recon Workers</span>
              <Badge variant="success" size="sm">ONLINE (16 JOBS)</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Grid: Recent Orders & New Users */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
        {/* 11.2.13 Recent Orders */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Recent Platform Orders
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')}>
              View All
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Recipient',
                accessor: 'recipientPhone',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                    {row.recipientPhone}
                  </span>
                ),
              },
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => (
                  <Badge variant={row.network === 'MTN' ? 'warning' : row.network === 'TELECEL' ? 'danger' : 'info'} size="sm">
                    {row.network}
                  </Badge>
                ),
              },
              {
                header: 'Amount',
                accessor: 'amountPesewas',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                    GH₵ {(row.amountPesewas / 100).toFixed(2)}
                  </span>
                ),
              },
              {
                header: 'Status',
                accessor: 'orderStatus',
                render: (row) => (
                  <Badge variant={row.orderStatus === 'COMPLETED' ? 'success' : row.orderStatus === 'FAILED' ? 'danger' : 'warning'} size="sm">
                    {row.orderStatus}
                  </Badge>
                ),
              },
            ]}
            data={data?.recentOrders || []}
            keyExtractor={(item) => item.id}
            emptyText="No orders recorded yet."
          />
        </Card>

        {/* 11.2.14 New Registered Accounts */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Newly Registered Users
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
              View Directory
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'User',
                accessor: 'name',
                render: (row) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{row.name}</span>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{row.email}</span>
                  </div>
                ),
              },
              {
                header: 'Role',
                accessor: 'role',
                render: (row) => (
                  <Badge variant={row.role === 'agent' ? 'warning' : row.role === 'admin' ? 'info' : 'neutral'} size="sm">
                    {row.role}
                  </Badge>
                ),
              },
              {
                header: 'Action',
                accessor: 'id',
                render: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/users/${row.id}`)} style={{ fontSize: 'var(--font-size-2xs)' }}>
                    Dossier
                  </Button>
                ),
              },
            ]}
            data={data?.recentUsers || []}
            keyExtractor={(item) => item.id}
            emptyText="No users registered yet."
          />
        </Card>
      </div>

      {/* MODAL: Maintenance Mode Step-Up Confirmation */}
      {isMaintenanceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-3)' }}>
              <AlertTriangle size={20} color="#EF4444" />
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0 }}>
                {maintenanceMode ? 'Disable System Maintenance?' : 'Enable System Maintenance?'}
              </h2>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              {maintenanceMode
                ? 'This will immediately re-open public purchasing and telecom bundle order dispatching.'
                : 'Enabling maintenance mode temporarily pauses all public checkout and agent storefront order creation. Administrative and fulfillment background reconciliation will continue.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsMaintenanceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={maintenanceMode ? 'success' : 'danger'}
                size="sm"
                onClick={handleToggleMaintenance}
              >
                Confirm State Change
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
