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
import { ResponsiveTable } from '../../components/ui/responsive/index.js';

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
    <div className="store-page-container">
      {/* Header */}
      <div className="store-header-row">
        <div>
          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Catalogue & Margins
          </span>
          <h1 style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--color-text-primary)', margin: '0.125rem 0 0 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Products & Data Bundles
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
            Set custom profit markups, retail pricing, and control which bundles appear on your public store.
          </p>
        </div>

        <div className="store-header-actions">
          {modifiedProducts.size > 0 && (
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-warning)', fontWeight: 700, alignSelf: 'center' }}>
              {modifiedProducts.size} unsaved change{modifiedProducts.size > 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveAll}
            isLoading={isSaving}
            leftIcon={<Save size={14} />}
            style={{ backgroundColor: '#10B981', color: '#000000', fontWeight: 800, minHeight: '44px', flex: '1 1 auto' }}
          >
            Publish Changes
          </Button>
        </div>
      </div>

      {/* Margin Presets & Bulk Controls */}
      <Card style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Quick Markup:
            </span>
            {[1, 2, 3, 5, 10].map((ghs) => (
              <Button
                key={ghs}
                variant="outline"
                size="xs"
                onClick={() => applyMarkupPreset(ghs)}
                style={{ fontWeight: 700, minHeight: '36px', padding: '0 0.5rem' }}
              >
                +GH₵ {ghs}.00
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => bulkSetVisibility(true)}
              leftIcon={<Eye size={12} />}
              style={{ minHeight: '36px' }}
            >
              Show All
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => bulkSetVisibility(false)}
              leftIcon={<EyeOff size={12} />}
              style={{ minHeight: '36px' }}
            >
              Hide All
            </Button>
          </div>
        </div>
      </Card>

      {/* Network Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '0.25rem',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
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
                padding: '0.5rem 0.85rem',
                minHeight: '40px',
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                backgroundColor: isSelected ? 'var(--color-bg-surface-elevated)' : 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
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
        {isLoading && products.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading store products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No products configured for this network filter.
          </div>
        ) : (
          <ResponsiveTable<StoreProductItem>
            columns={[
              {
                header: 'Network',
                accessor: 'network',
                render: (p) => (
                  p.network === 'MTN' ? (
                    <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#FFCC00', color: '#000000', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>MTN</span>
                  ) : p.network === 'TELECEL' ? (
                    <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#E11D48', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>TELECEL</span>
                  ) : (
                    <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>AT</span>
                  )
                ),
                priority: 'always',
              },
              {
                header: 'Bundle Name',
                accessor: 'bundleName',
                render: (p) => (
                  <strong style={{ color: 'var(--color-text-primary)' }}>{p.bundleName}</strong>
                ),
                priority: 'always',
              },
              {
                header: 'Wholesale Cost',
                accessor: (p) => `GH₵ ${p.baseCostGhs.toFixed(2)}`,
                render: (p) => (
                  <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-text-secondary)' }}>
                    GH₵ {p.baseCostGhs.toFixed(2)}
                  </span>
                ),
                priority: 'secondary',
              },
              {
                header: 'Your Markup',
                accessor: (p) => String(p.markupGhs),
                render: (p) => (
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
                ),
                priority: 'always',
              },
              {
                header: 'Retail Price',
                accessor: (p) => `GH₵ ${(p.baseCostGhs + p.markupGhs).toFixed(2)}`,
                render: (p) => (
                  <span style={{ fontFamily: 'var(--font-data)', fontWeight: 900, color: '#10B981', fontSize: 'var(--font-size-sm)' }}>
                    GH₵ {(p.baseCostGhs + p.markupGhs).toFixed(2)}
                  </span>
                ),
                priority: 'always',
              },
              {
                header: 'Available',
                accessor: (p) => (p.isAvailable ? 'Yes' : 'No'),
                render: (p) => (
                  <Checkbox
                    checked={p.isAvailable}
                    onChange={() => toggleAvailability(p.id)}
                  />
                ),
                priority: 'always',
              },
              {
                header: 'Store Visible',
                accessor: (p) => (p.isVisible ? 'Visible' : 'Hidden'),
                render: (p) => (
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
                ),
                priority: 'always',
              },
            ]}
            data={filteredProducts}
            keyExtractor={(p) => p.id}
            enableCardView={true}
            cardTitle={(p) => p.bundleName}
            cardSubtitle={(p) => `Cost: GH₵ ${p.baseCostGhs.toFixed(2)} • Retail: GH₵ ${(p.baseCostGhs + p.markupGhs).toFixed(2)}`}
            cardBadge={(p) => (
              p.network === 'MTN' ? (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#FFCC00', color: '#000000', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>MTN</span>
              ) : p.network === 'TELECEL' ? (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#E11D48', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>TELECEL</span>
              ) : (
                <span style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-xs)', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 900, fontSize: 'var(--font-size-3xs)' }}>AT</span>
              )
            )}
            cardActions={(p) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Your Profit Markup:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#10B981' }}>+GH₵</span>
                    <Input
                      type="number"
                      value={p.markupGhs}
                      onChange={(e) => handleMarkupChange(p.id, parseFloat(e.target.value) || 0)}
                      step="0.5"
                      min="0"
                      style={{ width: '80px', fontWeight: 800, fontFamily: 'var(--font-data)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      minHeight: '44px',
                    }}
                  >
                    <Checkbox
                      checked={p.isAvailable}
                      onChange={() => toggleAvailability(p.id)}
                    />
                    <span>Available</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => toggleVisibility(p.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      minHeight: '44px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: p.isVisible ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-subtle)',
                      color: p.isVisible ? '#3B82F6' : 'var(--color-text-muted)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {p.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                    <span>{p.isVisible ? 'Visible' : 'Hidden'}</span>
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
};
