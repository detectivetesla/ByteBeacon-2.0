import React, { useState, useEffect } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
import { catalogApi } from '../../api/catalog.api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Layers, Zap } from 'lucide-react';

interface BundleOffer {
  id: string;
  network: NetworkProvider;
  volume: string;
  validity: string;
  retailPrice: string;
  agentPrice: string;
  margin: string;
  popular?: boolean;
}

export const DataBundlesPage: React.FC = () => {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent' || user?.role === 'admin' || user?.role === 'super_admin';
  const channel = isAgent ? 'AGENT' : 'CUSTOMER';

  const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [modalNetwork, setModalNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);
  const [modalBundleId, setModalBundleId] = useState<string | undefined>(undefined);
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const targetNet = selectedNetwork !== 'ALL' ? (selectedNetwork as NetworkProvider) : undefined;

    catalogApi
      .getBundles(targetNet, channel)
      .then((items) => {
        if (!isMounted || !Array.isArray(items)) return;
        const mapped: BundleOffer[] = items.map((p) => {
          const retailGhs = (p.basePricePesewas / 100).toFixed(2);
          const agentPesewas = p.agentPricePesewas || p.basePricePesewas;
          const agentGhs = (agentPesewas / 100).toFixed(2);
          const marginPesewas = Math.max(0, p.basePricePesewas - agentPesewas);
          const marginGhs = (marginPesewas / 100).toFixed(2);

          return {
            id: p.id,
            network: p.network as NetworkProvider,
            volume: `${(p.dataAmountMb / 1024).toFixed(p.dataAmountMb % 1024 === 0 ? 0 : 1)} GB`,
            validity: p.validityDesc || `${p.validityDays} Days`,
            retailPrice: `GH₵ ${retailGhs}`,
            agentPrice: `GH₵ ${agentGhs}`,
            margin: `GH₵ ${marginGhs}`,
            popular: Boolean(p.popular),
          };
        });
        setBundles(mapped);
      })
      .catch(() => {
        if (isMounted) setBundles([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNetwork, channel]);

  const filtered = bundles.filter((b) => {
    const matchesNetwork = selectedNetwork === 'ALL' || b.network === selectedNetwork;
    const matchesSearch =
      b.volume.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.network.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNetwork && matchesSearch;
  });

  const handlePurchase = (network: NetworkProvider, bundleId?: string) => {
    setModalNetwork(network);
    setModalBundleId(bundleId);
    setPurchaseModalOpen(true);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TactileIcon icon={Layers} color="analytics" size="sm" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Data Bundles
            </h1>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            {isAgent ? 'Reseller wholesale pricing and profit margins across telecom carriers.' : 'Select a non-expiry bundle package for instant SIM crediting.'}
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => handlePurchase(NetworkProvider.MTN)} leftIcon={<Zap size={16} />}>
          Buy Data Now
        </Button>
      </div>

      {/* Network Filters & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Network Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: 'All Networks' },
            { key: NetworkProvider.MTN, label: 'MTN Ghana' },
            { key: NetworkProvider.TELECEL, label: 'Telecel' },
            { key: NetworkProvider.AIRTELTIGO, label: 'AirtelTigo' },
          ].map((tab) => {
            const isSelected = selectedNetwork === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedNetwork(tab.key)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: isSelected ? 800 : 600,
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                  backgroundColor: isSelected ? 'var(--color-brand-surface)' : 'var(--color-bg-surface)',
                  color: isSelected ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: '220px' }}>
          <SearchInput
            placeholder="Search capacity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bundles Grid */}
      {loading && bundles.length === 0 ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Loading authoritative data bundles...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No packages found for this query.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {filtered.map((bundle) => {
            return (
              <Card
                key={bundle.id}
                elevated
                style={{
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                  border: bundle.popular ? '1px solid var(--color-brand-border)' : '1px solid var(--color-border-default)',
                  position: 'relative',
                }}
              >
                {bundle.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: 'var(--font-size-3xs)',
                      fontWeight: 800,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-brand-surface)',
                      color: 'var(--color-brand)',
                      border: '1px solid var(--color-brand-border)',
                    }}
                  >
                    POPULAR
                  </span>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
                    <NetworkBadge network={bundle.network} size="sm" />
                    <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      {bundle.validity}
                    </span>
                  </div>

                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'var(--font-data)' }}>
                    {bundle.volume}
                  </div>

                  {/* Price Display */}
                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {isAgent ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Agent Cost</span>
                          <strong style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-data)', color: 'var(--color-brand)' }}>
                            {bundle.agentPrice}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>Retail Value</span>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}>
                            {bundle.retailPrice}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.25rem', marginTop: '0.1rem' }}>
                          <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 700, color: 'var(--color-agent)' }}>Reseller Profit</span>
                          <strong style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-data)', color: 'var(--color-agent)' }}>
                            +{bundle.margin}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Price</span>
                        <strong style={{ fontSize: 'var(--font-size-lg)', fontFamily: 'var(--font-data)', color: 'var(--color-brand)' }}>
                          {bundle.retailPrice}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => handlePurchase(bundle.network, bundle.id)}
                >
                  Purchase {bundle.volume}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false);
          setModalBundleId(undefined);
        }}
        initialNetwork={modalNetwork}
        initialBundleId={modalBundleId}
        channel={channel}
      />
    </div>
  );
};
