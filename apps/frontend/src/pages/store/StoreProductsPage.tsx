import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { Input, Checkbox } from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.js';
import { storesApi } from '../../api/stores.api.js';
import {
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

interface StoreProductItem {
  id: string;
  network: 'MTN' | 'TELECEL' | 'AIRTELTIGO';
  bundleName: string;
  dataSize: string;
  baseCostGhs: number;
  markupGhs: number;
  isAvailable: boolean;
  isVisible: boolean;
}

export const StoreProductsPage: React.FC = () => {
  const { toastSuccess, toastError } = useToast();
  const [products, setProducts] = useState<StoreProductItem[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<'ALL' | 'MTN' | 'TELECEL' | 'AIRTELTIGO'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await storesApi.getStoreProducts('my-store');
      if (items && items.length > 0) {
        const mapped: StoreProductItem[] = items.map((p) => ({
          id: p.id,
          network: (p.network || 'MTN').toUpperCase() as any,
          bundleName: p.name,
          dataSize: p.dataAmountMb >= 1024 ? `${(p.dataAmountMb / 1024).toFixed(1)} GB` : `${p.dataAmountMb} MB`,
          baseCostGhs: p.basePricePesewas / 100,
          markupGhs: p.markupPesewas / 100,
          isAvailable: p.isAvailable,
          isVisible: p.isVisible,
        }));
        setProducts(mapped);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const [modifiedProducts, setModifiedProducts] = useState<Set<string>>(new Set());

  const markModified = (id: string) => {
    setModifiedProducts((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleMarkupChange = (id: string, newMarkup: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, markupGhs: Math.max(0, newMarkup) } : p,
      ),
    );
    markModified(id);
  };

  const toggleAvailability = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isAvailable: !p.isAvailable } : p)),
    );
    markModified(id);
  };

  const toggleVisibility = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isVisible: !p.isVisible } : p)),
    );
    markModified(id);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const modifiedProds = products.filter(p => modifiedProducts.has(p.id));
      if (modifiedProds.length === 0) {
        toastSuccess('No Changes', 'All bundle markups are already up to date.');
        setIsSaving(false);
        return;
      }

      const items = modifiedProds.map((prod) => ({
        id: prod.id,
        markupPesewas: Math.round(prod.markupGhs * 100),
        isAvailable: prod.isAvailable,
        isVisible: prod.isVisible,
      }));

      await storesApi.bulkUpdateStoreProducts(items);
      setModifiedProducts(new Set());
      toastSuccess('Catalog Published', `Updated ${items.length} bundle pricing & availability settings.`);
    } catch (err: any) {
      toastError('Save Failed', err.message || 'Unable to update store products.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyMarkupPreset = (markupGhs: number) => {
    const targetIds = new Set(filteredProducts.map((p) => p.id));
    setProducts((prev) =>
      prev.map((p) => (targetIds.has(p.id) ? { ...p, markupGhs } : p)),
    );
    setModifiedProducts((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });
    toastSuccess('Margin Preset Applied', `Set markup to +GH₵ ${markupGhs.toFixed(2)} on ${targetIds.size} bundles. Click "Publish Changes" to save.`);
  };

  const bulkSetVisibility = (visible: boolean) => {
    const targetIds = new Set(filteredProducts.map((p) => p.id));
    setProducts((prev) =>
      prev.map((p) => (targetIds.has(p.id) ? { ...p, isVisible: visible } : p)),
    );
    setModifiedProducts((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });
    toastSuccess('Visibility Updated', `Set visibility to ${visible ? 'VISIBLE' : 'HIDDEN'} on ${targetIds.size} bundles.`);
  };

  const filteredProducts = products.filter(
    (p) => selectedNetwork === 'ALL' || p.network === selectedNetwork,
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Catalogue & Margins
          </span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em' }}>
            Products & Data Bundles
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Set custom profit markups, retail pricing, and control which bundles appear on your public store.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {modifiedProducts.size > 0 && (
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-warning)', fontWeight: 700 }}>
              {modifiedProducts.size} unsaved change{modifiedProducts.size > 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveAll}
            isLoading={isSaving}
            leftIcon={<Save size={14} />}
            style={{ backgroundColor: '#10B981', color: '#000000', fontWeight: 800 }}
          >
            Publish Changes
          </Button>
        </div>
      </div>

      {/* Margin Presets & Bulk Controls */}
      <Card style={{ padding: '0.85rem 1.25rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Quick Markup Presets:
            </span>
            {[1, 2, 3, 5, 10].map((ghs) => (
              <Button
                key={ghs}
                variant="outline"
                size="xs"
                onClick={() => applyMarkupPreset(ghs)}
                style={{ fontWeight: 700 }}
              >
                +GH₵ {ghs}.00
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => bulkSetVisibility(true)}
              leftIcon={<Eye size={12} />}
            >
              Show All
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => bulkSetVisibility(false)}
              leftIcon={<EyeOff size={12} />}
            >
              Hide All
            </Button>
          </div>
        </div>
      </Card>

      {/* Network Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: 'All Networks', count: products.length },
          { id: 'MTN', label: 'MTN Bundles', color: '#FFCC00', count: products.filter((p) => p.network === 'MTN').length },
          { id: 'TELECEL', label: 'Telecel Bundles', color: '#E11D48', count: products.filter((p) => p.network === 'TELECEL').length },
          { id: 'AIRTELTIGO', label: 'AirtelTigo Bundles', color: '#2563EB', count: products.filter((p) => p.network === 'AIRTELTIGO').length },
        ].map((tab) => {
          const isSelected = selectedNetwork === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedNetwork(tab.id as any)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                backgroundColor: isSelected ? 'var(--color-bg-surface-elevated)' : 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {tab.color && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tab.color }} />
              )}
              <span>{tab.label}</span>
              <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* Products Grid / Table */}
      <Card style={{ padding: '0', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Network</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Bundle Name</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Wholesale Cost</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Your Markup</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Retail Price</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Available</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: 'var(--font-size-3xs)' }}>Store Visible</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading store products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No products configured for this network filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const retailPrice = p.baseCostGhs + p.markupGhs;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {p.network === 'MTN' ? (
                          <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#FFCC00', color: '#000000', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>MTN</span>
                        ) : p.network === 'TELECEL' ? (
                          <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#E11D48', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>TELECEL</span>
                        ) : (
                          <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>AT</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {p.bundleName}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', color: 'var(--color-text-secondary)' }}>
                        GH₵ {p.baseCostGhs.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>+GH₵</span>
                          <Input
                            type="number"
                            value={p.markupGhs}
                            onChange={(e) => handleMarkupChange(p.id, parseFloat(e.target.value) || 0)}
                            step="0.5"
                            min="0"
                            style={{ width: '65px', fontWeight: 800, fontFamily: 'var(--font-data)' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-data)', fontWeight: 900, color: '#10B981', fontSize: 'var(--font-size-sm)' }}>
                        GH₵ {retailPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Checkbox
                          checked={p.isAvailable}
                          onChange={() => toggleAvailability(p.id)}
                        />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(p.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: p.isVisible ? '#3B82F6' : 'var(--color-text-muted)',
                            padding: '4px',
                          }}
                          title={p.isVisible ? 'Visible in store' : 'Hidden in store'}
                        >
                          {p.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
