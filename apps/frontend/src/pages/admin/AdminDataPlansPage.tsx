import React, { useState, useEffect, useCallback } from 'react';
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
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input, Select } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  Download,
  Filter,
  Search,
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

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <TactileIcon icon={ShoppingBag} color="speed" size="lg" />
          <div>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-warning-bright)' }}>
              Commercial Catalog Control Plane
            </span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Data Plans & Catalog Pricing
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
              Manage, price, publish, and monitor all data bundles available across ByteBeacon.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchPlans();
              fetchStats();
            }}
            leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenSyncModal}
            leftIcon={<Zap size={14} />}
          >
            Sync Provider Catalog
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBulkPricingOpen(true)}
            leftIcon={<Sliders size={14} />}
          >
            Bulk Pricing
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('csv')}
            leftIcon={<Download size={14} />}
          >
            Export
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            leftIcon={<Plus size={14} />}
          >
            Add Data Plan
          </Button>
        </div>
      </div>

      {/* 2. Summary KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
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
          title="Customer Plans"
          value={stats ? stats.customerPlans.toString() : '—'}
          subvalue="Retail web & app"
          accent="cyan"
          icon={<TactileIcon icon={Globe} color="speed" size="sm" />}
        />
        <MetricCard
          title="Agent Plans"
          value={stats ? stats.agentPlans.toString() : '—'}
          subvalue="Wholesale portal"
          accent="orange"
          icon={<TactileIcon icon={TrendingUp} color="speed" size="sm" />}
        />
        <MetricCard
          title="Storefront Plans"
          value={stats ? stats.storePlans.toString() : '—'}
          subvalue="Reseller stores"
          accent="purple"
          icon={<TactileIcon icon={ShoppingBag} color="api" size="sm" />}
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

      {/* 3. Filter Bar & Search */}
      <Card elevated accentColor="amber" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Top Channel Switcher Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button
              variant={activeChannelTab === 'ALL' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleSelectChannelTab('ALL')}
              leftIcon={<Layers size={14} />}
            >
              All Bundles ({stats?.totalPlans ?? plans.length})
            </Button>
            <Button
              variant={activeChannelTab === 'CUSTOMER' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleSelectChannelTab('CUSTOMER')}
              leftIcon={<Globe size={14} />}
            >
              Customer Retail ({stats?.customerPlans ?? 0})
            </Button>
            <Button
              variant={activeChannelTab === 'AGENT' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleSelectChannelTab('AGENT')}
              leftIcon={<TrendingUp size={14} />}
            >
              Agent Wholesale ({stats?.agentPlans ?? 0})
            </Button>
            <Button
              variant={activeChannelTab === 'STORE' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleSelectChannelTab('STORE')}
              leftIcon={<Store size={14} />}
            >
              Storefront Resale ({stats?.storePlans ?? 0})
            </Button>
          </div>

          {/* Carrier Network Filter & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {['ALL', NetworkProvider.MTN, NetworkProvider.TELECEL, NetworkProvider.AIRTELTIGO].map((net) => (
                <Button
                  key={net}
                  variant={networkFilter === net ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setNetworkFilter(net)}
                >
                  {net === 'ALL' ? 'All Networks' : net}
                </Button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px', maxWidth: '460px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search plans, codes, SKU, network, provider..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem 0.45rem 2rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                />
              </div>

              <Button
                variant={showAdvancedFilters ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                leftIcon={<Filter size={13} />}
              >
                Filters
              </Button>
            </div>
          </div>

          {/* Expandable Advanced Filters */}
          {showAdvancedFilters && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Select
                label="ByteBeacon Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'DISABLED', label: 'Disabled' },
                  { value: 'ARCHIVED', label: 'Archived' },
                  { value: 'DRAFT', label: 'Draft' },
                ]}
              />

              <Select
                label="Provider Status"
                value={providerStatusFilter}
                onChange={(e) => setProviderStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Provider States' },
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'UNAVAILABLE', label: 'Unavailable' },
                  { value: 'PROVIDER_REMOVED', label: 'Provider Removed' },
                  { value: 'SYNC_ERROR', label: 'Sync Error' },
                ]}
              />

              <Select
                label="Provider"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Providers' },
                  { value: 'DataHouse', label: 'DataHouse' },
                  { value: 'GMPL', label: 'GMPL' },
                ]}
              />

              <Select
                label="Customer Access"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'AVAILABLE', label: 'Customer Available' },
                  { value: 'HIDDEN', label: 'Customer Hidden' },
                ]}
              />

              <Select
                label="Agent Access"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'AVAILABLE', label: 'Agent Available' },
                  { value: 'HIDDEN', label: 'Agent Hidden' },
                ]}
              />

              <Select
                label="Store Access"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'AVAILABLE', label: 'Store Available' },
                  { value: 'HIDDEN', label: 'Store Hidden' },
                ]}
              />

              <Input
                label="Min Price (GHS)"
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0.00"
              />

              <Input
                label="Max Price (GHS)"
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="100.00"
              />
            </div>
          )}

          {/* Bulk Selection Bar */}
          {selectedPlanIds.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', backgroundColor: 'rgba(0, 102, 255, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-brand)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand)' }}>
                {selectedPlanIds.length} plans selected
              </span>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => setIsBulkPricingOpen(true)} leftIcon={<Sliders size={13} />}>
                  Bulk Pricing
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExecuteBulkAction('ACTIVATE')} disabled={bulkProcessing}>
                  Activate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExecuteBulkAction('DISABLE')} disabled={bulkProcessing}>
                  Disable
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExecuteBulkAction('ENABLE_CUSTOMER')} disabled={bulkProcessing} leftIcon={<Globe size={13} />}>
                  Enable Customer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExecuteBulkAction('ENABLE_AGENT')} disabled={bulkProcessing} leftIcon={<TrendingUp size={13} />}>
                  Enable Agent
                </Button>
                <Button variant="danger" size="sm" onClick={() => setIsBulkDeleteModalOpen(true)} disabled={bulkProcessing} leftIcon={<Trash2 size={13} />}>
                  Delete Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanIds([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Plans Primary Table */}
      <Card elevated accentColor="amber" style={{ padding: 'var(--space-4)' }}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={[
              {
                header: (
                  <input
                    type="checkbox"
                    checked={plans.length > 0 && selectedPlanIds.length === plans.length}
                    onChange={toggleSelectAll}
                  />
                ),
                accessor: 'id',
                render: (row) => (
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.includes(row.id)}
                    onChange={() => toggleSelectPlan(row.id)}
                  />
                ),
              },
              {
                header: 'Plan / SKU',
                accessor: 'name',
                render: (row) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {row.sku}
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
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                      {(row.dataAmountMb / 1024).toFixed(row.dataAmountMb % 1024 === 0 ? 0 : 1)} GB
                    </span>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
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
                          title={row.availableForCustomer ? 'Available for Customer (Click to toggle)' : 'Hidden from Customer (Click to toggle)'}
                          style={{
                            border: 'none',
                            background: row.availableForCustomer ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: row.availableForCustomer ? '#10B981' : '#EF4444',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <Globe size={10} />
                          {row.availableForCustomer ? 'Retail' : 'Hidden'}
                        </button>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-3xs)', color: '#10B981', fontWeight: 600 }}>
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
                          title={row.availableForAgent ? 'Available for Agent (Click to toggle)' : 'Hidden from Agent (Click to toggle)'}
                          style={{
                            border: 'none',
                            background: row.availableForAgent ? 'rgba(0, 102, 255, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: row.availableForAgent ? 'var(--color-brand)' : '#EF4444',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <TrendingUp size={10} />
                          {row.availableForAgent ? 'Wholesale' : 'Hidden'}
                        </button>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand)', fontWeight: 600 }}>
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
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInspectPlan(row.id)}
                      leftIcon={<Eye size={12} />}
                      title="View Plan Dossier"
                    >
                      Dossier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(row)}
                      leftIcon={<Edit3 size={12} />}
                      title="Edit Pricing & Channels"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(row)}
                      style={{ fontSize: 'var(--font-size-3xs)' }}
                    >
                      {row.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => handlePromptDelete(row, e)}
                      leftIcon={<Trash2 size={12} />}
                      title="Delete / Archive Plan"
                    >
                      Delete
                    </Button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing {plans.length} of {pagination.total} plans (Page {pagination.page} of {pagination.totalPages})
          </span>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Create / Edit Data Plan Modal */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="amber" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>
                {editingPlan ? 'Edit Data Plan' : 'Create Data Plan'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Basic Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input
                  label="Plan Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 5GB Non-Expiry"
                  required
                />

                <Select
                  label="Network Carrier"
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value as NetworkProvider })}
                  options={[
                    { value: NetworkProvider.MTN, label: 'MTN Ghana' },
                    { value: NetworkProvider.TELECEL, label: 'Telecel Ghana' },
                    { value: NetworkProvider.AIRTELTIGO, label: 'AirtelTigo' },
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                <Input
                  label="Data Volume (MB)"
                  type="number"
                  value={formData.dataAmountMb}
                  onChange={(e) => setFormData({ ...formData, dataAmountMb: parseInt(e.target.value, 10) || 1024 })}
                  required
                />

                <Input
                  label="Validity Days"
                  type="number"
                  value={formData.validityDays}
                  onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value, 10) || 30 })}
                  required
                />

                <Input
                  label="Validity Display"
                  value={formData.validityDesc}
                  onChange={(e) => setFormData({ ...formData, validityDesc: e.target.value })}
                  placeholder="Non-Expiry"
                />
              </div>

              {/* Provider Mapping Identifiers */}
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                  Telecom Provider Mapping (DataHouse Authority)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <Input
                    label="Provider Name"
                    value={formData.providerName}
                    onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                  />

                  <Input
                    label="Provider Plan ID"
                    value={formData.providerPlanId}
                    onChange={(e) => setFormData({ ...formData, providerPlanId: e.target.value })}
                    placeholder="dh_mtn_5gb"
                  />
                </div>
              </div>

              {/* Pricing Section with Margin Spread */}
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-brand)' }}>
                  Multi-Tier Pricing & Spread Calculations
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <Input
                    label="Provider Cost (GHS)"
                    type="number"
                    step="0.01"
                    value={formData.providerPriceGhs}
                    onChange={(e) => setFormData({ ...formData, providerPriceGhs: e.target.value })}
                    required
                  />

                  <div>
                    <Input
                      label="Customer Retail Price (GHS)"
                      type="number"
                      step="0.01"
                      value={formData.customerPriceGhs}
                      onChange={(e) => setFormData({ ...formData, customerPriceGhs: e.target.value })}
                      required
                    />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: '#10B981', fontWeight: 700 }}>
                      Customer Margin: +GH₵ {margins.custMargin.toFixed(2)} ({margins.custPct}%)
                    </span>
                  </div>

                  <div>
                    <Input
                      label="Agent Wholesale Price (GHS)"
                      type="number"
                      step="0.01"
                      value={formData.agentPriceGhs}
                      onChange={(e) => setFormData({ ...formData, agentPriceGhs: e.target.value })}
                    />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-brand)', fontWeight: 700 }}>
                      Agent Margin: +GH₵ {margins.agentMargin.toFixed(2)} ({margins.agentPct}%)
                    </span>
                  </div>

                  <div>
                    <Input
                      label="Store Default Price (GHS)"
                      type="number"
                      step="0.01"
                      value={formData.storePriceGhs}
                      onChange={(e) => setFormData({ ...formData, storePriceGhs: e.target.value })}
                    />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: '#10B981', fontWeight: 700 }}>
                      Store Margin: +GH₵ {margins.storeMargin.toFixed(2)} ({margins.storePct}%)
                    </span>
                  </div>

                  <div>
                    <Input
                      label="Agent Min Resale Cap (GHS)"
                      type="number"
                      step="0.01"
                      placeholder="Optional lower limit"
                      value={formData.agentMinPriceGhs}
                      onChange={(e) => setFormData({ ...formData, agentMinPriceGhs: e.target.value })}
                    />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      Minimum allowed agent resale price
                    </span>
                  </div>

                  <div>
                    <Input
                      label="Agent Max Resale Cap (GHS)"
                      type="number"
                      step="0.01"
                      placeholder="Optional upper limit"
                      value={formData.agentMaxPriceGhs}
                      onChange={(e) => setFormData({ ...formData, agentMaxPriceGhs: e.target.value })}
                    />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      Maximum allowed agent resale price
                    </span>
                  </div>
                </div>
              </div>

              {/* Independent Channel Visibility */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Channel Publishing & Access Controls</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
                <Input
                  label="Change Reason (Audit Trail)"
                  value={formData.changeReason}
                  onChange={(e) => setFormData({ ...formData, changeReason: e.target.value })}
                  placeholder="e.g. Updating customer retail and agent wholesale rates"
                  required
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Single Plan Delete Confirmation Modal */}
      {isDeleteModalOpen && planToDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="red" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-3)' }}>
              <TactileIcon icon={Trash2} color="red" size="md" />
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Delete Data Plan
                </h3>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  Permanent Removal or Archival Protection
                </span>
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
              Are you sure you want to delete <strong>{planToDelete.name}</strong> ({planToDelete.network} - {planToDelete.sku})?
              <br />
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Note: If previous orders exist for this bundle, it will be safely archived to preserve financial and customer history.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsDeleteModalOpen(false)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeletePlan} disabled={deleteLoading} leftIcon={<Trash2 size={14} />}>
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="red" style={{ maxWidth: '480px', width: '100%', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'var(--space-3)' }}>
              <TactileIcon icon={Trash2} color="red" size="md" />
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Delete {selectedPlanIds.length} Data Plans
                </h3>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  Batch Removal & Archival
                </span>
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
              Are you sure you want to delete all <strong>{selectedPlanIds.length}</strong> selected data plans?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkDeleteModalOpen(false)} disabled={bulkProcessing}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmBulkDelete} disabled={bulkProcessing} leftIcon={<Trash2 size={14} />}>
                {bulkProcessing ? 'Deleting...' : `Delete ${selectedPlanIds.length} Plans`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 6. Bulk Pricing Calculator Modal */}
      {isBulkPricingOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="amber" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>
                Bulk Pricing Markup Calculator
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkPricingOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Apply percentage or absolute markup adjustments across {selectedPlanIds.length > 0 ? `${selectedPlanIds.length} selected plans` : 'all active catalog plans'}.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <Input
                label="Customer Markup (%)"
                type="number"
                step="0.1"
                placeholder="+5.0"
                value={customerMarkupPct}
                onChange={(e) => setCustomerMarkupPct(e.target.value)}
              />

              <Input
                label="Agent Markup (%)"
                type="number"
                step="0.1"
                placeholder="+2.0"
                value={agentMarkupPct}
                onChange={(e) => setAgentMarkupPct(e.target.value)}
              />

              <Input
                label="Store Markup (%)"
                type="number"
                step="0.1"
                placeholder="+3.0"
                value={storeMarkupPct}
                onChange={(e) => setStoreMarkupPct(e.target.value)}
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreviewBulkPricing}
              disabled={previewLoading}
              leftIcon={<Eye size={13} />}
              style={{ marginBottom: 'var(--space-4)' }}
            >
              {previewLoading ? 'Calculating Impact...' : 'Preview Price Adjustments'}
            </Button>

            {bulkPricingPreview && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                    Affected Plans: {bulkPricingPreview.length}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#10B981' }}>
                    Est. Daily Revenue Diff: +GH₵ {(bulkPricingDiffTotal / 100).toFixed(2)}
                  </span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', fontSize: 'var(--font-size-3xs)', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem' }}>Plan</th>
                        <th style={{ padding: '0.4rem' }}>Current Customer</th>
                        <th style={{ padding: '0.4rem' }}>New Customer</th>
                        <th style={{ padding: '0.4rem' }}>Current Agent</th>
                        <th style={{ padding: '0.4rem' }}>New Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPricingPreview.map((p) => (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '0.4rem', fontWeight: 600 }}>{p.network} {p.name}</td>
                          <td style={{ padding: '0.4rem' }}>GH₵ {(p.currentBasePricePesewas / 100).toFixed(2)}</td>
                          <td style={{ padding: '0.4rem', fontWeight: 700, color: '#10B981' }}>GH₵ {(p.newBasePricePesewas / 100).toFixed(2)}</td>
                          <td style={{ padding: '0.4rem' }}>{p.currentAgentPricePesewas ? `GH₵ ${(p.currentAgentPricePesewas / 100).toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '0.4rem', fontWeight: 700, color: 'var(--color-brand)' }}>{p.newAgentPricePesewas ? `GH₵ ${(p.newAgentPricePesewas / 100).toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Input
              label="Mandatory Reason for Bulk Pricing Update"
              value={bulkPricingReason}
              onChange={(e) => setBulkPricingReason(e.target.value)}
              placeholder="e.g. Carrier tariff adjustment"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-4)' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkPricingOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkProcessing || !bulkPricingPreview || bulkPricingReason.trim().length < 5}
                onClick={handleApplyBulkPricing}
              >
                {bulkProcessing ? 'Applying Changes...' : 'Confirm & Apply Bulk Pricing'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 7. Provider Sync Drawer & Review Modal */}
      {isSyncModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}>
          <Card elevated accentColor="amber" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>
                  DataHouse Provider Catalog Synchronization
                </h2>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  DataHouse is authoritative for telecom fulfillment. Review provider catalog diffs before accepting updates.
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsSyncModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <Button
                variant={syncTab === 'DIFF' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSyncTab('DIFF')}
              >
                Sync Diff Review
              </Button>
              <Button
                variant={syncTab === 'HISTORY' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSyncTab('HISTORY')}
              >
                Sync History
              </Button>
              <div style={{ marginLeft: 'auto' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTriggerSync}
                  disabled={syncLoading}
                  leftIcon={<RefreshCw size={13} className={syncLoading ? 'animate-spin' : ''} />}
                >
                  {syncLoading ? 'Fetching DataHouse...' : 'Trigger Sync Now'}
                </Button>
              </div>
            </div>

            {syncTab === 'DIFF' && activeSyncBatch && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Matched Plans</span>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800 }}>{activeSyncBatch.matchedPlans}</h3>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Price Shifts</span>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-warning-bright)' }}>{activeSyncBatch.changedPlansCount}</h3>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>New Plans</span>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: '#10B981' }}>{activeSyncBatch.newPlansCount}</h3>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Removed Plans</span>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-danger)' }}>{activeSyncBatch.removedPlansCount}</h3>
                  </div>
                </div>

                {activeSyncBatch.items && activeSyncBatch.items.length > 0 ? (
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)' }}>
                    <table style={{ width: '100%', fontSize: 'var(--font-size-3xs)', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem' }}>Type</th>
                          <th style={{ padding: '0.4rem' }}>Plan</th>
                          <th style={{ padding: '0.4rem' }}>Current Prov. Cost</th>
                          <th style={{ padding: '0.4rem' }}>New Prov. Cost</th>
                          <th style={{ padding: '0.4rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSyncBatch.items.map((item) => (
                          <tr key={item.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '0.4rem' }}>
                              <Badge variant={item.changeType === 'NEW_PLAN' ? 'success' : (item.changeType === 'PRICE_CHANGE' ? 'warning' : 'danger')} size="sm">
                                {item.changeType}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.4rem', fontWeight: 600 }}>{item.network} {item.planName}</td>
                            <td style={{ padding: '0.4rem' }}>
                              {item.currentProviderPricePesewas ? `GH₵ ${(item.currentProviderPricePesewas / 100).toFixed(2)}` : 'N/A'}
                            </td>
                            <td style={{ padding: '0.4rem', fontWeight: 700 }}>
                              GH₵ {(item.newProviderPricePesewas / 100).toFixed(2)}
                            </td>
                            <td style={{ padding: '0.4rem' }}>
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
                    <Button variant="primary" size="sm" onClick={() => handleApplySyncBatch(activeSyncBatch.id)}>
                      Accept & Project Diff
                    </Button>
                  </div>
                )}
              </div>
            )}

            {syncTab === 'HISTORY' && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 'var(--font-size-3xs)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Batch ID</th>
                      <th style={{ padding: '0.4rem' }}>Provider</th>
                      <th style={{ padding: '0.4rem' }}>Discrepancies</th>
                      <th style={{ padding: '0.4rem' }}>Status</th>
                      <th style={{ padding: '0.4rem' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncBatches.map((b) => (
                      <tr key={b.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.4rem', fontFamily: 'var(--font-mono)' }}>{b.id.slice(0, 8)}...</td>
                        <td style={{ padding: '0.4rem' }}>{b.providerName}</td>
                        <td style={{ padding: '0.4rem', fontWeight: 700 }}>{b.discrepancyCount}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <Badge variant={b.status === 'APPLIED' ? 'success' : (b.status === 'REJECTED' ? 'danger' : 'warning')} size="sm">
                            {b.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.4rem' }}>{new Date(b.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 8. Individual Plan Dossier Drawer */}
      {selectedPlanDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: 'var(--color-bg-surface)', height: '100%', overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', boxShadow: 'var(--shadow-xl)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-warning-bright)' }}>
                  Plan Dossier & Rate Analysis
                </span>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>
                  {selectedPlanDetail.name}
                </h2>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  SKU: {selectedPlanDetail.sku} | ID: {selectedPlanDetail.id}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const matchedPlan = plans.find((p) => p.id === selectedPlanDetail.id);
                    if (matchedPlan) handleOpenEdit(matchedPlan);
                  }}
                  leftIcon={<Edit3 size={13} />}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const matchedPlan = plans.find((p) => p.id === selectedPlanDetail.id);
                    if (matchedPlan) handlePromptDelete(matchedPlan);
                  }}
                  leftIcon={<Trash2 size={13} />}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanDetail(null)}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* Dossier Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              {(['OVERVIEW', 'ANALYTICS', 'ORDERS', 'PRICE_HISTORY'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={detailTab === tab ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setDetailTab(tab)}
                  style={{ fontSize: 'var(--font-size-2xs)' }}
                >
                  {tab.replace('_', ' ')}
                </Button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {detailTab === 'OVERVIEW' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Card elevated accentColor="amber" style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                    Commercial Rate Card & Margins
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Provider Cost</span>
                      <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        GH₵ {((selectedPlanDetail.providerPricePesewas || 0) / 100).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Customer Retail Price</span>
                      <p style={{ margin: 0, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                        GH₵ {(selectedPlanDetail.basePricePesewas / 100).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Agent Wholesale Price</span>
                      <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-brand)' }}>
                        {selectedPlanDetail.agentPricePesewas ? `GH₵ ${(selectedPlanDetail.agentPricePesewas / 100).toFixed(2)}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Customer Margin</span>
                      <p style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                        +GH₵ {(selectedPlanDetail.customerMarginPesewas / 100).toFixed(2)} ({selectedPlanDetail.customerMarginPct}%)
                      </p>
                    </div>
                  </div>
                </Card>

                <Card elevated accentColor="blue" style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                    Channel Visibility Matrix
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                      <Badge variant={selectedPlanDetail.availableForCustomer ? 'success' : 'neutral'} size="sm">
                        {selectedPlanDetail.availableForCustomer ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                      <span>Customer UI</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                      <Badge variant={selectedPlanDetail.availableForAgent ? 'success' : 'neutral'} size="sm">
                        {selectedPlanDetail.availableForAgent ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                      <span>Agent Portal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                      <Badge variant={selectedPlanDetail.availableForStore ? 'success' : 'neutral'} size="sm">
                        {selectedPlanDetail.availableForStore ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                      <span>Storefronts</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
                      <Badge variant={selectedPlanDetail.availableForApi ? 'success' : 'neutral'} size="sm">
                        {selectedPlanDetail.availableForApi ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                      <span>Developer API</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Tab 2: Analytics */}
            {detailTab === 'ANALYTICS' && selectedPlanDetail.analytics && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Today</span>
                    <p style={{ margin: 0, fontWeight: 700 }}>{selectedPlanDetail.analytics.todayOrders} orders</p>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Last 7 Days</span>
                    <p style={{ margin: 0, fontWeight: 700 }}>{selectedPlanDetail.analytics.last7DaysOrders} orders</p>
                  </div>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Last 30 Days</span>
                    <p style={{ margin: 0, fontWeight: 700 }}>{selectedPlanDetail.analytics.last30DaysOrders} orders</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Order History */}
            {detailTab === 'ORDERS' && (
              <div>
                <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  Recent Orders for {selectedPlanDetail.name}
                </h4>
                {selectedPlanDetail.recentOrders && selectedPlanDetail.recentOrders.length > 0 ? (
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 'var(--font-size-3xs)', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem' }}>Order ID</th>
                          <th style={{ padding: '0.4rem' }}>Recipient</th>
                          <th style={{ padding: '0.4rem' }}>Amount</th>
                          <th style={{ padding: '0.4rem' }}>Status</th>
                          <th style={{ padding: '0.4rem' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPlanDetail.recentOrders.map((o) => (
                          <tr key={o.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '0.4rem', fontFamily: 'var(--font-mono)' }}>{o.publicId}</td>
                            <td style={{ padding: '0.4rem' }}>{o.recipientPhone}</td>
                            <td style={{ padding: '0.4rem', fontWeight: 700 }}>GH₵ {(o.amountPesewas / 100).toFixed(2)}</td>
                            <td style={{ padding: '0.4rem' }}>
                              <Badge variant={o.orderStatus === 'COMPLETED' ? 'success' : (o.orderStatus === 'FAILED' ? 'danger' : 'warning')} size="sm">
                                {o.orderStatus}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.4rem' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                    No orders placed for this bundle yet.
                  </p>
                )}
              </div>
            )}

            {/* Tab 4: Price History */}
            {detailTab === 'PRICE_HISTORY' && (
              <div>
                <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  Immutable Price Audit Log
                </h4>
                {selectedPlanDetail.priceHistory && selectedPlanDetail.priceHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                    {selectedPlanDetail.priceHistory.map((h) => (
                      <div key={h.id} style={{ padding: '0.5rem', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-brand)' }}>
                            {h.changeType} by {h.changedByName || 'Admin'}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--font-size-2xs)', fontWeight: 600 }}>
                          Customer Price: {h.previousBasePricePesewas ? `GH₵ ${(h.previousBasePricePesewas / 100).toFixed(2)} → ` : ''}GH₵ {((h.newBasePricePesewas || 0) / 100).toFixed(2)}
                        </p>
                        <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                          Reason: {h.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                    No price changes recorded.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
