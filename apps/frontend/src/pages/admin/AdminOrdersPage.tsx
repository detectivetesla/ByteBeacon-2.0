import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Table, Pagination } from '../../components/ui/Table/Table.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Badge, NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  Download,
  RefreshCw,
  Package,
  CheckCircle2,
  Activity,
  AlertOctagon,
  Clock,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Server,
  Zap,
} from 'lucide-react';
import { adminApi, AdminOrderListItem, AdminOrderStats, AdminOrderDetail } from '../../api/admin.api.js';
import { useToast } from '../../context/ToastContext.js';

export const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toastSuccess, toastError } = useToast();

  // Query state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [lifecycleFilter, setLifecycleFilter] = useState(searchParams.get('lifecycle') || 'ALL');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') || 'ALL');
  const [networkFilter, setNetworkFilter] = useState(searchParams.get('network') || 'ALL');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') || 'ALL');
  const [operationalStateFilter, setOperationalStateFilter] = useState(searchParams.get('state') || 'ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Data state
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [stats, setStats] = useState<AdminOrderStats>({
    totalOrders: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    refunded: 0,
    awaitingApproval: 0,
    syncIssues: 0,
    reconciliationRequired: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Selected Order Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('orderId') || null);
  const [orderDetail, setOrderDetail] = useState<AdminOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Reconcile & Retry loading
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getOrderStats();
      if (res) setStats(res);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch orders list
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOrders({
        page,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        lifecycle: lifecycleFilter !== 'ALL' ? lifecycleFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        period: periodFilter !== 'ALL' ? periodFilter : undefined,
        operationalState: operationalStateFilter !== 'ALL' ? operationalStateFilter : undefined,
      });

      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalOrders(res.pagination?.total || res.orders.length);
      } else {
        setOrders([]);
        setTotalPages(1);
        setTotalOrders(0);
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to load platform orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, lifecycleFilter, paymentFilter, networkFilter, periodFilter, operationalStateFilter, toastError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch individual order detail
  const fetchOrderDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await adminApi.getOrderDetail(id);
      if (res) {
        setOrderDetail(res);
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to retrieve order details');
      setSelectedOrderId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetail(selectedOrderId);
    } else {
      setOrderDetail(null);
    }
  }, [selectedOrderId, fetchOrderDetail]);

  // Actions
  const handleExport = async (format: 'CSV' | 'JSON') => {
    setIsExporting(true);
    try {
      await adminApi.exportOrders({ format });
      toastSuccess(`Orders export (${format}) downloaded successfully.`);
    } catch {
      toastError('Failed to generate orders export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReconcileOrder = async () => {
    if (!selectedOrderId) return;
    setIsReconciling(true);
    try {
      await adminApi.reconcileOrder(selectedOrderId);
      toastSuccess(`Reconciliation completed for Order [${selectedOrderId}].`);
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Order reconciliation failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRetryOrder = async () => {
    if (!selectedOrderId) return;
    setIsRetrying(true);
    try {
      await adminApi.retryOrder(selectedOrderId);
      toastSuccess(`Order [${selectedOrderId}] queued for fulfillment retry.`);
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to retry order fulfillment.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrderId || !refundReason.trim()) return;
    setIsRefunding(true);
    try {
      await adminApi.refundOrder(selectedOrderId, refundReason.trim());
      toastSuccess(`Order [${selectedOrderId}] successfully refunded.`);
      setIsRefundModalOpen(false);
      setRefundReason('');
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toastError(err?.message || 'Failed to issue refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  const renderOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'FULFILLED':
        return <Badge variant="success" size="sm" dot>Fulfilled</Badge>;
      case 'PROCESSING':
      case 'SUBMITTED':
        return <Badge variant="info" size="sm" dot>Processing</Badge>;
      case 'PENDING':
      case 'CREATED':
        return <Badge variant="neutral" size="sm" dot>Pending</Badge>;
      case 'AWAITING_APPROVAL':
        return <Badge variant="warning" size="sm" dot>Awaiting MTN</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm" dot>Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm" dot>Refunded</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const renderPaymentBadge = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'VERIFIED':
      case 'SUCCESS':
        return <Badge variant="success" size="sm">Paid</Badge>;
      case 'INITIATED':
      case 'AUTHORIZED':
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm">Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="neutral" size="sm">Refunded</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status || 'Unpaid'}</Badge>;
    }
  };

  const renderProviderStatusBadge = (status: string | null | undefined) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
      case 'FULFILLED':
      case 'DELIVERED':
      case 'SUCCESS':
        return <Badge variant="success" size="sm" dot>Fulfilled</Badge>;
      case 'PROCESSING':
      case 'RECEIVED':
      case 'SUBMITTED':
      case 'ACCEPTED':
        return <Badge variant="info" size="sm" dot>Dispatched</Badge>;
      case 'PENDING':
      case 'QUEUED':
        return <Badge variant="warning" size="sm" dot>Queued</Badge>;
      case 'FAILED':
      case 'REJECTED':
      case 'ERROR':
        return <Badge variant="danger" size="sm" dot>Rejected</Badge>;
      case 'UNKNOWN':
      case '':
        return <Badge variant="neutral" size="sm" dot>Pending Dispatch</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Package} color="orders" size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand)' }}>
                Operations Control Plane
              </span>
              <Badge variant="brand" size="sm">Phase 11.5</Badge>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              All System Orders
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Manage, investigate, reconcile, and audit every data bundle transaction across ByteBeacon 2.0.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={() => { fetchStats(); fetchOrders(); }} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('CSV')} disabled={isExporting}>
            <Download size={14} />
            <span>Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('JSON')} disabled={isExporting}>
            <Download size={14} />
            <span>Export JSON</span>
          </Button>
        </div>
      </div>

      {/* 8 Responsive Operational Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          subvalue="Recorded in platform"
          accent="blue"
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
        />
        <MetricCard
          title="In-Flight Processing"
          value={stats.processing.toLocaleString()}
          subvalue="Awaiting telecom ACK"
          accent="cyan"
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
        />
        <MetricCard
          title="Completed Deliveries"
          value={stats.completed.toLocaleString()}
          subvalue="Authoritative fulfillment"
          accent="green"
          icon={<TactileIcon icon={CheckCircle2} color="security" size="sm" />}
        />
        <MetricCard
          title="Failed Dispatches"
          value={stats.failed.toLocaleString()}
          subvalue="DLQ / Retry candidates"
          accent="red"
          icon={<TactileIcon icon={AlertOctagon} color="red" size="sm" />}
        />
        <MetricCard
          title="Resolved Refunds"
          value={stats.refunded.toLocaleString()}
          subvalue="Ledger reversed"
          accent="purple"
          icon={<TactileIcon icon={RotateCcw} color="orders" size="sm" />}
        />
        <MetricCard
          title="Awaiting MTN Approvals"
          value={stats.awaitingApproval.toLocaleString()}
          subvalue="Beneficiary validation"
          accent="orange"
          icon={<TactileIcon icon={Clock} color="speed" size="sm" />}
        />
        <MetricCard
          title="Sync Issues"
          value={stats.syncIssues.toLocaleString()}
          subvalue="Provider lag detected"
          accent="orange"
          icon={<TactileIcon icon={Server} color="speed" size="sm" />}
        />
        <MetricCard
          title="Recon Required"
          value={stats.reconciliationRequired.toLocaleString()}
          subvalue="State divergence detected"
          accent={stats.reconciliationRequired > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={ShieldCheck} color={stats.reconciliationRequired > 0 ? 'red' : 'security'} size="sm" />}
        />
      </div>

      {/* Advanced Filter Toolbar */}
      <Card accentColor="blue" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 320px', minWidth: '240px' }}>
              <SearchInput
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Order ID, Phone, Customer Email/Name, DataHouse Ref..."
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

              <Select
                value={lifecycleFilter}
                onChange={(e) => {
                  setLifecycleFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Lifecycles', value: 'ALL' },
                  { label: 'Fulfilled / Completed', value: 'COMPLETED' },
                  { label: 'Processing', value: 'PROCESSING' },
                  { label: 'Submitted', value: 'SUBMITTED' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Awaiting MTN Approval', value: 'AWAITING_APPROVAL' },
                  { label: 'Failed', value: 'FAILED' },
                  { label: 'Refunded', value: 'REFUNDED' },
                ]}
              />

              <Select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Payments', value: 'ALL' },
                  { label: 'Paid / Verified', value: 'PAID' },
                  { label: 'Unpaid / Pending', value: 'UNPAID' },
                  { label: 'Failed', value: 'FAILED' },
                  { label: 'Refunded', value: 'REFUNDED' },
                ]}
              />

              <Select
                value={operationalStateFilter}
                onChange={(e) => {
                  setOperationalStateFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Operational States', value: 'ALL' },
                  { label: '⚠ Reconciliation Required', value: 'RECONCILIATION_REQUIRED' },
                  { label: '⌛ Awaiting Approval', value: 'AWAITING_APPROVAL' },
                  { label: '❌ Failed Queue', value: 'FAILED_QUEUE' },
                  { label: '↺ Refund Pending', value: 'REFUND_PENDING' },
                ]}
              />

              <Select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Time', value: 'ALL' },
                  { label: 'Today', value: 'TODAY' },
                  { label: 'Yesterday', value: 'YESTERDAY' },
                  { label: 'Last 7 Days', value: '7D' },
                  { label: 'Last 30 Days', value: '30D' },
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card elevated style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={[
            'Order ID',
            'Customer',
            'Recipient Phone',
            'Network',
            'Data Size',
            'Amount (GHS)',
            'Payment',
            'Order Status',
            'Provider Status',
            'Created At',
            'Action',
          ]}
        >
          {orders.map((order) => {
            const amountGhs = ((order.amountPesewas || 0) / 100).toFixed(2);
            const bundleGb = (order.dataAmountMb / 1024).toFixed(1);

            return (
              <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  <button
                    onClick={() => setSelectedOrderId(order.id)}
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
                    {order.id.slice(0, 10)}...
                  </button>
                </td>
                <td style={{ fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button
                      onClick={() => navigate(`/admin/users/${order.userId}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span>{order.userName || 'Customer'}</span>
                      <ExternalLink size={10} color="var(--color-text-muted)" />
                    </button>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {order.userEmail || '—'}
                    </span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {order.recipientPhone}
                </td>
                <td>
                  <NetworkBadge network={order.network as any} />
                </td>
                <td style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                  {bundleGb} GB
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  GH₵ {amountGhs}
                </td>
                <td>
                  {renderPaymentBadge(order.paymentStatus)}
                </td>
                <td>
                  {renderOrderStatusBadge(order.orderStatus)}
                </td>
                <td>
                  {renderProviderStatusBadge(order.providerStatus)}
                </td>
                <td style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{ fontSize: 'var(--font-size-2xs)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <span>Inspect</span>
                    <ChevronRight size={12} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>

        {orders.length === 0 && !isLoading && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Package size={36} style={{ margin: '0 auto var(--space-2)' }} />
            <p style={{ fontWeight: 600, margin: 0 }}>No orders matching query criteria.</p>
          </div>
        )}

        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {orders.length} of {totalOrders.toLocaleString()} orders
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* Individual Order Investigation Drawer / Modal */}
      {selectedOrderId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrderId(null)}
          title={`Order Control Center — #${selectedOrderId}`}
        >
          {isLoadingDetail ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <p>Loading authoritative order dossier...</p>
            </div>
          ) : orderDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Order Quick Action Toolbar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {renderOrderStatusBadge(orderDetail.order.orderStatus)}
                  {renderPaymentBadge(orderDetail.order.paymentStatus)}
                  <NetworkBadge network={orderDetail.order.network as any} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReconcileOrder}
                    disabled={isReconciling}
                  >
                    <ShieldCheck size={12} className={isReconciling ? 'animate-spin' : ''} />
                    <span>Reconcile State</span>
                  </Button>

                  {orderDetail.order.orderStatus !== 'COMPLETED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryOrder}
                      disabled={isRetrying}
                    >
                      <Zap size={12} className={isRetrying ? 'animate-spin' : ''} />
                      <span>Retry Fulfillment</span>
                    </Button>
                  )}

                  {orderDetail.order.refundStatus !== 'COMPLETED' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setIsRefundModalOpen(true)}
                    >
                      <RotateCcw size={12} />
                      <span>Issue Refund</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Lifecycle Visual Timeline */}
              <Card accentColor="cyan" style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                  Order Lifecycle Progression
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {['CREATED', 'PENDING', 'SUBMITTED', 'PROCESSING', 'FULFILLED', 'CLOSED'].map((step, idx) => {
                    const isCurrent = orderDetail.order.orderStatus === step || (orderDetail.order.orderStatus === 'COMPLETED' && step === 'FULFILLED');
                    return (
                      <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--color-brand)' : 'var(--color-bg-muted)',
                            color: isCurrent ? '#fff' : 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            border: `2px solid ${isCurrent ? 'var(--color-brand)' : 'var(--color-border-subtle)'}`,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--color-brand)' : 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* DataHouse Authority Notice */}
              <div style={{ padding: 'var(--space-3)', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ShieldCheck size={16} color="var(--color-security-bright)" />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-security-bright)', fontWeight: 600 }}>
                  DataHouse Fulfillment Authority Invariant: Manual status overrides are strictly prohibited. Local projection reflects authoritative telecom provider state.
                </span>
              </div>

              {/* 3-Column Info Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                {/* Account & Recipient */}
                <Card style={{ padding: 'var(--space-3)' }}>
                  <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    Beneficiary & Account
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <div><strong>Recipient:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{orderDetail.order.recipientPhone}</span></div>
                    <div><strong>Network:</strong> {orderDetail.order.network}</div>
                    <div><strong>Bundle Size:</strong> {(orderDetail.order.dataAmountMb / 1024).toFixed(1)} GB ({orderDetail.order.dataAmountMb} MB)</div>
                    <div><strong>Amount:</strong> GH₵ {((orderDetail.order.amountPesewas || 0) / 100).toFixed(2)}</div>
                    {orderDetail.customer && (
                      <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.5rem' }}>
                        <div><strong>Customer:</strong> {orderDetail.customer.fullName}</div>
                        <div><strong>Email:</strong> {orderDetail.customer.email}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/users/${orderDetail.customer?.id}`)}
                          style={{ marginTop: '0.25rem', padding: 0, color: 'var(--color-brand)' }}
                        >
                          View User Dossier <ExternalLink size={10} />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Telecom Provider Dispatch Details */}
                <Card style={{ padding: 'var(--space-3)' }}>
                  <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    {orderDetail.providerOrder?.providerName || 'Telecom Provider'} State
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <div><strong>Provider:</strong> {orderDetail.providerOrder?.providerName || 'Authoritative Aggregator'}</div>
                    <div><strong>Provider Ref:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{orderDetail.providerOrder?.providerReference || orderDetail.providerOrder?.providerOrderId || 'Pending ACK'}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>Status:</strong>
                      {renderProviderStatusBadge(orderDetail.providerOrder?.providerStatus || orderDetail.order.providerStatus)}
                    </div>
                    <div><strong>Last Synced:</strong> {orderDetail.providerOrder?.lastSyncedAt ? new Date(orderDetail.providerOrder.lastSyncedAt).toLocaleString() : 'Recent'}</div>
                    {orderDetail.dlq && (
                      <div style={{ color: 'var(--color-danger)', marginTop: '0.25rem' }}>
                        <strong>DLQ Status:</strong> {orderDetail.dlq.status} (Attempts: {orderDetail.dlq.attemptCount})
                      </div>
                    )}
                  </div>
                </Card>

                {/* Financial Ledger & Payment */}
                <Card style={{ padding: 'var(--space-3)' }}>
                  <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    Financial & Payment State
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <div><strong>Payment Status:</strong> {orderDetail.order.paymentStatus}</div>
                    <div><strong>Payment Ref:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{orderDetail.payment?.reference || 'N/A'}</span></div>
                    <div><strong>Refund Status:</strong> {orderDetail.order.refundStatus || 'NONE'}</div>
                    {orderDetail.refund && (
                      <div><strong>Refunded Amount:</strong> GH₵ {((orderDetail.refund.amountPesewas || 0) / 100).toFixed(2)}</div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Order Event Timeline Stream */}
              <Card style={{ padding: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                  Order Audit Trail & Event Stream
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {orderDetail.events.map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div>
                        <strong style={{ color: 'var(--color-brand)' }}>{ev.eventType}</strong> ({ev.actorType})
                        {ev.previousState && <span> : {ev.previousState} → {ev.newState}</span>}
                      </div>
                      <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                        {new Date(ev.occurredAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {orderDetail.events.length === 0 && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>No discrete audit events logged for this order.</span>
                  )}
                </div>
              </Card>
            </div>
          ) : null}
        </Modal>
      )}

      {/* Double-Entry Refund Modal */}
      {isRefundModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRefundModalOpen(false)}
          title={`Issue Double-Entry Refund — Order #${selectedOrderId}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
              This will execute a double-entry ledger refund voucher paired against <code>PLATFORM_ESCROW</code> and update the order state to <strong>REFUNDED</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Mandatory Audit Reason (min 5 characters)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refunding this order..."
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
              <Button variant="ghost" onClick={() => setIsRefundModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRefundOrder}
                disabled={isRefunding || refundReason.trim().length < 5}
              >
                {isRefunding ? 'Processing Refund...' : 'Confirm Double-Entry Refund'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
