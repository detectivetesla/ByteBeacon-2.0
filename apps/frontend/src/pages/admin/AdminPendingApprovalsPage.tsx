import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Clock,
  CheckCircle2,
  AlertOctagon,
  Activity,
  RefreshCw,
  Download,
  Phone,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Server,
  Zap,
} from 'lucide-react';
import { adminApi, AdminPendingApprovalItem, AdminPendingApprovalStats, AdminPendingApprovalDetail } from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';

export const AdminPendingApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  // Query State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [networkFilter, setNetworkFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Data State
  const [items, setItems] = useState<AdminPendingApprovalItem[]>([]);
  const [stats, setStats] = useState<AdminPendingApprovalStats>({
    awaitingApproval: 0,
    approvedToday: 0,
    rejected: 0,
    processing: 0,
    syncFailed: 0,
    affectedOrders: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Selected Detail Modal State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminPendingApprovalDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSyncingSingle, setIsSyncingSingle] = useState(false);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getPendingApprovalStats();
      if (res) setStats(res);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch approvals list
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getPendingApprovals({
        page,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
      });

      if (res && Array.isArray(res.items)) {
        setItems(res.items);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || res.items.length);
      } else {
        setItems([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to load pending beneficiary approvals');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, networkFilter, toastError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Fetch individual detail
  const fetchDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getPendingApprovalDetail(id);
      if (res) setDetail(res);
    } catch (err: any) {
      toastError(err?.message || 'Failed to load beneficiary details');
      setSelectedId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, fetchDetail]);

  // Actions
  const handleSyncSingle = async (id: string) => {
    setIsSyncingSingle(true);
    try {
      await adminApi.syncPendingApproval(id);
      toastSuccess('Background synchronization job queued for beneficiary.');
      if (selectedId === id) fetchDetail(id);
      fetchApprovals();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to synchronize beneficiary with DataHouse.');
    } finally {
      setIsSyncingSingle(false);
    }
  };

  const handleBulkSyncAll = async () => {
    if (items.length === 0) return;
    setIsBulkSyncing(true);
    try {
      const ids = items.map((it) => it.id);
      const res = await adminApi.bulkSyncPendingApprovals(ids);
      toastSuccess(`Queued bulk synchronization for ${res.syncedCount} beneficiaries.`);
      fetchApprovals();
      fetchStats();
    } catch {
      toastError('Failed to execute bulk synchronization.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await adminApi.approveBeneficiaryApproval(id);
      toastSuccess(`Beneficiary approved. ${res?.enqueuedOrders || 0} affected orders released to fulfillment queue.`);
      if (selectedId === id) fetchDetail(id);
      fetchApprovals();
      fetchStats();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to approve beneficiary.');
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    setIsRejecting(true);
    try {
      await adminApi.rejectBeneficiaryApproval(selectedId, rejectReason.trim());
      toastSuccess('Beneficiary marked as rejected.');
      setIsRejectModalOpen(false);
      setRejectReason('');
      fetchDetail(selectedId);
      fetchApprovals();
      fetchStats();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to reject beneficiary.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await adminApi.exportPendingApprovals();
      toastSuccess('Beneficiary approvals exported successfully.');
    } catch {
      toastError('Failed to export beneficiary approvals.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
      case 'APPROVED':
        return <Badge variant="success" size="sm" dot>Approved</Badge>;
      case 'PENDING':
      case 'VALIDATING':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'PROCESSING':
        return <Badge variant="info" size="sm" dot>Syncing</Badge>;
      case 'INVALID':
      case 'REJECTED':
        return <Badge variant="danger" size="sm" dot>Rejected</Badge>;
      case 'SYNC_FAILED':
        return <Badge variant="danger" size="sm" dot>Sync Failed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Clock} color="speed" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-speed-bright)' }}>
                Telecom Validation Operations
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Pending MTN Approvals
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Track, synchronize, and administer MTN beneficiary numbers that require validation before fulfillment.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={() => { fetchStats(); fetchApprovals(); }} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkSyncAll} disabled={isBulkSyncing || items.length === 0}>
            <Zap size={14} className={isBulkSyncing ? 'animate-spin' : ''} />
            <span>Sync Page Batch</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            <Download size={14} />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* 6 Responsive Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Awaiting Approval"
          value={stats.awaitingApproval.toLocaleString()}
          subvalue="Current unresolved"
          accent="orange"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
        <MetricCard
          title="Approved Today"
          value={stats.approvedToday.toLocaleString()}
          subvalue="Validated beneficiaries"
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />
        <MetricCard
          title="Rejected"
          value={stats.rejected.toLocaleString()}
          subvalue="Invalidated numbers"
          accent="red"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
        />
        <MetricCard
          title="In-Flight Sync"
          value={stats.processing.toLocaleString()}
          subvalue="Background BullMQ"
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Sync Failed"
          value={stats.syncFailed.toLocaleString()}
          subvalue="Carrier timeout"
          accent="red"
          icon={<TactileIcon icon={Server} color="red" size="sm" />}
        />
        <MetricCard
          title="Affected Orders"
          value={stats.affectedOrders.toLocaleString()}
          subvalue="Blocked orders in queue"
          accent={stats.affectedOrders > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={ShieldCheck} color={stats.affectedOrders > 0 ? 'red' : 'security'} size="sm" />}
        />
      </div>

      {/* Filter Toolbar */}
      <Card accentColor="orange" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 320px', minWidth: '240px' }}>
            <SearchInput
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Phone (024XXXXXXX / 23324XXXXXXX), DataHouse Ref..."
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Awaiting Approval', value: 'PENDING' },
                { label: 'Approved (Valid)', value: 'VALID' },
                { label: 'Rejected (Invalid)', value: 'INVALID' },
                { label: 'Processing', value: 'PROCESSING' },
              ]}
            />

            <Select
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Networks', value: 'ALL' },
                { label: 'MTN Ghana', value: 'MTN' },
                { label: 'Telecel Ghana', value: 'TELECEL' },
                { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Approvals Table */}
      <Card elevated style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={[
            'Beneficiary Number',
            'Network',
            'Occurrences / Orders',
            'DataHouse Ref',
            'Approval Status',
            'First Detected',
            'Expires At',
            'Actions',
          ]}
        >
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-brand)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {item.phoneNumber}
                </button>
              </td>
              <td>
                <NetworkBadge network={item.network as any} />
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                <span style={{ padding: '0.15rem 0.5rem', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                  {item.occurrences || 0} Orders
                </span>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {item.providerReference || 'Pending Sync'}
              </td>
              <td>
                {renderStatusBadge(item.status)}
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {new Date(item.createdAt).toLocaleString()}
              </td>
              <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncSingle(item.id)}
                    title="Queue DataHouse Sync"
                  >
                    <Zap size={12} />
                  </Button>
                  {item.status !== 'VALID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                      title="Approve & Release Orders"
                    >
                      <CheckCircle2 size={12} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <ChevronRight size={12} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>

        {items.length === 0 && !isLoading && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Phone size={36} style={{ margin: '0 auto var(--space-2)' }} />
            <p style={{ fontWeight: 600, margin: 0 }}>No pending beneficiary approvals matching query.</p>
          </div>
        )}

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {items.length} of {totalItems.toLocaleString()} beneficiaries
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Beneficiary Details Modal */}
      {selectedId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedId(null)}
          title={`Beneficiary Approval Details — ${detail?.record?.phoneNumber || ''}`}
        >
          {isLoadingDetail ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <p>Loading beneficiary record...</p>
            </div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Quick Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{detail.record.phoneNumber}</span>
                  <NetworkBadge network={detail.record.network as any} />
                  {renderStatusBadge(detail.record.status)}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncSingle(detail.record.id)}
                    disabled={isSyncingSingle}
                  >
                    <Zap size={12} className={isSyncingSingle ? 'animate-spin' : ''} />
                    <span>Sync with DataHouse</span>
                  </Button>

                  {detail.record.status !== 'VALID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApprove(detail.record.id)}
                      style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                    >
                      <CheckCircle2 size={12} />
                      <span>Approve & Release Orders</span>
                    </Button>
                  )}

                  {detail.record.status !== 'INVALID' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setIsRejectModalOpen(true)}
                    >
                      <AlertOctagon size={12} />
                      <span>Reject Number</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Automatic Order Release Notice */}
              <div style={{ padding: 'var(--space-3)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ShieldCheck size={16} color="var(--color-brand)" />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)', fontWeight: 600 }}>
                  Automatic Release Pipeline: When approved, blocked orders transition from AWAITING_APPROVAL $\rightarrow$ SUBMITTED and are automatically queued for fulfillment with DataHouse.
                </span>
              </div>

              {/* Affected Orders Table */}
              <Card style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                  Affected Blocked Orders ({detail.affectedOrders.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {detail.affectedOrders.map((ord) => (
                    <div key={ord.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', padding: '0.5rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginRight: '0.5rem' }}>{ord.id.slice(0, 10)}...</span>
                        <span>{ord.userName} ({ord.userEmail})</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>{(ord.dataAmountMb / 1024).toFixed(1)} GB</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>GH₵ {(ord.amountPesewas / 100).toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedId(null);
                            navigate(`/admin/orders?search=${ord.id}`);
                          }}
                        >
                          <span>Inspect Order</span>
                          <ExternalLink size={10} />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {detail.affectedOrders.length === 0 && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>No active orders currently blocked by this beneficiary validation.</p>
                  )}
                </div>
              </Card>
            </div>
          ) : null}
        </Modal>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRejectModalOpen(false)}
          title={`Reject Beneficiary — ${detail?.record?.phoneNumber}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              Rejecting this beneficiary number prevents automatic fulfillment and allows affected orders to be evaluated for refunds.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for carrier rejection..."
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
