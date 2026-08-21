import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { adminApi } from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Mail,
  Send,
  Users,
  CheckCircle,
  Clock,
  RefreshCw,
  Radio,
  Bell,
  MessageSquare,
} from 'lucide-react';

export const AdminCommunicationsPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Form state
  const [target, setTarget] = useState<'ALL' | 'CUSTOMERS' | 'AGENTS' | 'ADMINS' | 'INDIVIDUAL'>('ALL');
  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'IN_APP'>('EMAIL');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getCommunicationHistory();
      if (res?.items) {
        setHistory(res.items);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toastError('Missing Fields', 'Subject and message are required.');
      return;
    }

    if (target === 'INDIVIDUAL' && (!recipientEmail || !recipientEmail.includes('@'))) {
      toastError('Invalid Email', 'Please provide a valid recipient email address.');
      return;
    }

    setIsSending(true);
    try {
      await adminApi.sendCommunication({
        target,
        recipientEmail: target === 'INDIVIDUAL' ? recipientEmail.trim() : undefined,
        channel,
        subject: subject.trim(),
        message: message.trim(),
      });
      toastSuccess('Message Dispatched', `Broadcast successfully queued for delivery via ${channel}.`);
      setSubject('');
      setMessage('');
      setRecipientEmail('');
      fetchHistory();
    } catch (err: any) {
      toastError('Failed to Send', err.message || 'Could not queue broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Mail} color="emerald" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-bright)' }}>
              Messaging & Alerts Network
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Platform Communication Center
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Dispatch announcements, system maintenance notices, and targeted notifications to customers and agents.
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard
          title="Total Dispatched"
          value={history.length.toString()}
          subvalue="Recorded broadcasts"
          accent="blue"
          icon={<TactileIcon icon={Mail} color="orders" size="sm" />}
        />
        <MetricCard
          title="Email Gateway Relay"
          value="Resend API"
          subvalue="High-deliverability cluster"
          accent="green"
          icon={<TactileIcon icon={Send} color="security" size="sm" />}
        />
        <MetricCard
          title="Push Notification Hub"
          value="Online"
          subvalue="In-app and WebSocket streams"
          accent="purple"
          icon={<TactileIcon icon={Bell} color="api" size="sm" />}
        />
      </div>

      {/* Grid: Composer & History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1.8fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left: Message Composer */}
        <Card elevated accentColor="green" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
            <Send size={18} color="var(--color-brand)" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Compose Broadcast
            </h3>
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Target Audience</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <option value="ALL">All Active Users (Customers + Agents)</option>
                <option value="CUSTOMERS">Customers Only</option>
                <option value="AGENTS">Agents / Resellers Only</option>
                <option value="ADMINS">Administrators Only</option>
                <option value="INDIVIDUAL">Specific Individual User</option>
              </select>
            </div>

            {target === 'INDIVIDUAL' && (
              <Input
                label="Recipient Email Address"
                type="email"
                placeholder="user@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
              />
            )}

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Delivery Channel</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['EMAIL', 'IN_APP', 'SMS'].map((ch) => (
                  <Button
                    key={ch}
                    type="button"
                    variant={channel === ch ? 'primary' : 'outline'}
                    size="sm"
                    fullWidth
                    onClick={() => setChannel(ch as any)}
                  >
                    {ch.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>

            <Input
              label="Subject / Headline"
              type="text"
              placeholder="e.g. Telecel Network Maintenance Notice"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Message Body</label>
              <textarea
                rows={5}
                placeholder="Write your announcement or operational notice here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-default)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-xs)',
                  resize: 'vertical',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSending}
              rightIcon={<Send size={15} />}
            >
              Dispatch Broadcast
            </Button>
          </form>
        </Card>

        {/* Right: Dispatched History */}
        <Card elevated accentColor="blue" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>
              Recent Broadcast Receipts
            </h3>
            <Badge variant="brand" size="sm">Audit Logged</Badge>
          </div>

          <Table
            columns={[
              {
                header: 'Subject & Target',
                accessor: 'subject',
                render: (row) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{row.subject}</span>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                      To: {row.target} ({row.recipientCount} recipients)
                    </span>
                  </div>
                ),
              },
              {
                header: 'Channel',
                accessor: 'channel',
                render: (row) => <Badge variant="brand" size="sm">{row.channel}</Badge>,
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (row) => <Badge variant="success" size="sm">{row.status}</Badge>,
              },
              {
                header: 'Sent At',
                accessor: 'sentAt',
                render: (row) => (
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                    {new Date(row.sentAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
            data={history}
            keyExtractor={(item) => item.id}
            emptyText="No broadcasts dispatched yet."
          />
        </Card>
      </div>
    </div>
  );
};
