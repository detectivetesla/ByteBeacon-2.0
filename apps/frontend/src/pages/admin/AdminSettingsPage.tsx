import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, Switch } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { ShieldAlert, Cpu } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { toastSuccess } = useToast();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [circuitThreshold, setCircuitThreshold] = useState('5');
  const [rateLimitPerMin, setRateLimitPerMin] = useState('60');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toastSuccess('System settings saved', 'Global security policies and provider configurations have been applied.');
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
          Platform Configuration
        </span>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
          Global System Settings
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Configure system rate limits, circuit breaker fallback policies, and operational maintenance controls.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Card style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} color="var(--color-primary)" />
            Carrier Gateway & Circuit Breakers
          </h2>
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

        <Card style={{ padding: 'var(--space-6)', border: maintenanceMode ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border-default)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: maintenanceMode ? 'var(--color-accent-red)' : 'var(--color-text-primary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color={maintenanceMode ? 'var(--color-accent-red)' : 'var(--color-text-secondary)'} />
            System Maintenance Mode
          </h2>
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
