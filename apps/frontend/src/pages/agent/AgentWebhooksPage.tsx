import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input } from '../../components/ui/index.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { Webhook, Send, Eye, EyeOff, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

interface WebhookDeliveryLog {
  id: string;
  event: string;
  url: string;
  statusCode: number;
  time: string;
}

const SAMPLE_DELIVERIES: WebhookDeliveryLog[] = [
  { id: '1', event: 'order.fulfilled', url: 'https://api.mystore.com/webhooks/bytebeacon', statusCode: 200, time: '29 mins ago' },
  { id: '2', event: 'order.created', url: 'https://api.mystore.com/webhooks/bytebeacon', statusCode: 200, time: '30 mins ago' },
  { id: '3', event: 'wallet.debited', url: 'https://api.mystore.com/webhooks/bytebeacon', statusCode: 200, time: '2 hours ago' },
];

export const AgentWebhooksPage: React.FC = () => {
  const { toastSuccess } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('https://api.mystore.com/webhooks/bytebeacon');
  const [signingSecret] = useState('whsec_984f1092a83b27c65d4e10294819a8bc');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLog[]>(SAMPLE_DELIVERIES);

  const handleTestWebhook = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setDeliveries((prev) => [
        {
          id: String(Date.now()),
          event: 'test.ping',
          url: webhookUrl,
          statusCode: 200,
          time: 'Just now',
        },
        ...prev,
      ]);
      toastSuccess('Webhook Dispatched', 'Test payload delivered with HTTP 200 OK.');
    }, 600);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toastSuccess('Webhook Saved', 'Your endpoint URL and signing secret are active.');
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EC4899' }}>
          Developer Tools
        </span>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0' }}>
          Webhook Endpoints & Events
        </h1>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          Receive real-time signed HTTP notifications for order fulfillment, wallet deductions, and refunds.
        </p>
      </div>

      {/* Webhook Configuration Form */}
      <Card elevated style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TactileIcon icon={Webhook} color="api" size="sm" />
          Endpoint Configuration
        </h2>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Webhook Destination URL (HTTPS)"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            hint="Must support POST requests and return HTTP 200 OK."
            placeholder="https://api.yourdomain.com/webhooks"
          />

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
              Signing Secret (HMAC-SHA256)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input
                  type={showSecret ? 'text' : 'password'}
                  readOnly
                  value={signingSecret}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <Button type="button" variant="outline" size="md" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  navigator.clipboard.writeText(signingSecret);
                  toastSuccess('Secret Copied', 'Signing secret copied to clipboard.');
                }}
              >
                <Copy size={16} />
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'var(--space-2)' }}>
            <Button type="submit" variant="primary" size="sm">
              Save Webhook Configuration
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleTestWebhook} isLoading={testing} leftIcon={<Send size={14} />}>
              Send Test Event
            </Button>
          </div>
        </form>
      </Card>

      {/* Delivery Log Table */}
      <Card elevated style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Recent Delivery History
          </h2>
          <Badge variant="success" dot size="sm">
            DISPATCH ACTIVE
          </Badge>
        </div>

        <Table<WebhookDeliveryLog>
          columns={[
            {
              header: 'Event',
              accessor: 'event',
              render: (row) => <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{row.event}</strong>,
            },
            {
              header: 'Endpoint URL',
              accessor: 'url',
              render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>{row.url}</span>,
            },
            {
              header: 'HTTP Status',
              accessor: 'statusCode',
              render: (row) => <Badge variant={row.statusCode === 200 ? 'success' : 'danger'} size="sm">{row.statusCode} OK</Badge>,
            },
            {
              header: 'Timestamp',
              accessor: 'time',
              render: (row) => <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>{row.time}</span>,
            },
          ]}
          data={deliveries}
          keyExtractor={(item) => item.id}
        />
      </Card>
    </div>
  );
};
