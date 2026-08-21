import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Select } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Cpu, RefreshCw, ShieldAlert, CheckCircle2, ArrowRight, Zap, Radio, Server, Activity } from 'lucide-react';
import { adminApi } from '../../api/admin.api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export const AdminProviderPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [providers, setProviders] = useState<any[]>([]);
  const [routing, setRouting] = useState<Record<string, { primary: string; fallback: string }>>({});
  const [health, setHealth] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingRouting, setIsUpdatingRouting] = useState(false);

  // Routing edit state
  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [selectedPrimary, setSelectedPrimary] = useState('DataHouse');
  const [selectedFallback, setSelectedFallback] = useState('GMPL');

  const fetchProviderData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [provRes, healthRes] = await Promise.all([
        adminApi.getProviders(),
        adminApi.getHealth().catch(() => null),
      ]);

      if (provRes?.providers) {
        setProviders(provRes.providers);
      }
      if (provRes?.routing) {
        setRouting(provRes.routing);
        if (provRes.routing[selectedNetwork]) {
          setSelectedPrimary(provRes.routing[selectedNetwork].primary || 'DataHouse');
          setSelectedFallback(provRes.routing[selectedNetwork].fallback || 'NONE');
        }
      }
      if (healthRes) {
        setHealth(healthRes);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    fetchProviderData();
  }, [fetchProviderData]);

  const handleUpdateRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'super_admin') {
      toastError('Unauthorized', 'Only Super Administrators can modify telecom carrier routing rules.');
      return;
    }

    setIsUpdatingRouting(true);
    try {
      await adminApi.updateProviderRouting({
        network: selectedNetwork,
        primaryProvider: selectedPrimary,
        fallbackProvider: selectedFallback === 'NONE' ? undefined : selectedFallback,
      });
      toastSuccess('Routing Updated', `Fulfillment routing for ${selectedNetwork} successfully switched.`);
      fetchProviderData();
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not update carrier routing.');
    } finally {
      setIsUpdatingRouting(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Cpu} color="cyan" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-analytics-bright)' }}>
              Telecom Infrastructure
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Telecom Routing & Provider Gateways
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative telecom dispatch adapters, health probes, circuit breaker states, and failover routing.
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchProviderData} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Provider Adapters Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {providers.map((p) => (
          <Card key={p.name} elevated accentColor={p.isAuthoritative ? 'blue' : 'purple'} style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <TactileIcon icon={Server} color={p.isAuthoritative ? 'orders' : 'api'} size="sm" />
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0 }}>
                  {p.name}
                </h3>
              </div>
              <Badge variant={p.status === 'HEALTHY' ? 'success' : 'danger'} size="sm">
                {p.status}
              </Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Environment</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.environment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Authoritative Status</span>
                <span style={{ fontWeight: 700, color: p.isAuthoritative ? 'var(--color-brand)' : 'var(--color-text-secondary)' }}>
                  {p.isAuthoritative ? 'Direct Authoritative' : 'Secondary Adapter'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Supported Networks</span>
                <span style={{ fontWeight: 700 }}>{p.supportedNetworks?.join(', ') || 'MTN, TELECEL, AIRTELTIGO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Circuit Breaker</span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>CLOSED (Normal Dispatch)</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dynamic Routing Manager Card */}
      <Card elevated accentColor="cyan" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0 }}>
              Carrier Routing & Failover Configuration
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
              Configure primary and automatic fallback providers per telecom carrier.
            </p>
          </div>
          {!isSuperAdmin && (
            <Badge variant="warning" size="sm">Super Admin Read-Only</Badge>
          )}
        </div>

        {/* Current Active Rules Table */}
        <div style={{ marginBottom: 'var(--space-6)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Network Carrier</th>
                <th style={{ padding: '0.5rem' }}>Primary Adapter</th>
                <th style={{ padding: '0.5rem' }}>Failover Adapter</th>
                <th style={{ padding: '0.5rem' }}>Circuit State</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(routing).map(([net, cfg]) => (
                <tr key={net} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800 }}>
                    <Badge variant={net === 'MTN' ? 'warning' : net === 'TELECEL' ? 'danger' : 'info'} size="sm">
                      {net}
                    </Badge>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--color-brand)' }}>
                    {cfg.primary}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-secondary)' }}>
                    {cfg.fallback || 'NONE'}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <Badge variant="success" size="sm">ACTIVE</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modify Routing Form (Super Admin) */}
        {isSuperAdmin && (
          <form onSubmit={handleUpdateRouting} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', alignItems: 'end', backgroundColor: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Carrier</label>
              <select
                value={selectedNetwork}
                onChange={(e) => {
                  const net = e.target.value;
                  setSelectedNetwork(net);
                  if (routing[net]) {
                    setSelectedPrimary(routing[net].primary || 'DataHouse');
                    setSelectedFallback(routing[net].fallback || 'NONE');
                  }
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
              >
                <option value="MTN">MTN Ghana</option>
                <option value="TELECEL">Telecel Ghana</option>
                <option value="AIRTELTIGO">AirtelTigo (AT)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Primary Adapter</label>
              <select
                value={selectedPrimary}
                onChange={(e) => setSelectedPrimary(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
              >
                <option value="DataHouse">DataHouse (Authoritative Direct)</option>
                <option value="GMPL">GMPL Provider</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Fallback Adapter</label>
              <select
                value={selectedFallback}
                onChange={(e) => setSelectedFallback(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
              >
                <option value="NONE">None (Strict Direct)</option>
                <option value="GMPL">GMPL Provider</option>
                <option value="DataHouse">DataHouse</option>
              </select>
            </div>

            <Button type="submit" variant="primary" size="md" isLoading={isUpdatingRouting}>
              Save Rule
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
