import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  NetworkProvider,
  CatalogProductDto,
  AdminCatalogStats,
  AdminCatalogPlanDetail,
  CreateCatalogPlanRequest,
  UpdateCatalogPlanRequest,
  CatalogPlanStatus,
  CatalogPricingMode,
  BulkPricingPlanImpact,
  ProviderCatalogSyncBatchDto,
} from '@bytebeacon/shared';
import { adminApi } from '../../api/admin.api.js';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input, SearchInput, Modal } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  Download,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Edit3,
  TrendingUp,
  Layers,
  Zap,
  Globe,
  Sliders,
  X,
  Trash2,
  Store,
} from 'lucide-react';

export const AdminDataPlansPage: React.FC = () => {
  useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // 1. Core State
  const [stats, setStats] = useState<AdminCatalogStats | null>(null);
  const [plans, setPlans] = useState<CatalogProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // 2. Channel View Tabs & Filters State
  const [activeChannelTab, setActiveChannelTab] = useState<'ALL' | 'CUSTOMER' | 'AGENT' | 'STORE'>('ALL');
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [providerStatusFilter, setProviderStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 3. Selection & Bulk State
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Single Plan Delete State
  const [planToDelete, setPlanToDelete] = useState<CatalogProductDto | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 4. Bulk Pricing State
  const [isBulkPricingOpen, setIsBulkPricingOpen] = useState(false);
  const [customerMarkupPct, setCustomerMarkupPct] = useState('');
  const [agentMarkupPct, setAgentMarkupPct] = useState('');
  const [storeMarkupPct, setStoreMarkupPct] = useState('');
  const [bulkPricingPreview, setBulkPricingPreview] = useState<BulkPricingPlanImpact[] | null>(null);
  const [bulkPricingDiffTotal, setBulkPricingDiffTotal] = useState(0);
  const [bulkPricingReason, setBulkPricingReason] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // 5. Provider Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncBatches, setSyncBatches] = useState<ProviderCatalogSyncBatchDto[]>([]);
  const [activeSyncBatch, setActiveSyncBatch] = useState<ProviderCatalogSyncBatchDto | null>(null);
  const [syncTab, setSyncTab] = useState<'DIFF' | 'HISTORY'>('DIFF');

  // 6. Create / Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CatalogProductDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    network: NetworkProvider.MTN,
    providerName: 'DataHouse',
    providerPlanId: '',
    providerPlanCode: '',
    providerProductCode: '',
    dataAmountMb: 1024,
    validityDays: 30,
    validityDesc: 'Non-Expiry',
    providerPriceGhs: '3.50',
    customerPriceGhs: '6.00',
    agentPriceGhs: '3.80',
    agentMinPriceGhs: '3.60',
    agentMaxPriceGhs: '5.90',
    storePriceGhs: '4.50',
    pricingMode: CatalogPricingMode.FIXED,
    description: '',
    sku: '',
    status: CatalogPlanStatus.ACTIVE,
    availableForCustomer: true,
    availableForAgent: true,
    availableForStore: true,
    availableForApi: true,
    popular: false,
    changeReason: '',
  });

  // 7. Plan Dossier Detail Drawer
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<AdminCatalogPlanDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'ANALYTICS' | 'ORDERS' | 'PRICE_HISTORY'>('OVERVIEW');

  // Common Button Styles matching AdminAgentsPage design system
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
    minWidth: '125px',
    boxShadow: 'var(--shadow-tactile-sm)',
  };

  // 8. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getCatalogStats();
      if (res) setStats(res);
    } catch {
      // Graceful fallback
    }
  }, []);

  // 9. Fetch Plans
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCatalogPlans({
        page: pagination.page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        provider: providerFilter !== 'ALL' ? providerFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        providerStatus: providerStatusFilter !== 'ALL' ? providerStatusFilter : undefined,
        customerAvailability: customerFilter !== 'ALL' ? customerFilter : undefined,
        agentAvailability: agentFilter !== 'ALL' ? agentFilter : undefined,
        storeAvailability: storeFilter !== 'ALL' ? storeFilter : undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      });

      if (res) {
        setPlans(res.items || []);
        if (res.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          }));
        }
      }
    } catch (err: any) {
      toastError('Failed to fetch data plans', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    search,
    networkFilter,
    providerFilter,
    statusFilter,
    providerStatusFilter,
    customerFilter,
    agentFilter,
    storeFilter,
    minPrice,
    maxPrice,
    toastError,
  ]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Handle Inspect Plan Dossier
  const handleInspectPlan = async (id: string) => {
    try {
      const res = await adminApi.getCatalogPlanDetail(id);
      if (res) {
        setSelectedPlanDetail(res);
        setDetailTab('OVERVIEW');
      }
    } catch (err: any) {
      toastError('Failed to load plan details', err.message);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (plan: CatalogProductDto) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      network: plan.network,
      providerName: plan.providerName || 'DataHouse',
      providerPlanId: plan.providerPlanId || '',
      providerPlanCode: plan.providerPlanCode || '',
      providerProductCode: plan.providerProductCode || '',
      dataAmountMb: plan.dataAmountMb,
      validityDays: plan.validityDays,
      validityDesc: plan.validityDesc || `${plan.validityDays} Days`,
      providerPriceGhs: (plan.providerPricePesewas ? plan.providerPricePesewas / 100 : 0).toFixed(2),
      customerPriceGhs: (plan.basePricePesewas / 100).toFixed(2),
      agentPriceGhs: plan.agentPricePesewas ? (plan.agentPricePesewas / 100).toFixed(2) : '',
      agentMinPriceGhs: plan.agentMinPricePesewas ? (plan.agentMinPricePesewas / 100).toFixed(2) : '',
      agentMaxPriceGhs: plan.agentMaxPricePesewas ? (plan.agentMaxPricePesewas / 100).toFixed(2) : '',
      storePriceGhs: plan.storePricePesewas ? (plan.storePricePesewas / 100).toFixed(2) : '',
      pricingMode: plan.pricingMode || CatalogPricingMode.FIXED,
      description: plan.description || '',
      sku: plan.sku,
      status: plan.status || CatalogPlanStatus.ACTIVE,
      availableForCustomer: plan.availableForCustomer !== undefined ? plan.availableForCustomer : true,
      availableForAgent: plan.availableForAgent !== undefined ? plan.availableForAgent : true,
      availableForStore: plan.availableForStore !== undefined ? plan.availableForStore : true,
      availableForApi: plan.availableForApi !== undefined ? plan.availableForApi : true,
      popular: Boolean(plan.popular),
      changeReason: '',
    });
    setIsCreateModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      network: NetworkProvider.MTN,
      providerName: 'DataHouse',
      providerPlanId: '',
      providerPlanCode: '',
      providerProductCode: '',
      dataAmountMb: 1024,
      validityDays: 30,
      validityDesc: 'Non-Expiry',
      providerPriceGhs: '3.50',
      customerPriceGhs: '6.00',
      agentPriceGhs: '3.80',
      agentMinPriceGhs: '3.60',
      agentMaxPriceGhs: '5.90',
      storePriceGhs: '4.50',
      pricingMode: CatalogPricingMode.FIXED,
      description: '',
      sku: '',
      status: CatalogPlanStatus.ACTIVE,
      availableForCustomer: true,
      availableForAgent: true,
      availableForStore: true,
      availableForApi: true,
      popular: false,
      changeReason: '',
    });
    setIsCreateModalOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const custGhs = parseFloat(formData.customerPriceGhs);
    const provGhs = parseFloat(formData.providerPriceGhs || '0');
    const agentGhs = formData.agentPriceGhs ? parseFloat(formData.agentPriceGhs) : null;
    const storeGhs = formData.storePriceGhs ? parseFloat(formData.storePriceGhs) : null;

    if (isNaN(custGhs) || custGhs <= 0) {
      toastError('Validation Error', 'Customer price must be greater than 0.');
      return;
    }

    if (agentGhs !== null && agentGhs >= custGhs) {
      toastError('Pricing Rule Violation', 'Agent wholesale price must be lower than customer retail price.');
      return;
    }

    try {
      if (editingPlan) {
        const updatePayload: UpdateCatalogPlanRequest = {
          name: formData.name,
          network: formData.network,
          providerName: formData.providerName,
          providerPlanId: formData.providerPlanId || undefined,
          providerPlanCode: formData.providerPlanCode || undefined,
          providerProductCode: formData.providerProductCode || undefined,
          dataAmountMb: formData.dataAmountMb,
          validityDays: formData.validityDays,
          validityDesc: formData.validityDesc,
          providerPricePesewas: Math.round(provGhs * 100),
          basePricePesewas: Math.round(custGhs * 100),
          agentPricePesewas: agentGhs !== null ? Math.round(agentGhs * 100) : undefined,
          agentMinPricePesewas: formData.agentMinPriceGhs ? Math.round(parseFloat(formData.agentMinPriceGhs) * 100) : undefined,
          agentMaxPricePesewas: formData.agentMaxPriceGhs ? Math.round(parseFloat(formData.agentMaxPriceGhs) * 100) : undefined,
          storePricePesewas: storeGhs !== null ? Math.round(storeGhs * 100) : undefined,
          pricingMode: formData.pricingMode,
          description: formData.description,
          status: formData.status,
          availableForCustomer: formData.availableForCustomer,
          availableForAgent: formData.availableForAgent,
          availableForStore: formData.availableForStore,
          availableForApi: formData.availableForApi,
          popular: formData.popular,
          changeReason: formData.changeReason || 'Administrative update',
        };

        await adminApi.updateCatalogPlan(editingPlan.id, updatePayload);
        toastSuccess('Plan Updated', `Successfully updated ${formData.name}`);
      } else {
        const createPayload: CreateCatalogPlanRequest = {
          name: formData.name,
          network: formData.network,
          providerName: formData.providerName,
          providerPlanId: formData.providerPlanId || undefined,
          providerPlanCode: formData.providerPlanCode || undefined,
          providerProductCode: formData.providerProductCode || undefined,
          dataAmountMb: formData.dataAmountMb,
          validityDays: formData.validityDays,
          validityDesc: formData.validityDesc,
          providerPricePesewas: Math.round(provGhs * 100),
          basePricePesewas: Math.round(custGhs * 100),
          agentPricePesewas: agentGhs !== null ? Math.round(agentGhs * 100) : undefined,
          agentMinPricePesewas: formData.agentMinPriceGhs ? Math.round(parseFloat(formData.agentMinPriceGhs) * 100) : undefined,
          agentMaxPricePesewas: formData.agentMaxPriceGhs ? Math.round(parseFloat(formData.agentMaxPriceGhs) * 100) : undefined,
          storePricePesewas: storeGhs !== null ? Math.round(storeGhs * 100) : undefined,
          pricingMode: formData.pricingMode,
          description: formData.description,
          sku: formData.sku || undefined,
          status: formData.status,
          availableForCustomer: formData.availableForCustomer,
          availableForAgent: formData.availableForAgent,
          availableForStore: formData.availableForStore,
          availableForApi: formData.availableForApi,
          popular: formData.popular,
        };

        await adminApi.createCatalogPlan(createPayload);
        toastSuccess('Plan Created', `Successfully created ${formData.name}`);
      }

      setIsCreateModalOpen(false);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Operation Failed', err.message || 'Could not save data plan.');
    }
  };

  // Toggle Plan Status (Active / Disabled)
  const handleToggleStatus = async (plan: CatalogProductDto) => {
    const nextStatus = plan.status === CatalogPlanStatus.ACTIVE ? CatalogPlanStatus.DISABLED : CatalogPlanStatus.ACTIVE;
    try {
      await adminApi.updatePlanStatus(plan.id, nextStatus, 'Admin quick status toggle');
      toastSuccess('Status Changed', `${plan.name} is now ${nextStatus}`);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Status Toggle Failed', err.message);
    }
  };

  // Preview Bulk Pricing
  const handlePreviewBulkPricing = async () => {
    setPreviewLoading(true);
    try {
      const res = await adminApi.previewBulkPricing({
        network: networkFilter !== 'ALL' ? (networkFilter as NetworkProvider) : 'ALL',
        planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
        customerMarkupPercent: customerMarkupPct ? parseFloat(customerMarkupPct) : undefined,
        agentMarkupPercent: agentMarkupPct ? parseFloat(agentMarkupPct) : undefined,
        storeMarkupPercent: storeMarkupPct ? parseFloat(storeMarkupPct) : undefined,
      });

      if (res) {
        setBulkPricingPreview(res.plans);
        setBulkPricingDiffTotal(res.totalDailyRevenueDiffPesewas);
      }
    } catch (err: any) {
      toastError('Preview Failed', err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Apply Bulk Pricing
  const handleApplyBulkPricing = async () => {
    if (!bulkPricingReason || bulkPricingReason.trim().length < 5) {
      toastError('Validation Error', 'A mandatory reason of at least 5 characters is required.');
      return;
    }

    setBulkProcessing(true);
    try {
      const res = await adminApi.applyBulkPricing({
        network: networkFilter !== 'ALL' ? (networkFilter as NetworkProvider) : 'ALL',
        planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
        customerMarkupPercent: customerMarkupPct ? parseFloat(customerMarkupPct) : undefined,
        agentMarkupPercent: agentMarkupPct ? parseFloat(agentMarkupPct) : undefined,
        storeMarkupPercent: storeMarkupPct ? parseFloat(storeMarkupPct) : undefined,
        reason: bulkPricingReason,
      });

      toastSuccess('Pricing Updated', `Successfully updated pricing on ${res?.updatedCount || 0} plans.`);
      setIsBulkPricingOpen(false);
      setBulkPricingPreview(null);
      setBulkPricingReason('');
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Bulk Pricing Failed', err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Load Sync Batches
  const loadSyncBatches = async () => {
    try {
      const res = await adminApi.getSyncBatches();
      if (res) {
        setSyncBatches(res);
        if (res.length > 0) {
          const detailRes = await adminApi.getSyncBatchDetail(res[0].id);
          if (detailRes) setActiveSyncBatch(detailRes);
        }
      }
    } catch {
      // Graceful
    }
  };

  const handleOpenSyncModal = () => {
    setIsSyncModalOpen(true);
    loadSyncBatches();
  };

  // Trigger Provider Catalog Sync
  const handleTriggerSync = async () => {
    setSyncLoading(true);
    try {
      const res = await adminApi.triggerProviderCatalogSync({
        autoApply: false,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
      });

      toastSuccess('Sync Complete', `Synchronized DataHouse catalog: ${res?.discrepancyCount || 0} discrepancies found.`);
      loadSyncBatches();
    } catch (err: any) {
      toastError('Sync Failed', err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Apply Sync Batch
  const handleApplySyncBatch = async (batchId: string) => {
    try {
      await adminApi.applySyncBatch(batchId);
      toastSuccess('Catalog Updated', 'Applied DataHouse catalog diffs to ByteBeacon.');
      loadSyncBatches();
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Failed to apply sync batch', err.message);
    }
  };

  // Export Catalog
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await adminApi.exportCatalog({
        format,
        network: networkFilter !== 'ALL' ? networkFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      if (format === 'csv') {
        const blob = new Blob([res as any], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } else {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bytebeacon-catalog-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      }
      toastSuccess('Export Successful', `Catalog exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toastError('Export Failed', err.message);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedPlanIds.length === plans.length) {
      setSelectedPlanIds([]);
    } else {
      setSelectedPlanIds(plans.map((p) => p.id));
    }
  };

  const toggleSelectPlan = (id: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Channel view switch
  const handleSelectChannelTab = (tab: 'ALL' | 'CUSTOMER' | 'AGENT' | 'STORE') => {
    setActiveChannelTab(tab);
    if (tab === 'ALL') {
      setCustomerFilter('ALL');
      setAgentFilter('ALL');
      setStoreFilter('ALL');
    } else if (tab === 'CUSTOMER') {
      setCustomerFilter('AVAILABLE');
      setAgentFilter('ALL');
      setStoreFilter('ALL');
    } else if (tab === 'AGENT') {
      setCustomerFilter('ALL');
      setAgentFilter('AVAILABLE');
      setStoreFilter('ALL');
    } else if (tab === 'STORE') {
      setCustomerFilter('ALL');
      setAgentFilter('ALL');
      setStoreFilter('AVAILABLE');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Prompt Single Plan Delete
  const handlePromptDelete = (plan: CatalogProductDto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlanToDelete(plan);
    setIsDeleteModalOpen(true);
  };

  // Confirm Single Plan Delete
  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    setDeleteLoading(true);
    try {
      await adminApi.deleteCatalogPlan(planToDelete.id);
      toastSuccess('Plan Deleted', `Successfully deleted plan "${planToDelete.name}"`);
      setIsDeleteModalOpen(false);
      setPlanToDelete(null);
      if (selectedPlanDetail?.id === planToDelete.id) {
        setSelectedPlanDetail(null);
      }
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Delete Failed', err.message || 'Could not delete plan.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Execute Bulk Action (Activate, Disable, Archive, Delete, Channel Toggles)
  const handleExecuteBulkAction = async (action: any) => {
    if (selectedPlanIds.length === 0) return;
    if (action === 'DELETE') {
      setIsBulkDeleteModalOpen(true);
      return;
    }
    setBulkProcessing(true);
    try {
      const res = await adminApi.executeBulkCatalogAction({
        planIds: selectedPlanIds,
        action,
        reason: 'Admin bulk action',
      });
      toastSuccess('Bulk Action Executed', `Updated ${res?.affectedCount || selectedPlanIds.length} plans.`);
      setSelectedPlanIds([]);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Bulk Action Failed', err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Confirm Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedPlanIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await adminApi.executeBulkCatalogAction({
        planIds: selectedPlanIds,
        action: 'DELETE',
        reason: 'Administrative bulk deletion',
      });
      toastSuccess('Bulk Deletion Complete', `Deleted ${res?.affectedCount || selectedPlanIds.length} plans.`);
      setSelectedPlanIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Bulk Action Failed', err.message || 'Could not delete selected plans.');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Quick Channel Visibility Toggles
  const handleToggleCustomerVisibility = async (plan: CatalogProductDto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextVal = !plan.availableForCustomer;
    try {
      await adminApi.updatePlanVisibility(plan.id, { availableForCustomer: nextVal });
      toastSuccess('Visibility Updated', `Customer portal ${nextVal ? 'enabled' : 'disabled'} for ${plan.name}`);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    }
  };

  const handleToggleAgentVisibility = async (plan: CatalogProductDto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextVal = !plan.availableForAgent;
    try {
      await adminApi.updatePlanVisibility(plan.id, { availableForAgent: nextVal });
      toastSuccess('Visibility Updated', `Agent wholesale portal ${nextVal ? 'enabled' : 'disabled'} for ${plan.name}`);
      fetchPlans();
      fetchStats();
    } catch (err: any) {
      toastError('Update Failed', err.message);
    }
  };

  // Margin calculation helpers for form
  const calcFormMargins = () => {
    const cust = parseFloat(formData.customerPriceGhs) || 0;
    const prov = parseFloat(formData.providerPriceGhs) || 0;
    const agent = parseFloat(formData.agentPriceGhs) || 0;
    const store = parseFloat(formData.storePriceGhs) || 0;

    const custMargin = cust - prov;
    const custPct = cust > 0 ? ((custMargin / cust) * 100).toFixed(1) : '0';

    const agentMargin = agent > 0 ? agent - prov : 0;
    const agentPct = agent > 0 ? ((agentMargin / agent) * 100).toFixed(1) : '0';

    const storeMargin = store > 0 ? store - (agent > 0 ? agent : prov) : 0;
    const storePct = store > 0 ? ((storeMargin / store) * 100).toFixed(1) : '0';

    return { custMargin, custPct, agentMargin, agentPct, storeMargin, storePct };
  };

  const margins = calcFormMargins();

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

    if (networkFilter !== 'ALL') {
      filters.push({
        id: 'network',
        label: `Network: ${networkFilter}`,
        onRemove: () => setNetworkFilter('ALL'),
      });
    }

    if (statusFilter !== 'ALL') {
      filters.push({
        id: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => setStatusFilter('ALL'),
      });
    }

    if (providerStatusFilter !== 'ALL') {
      filters.push({
        id: 'providerStatus',
        label: `Prov State: ${providerStatusFilter}`,
        onRemove: () => setProviderStatusFilter('ALL'),
      });
    }

    if (providerFilter !== 'ALL') {
      filters.push({
        id: 'provider',
        label: `Provider: ${providerFilter}`,
        onRemove: () => setProviderFilter('ALL'),
      });
    }

    if (customerFilter !== 'ALL') {
      filters.push({
        id: 'customer',
        label: `Customer: ${customerFilter === 'AVAILABLE' ? 'Enabled' : 'Hidden'}`,
        onRemove: () => setCustomerFilter('ALL'),
      });
    }

    if (agentFilter !== 'ALL') {
      filters.push({
        id: 'agent',
        label: `Agent: ${agentFilter === 'AVAILABLE' ? 'Enabled' : 'Hidden'}`,
        onRemove: () => setAgentFilter('ALL'),
      });
    }

    if (storeFilter !== 'ALL') {
      filters.push({
        id: 'store',
        label: `Store: ${storeFilter === 'AVAILABLE' ? 'Enabled' : 'Hidden'}`,
        onRemove: () => setStoreFilter('ALL'),
      });
    }

    if (minPrice) {
      filters.push({
        id: 'minPrice',
        label: `Min: GH₵ ${minPrice}`,
        onRemove: () => setMinPrice(''),
      });
    }

    if (maxPrice) {
      filters.push({
        id: 'maxPrice',
        label: `Max: GH₵ ${maxPrice}`,
        onRemove: () => setMaxPrice(''),
      });
    }

    return filters;
  }, [
    search,
    networkFilter,
    statusFilter,
    providerStatusFilter,
    providerFilter,
    customerFilter,
    agentFilter,
    storeFilter,
    minPrice,
    maxPrice,
  ]);

  const handleResetFilters = () => {
    setSearch('');
    setNetworkFilter('ALL');
    setStatusFilter('ALL');
    setProviderStatusFilter('ALL');
    setProviderFilter('ALL');
    setCustomerFilter('ALL');
    setAgentFilter('ALL');
    setStoreFilter('ALL');
    setMinPrice('');
    setMaxPrice('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={ShoppingBag} color="speed" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-warning-bright)' }}>
              Commercial Catalog Control Plane
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Data Plans & Catalog Pricing
            </h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Manage, price, publish, and monitor all telecom data bundles available across ByteBeacon.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            style={tactileButtonStyle}
            title="Export catalog as CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSyncModal}
            style={tactileButtonStyle}
            title="Review DataHouse catalog differences"
          >
            <Zap size={14} />
            <span>Sync Provider</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkPricingOpen(true)}
            style={tactileButtonStyle}
            title="Open bulk markup adjustment calculator"
          >
            <Sliders size={14} />
            <span>Bulk Pricing</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={primaryButtonStyle}
            title="Create new data plan"
          >
            <Plus size={14} />
            <span>Add Data Plan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchPlans();
              fetchStats();
            }}
            disabled={loading}
            style={{
              ...tactileButtonStyle,
              padding: '0.45rem 0.6rem',
              color: 'var(--color-text-muted)',
            }}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Metric Cards (8 cards in auto-fit grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title="Total Plans"
          value={stats ? stats.totalPlans.toString() : '—'}
          subvalue="All catalog bundles"
          accent="blue"
          icon={<TactileIcon icon={Layers} color="orders" size="sm" />}
        />
        <MetricCard
          title="Active Plans"
          value={stats ? stats.activePlans.toString() : '—'}
          subvalue="Currently purchasable"
          accent="green"
          icon={<TactileIcon icon={CheckCircle} color="security" size="sm" />}
        />
        <MetricCard
          title="Disabled / Archived"
          value={stats ? stats.disabledPlans.toString() : '—'}
          subvalue="Locked or retired"
          accent="red"
          icon={<TactileIcon icon={XCircle} color="red" size="sm" />}
        />
        <MetricCard
          title="Customer Retail"
          value={stats ? stats.customerPlans.toString() : '—'}
          subvalue="Retail web & app"
          accent="cyan"
          icon={<TactileIcon icon={Globe} color="speed" size="sm" />}
        />
        <MetricCard
          title="Agent Wholesale"
          value={stats ? stats.agentPlans.toString() : '—'}
          subvalue="Wholesale portal"
          accent="orange"
          icon={<TactileIcon icon={TrendingUp} color="speed" size="sm" />}
        />
        <MetricCard
          title="Storefront Plans"
          value={stats ? stats.storePlans.toString() : '—'}
          subvalue="Reseller storefronts"
          accent="purple"
          icon={<TactileIcon icon={Store} color="api" size="sm" />}
        />
        <MetricCard
          title="Provider Synced"
          value={stats ? stats.providerSynced.toString() : '—'}
          subvalue="DataHouse matched"
          accent="green"
          icon={<TactileIcon icon={Zap} color="security" size="sm" />}
        />
        <MetricCard
          title="Sync Issues"
          value={stats ? stats.syncIssues.toString() : '—'}
          subvalue="Diff discrepancies"
          accent={stats && stats.syncIssues > 0 ? 'red' : 'green'}
          icon={<TactileIcon icon={AlertTriangle} color={stats && stats.syncIssues > 0 ? 'red' : 'emerald'} size="sm" />}
        />
      </div>

      {/* 3. Segmented Channel View Switcher Bar */}
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
          { id: 'ALL', label: 'All Bundles', count: stats?.totalPlans ?? pagination.total, icon: <Layers size={13} /> },
          { id: 'CUSTOMER', label: 'Customer Retail', count: stats?.customerPlans ?? 0, icon: <Globe size={13} /> },
          { id: 'AGENT', label: 'Agent Wholesale', count: stats?.agentPlans ?? 0, icon: <TrendingUp size={13} /> },
          { id: 'STORE', label: 'Storefront Resale', count: stats?.storePlans ?? 0, icon: <Store size={13} /> },
        ].map((tab) => {
          const isActive = activeChannelTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectChannelTab(tab.id as any)}
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

      {/* 4. Compact Standardized Filter Card */}
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
          {/* Search bar */}
          <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
            <SearchInput
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              placeholder="Search plans, codes, SKU, network, provider..."
            />
          </div>

          {/* Primary Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {/* Carrier Network */}
            <select
              value={networkFilter}
              onChange={(e) => {
                setNetworkFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Network"
            >
              <option value="ALL">All Networks</option>
              <option value={NetworkProvider.MTN}>MTN Ghana</option>
              <option value={NetworkProvider.TELECEL}>Telecel Ghana</option>
              <option value={NetworkProvider.AIRTELTIGO}>AirtelTigo</option>
            </select>

            {/* ByteBeacon Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="ARCHIVED">Archived</option>
              <option value="DRAFT">Draft</option>
            </select>

            {/* Provider Status */}
            <select
              value={providerStatusFilter}
              onChange={(e) => {
                setProviderStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Provider Status"
            >
              <option value="ALL">All Provider States</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
              <option value="PROVIDER_REMOVED">Provider Removed</option>
              <option value="SYNC_ERROR">Sync Error</option>
            </select>

            {/* Provider Name */}
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Provider"
            >
              <option value="ALL">All Providers</option>
              <option value="DataHouse">DataHouse</option>
              <option value="GMPL">GMPL</option>
            </select>

            {/* Advanced Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                ...tactileButtonStyle,
                backgroundColor: showAdvancedFilters ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
                borderColor: showAdvancedFilters ? 'var(--color-border-focus)' : 'var(--color-border-subtle)',
              }}
              title="Toggle channel visibility & price filters"
            >
              <Filter size={13} />
              <span>More Filters</span>
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters Row */}
        {showAdvancedFilters && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem',
              alignItems: 'center',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            {/* Customer Channel Filter */}
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Customer Channel"
            >
              <option value="ALL">Customer Channel: All</option>
              <option value="AVAILABLE">Customer: Published</option>
              <option value="HIDDEN">Customer: Hidden</option>
            </select>

            {/* Agent Wholesale Filter */}
            <select
              value={agentFilter}
              onChange={(e) => {
                setAgentFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Agent Wholesale"
            >
              <option value="ALL">Agent Wholesale: All</option>
              <option value="AVAILABLE">Agent: Published</option>
              <option value="HIDDEN">Agent: Hidden</option>
            </select>

            {/* Storefront Filter */}
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={selectStyle}
              aria-label="Filter by Storefront"
            >
              <option value="ALL">Store Resale: All</option>
              <option value="AVAILABLE">Store: Published</option>
              <option value="HIDDEN">Store: Hidden</option>
            </select>

            {/* Price Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Price (GHS):</span>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  width: '75px',
                  padding: '0.4rem 0.55rem',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  width: '75px',
                  padding: '0.4rem 0.55rem',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Active Filter Chips & Clear */}
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

        {/* Bulk Action Bar (When items selected) */}
        {selectedPlanIds.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.65rem 0.95rem',
              backgroundColor: 'rgba(0, 102, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-brand)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand)' }}>
              {selectedPlanIds.length} plans selected
            </span>

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsBulkPricingOpen(true)}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
              >
                <Sliders size={12} />
                <span>Bulk Pricing</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAction('ACTIVATE')}
                disabled={bulkProcessing}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
              >
                <span>Activate</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAction('DISABLE')}
                disabled={bulkProcessing}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
              >
                <span>Disable</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAction('ENABLE_CUSTOMER')}
                disabled={bulkProcessing}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
              >
                <Globe size={12} />
                <span>Enable Retail</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBulkAction('ENABLE_AGENT')}
                disabled={bulkProcessing}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
              >
                <TrendingUp size={12} />
                <span>Enable Wholesale</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                disabled={bulkProcessing}
                style={{
                  ...tactileButtonStyle,
                  padding: '0.35rem 0.65rem',
                  fontSize: '11px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--color-danger)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <Trash2 size={12} />
                <span>Delete Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlanIds([])}
                style={{ ...tactileButtonStyle, padding: '0.35rem 0.55rem', fontSize: '11px' }}
              >
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Plans Primary Table Card */}
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
              Commercial Data Bundles & Channel Matrix
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0.15rem 0 0 0' }}>
              Authoritative pricing, provider mappings, validity periods, and retail / wholesale margins.
            </p>
          </div>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {plans.length} of {pagination.total} plans
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={[
              {
                header: (
                  <input
                    type="checkbox"
                    checked={plans.length > 0 && selectedPlanIds.length === plans.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                ),
                accessor: 'id',
                render: (row) => (
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.includes(row.id)}
                    onChange={() => toggleSelectPlan(row.id)}
                    style={{ cursor: 'pointer' }}
                  />
                ),
                width: '40px',
              },
              {
                header: 'Plan / SKU',
                accessor: 'name',
                render: (row) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                        {row.name}
                      </span>
                      {row.popular && (
                        <Badge variant="warning" size="sm">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      SKU: {row.sku}
                    </span>
                  </div>
                ),
              },
              {
                header: 'Network',
                accessor: 'network',
                render: (row) => (
                  <Badge
                    variant={
                      row.network === NetworkProvider.MTN
                        ? 'warning'
                        : row.network === NetworkProvider.TELECEL
                        ? 'danger'
                        : 'info'
                    }
                    size="sm"
                  >
                    {row.network}
                  </Badge>
                ),
              },
              {
                header: 'Size & Validity',
                accessor: 'dataAmountMb',
                render: (row) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                      {(row.dataAmountMb / 1024).toFixed(row.dataAmountMb % 1024 === 0 ? 0 : 1)} GB
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {row.validityDesc || `${row.validityDays} Days`}
                    </span>
                  </div>
                ),
              },
              {
                header: 'Provider Cost',
                accessor: 'providerPricePesewas',
                render: (row) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    GH₵ {((row.providerPricePesewas || 0) / 100).toFixed(2)}
                  </span>
                ),
              },
              {
                header: 'Customer Retail',
                accessor: 'basePricePesewas',
                render: (row) => {
                  const cost = row.providerPricePesewas || 0;
                  const margin = row.basePricePesewas - cost;
                  const pct = row.basePricePesewas > 0 ? ((margin / row.basePricePesewas) * 100).toFixed(0) : '0';
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          GH₵ {(row.basePricePesewas / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleCustomerVisibility(row, e)}
                          title={row.availableForCustomer ? 'Customer Retail Published (Click to hide)' : 'Hidden from Retail (Click to publish)'}
                          style={{
                            border: 'none',
                            background: row.availableForCustomer ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: row.availableForCustomer ? '#10B981' : '#EF4444',
                            borderRadius: 'var(--radius-full)',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Globe size={10} />
                          <span>{row.availableForCustomer ? 'Retail' : 'Hidden'}</span>
                        </button>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#10B981', fontWeight: 600 }}>
                        Margin: +GH₵ {(margin / 100).toFixed(2)} ({pct}%)
                      </span>
                    </div>
                  );
                },
              },
              {
                header: 'Agent Wholesale',
                accessor: 'agentPricePesewas',
                render: (row) => {
                  const cost = row.providerPricePesewas || 0;
                  const agentPrice = row.agentPricePesewas;
                  if (!agentPrice) {
                    return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>;
                  }
                  const margin = agentPrice - cost;
                  const pct = agentPrice > 0 ? ((margin / agentPrice) * 100).toFixed(0) : '0';
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand)', fontSize: 'var(--font-size-xs)' }}>
                          GH₵ {(agentPrice / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleAgentVisibility(row, e)}
                          title={row.availableForAgent ? 'Agent Wholesale Published (Click to hide)' : 'Hidden from Agents (Click to publish)'}
                          style={{
                            border: 'none',
                            background: row.availableForAgent ? 'rgba(0, 102, 255, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: row.availableForAgent ? 'var(--color-brand)' : '#EF4444',
                            borderRadius: 'var(--radius-full)',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <TrendingUp size={10} />
                          <span>{row.availableForAgent ? 'Wholesale' : 'Hidden'}</span>
                        </button>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-brand)', fontWeight: 600 }}>
                        Margin: +GH₵ {(margin / 100).toFixed(2)} ({pct}%)
                      </span>
                    </div>
                  );
                },
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (row) => (
                  <Badge
                    variant={
                      row.status === 'ACTIVE'
                        ? 'success'
                        : row.status === 'ARCHIVED'
                        ? 'neutral'
                        : row.status === 'DRAFT'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {row.status || (row.isActive ? 'ACTIVE' : 'DISABLED')}
                  </Badge>
                ),
              },
              {
                header: 'Actions',
                accessor: 'id',
                render: (row) => (
                  <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleInspectPlan(row.id)}
                      style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                      title="View Plan Dossier"
                    >
                      <Eye size={12} />
                      <span>Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(row)}
                      style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                      title="Edit Pricing & Channels"
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(row)}
                      style={{
                        ...tactileButtonStyle,
                        padding: '0.35rem 0.55rem',
                        fontSize: '11px',
                        color: row.status === 'ACTIVE' ? 'var(--color-danger)' : 'var(--color-emerald)',
                      }}
                      title={row.status === 'ACTIVE' ? 'Disable plan' : 'Enable plan'}
                    >
                      {row.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePromptDelete(row, e)}
                      style={{
                        ...tactileButtonStyle,
                        padding: '0.35rem 0.55rem',
                        fontSize: '11px',
                        color: 'var(--color-danger)',
                      }}
                      title="Delete / Archive Plan"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ),
              },
            ]}
            data={plans}
            keyExtractor={(item) => item.id}
            emptyText="No data plans found matching criteria."
          />
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
            Showing {plans.length} of {pagination.total} plans (Page {pagination.page} of {pagination.totalPages})
          </span>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              style={{
                ...tactileButtonStyle,
                padding: '0.35rem 0.65rem',
                opacity: pagination.page <= 1 ? 0.5 : 1,
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', padding: '0 0.5rem' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
              style={{
                ...tactileButtonStyle,
                padding: '0.35rem 0.65rem',
                opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 6. MODALS (Non-overlapping, rendered at high z-index via Modal component) */}
      {/* ========================================================================= */}

      {/* A. Create / Edit Data Plan Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingPlan ? `Edit Plan: ${formData.name}` : 'Create New Data Plan'}
        maxWidth="680px"
      >
        <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          {/* Basic Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Plan Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 5GB Non-Expiry"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Network Carrier *</label>
              <select
                value={formData.network}
                onChange={(e) => setFormData({ ...formData, network: e.target.value as NetworkProvider })}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value={NetworkProvider.MTN}>MTN Ghana</option>
                <option value={NetworkProvider.TELECEL}>Telecel Ghana</option>
                <option value={NetworkProvider.AIRTELTIGO}>AirtelTigo</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Data Volume (MB) *</label>
              <Input
                type="number"
                value={formData.dataAmountMb}
                onChange={(e) => setFormData({ ...formData, dataAmountMb: parseInt(e.target.value, 10) || 1024 })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Validity (Days) *</label>
              <Input
                type="number"
                value={formData.validityDays}
                onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value, 10) || 30 })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Validity Display</label>
              <Input
                value={formData.validityDesc}
                onChange={(e) => setFormData({ ...formData, validityDesc: e.target.value })}
                placeholder="Non-Expiry"
              />
            </div>
          </div>

          {/* Provider Mapping Identifiers */}
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              Telecom Provider Mapping (DataHouse Authority)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Provider Name</label>
                <Input
                  value={formData.providerName}
                  onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Provider Plan ID</label>
                <Input
                  value={formData.providerPlanId}
                  onChange={(e) => setFormData({ ...formData, providerPlanId: e.target.value })}
                  placeholder="dh_mtn_5gb"
                />
              </div>
            </div>
          </div>

          {/* Pricing Section with Margin Spread */}
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-brand)', letterSpacing: '0.04em' }}>
              Multi-Tier Pricing & Spread Calculations
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Provider Cost (GHS) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.providerPriceGhs}
                  onChange={(e) => setFormData({ ...formData, providerPriceGhs: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Customer Retail Price (GHS) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.customerPriceGhs}
                  onChange={(e) => setFormData({ ...formData, customerPriceGhs: e.target.value })}
                  required
                />
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                  Customer Margin: +GH₵ {margins.custMargin.toFixed(2)} ({margins.custPct}%)
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Agent Wholesale Price (GHS)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.agentPriceGhs}
                  onChange={(e) => setFormData({ ...formData, agentPriceGhs: e.target.value })}
                />
                <span style={{ fontSize: '10px', color: 'var(--color-brand)', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                  Agent Margin: +GH₵ {margins.agentMargin.toFixed(2)} ({margins.agentPct}%)
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Store Default Price (GHS)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.storePriceGhs}
                  onChange={(e) => setFormData({ ...formData, storePriceGhs: e.target.value })}
                />
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                  Store Margin: +GH₵ {margins.storeMargin.toFixed(2)} ({margins.storePct}%)
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Agent Min Resale Cap (GHS)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional lower limit"
                  value={formData.agentMinPriceGhs}
                  onChange={(e) => setFormData({ ...formData, agentMinPriceGhs: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Agent Max Resale Cap (GHS)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional upper limit"
                  value={formData.agentMaxPriceGhs}
                  onChange={(e) => setFormData({ ...formData, agentMaxPriceGhs: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Publishing & Visibility Controls */}
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: 'var(--space-2)' }}>Channel Publishing Controls</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.availableForCustomer}
                  onChange={(e) => setFormData({ ...formData, availableForCustomer: e.target.checked })}
                />
                <span>Customer Retail Portal</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.availableForAgent}
                  onChange={(e) => setFormData({ ...formData, availableForAgent: e.target.checked })}
                />
                <span>Agent Wholesale Portal</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.availableForStore}
                  onChange={(e) => setFormData({ ...formData, availableForStore: e.target.checked })}
                />
                <span>Agent Storefronts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.availableForApi}
                  onChange={(e) => setFormData({ ...formData, availableForApi: e.target.checked })}
                />
                <span>Developer REST API</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.popular}
                onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
              />
              <span>Mark as Popular Bundle</span>
            </label>
          </div>

          {editingPlan && (
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Change Reason (Audit Trail) *</label>
              <Input
                value={formData.changeReason}
                onChange={(e) => setFormData({ ...formData, changeReason: e.target.value })}
                placeholder="e.g. Updating customer retail and agent wholesale rates"
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button type="submit" style={primaryButtonStyle}>
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* B. Single Plan Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen && !!planToDelete}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Data Plan"
        maxWidth="480px"
      >
        {planToDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <TactileIcon icon={Trash2} color="red" size="md" />
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {planToDelete.name} ({planToDelete.network} - {planToDelete.sku})
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Permanent Removal or Archival Protection
                </span>
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete this data plan bundle?
              <br />
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                Note: If historical orders exist for this bundle, it will be safely archived to protect audit trails and customer records.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteLoading}
                style={tactileButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                disabled={deleteLoading}
                style={{
                  ...tactileButtonStyle,
                  backgroundColor: 'var(--color-danger)',
                  color: '#fff',
                  borderColor: 'var(--color-danger)',
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* C. Bulk Delete Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title={`Delete ${selectedPlanIds.length} Data Plans`}
        maxWidth="480px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <TactileIcon icon={Trash2} color="red" size="md" />
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Batch Removal & Archival
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Affects {selectedPlanIds.length} selected bundles
              </span>
            </div>
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Are you sure you want to delete all <strong>{selectedPlanIds.length}</strong> selected data plans?
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={bulkProcessing}
              style={tactileButtonStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmBulkDelete}
              disabled={bulkProcessing}
              style={{
                ...tactileButtonStyle,
                backgroundColor: 'var(--color-danger)',
                color: '#fff',
                borderColor: 'var(--color-danger)',
              }}
            >
              {bulkProcessing ? 'Deleting...' : `Delete ${selectedPlanIds.length} Plans`}
            </button>
          </div>
        </div>
      </Modal>

      {/* D. Bulk Pricing Calculator Modal */}
      <Modal
        isOpen={isBulkPricingOpen}
        onClose={() => setIsBulkPricingOpen(false)}
        title="Bulk Pricing Markup Calculator"
        maxWidth="700px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Apply percentage markup adjustments across {selectedPlanIds.length > 0 ? `${selectedPlanIds.length} selected plans` : 'all active catalog plans'}.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Customer Markup (%)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="+5.0"
                value={customerMarkupPct}
                onChange={(e) => setCustomerMarkupPct(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Agent Markup (%)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="+2.0"
                value={agentMarkupPct}
                onChange={(e) => setAgentMarkupPct(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Store Markup (%)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="+3.0"
                value={storeMarkupPct}
                onChange={(e) => setStoreMarkupPct(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePreviewBulkPricing}
            disabled={previewLoading}
            style={{ ...tactileButtonStyle, alignSelf: 'flex-start' }}
          >
            <Eye size={13} />
            <span>{previewLoading ? 'Calculating Impact...' : 'Preview Price Adjustments'}</span>
          </button>

          {bulkPricingPreview && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  Affected Plans: {bulkPricingPreview.length}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#10B981' }}>
                  Est. Daily Revenue Diff: +GH₵ {(bulkPricingDiffTotal / 100).toFixed(2)}
                </span>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Plan</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Current Cust.</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>New Cust.</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Current Agent</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>New Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPricingPreview.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{p.network} {p.name}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>GH₵ {(p.currentBasePricePesewas / 100).toFixed(2)}</td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: '#10B981' }}>GH₵ {(p.newBasePricePesewas / 100).toFixed(2)}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{p.currentAgentPricePesewas ? `GH₵ ${(p.currentAgentPricePesewas / 100).toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: 'var(--color-brand)' }}>{p.newAgentPricePesewas ? `GH₵ ${(p.newAgentPricePesewas / 100).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Mandatory Reason for Bulk Pricing Update *</label>
            <Input
              value={bulkPricingReason}
              onChange={(e) => setBulkPricingReason(e.target.value)}
              placeholder="e.g. Carrier tariff adjustment"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => setIsBulkPricingOpen(false)} style={tactileButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkProcessing || !bulkPricingPreview || bulkPricingReason.trim().length < 5}
              onClick={handleApplyBulkPricing}
              style={{
                ...primaryButtonStyle,
                opacity: bulkProcessing || !bulkPricingPreview || bulkPricingReason.trim().length < 5 ? 0.6 : 1,
              }}
            >
              {bulkProcessing ? 'Applying Changes...' : 'Confirm & Apply Bulk Pricing'}
            </button>
          </div>
        </div>
      </Modal>

      {/* E. Provider Sync & Review Modal */}
      <Modal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="DataHouse Provider Catalog Synchronization"
        maxWidth="820px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
            DataHouse is authoritative for telecom fulfillment. Review provider catalog diffs before accepting updates into ByteBeacon.
          </p>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setSyncTab('DIFF')}
              style={{
                ...tactileButtonStyle,
                backgroundColor: syncTab === 'DIFF' ? 'var(--color-brand-primary)' : 'var(--color-bg-surface)',
                color: syncTab === 'DIFF' ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              Sync Diff Review
            </button>
            <button
              type="button"
              onClick={() => setSyncTab('HISTORY')}
              style={{
                ...tactileButtonStyle,
                backgroundColor: syncTab === 'HISTORY' ? 'var(--color-brand-primary)' : 'var(--color-bg-surface)',
                color: syncTab === 'HISTORY' ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              Sync History
            </button>
            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={syncLoading}
                style={tactileButtonStyle}
              >
                <RefreshCw size={13} className={syncLoading ? 'animate-spin' : ''} />
                <span>{syncLoading ? 'Fetching DataHouse...' : 'Trigger Sync Now'}</span>
              </button>
            </div>
          </div>

          {syncTab === 'DIFF' && activeSyncBatch && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Matched Plans</span>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800 }}>{activeSyncBatch.matchedPlans}</h3>
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Price Shifts</span>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-warning-bright)' }}>{activeSyncBatch.changedPlansCount}</h3>
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>New Plans</span>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: '#10B981' }}>{activeSyncBatch.newPlansCount}</h3>
                </div>
                <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Removed Plans</span>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-danger)' }}>{activeSyncBatch.removedPlansCount}</h3>
                </div>
              </div>

              {activeSyncBatch.items && activeSyncBatch.items.length > 0 ? (
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Type</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Plan</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Current Prov. Cost</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>New Prov. Cost</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSyncBatch.items.map((item) => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '0.4rem 0.6rem' }}>
                            <Badge variant={item.changeType === 'NEW_PLAN' ? 'success' : (item.changeType === 'PRICE_CHANGE' ? 'warning' : 'danger')} size="sm">
                              {item.changeType}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{item.network} {item.planName}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>
                            {item.currentProviderPricePesewas ? `GH₵ ${(item.currentProviderPricePesewas / 100).toFixed(2)}` : 'N/A'}
                          </td>
                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700 }}>
                            GH₵ {(item.newProviderPricePesewas / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>
                            <Badge variant={item.status === 'ACCEPTED' ? 'success' : (item.status === 'REJECTED' ? 'danger' : 'neutral')} size="sm">
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                  ✓ No discrepancies detected. ByteBeacon catalog is in full synchronization with DataHouse.
                </p>
              )}

              {activeSyncBatch.status === 'PENDING_REVIEW' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleApplySyncBatch(activeSyncBatch.id)}
                    style={primaryButtonStyle}
                  >
                    Accept & Project Diff
                  </button>
                </div>
              )}
            </div>
          )}

          {syncTab === 'HISTORY' && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '0.4rem 0.6rem' }}>Batch ID</th>
                    <th style={{ padding: '0.4rem 0.6rem' }}>Provider</th>
                    <th style={{ padding: '0.4rem 0.6rem' }}>Discrepancies</th>
                    <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                    <th style={{ padding: '0.4rem 0.6rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {syncBatches.map((b) => (
                    <tr key={b.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-mono)' }}>{b.id.slice(0, 8)}...</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{b.providerName}</td>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700 }}>{b.discrepancyCount}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>
                        <Badge variant={b.status === 'APPLIED' ? 'success' : (b.status === 'REJECTED' ? 'danger' : 'warning')} size="sm">
                          {b.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{new Date(b.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. INDIVIDUAL PLAN DOSSIER DRAWER & BACKDROP (Non-Overlapping, zIndex 250/260) */}
      {/* ========================================================================= */}
      {selectedPlanDetail && (
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
          onClick={() => setSelectedPlanDetail(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '740px',
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Badge
                    variant={
                      selectedPlanDetail.network === NetworkProvider.MTN
                        ? 'warning'
                        : selectedPlanDetail.network === NetworkProvider.TELECEL
                        ? 'danger'
                        : 'info'
                    }
                    size="sm"
                  >
                    {selectedPlanDetail.network}
                  </Badge>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    SKU: {selectedPlanDetail.sku}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {selectedPlanDetail.name}
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const matchedPlan = plans.find((p) => p.id === selectedPlanDetail.id);
                    if (matchedPlan) handleOpenEdit(matchedPlan);
                  }}
                  style={{ ...tactileButtonStyle, padding: '0.35rem 0.65rem', fontSize: '11px' }}
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const matchedPlan = plans.find((p) => p.id === selectedPlanDetail.id);
                    if (matchedPlan) handlePromptDelete(matchedPlan);
                  }}
                  style={{
                    ...tactileButtonStyle,
                    padding: '0.35rem 0.65rem',
                    fontSize: '11px',
                    color: 'var(--color-danger)',
                  }}
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlanDetail(null)}
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
              {(['OVERVIEW', 'ANALYTICS', 'ORDERS', 'PRICE_HISTORY'] as const).map((tab) => {
                const isActive = detailTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
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
                    {tab.replace('_', ' ')}
                  </button>
                );
              })}
            </div>

            {/* Drawer Scrollable Content */}
            <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Tab 1: Overview */}
              {detailTab === 'OVERVIEW' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* Commercial Rate Card */}
                  <Card elevated style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Commercial Rate Card & Spread Margins
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider Base Cost</span>
                        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                          GH₵ {((selectedPlanDetail.providerPricePesewas || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Customer Retail Price</span>
                        <p style={{ margin: 0, fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          GH₵ {(selectedPlanDetail.basePricePesewas / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Agent Wholesale Price</span>
                        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-brand)' }}>
                          {selectedPlanDetail.agentPricePesewas ? `GH₵ ${(selectedPlanDetail.agentPricePesewas / 100).toFixed(2)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Customer Retail Margin</span>
                        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: '#10B981' }}>
                          +GH₵ {(selectedPlanDetail.customerMarginPesewas / 100).toFixed(2)} ({selectedPlanDetail.customerMarginPct}%)
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Channel Visibility Matrix */}
                  <Card elevated style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Publishing Channel Matrix
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                        <Badge variant={selectedPlanDetail.availableForCustomer ? 'success' : 'neutral'} size="sm">
                          {selectedPlanDetail.availableForCustomer ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                        <span>Customer UI Portal</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                        <Badge variant={selectedPlanDetail.availableForAgent ? 'success' : 'neutral'} size="sm">
                          {selectedPlanDetail.availableForAgent ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                        <span>Agent Wholesale Portal</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                        <Badge variant={selectedPlanDetail.availableForStore ? 'success' : 'neutral'} size="sm">
                          {selectedPlanDetail.availableForStore ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                        <span>Agent Storefronts</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                        <Badge variant={selectedPlanDetail.availableForApi ? 'success' : 'neutral'} size="sm">
                          {selectedPlanDetail.availableForApi ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                        <span>Developer REST API</span>
                      </div>
                    </div>
                  </Card>

                  {/* Provider Authority Mapping */}
                  <Card elevated style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Telecom Provider Fulfillment Mapping
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Authority Provider</span>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                          {selectedPlanDetail.providerName || 'DataHouse'}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Provider Plan ID</span>
                        <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                          {selectedPlanDetail.providerPlanId || '—'}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>DataHouse Validity</span>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                          {selectedPlanDetail.validityDesc || `${selectedPlanDetail.validityDays} Days`}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Operational Status</span>
                        <p style={{ margin: 0 }}>
                          <Badge variant={selectedPlanDetail.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                            {selectedPlanDetail.status}
                          </Badge>
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Tab 2: Analytics */}
              {detailTab === 'ANALYTICS' && selectedPlanDetail.analytics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <MetricCard
                      title="Lifetime Volume"
                      value={selectedPlanDetail.analytics.lifetimeOrders.toString()}
                      subvalue={`GH₵ ${(selectedPlanDetail.analytics.lifetimeRevenuePesewas / 100).toFixed(2)}`}
                      accent="blue"
                    />
                    <MetricCard
                      title="Fulfillment Success"
                      value={`${selectedPlanDetail.analytics.successRatePct}%`}
                      subvalue={`${selectedPlanDetail.analytics.successfulOrders} fulfilled`}
                      accent="green"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Today</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>
                        {selectedPlanDetail.analytics.todayOrders} orders
                      </p>
                    </div>
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Last 7 Days</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>
                        {selectedPlanDetail.analytics.last7DaysOrders} orders
                      </p>
                    </div>
                    <div style={{ padding: '0.65rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Last 30 Days</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>
                        {selectedPlanDetail.analytics.last30DaysOrders} orders
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Order History */}
              {detailTab === 'ORDERS' && (
                <div>
                  <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Recent Orders for {selectedPlanDetail.name}
                  </h4>
                  {selectedPlanDetail.recentOrders && selectedPlanDetail.recentOrders.length > 0 ? (
                    <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Order ID</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Recipient</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Amount</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Status</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlanDetail.recentOrders.map((o) => (
                            <tr key={o.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '0.45rem 0.65rem', fontFamily: 'var(--font-mono)' }}>{o.publicId}</td>
                              <td style={{ padding: '0.45rem 0.65rem' }}>{o.recipientPhone}</td>
                              <td style={{ padding: '0.45rem 0.65rem', fontWeight: 700 }}>GH₵ {(o.amountPesewas / 100).toFixed(2)}</td>
                              <td style={{ padding: '0.45rem 0.65rem' }}>
                                <Badge variant={o.orderStatus === 'COMPLETED' ? 'success' : (o.orderStatus === 'FAILED' ? 'danger' : 'warning')} size="sm">
                                  {o.orderStatus}
                                </Badge>
                              </td>
                              <td style={{ padding: '0.45rem 0.65rem' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
                      No orders placed for this bundle yet.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 4: Price History */}
              {detailTab === 'PRICE_HISTORY' && (
                <div>
                  <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Immutable Price Audit Log
                  </h4>
                  {selectedPlanDetail.priceHistory && selectedPlanDetail.priceHistory.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
                      {selectedPlanDetail.priceHistory.map((h) => (
                        <div key={h.id} style={{ padding: '0.65rem', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand)' }}>
                              {h.changeType} by {h.changedByName || 'Admin'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                            Customer Price: {h.previousBasePricePesewas ? `GH₵ ${(h.previousBasePricePesewas / 100).toFixed(2)} → ` : ''}GH₵ {((h.newBasePricePesewas || 0) / 100).toFixed(2)}
                          </p>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            Reason: {h.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
                      No price changes recorded for this bundle.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
