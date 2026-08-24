import React from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card } from '../ui/Card/Card.js';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { catalogApi } from '../../api/catalog.api.js';

export interface BundleItem {
  id: string;
  sku: string;
  network: NetworkProvider;
  dataAmountMb: number;
  dataDisplay: string;
  pricePesewas: number;
  priceDisplay: string;
  validityDays: number;
  validityDisplay: string;
  popular?: boolean;
}



const NETWORK_THEMES: Record<
  NetworkProvider,
  {
    brandColor: string;
    buttonBg: string;
    buttonTextColor: string;
    accentBg: string;
    borderColor: string;
    hoverBorder: string;
    glowColor: string;
    shimmerColor: string;
  }
> = {
  [NetworkProvider.MTN]: {
    brandColor: '#FFCC00',
    buttonBg: '#FFCC00',
    buttonTextColor: '#000000',
    accentBg: 'rgba(255, 204, 0, 0.08)',
    borderColor: 'rgba(255, 204, 0, 0.35)',
    hoverBorder: '#FFCC00',
    glowColor: 'rgba(255, 204, 0, 0.25)',
    shimmerColor: 'rgba(255, 204, 0, 0.15)',
  },
  [NetworkProvider.TELECEL]: {
    brandColor: '#E7192D',
    buttonBg: '#E7192D',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(231, 25, 45, 0.08)',
    borderColor: 'rgba(231, 25, 45, 0.35)',
    hoverBorder: '#E7192D',
    glowColor: 'rgba(231, 25, 45, 0.25)',
    shimmerColor: 'rgba(231, 25, 45, 0.15)',
  },
  [NetworkProvider.AIRTELTIGO]: {
    brandColor: '#0066B2',
    buttonBg: '#0066B2',
    buttonTextColor: '#FFFFFF',
    accentBg: 'rgba(0, 102, 178, 0.08)',
    borderColor: 'rgba(0, 102, 178, 0.35)',
    hoverBorder: '#0066B2',
    glowColor: 'rgba(0, 102, 178, 0.25)',
    shimmerColor: 'rgba(0, 102, 178, 0.15)',
  },
};

export interface BundleSelectorProps {
  network: NetworkProvider;
  bundles?: BundleItem[];
  channel?: 'CUSTOMER' | 'AGENT' | 'STORE' | 'API';
  selectedBundleId?: string;
  onSelectBundle?: (bundle: BundleItem) => void;
  onSelect?: (bundle: BundleItem) => void;
  searchQuery?: string;
  viewMode?: 'grid' | 'normal';
  isLoading?: boolean;
}

export const BundleSelector: React.FC<BundleSelectorProps> = ({
  network,
  bundles,
  channel = 'CUSTOMER',
  selectedBundleId,
  onSelectBundle,
  onSelect,
  searchQuery = '',
  viewMode = 'grid',
  isLoading: externalLoading = false,
}) => {
  const handleSelect = onSelectBundle || onSelect || (() => {});
  const [liveBundles, setLiveBundles] = React.useState<BundleItem[]>([]);
  const [internalLoading, setInternalLoading] = React.useState(false);

  React.useEffect(() => {
    if (bundles && bundles.length > 0) return;

    let isMounted = true;
    setInternalLoading(true);
    catalogApi
      .getBundles(network, channel)
      .then((items) => {
        const productList = Array.isArray(items) ? items : [];
        if (isMounted && productList.length > 0) {
          const isAgent = channel === 'AGENT';
          const mapped: BundleItem[] = productList.map((p) => {
            const price = isAgent && p.agentPricePesewas ? p.agentPricePesewas : p.basePricePesewas;
            return {
              id: p.id,
              sku: p.sku,
              network: p.network as NetworkProvider,
              dataAmountMb: p.dataAmountMb,
              dataDisplay: `${(p.dataAmountMb / 1024).toFixed(p.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`,
              pricePesewas: price,
              priceDisplay: `GH₵ ${(price / 100).toFixed(2)}`,
              validityDays: p.validityDays,
              validityDisplay: p.validityDesc || `${p.validityDays} Days`,
              popular: Boolean(p.popular),
            };
          });
          setLiveBundles(mapped);
        }
      })
      .catch(() => {
        if (isMounted) setLiveBundles([]);
      })
      .finally(() => {
        if (isMounted) setInternalLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [network, channel, bundles]);

  const allBundles =
    bundles && bundles.length > 0
      ? bundles
      : liveBundles;

  const theme = NETWORK_THEMES[network] || NETWORK_THEMES[NetworkProvider.MTN];
  const isLoading = externalLoading || (internalLoading && allBundles.length === 0);

  const filteredBundles = allBundles.filter((b) => {
    return (
      !searchQuery ||
      b.dataDisplay.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.priceDisplay.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (isLoading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(220px, 1fr))' : '1fr',
          gap: 'var(--space-4)',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              height: viewMode === 'grid' ? '160px' : '72px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: theme.shimmerColor,
            }}
          />
        ))}
      </div>
    );
  }

  if (filteredBundles.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed var(--color-border-default)',
        }}
      >
        <Zap size={28} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-2)' }} />
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          No packages available
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          There are currently no data bundles available for this network query.
        </div>
      </div>
    );
  }

  // Normal List View
  if (viewMode === 'normal') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filteredBundles.map((bundle) => {
          const isSelected = selectedBundleId === bundle.id;

          return (
            <div
              key={bundle.id}
              onClick={() => handleSelect(bundle)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-4) var(--space-5)',
                backgroundColor: isSelected ? theme.accentBg : 'var(--color-bg-surface)',
                border: isSelected ? `2px solid ${theme.brandColor}` : '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.hoverBorder;
                  e.currentTarget.style.backgroundColor = theme.accentBg;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                  {bundle.dataDisplay}
                </span>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  {bundle.validityDisplay}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: 'var(--font-size-3xs)',
                    fontWeight: 800,
                    color: 'var(--color-success)',
                  }}
                >
                  ● Available
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, fontFamily: 'var(--font-data)', color: 'var(--color-text-primary)' }}>
                  {bundle.priceDisplay}
                </span>
                <button
                  type="button"
                  style={{
                    padding: '0.4rem 0.95rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: theme.buttonBg,
                    color: theme.buttonTextColor,
                    fontWeight: 800,
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: `0 2px 8px ${theme.glowColor}`,
                    transition: 'transform 100ms ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <span>Buy Data</span>
                  <ArrowRight size={13} strokeWidth={2.6} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Grid View (Default)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {filteredBundles.map((bundle) => {
        const isSelected = selectedBundleId === bundle.id;

        return (
          <Card
            key={bundle.id}
            onClick={() => handleSelect(bundle)}
            style={{
              cursor: 'pointer',
              border: isSelected ? `2px solid ${theme.brandColor}` : '1px solid var(--color-border-default)',
              backgroundColor: isSelected ? theme.accentBg : 'linear-gradient(145deg, var(--color-bg-surface-elevated), var(--color-bg-surface))',
              boxShadow: isSelected ? `0 8px 24px ${theme.glowColor}` : 'var(--shadow-tactile-sm)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              minHeight: '165px',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = theme.hoverBorder;
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                e.currentTarget.style.boxShadow = `0 10px 24px ${theme.glowColor}`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = 'var(--color-border-default)';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = 'var(--shadow-tactile-sm)';
              }
            }}
          >
            {bundle.popular && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: 'var(--font-size-3xs)',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  backgroundColor: theme.accentBg,
                  color: theme.brandColor,
                  borderRadius: 'var(--radius-full)',
                  border: `1px solid ${theme.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <Sparkles size={10} />
                <span>POPULAR</span>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {bundle.validityDisplay}
                </span>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-success)', fontWeight: 800 }}>
                  ● Available
                </span>
              </div>

              <div
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 900,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-data)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  margin: '0.25rem 0',
                }}
              >
                {bundle.dataDisplay}
              </div>

              <div
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 900,
                  fontFamily: 'var(--font-data)',
                  color: 'var(--color-text-primary)',
                  marginTop: '0.25rem',
                }}
              >
                {bundle.priceDisplay}
              </div>
            </div>

            {/* Network Themed Tactile [Buy Data] Button */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonTextColor,
                  fontWeight: 800,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: `0 2px 8px ${theme.glowColor}`,
                  transition: 'transform 100ms ease',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span>Buy Data</span>
                <ArrowRight size={13} strokeWidth={2.6} />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
