import React, { useState } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { OrderHealthProgressBar } from '../../components/dashboard/OrderHealthProgressBar.js';
import {
  Server,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface SystemHealthRow {
  service: string;
  type: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  lastChecked: string;
}

const HEALTH_DATA: SystemHealthRow[] = [
  { service: 'Carrier Provisioning', type: 'Fulfillment Dispatch', status: 'UP', latencyMs: 38, lastChecked: 'Just now' },
  { service: 'Payment Rails', type: 'MoMo Gateway', status: 'UP', latencyMs: 24, lastChecked: 'Just now' },
  { service: 'PostgreSQL Ledger', type: 'Primary DB', status: 'UP', latencyMs: 2, lastChecked: 'Just now' },
  { service: 'Redis Queue & Mutex', type: 'Cache & Locks', status: 'UP', latencyMs: 1, lastChecked: 'Just now' },
];

const ADMIN_AUDIT_LOGS = [
  { id: 'aud-1', action: 'Ledger Reconciled', time: '5m ago', color: '#22C55E' },
  { id: 'aud-2', action: 'Carrier Pipeline Swapped', time: '18m ago', color: '#3B82F6' },
  { id: 'aud-3', action: 'Agent Float Approved', time: '1h ago', color: '#F59E0B' },
  { id: 'aud-4', action: 'Rate Limit Threshold Elevated', time: '3h ago', color: '#8B5CF6' },
];

export const AdminDashboard: React.FC = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <Avatar name="System Administrator" role="admin" status="online" size="md" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Control Center
              </h1>
              <span
                style={{
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-api-surface)',
                  border: '1px solid var(--color-api-border)',
                  color: 'var(--color-api)',
                  textTransform: 'uppercase',
                }}
              >
                SUPER ADMIN
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Button
            variant={maintenanceMode ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setMaintenanceMode(!maintenanceMode)}
            leftIcon={maintenanceMode ? <AlertTriangle size={14} /> : undefined}
          >
            {maintenanceMode ? 'Maintenance: Active' : 'Maintenance: Off'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => (window.location.href = '/admin/reconciliation')} leftIcon={<Zap size={14} />}>
            Match Ledger
          </Button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <MetricCard
          title="Daily Volume"
          value="GH₵ 42,180.00"
          subtitle="1,492 orders (24h)"
          accent="blue"
          icon={<TactileIcon icon={Activity} color="orders" size="sm" />}
        />

        <MetricCard
          title="Ledger Match"
          value="100%"
          subtitle="Zero discrepancies"
          accent="green"
          icon={<TactileIcon icon={ShieldCheck} color="security" size="sm" />}
        />

        <MetricCard
          title="Active SIMs"
          value="18 Lines"
          subtitle="All routes operational"
          accent="purple"
          icon={<TactileIcon icon={Server} color="api" size="sm" />}
        />

        <MetricCard
          title="Failed Queue"
          value="0"
          subtitle="Queue fully clear"
          accent="green"
          icon={<TactileIcon icon={AlertTriangle} color="speed" size="sm" />}
        />
      </div>

      {/* System Order Health */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <OrderHealthProgressBar
          data={{ delivered: 1489, pending: 3, failed: 0, total: 1492 }}
          title="Systemwide Order Health"
          badgeLabel="Live"
          tooltipText="Fulfillment telemetry across all carrier SIM gateways and agent stores."
        />
      </div>

      {/* Main Workspace: Service Health + Audit Stream */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) 320px',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left: Infrastructure Health */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Service Telemetry
            </h2>
            <Badge variant="success" dot size="sm">
              ALL SERVICES UP
            </Badge>
          </div>

          <Table<SystemHealthRow>
            columns={[
              {
                header: 'Service',
                accessor: 'service',
                render: (row) => <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{row.service}</strong>,
              },
              {
                header: 'Type',
                accessor: 'type',
                render: (row) => <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>{row.type}</span>,
              },
              {
                header: 'Status',
                accessor: 'status',
                render: () => <Badge variant="success" size="sm">Operational</Badge>,
              },
              {
                header: 'Latency',
                accessor: 'latencyMs',
                render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-brand)' }}>{row.latencyMs}ms</span>,
              },
            ]}
            data={HEALTH_DATA}
            keyExtractor={(item) => item.service}
          />
        </Card>

        {/* Right: Operations Stream */}
        <Card elevated style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operations Audit
            </h3>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand)', fontWeight: 800 }}>
              ● LIVE STREAM
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {ADMIN_AUDIT_LOGS.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 'var(--space-2)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: log.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {log.action}
                  </span>
                </div>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {log.time}
                </span>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            fullWidth
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => (window.location.href = '/admin/audit')}
          >
            Audit Log →
          </Button>
        </Card>
      </div>
    </div>
  );
};
