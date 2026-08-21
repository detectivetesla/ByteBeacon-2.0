import React, { useState } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Input, Switch } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import { ShieldAlert, Cpu, Settings, Shield, Sliders, Lock, Zap } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { success: toastSuccess } = useToast();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [circuitThreshold, setCircuitThreshold] = useState('5');
  const [rateLimitPerMin, setRateLimitPerMin] = useState('60');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toastSuccess('System settings saved', 'Global security policies and provider configurations have been applied.');
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <TactileIcon icon={Settings} color="indigo" size="lg" />
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-api-bright)' }}>
            Platform Governance & Policy
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Global System Settings
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Configure system rate limits, circuit breaker fallback policies, and operational maintenance controls.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Card elevated accentColor="cyan" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-4)' }}>
            <TactileIcon icon={Cpu} color="cyan" size="sm" />
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Carrier Gateway & Circuit Breakers
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.125rem 0 0' }}>
                Resiliency thresholds for DataHouse and secondary telecom adapters
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="Consecutive Error Trip Threshold"
              value={circuitThreshold}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCircuitThreshold(e.target.value)}
              hint="Number of consecutive provider timeout/5xx errors before opening circuit."
            />
            <Input
              label="Public IP Rate Limit (requests / min)"
              value={rateLimitPerMin}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRateLimitPerMin(e.target.value)}
              hint="Strict sliding-window rate limit enforced across unauthenticated endpoints."
            />
          </div>
        </Card>

        <Card elevated accentColor={maintenanceMode ? 'red' : 'purple'} style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-2)' }}>
            <TactileIcon icon={ShieldAlert} color={maintenanceMode ? 'red' : 'api'} size="sm" />
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: maintenanceMode ? 'var(--color-accent-red)' : 'var(--color-text-primary)', margin: 0 }}>
                System Maintenance Mode
              </h2>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.125rem 0 0' }}>
                Emergency checkout shutdown while administrative operations remain live
              </p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            When enabled, public purchase creation is temporarily paused while background reconciliation completes.
          </p>

          <Switch
            checked={maintenanceMode}
            onChange={(checked) => setMaintenanceMode(checked)}
            label="Enable System Maintenance"
            description="Temporarily restrict storefront & checkout operations"
          />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="md" type="submit">
            Save System Policies
          </Button>
        </div>
      </form>
    </div>
  );
};
