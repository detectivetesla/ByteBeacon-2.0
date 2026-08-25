import React, { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { Select } from '../../components/ui/Select/Select.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
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
  Search,
  RefreshCw,
  Eye,
  Download,
  Sliders,
  DollarSign,
  Check,
  X,
  CreditCard,
} from 'lucide-react';

export const AdminStoresPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPLICATIONS' | 'PAYOUTS' | 'PRICING' | 'ANALYTICS'>('ALL');
  const [stats, setStats] = useState<AdminStoreStats | null>(null);
  const [stores, setStores] = useState<AdminStoreListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalStores, setTotalStores] = useState<number>(0);

  // Global Activation Fee (Paywall Price) State
  const [activationFeeGhs, setActivationFeeGhs] = useState<number | null>(null);
  const [paywallFeeInput, setPaywallFeeInput] = useState<string>('500.00');
  const [isUpdatingActivationFee, setIsUpdatingActivationFee] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // Dossier Drawer State
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeDetail, setStoreDetail] = useState<AdminStoreDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [dossierTab, setDossierTab] = useState<'OVERVIEW' | 'BRANDING' | 'PRODUCTS' | 'ORDERS' | 'PAYOUTS' | 'HEALTH'>('OVERVIEW');

  // Application Review Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [reviewTargetStore, setReviewTargetStore] = useState<AdminStoreListItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Manual Payment Verification Modal
  const [isVerifyPaymentModalOpen, setIsVerifyPaymentModalOpen] = useState<boolean>(false);
  const [verifyPaymentTargetStore, setVerifyPaymentTargetStore] = useState<AdminStoreListItem | null>(null);
  const [verifyPaymentNotes, setVerifyPaymentNotes] = useState<string>('Payment verified by administrator');
  const [verifyPaymentAutoApprove, setVerifyPaymentAutoApprove] = useState<boolean>(true);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);

  // Store Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusTargetStore, setStatusTargetStore] = useState<AdminStoreListItem | null>(null);
  const [newStoreStatus, setNewStoreStatus] = useState<StoreStatus>(StoreStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Store Products Markup Modal
  const [isProductsModalOpen, setIsProductsModalOpen] = useState<boolean>(false);
  const [productsTargetStore, setProductsTargetStore] = useState<AdminStoreListItem | null>(null);
  const [storeProductsList, setStoreProductsList] = useState<StoreProductAdminDto[]>([]);
  const [markupEdits, setMarkupEdits] = useState<Record<string, { markupGhs: string; customGhs: string; isAvailable: boolean }>>({});
  const [isSavingProducts, setIsSavingProducts] = useState<boolean>(false);

  // Payout Action Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState<boolean>(false);
  const [payoutTarget, setPayoutTarget] = useState<{ storeId: string; payout: StorePayoutDto } | null>(null);
  const [payoutActionType, setPayoutActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD' | 'RELEASE'>('APPROVE');
  const [payoutReason, setPayoutReason] = useState<string>('');
  const [isProcessingPayout, setIsProcessingPayout] = useState<boolean>(false);

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

  useEffect(() => {
    fetchStats();
    fetchActivationFee();
    fetchStores();
  }, [fetchStats, fetchActivationFee, fetchStores]);

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
      toastSuccess('Payout Processed', `Payout of GH₵ ${(payoutTarget.payout.amountPesewas / 100).toFixed(2)} ${payoutActionType.toLowerCase()}ed.`);
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

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
      {/* Header */}
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
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Authoritative control plane for store applications, branding, custom product markups, merchant payouts, and storefront health.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} style={{ marginRight: '6px' }} />
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { fetchStats(); fetchStores(); }} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
          subvalue={`${stats?.pendingWithdrawalsCount || 0} Withdrawal Requests`}
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
          icon={<TactileIcon icon={DollarSign} color="orders" size="sm" />}
        />
      </div>

      {/* Internal Navigation Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
        {[
          { id: 'ALL', label: 'All Registered Stores' },
          { id: 'APPLICATIONS', label: `Store Applications (${stats?.pendingReviewStores || 0})` },
          { id: 'PAYOUTS', label: 'Payouts & Withdrawals' },
          { id: 'PRICING', label: 'Product Markup Rules' },
          { id: 'ANALYTICS', label: 'Health & Diagnostics' },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.4rem 1.1rem' }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Paywall Activation Fee Configuration Banner */}
      <Card elevated accentColor="green" style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                Agent Storefront Paywall Activation Fee
              </h3>
              <Badge variant="success" size="sm">
                Current: GH₵ {activationFeeGhs !== null ? activationFeeGhs.toFixed(2) : '500.00'}
              </Badge>
            </div>
            <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', margin: '0.15rem 0 0 0' }}>
              Universal one-time registration fee charged to agents to deploy their public storefront.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveActivationFee} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ width: '130px' }}>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="500.00"
              value={paywallFeeInput}
              onChange={(e) => setPaywallFeeInput(e.target.value)}
              disabled={isUpdatingActivationFee}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isUpdatingActivationFee}
            disabled={isUpdatingActivationFee}
          >
            Update Paywall Fee
          </Button>
        </form>
      </Card>

      {/* Main Table Card */}
      <Card elevated accentColor="orange" style={{ padding: 'var(--space-5)' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: '280px', flex: 1 }}>
              <Input
                placeholder="Search by store name, slug, owner, email, or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                leftIcon={<Search size={15} color="var(--color-text-muted)" />}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ]}
              />
              <Select
                value={approvalFilter}
                onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Approvals' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'NOT_SUBMITTED', label: 'Not Submitted' },
                ]}
              />
              <Select
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Activation Fees' },
                  { value: 'PAID', label: 'Paid' },
                  { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
                  { value: 'PAYMENT_REQUIRED', label: 'Payment Required' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={[
            {
              header: 'Store & Slug',
              accessor: 'storeName',
              render: (row: AdminStoreListItem) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                    color: 'var(--color-speed-bright)', fontSize: 'var(--font-size-xs)'
                  }}>
                    <Store size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {row.storeName}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
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
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>{row.ownerEmail}</span>
                </div>
              ),
            },
            {
              header: 'Status',
              accessor: 'storeStatus',
              render: (row: AdminStoreListItem) => (
                <Badge variant={row.storeStatus === 'ACTIVE' ? 'success' : row.storeStatus === 'SUSPENDED' ? 'danger' : 'default'} size="sm">
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
                <Badge variant={row.paymentStatus === 'PAID' ? 'success' : 'default'} size="sm">
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
                <span style={{ fontSize: 'var(--font-size-xs)' }}>{row.productsCount} active</span>
              ),
            },
            {
              header: 'Created',
              accessor: 'createdAt',
              render: (row: AdminStoreListItem) => (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              header: 'Actions',
              accessor: 'id',
              render: (row: AdminStoreListItem) => (
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <Button variant="outline" size="sm" onClick={() => openStoreDossier(row.id)}>
                    <Eye size={13} style={{ marginRight: '4px' }} />
                    Dossier
                  </Button>
                  {row.paymentStatus !== 'PAID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVerifyPaymentTargetStore(row);
                        setVerifyPaymentNotes('Payment verified by administrator');
                        setVerifyPaymentAutoApprove(true);
                        setIsVerifyPaymentModalOpen(true);
                      }}
                      title="Verify Payment & Approve"
                    >
                      <CreditCard size={13} style={{ marginRight: '4px' }} />
                      Verify Pay
                    </Button>
                  )}
                  {row.approvalStatus !== 'APPROVED' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setReviewTargetStore(row);
                          setIsApproveModalOpen(true);
                        }}
                        title="Approve & Activate Storefront"
                      >
                        <Check size={13} />
                      </Button>
                      {row.approvalStatus === 'AWAITING_APPROVAL' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setReviewTargetStore(row);
                            setIsRejectModalOpen(true);
                          }}
                          title="Reject Storefront"
                        >
                          <X size={13} />
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openProductsModal(row)}
                    title="Edit Product Markups"
                  >
                    <Sliders size={14} color="var(--color-speed-bright)" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusTargetStore(row);
                      setNewStoreStatus(row.storeStatus as any);
                      setIsStatusModalOpen(true);
                    }}
                    title="Change Status"
                  >
                    <ShieldCheck size={14} color="var(--color-text-muted)" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={stores}
          keyExtractor={(row) => row.id}
          emptyMessage={isLoading ? 'Loading stores from authoritative database...' : 'No stores match your search criteria.'}
        />

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {stores.length} of {totalStores} storefronts
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* APPROVE APPLICATION MODAL */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title={`Approve Store: ${reviewTargetStore?.storeName || ''}`}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsApproveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleApproveStore} disabled={isReviewing}>
              {isReviewing ? 'Activating...' : 'Approve & Activate Store'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* VERIFY PAYMENT MODAL */}
      <Modal
        isOpen={isVerifyPaymentModalOpen}
        onClose={() => setIsVerifyPaymentModalOpen(false)}
        title={`Verify Payment: ${verifyPaymentTargetStore?.storeName || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '12px' }}><strong>Store:</strong> {verifyPaymentTargetStore?.storeName} (/{verifyPaymentTargetStore?.slug})</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}><strong>Owner:</strong> {verifyPaymentTargetStore?.ownerName} ({verifyPaymentTargetStore?.ownerEmail})</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}><strong>Activation Fee:</strong> GH₵ {((verifyPaymentTargetStore?.activationFeePesewas || 50000) / 100).toFixed(2)}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}><strong>Current Status:</strong> {verifyPaymentTargetStore?.paymentStatus} · {verifyPaymentTargetStore?.approvalStatus}</div>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsVerifyPaymentModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleVerifyStorePayment} disabled={isVerifyingPayment}>
              {isVerifyingPayment ? 'Verifying...' : 'Confirm Payment & Verify'}
            </Button>
          </div>
        </div>
      </Modal>


      {/* REJECT APPLICATION MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={`Reject Store Application: ${reviewTargetStore?.storeName || ''}`}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleRejectStore} disabled={isReviewing}>
              {isReviewing ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STORE STATUS CHANGE MODAL */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Update Status: ${statusTargetStore?.storeName || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Store Status *</label>
            <Select
              value={newStoreStatus}
              onChange={(e) => setNewStoreStatus(e.target.value as any)}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE — Storefront live and selling' },
                { value: 'INACTIVE', label: 'INACTIVE — Temporarily hidden' },
                { value: 'SUSPENDED', label: 'SUSPENDED — Blocked from customer purchases' },
                { value: 'ARCHIVED', label: 'ARCHIVED — Terminated storefront' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Audit Reason</label>
            <Input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Suspended pending investigation of customer complaints"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdateStoreStatus} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Saving...' : 'Apply Status Change'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STORE PRODUCTS & MARKUP MODAL */}
      <Modal
        isOpen={isProductsModalOpen}
        onClose={() => setIsProductsModalOpen(false)}
        title={`Store Catalog & Markups: ${productsTargetStore?.storeName || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)', maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Configure product availability and retail markups for this storefront. Customer Price = Agent Wholesale Price + Store Markup.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Active</th>
                <th style={{ padding: '8px' }}>Product</th>
                <th style={{ padding: '8px' }}>Wholesale Cost</th>
                <th style={{ padding: '8px', minWidth: '120px' }}>Store Markup (GH₵)</th>
                <th style={{ padding: '8px' }}>Final Customer Price</th>
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
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={edit.isAvailable}
                        onChange={(e) => setMarkupEdits({
                          ...markupEdits,
                          [plan.catalogProductId]: { ...edit, isAvailable: e.target.checked }
                        })}
                      />
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{plan.productName} ({plan.network})</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>GH₵ {wholesaleGhs.toFixed(2)}</td>
                    <td style={{ padding: '8px' }}>
                      <Input
                        type="number"
                        step="0.01"
                        value={edit.markupGhs}
                        onChange={(e) => setMarkupEdits({
                          ...markupEdits,
                          [plan.catalogProductId]: { ...edit, markupGhs: e.target.value }
                        })}
                        style={{ height: '30px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-brand)' }}>
                      GH₵ {finalCustomerGhs.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsProductsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveStoreProducts} disabled={isSavingProducts}>
              {isSavingProducts ? 'Saving...' : 'Save Markup Rules'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STORE PAYOUT ACTION MODAL */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title={`${payoutActionType} Payout: GH₵ ${((payoutTarget?.payout.amountPesewas || 0) / 100).toFixed(2)}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '12px' }}><strong>Destination:</strong> {payoutTarget?.payout.destinationAccount} ({payoutTarget?.payout.destinationProvider})</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}><strong>Merchant:</strong> {payoutTarget?.payout.agentName || payoutTarget?.payout.storeName}</div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Audit Rationale * (min 4 chars)</label>
            <Input
              value={payoutReason}
              onChange={(e) => setPayoutReason(e.target.value)}
              placeholder="e.g. Momo settlement verified with Paystack payout ref"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => setIsPayoutModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleProcessPayoutAction} disabled={isProcessingPayout}>
              {isProcessingPayout ? 'Processing...' : `Confirm ${payoutActionType}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STORE DOSSIER DRAWER */}
      {selectedStoreId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '850px',
          background: 'var(--color-bg-primary)', borderLeft: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-2xl)', zIndex: 1000, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', animation: 'slideInRight 0.25s ease-out'
        }}>
          {/* Drawer Header */}
          <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: storeDetail?.branding.primaryColor || 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Store size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
                  {storeDetail?.store.storeName || 'Loading Store...'}
                </h2>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                  /{storeDetail?.store.slug} • Owner: {storeDetail?.store.ownerName}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setSelectedStoreId(null)}>
              ✕ Close
            </Button>
          </div>

          {/* Drawer Tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', overflowX: 'auto', background: 'var(--color-bg-primary)' }}>
            {[
              { id: 'OVERVIEW', label: 'Overview' },
              { id: 'BRANDING', label: 'Storefront Branding' },
              { id: 'PRODUCTS', label: 'Products & Markups' },
              { id: 'ORDERS', label: 'Sales Orders' },
              { id: 'PAYOUTS', label: 'Payouts' },
              { id: 'HEALTH', label: 'Store Health' },
            ].map((t) => (
              <Button
                key={t.id}
                variant={dossierTab === t.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDossierTab(t.id as any)}
                style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {isLoadingDetail ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <RefreshCw size={24} className="animate-spin" color="var(--color-brand)" />
              </div>
            ) : storeDetail ? (
              <>
                {dossierTab === 'OVERVIEW' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Total Orders</span>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>{storeDetail.salesMetrics.totalOrders}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Gross Sales</span>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-brand)' }}>
                          GH₵ {(storeDetail.salesMetrics.grossSalesPesewas / 100).toFixed(2)}
                        </div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Active Products</span>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>{storeDetail.products.length}</div>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Store Status</span>
                        <div style={{ fontWeight: 800, color: storeDetail.store.storeStatus === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                          {storeDetail.store.storeStatus}
                        </div>
                      </Card>
                    </div>

                    <Card elevated style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>Payment: </span>
                          <Badge variant={storeDetail.store.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                            {storeDetail.store.paymentStatus}
                          </Badge>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>Approval: </span>
                          <Badge variant={storeDetail.store.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>
                            {storeDetail.store.approvalStatus}
                          </Badge>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {storeDetail.store.paymentStatus !== 'PAID' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVerifyPaymentTargetStore(storeDetail.store);
                              setVerifyPaymentNotes('Payment verified by administrator');
                              setVerifyPaymentAutoApprove(true);
                              setIsVerifyPaymentModalOpen(true);
                            }}
                          >
                            <CreditCard size={13} style={{ marginRight: '4px' }} />
                            Verify Payment
                          </Button>
                        )}
                        {storeDetail.store.approvalStatus !== 'APPROVED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setReviewTargetStore(storeDetail.store);
                              setIsApproveModalOpen(true);
                            }}
                          >
                            Approve & Activate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setStatusTargetStore(storeDetail.store);
                            setNewStoreStatus(storeDetail.store.storeStatus as any);
                            setIsStatusModalOpen(true);
                          }}
                        >
                          Change Status
                        </Button>
                      </div>
                    </Card>


                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Recent Sales Activity</h3>
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
                        emptyMessage="No sales orders recorded yet."
                      />
                    </div>
                  </div>
                )}

                {dossierTab === 'BRANDING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Card style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Storefront URL</span>
                        <div style={{ fontWeight: 700, color: 'var(--color-brand)' }}>https://bytebeacon.com/store/{storeDetail.store.slug}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tagline</span>
                        <div>{storeDetail.branding.tagline || 'No tagline configured.'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Description</span>
                        <div>{storeDetail.branding.description || 'No description provided.'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Primary Color</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: storeDetail.branding.primaryColor }} />
                            <span>{storeDetail.branding.primaryColor}</span>
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Accent Color</span>
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
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Store Products & Retail Pricing</span>
                      <Button variant="outline" size="sm" onClick={() => openProductsModal(storeDetail.store)}>
                        <Sliders size={13} style={{ marginRight: '4px' }} />
                        Edit Markups
                      </Button>
                    </div>

                    <Table
                      columns={[
                        { header: 'Product Name', accessor: 'productName' },
                        { header: 'Network', accessor: 'network' },
                        { header: 'Wholesale Cost', accessor: 'agentPricePesewas', render: (r: any) => `GH₵ ${(r.agentPricePesewas / 100).toFixed(2)}` },
                        { header: 'Store Markup', accessor: 'markupPesewas', render: (r: any) => `GH₵ ${(r.markupPesewas / 100).toFixed(2)}` },
                        { header: 'Customer Retail', accessor: 'finalCustomerPricePesewas', render: (r: any) => <span style={{ fontWeight: 800, color: 'var(--color-brand)' }}>GH₵ ${(r.finalCustomerPricePesewas / 100).toFixed(2)}</span> },
                        { header: 'Status', accessor: 'isAvailable', render: (r: any) => <Badge variant={r.isAvailable ? 'success' : 'default'} size="sm">{r.isAvailable ? 'Available' : 'Hidden'}</Badge> },
                      ]}
                      data={storeDetail.products}
                      keyExtractor={(r: any) => r.id}
                      emptyMessage="No products configured for this store."
                    />
                  </div>
                )}

                {dossierTab === 'PAYOUTS' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Merchant Payout Requests</h3>
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
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setPayoutTarget({ storeId: storeDetail.store.id, payout: r });
                                  setPayoutActionType('APPROVE');
                                  setIsPayoutModalOpen(true);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setPayoutTarget({ storeId: storeDetail.store.id, payout: r });
                                  setPayoutActionType('REJECT');
                                  setIsPayoutModalOpen(true);
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : null,
                        },
                      ]}
                      data={storeDetail.payouts}
                      keyExtractor={(r: any) => r.id}
                      emptyMessage="No payout requests recorded."
                    />
                  </div>
                )}

                {dossierTab === 'HEALTH' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Card style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '1rem', background: storeDetail.health.isHealthy ? 'var(--color-bg-secondary)' : 'rgba(239, 68, 68, 0.08)' }}>
                      {storeDetail.health.isHealthy ? (
                        <CheckCircle size={32} color="var(--color-success)" />
                      ) : (
                        <AlertTriangle size={32} color="var(--color-danger)" />
                      )}
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 800 }}>
                          Storefront Diagnostics: {storeDetail.health.isHealthy ? 'All Systems Healthy' : 'Action Required'}
                        </h4>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {storeDetail.health.issues.length === 0 ? 'Catalog synced, payments verified, and payouts clean.' : storeDetail.health.issues.join(' • ')}
                        </span>
                      </div>
                    </Card>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Catalog Synchronized</span>
                        <Badge variant={storeDetail.health.checks.catalogSynced ? 'success' : 'danger'}>{storeDetail.health.checks.catalogSynced ? 'Synced' : 'Missing'}</Badge>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Activation Fee Status</span>
                        <Badge variant={storeDetail.health.checks.paymentsHealthy ? 'success' : 'warning'}>{storeDetail.health.checks.paymentsHealthy ? 'Verified' : 'Unpaid'}</Badge>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Payout Integrity</span>
                        <Badge variant={storeDetail.health.checks.payoutsHealthy ? 'success' : 'danger'}>{storeDetail.health.checks.payoutsHealthy ? 'Clean' : 'Failed Payouts'}</Badge>
                      </Card>
                      <Card style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Fulfillment Health</span>
                        <Badge variant={storeDetail.health.checks.ordersHealthy ? 'success' : 'warning'}>{storeDetail.health.checks.ordersHealthy ? 'Operational' : 'Attention'}</Badge>
                      </Card>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
