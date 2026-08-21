import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { FileText, RefreshCw, Eye } from 'lucide-react';
import { adminApi, AdminAuditEvent } from '../../api/admin.api.js';

export const AdminAuditPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [auditLogs, setAuditLogs] = useState<AdminAuditEvent[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<any | null>(null);

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAudit({ page, limit: 25 });
      if (res && Array.isArray(res.items)) {
        setAuditLogs(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalLogs(res.pagination?.total || res.items.length);
      } else {
        setAuditLogs([]);
        setTotalPages(1);
        setTotalLogs(0);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filtered = auditLogs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      (l.correlationId && l.correlationId.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.actorId && l.actorId.toLowerCase().includes(q)) ||
      (l.resourceType && l.resourceType.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-1)' }}>
            <FileText size={22} color="var(--color-brand)" strokeWidth={2.5} />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Security Audit Stream
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Immutable security event journal recording every administrative action, configuration change, and security event. Total: {totalLogs.toLocaleString()} events.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchAudit} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <SearchInput
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search action, correlation ID, actor..."
          />
        </div>
      </Card>

      {/* Audit Table */}
      <Table
        headers={[
          'Action',
          'Actor Type',
          'Actor ID',
          'Resource',
          'Correlation ID',
          'IP Address',
          'Timestamp',
          'Metadata',
        ]}
      >
        {filtered.map((log) => (
          <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <td>
              <Badge
                variant={
                  log.action.includes('ADMIN') || log.action.includes('SUSPEND') || log.action.includes('ROLE')
                    ? 'danger'
                    : log.action.includes('AUTH') || log.action.includes('LOGIN')
                    ? 'brand'
                    : 'neutral'
                }
                size="sm"
              >
                {log.action}
              </Badge>
            </td>
            <td>
              <Badge variant={log.actorType === 'ADMIN' ? 'brand' : 'neutral'} size="sm">
                {log.actorType}
              </Badge>
            </td>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
              {log.actorId ? `${log.actorId.slice(0, 10)}...` : 'SYSTEM'}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)' }}>
              {log.resourceType ? `${log.resourceType}/${log.resourceId ? log.resourceId.slice(0, 6) : ''}` : '—'}
            </td>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              {log.correlationId ? log.correlationId.slice(0, 12) : '—'}
            </td>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
              {log.ipAddress || '127.0.0.1'}
            </td>
            <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {log.createdAt ? new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </td>
            <td>
              {log.metadata ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMeta(log.metadata)}
                  leftIcon={<Eye size={12} />}
                  style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-2xs)' }}
                >
                  View JSON
                </Button>
              ) : (
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>None</span>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalLogs}
        itemsPerPage={25}
      />

      {/* Metadata Modal */}
      {selectedMeta && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated style={{ maxWidth: '500px', width: '100%', padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              Audit Event Metadata
            </h2>
            <pre
              style={{
                backgroundColor: 'var(--color-background)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-2xs)',
                fontFamily: 'var(--font-mono)',
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button size="sm" onClick={() => setSelectedMeta(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
