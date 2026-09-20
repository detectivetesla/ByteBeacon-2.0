import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input, SearchInput, Modal } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useToast } from '../../context/ToastContext.js';
import {
  adminApi,
  AdminStoreStats,
  AdminStoreListItem,
  AdminStoreDetail,
  StoreProductAdminDto,
  StoreStatus,
  StorePayoutDto,
} from '../../api/admin.api.js';
import {
  Store,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Eye,
  Download,
  Sliders,
  DollarSign,
  Check,
  X,
  CreditCard,
  TrendingUp,
} from 'lucide-react';

export const AdminStoresPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  // 1. Primary State
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPLICATIONS' | 'PAYOUTS' | 'PRICING' | 'ANALYTICS'>('ALL');
  const [stats, setStats] = useState<AdminStoreStats | null>(null);
  const [stores, setStores] = useState<AdminStoreListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalStores, setTotalStores] = useState<number>(0);

  // 2. Global Activation Fee (Paywall Price) State
  const [activationFeeGhs, setActivationFeeGhs] = useState<number | null>(null);
  const [paywallFeeInput, setPaywallFeeInput] = useState<string>('');
  const [isUpdatingActivationFee, setIsUpdatingActivationFee] = useState<boolean>(false);

  // 3. Filter State
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // 4. Store Payouts State
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<string>('ALL');
  const [payoutPage, setPayoutPage] = useState<number>(1);
  const [payoutTotalPages, setPayoutTotalPages] = useState<number>(1);
  const [payoutTotal, setPayoutTotal] = useState<number>(0);
  const [isPayoutsLoading, setIsPayoutsLoading] = useState<boolean>(false);

  // 5. Dossier Drawer State
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeDetail, setStoreDetail] = useState<AdminStoreDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [dossierTab, setDossierTab] = useState<'OVERVIEW' | 'BRANDING' | 'PRODUCTS' | 'ORDERS' | 'PAYOUTS' | 'HEALTH'>('OVERVIEW');

  // 6. Application Review Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [reviewTargetStore, setReviewTargetStore] = useState<AdminStoreListItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // 7. Manual Payment Verification Modal
  const [isVerifyPaymentModalOpen, setIsVerifyPaymentModalOpen] = useState<boolean>(false);
  const [verifyPaymentTargetStore, setVerifyPaymentTargetStore] = useState<AdminStoreListItem | null>(null);
  const [verifyPaymentNotes, setVerifyPaymentNotes] = useState<string>('Payment verified by administrator');
  const [verifyPaymentAutoApprove, setVerifyPaymentAutoApprove] = useState<boolean>(true);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);

  // 8. Store Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetStore, setStatusTargetStore] = useState<AdminStoreListItem | null>(null);
  const [newStoreStatus, setNewStoreStatus] = useState<StoreStatus>(StoreStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // 9. Store Products Markup Modal
  const [isProductsModalOpen, setIsProductsModalOpen] = useState<boolean>(false);
  const [productsTargetStore, setProductsTargetStore] = useState<AdminStoreListItem | null>(null);
  const [storeProductsList, setStoreProductsList] = useState<StoreProductAdminDto[]>([]);
  const [markupEdits, setMarkupEdits] = useState<Record<string, { markupGhs: string; customGhs: string; isAvailable: boolean }>>({});
  const [isSavingProducts, setIsSavingProducts] = useState<boolean>(false);

  // 10. Payout Action Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);
  const [payoutTarget, setPayoutTarget] = useState<{ storeId: string; payout: StorePayoutDto } | null>(null);
  const [payoutActionType, setPayoutActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD' | 'RELEASE'>('APPROVE');
  const [payoutReason, setPayoutReason] = useState<string>('');
  const [isProcessingPayout, setIsProcessingPayout] = useState<boolean>(false);

  // Standardized Tactile Button Styles
  const tactileButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    boxShadow: 'var(--shadow-tactile-sm)',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...tactileButtonStyle,
    background: 'linear-gradient(180deg, var(--color-primary-bright, #22C55E) 0%, var(--color-primary, #16A34A) 100%)',
    backgroundColor: 'var(--color-brand, #16A34A)',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: 'var(--shadow-tactile-btn, 0 4px 14px rgba(22, 163, 74, 0.35))',
    fontWeight: 700,
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.45rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-subtle)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    minWidth: '135px',
    boxShadow: 'var(--shadow-tactile-sm)',
  };

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await adminApi.getStoreStats();
      setStats(data);
    } catch {
      // Fallback
    }
  }, []);

  // Fetch Paywall Price Setting
  const fetchActivationFee = useCallback(async () => {
    try {
      const data = await adminApi.getStoreActivationFee();
      if (data?.activationFeeGhs !== undefined) {
        setActivationFeeGhs(data.activationFeeGhs);
        setPaywallFeeInput(data.activationFeeGhs.toString());
      }
    } catch {
      // Fallback
    }
  }, []);

  // Fetch Stores List
  const fetchStores = useCallback(async () => {
    setIsLoading(true);
    try {
      let resolvedApproval = approvalFilter;
      if (activeTab === 'APPLICATIONS') resolvedApproval = 'AWAITING_APPROVAL';

      const res = await adminApi.getStoresList({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        approval: resolvedApproval !== 'ALL' ? resolvedApproval : undefined,
        payment: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        page,
        limit: 20,
      });

      if (res?.items) {
        setStores(res.items);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalStores(res.pagination.total || 0);
      }
    } catch (err: any) {
      toastError('Failed to Load Stores', err.message || 'Error communicating with backend');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, approvalFilter, paymentFilter, page, search, toastError]);

  // Fetch Store Payouts List
  const fetchStorePayouts = useCallback(async () => {
    setIsPayoutsLoading(true);
    try {
      const res = await adminApi.getFinanceWithdrawals({
        page: payoutPage,
        limit: 20,
        status: payoutStatus !== 'ALL' ? payoutStatus : undefined,
      });
      if (res?.items) {
        setPayouts(res.items);
        setPayoutTotalPages(res.pagination?.totalPages || 1);
        setPayoutTotal(res.pagination?.total || 0);
      }
    } catch (err: any) {
      toastError('Failed to Load Payouts', err.message || 'Error loading store withdrawals');
    } finally {
      setIsPayoutsLoading(false);
    }
  }, [payoutPage, payoutStatus, toastError]);

  // Handle Admin Payout Action (Paid or Reject)
  const handlePayoutAction = async (id: string, action: 'PAID' | 'REJECT') => {
    const note = prompt(
      action === 'PAID'
        ? 'Enter disbursement reference or audit note (optional):'
        : 'Enter reason for rejecting this payout request (required):',
    );
    if (action === 'REJECT' && (note === null || !note.trim())) {
      toastError('Rejection Reason Required', 'A reason must be provided to reject a payout request.');
      return;
    }
    try {
      await adminApi.processWithdrawalAction(id, {
        action,
        reason: note || undefined,
        notes: note || undefined,
      });
      toastSuccess('Payout Updated', `Payout marked as ${action === 'PAID' ? 'Settled (PAID)' : 'REJECTED'}.`);
      fetchStorePayouts();
      fetchStats();
    } catch (err: any) {
      toastError('Action Failed', err.response?.data?.message || err.message || 'Failed to update payout.');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchActivationFee();
    if (activeTab === 'PAYOUTS') {
      fetchStorePayouts();
    } else {
      fetchStores();
    }
  }, [fetchStats, fetchActivationFee, fetchStores, fetchStorePayouts, activeTab]);

  // Handle Save Paywall Activation Fee
  const handleSaveActivationFee = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(paywallFeeInput);
    if (isNaN(parsed) || parsed < 0) {
      toastError('Invalid Amount', 'Please enter a valid positive activation fee amount in GHS.');
      return;
    }
    setIsUpdatingActivationFee(true);
    try {
      const res = await adminApi.updateStoreActivationFee({
        activationFeeGhs: parsed,
        reason: 'Updated from Agent Store Management control plane',
      });
      if (res?.data?.activationFeeGhs !== undefined) {
        setActivationFeeGhs(res.data.activationFeeGhs);
        setPaywallFeeInput(res.data.activationFeeGhs.toString());
      } else {
        setActivationFeeGhs(parsed);
      }
      toastSuccess('Paywall Fee Updated', `Storefront activation fee is now GH₵ ${parsed.toFixed(2)}.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bytebeacon:store-fee-updated', { detail: { feeGhs: parsed } }));
      }
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not update activation fee');
    } finally {
      setIsUpdatingActivationFee(false);
    }
  };

  // Open Store Dossier
  const openStoreDossier = async (storeId: string) => {
    setSelectedStoreId(storeId);
    setDossierTab('OVERVIEW');
    setIsLoadingDetail(true);
    try {
      const detail = await adminApi.getStoreDetail(storeId);
      setStoreDetail(detail);
    } catch (err: any) {
      toastError('Failed to load store dossier', err.message || 'Error fetching store details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle Verify Store Payment
  const handleVerifyStorePayment = async () => {
    if (!verifyPaymentTargetStore) return;
    setIsVerifyingPayment(true);
    try {
      await adminApi.verifyStorePayment(
        verifyPaymentTargetStore.id,
        verifyPaymentNotes.trim() || 'Payment verified by administrator',
        verifyPaymentAutoApprove,
      );
      toastSuccess(
        'Payment Verified',
        `Payment for '${verifyPaymentTargetStore.storeName}' verified.${verifyPaymentAutoApprove ? ' Storefront is now APPROVED and ACTIVE.' : ''}`,
      );
      setIsVerifyPaymentModalOpen(false);
      setVerifyPaymentNotes('Payment verified by administrator');
      fetchStats();
      fetchStores();
      if (selectedStoreId === verifyPaymentTargetStore.id) {
        openStoreDossier(verifyPaymentTargetStore.id);
      }
    } catch (err: any) {
      toastError('Verification Failed', err.message || 'Could not verify store payment');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  // Handle Approve Store Application
  const handleApproveStore = async () => {
    if (!reviewTargetStore) return;
    setIsReviewing(true);
    try {
      await adminApi.approveStoreApplication(reviewTargetStore.id, reviewNotes.trim() || undefined);
      toastSuccess('Store Approved', `Store '${reviewTargetStore.storeName}' approved and activated successfully.`);
      setIsApproveModalOpen(false);
      setReviewNotes('');
      fetchStats();
      fetchStores();
      if (selectedStoreId === reviewTargetStore.id) {
        openStoreDossier(reviewTargetStore.id);
      }
    } catch (err: any) {
      toastError('Approval Failed', err.message || 'Could not approve application');
    } finally {
      setIsReviewing(false);
    }
  };

  // Handle Reject Store Application
  const handleRejectStore = async () => {
    if (!reviewTargetStore || !reviewNotes || reviewNotes.trim().length < 4) {
      toastError('Reason Required', 'Please provide a clear reason for rejection (min 4 chars).');
      return;
    }
    setIsReviewing(true);
    try {
      await adminApi.rejectStoreApplication(reviewTargetStore.id, reviewNotes.trim());
      toastSuccess('Store Rejected', `Store application for '${reviewTargetStore.storeName}' was rejected.`);
      setIsRejectModalOpen(false);
      setReviewNotes('');
      fetchStats();
      fetchStores();
      if (selectedStoreId === reviewTargetStore.id) {
        openStoreDossier(reviewTargetStore.id);
      }
    } catch (err: any) {
      toastError('Rejection Failed', err.message || 'Could not reject application');
    } finally {
      setIsReviewing(false);
    }
  };

  // Handle Update Status
  const handleUpdateStoreStatus = async () => {
    if (!statusTargetStore) return;
    setIsUpdatingStatus(true);
    try {
      await adminApi.updateStoreStatus(statusTargetStore.id, newStoreStatus, statusReason.trim() || undefined);
      toastSuccess('Status Updated', `Store status changed to ${newStoreStatus}.`);
      setIsStatusModalOpen(false);
      setStatusReason('');
      fetchStats();
      fetchStores();
      if (selectedStoreId === statusTargetStore.id) {
        openStoreDossier(statusTargetStore.id);
      }
    } catch (err: any) {
      toastError('Status Update Failed', err.message || 'Could not update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open Store Products Modal
  const openProductsModal = async (store: AdminStoreListItem) => {
    setProductsTargetStore(store);
    setIsProductsModalOpen(true);
    try {
      const products = await adminApi.getStoreProductsList(store.id);
      setStoreProductsList(products);
      const edits: Record<string, { markupGhs: string; customGhs: string; isAvailable: boolean }> = {};
      products.forEach((p) => {
        edits[p.catalogProductId] = {
          markupGhs: (p.markupPesewas / 100).toFixed(2),
          customGhs: p.customPricePesewas ? (p.customPricePesewas / 100).toFixed(2) : '',
          isAvailable: p.isAvailable,
        };
      });
      setMarkupEdits(edits);
    } catch (err: any) {
      toastError('Failed to load store products', err.message || 'Error fetching products');
    }
  };

  // Save Store Products
  const handleSaveStoreProducts = async () => {
    if (!productsTargetStore) return;
    setIsSavingProducts(true);
    try {
      const payload = storeProductsList.map((p) => {
        const edit = markupEdits[p.catalogProductId] || { markupGhs: '2.00', customGhs: '', isAvailable: true };
        const markupNum = parseFloat(edit.markupGhs);
        const customNum = parseFloat(edit.customGhs);
        return {
          catalogProductId: p.catalogProductId,
          markupPesewas: isNaN(markupNum) || markupNum < 0 ? 0 : Math.round(markupNum * 100),
          customPricePesewas: isNaN(customNum) || customNum <= 0 ? undefined : Math.round(customNum * 100),
          isAvailable: edit.isAvailable,
          isVisible: edit.isAvailable,
        };
      });

      await adminApi.updateStoreProductsList(productsTargetStore.id, { products: payload });
      toastSuccess('Catalog Updated', `Products & markups saved for '${productsTargetStore.storeName}'.`);
      setIsProductsModalOpen(false);
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Could not update store products');
    } finally {
      setIsSavingProducts(false);
    }
  };

  // Handle Payout Action
  const handleProcessPayoutAction = async () => {
    if (!payoutTarget || !payoutReason || payoutReason.trim().length < 4) {
      toastError('Reason Required', 'Please provide a clear reason for the payout action (min 4 chars).');
      return;
    }

    setIsProcessingPayout(true);
    try {
      await adminApi.processStorePayoutAction(payoutTarget.storeId, payoutTarget.payout.id, {
        action: payoutActionType,
        reason: payoutReason.trim(),
      });
      toastSuccess('Payout Processed', `Payout of GH₵ ${((payoutTarget.payout.amountPesewas || 0) / 100).toFixed(2)} ${payoutActionType.toLowerCase()}ed.`);
      setIsPayoutModalOpen(false);
      setPayoutReason('');
      fetchStats();
      if (selectedStoreId === payoutTarget.storeId) {
        openStoreDossier(payoutTarget.storeId);
      }
    } catch (err: any) {
      toastError('Payout Action Failed', err.message || 'Could not process payout');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      toastSuccess('Exporting Stores', 'Downloading store records CSV...');
      await adminApi.exportStores({ format: 'csv', status: statusFilter });
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export stores');
    }
  };

  // Active filter chips calculation
  const activeFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (search.trim()) {
      filters.push({
        id: 'search',
        label: `Search: "${search}"`,
        onRemove: () => setSearch(''),
      });
    }

    if (statusFilter !== 'ALL') {
      filters.push({
        id: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => setStatusFilter('ALL'),
      });
    }

    if (approvalFilter !== 'ALL') {
      const labels: Record<string, string> = {
        APPROVED: 'Approved',
        AWAITING_APPROVAL: 'Awaiting Approval',
        REJECTED: 'Rejected',
        NOT_SUBMITTED: 'Not Submitted',
      };
      filters.push({
        id: 'approval',
        label: `Approval: ${labels[approvalFilter] || approvalFilter}`,
        onRemove: () => setApprovalFilter('ALL'),
      });
    }

    if (paymentFilter !== 'ALL') {
      const labels: Record<string, string> = {
        PAID: 'Fee Paid',
        PAYMENT_PENDING: 'Fee Pending',
        PAYMENT_REQUIRED: 'Fee Required',
      };
      filters.push({
        id: 'payment',
        label: `Activation: ${labels[paymentFilter] || paymentFilter}`,
        onRemove: () => setPaymentFilter('ALL'),
      });
    }

    return filters;
  }, [search, statusFilter, approvalFilter, paymentFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setApprovalFilter('ALL');
    setPaymentFilter('ALL');
    setPage(1);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={Store} color="speed" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-agent-bright)' }}>
              Merchant Operations & Storefronts
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Agent Store Management
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative control plane for store applications, branding, custom product markups, merchant payouts, and storefront health.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleExport} style={tactileButtonStyle} title="Export stores as CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => { fetchStats(); fetchStores(); }}
            disabled={isLoading}
            style={{
              ...tactileButtonStyle,
              padding: '0.45rem 0.6rem',
              color: 'var(--color-text-muted)',
            }}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. 6 KPI Summary Cards (Standard Auto-fit Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Storefronts"
          value={stats ? stats.totalStores.toLocaleString() : '—'}
          subvalue="Registered Stores"
          accent="orange"
          icon={<TactileIcon icon={Store} color="speed" size="sm" />}
        />
        <MetricCard
          title="Active Stores"
          value={stats ? stats.activeStores.toLocaleString() : '—'}
          subvalue="Live & Transacting"
          accent="green"
          icon={<TactileIcon icon={CheckCircle} color="security" size="sm" />}
        />
        <MetricCard
          title="Pending Applications"
          value={stats ? stats.pendingReviewStores.toLocaleString() : '—'}
          subvalue="Awaiting Verification"
          accent="amber"
          icon={<TactileIcon icon={Clock} color="amber" size="sm" />}
        />
        <MetricCard
          title="Pending Payouts"
          value={stats ? `GH₵ ${(stats.pendingWithdrawalPesewas / 100).toFixed(2)}` : '—'}
          subvalue={`${stats?.pendingWithdrawalsCount || 0} Requests`}
          accent="purple"
          icon={<TactileIcon icon={DollarSign} color="payments" size="sm" />}
        />
        <MetricCard
          title="Suspended Stores"
          value={stats ? stats.suspendedStores.toLocaleString() : '—'}
          subvalue="Commerce Frozen"
          accent="red"
          icon={<TactileIcon icon={AlertTriangle} color="red" size="sm" />}
        />
        <MetricCard
          title="Gross Store Sales"
          value={stats ? `GH₵ ${(stats.totalSalesPesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          subvalue="Lifetime Merchant Volume"
          accent="blue"
          icon={<TactileIcon icon={TrendingUp} color="orders" size="sm" />}
        />
      </div>

      {/* 3. Internal Navigation Tabs (Standard Tactile Segmented Bar) */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          padding: '0.25rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'ALL', label: 'All Registered Stores', count: stats?.totalStores ?? totalStores, icon: <Store size={13} /> },
          { id: 'APPLICATIONS', label: 'Store Applications', count: stats?.pendingReviewStores ?? 0, icon: <Clock size={13} /> },
          { id: 'PAYOUTS', label: 'Payouts & Withdrawals', count: stats?.pendingWithdrawalsCount ?? 0, icon: <DollarSign size={13} /> },
          { id: 'PRICING', label: 'Product Markup Rules', count: undefined, icon: <Sliders size={13} /> },
          { id: 'ANALYTICS', label: 'Health & Diagnostics', count: undefined, icon: <ShieldCheck size={13} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Paywall Activation Fee Configuration Card (Compact & Tactile) */}
      <Card
        elevated
        style={{
          padding: 'var(--space-3) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <TactileIcon icon={DollarSign} color="emerald" size="sm" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                Storefront Paywall Activation Fee
              </h3>
              <Badge variant="success" size="sm">
                Current: GH₵ {activationFeeGhs !== null ? activationFeeGhs.toFixed(2) : '500.00'}
              </Badge>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0.1rem 0 0 0' }}>
              One-time deployment fee charged to agents to activate their customer-facing storefront.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveActivationFee} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="500.00"
            value={paywallFeeInput}
            onChange={(e) => setPaywallFeeInput(e.target.value)}
            disabled={isUpdatingActivationFee}
            style={{
              width: '100px',
              padding: '0.4rem 0.6rem',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isUpdatingActivationFee}
            style={{
              ...primaryButtonStyle,
              padding: '0.4rem 0.75rem',
              fontSize: '11px',
              opacity: isUpdatingActivationFee ? 0.6 : 1,
            }}
          >
            {isUpdatingActivationFee ? 'Saving...' : 'Update Fee'}
          </button>
        </form>
      </Card>

      {activeTab === 'PAYOUTS' ? (
        /* Dedicated Storefront Payouts Administration */
        <Card
          elevated
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-tactile-sm)',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-primary)' }}>
                Storefront Profit Payout Requests
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Track and disburse agent store profits to Mobile Money numbers and Bank accounts.
              </p>
            </div>

            <select
              value={payoutStatus}
              onChange={(e) => { setPayoutStatus(e.target.value); setPayoutPage(1); }}
              style={selectStyle}
              aria-label="Filter Payout Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="PAID">Settled / Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Store Name</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Agent</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Amount</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Destination Account</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px' }}>Requested</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '10px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isPayoutsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                      <span>Loading store payouts...</span>
                    </td>
                  </tr>
                ) : payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <span>No store payouts matching the filter.</span>
                    </td>
                  </tr>
                ) : (
                  payouts.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {w.storeName || 'Agent Direct'}
                          </span>
                          {w.storeSlug && (
                            <span style={{ fontSize: '10px', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                              /{w.storeSlug}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{w.agentName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{w.agentEmail}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                          GH₵ {(w.amountPesewas / 100).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Badge variant="neutral" size="sm">
                              {w.bankName || w.destinationProvider || 'MOMO'}
                            </Badge>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-primary)' }}>
                              {w.destinationAccount}
                            </span>
                          </div>
                          {w.accountName && (
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {w.accountName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <Badge variant={w.status === 'PAID' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                          {w.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {w.status === 'PENDING' || w.status === 'PROCESSING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePayoutAction(w.id, 'PAID')}
                                style={{ ...primaryButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePayoutAction(w.id, 'REJECT')}
                                style={{
                                  ...tactileButtonStyle,
                                  padding: '0.35rem 0.6rem',
                                  fontSize: '11px',
                                  color: 'var(--color-danger)',
                                }}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {w.status === 'PAID' ? 'Settled' : 'Resolved'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payouts Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              Showing {payouts.length} of {payoutTotal} payouts
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                disabled={payoutPage <= 1}
                onClick={() => setPayoutPage((p) => Math.max(1, p - 1))}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                  opacity: payoutPage <= 1 ? 0.5 : 1,
                  cursor: payoutPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', padding: '0 0.5rem' }}>
                Page {payoutPage} of {payoutTotalPages}
              </span>
              <button
                type="button"
                disabled={payoutPage >= payoutTotalPages}
                onClick={() => setPayoutPage((p) => Math.min(payoutTotalPages, p + 1))}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                  opacity: payoutPage >= payoutTotalPages ? 0.5 : 1,
                  cursor: payoutPage >= payoutTotalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      ) : (
        /* Main Storefronts Table & Compact Filters */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* 5. Standardized Compact Filter Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
                <SearchInput
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by store name, slug, owner, email, or phone..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>

                <select
                  value={approvalFilter}
                  onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Approval"
                >
                  <option value="ALL">All Approvals</option>
                  <option value="APPROVED">Approved</option>
                  <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="NOT_SUBMITTED">Not Submitted</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                  style={selectStyle}
                  aria-label="Filter by Activation Fee"
                >
                  <option value="ALL">All Activation Fees</option>
                  <option value="PAID">Paid</option>
                  <option value="PAYMENT_PENDING">Payment Pending</option>
                  <option value="PAYMENT_REQUIRED">Payment Required</option>
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilters.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  alignItems: 'center',
                  paddingTop: '0.25rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                  Active Filters:
                </span>
                {activeFilters.map((af) => (
                  <span
                    key={af.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.2rem 0.55rem',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {af.label}
                    <button
                      type="button"
                      onClick={af.onRemove}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                      }}
                      title="Remove filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* 6. Main Storefront Table Card */}
          <Card
            elevated
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                  Merchant Storefront Directory
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
                  Authoritative storefront deployments, approval states, paywall fees, and lifetime sales metrics.
                </p>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Showing {stores.length} of {totalStores} storefronts
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <Table
                columns={[
                  {
                    header: 'Store & Slug',
                    accessor: 'storeName',
                    render: (row: AdminStoreListItem) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: 'var(--radius-md)',
                          background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                          color: 'var(--color-speed-bright)', fontSize: 'var(--font-size-xs)'
                        }}>
                          <Store size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            {row.storeName}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                            /{row.slug}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'Merchant Owner',
                    accessor: 'ownerName',
                    render: (row: AdminStoreListItem) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{row.ownerName}</span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{row.ownerEmail}</span>
                      </div>
                    ),
                  },
                  {
                    header: 'Status',
                    accessor: 'storeStatus',
                    render: (row: AdminStoreListItem) => (
                      <Badge variant={row.storeStatus === 'ACTIVE' ? 'success' : row.storeStatus === 'SUSPENDED' ? 'danger' : 'neutral'} size="sm">
                        {row.storeStatus}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Approval',
                    accessor: 'approvalStatus',
                    render: (row: AdminStoreListItem) => (
                      <Badge variant={row.approvalStatus === 'APPROVED' ? 'success' : row.approvalStatus === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                        {row.approvalStatus}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Activation Fee',
                    accessor: 'paymentStatus',
                    render: (row: AdminStoreListItem) => (
                      <Badge variant={row.paymentStatus === 'PAID' ? 'success' : 'neutral'} size="sm">
                        {row.paymentStatus}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Sales Volume',
                    accessor: 'totalSalesPesewas',
                    render: (row: AdminStoreListItem) => (
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-brand)', fontSize: 'var(--font-size-xs)' }}>
                        GH₵ {(row.totalSalesPesewas / 100).toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    header: 'Products',
                    accessor: 'productsCount',
                    render: (row: AdminStoreListItem) => (
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{row.productsCount} active</span>
                    ),
                  },
                  {
                    header: 'Created',
                    accessor: 'createdAt',
                    render: (row: AdminStoreListItem) => (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(row.createdAt).toLocaleDateString()}
                      </span>
                    ),
                  },
                  {
                    header: 'Actions',
                    accessor: 'id',
                    render: (row: AdminStoreListItem) => (
                      <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openStoreDossier(row.id)}
                          style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                          title="View Store Dossier"
                        >
                          <Eye size={12} />
                          <span>Dossier</span>
                        </button>
                        {row.paymentStatus !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyPaymentTargetStore(row);
                              setVerifyPaymentNotes('Payment verified by administrator');
                              setVerifyPaymentAutoApprove(true);
                              setIsVerifyPaymentModalOpen(true);
                            }}
                            style={{
                              ...tactileButtonStyle,
                              padding: '0.35rem 0.6rem',
                              fontSize: '11px',
                              color: 'var(--color-warning-bright)',
                            }}
                            title="Verify Paywall Payment & Approve"
                          >
                            <CreditCard size={12} />
                            <span>Verify Pay</span>
                          </button>
                        )}
                        {row.approvalStatus !== 'APPROVED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setReviewTargetStore(row);
                                setIsApproveModalOpen(true);
                              }}
                              style={{
                                ...primaryButtonStyle,
                                padding: '0.35rem 0.55rem',
                                fontSize: '11px',
                              }}
                              title="Approve & Activate Storefront"
                            >
                              <Check size={12} />
                            </button>
                            {row.approvalStatus === 'AWAITING_APPROVAL' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewTargetStore(row);
                                  setIsRejectModalOpen(true);
                                }}
                                style={{
                                  ...tactileButtonStyle,
                                  padding: '0.35rem 0.55rem',
                                  fontSize: '11px',
                                  color: 'var(--color-danger)',
                                }}
                                title="Reject Storefront Application"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openProductsModal(row)}
                          style={{ ...tactileButtonStyle, padding: '0.35rem 0.5rem', color: 'var(--color-speed-bright)' }}
                          title="Edit Product Markups"
                        >
                          <Sliders size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusTargetStore(row);
                            setNewStoreStatus(row.storeStatus as any);
                            setIsStatusModalOpen(true);
                          }}
                          style={{ ...tactileButtonStyle, padding: '0.35rem 0.5rem', color: 'var(--color-text-muted)' }}
                          title="Change Operational Status"
                        >
                          <ShieldCheck size={13} />
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={stores}
                keyExtractor={(row) => row.id}
                emptyText={isLoading ? 'Loading stores from authoritative database...' : 'No stores match your search criteria.'}
              />
            </div>

            {/* Pagination Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Showing {stores.length} of {totalStores} storefronts (Page {page} of {totalPages})
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    ...tactileButtonStyle,
                    padding: '0.35rem 0.65rem',
                    opacity: page <= 1 ? 0.5 : 1,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', padding: '0 0.5rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    ...tactileButtonStyle,
                    padding: '0.35rem 0.65rem',
                    opacity: page >= totalPages ? 0.5 : 1,
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODALS (Non-Overlapping, rendered at high z-index via Modal component) */}
      {/* ========================================================================= */}

      {/* A. APPROVE APPLICATION MODAL */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title={`Approve Store: ${reviewTargetStore?.storeName || ''}`}
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Approving this application will immediately activate the storefront at <strong>/{reviewTargetStore?.slug}</strong> and allow customers to purchase data bundles.
          </p>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Approval Notes (Optional)</label>
            <Input
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. KYC verified, merchant float confirmed"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsApproveModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApproveStore}
              disabled={isReviewing}
              style={{
                ...primaryButtonStyle,
                opacity: isReviewing ? 0.6 : 1,
              }}
            >
              {isReviewing ? 'Activating...' : 'Approve & Activate Store'}
            </button>
          </div>
        </div>
      </Modal>

      {/* B. VERIFY PAYMENT MODAL */}
      <Modal
        isOpen={isVerifyPaymentModalOpen}
        onClose={() => setIsVerifyPaymentModalOpen(false)}
        title={`Verify Payment: ${verifyPaymentTargetStore?.storeName || ''}`}
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '11px' }}><strong>Store:</strong> {verifyPaymentTargetStore?.storeName} (/{verifyPaymentTargetStore?.slug})</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}><strong>Owner:</strong> {verifyPaymentTargetStore?.ownerName} ({verifyPaymentTargetStore?.ownerEmail})</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}><strong>Activation Fee:</strong> GH₵ {((verifyPaymentTargetStore?.activationFeePesewas || 50000) / 100).toFixed(2)}</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}><strong>Current Status:</strong> {verifyPaymentTargetStore?.paymentStatus} · {verifyPaymentTargetStore?.approvalStatus}</div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Admin Verification Notes</label>
            <Input
              value={verifyPaymentNotes}
              onChange={(e) => setVerifyPaymentNotes(e.target.value)}
              placeholder="e.g. Offline bank transfer / Direct MoMo received & confirmed"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={verifyPaymentAutoApprove}
              onChange={(e) => setVerifyPaymentAutoApprove(e.target.checked)}
            />
            <span>Auto-approve application and activate storefront immediately</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsVerifyPaymentModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerifyStorePayment}
              disabled={isVerifyingPayment}
              style={{
                ...primaryButtonStyle,
                opacity: isVerifyingPayment ? 0.6 : 1,
              }}
            >
              {isVerifyingPayment ? 'Verifying...' : 'Confirm Payment & Verify'}
            </button>
          </div>
        </div>
      </Modal>

      {/* C. REJECT APPLICATION MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={`Reject Store Application: ${reviewTargetStore?.storeName || ''}`}
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Rejection Reason * (min 4 chars)</label>
            <Input
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Store slug infringes trademark, or invalid merchant contact"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsRejectModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectStore}
              disabled={isReviewing}
              style={{
                ...tactileButtonStyle,
                backgroundColor: 'var(--color-danger)',
                color: '#fff',
                borderColor: 'var(--color-danger)',
              }}
            >
              {isReviewing ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>

      {/* D. STORE STATUS CHANGE MODAL */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Update Status: ${statusTargetStore?.storeName || ''}`}
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Store Status *</label>
            <select
              value={newStoreStatus}
              onChange={(e) => setNewStoreStatus(e.target.value as any)}
              style={{ ...selectStyle, width: '100%' }}
            >
              <option value="ACTIVE">ACTIVE — Storefront live and selling</option>
              <option value="INACTIVE">INACTIVE — Temporarily hidden</option>
              <option value="SUSPENDED">SUSPENDED — Blocked from customer purchases</option>
              <option value="ARCHIVED">ARCHIVED — Terminated storefront</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Audit Reason</label>
            <Input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Suspended pending investigation of customer complaints"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsStatusModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateStoreStatus}
              disabled={isUpdatingStatus}
              style={{
                ...primaryButtonStyle,
                opacity: isUpdatingStatus ? 0.6 : 1,
              }}
            >
              {isUpdatingStatus ? 'Saving...' : 'Apply Status Change'}
            </button>
          </div>
        </div>
      </Modal>

      {/* E. STORE PRODUCTS & MARKUP MODAL */}
      <Modal
        isOpen={isProductsModalOpen}
        onClose={() => setIsProductsModalOpen(false)}
        title={`Store Catalog & Markups: ${productsTargetStore?.storeName || ''}`}
        maxWidth="740px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Configure product availability and retail markups for this storefront. Customer Price = Agent Wholesale Price + Store Markup.
          </p>

          <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.45rem 0.65rem' }}>Active</th>
                  <th style={{ padding: '0.45rem 0.65rem' }}>Product</th>
                  <th style={{ padding: '0.45rem 0.65rem' }}>Wholesale Cost</th>
                  <th style={{ padding: '0.45rem 0.65rem', minWidth: '120px' }}>Store Markup (GH₵)</th>
                  <th style={{ padding: '0.45rem 0.65rem' }}>Final Customer Price</th>
                </tr>
              </thead>
              <tbody>
                {storeProductsList.map((plan) => {
                  const edit = markupEdits[plan.catalogProductId] || { markupGhs: '2.00', customGhs: '', isAvailable: true };
                  const wholesaleGhs = plan.agentPricePesewas / 100;
                  const markupNum = parseFloat(edit.markupGhs) || 0;
                  const finalCustomerGhs = wholesaleGhs + markupNum;

                  return (
                    <tr key={plan.catalogProductId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.45rem 0.65rem' }}>
                        <input
                          type="checkbox"
                          checked={edit.isAvailable}
                          onChange={(e) => setMarkupEdits({
                            ...markupEdits,
                            [plan.catalogProductId]: { ...edit, isAvailable: e.target.checked }
                          })}
                        />
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', fontWeight: 600 }}>{plan.productName} ({plan.network})</td>
                      <td style={{ padding: '0.45rem 0.65rem', fontFamily: 'var(--font-mono)' }}>GH₵ {wholesaleGhs.toFixed(2)}</td>
                      <td style={{ padding: '0.45rem 0.65rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={edit.markupGhs}
                          onChange={(e) => setMarkupEdits({
                            ...markupEdits,
                            [plan.catalogProductId]: { ...edit, markupGhs: e.target.value }
                          })}
                          style={{
                            width: '90px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-brand)' }}>
                        GH₵ {finalCustomerGhs.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsProductsModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveStoreProducts}
              disabled={isSavingProducts}
              style={{
                ...primaryButtonStyle,
                opacity: isSavingProducts ? 0.6 : 1,
              }}
            >
              {isSavingProducts ? 'Saving...' : 'Save Markup Rules'}
            </button>
          </div>
        </div>
      </Modal>

      {/* F. STORE PAYOUT ACTION MODAL */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title={`${payoutActionType} Payout: GH₵ ${((payoutTarget?.payout.amountPesewas || 0) / 100).toFixed(2)}`}
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '11px' }}><strong>Destination:</strong> {payoutTarget?.payout.destinationAccount} ({payoutTarget?.payout.destinationProvider})</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}><strong>Merchant:</strong> {payoutTarget?.payout.agentName || payoutTarget?.payout.storeName}</div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Audit Rationale * (min 4 chars)</label>
            <Input
              value={payoutReason}
              onChange={(e) => setPayoutReason(e.target.value)}
              placeholder="e.g. Momo settlement verified with Paystack payout ref"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsPayoutModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcessPayoutAction}
              disabled={isProcessingPayout}
              style={{
                ...primaryButtonStyle,
                opacity: isProcessingPayout ? 0.6 : 1,
              }}
            >
              {isProcessingPayout ? 'Processing...' : `Confirm ${payoutActionType}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. STORE DOSSIER DRAWER & BACKDROP (Non-Overlapping, zIndex 250/260) */}
      {/* ========================================================================= */}
      {selectedStoreId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 250,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedStoreId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              height: '100%',
              backgroundColor: 'var(--color-bg-surface)',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-tactile-xl, 0 20px 50px rgba(0,0,0,0.5))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 260,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                  background: storeDetail?.branding.primaryColor || 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <Store size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                    {storeDetail?.store.storeName || 'Loading Store...'}
                  </h2>
                  <span style={{ fontSize: '11px', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                    /{storeDetail?.store.slug} • Owner: {storeDetail?.store.ownerName}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedStoreId(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  title="Close Dossier"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Dossier Segmented Tabs Bar */}
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                padding: '0.75rem var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'OVERVIEW', label: 'Overview' },
                { id: 'BRANDING', label: 'Storefront Branding' },
                { id: 'PRODUCTS', label: 'Products & Markups' },
                { id: 'ORDERS', label: 'Sales Orders' },
                { id: 'PAYOUTS', label: 'Payouts' },
                { id: 'HEALTH', label: 'Store Health' },
              ].map((t) => {
                const isActive = dossierTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDossierTab(t.id as any)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                      backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isLoadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <RefreshCw size={24} className="animate-spin" color="var(--color-brand)" />
                </div>
              ) : storeDetail ? (
                <>
                  {dossierTab === 'OVERVIEW' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                        <Card style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Total Orders</span>
                          <div style={{ fontSize: '16px', fontWeight: 800 }}>{storeDetail.salesMetrics.totalOrders}</div>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Gross Sales</span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                            GH₵ {(storeDetail.salesMetrics.grossSalesPesewas / 100).toFixed(2)}
                          </div>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Active Products</span>
                          <div style={{ fontSize: '16px', fontWeight: 800 }}>{storeDetail.products.length}</div>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Store Status</span>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: storeDetail.store.storeStatus === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                            {storeDetail.store.storeStatus}
                          </div>
                        </Card>
                      </div>

                      <Card elevated style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>Payment: </span>
                            <Badge variant={storeDetail.store.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                              {storeDetail.store.paymentStatus}
                            </Badge>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>Approval: </span>
                            <Badge variant={storeDetail.store.approvalStatus === 'APPROVED' ? 'success' : 'warning'} size="sm">
                              {storeDetail.store.approvalStatus}
                            </Badge>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {storeDetail.store.paymentStatus !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyPaymentTargetStore(storeDetail.store);
                                setVerifyPaymentNotes('Payment verified by administrator');
                                setVerifyPaymentAutoApprove(true);
                                setIsVerifyPaymentModalOpen(true);
                              }}
                              style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                            >
                              <CreditCard size={12} />
                              <span>Verify Payment</span>
                            </button>
                          )}
                          {storeDetail.store.approvalStatus !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewTargetStore(storeDetail.store);
                                setIsApproveModalOpen(true);
                              }}
                              style={{ ...primaryButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                            >
                              Approve & Activate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setStatusTargetStore(storeDetail.store);
                              setNewStoreStatus(storeDetail.store.storeStatus as any);
                              setIsStatusModalOpen(true);
                            }}
                            style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                          >
                            Change Status
                          </button>
                        </div>
                      </Card>

                      <div>
                        <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 var(--space-3)' }}>
                          Recent Sales Activity
                        </h4>
                        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          <Table
                            columns={[
                              { header: 'Order ID', accessor: 'publicId' },
                              { header: 'Recipient', accessor: 'recipientPhone' },
                              { header: 'Network', accessor: 'network' },
                              { header: 'Amount', accessor: 'amountPesewas', render: (r: any) => `GH₵ ${(r.amountPesewas / 100).toFixed(2)}` },
                              { header: 'Status', accessor: 'orderStatus', render: (r: any) => <Badge variant={r.orderStatus === 'COMPLETED' ? 'success' : 'warning'} size="sm">{r.orderStatus}</Badge> },
                              { header: 'Date', accessor: 'createdAt', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
                            ]}
                            data={storeDetail.recentOrders}
                            keyExtractor={(r: any) => r.id}
                            emptyText="No sales orders recorded yet."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {dossierTab === 'BRANDING' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <Card style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Storefront URL</span>
                          <div style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
                            {typeof window !== 'undefined' && window.location?.origin
                              ? `${window.location.origin}/store/${storeDetail.store.slug}`
                              : `/store/${storeDetail.store.slug}`}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Tagline</span>
                          <div>{storeDetail.branding.tagline || 'No tagline configured.'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Description</span>
                          <div>{storeDetail.branding.description || 'No description provided.'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Primary Color</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: storeDetail.branding.primaryColor }} />
                              <span>{storeDetail.branding.primaryColor}</span>
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Accent Color</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: storeDetail.branding.accentColor }} />
                              <span>{storeDetail.branding.accentColor}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {dossierTab === 'PRODUCTS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>Store Products & Retail Pricing</span>
                        <button
                          type="button"
                          onClick={() => openProductsModal(storeDetail.store)}
                          style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                        >
                          <Sliders size={12} />
                          <span>Edit Markups</span>
                        </button>
                      </div>

                      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <Table
                          columns={[
                            { header: 'Product Name', accessor: 'productName' },
                            { header: 'Network', accessor: 'network' },
                            { header: 'Wholesale Cost', accessor: 'agentPricePesewas', render: (r: any) => `GH₵ ${(r.agentPricePesewas / 100).toFixed(2)}` },
                            { header: 'Store Markup', accessor: 'markupPesewas', render: (r: any) => `GH₵ ${(r.markupPesewas / 100).toFixed(2)}` },
                            { header: 'Customer Retail', accessor: 'finalCustomerPricePesewas', render: (r: any) => <span style={{ fontWeight: 800, color: 'var(--color-brand)' }}>GH₵ ${(r.finalCustomerPricePesewas / 100).toFixed(2)}</span> },
                            { header: 'Status', accessor: 'isAvailable', render: (r: any) => <Badge variant={r.isAvailable ? 'success' : 'neutral'} size="sm">{r.isAvailable ? 'Available' : 'Hidden'}</Badge> },
                          ]}
                          data={storeDetail.products}
                          keyExtractor={(r: any) => r.id}
                          emptyText="No products configured for this store."
                        />
                      </div>
                    </div>
                  )}

                  {dossierTab === 'PAYOUTS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                        Merchant Payout Requests
                      </h4>
                      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <Table
                          columns={[
                            { header: 'Amount', accessor: 'amountPesewas', render: (r: any) => `GH₵ ${(r.amountPesewas / 100).toFixed(2)}` },
                            { header: 'Destination', accessor: 'destinationAccount', render: (r: any) => `${r.destinationAccount} (${r.destinationProvider})` },
                            { header: 'Status', accessor: 'status', render: (r: any) => <Badge variant={r.status === 'PAID' ? 'success' : r.status === 'PENDING' ? 'warning' : 'danger'} size="sm">{r.status}</Badge> },
                            { header: 'Requested', accessor: 'createdAt', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
                            {
                              header: 'Action',
                              accessor: 'id',
                              render: (r: any) => r.status === 'PENDING' ? (
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayoutTarget({ storeId: storeDetail.store.id, payout: r });
                                      setPayoutActionType('APPROVE');
                                      setIsPayoutModalOpen(true);
                                    }}
                                    style={{ ...primaryButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px' }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayoutTarget({ storeId: storeDetail.store.id, payout: r });
                                      setPayoutActionType('REJECT');
                                      setIsPayoutModalOpen(true);
                                    }}
                                    style={{ ...tactileButtonStyle, padding: '0.35rem 0.6rem', fontSize: '11px', color: 'var(--color-danger)' }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : null,
                            },
                          ]}
                          data={storeDetail.payouts}
                          keyExtractor={(r: any) => r.id}
                          emptyText="No payout requests recorded."
                        />
                      </div>
                    </div>
                  )}

                  {dossierTab === 'HEALTH' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '1rem', background: storeDetail.health.isHealthy ? 'var(--color-bg-subtle)' : 'rgba(239, 68, 68, 0.08)' }}>
                        {storeDetail.health.isHealthy ? (
                          <CheckCircle size={28} color="var(--color-success)" />
                        ) : (
                          <AlertTriangle size={28} color="var(--color-danger)" />
                        )}
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                            Storefront Diagnostics: {storeDetail.health.isHealthy ? 'All Systems Healthy' : 'Action Required'}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {storeDetail.health.issues.length === 0 ? 'Catalog synced, payments verified, and payouts clean.' : storeDetail.health.issues.join(' • ')}
                          </span>
                        </div>
                      </Card>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px' }}>Catalog Synchronized</span>
                          <Badge variant={storeDetail.health.checks.catalogSynced ? 'success' : 'danger'} size="sm">{storeDetail.health.checks.catalogSynced ? 'Synced' : 'Missing'}</Badge>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px' }}>Activation Fee Status</span>
                          <Badge variant={storeDetail.health.checks.paymentsHealthy ? 'success' : 'warning'} size="sm">{storeDetail.health.checks.paymentsHealthy ? 'Verified' : 'Unpaid'}</Badge>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px' }}>Payout Integrity</span>
                          <Badge variant={storeDetail.health.checks.payoutsHealthy ? 'success' : 'danger'} size="sm">{storeDetail.health.checks.payoutsHealthy ? 'Clean' : 'Failed Payouts'}</Badge>
                        </Card>
                        <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px' }}>Fulfillment Health</span>
                          <Badge variant={storeDetail.health.checks.ordersHealthy ? 'success' : 'warning'} size="sm">{storeDetail.health.checks.ordersHealthy ? 'Operational' : 'Attention'}</Badge>
                        </Card>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
