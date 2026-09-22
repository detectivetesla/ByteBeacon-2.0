import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card/Card.js';
import { Badge } from '../../components/ui/Badge/Badge.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Table } from '../../components/ui/Table/Table.js';
import { Input } from '../../components/ui/Input/Input.js';
import { SearchInput, Select } from '../../components/ui/index.js';
import { Avatar } from '../../components/ui/Avatar/Avatar.js';
import { Modal } from '../../components/ui/Modal/Modal.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { adminApi, AdminUserDetail, UserCustomPricingItemDto } from '../../api/admin.api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { parseUserAgent, formatRelativeTime, formatIpInfo } from '../../utils/ua-parser.js';
import {
  User,
  ArrowLeft,
  Shield,
  Wallet,
  Package,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Calendar,
  LogOut,
  PlusCircle,
  MinusCircle,
  Key,
  Lock,
  Store,
  Send,
  Edit3,
  ShieldCheck,
  Download,
  CreditCard,
  Tag,
  X,
  UserCheck,
  UserX,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'wallet' | 'orders' | 'transactions' | 'pricing' | 'activity' | 'sessions' | 'agent' | 'notifications'
  >('overview');
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // User custom pricing state
  const [userPricing, setUserPricing] = useState<UserCustomPricingItemDto[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState<boolean>(false);
  const [pricingSearch, setPricingSearch] = useState<string>('');
  const [pricingNetworkFilter, setPricingNetworkFilter] = useState<string>('ALL');
  const [pricingOverrideFilter, setPricingOverrideFilter] = useState<string>('ALL');
  const [pricingMaxPrice, setPricingMaxPrice] = useState<number>(500);
  const [editingPricingProduct, setEditingPricingProduct] = useState<UserCustomPricingItemDto | null>(null);
  const [editCustomPriceGhs, setEditCustomPriceGhs] = useState<string>('');
  const [editCustomPriceActive, setEditCustomPriceActive] = useState<boolean>(true);
  const [isSavingPricing, setIsSavingPricing] = useState<boolean>(false);

  // Edit profile modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneVerified, setEditPhoneVerified] = useState(false);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Wallet adjustment modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT' | 'OVERRIDE'>('CREDIT');
  const [adjustAmountGhs, setAdjustAmountGhs] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Role change modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('customer');
  const [roleReason, setRoleReason] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Send Notification modal
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [notifyChannel, setNotifyChannel] = useState<'EMAIL' | 'SMS' | 'IN_APP'>('EMAIL');
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isSendingNotify, setIsSendingNotify] = useState(false);

  // Suspend modal
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendRevokeSessions, setSuspendRevokeSessions] = useState(true);
  const [isSuspending, setIsSuspending] = useState(false);

  // Order Lifecycle Drawer / Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Reconciliation state
  const [isReconciling, setIsReconciling] = useState(false);

  // Export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('JSON');
  const [isExporting, setIsExporting] = useState(false);

  // --- GLOBAL FILTERS: Dossier Snapshot & Historical Cards ---
  const [globalPeriod, setGlobalPeriod] = useState<string>('ALL');
  const [globalStartDate, setGlobalStartDate] = useState<string>('');
  const [globalEndDate, setGlobalEndDate] = useState<string>('');
  const [isGlobalCustomDateOpen, setIsGlobalCustomDateOpen] = useState<boolean>(false);
  const [globalSort, setGlobalSort] = useState<string>('DATE_DESC');
  const [globalNetwork, setGlobalNetwork] = useState<string>('ALL');
  const [globalStatus, setGlobalStatus] = useState<string>('ALL');
  const [globalLedgerType, setGlobalLedgerType] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  const activeGlobalFiltersCount = useMemo(() => {
    let count = 0;
    if (globalPeriod !== 'ALL') count++;
    if (globalPeriod === 'CUSTOM' && (globalStartDate || globalEndDate)) count++;
    if (globalSort !== 'DATE_DESC') count++;
    if (globalNetwork !== 'ALL') count++;
    if (globalStatus !== 'ALL') count++;
    if (globalLedgerType !== 'ALL') count++;
    if (globalSearch.trim()) count++;
    return count;
  }, [globalPeriod, globalStartDate, globalEndDate, globalSort, globalNetwork, globalStatus, globalLedgerType, globalSearch]);

  const isGlobalFiltered = activeGlobalFiltersCount > 0;

  const handleResetGlobalFilters = () => {
    setGlobalPeriod('ALL');
    setGlobalStartDate('');
    setGlobalEndDate('');
    setIsGlobalCustomDateOpen(false);
    setGlobalSort('DATE_DESC');
    setGlobalNetwork('ALL');
    setGlobalStatus('ALL');
    setGlobalLedgerType('ALL');
    setGlobalSearch('');
  };

  // --- FILTERS: Orders ---
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderNetworkFilter, setOrderNetworkFilter] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderMaxAmount, setOrderMaxAmount] = useState<number>(500);

  // --- FILTERS: Ledger ---
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [ledgerMaxAmount, setLedgerMaxAmount] = useState<number>(1000);

  // --- FILTERS: Transactions ---
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [txProviderFilter, setTxProviderFilter] = useState('ALL');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [txMaxAmount, setTxMaxAmount] = useState<number>(1000);

  // --- FILTERS: Audit Stream (Activity) ---
  const [activitySearch, setActivitySearch] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');

  // --- FILTERS: Sessions ---
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [sessionDeviceFilter, setSessionDeviceFilter] = useState<string>('ALL');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionDateFrom, setSessionDateFrom] = useState('');
  const [sessionDateTo, setSessionDateTo] = useState('');
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const params: any = {};
      if (globalPeriod !== 'ALL' && globalPeriod !== 'CUSTOM') {
        params.period = globalPeriod;
      }
      if (globalPeriod === 'CUSTOM') {
        if (globalStartDate) params.startDate = globalStartDate;
        if (globalEndDate) params.endDate = globalEndDate;
      }
      if (globalNetwork !== 'ALL') params.network = globalNetwork;
      if (globalStatus !== 'ALL') params.status = globalStatus;
      if (globalLedgerType !== 'ALL') params.type = globalLedgerType;
      if (globalSort) params.sort = globalSort;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await adminApi.getUserDetails(id, params);
      if (res?.user) {
        setUserDetail(res);
        setSelectedRole(res.user.role);
        setEditName(res.user.fullName || '');
        setEditPhone(res.user.phone || '');
        setEditPhoneVerified(res.user.phoneVerified);
        setEditEmailVerified(res.user.emailVerified);
      }
    } catch (err: any) {
      toastError('Failed to load user dossier', err.message || 'Unable to retrieve user details.');
    } finally {
      setIsLoading(false);
    }
  }, [id, globalPeriod, globalStartDate, globalEndDate, globalNetwork, globalStatus, globalLedgerType, globalSort, debouncedSearch, toastError]);

  const fetchUserPricing = useCallback(async () => {
    if (!id) return;
    setIsLoadingPricing(true);
    try {
      const data = await adminApi.getUserPricing(id);
      setUserPricing(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toastError('Failed to load pricing', err.message || 'Unable to retrieve user custom pricing.');
    } finally {
      setIsLoadingPricing(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchUser();
    fetchUserPricing();
  }, [fetchUser, fetchUserPricing]);

  useEffect(() => {
    if (activeTab === 'pricing') {
      fetchUserPricing();
    }
  }, [activeTab, fetchUserPricing]);

  const handleOpenEditPricing = (item: UserCustomPricingItemDto) => {
    setEditingPricingProduct(item);
    setEditCustomPriceGhs(
      item.customPricePesewas !== null
        ? (item.customPricePesewas / 100).toFixed(2)
        : (item.effectivePricePesewas / 100).toFixed(2),
    );
    setEditCustomPriceActive(item.isActive !== false);
  };

  const handleSaveCustomPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editingPricingProduct) return;

    const priceGhs = parseFloat(editCustomPriceGhs);
    if (isNaN(priceGhs) || priceGhs <= 0) {
      toastError('Invalid Price', 'Please enter a valid positive number in GHS.');
      return;
    }

    const pricePesewas = Math.round(priceGhs * 100);
    setIsSavingPricing(true);

    try {
      await adminApi.updateUserProductPricing(id, editingPricingProduct.productId, {
        customPricePesewas: pricePesewas,
        isActive: editCustomPriceActive,
      });
      toastSuccess(
        'Custom Price Saved',
        `GH₵ ${priceGhs.toFixed(2)} applied for ${editingPricingProduct.productName}.`,
      );
      setEditingPricingProduct(null);
      fetchUserPricing();
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Could not update custom pricing.');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleResetCustomPricing = async (item: UserCustomPricingItemDto) => {
    if (!id) return;
    try {
      await adminApi.deleteUserProductPricing(id, item.productId);
      toastSuccess('Override Removed', `Custom price removed for ${item.productName}. Standard pricing restored.`);
      fetchUserPricing();
    } catch (err: any) {
      toastError('Reset Failed', err.message || 'Could not remove custom price override.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsUpdatingProfile(true);
    try {
      await adminApi.updateUserProfile(id, {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        phoneVerified: editPhoneVerified,
        emailVerified: editEmailVerified,
      });
      toastSuccess('Profile Updated', 'User profile details successfully saved.');
      setIsEditModalOpen(false);
      fetchUser();
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleToggleSuspend = async () => {
    if (!id || !userDetail) return;
    const isSuspended = userDetail.user.status === 'SUSPENDED';

    if (isSuspended) {
      try {
        await adminApi.reactivateUser(id);
        toastSuccess('Account Reactivated', `${userDetail.user.email} is now active.`);
        fetchUser();
      } catch (err: any) {
        toastError('Operation Failed', err.message || 'Could not reactivate user.');
      }
    } else {
      setIsSuspendModalOpen(true);
    }
  };

  const handleExecuteSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !userDetail) return;

    setIsSuspending(true);
    try {
      await adminApi.suspendUser(id, {
        reason: suspendReason.trim() || 'Administrative suspension',
        revokeSessions: suspendRevokeSessions,
      });
      toastSuccess('Account Suspended', `${userDetail.user.email} has been suspended.`);
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Suspension Failed', err.message || 'Could not suspend user.');
    } finally {
      setIsSuspending(false);
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const amountGhs = parseFloat(adjustAmountGhs);
    if (adjustType === 'OVERRIDE') {
      if (isNaN(amountGhs) || amountGhs < 0) {
        toastError('Invalid Amount', 'Please enter a valid non-negative number in GHS (0 or greater).');
        return;
      }
    } else {
      if (isNaN(amountGhs) || amountGhs <= 0) {
        toastError('Invalid Amount', 'Please enter a valid positive number in GHS.');
        return;
      }
    }

    if (!adjustReason || adjustReason.trim().length < 5) {
      toastError('Reason Required', 'Please provide a detailed reason (minimum 5 characters).');
      return;
    }

    const amountPesewas = Math.round(amountGhs * 100);
    setIsAdjusting(true);

    try {
      if (adjustType === 'OVERRIDE') {
        await adminApi.adjustUserWallet(id, {
          targetBalancePesewas: amountPesewas,
          type: 'OVERRIDE',
          reason: adjustReason.trim(),
        });
        toastSuccess('Wallet Overridden', `Successfully set wallet balance to GH₵ ${amountGhs.toFixed(2)}.`);
      } else {
        await adminApi.adjustUserWallet(id, {
          amountPesewas,
          type: adjustType,
          reason: adjustReason.trim(),
        });
        toastSuccess('Wallet Adjusted', `Successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} GH₵ ${amountGhs.toFixed(2)} via double-entry voucher.`);
      }
      setIsAdjustModalOpen(false);
      setAdjustAmountGhs('');
      setAdjustReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Adjustment Failed', err.message || 'Failed to post financial journal entry.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleRunReconciliation = async () => {
    if (!id) return;
    setIsReconciling(true);
    try {
      const res = await adminApi.reconcileUserWallet(id);
      if (res?.status === 'RECONCILED' || res?.discrepancyPesewas === 0) {
        toastSuccess('Reconciliation Passed', 'Wallet projection matches financial ledger entries.');
      } else {
        toastError('Discrepancy Detected', `Wallet balance differs by GH₵ ${(((res as any)?.discrepancyPesewas || 0) / 100).toFixed(2)}.`);
      }
      fetchUser();
    } catch (err: any) {
      toastError('Reconciliation Error', err.message || 'Could not execute reconciliation check.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsUpdatingRole(true);
    try {
      await adminApi.updateUserRole(id, selectedRole, roleReason.trim() || 'Administrative role change');
      toastSuccess('Role Updated', `User role changed to ${selectedRole}. Active sessions invalidated.`);
      setIsRoleModalOpen(false);
      setRoleReason('');
      fetchUser();
    } catch (err: any) {
      toastError('Role Change Denied', err.message || 'Unauthorized role transition.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!notifySubject.trim() || !notifyMessage.trim()) {
      toastError('Missing Fields', 'Subject and message are required.');
      return;
    }

    setIsSendingNotify(true);
    try {
      await adminApi.sendUserDirectNotification(id, {
        channel: notifyChannel,
        subject: notifySubject.trim(),
        message: notifyMessage.trim(),
      });
      toastSuccess('Notification Queued', `Message sent via ${notifyChannel}.`);
      setIsNotifyModalOpen(false);
      setNotifySubject('');
      setNotifyMessage('');
      fetchUser();
    } catch (err: any) {
      toastError('Delivery Failed', err.message || 'Could not dispatch notification.');
    } finally {
      setIsSendingNotify(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!id) return;
    try {
      await adminApi.revokeUserSessions(id);
      toastSuccess('Sessions Revoked', 'All active device sessions have been terminated.');
      fetchUser();
    } catch (err: any) {
      toastError('Failed', err.message || 'Unable to revoke sessions.');
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    if (!id) return;
    setRevokingSessionId(sessionId);
    try {
      await adminApi.revokeUserSingleSession(id, sessionId);
      toastSuccess('Session Revoked', 'The device session has been terminated.');
      fetchUser();
    } catch (err: any) {
      toastError('Revocation Failed', err.message || 'Could not revoke session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleCopyIp = (ip: string) => {
    if (!ip || ip === '—') return;
    try {
      navigator.clipboard.writeText(ip);
      setCopiedIp(ip);
      setTimeout(() => setCopiedIp(null), 2000);
    } catch {}
  };

  const handlePasswordReset = async () => {
    if (!id || !userDetail) return;
    try {
      await adminApi.requestUserPasswordReset(id);
      toastSuccess('Reset Flow Initiated', `Password reset token generated for ${userDetail.user.email}.`);
      fetchUser();
    } catch (err: any) {
      toastError('Reset Failed', err.message || 'Could not initiate reset.');
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!id) return;
    try {
      await adminApi.revokeUserApiKey(id, keyId);
      toastSuccess('API Key Revoked', 'The selected API key has been revoked.');
      fetchUser();
    } catch (err: any) {
      toastError('Revocation Failed', err.message || 'Could not revoke API key.');
    }
  };

  const handleRotateApiKey = async (keyId: string) => {
    if (!id) return;
    try {
      await adminApi.rotateUserApiKey(id, keyId);
      toastSuccess('API Key Rotated', 'Old key revoked and new prefix provisioned.');
      fetchUser();
    } catch (err: any) {
      toastError('Rotation Failed', err.message || 'Could not rotate API key.');
    }
  };

  const handleExportDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsExporting(true);
    try {
      const res = await adminApi.exportUserDossier(id, exportFormat);
      const dataStr =
        exportFormat === 'JSON'
          ? JSON.stringify((res as any)?.data || res, null, 2)
          : typeof res === 'string'
          ? res
          : JSON.stringify(res);
      const blob = new Blob([dataStr], { type: exportFormat === 'JSON' ? 'application/json' : 'text/csv' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safeEmail = (userDetail?.user?.email || id).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `user_dossier_${safeEmail}_${new Date().toISOString().slice(0, 10)}.${exportFormat.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toastSuccess('Dossier Exported', `User data successfully downloaded in ${exportFormat} format.`);
      setIsExportModalOpen(false);
    } catch (err: any) {
      toastError('Export Failed', err.message || 'Could not export user dossier.');
    } finally {
      setIsExporting(false);
    }
  };

  // --- SNAPSHOT METRICS & FILTERED DATA MEMOS ---
  const snapshotMetrics = useMemo(() => {
    const fin = userDetail?.financialSummary;
    const ordSummary = userDetail?.orderSummary;

    // Filter loaded orders & ledger lines based on global client criteria
    let matchedOrders = [...(userDetail?.recentOrders || [])];
    let matchedLedger = [...(userDetail?.recentLedgerLines || [])];

    // Search filter across both orders and ledger lines
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      matchedOrders = matchedOrders.filter((o) => {
        const matchPublic = o.publicId?.toLowerCase().includes(q);
        const matchPhone = o.recipientPhone?.toLowerCase().includes(q);
        const matchId = o.id?.toLowerCase().includes(q);
        const matchNet = o.network?.toLowerCase().includes(q);
        const matchStatus = o.orderStatus?.toLowerCase().includes(q);
        return matchPublic || matchPhone || matchId || matchNet || matchStatus;
      });

      matchedLedger = matchedLedger.filter((l) => {
        const desc = l.description?.toLowerCase() || '';
        const refId = l.referenceId?.toLowerCase() || '';
        const refType = l.referenceType?.toLowerCase() || '';
        const entryType = l.entryType?.toLowerCase() || '';
        return desc.includes(q) || refId.includes(q) || refType.includes(q) || entryType.includes(q);
      });
    }

    // Network filter (affects orders)
    if (globalNetwork !== 'ALL') {
      const fNet = globalNetwork.toUpperCase();
      matchedOrders = matchedOrders.filter((o) => {
        const oNet = (o.network || '').toUpperCase();
        const isAtMatch = (oNet === 'AT' || oNet === 'AIRTELTIGO') && (fNet === 'AT' || fNet === 'AIRTELTIGO');
        return oNet === fNet || isAtMatch;
      });
    }

    // Status filter (affects orders)
    if (globalStatus !== 'ALL') {
      matchedOrders = matchedOrders.filter((o) => {
        if (globalStatus === 'COMPLETED') {
          return ['COMPLETED', 'DELIVERED', 'FULFILLED'].includes(o.orderStatus);
        }
        if (globalStatus === 'PENDING') {
          return ['PENDING', 'PENDING_APPROVAL', 'CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING'].includes(o.orderStatus);
        }
        if (globalStatus === 'FAILED') {
          return o.orderStatus === 'FAILED';
        }
        if (globalStatus === 'REFUNDED') {
          return o.orderStatus === 'REFUNDED' || o.refundStatus === 'COMPLETED';
        }
        return o.orderStatus === globalStatus;
      });
    }

    // Ledger Type filter (affects ledger)
    if (globalLedgerType !== 'ALL') {
      matchedLedger = matchedLedger.filter((l) => l.entryType === globalLedgerType);
    }

    // Date Range filters
    if (globalPeriod === 'CUSTOM') {
      if (globalStartDate) {
        matchedOrders = matchedOrders.filter((o) => {
          try {
            return new Date(o.createdAt).toISOString().slice(0, 10) >= globalStartDate;
          } catch {
            return true;
          }
        });
        matchedLedger = matchedLedger.filter((l) => {
          try {
            return new Date(l.createdAt).toISOString().slice(0, 10) >= globalStartDate;
          } catch {
            return true;
          }
        });
      }
      if (globalEndDate) {
        matchedOrders = matchedOrders.filter((o) => {
          try {
            return new Date(o.createdAt).toISOString().slice(0, 10) <= globalEndDate;
          } catch {
            return true;
          }
        });
        matchedLedger = matchedLedger.filter((l) => {
          try {
            return new Date(l.createdAt).toISOString().slice(0, 10) <= globalEndDate;
          } catch {
            return true;
          }
        });
      }
    } else if (globalPeriod !== 'ALL') {
      const now = new Date();
      let cutoff: Date | null = null;
      if (globalPeriod === 'TODAY') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (globalPeriod === 'YESTERDAY') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      } else if (globalPeriod === '7D') {
        cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (globalPeriod === '30D') {
        cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      } else if (globalPeriod === '90D') {
        cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      } else if (globalPeriod === 'MONTH') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      if (cutoff) {
        matchedOrders = matchedOrders.filter((o) => {
          try {
            return new Date(o.createdAt) >= cutoff!;
          } catch {
            return true;
          }
        });
        matchedLedger = matchedLedger.filter((l) => {
          try {
            return new Date(l.createdAt) >= cutoff!;
          } catch {
            return true;
          }
        });
      }
    }

    // Sort order
    if (globalSort === 'DATE_ASC') {
      matchedOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      matchedLedger.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (globalSort === 'DATE_DESC') {
      matchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      matchedLedger.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (globalSort === 'AMOUNT_DESC') {
      matchedOrders.sort((a, b) => (Number(b.amountPesewas) || 0) - (Number(a.amountPesewas) || 0));
      matchedLedger.sort((a, b) => (Number(b.amountPesewas) || 0) - (Number(a.amountPesewas) || 0));
    } else if (globalSort === 'AMOUNT_ASC') {
      matchedOrders.sort((a, b) => (Number(a.amountPesewas) || 0) - (Number(b.amountPesewas) || 0));
      matchedLedger.sort((a, b) => (Number(a.amountPesewas) || 0) - (Number(b.amountPesewas) || 0));
    }

    // Calculate aggregated metrics
    const totalOrdersCount = isGlobalFiltered
      ? (ordSummary?.totalOrders ?? matchedOrders.length)
      : (ordSummary?.totalOrders || userDetail?.metrics?.totalOrders || matchedOrders.length);

    const completedOrdersCount = isGlobalFiltered
      ? (ordSummary?.completed ?? matchedOrders.filter((o) => ['COMPLETED', 'DELIVERED', 'FULFILLED'].includes(o.orderStatus)).length)
      : (ordSummary?.completed || 0);

    const failedOrdersCount = isGlobalFiltered
      ? (ordSummary?.failed ?? matchedOrders.filter((o) => o.orderStatus === 'FAILED').length)
      : (ordSummary?.failed || 0);

    const refundedOrdersCount = isGlobalFiltered
      ? (ordSummary?.refunded ?? matchedOrders.filter((o) => o.orderStatus === 'REFUNDED' || o.refundStatus === 'COMPLETED').length)
      : (ordSummary?.refunded || 0);

    // Total Spending
    const totalSpentPesewas = isGlobalFiltered
      ? (fin?.totalSpentPesewas ?? matchedOrders.filter((o) => ['COMPLETED', 'DELIVERED'].includes(o.orderStatus) && o.paymentStatus === 'PAID').reduce((sum, o) => sum + (Number(o.amountPesewas) || 0), 0))
      : (fin?.totalSpentPesewas || 0);

    // Total Refunds
    const totalRefundsPesewas = isGlobalFiltered
      ? (fin?.totalRefundsPesewas ?? matchedOrders.filter((o) => o.orderStatus === 'REFUNDED' || o.refundStatus === 'COMPLETED' || o.paymentStatus === 'REFUNDED').reduce((sum, o) => sum + (Number(o.amountPesewas) || 0), 0))
      : (fin?.totalRefundsPesewas || 0);

    // Ledger flow (credits, debits, net flow)
    let creditsPesewas = 0;
    let debitsPesewas = 0;
    for (const l of matchedLedger) {
      const amt = Number(l.amountPesewas) || 0;
      if (l.entryType === 'CREDIT') creditsPesewas += amt;
      else if (l.entryType === 'DEBIT') debitsPesewas += amt;
    }
    const netFlowPesewas = fin?.periodNetFlowPesewas !== undefined
      ? fin.periodNetFlowPesewas
      : (creditsPesewas - debitsPesewas);

    return {
      matchedOrders,
      matchedLedger,
      totalOrdersCount,
      completedOrdersCount,
      failedOrdersCount,
      refundedOrdersCount,
      totalSpentPesewas,
      totalRefundsPesewas,
      creditsPesewas: fin?.periodCreditsPesewas ?? creditsPesewas,
      debitsPesewas: fin?.periodDebitsPesewas ?? debitsPesewas,
      netFlowPesewas,
    };
  }, [userDetail, isGlobalFiltered, globalSearch, globalNetwork, globalStatus, globalLedgerType, globalPeriod, globalStartDate, globalEndDate, globalSort]);

  const filteredOrders = useMemo(() => {
    return (snapshotMetrics.matchedOrders || []).filter((o) => {
      if (orderStatusFilter !== 'ALL') {
        if (orderStatusFilter === 'PENDING_APPROVAL' || orderStatusFilter === 'PENDING') {
          const isPending = ['PENDING', 'PENDING_APPROVAL', 'CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED'].includes(o.orderStatus);
          if (!isPending) return false;
        } else if (o.orderStatus !== orderStatusFilter) {
          return false;
        }
      }
      if (orderNetworkFilter !== 'ALL') {
        const oNet = (o.network || '').toUpperCase();
        const fNet = orderNetworkFilter.toUpperCase();
        const isAtMatch = (oNet === 'AT' || oNet === 'AIRTELTIGO') && (fNet === 'AT' || fNet === 'AIRTELTIGO');
        if (oNet !== fNet && !isAtMatch) return false;
      }
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        const matchPublic = o.publicId?.toLowerCase().includes(q);
        const matchPhone = o.recipientPhone?.toLowerCase().includes(q);
        const matchId = o.id?.toLowerCase().includes(q);
        if (!matchPublic && !matchPhone && !matchId) return false;
      }
      if (orderDateFrom && o.createdAt) {
        try {
          const orderDate = new Date(o.createdAt).toISOString().slice(0, 10);
          if (orderDate < orderDateFrom) return false;
        } catch {}
      }
      if (orderDateTo && o.createdAt) {
        try {
          const orderDate = new Date(o.createdAt).toISOString().slice(0, 10);
          if (orderDate > orderDateTo) return false;
        } catch {}
      }
      const amountGhs = (Number(o.amountPesewas) || 0) / 100;
      if (amountGhs > orderMaxAmount) return false;
      return true;
    });
  }, [snapshotMetrics.matchedOrders, orderStatusFilter, orderNetworkFilter, orderSearch, orderDateFrom, orderDateTo, orderMaxAmount]);

  const filteredLedgerLines = useMemo(() => {
    return (snapshotMetrics.matchedLedger || []).filter((l) => {
      if (ledgerTypeFilter !== 'ALL' && l.entryType !== ledgerTypeFilter) return false;
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const desc = l.description?.toLowerCase() || '';
        const refId = l.referenceId?.toLowerCase() || '';
        const refType = l.referenceType?.toLowerCase() || '';
        if (!desc.includes(q) && !refId.includes(q) && !refType.includes(q)) return false;
      }
      if (ledgerDateFrom && l.createdAt) {
        try {
          const lineDate = new Date(l.createdAt).toISOString().slice(0, 10);
          if (lineDate < ledgerDateFrom) return false;
        } catch {}
      }
      if (ledgerDateTo && l.createdAt) {
        try {
          const lineDate = new Date(l.createdAt).toISOString().slice(0, 10);
          if (lineDate > ledgerDateTo) return false;
        } catch {}
      }
      const amountGhs = (Number(l.amountPesewas) || 0) / 100;
      if (amountGhs > ledgerMaxAmount) return false;
      return true;
    });
  }, [snapshotMetrics.matchedLedger, ledgerTypeFilter, ledgerSearch, ledgerDateFrom, ledgerDateTo, ledgerMaxAmount]);

  const filteredTransactions = useMemo(() => {
    return (userDetail?.transactions || []).filter((t) => {
      if (txStatusFilter !== 'ALL' && t.status !== txStatusFilter) return false;
      if (txProviderFilter !== 'ALL' && t.provider?.toUpperCase() !== txProviderFilter) return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const idMatch = t.id?.toLowerCase().includes(q);
        const methodMatch = t.paymentMethod?.toLowerCase().includes(q);
        if (!idMatch && !methodMatch) return false;
      }
      if (txDateFrom && t.createdAt) {
        try {
          const txDate = new Date(t.createdAt).toISOString().slice(0, 10);
          if (txDate < txDateFrom) return false;
        } catch {}
      }
      if (txDateTo && t.createdAt) {
        try {
          const txDate = new Date(t.createdAt).toISOString().slice(0, 10);
          if (txDate > txDateTo) return false;
        } catch {}
      }
      const amountGhs = (Number(t.amountPesewas) || 0) / 100;
      if (amountGhs > txMaxAmount) return false;
      return true;
    });
  }, [userDetail?.transactions, txStatusFilter, txProviderFilter, txSearch, txDateFrom, txDateTo, txMaxAmount]);

  const filteredActivity = useMemo(() => {
    return (userDetail?.activity || []).filter((act) => {
      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase();
        const actionMatch = act.action?.toLowerCase().includes(q);
        const actorMatch = act.actorId?.toLowerCase().includes(q) || act.actorType?.toLowerCase().includes(q);
        const ipMatch = act.ipAddress?.toLowerCase().includes(q);
        if (!actionMatch && !actorMatch && !ipMatch) return false;
      }
      if (activityDateFrom && act.createdAt) {
        try {
          const actDate = new Date(act.createdAt).toISOString().slice(0, 10);
          if (actDate < activityDateFrom) return false;
        } catch {}
      }
      if (activityDateTo && act.createdAt) {
        try {
          const actDate = new Date(act.createdAt).toISOString().slice(0, 10);
          if (actDate > activityDateTo) return false;
        } catch {}
      }
      return true;
    });
  }, [userDetail?.activity, activitySearch, activityDateFrom, activityDateTo]);

  const filteredPricing = useMemo(() => {
    return userPricing.filter((item) => {
      if (pricingNetworkFilter !== 'ALL' && item.network.toUpperCase() !== pricingNetworkFilter) return false;
      if (pricingOverrideFilter === 'OVERRIDES_ONLY' && item.customPricePesewas === null) return false;
      if (pricingOverrideFilter === 'DEFAULT_ONLY' && item.customPricePesewas !== null) return false;
      if (pricingSearch.trim()) {
        const q = pricingSearch.toLowerCase();
        const matchName = item.productName.toLowerCase().includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchMb = `${item.dataAmountMb}`.includes(q);
        if (!matchName && !matchSku && !matchMb) return false;
      }
      const effGhs = item.effectivePricePesewas / 100;
      if (effGhs > pricingMaxPrice) return false;
      return true;
    });
  }, [userPricing, pricingNetworkFilter, pricingOverrideFilter, pricingSearch, pricingMaxPrice]);

  const filteredSessions = useMemo(() => {
    let list = userDetail?.activeSessions || [];

    if (sessionStatusFilter === 'ACTIVE') {
      list = list.filter((s) => !s.isRevoked);
    } else if (sessionStatusFilter === 'REVOKED') {
      list = list.filter((s) => s.isRevoked);
    }

    if (sessionDeviceFilter !== 'ALL') {
      list = list.filter((s) => {
        const parsed = parseUserAgent(s.userAgent);
        return parsed.deviceType.toUpperCase() === sessionDeviceFilter;
      });
    }

    if (sessionDateFrom) {
      try {
        const fromTime = new Date(sessionDateFrom).getTime();
        list = list.filter((s) => {
          const time = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0;
          return time >= fromTime;
        });
      } catch {}
    }

    if (sessionDateTo) {
      try {
        const toDate = new Date(sessionDateTo);
        toDate.setHours(23, 59, 59, 999);
        const toTime = toDate.getTime();
        list = list.filter((s) => {
          const time = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : 0;
          return time <= toTime;
        });
      } catch {}
    }

    if (sessionSearch.trim()) {
      const q = sessionSearch.trim().toLowerCase();
      list = list.filter((s) => {
        const parsed = parseUserAgent(s.userAgent);
        return (
          (s.ipAddress && s.ipAddress.toLowerCase().includes(q)) ||
          (s.deviceId && s.deviceId.toLowerCase().includes(q)) ||
          parsed.browser.toLowerCase().includes(q) ||
          parsed.browserName.toLowerCase().includes(q) ||
          parsed.os.toLowerCase().includes(q) ||
          parsed.deviceLabel.toLowerCase().includes(q) ||
          parsed.raw.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [userDetail?.activeSessions, sessionStatusFilter, sessionDeviceFilter, sessionDateFrom, sessionDateTo, sessionSearch]);

  if (isLoading && !userDetail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
        <RefreshCw size={28} className="animate-spin" color="var(--color-brand-primary)" />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Loading authoritative user dossier...</span>
      </div>
    );
  }

  const u = userDetail?.user;
  const fin = userDetail?.financialSummary;
  const ordSummary = userDetail?.orderSummary;
  const balanceGhs = ((Number(u?.walletBalancePesewas) || 0) / 100).toFixed(2);
  const totalSpentGhs = ((Number(fin?.totalSpentPesewas) || 0) / 100).toFixed(2);
  const totalRefundsGhs = ((Number(fin?.totalRefundsPesewas) || 0) / 100).toFixed(2);
  const activeSessionsCount = (userDetail?.activeSessions || []).filter((s) => !s.isRevoked).length;
  const totalSessionsCount = (userDetail?.activeSessions || []).length;
  const revokedSessionsCount = (userDetail?.activeSessions || []).filter((s) => s.isRevoked).length;
  const uniqueIpsCount = new Set((userDetail?.activeSessions || []).map((s) => s.ipAddress).filter(Boolean)).size;
  const customOverridesCount = userPricing.filter((p) => p.customPricePesewas !== null).length;
  const totalOrdersCount = ordSummary?.totalOrders ?? userDetail?.recentOrders?.length ?? 0;
  const transactionsCount = userDetail?.transactions?.length || 0;
  const activityCount = userDetail?.activity?.length || 0;
  const notificationsCount = userDetail?.notifications?.length || 0;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAgent = u?.role === 'agent';

  // Common button style
  const tactileButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    boxShadow: 'var(--shadow-tactile-sm)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Navigation Breadcrumb */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.8rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-tactile-sm)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to User Directory</span>
        </button>
      </div>

      {/* 2. User Header Banner & Action Control Bar */}
      <Card
        elevated
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={u?.fullName || u?.email?.split('@')[0] || 'User'} size="lg" status={u?.status === 'ACTIVE' ? 'online' : 'offline'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {u?.fullName || u?.email?.split('@')[0] || 'User Control Center'}
                </h1>
                <Badge
                  variant={
                    u?.role === 'super_admin'
                      ? 'brand'
                      : u?.role === 'admin'
                      ? 'info'
                      : u?.role === 'agent'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {u?.role?.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant={u?.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                  {u?.status}
                </Badge>
                {fin?.reconciliationStatus === 'RECONCILED' ? (
                  <Badge variant="success" size="sm">✓ Reconciled</Badge>
                ) : (
                  <Badge variant="warning" size="sm">⚠ Discrepancy</Badge>
                )}
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0', fontFamily: 'var(--font-mono)' }}>
                {u?.email} • {u?.phone || 'No phone linked'} • User ID: {u?.id}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                Registered: {u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'} • Last Active: {u?.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setIsEditModalOpen(true)} style={tactileButtonStyle}>
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>
            <button type="button" onClick={() => setIsNotifyModalOpen(true)} style={tactileButtonStyle}>
              <Send size={14} />
              <span>Notify</span>
            </button>
            <button type="button" onClick={() => setIsExportModalOpen(true)} style={tactileButtonStyle}>
              <Download size={14} />
              <span>Export Dossier</span>
            </button>
            <button type="button" onClick={handleRunReconciliation} disabled={isReconciling} style={tactileButtonStyle}>
              <RefreshCw size={14} className={isReconciling ? 'animate-spin' : ''} />
              <span>Reconcile Wallet</span>
            </button>
            <button type="button" onClick={() => setIsAdjustModalOpen(true)} style={tactileButtonStyle}>
              <Wallet size={14} />
              <span>Adjust Wallet</span>
            </button>
            {isSuperAdmin && (
              <button type="button" onClick={() => setIsRoleModalOpen(true)} style={tactileButtonStyle}>
                <Shield size={14} />
                <span>Change Role</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleSuspend}
              style={{
                ...tactileButtonStyle,
                border: u?.status === 'ACTIVE' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--color-success)',
                color: u?.status === 'ACTIVE' ? 'var(--color-danger)' : 'var(--color-success)',
              }}
            >
              {u?.status === 'ACTIVE' ? <UserX size={14} /> : <UserCheck size={14} />}
              <span>{u?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* 2.5 Operational & Ledger Snapshot Filter Suite */}
      <Card
        elevated
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-tactile-sm)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Header row: Title, badge count, reset button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--color-brand-primary)',
                }}
              >
                <Sliders size={15} />
              </div>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Snapshot Metrics & Ledger Filters
              </span>
              {isGlobalFiltered ? (
                <Badge variant="brand" size="sm">
                  {activeGlobalFiltersCount} active {activeGlobalFiltersCount === 1 ? 'filter' : 'filters'}
                </Badge>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  All-time view
                </span>
              )}
            </div>

            {isGlobalFiltered && (
              <button
                type="button"
                onClick={handleResetGlobalFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Controls Row: Search + Selects */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <div style={{ minWidth: '180px', gridColumn: 'span 2' }}>
              <SearchInput
                placeholder="Search orders, ledger reference, phone..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onClear={() => setGlobalSearch('')}
              />
            </div>

            {/* Period / Date Range */}
            <div>
              <Select
                value={globalPeriod}
                onChange={(e) => {
                  const val = e.target.value;
                  setGlobalPeriod(val);
                  if (val === 'CUSTOM') {
                    setIsGlobalCustomDateOpen(true);
                  } else {
                    setIsGlobalCustomDateOpen(false);
                    setGlobalStartDate('');
                    setGlobalEndDate('');
                  }
                }}
                options={[
                  { label: '📅 All Time', value: 'ALL' },
                  { label: 'Today', value: 'TODAY' },
                  { label: 'Yesterday', value: 'YESTERDAY' },
                  { label: 'Last 7 Days', value: '7D' },
                  { label: 'Last 30 Days', value: '30D' },
                  { label: 'Last 90 Days', value: '90D' },
                  { label: 'This Month', value: 'MONTH' },
                  { label: 'Custom Range...', value: 'CUSTOM' },
                ]}
              />
            </div>

            {/* Sort Order */}
            <div>
              <Select
                value={globalSort}
                onChange={(e) => setGlobalSort(e.target.value)}
                options={[
                  { label: 'Sort: Newest First', value: 'DATE_DESC' },
                  { label: 'Sort: Oldest First', value: 'DATE_ASC' },
                  { label: 'Sort: Amount High-Low', value: 'AMOUNT_DESC' },
                  { label: 'Sort: Amount Low-High', value: 'AMOUNT_ASC' },
                ]}
              />
            </div>

            {/* Network Filter */}
            <div>
              <Select
                value={globalNetwork}
                onChange={(e) => setGlobalNetwork(e.target.value)}
                options={[
                  { label: 'All Networks', value: 'ALL' },
                  { label: 'MTN', value: 'MTN' },
                  { label: 'Telecel', value: 'TELECEL' },
                  { label: 'AT (AirtelTigo)', value: 'AT' },
                ]}
              />
            </div>

            {/* Status Filter */}
            <div>
              <Select
                value={globalStatus}
                onChange={(e) => setGlobalStatus(e.target.value)}
                options={[
                  { label: 'All Statuses', value: 'ALL' },
                  { label: 'Completed', value: 'COMPLETED' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Failed', value: 'FAILED' },
                  { label: 'Refunded', value: 'REFUNDED' },
                ]}
              />
            </div>

            {/* Ledger Type Filter */}
            <div>
              <Select
                value={globalLedgerType}
                onChange={(e) => setGlobalLedgerType(e.target.value)}
                options={[
                  { label: 'All Ledger Types', value: 'ALL' },
                  { label: 'Credits (Inflow)', value: 'CREDIT' },
                  { label: 'Debits (Outflow)', value: 'DEBIT' },
                ]}
              />
            </div>
          </div>

          {/* Custom Date Range Picker Expandable Drawer */}
          {isGlobalCustomDateOpen && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px dashed var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} color="var(--color-text-muted)" />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  Custom Range:
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</label>
                <input
                  type="date"
                  value={globalStartDate}
                  onChange={(e) => setGlobalStartDate(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</label>
                <input
                  type="date"
                  value={globalEndDate}
                  onChange={(e) => setGlobalEndDate(e.target.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {(globalStartDate || globalEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalStartDate('');
                    setGlobalEndDate('');
                  }}
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 3. Snapshot Overview Metric Cards (Standardized subtle surfaces without garish tint fills) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard
          title={isGlobalFiltered ? "Authoritative Wallet (Flow)" : "Authoritative Wallet"}
          value={
            isGlobalFiltered
              ? `GH₵ ${(snapshotMetrics.netFlowPesewas >= 0 ? '+' : '')}${(snapshotMetrics.netFlowPesewas / 100).toFixed(2)}`
              : `GH₵ ${balanceGhs}`
          }
          subvalue={
            isGlobalFiltered
              ? `In: GH₵ ${(snapshotMetrics.creditsPesewas / 100).toFixed(2)} • Out: GH₵ ${(snapshotMetrics.debitsPesewas / 100).toFixed(2)} (Bal: GH₵ ${balanceGhs})`
              : (fin?.reconciliationStatus === 'RECONCILED' ? 'Ledger verified' : `Discrepancy: GH₵ ${((fin?.discrepancyPesewas || 0)/100).toFixed(2)}`)
          }
          icon={<TactileIcon icon={Wallet} color="security" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title={isGlobalFiltered ? "Filtered Orders" : "Total Lifetime Orders"}
          value={
            (isGlobalFiltered
              ? snapshotMetrics.totalOrdersCount
              : (ordSummary?.totalOrders || userDetail?.metrics?.totalOrders || 0)
            ).toLocaleString()
          }
          subvalue={`${snapshotMetrics.completedOrdersCount} completed • ${snapshotMetrics.failedOrdersCount} failed${snapshotMetrics.refundedOrdersCount > 0 ? ` • ${snapshotMetrics.refundedOrdersCount} refunded` : ''}`}
          icon={<TactileIcon icon={Package} color="orders" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title={isGlobalFiltered ? "Filtered Spending" : "Total Spending"}
          value={`GH₵ ${(snapshotMetrics.totalSpentPesewas / 100).toFixed(2)}`}
          subvalue={isGlobalFiltered ? `Filtered volume (Lifetime: GH₵ ${totalSpentGhs})` : "Lifetime purchase volume"}
          icon={<TactileIcon icon={Activity} color="analytics" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title={isGlobalFiltered ? "Filtered Refunds" : "Resolved Refunds"}
          value={`GH₵ ${(snapshotMetrics.totalRefundsPesewas / 100).toFixed(2)}`}
          subvalue={`${snapshotMetrics.refundedOrdersCount} refunded orders${isGlobalFiltered ? ` (Lifetime: GH₵ ${totalRefundsGhs})` : ''}`}
          icon={<TactileIcon icon={RefreshCw} color="api" size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
        <MetricCard
          title="Reconciliation Audit"
          value={fin?.reconciliationStatus === 'RECONCILED' ? 'PASSED' : 'DISCREPANCY'}
          subvalue={isGlobalFiltered ? "Filtered ledger check" : "Double-entry ledger check"}
          icon={<TactileIcon icon={ShieldCheck} color={fin?.reconciliationStatus === 'RECONCILED' ? 'emerald' : 'speed'} size="sm" />}
          style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
        />
      </div>

      {/* 4. Responsive Navigation Tabs with Tactile Styling */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {[
          { key: 'overview', label: 'Overview', icon: <User size={14} /> },
          { key: 'wallet', label: `Wallet & Ledger (GH₵ ${balanceGhs})`, icon: <Wallet size={14} /> },
          { key: 'orders', label: `Orders (${totalOrdersCount})`, icon: <Package size={14} /> },
          { key: 'pricing', label: `Bundle Pricing (${customOverridesCount > 0 ? `${customOverridesCount} overrides` : 'Custom'})`, icon: <Tag size={14} /> },
          { key: 'transactions', label: `Transactions (${transactionsCount})`, icon: <CreditCard size={14} /> },
          { key: 'activity', label: `Audit Stream (${activityCount})`, icon: <Activity size={14} /> },
          { key: 'sessions', label: `Sessions (${activeSessionsCount})`, icon: <Lock size={14} /> },
          ...(isAgent ? [{ key: 'agent', label: 'Agent & API Portal', icon: <Store size={14} /> }] : []),
          { key: 'notifications', label: `Notifications (${notificationsCount})`, icon: <Send size={14} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                border: isActive ? '1px solid var(--color-brand-primary)' : '1px solid transparent',
                boxShadow: isActive ? 'var(--shadow-tactile-sm)' : 'none',
                color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Overview */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Financial Overview Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Wallet} color="security" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Financial Overview
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Wallet Balance (Current)</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {balanceGhs}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Ledger-Derived Balance</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.ledgerDerivedBalancePesewas || 0)/100).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Deposits</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.totalDepositsPesewas || 0)/100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Purchases</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {totalSpentGhs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Refunds</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {totalRefundsGhs}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pending Operations</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {((fin?.pendingOperationsPesewas || 0)/100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Reconciliation Status</span>
                <Badge variant={fin?.reconciliationStatus === 'RECONCILED' ? 'success' : 'warning'} size="sm">
                  {fin?.reconciliationStatus}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Orders Overview Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={Package} color="orders" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Orders Overview
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Orders</span>
                <strong>{ordSummary?.totalOrders || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Completed</span>
                <Badge variant="success" size="sm">{ordSummary?.completed || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Processing</span>
                <Badge variant="info" size="sm">{ordSummary?.processing || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pending Approval</span>
                <Badge variant="warning" size="sm">{ordSummary?.pending || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Failed</span>
                <Badge variant="danger" size="sm">{ordSummary?.failed || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Refunded</span>
                <Badge variant="neutral" size="sm">{ordSummary?.refunded || 0}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Order</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {ordSummary?.lastOrderAt ? new Date(ordSummary.lastOrderAt).toLocaleDateString() : 'None'}
                </span>
              </div>
            </div>
          </Card>

          {/* Account Profile Details */}
          <Card
            elevated
            style={{
              padding: 'var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
              <TactileIcon icon={User} color="api" size="sm" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Account & Security Overview
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Full Name</span>
                <strong>{u?.fullName || 'Not specified'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email Address</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{u?.email}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Phone Number</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{u?.phone || 'Unlinked'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Security Domain</span>
                <Badge variant="brand" size="sm">{u?.securityDomain || 'CUSTOMER'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>MFA Status</span>
                <Badge variant={u?.mfaEnabled ? 'success' : 'neutral'} size="sm">{u?.mfaEnabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Failed Login Attempts</span>
                <strong>{u?.failedLoginAttempts || 0}</strong>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Wallet & Financial Control */}
      {/* ========================================================================= */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Financial Integrity & Reconciliation Bar */}
          <Card
            elevated
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)' }}>
                  {fin?.reconciliationStatus === 'RECONCILED' ? (
                    <CheckCircle size={18} color="var(--color-success)" />
                  ) : (
                    <AlertTriangle size={18} color="var(--color-warning)" />
                  )}
                  Wallet Reconciliation Status: {fin?.reconciliationStatus}
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
                  User Wallet Projection: <strong>GH₵ {balanceGhs}</strong> • Double-Entry Ledger Sum: <strong>GH₵ {((fin?.ledgerDerivedBalancePesewas || 0)/100).toFixed(2)}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={handleRunReconciliation} disabled={isReconciling} style={tactileButtonStyle}>
                  <RefreshCw size={14} className={isReconciling ? 'animate-spin' : ''} />
                  <span>Run Reconciliation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(true)}
                  style={{
                    ...tactileButtonStyle,
                    color: 'var(--color-brand-primary, #0284C7)',
                  }}
                >
                  <Wallet size={14} />
                  <span>Post Double-Entry Voucher</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Filters for Ledger */}
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
              {/* Search */}
              <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
                <SearchInput
                  value={ledgerSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLedgerSearch(e.target.value)}
                  placeholder="Search description, reference ID..."
                />
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {/* Entry Type */}
                <div style={{ width: '130px' }}>
                  <Select
                    value={ledgerTypeFilter}
                    onChange={(e) => setLedgerTypeFilter(e.target.value)}
                    options={[
                      { label: 'All Entries', value: 'ALL' },
                      { label: 'Credit (+)', value: 'CREDIT' },
                      { label: 'Debit (-)', value: 'DEBIT' },
                    ]}
                  />
                </div>

                {/* Date From & To */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</span>
                  <input
                    type="date"
                    value={ledgerDateFrom}
                    onChange={(e) => setLedgerDateFrom(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</span>
                  <input
                    type="date"
                    value={ledgerDateTo}
                    onChange={(e) => setLedgerDateTo(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                </div>

                {/* Amount Range Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    Max: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>GH₵ {ledgerMaxAmount}</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="1000"
                    value={ledgerMaxAmount}
                    onChange={(e) => setLedgerMaxAmount(Number(e.target.value))}
                    style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--color-brand-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Active filters */}
            {(ledgerTypeFilter !== 'ALL' || ledgerSearch.trim() || ledgerDateFrom || ledgerDateTo || ledgerMaxAmount < 1000) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                {ledgerTypeFilter !== 'ALL' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.55rem', fontSize: '11px' }}>
                    Type: {ledgerTypeFilter}
                    <button type="button" onClick={() => setLedgerTypeFilter('ALL')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </span>
                )}
                {ledgerSearch.trim() && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.55rem', fontSize: '11px' }}>
                    Query: "{ledgerSearch}"
                    <button type="button" onClick={() => setLedgerSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setLedgerTypeFilter('ALL'); setLedgerSearch(''); setLedgerDateFrom(''); setLedgerDateTo(''); setLedgerMaxAmount(1000); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Ledger Journal Lines Table */}
          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Double-Entry Ledger History & Audit Trail
              </h3>
            </div>
            <Table
              minWidth="1100px"
              headers={['Entry Type', 'Amount (GHS)', 'Account Type', 'Reference Type', 'Reference ID', 'Description', 'Timestamp']}
            >
              {filteredLedgerLines.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No financial ledger journal lines found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLedgerLines.map((line, idx) => (
                  <tr key={line.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={line.entryType === 'CREDIT' ? 'success' : 'danger'} size="sm" dot>
                        {line.entryType}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: line.entryType === 'CREDIT' ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                      GH₵ {((line.amountPesewas || 0) / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                      {line.accountType || 'CUSTOMER_WALLET'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {line.referenceType}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {line.referenceId?.slice(0, 12)}...
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)' }}>
                      {line.description || 'System transaction'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {line.createdAt ? new Date(line.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Orders & Lifecycle Visibility */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filter Bar with Date Pickers, Range Slider, Network, and Status */}
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
              {/* Search Box */}
              <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
                <SearchInput
                  value={orderSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderSearch(e.target.value)}
                  placeholder="Search Public ID, Phone, Order ID..."
                />
              </div>

              {/* Horizontal Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                {/* Status */}
                <div style={{ width: '140px' }}>
                  <Select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    options={[
                      { label: 'All Statuses', value: 'ALL' },
                      { label: 'Completed', value: 'COMPLETED' },
                      { label: 'Processing', value: 'PROCESSING' },
                      { label: 'Pending', value: 'PENDING_APPROVAL' },
                      { label: 'Failed', value: 'FAILED' },
                      { label: 'Refunded', value: 'REFUNDED' },
                    ]}
                  />
                </div>

                {/* Network */}
                <div style={{ width: '135px' }}>
                  <Select
                    value={orderNetworkFilter}
                    onChange={(e) => setOrderNetworkFilter(e.target.value)}
                    options={[
                      { label: 'All Networks', value: 'ALL' },
                      { label: 'MTN Ghana', value: 'MTN' },
                      { label: 'Telecel', value: 'TELECEL' },
                      { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
                    ]}
                  />
                </div>

                {/* Date Pickers (From, To) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</span>
                  <input
                    type="date"
                    value={orderDateFrom}
                    onChange={(e) => setOrderDateFrom(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</span>
                  <input
                    type="date"
                    value={orderDateTo}
                    onChange={(e) => setOrderDateTo(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                </div>

                {/* Amount Range Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    Max: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>GH₵ {orderMaxAmount}</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    value={orderMaxAmount}
                    onChange={(e) => setOrderMaxAmount(Number(e.target.value))}
                    style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--color-brand-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {(orderStatusFilter !== 'ALL' || orderNetworkFilter !== 'ALL' || orderSearch.trim() || orderDateFrom || orderDateTo || orderMaxAmount < 500) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                {orderStatusFilter !== 'ALL' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.55rem', fontSize: '11px' }}>
                    Status: {orderStatusFilter}
                    <button type="button" onClick={() => setOrderStatusFilter('ALL')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </span>
                )}
                {orderNetworkFilter !== 'ALL' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.55rem', fontSize: '11px' }}>
                    Network: {orderNetworkFilter}
                    <button type="button" onClick={() => setOrderNetworkFilter('ALL')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </span>
                )}
                {orderSearch.trim() && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.55rem', fontSize: '11px' }}>
                    Query: "{orderSearch}"
                    <button type="button" onClick={() => setOrderSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setOrderStatusFilter('ALL'); setOrderNetworkFilter('ALL'); setOrderSearch(''); setOrderDateFrom(''); setOrderDateTo(''); setOrderMaxAmount(500); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <Table
              minWidth="1200px"
              headers={['Order ID / Public ID', 'Recipient', 'Network', 'Bundle Size', 'Amount', 'Payment', 'ByteBeacon State', 'DataHouse State', 'Date', 'Action']}
            >
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                      {o.publicId || o.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {o.recipientPhone}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant="neutral" size="sm">{o.network}</Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {o.dataAmountMb >= 1000 ? `${o.dataAmountMb / 1000} GB` : `${o.dataAmountMb} MB`}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      GH₵ {((o.amountPesewas || 0) / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                        {o.paymentStatus || 'PAID'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge
                        variant={
                          o.orderStatus === 'COMPLETED'
                            ? 'success'
                            : o.orderStatus === 'PROCESSING'
                            ? 'info'
                            : o.orderStatus === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                        dot
                      >
                        {o.orderStatus}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant="neutral" size="sm">
                        {o.providerStatus || 'SUBMITTED'}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border-subtle)',
                          boxShadow: 'var(--shadow-tactile-sm)',
                          color: 'var(--color-text-primary)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Inspect Pipeline
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Custom Data Bundle Pricing */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header & Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Individual User Bundle Pricing Overrides
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                Set custom wholesale or special retail rates for this user. Overrides take precedence over default catalog rates.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={fetchUserPricing} disabled={isLoadingPricing} style={tactileButtonStyle}>
                <RefreshCw size={14} className={isLoadingPricing ? 'animate-spin' : ''} />
                <span>Refresh Pricing</span>
              </button>
            </div>
          </div>

          {/* Pricing Telemetry Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <MetricCard
              title="Catalog Plans"
              value={userPricing.length.toString()}
              subvalue="Available telecom bundles"
              icon={<TactileIcon icon={Package} color="api" size="sm" />}
              style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
            />
            <MetricCard
              title="Active Custom Overrides"
              value={userPricing.filter((p) => p.customPricePesewas !== null && p.isActive).length.toString()}
              subvalue={`${userPricing.filter((p) => p.customPricePesewas !== null).length} total configured`}
              icon={<TactileIcon icon={Tag} color="violet" size="sm" />}
              style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
            />
            <MetricCard
              title="Default Retail Scope"
              value={isAgent ? 'Agent Wholesale Tier' : 'Standard Retail'}
              subvalue={`Base role: ${userDetail?.user?.role?.toUpperCase() || 'CUSTOMER'}`}
              icon={<TactileIcon icon={Shield} color="security" size="sm" />}
              style={{ minHeight: '100px', padding: '0.85rem 1rem' }}
            />
          </div>

          {/* Filters Bar */}
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
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {/* Search */}
              <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
                <SearchInput
                  placeholder="Search plan name, SKU, or data size..."
                  value={pricingSearch}
                  onChange={(e) => setPricingSearch(e.target.value)}
                />
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Network */}
                <div style={{ width: '135px' }}>
                  <Select
                    value={pricingNetworkFilter}
                    onChange={(e) => setPricingNetworkFilter(e.target.value)}
                    options={[
                      { label: 'All Networks', value: 'ALL' },
                      { label: 'MTN Ghana', value: 'MTN' },
                      { label: 'Telecel', value: 'TELECEL' },
                      { label: 'AT (AirtelTigo)', value: 'AIRTELTIGO' },
                    ]}
                  />
                </div>

                {/* Overrides */}
                <div style={{ width: '150px' }}>
                  <Select
                    value={pricingOverrideFilter}
                    onChange={(e) => setPricingOverrideFilter(e.target.value)}
                    options={[
                      { label: 'All Plans', value: 'ALL' },
                      { label: 'Custom Overrides', value: 'OVERRIDES_ONLY' },
                      { label: 'Default Catalog', value: 'DEFAULT_ONLY' },
                    ]}
                  />
                </div>

                {/* Max Price Range Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    Max: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>GH₵ {pricingMaxPrice}</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    value={pricingMaxPrice}
                    onChange={(e) => setPricingMaxPrice(Number(e.target.value))}
                    style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--color-brand-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Active filters */}
            {(pricingNetworkFilter !== 'ALL' || pricingOverrideFilter !== 'ALL' || pricingSearch.trim() || pricingMaxPrice < 500) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                <button
                  type="button"
                  onClick={() => { setPricingNetworkFilter('ALL'); setPricingOverrideFilter('ALL'); setPricingSearch(''); setPricingMaxPrice(500); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Pricing Table */}
          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <Table
              minWidth="1100px"
              headers={[
                'Plan / SKU',
                'Network',
                'Data Allowance',
                'Standard Retail',
                'Default Agent',
                'Custom User Price',
                'Effective Price',
                'Status',
                'Actions',
              ]}
            >
              {filteredPricing.map((item) => {
                const hasCustom = item.customPricePesewas !== null;
                const customGhs = hasCustom ? (item.customPricePesewas! / 100).toFixed(2) : null;
                const effectiveGhs = (item.effectivePricePesewas / 100).toFixed(2);
                const baseGhs = (item.basePricePesewas / 100).toFixed(2);
                const agentGhs = (item.defaultAgentPricePesewas / 100).toFixed(2);
                const dataFormatted =
                  item.dataAmountMb >= 1024
                    ? `${(item.dataAmountMb / 1024).toFixed(item.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`
                    : `${item.dataAmountMb} MB`;

                return (
                  <tr key={item.productId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>{item.productName}</span>
                        <span style={{ fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                          {item.sku}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge
                        variant={
                          item.network === 'MTN'
                            ? 'warning'
                            : item.network === 'TELECEL'
                            ? 'danger'
                            : 'info'
                        }
                        size="sm"
                      >
                        {item.network}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{dataFormatted}</td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      GH₵ {baseGhs}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      GH₵ {agentGhs}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {hasCustom ? (
                        <Badge variant={item.isActive ? 'brand' : 'neutral'} size="sm">
                          GH₵ {customGhs}
                        </Badge>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: hasCustom ? 'var(--color-brand-accent)' : 'var(--color-text-primary)' }}>
                        GH₵ {effectiveGhs}
                      </strong>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {hasCustom ? (
                        <Badge variant={item.isActive ? 'success' : 'neutral'} size="sm">
                          {item.isActive ? 'OVERRIDE ACTIVE' : 'DISABLED'}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">DEFAULT</Badge>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditPricing(item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            boxShadow: 'var(--shadow-tactile-sm)',
                            color: 'var(--color-text-primary)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Edit3 size={12} />
                          <span>{hasCustom ? 'Edit' : 'Set'}</span>
                        </button>
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetCustomPricing(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--color-danger)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {userPricing.length === 0 && !isLoadingPricing && (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No catalog products found. Please ensure catalog products are active.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: Dedicated Transactions View */}
      {/* ========================================================================= */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Transaction Filters */}
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
              <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
                <SearchInput
                  value={txSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTxSearch(e.target.value)}
                  placeholder="Search Transaction ID, Method..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ width: '135px' }}>
                  <Select
                    value={txStatusFilter}
                    onChange={(e) => setTxStatusFilter(e.target.value)}
                    options={[
                      { label: 'All Statuses', value: 'ALL' },
                      { label: 'Paid', value: 'PAID' },
                      { label: 'Pending', value: 'PENDING' },
                      { label: 'Failed', value: 'FAILED' },
                    ]}
                  />
                </div>

                <div style={{ width: '140px' }}>
                  <Select
                    value={txProviderFilter}
                    onChange={(e) => setTxProviderFilter(e.target.value)}
                    options={[
                      { label: 'All Gateways', value: 'ALL' },
                      { label: 'Paystack', value: 'PAYSTACK' },
                      { label: 'Hubtel', value: 'HUBTEL' },
                      { label: 'Wallet', value: 'WALLET' },
                    ]}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</span>
                  <input
                    type="date"
                    value={txDateFrom}
                    onChange={(e) => setTxDateFrom(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</span>
                  <input
                    type="date"
                    value={txDateTo}
                    onChange={(e) => setTxDateTo(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    Max: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>GH₵ {txMaxAmount}</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="1000"
                    value={txMaxAmount}
                    onChange={(e) => setTxMaxAmount(Number(e.target.value))}
                    style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--color-brand-primary)' }}
                  />
                </div>
              </div>
            </div>

            {(txStatusFilter !== 'ALL' || txProviderFilter !== 'ALL' || txSearch.trim() || txDateFrom || txDateTo || txMaxAmount < 1000) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                <button
                  type="button"
                  onClick={() => { setTxStatusFilter('ALL'); setTxProviderFilter('ALL'); setTxSearch(''); setTxDateFrom(''); setTxDateTo(''); setTxMaxAmount(1000); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                User Payments & Payment Gateway Transactions
              </h3>
            </div>
            <Table
              minWidth="1100px"
              headers={['Transaction ID', 'Amount (GHS)', 'Gateway / Provider', 'Payment Method', 'Payment Status', 'Timestamp']}
            >
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No payment gateway transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>
                      {t.id.slice(0, 12)}...
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      GH₵ {((t.amountPesewas || 0) / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant="brand" size="sm">{t.provider || 'PAYSTACK'}</Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)' }}>
                      {t.paymentMethod || 'MoMo'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant={t.status === 'PAID' ? 'success' : 'warning'} size="sm" dot>
                        {t.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: Activity & Audit Stream */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filter Card */}
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
              <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                <SearchInput
                  value={activitySearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActivitySearch(e.target.value)}
                  placeholder="Search Action, Actor ID, IP Address..."
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</span>
                <input
                  type="date"
                  value={activityDateFrom}
                  onChange={(e) => setActivityDateFrom(e.target.value)}
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '11px',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</span>
                <input
                  type="date"
                  value={activityDateTo}
                  onChange={(e) => setActivityDateTo(e.target.value)}
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>

            {(activitySearch.trim() || activityDateFrom || activityDateTo) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                <button
                  type="button"
                  onClick={() => { setActivitySearch(''); setActivityDateFrom(''); setActivityDateTo(''); }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Complete Account Audit Log & Security Events
              </h3>
            </div>
            <Table
              minWidth="1100px"
              headers={['Action', 'Actor Type', 'Actor ID', 'IP Address', 'Metadata', 'Timestamp']}
            >
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No activity stream records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredActivity.map((act, idx) => (
                  <tr key={act.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <Badge variant="brand" size="sm">{act.action}</Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                      {act.actorType}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {act.actorId ? `${act.actorId.slice(0, 10)}...` : 'System'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                      {act.ipAddress || '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                      {act.metadata ? JSON.stringify(act.metadata) : '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {act.createdAt ? new Date(act.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: Sessions & Security */}
      {/* ========================================================================= */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header & Global Security Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                Active Device Sessions & Security Controls
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.125rem 0 0' }}>
                Real-time active client sessions, browser fingerprints, network origins, and session invalidation.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handlePasswordReset} style={tactileButtonStyle}>
                <Key size={14} />
                <span>Force Password Reset</span>
              </button>
              <button
                type="button"
                onClick={handleRevokeSessions}
                style={{
                  ...tactileButtonStyle,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-danger)',
                }}
              >
                <LogOut size={14} />
                <span>Revoke All Sessions</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Active Sessions
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: activeSessionsCount > 0 ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                  {activeSessionsCount}
                </span>
                {activeSessionsCount > 0 && (
                  <Badge variant="success" size="sm" dot>Live</Badge>
                )}
              </div>
            </Card>

            <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Recorded Sessions
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                {totalSessionsCount}
              </div>
            </Card>

            <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Revoked Sessions
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: revokedSessionsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                {revokedSessionsCount}
              </div>
            </Card>

            <Card elevated style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Unique IP Addresses
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-brand-primary)', marginTop: '0.25rem' }}>
                {uniqueIpsCount}
              </div>
            </Card>
          </div>

          {/* Standardized Filter Card */}
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
              <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                <SearchInput
                  value={sessionSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionSearch(e.target.value)}
                  placeholder="Search browser, OS, device, IP..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <Select
                  value={sessionStatusFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSessionStatusFilter(e.target.value as any)}
                  style={{ minWidth: '130px', padding: '0.45rem 0.65rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="REVOKED">Revoked Only</option>
                </Select>

                <Select
                  value={sessionDeviceFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSessionDeviceFilter(e.target.value)}
                  style={{ minWidth: '130px', padding: '0.45rem 0.65rem', fontSize: 'var(--font-size-xs)' }}
                >
                  <option value="ALL">All Devices</option>
                  <option value="DESKTOP">Desktop Only</option>
                  <option value="MOBILE">Mobile Only</option>
                  <option value="TABLET">Tablet Only</option>
                </Select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>From:</span>
                  <input
                    type="date"
                    value={sessionDateFrom}
                    onChange={(e) => setSessionDateFrom(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>To:</span>
                  <input
                    type="date"
                    value={sessionDateTo}
                    onChange={(e) => setSessionDateTo(e.target.value)}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '11px',
                    }}
                  />
                </div>
              </div>
            </div>

            {(sessionSearch.trim() || sessionStatusFilter !== 'ALL' || sessionDeviceFilter !== 'ALL' || sessionDateFrom || sessionDateTo) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Active Filters:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSessionSearch('');
                    setSessionStatusFilter('ALL');
                    setSessionDeviceFilter('ALL');
                    setSessionDateFrom('');
                    setSessionDateTo('');
                  }}
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </Card>

          {/* Sessions Table Card */}
          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Active & Historical Device Sessions ({filteredSessions.length})
              </h3>
            </div>
            <Table
              minWidth="1050px"
              headers={['Browser & Device', 'Operating System', 'IP Address & Network', 'Activity Timeline', 'Status', 'Actions']}
            >
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No sessions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const parsed = parseUserAgent(s.userAgent);
                  const ipInfo = formatIpInfo(s.ipAddress);
                  const isExpanded = expandedSessionId === s.id;
                  const isRevokingThis = revokingSessionId === s.id;

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {/* Browser & Device */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-bg-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              border: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {parsed.deviceType === 'mobile' ? (
                              <Smartphone size={16} color="var(--color-brand-primary)" />
                            ) : parsed.deviceType === 'tablet' ? (
                              <Tablet size={16} color="var(--color-brand-primary)" />
                            ) : parsed.deviceType === 'bot' ? (
                              <Globe size={16} color="var(--color-warning)" />
                            ) : (
                              <Laptop size={16} color="var(--color-brand-primary)" />
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                              {parsed.browser}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{parsed.deviceLabel}</span>
                              {s.deviceId && (
                                <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  ({s.deviceId.slice(0, 8)}...)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                marginTop: '0.2rem',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontSize: '10px',
                                color: 'var(--color-brand-primary)',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              <span>{isExpanded ? 'Hide Raw User-Agent' : 'View Raw User-Agent'}</span>
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: '0.35rem',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  fontSize: '10px',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--color-text-muted)',
                                  wordBreak: 'break-all',
                                  maxWidth: '360px',
                                }}
                              >
                                {s.userAgent || 'No user agent captured'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Operating System */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: 'var(--color-bg-subtle)',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {parsed.os}
                          </span>
                        </div>
                      </td>

                      {/* IP Address & Network */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {ipInfo.display}
                            </span>
                            {ipInfo.display !== '—' && (
                              <button
                                type="button"
                                title="Copy IP"
                                onClick={() => handleCopyIp(ipInfo.display)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.15rem',
                                  color: copiedIp === ipInfo.display ? 'var(--color-success)' : 'var(--color-text-muted)',
                                }}
                              >
                                {copiedIp === ipInfo.display ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                          <div>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '0.1rem 0.35rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor:
                                  ipInfo.type === 'localhost'
                                    ? 'rgba(139, 92, 246, 0.12)'
                                    : ipInfo.type === 'private'
                                    ? 'rgba(234, 179, 8, 0.12)'
                                    : 'rgba(59, 130, 246, 0.12)',
                                color:
                                  ipInfo.type === 'localhost'
                                    ? 'rgb(124, 58, 237)'
                                    : ipInfo.type === 'private'
                                    ? 'rgb(180, 83, 9)'
                                    : 'rgb(37, 99, 235)',
                              }}
                            >
                              {ipInfo.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Activity Timeline */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Clock size={12} color="var(--color-text-muted)" />
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                              {formatRelativeTime(s.lastActiveAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            Active: {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}
                          </div>
                          {s.createdAt && (
                            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                              Started: {new Date(s.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <Badge variant={s.isRevoked ? 'danger' : 'success'} size="sm" dot>
                          {s.isRevoked ? 'REVOKED' : 'ACTIVE'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {!s.isRevoked ? (
                          <button
                            type="button"
                            disabled={isRevokingThis}
                            onClick={() => handleRevokeSingleSession(s.id)}
                            style={{
                              ...tactileButtonStyle,
                              padding: '0.35rem 0.65rem',
                              fontSize: '11px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: 'var(--color-danger)',
                              cursor: isRevokingThis ? 'wait' : 'pointer',
                              opacity: isRevokingThis ? 0.6 : 1,
                            }}
                          >
                            <UserX size={12} />
                            <span>{isRevokingThis ? 'Revoking...' : 'Revoke'}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Terminated
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: Agent & Developer Portal */}
      {/* ========================================================================= */}
      {activeTab === 'agent' && isAgent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Agent Storefront Card */}
          <Card
            elevated
            style={{
              padding: 'var(--space-5)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)', letterSpacing: '0.04em' }}>
              Agent Storefront Overview
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Store Name</span>
                <strong style={{ fontSize: '14px' }}>{userDetail?.agentData?.store?.storeName || 'No Storefront'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Store Slug / URL</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>/store/{userDetail?.agentData?.store?.slug || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Commission Rate</span>
                <strong>{((userDetail?.agentData?.store?.commissionRate || 0.05) * 100).toFixed(1)}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Estimated Commission Earned</span>
                <strong style={{ color: 'var(--color-success)', fontSize: '14px' }}>GH₵ {((userDetail?.agentData?.commissionEarnedPesewas || 0)/100).toFixed(2)}</strong>
              </div>
            </div>
          </Card>

          {/* API Keys Table */}
          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
                Provisioned API Keys (Secrets Masked)
              </h3>
            </div>
            <Table
              minWidth="1000px"
              headers={['Key Name', 'Prefix Identifier', 'Environment', 'Rate Limit Tier', 'Status', 'Last Used', 'Actions']}
            >
              {(userDetail?.agentData?.apiKeys || []).map((k) => (
                <tr key={k.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{k.name}</td>
                  <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-2xs)' }}>{k.keyPrefix}...</td>
                  <td style={{ padding: '0.85rem 1rem' }}><Badge variant="brand" size="sm">{k.environment}</Badge></td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)' }}>{k.rateLimitTier}</td>
                  <td style={{ padding: '0.85rem 1rem' }}><Badge variant={k.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>{k.status}</Badge></td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {k.status === 'ACTIVE' && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => handleRotateApiKey(k.id)} style={{ ...tactileButtonStyle, padding: '0.3rem 0.6rem', fontSize: '11px' }}>
                          Rotate
                        </button>
                        <button type="button" onClick={() => handleRevokeApiKey(k.id)} style={{ ...tactileButtonStyle, padding: '0.3rem 0.6rem', fontSize: '11px', color: 'var(--color-danger)' }}>
                          Revoke
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: Notifications Stream & Dispatch */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0, letterSpacing: '0.04em' }}>
              Dispatched User Notifications
            </h3>
            <button
              type="button"
              onClick={() => setIsNotifyModalOpen(true)}
              style={{
                ...tactileButtonStyle,
                color: 'var(--color-brand-primary, #0284C7)',
              }}
            >
              <Send size={14} />
              <span>Send Direct Notification</span>
            </button>
          </div>

          <Card
            elevated
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-tactile-sm)',
            }}
          >
            <Table
              minWidth="1000px"
              headers={['Channel', 'Subject / Message Title', 'Message Content Snippet', 'Timestamp']}
            >
              {(userDetail?.notifications || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No notifications sent to this account yet.
                  </td>
                </tr>
              ) : (
                (userDetail?.notifications || []).map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}><Badge variant="info" size="sm">{n.channel}</Badge></td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{n.subject || 'Account Notification'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-xs)' }}>{n.message || '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: 'var(--font-size-2xs)', fontFamily: 'var(--font-mono)' }}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS STANDARDIZED WITH <Modal> */}
      {/* ========================================================================= */}

      {/* 1. Order Lifecycle Pipeline Modal */}
      {selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          title="Order Lifecycle Pipeline"
          subtitle={`Order ID: ${selectedOrder.id} • Public ID: ${selectedOrder.publicId || 'N/A'}`}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>1. Payment State</span>
                <Badge variant={selectedOrder.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">{selectedOrder.paymentStatus}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>2. ByteBeacon Internal State</span>
                <Badge variant={selectedOrder.orderStatus === 'COMPLETED' ? 'success' : 'info'} size="sm">{selectedOrder.orderStatus}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>3. DataHouse Telecom Provider State</span>
                <Badge variant="neutral" size="sm">{selectedOrder.providerStatus || 'SUBMITTED'}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>4. Refund / Reconciliation State</span>
                <Badge variant="neutral" size="sm">{selectedOrder.refundStatus || 'NONE'}</Badge>
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(234, 179, 8, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
              <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-primary)', margin: 0 }}>
                <strong>DataHouse Authority Rule:</strong> DataHouse remains authoritative for telecom fulfillment. Administrators cannot force-complete orders manually.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)' }}>
              <Button variant="primary" size="sm" onClick={() => setSelectedOrder(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Edit Profile Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit User Profile"
          subtitle="Update authoritative profile and verification flags."
          maxWidth="460px"
        >
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              label="Full Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: 'var(--space-1)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editPhoneVerified}
                  onChange={(e) => setEditPhoneVerified(e.target.checked)}
                />
                Phone Verified
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editEmailVerified}
                  onChange={(e) => setEditEmailVerified(e.target.checked)}
                />
                Email Verified
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingProfile}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Double-Entry Wallet Adjustment Modal */}
      {isAdjustModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAdjustModalOpen(false)}
          title="Double-Entry Wallet Adjustment"
          subtitle="Posts balanced journal voucher to financial_ledger paired against PLATFORM_RESERVE."
          maxWidth="480px"
        >
          <form onSubmit={handleAdjustWallet} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
              <Button
                type="button"
                variant={adjustType === 'CREDIT' ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => setAdjustType('CREDIT')}
                leftIcon={<PlusCircle size={14} />}
              >
                Credit
              </Button>
              <Button
                type="button"
                variant={adjustType === 'DEBIT' ? 'danger' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => setAdjustType('DEBIT')}
                leftIcon={<MinusCircle size={14} />}
              >
                Debit
              </Button>
              <Button
                type="button"
                variant={adjustType === 'OVERRIDE' ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => setAdjustType('OVERRIDE')}
                leftIcon={<Sliders size={14} />}
              >
                Override
              </Button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Current Authoritative Balance:
              </span>
              <strong style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                GH₵ {balanceGhs}
              </strong>
            </div>

            {adjustType === 'OVERRIDE' && fin && fin.discrepancyPesewas > 0 && (
              <div
                style={{
                  fontSize: '12px',
                  lineHeight: '1.45',
                  color: 'var(--color-warning)',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  ⚠️ Active Discrepancy: GH₵ {((Number(fin.discrepancyPesewas) || 0) / 100).toFixed(2)}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  Wallet projection is <strong>GH₵ {balanceGhs}</strong> while ledger-derived balance is <strong>GH₵ {((Number(fin.ledgerDerivedBalancePesewas) || 0) / 100).toFixed(2)}</strong>.
                  Overriding will update the wallet balance and post a balancing journal voucher directly to the ledger, eliminating the discrepancy and reconciling the account.
                </div>
              </div>
            )}

            <Input
              label={
                adjustType === 'OVERRIDE'
                  ? 'Target Wallet Balance (GH₵) *'
                  : `Amount to ${adjustType === 'CREDIT' ? 'Credit' : 'Debit'} (GH₵) *`
              }
              type="number"
              step="0.01"
              min={adjustType === 'OVERRIDE' ? '0' : '0.01'}
              value={adjustAmountGhs}
              onChange={(e) => setAdjustAmountGhs(e.target.value)}
              placeholder="0.00"
              required
            />

            {adjustType === 'OVERRIDE' && adjustAmountGhs !== '' && !isNaN(parseFloat(adjustAmountGhs)) && (() => {
              const target = parseFloat(adjustAmountGhs);
              const current = parseFloat(balanceGhs) || 0;
              const diff = target - current;
              if (diff > 0) {
                return (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                      padding: '0.4rem 0.6rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    🟢 Net Credit to Wallet: +GH₵ {diff.toFixed(2)} (Ledger Escrow Debit)
                  </div>
                );
              }
              if (diff < 0) {
                return (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-danger)',
                      fontWeight: 700,
                      padding: '0.4rem 0.6rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    🔴 Net Debit from Wallet: -GH₵ {Math.abs(diff).toFixed(2)} (Ledger Escrow Credit)
                  </div>
                );
              }
              return (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    padding: '0.4rem 0.6rem',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  ⚪ No change in balance (GH₵ 0.00)
                </div>
              );
            })()}

            <Input
              label="Mandatory Audit Reason (min 5 chars) *"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={
                adjustType === 'OVERRIDE'
                  ? 'e.g. Account balance correction following audit'
                  : 'e.g. Manual MoMo deposit resolution'
              }
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAdjustModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={adjustType === 'DEBIT' ? 'danger' : 'primary'}
                size="sm"
                isLoading={isAdjusting}
              >
                {adjustType === 'OVERRIDE' ? 'Confirm Override' : `Confirm ${adjustType}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Role Change Modal */}
      {isRoleModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsRoleModalOpen(false)}
          title="Change Account Role"
          subtitle="Modifying roles will immediately invalidate all active sessions."
          maxWidth="440px"
        >
          <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>New Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <option value="customer">Customer</option>
                <option value="agent">Agent Reseller</option>
                <option value="admin">Operations Admin</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>

            <Input
              label="Reason for Role Change"
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
              placeholder="e.g. Approved Agent onboarding application"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isUpdatingRole}>
                Confirm Role Change
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Direct User Notification Modal */}
      {isNotifyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNotifyModalOpen(false)}
          title="Send Notification to User"
          subtitle="Direct push notification dispatch to this account."
          maxWidth="460px"
        >
          <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Channel</label>
              <select
                value={notifyChannel}
                onChange={(e) => setNotifyChannel(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <option value="EMAIL">Email Relay</option>
                <option value="SMS">SMS Gateway</option>
                <option value="IN_APP">In-App Notification</option>
              </select>
            </div>

            <Input
              label="Subject"
              value={notifySubject}
              onChange={(e) => setNotifySubject(e.target.value)}
              placeholder="Important account update"
              required
            />

            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Message Content</label>
              <textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={4}
                required
                placeholder="Enter the body of the notification..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsNotifyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSendingNotify}>
                Send Notification
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Suspension Modal */}
      {isSuspendModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSuspendModalOpen(false)}
          title="Suspend User Account"
          subtitle="Suspension immediately prevents storefront checkouts and authentication."
          maxWidth="460px"
        >
          <form onSubmit={handleExecuteSuspend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              label="Mandatory Reason for Suspension"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Fraudulent transaction activity flagged"
              required
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', cursor: 'pointer', marginTop: 'var(--space-1)' }}>
              <input
                type="checkbox"
                checked={suspendRevokeSessions}
                onChange={(e) => setSuspendRevokeSessions(e.target.checked)}
              />
              Revoke all active device & API sessions
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsSuspendModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isSuspending}>
                Suspend Account
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Export Dossier Modal */}
      {isExportModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsExportModalOpen(false)}
          title="Export User Dossier"
          subtitle="Generates full account record (profile, orders, ledger, activity) excluding secrets."
          maxWidth="440px"
        >
          <form onSubmit={handleExportDossier} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <option value="JSON">JSON Format</option>
                <option value="CSV">CSV Format</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'var(--space-3)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsExportModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isExporting}>
                Download Dossier
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. Edit Custom Bundle Price Modal */}
      {editingPricingProduct && (
        <Modal
          isOpen={true}
          onClose={() => setEditingPricingProduct(null)}
          title="Set Custom Bundle Price"
          subtitle={`${editingPricingProduct.productName} (${editingPricingProduct.network})`}
          maxWidth="480px"
        >
          <form onSubmit={handleSaveCustomPricing} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Standard Retail Price:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {(editingPricingProduct.basePricePesewas / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Default Agent Wholesale:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>GH₵ {(editingPricingProduct.defaultAgentPricePesewas / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>User Current Role:</span>
                <span style={{ fontWeight: 700 }}>{userDetail?.user?.role?.toUpperCase() || 'CUSTOMER'}</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                Custom Price for this User (GH₵)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 4.50"
                value={editCustomPriceGhs}
                onChange={(e) => setEditCustomPriceGhs(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="customPriceActive"
                checked={editCustomPriceActive}
                onChange={(e) => setEditCustomPriceActive(e.target.checked)}
              />
              <label htmlFor="customPriceActive" style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
                Enable this custom pricing override immediately
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingPricingProduct(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingPricing}>
                Save Custom Price
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminUserDetailPage;
