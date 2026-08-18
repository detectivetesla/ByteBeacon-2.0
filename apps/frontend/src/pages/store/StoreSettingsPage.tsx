import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Switch } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { Save } from 'lucide-react';

export const StoreSettingsPage: React.FC = () => {
  const { toastSuccess } = useToast();

  const [orderSmsAlerts, setOrderSmsAlerts] = useState(true);
  const [orderEmailAlerts, setOrderEmailAlerts] = useState(true);
  const [autoFulfill, setAutoFulfill] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toastSuccess('Settings Saved', 'Storefront operational preferences updated.');
    }, 500);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
          Store Configuration
        </span>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
          Store Settings
        </h1>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          Configure fulfillment automation and real-time customer purchase alerts.
        </p>
      </div>

      <Card style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-2xl)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Automation Settings */}
        <div>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Automated Fulfillment
          </h2>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 var(--space-4) 0' }}>
            Instant telecom delivery when a customer completes payment on your store.
          </p>

          <Switch
            label="Instant GMPL Automated Delivery"
            description="Fulfill bundles instantly via direct API without manual confirmation"
            checked={autoFulfill}
            onChange={() => setAutoFulfill(!autoFulfill)}
          />
        </div>

        {/* Notifications */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Order Notifications
          </h2>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', margin: '0.15rem 0 var(--space-4) 0' }}>
            Choose how you wish to be alerted when a customer places an order.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Switch
              label="SMS Alerts for New Orders"
              description="Receive an instant text message to your support phone"
              checked={orderSmsAlerts}
              onChange={() => setOrderSmsAlerts(!orderSmsAlerts)}
            />
            <Switch
              label="Email Receipts & Summaries"
              description="Send daily sales digest and transaction receipts"
              checked={orderEmailAlerts}
              onChange={() => setOrderEmailAlerts(!orderEmailAlerts)}
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="md" onClick={handleSave} isLoading={saving} leftIcon={<Save size={14} />}>
            Save Preferences
          </Button>
        </div>
      </Card>
    </div>
  );
};
