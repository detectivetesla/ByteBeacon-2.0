import React, { useState } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Download } from 'lucide-react';

interface AuditRow {
  id: string;
  correlationId: string;
  actor: string;
  actorType: 'ADMIN' | 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  action: string;
  resource: string;
  ipAddress: string;
  timestamp: string;
}

const SAMPLE_AUDIT_LOGS: AuditRow[] = [
  { id: '1', correlationId: 'req_84920194', actor: 'dev.admin@bytebeacon.local', actorType: 'ADMIN', action: 'ADMIN_RECONCILE_CARRIERS', resource: 'reconciliation', ipAddress: '127.0.0.1', timestamp: 'Today, 14:20:11' },
  { id: '2', correlationId: 'req_84920188', actor: 'dev.customer@bytebeacon.local', actorType: 'CUSTOMER', action: 'DEV_AUTH_LOGIN', resource: 'users/usr_dev_customer', ipAddress: '127.0.0.1', timestamp: 'Today, 14:12:00' },
  { id: '3', correlationId: 'req_84920150', actor: 'SYSTEM', actorType: 'SYSTEM', action: 'ASYNC_ORDER_PROVISIONED', resource: 'orders/BB-1029', ipAddress: '127.0.0.1', timestamp: 'Today, 14:12:05' },
  { id: '4', correlationId: 'req_84920110', actor: 'dev.agent@bytebeacon.local', actorType: 'AGENT', action: 'DEV_AUTH_LOGIN', resource: 'users/usr_dev_agent', ipAddress: '127.0.0.1', timestamp: 'Today, 13:40:02' },
];

export const AdminAuditPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = SAMPLE_AUDIT_LOGS.filter(
    (l) =>
      l.correlationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Compliance & Forensics
          </span>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
            Security Audit Trail
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Immutable security log recording all administrative actions, authentication attempts, and system state transitions.
          </p>
        </div>

        <Button variant="outline" size="sm" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Download size={16} />
          Export Audit Trail
        </Button>
      </div>

      {/* Filter */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <SearchInput
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by correlation ID, actor, or action..."
          />
        </div>
      </Card>

      {/* Table */}
      <Table headers={['Correlation ID', 'Actor Identity', 'Actor Type', 'Security Action', 'Resource Affected', 'IP Address', 'Timestamp']}>
        {filtered.map((log) => (
          <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
              {log.correlationId}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{log.actor}</td>
            <td>
              <Badge variant={log.actorType === 'ADMIN' ? 'danger' : log.actorType === 'SYSTEM' ? 'neutral' : 'info'}>
                {log.actorType}
              </Badge>
            </td>
            <td style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{log.action}</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{log.resource}</td>
            <td style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)' }}>{log.ipAddress}</td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{log.timestamp}</td>
          </tr>
        ))}
      </Table>

      <Pagination
        currentPage={page}
        totalPages={1}
        onPageChange={setPage}
        totalItems={filtered.length}
        itemsPerPage={10}
      />
    </div>
  );
};
