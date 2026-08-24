import React, { useState, useMemo, useRef } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { NetworkSelector } from '../../components/commerce/NetworkSelector.js';
import { BundleSelector, BundleItem } from '../../components/commerce/BundleSelector.js';
import { catalogApi } from '../../api/catalog.api.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
import { Card } from '../../components/ui/Card/Card.js';
import { PhoneInput, Select, Checkbox, Textarea } from '../../components/ui/index.js';
import { Button } from '../../components/ui/Button/Button.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import {
  ShoppingCart,
  Zap,
  Smartphone,
  UsersRound,
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  UploadCloud,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  ArrowRight,
  ShieldCheck,
  Phone,
  Loader2,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';
import { usePlatformStatus } from '../../context/PlatformStatusContext.js';

type OrderMode = 'single' | 'bulk' | 'excel';
type BulkSubMode = 'normal' | 'free';

interface BulkRecipientEntry {
  id: string;
  phone: string;
  bundleId: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
}

const NETWORK_THEMES: Record<
  NetworkProvider,
  {
    brandColor: string;
    buttonBg: string;
    buttonTextColor: string;
    accentBg: string;
    borderColor: string;
    glowColor: string;
  }
> = {
  [NetworkProvider.MTN]: {
    brandColor: '#FFCC00',
    buttonBg: '#FFCC00',
    buttonTextColor: '#000000',
    accentBg: 'rgba(255, 204, 0, 0.08)',
    borderColor: 'rgba(255, 204, 0, 0.35)',
    glowColor: 'rgba(255, 204, 0, 0.25)',
  },
  [NetworkProvider.TELECEL]: {
    brandColor: '#E7192D',
    buttonBg: '#E7192D',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(231, 25, 45, 0.08)',
    borderColor: 'rgba(231, 25, 45, 0.35)',
    glowColor: 'rgba(231, 25, 45, 0.25)',
  },
  [NetworkProvider.AIRTELTIGO]: {
    brandColor: '#0066B2',
    buttonBg: '#0066B2',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(0, 102, 178, 0.08)',
    borderColor: 'rgba(0, 102, 178, 0.35)',
    glowColor: 'rgba(0, 102, 178, 0.25)',
  },
};

export const BuyDataPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  // Page level state
  const [orderMode, setOrderMode] = useState<OrderMode>('single');
  const [bulkSubMode, setBulkSubMode] = useState<BulkSubMode>('normal');
  const [viewMode, setViewMode] = useState<'normal' | 'grid'>('normal');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);

  // Bundles for current network loaded dynamically from authoritative database / catalog API
  const [availableBundles, setAvailableBundles] = useState<BundleItem[]>([]);

  // Single order state
  const [singlePhone, setSinglePhone] = useState('');
  const [singlePhoneError, setSinglePhoneError] = useState('');
  const [singleBundleId, setSingleBundleId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Load catalog bundles dynamically on network change
  React.useEffect(() => {
    let isMounted = true;
    catalogApi
      .getBundles(selectedNetwork, 'CUSTOMER')
      .then((items) => {
        if (!isMounted || !Array.isArray(items)) return;
        const mapped: BundleItem[] = items.map((p) => ({
          id: p.id,
          sku: p.sku,
          network: p.network as NetworkProvider,
          dataAmountMb: p.dataAmountMb,
          dataDisplay: `${(p.dataAmountMb / 1024).toFixed(p.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`,
          pricePesewas: p.basePricePesewas,
          priceDisplay: `GH₵ ${(p.basePricePesewas / 100).toFixed(2)}`,
          validityDays: p.validityDays,
          validityDisplay: p.validityDesc || `${p.validityDays} Days`,
          popular: Boolean(p.popular),
        }));
        setAvailableBundles(mapped);
        if (mapped.length > 0) {
          setSingleBundleId((prev) => {
            const exists = mapped.some((b) => b.id === prev);
            return exists ? prev : (mapped[2]?.id || mapped[0]?.id);
          });
        }
      })
      .catch(() => {
        if (isMounted) setAvailableBundles([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNetwork]);

  // Bulk Normal state
  const [bulkRecipients, setBulkRecipients] = useState<BulkRecipientEntry[]>([
    { id: '1', phone: '', bundleId: '', frequency: 'once' },
  ]);

  // Bulk Free state
  const [freePasteText, setFreePasteText] = useState(
    '0241234567, 5GB\n0551234567, 10GB\n0201234567, 2.5GB'
  );

  // Excel Order state
  const [isDragging, setIsDragging] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelParsedRows, setExcelParsedRows] = useState<{ phone: string; data: string; pricePesewas: number }[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Purchase Modal Trigger State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [modalPayload, setModalPayload] = useState<{
    title?: string;
    packageSummary?: string;
    recipientSummary?: string;
    amountDisplay?: string;
    bundleId?: string;
    recipientPhone?: string;
  }>({});

  const theme = NETWORK_THEMES[selectedNetwork] || NETWORK_THEMES[NetworkProvider.MTN];

  // Handle Network Change
  const handleNetworkSelect = (net: NetworkProvider) => {
    setSelectedNetwork(net);
  };

  // Selected single bundle object
  const currentSingleBundle = useMemo(() => {
    return (
      availableBundles.find((b) => b.id === singleBundleId) ||
      availableBundles[0] || {
        id: '',
        sku: '',
        network: selectedNetwork,
        dataAmountMb: 0,
        dataDisplay: 'Select Bundle',
        pricePesewas: 0,
        priceDisplay: 'GH₵ 0.00',
        validityDays: 30,
        validityDisplay: 'Non-Expiry',
      }
    );
  }, [availableBundles, singleBundleId, selectedNetwork]);

  // Single Order Submit
  const handleSingleOrderSubmit = () => {
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (!currentSingleBundle || !currentSingleBundle.id) {
      toastError('Bundle Required', 'Please select a data bundle before submitting.');
      return;
    }
    const cleaned = singlePhone.replace(/\s+/g, '');
    if (!/^(0|\+?233)[25][0-9]{8}$/.test(cleaned)) {
      setSinglePhoneError('Enter a valid Ghana 10-digit mobile number (e.g. 0241234567)');
      return;
    }
    setSinglePhoneError('');

    setModalPayload({
      title: isRecurring ? `Recurring Order (${recurringFrequency})` : 'Purchase Data',
      packageSummary: currentSingleBundle.dataDisplay,
      recipientSummary: cleaned,
      amountDisplay: currentSingleBundle.priceDisplay,
      bundleId: currentSingleBundle.id,
      recipientPhone: cleaned,
    });
    setPurchaseModalOpen(true);
  };

  // Bulk Normal: Add / Remove / Update Recipient
  const handleAddRecipient = () => {
    setBulkRecipients((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        phone: '',
        bundleId: currentSingleBundle?.id || '',
        frequency: 'once',
      },
    ]);
  };

  const handleRemoveRecipient = (id: string) => {
    if (bulkRecipients.length <= 1) return;
    setBulkRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRecipient = (id: string, updates: Partial<BulkRecipientEntry>) => {
    setBulkRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  // Calculate Bulk Normal Total
  const bulkNormalTotal = useMemo(() => {
    let total = 0;
    bulkRecipients.forEach((r) => {
      const b = availableBundles.find((pkg) => pkg.id === r.bundleId) || currentSingleBundle;
      total += b ? b.pricePesewas : 0;
    });
    return (total / 100).toFixed(2);
  }, [bulkRecipients, availableBundles, currentSingleBundle]);

  const handleBulkNormalSubmit = () => {
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    const hasInvalid = bulkRecipients.some((r) => {
      const cleaned = r.phone.replace(/\s+/g, '');
      return !/^(0|\+?233)[25][0-9]{8}$/.test(cleaned);
    });

    if (hasInvalid) {
      toastError('Validation Failed', 'Please verify all recipient mobile numbers before continuing.');
      return;
    }

    setModalPayload({
      title: 'Bulk Order Purchase',
      packageSummary: `${bulkRecipients.length} Packages (${selectedNetwork})`,
      recipientSummary: `${bulkRecipients.length} Mobile Recipients`,
      amountDisplay: `GH₵ ${bulkNormalTotal}`,
      bundleId: currentSingleBundle.id,
    });
    setPurchaseModalOpen(true);
  };

  // Parse Bulk Free Text Area
  const parsedFreeEntries = useMemo(() => {
    const lines = freePasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    let totalPesewas = 0;

    const entries = lines.map((line, idx) => {
      const parts = line.split(/[,\t]+/).map((s) => s.trim());
      const phone = parts[0] || '';
      const sizeStr = parts[1] || '5GB';

      const isValidPhone = /^(0|\+?233)[25][0-9]{8}$/.test(phone.replace(/\s+/g, ''));
      const matchingBundle = availableBundles.find(
        (b) => b.dataDisplay.toLowerCase().replace(/\s+/g, '') === sizeStr.toLowerCase().replace(/\s+/g, '')
      ) || availableBundles[2] || availableBundles[0];

      totalPesewas += matchingBundle ? matchingBundle.pricePesewas : 2800;

      return {
        id: idx,
        phone,
        sizeStr: matchingBundle ? matchingBundle.dataDisplay : sizeStr,
        isValid: isValidPhone,
        pricePesewas: matchingBundle ? matchingBundle.pricePesewas : 2800,
      };
    });

    return {
      entries,
      totalPesewas,
      validCount: entries.filter((e) => e.isValid).length,
      invalidCount: entries.filter((e) => !e.isValid).length,
    };
  }, [freePasteText, availableBundles]);

  const handleBulkFreeSubmit = () => {
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (parsedFreeEntries.invalidCount > 0) {
      toastError('Invalid Entries', 'Please fix any invalid recipient phone numbers.');
      return;
    }
    if (parsedFreeEntries.entries.length === 0) {
      toastError('No Entries', 'Please paste at least one recipient line.');
      return;
    }

    setModalPayload({
      title: 'Bulk Free Order',
      packageSummary: `${parsedFreeEntries.entries.length} Packages (${selectedNetwork})`,
      recipientSummary: `${parsedFreeEntries.entries.length} Recipients (Free Paste)`,
      amountDisplay: `GH₵ ${(parsedFreeEntries.totalPesewas / 100).toFixed(2)}`,
      bundleId: currentSingleBundle.id,
    });
    setPurchaseModalOpen(true);
  };

  // Excel Template Downloads
  const handleDownloadSimpleTemplate = () => {
    const csvContent = 'Recipient,Volume\n0241234567,5GB\n0551234567,10GB\n0201234567,2.5GB\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bytebeacon_simple_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Template Downloaded', 'Simple template downloaded (Recipient, Volume).');
  };

  const handleDownloadFullTemplate = () => {
    const csvContent = 'Beneficiary Msisdn,Data (MB)\n0241234567,5120\n0551234567,10240\n0201234567,2560\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bytebeacon_full_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Template Downloaded', 'Full template downloaded (Beneficiary Msisdn, Data (MB)).');
  };

  // File Upload Handlers
  const handleFileUpload = (file: File) => {
    setExcelFile(file);
    setExcelLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setExcelLoading(false);
      const text = evt.target?.result as string;
      if (!text) {
        toastError('Empty File', 'Uploaded file appears to be empty.');
        return;
      }

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsedRows: Array<{ phone: string; data: string; pricePesewas: number }> = [];

      // Skip header if first row contains non-digits
      const startIdx = lines[0] && /[a-zA-Z]/.test(lines[0]) ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 2) {
          const phone = parts[0];
          const dataMb = parseInt(parts[1], 10) || 1024;
          const dataDisplay = dataMb >= 1024 ? `${(dataMb / 1024).toFixed(1)} GB` : `${dataMb} MB`;
          const estimatedPrice = Math.round(dataMb * 0.55);
          parsedRows.push({ phone, data: dataDisplay, pricePesewas: estimatedPrice });
        }
      }

      if (parsedRows.length === 0) {
        toastError('Format Error', 'No valid rows found. Please use the format: Beneficiary Msisdn, Data (MB)');
        return;
      }

      setExcelParsedRows(parsedRows);
      toastSuccess('File Parsed', `Parsed ${file.name} successfully (${parsedRows.length} recipients detected).`);
    };

    reader.onerror = () => {
      setExcelLoading(false);
      toastError('Read Error', 'Failed to read the uploaded file.');
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleExcelSubmit = () => {
    if (isMaintenanceMode) {
      toastError('Maintenance in Progress', 'Platform checkout is temporarily paused for scheduled maintenance.');
      return;
    }
    if (!excelFile) {
      toastError('No File', 'Please upload an Excel or CSV file first.');
      return;
    }

    setModalPayload({
      title: 'Excel Bulk Order',
      packageSummary: `24 Recipients (${excelFile.name})`,
      recipientSummary: '24 Beneficiaries from Excel',
      amountDisplay: 'GH₵ 680.00',
      bundleId: currentSingleBundle.id,
    });
    setPurchaseModalOpen(true);
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header & Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TactileIcon icon={ShoppingCart} color="orders" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Buy Data
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Instant telecom fulfillment for Single, Multi-Recipient Bulk, and Excel batch orders.
          </p>
        </div>

        {/* View Switcher: Normal (Workspace) vs Grid (Card Catalog) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            backgroundColor: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('normal')}
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: viewMode === 'normal' ? 800 : 600,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              backgroundColor: viewMode === 'normal' ? 'var(--color-bg-base)' : 'transparent',
              color: viewMode === 'normal' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <List size={12} />
            <span>Normal</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: viewMode === 'grid' ? 800 : 600,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              backgroundColor: viewMode === 'grid' ? 'var(--color-bg-base)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <LayoutGrid size={12} />
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* Maintenance Mode In-Page Alert Banner */}
      {isMaintenanceMode && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            color: '#FBBF24',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <strong style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800 }}>
              Platform Maintenance Active — Checkout Operations Paused
            </strong>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {maintenanceMessage || 'Platform order fulfillment and checkout operations are temporarily paused for maintenance. You can still browse data packages and track existing orders.'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Step 1: Network Selection */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-3xs)',
              fontWeight: 900,
            }}
          >
            1
          </div>
          <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Choose Network Carrier
          </h2>
        </div>

        <NetworkSelector selectedNetwork={selectedNetwork} onSelect={handleNetworkSelect} />
      </section>

      {/* 3. Main Purchasing Workspace (Normal View) or Card Catalog (Grid View) */}
      {viewMode === 'grid' ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Available {selectedNetwork} Packages (Grid View)
            </h2>
          </div>
          <BundleSelector
            network={selectedNetwork}
            selectedBundleId={singleBundleId}
            onSelectBundle={(b) => {
              setSingleBundleId(b.id);
              setModalPayload({
                packageSummary: b.dataDisplay,
                amountDisplay: b.priceDisplay,
                bundleId: b.id,
              });
              setPurchaseModalOpen(true);
            }}
            viewMode="grid"
          />
        </section>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Order Mode Switcher Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '4px',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-default)',
                boxShadow: 'var(--shadow-tactile-sm)',
              }}
            >
              <button
                type="button"
                onClick={() => setOrderMode('single')}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: orderMode === 'single' ? 900 : 700,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: orderMode === 'single' ? theme.buttonBg : 'transparent',
                  color: orderMode === 'single' ? theme.buttonTextColor : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: orderMode === 'single' ? `0 2px 8px ${theme.glowColor}` : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <Smartphone size={14} />
                <span>Single</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderMode('bulk')}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: orderMode === 'bulk' ? 900 : 700,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: orderMode === 'bulk' ? theme.buttonBg : 'transparent',
                  color: orderMode === 'bulk' ? theme.buttonTextColor : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: orderMode === 'bulk' ? `0 2px 8px ${theme.glowColor}` : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <UsersRound size={14} />
                <span>Bulk</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderMode('excel')}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: orderMode === 'excel' ? 900 : 700,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: orderMode === 'excel' ? theme.buttonBg : 'transparent',
                  color: orderMode === 'excel' ? theme.buttonTextColor : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: orderMode === 'excel' ? `0 2px 8px ${theme.glowColor}` : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            </div>

            {/* Bulk Sub-Mode Switcher */}
            {orderMode === 'bulk' && (
              <div
                style={{
                  display: 'inline-flex',
                  padding: '2px',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setBulkSubMode('normal')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: bulkSubMode === 'normal' ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    backgroundColor: bulkSubMode === 'normal' ? 'var(--color-bg-base)' : 'transparent',
                    color: bulkSubMode === 'normal' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setBulkSubMode('free')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: bulkSubMode === 'free' ? 800 : 600,
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    backgroundColor: bulkSubMode === 'free' ? 'var(--color-bg-base)' : 'transparent',
                    color: bulkSubMode === 'free' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Free (Paste)
                </button>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* MODE 1: SINGLE ORDER                                         */}
          {/* ============================================================ */}
          {orderMode === 'single' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
              {/* Left Column: Form Controls */}
              <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Single Order Configuration
                </h3>

                {/* Recipient Phone */}
                <PhoneInput
                  label="Recipient Phone Number"
                  placeholder="024 123 4567"
                  value={singlePhone}
                  onChange={(e) => {
                    setSinglePhone(e.target.value);
                    setSinglePhoneError('');
                  }}
                  error={singlePhoneError}
                  hint={`Enter the 10-digit ${selectedNetwork} recipient mobile number.`}
                />

                {/* Package Dropdown Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Select Data Package
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
                    {availableBundles.map((pkg) => {
                      const isSelected = pkg.id === singleBundleId;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSingleBundleId(pkg.id)}
                          style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? `2px solid ${theme.brandColor}` : '1px solid var(--color-border-default)',
                            backgroundColor: isSelected ? theme.accentBg : 'var(--color-bg-surface-elevated)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 120ms ease',
                          }}
                        >
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                            {pkg.dataDisplay}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {pkg.priceDisplay}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recurring Order Toggle */}
                <div style={{ paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <Checkbox
                    label="Make this a recurring order"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />

                  {isRecurring && (
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-base)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div>
                        <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          Repeat Frequency
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                          {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setRecurringFrequency(freq)}
                              style={{
                                padding: '0.3rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: recurringFrequency === freq ? `1px solid ${theme.brandColor}` : '1px solid var(--color-border-default)',
                                backgroundColor: recurringFrequency === freq ? theme.accentBg : 'var(--color-bg-surface)',
                                color: recurringFrequency === freq ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontWeight: 800,
                                fontSize: 'var(--font-size-3xs)',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }}
                            >
                              {freq}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                        <Clock size={12} />
                        <span>Order will automatically repeat according to the selected schedule.</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column: Order Summary */}
              <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-5)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Order Summary
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Carrier</span>
                      <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>{selectedNetwork}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Package Volume</span>
                      <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                        {currentSingleBundle.dataDisplay}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Recipient Line</span>
                      <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                        {singlePhone || '024 XXX XXXX'}
                      </strong>
                    </div>

                    {isRecurring && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Frequency</span>
                        <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand)', textTransform: 'capitalize' }}>
                          {recurringFrequency}
                        </strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Total Price</span>
                      <strong style={{ fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                        {currentSingleBundle.priceDisplay}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSingleOrderSubmit}
                  disabled={isMaintenanceMode}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: isMaintenanceMode ? 'var(--color-bg-surface-muted)' : theme.buttonBg,
                    color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                    fontWeight: 900,
                    fontSize: 'var(--font-size-sm)',
                    cursor: isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: !isMaintenanceMode ? `0 3px 12px ${theme.glowColor}` : 'none',
                    transition: 'transform 100ms ease',
                  }}
                  onMouseDown={(e) => (!isMaintenanceMode && (e.currentTarget.style.transform = 'translateY(1px)'))}
                  onMouseUp={(e) => (!isMaintenanceMode && (e.currentTarget.style.transform = 'translateY(0)'))}
                >
                  <span>{isMaintenanceMode ? 'Platform in Maintenance' : `Buy Data (${currentSingleBundle.priceDisplay})`}</span>
                  <ArrowRight size={16} strokeWidth={2.6} />
                </button>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 2: BULK ORDER (Normal & Free)                           */}
          {/* ============================================================ */}
          {orderMode === 'bulk' && bulkSubMode === 'normal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Bulk Order (Multi-Recipient)
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Add multiple recipients and assign custom data bundles independently.
                  </p>
                </div>

                <Button variant="outline" size="sm" onClick={handleAddRecipient} leftIcon={<Plus size={14} />}>
                  Add Recipient
                </Button>
              </div>

              {/* Recipient Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {bulkRecipients.map((recipient, idx) => (
                  <Card key={recipient.id} style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 40px', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div>
                      <PhoneInput
                        label={`Recipient ${idx + 1}`}
                        placeholder="024 123 4567"
                        value={recipient.phone}
                        onChange={(e) => handleUpdateRecipient(recipient.id, { phone: e.target.value })}
                      />
                    </div>

                    <div>
                      <Select
                        label="Bundle"
                        value={recipient.bundleId}
                        onChange={(e) => handleUpdateRecipient(recipient.id, { bundleId: e.target.value })}
                        options={availableBundles.map((b) => ({
                          label: `${b.dataDisplay} — ${b.priceDisplay}`,
                          value: b.id,
                        }))}
                      />
                    </div>

                    <div>
                      <Select
                        label="Frequency"
                        value={recipient.frequency}
                        onChange={(e) => handleUpdateRecipient(recipient.id, { frequency: e.target.value as any })}
                        options={[
                          { label: 'One-Time', value: 'once' },
                          { label: 'Daily', value: 'daily' },
                          { label: 'Weekly', value: 'weekly' },
                          { label: 'Monthly', value: 'monthly' },
                        ]}
                      />
                    </div>

                    {/* Remove Action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '16px' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(recipient.id)}
                        disabled={bulkRecipients.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: bulkRecipients.length <= 1 ? 'var(--color-text-muted)' : 'var(--color-danger)',
                          cursor: bulkRecipients.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: '6px',
                          opacity: bulkRecipients.length <= 1 ? 0.4 : 1,
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Bulk Summary Card */}
              <Card style={{ padding: 'var(--space-5)', backgroundColor: 'var(--color-bg-surface-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Recipients</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
                      {bulkRecipients.length}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total Amount</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
                      GH₵ {bulkNormalTotal}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkNormalSubmit}
                  disabled={isMaintenanceMode}
                  style={{
                    padding: '0.55rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: isMaintenanceMode ? 'var(--color-bg-surface-muted)' : theme.buttonBg,
                    color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                    fontWeight: 900,
                    fontSize: 'var(--font-size-sm)',
                    cursor: isMaintenanceMode ? 'not-allowed' : 'pointer',
                    opacity: isMaintenanceMode ? 0.6 : 1,
                    boxShadow: !isMaintenanceMode ? `0 2px 8px ${theme.glowColor}` : 'none',
                  }}
                >
                  {isMaintenanceMode ? 'Platform in Maintenance' : 'Continue to Payment →'}
                </button>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 2B: BULK ORDER (Free Paste)                             */}
          {/* ============================================================ */}
          {orderMode === 'bulk' && bulkSubMode === 'free' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
              {/* Left Column: Textarea */}
              <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Paste Bulk Entries
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Enter one recipient per line in format: <code>Phone, Size</code>
                  </p>
                </div>

                <Textarea
                  rows={8}
                  value={freePasteText}
                  onChange={(e) => setFreePasteText(e.target.value)}
                  placeholder={'0241234567, 5GB\n0551234567, 10GB\n0201234567, 2.5GB'}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                />
              </Card>

              {/* Right Column: Parsed Results */}
              <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Parsed Preview
                    </h3>
                    <span
                      style={{
                        fontSize: 'var(--font-size-3xs)',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: parsedFreeEntries.invalidCount === 0 ? 'var(--color-success-surface)' : 'var(--color-warning-surface)',
                        color: parsedFreeEntries.invalidCount === 0 ? 'var(--color-success)' : 'var(--color-warning)',
                        border: parsedFreeEntries.invalidCount === 0 ? '1px solid var(--color-success-border)' : '1px solid var(--color-warning-border)',
                      }}
                    >
                      {parsedFreeEntries.invalidCount === 0 ? `✓ ${parsedFreeEntries.validCount} valid entries` : `⚠ ${parsedFreeEntries.invalidCount} need attention`}
                    </span>
                  </div>

                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {parsedFreeEntries.entries.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          backgroundColor: 'var(--color-bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-2xs)',
                          border: item.isValid ? '1px solid var(--color-border-subtle)' : '1px solid var(--color-danger-border)',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: item.isValid ? 'var(--color-text-primary)' : 'var(--color-danger)' }}>
                          {item.phone}
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>{item.sizeStr}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-secondary)' }}>Estimated Total</span>
                    <strong style={{ fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                      GH₵ {(parsedFreeEntries.totalPesewas / 100).toFixed(2)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleBulkFreeSubmit}
                    disabled={parsedFreeEntries.invalidCount > 0 || parsedFreeEntries.entries.length === 0 || isMaintenanceMode}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: isMaintenanceMode ? 'var(--color-bg-surface-muted)' : theme.buttonBg,
                      color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                      fontWeight: 900,
                      fontSize: 'var(--font-size-sm)',
                      cursor: parsedFreeEntries.invalidCount > 0 || isMaintenanceMode ? 'not-allowed' : 'pointer',
                      opacity: parsedFreeEntries.invalidCount > 0 || isMaintenanceMode ? 0.6 : 1,
                      boxShadow: !isMaintenanceMode ? `0 2px 8px ${theme.glowColor}` : 'none',
                    }}
                  >
                    {isMaintenanceMode ? 'Platform in Maintenance' : 'Continue to Payment →'}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE 3: EXCEL UPLOAD ORDER                                   */}
          {/* ============================================================ */}
          {orderMode === 'excel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Template Download Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-surface-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Excel Batch Order Templates
                  </div>
                  <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-secondary)' }}>
                    Simple format: <code>Recipient, Volume</code> · Full format: <code>Beneficiary Msisdn, Data (MB)</code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="outline" size="sm" onClick={handleDownloadSimpleTemplate} leftIcon={<Download size={13} />}>
                    Download Simple Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadFullTemplate} leftIcon={<Download size={13} />}>
                    Download Full Template
                  </Button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: 'var(--space-8)',
                  borderRadius: 'var(--radius-2xl)',
                  border: isDragging ? `2px dashed ${theme.brandColor}` : '2px dashed var(--color-border-default)',
                  backgroundColor: isDragging ? theme.accentBg : 'var(--color-bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                {excelLoading ? (
                  <>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: theme.accentBg,
                        border: `1px solid ${theme.borderColor}`,
                        color: theme.brandColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <Loader2 size={24} />
                    </div>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                      Checking your file...
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
                      Validating recipient rows and telecom data volume mappings
                    </p>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: theme.accentBg,
                        border: `1px solid ${theme.borderColor}`,
                        color: theme.brandColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <UploadCloud size={24} />
                    </div>

                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                      {excelFile ? excelFile.name : 'Upload Excel or CSV File'}
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0.75rem 0' }}>
                      {excelFile ? 'Click to choose a different file' : 'Drag and drop your spreadsheet here, or click to browse'}
                    </p>

                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Supported formats: .xlsx · .xls · .csv
                    </span>
                  </>
                )}
              </div>

              {/* Parsed Preview Table & Submission */}
              {excelFile && (
                <Card style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} color="var(--color-success)" />
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        File Ready · 24 Recipients Detected
                      </strong>
                    </div>

                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                      Showing preview of top 5 entries
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {excelParsedRows.map((row, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          backgroundColor: 'var(--color-bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-2xs)',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.phone}</span>
                        <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>{row.data}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                      + 19 more recipients in batch
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Total Batch Estimate</span>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                        GH₵ 680.00
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleExcelSubmit}
                      disabled={isMaintenanceMode}
                      style={{
                        padding: '0.55rem 1.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: isMaintenanceMode ? 'var(--color-bg-surface-muted)' : theme.buttonBg,
                        color: isMaintenanceMode ? 'var(--color-text-muted)' : theme.buttonTextColor,
                        fontWeight: 900,
                        fontSize: 'var(--font-size-sm)',
                        cursor: isMaintenanceMode ? 'not-allowed' : 'pointer',
                        opacity: isMaintenanceMode ? 0.6 : 1,
                        boxShadow: !isMaintenanceMode ? `0 2px 8px ${theme.glowColor}` : 'none',
                      }}
                    >
                      {isMaintenanceMode ? 'Platform in Maintenance' : 'Continue to Payment →'}
                    </button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. Bottom Operational Guarantees Banner */}
      <Card style={{ padding: 'var(--space-6)', backgroundColor: 'var(--color-bg-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-brand-surface)', color: 'var(--color-brand)' }}>
              <Zap size={20} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Instant Automated Delivery
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Orders are provisioned immediately with direct carrier confirmation.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-success-surface)', color: 'var(--color-success)' }}>
              <ShieldCheck size={20} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Guaranteed Non-Expiry
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                All MTN, Telecel, and AirtelTigo bundles never expire until fully used.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-info-surface)', color: 'var(--color-info)' }}>
              <Phone size={20} strokeWidth={2.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Direct Recipient Crediting
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Credit data directly to your own line, family members, or customers.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Progressive Purchase Modal (Handles Single, Bulk & Excel checkout) */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialNetwork={selectedNetwork}
        initialBundleId={modalPayload.bundleId || currentSingleBundle.id}
        initialRecipientPhone={modalPayload.recipientPhone}
        customTitle={modalPayload.title}
        customPackageSummary={modalPayload.packageSummary}
        customRecipientSummary={modalPayload.recipientSummary}
        customAmountDisplay={modalPayload.amountDisplay}
      />
    </div>
  );
};
