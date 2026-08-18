import React, { useState } from 'react';
import { NetworkProvider } from '@bytebeacon/shared';
import { Card } from '../../components/ui/Card/Card.js';
import { Button } from '../../components/ui/Button/Button.js';
import { NetworkBadge } from '../../components/ui/Badge/Badge.js';
import { SearchInput } from '../../components/ui/index.js';
import { TactileIcon } from '../../components/ui/TactileIcon/TactileIcon.js';
import { PurchaseModal } from '../../components/commerce/PurchaseModal.js';
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

const ALL_BUNDLES: BundleOffer[] = [
  // MTN Ghana Bundles
  { id: 'mtn-1', network: NetworkProvider.MTN, volume: '1 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 6.00', agentPrice: 'GH₵ 3.80', margin: 'GH₵ 2.20' },
  { id: 'mtn-2', network: NetworkProvider.MTN, volume: '2 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 12.00', agentPrice: 'GH₵ 7.60', margin: 'GH₵ 4.40' },
  { id: 'mtn-3', network: NetworkProvider.MTN, volume: '3 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 18.00', agentPrice: 'GH₵ 11.40', margin: 'GH₵ 6.60' },
  { id: 'mtn-5', network: NetworkProvider.MTN, volume: '5 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 28.00', agentPrice: 'GH₵ 19.00', margin: 'GH₵ 9.00', popular: true },
  { id: 'mtn-10', network: NetworkProvider.MTN, volume: '10 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 55.00', agentPrice: 'GH₵ 38.00', margin: 'GH₵ 17.00', popular: true },
  { id: 'mtn-20', network: NetworkProvider.MTN, volume: '20 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 100.00', agentPrice: 'GH₵ 72.00', margin: 'GH₵ 28.00' },
  { id: 'mtn-50', network: NetworkProvider.MTN, volume: '50 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 240.00', agentPrice: 'GH₵ 175.00', margin: 'GH₵ 65.00' },

  // Telecel Ghana Bundles
  { id: 'tel-2', network: NetworkProvider.TELECEL, volume: '2 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 10.00', agentPrice: 'GH₵ 6.80', margin: 'GH₵ 3.20' },
  { id: 'tel-5', network: NetworkProvider.TELECEL, volume: '5 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 24.00', agentPrice: 'GH₵ 16.50', margin: 'GH₵ 7.50', popular: true },
  { id: 'tel-10', network: NetworkProvider.TELECEL, volume: '10 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 45.00', agentPrice: 'GH₵ 32.00', margin: 'GH₵ 13.00' },
  { id: 'tel-25', network: NetworkProvider.TELECEL, volume: '25 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 110.00', agentPrice: 'GH₵ 78.00', margin: 'GH₵ 32.00' },

  // AirtelTigo Bundles
  { id: 'at-2', network: NetworkProvider.AIRTELTIGO, volume: '2 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 8.00', agentPrice: 'GH₵ 5.50', margin: 'GH₵ 2.50' },
  { id: 'at-5', network: NetworkProvider.AIRTELTIGO, volume: '5 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 20.00', agentPrice: 'GH₵ 14.00', margin: 'GH₵ 6.00' },
  { id: 'at-10', network: NetworkProvider.AIRTELTIGO, volume: '10 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 38.00', agentPrice: 'GH₵ 27.00', margin: 'GH₵ 11.00', popular: true },
  { id: 'at-20', network: NetworkProvider.AIRTELTIGO, volume: '20 GB', validity: 'Non-Expiry', retailPrice: 'GH₵ 75.00', agentPrice: 'GH₵ 52.00', margin: 'GH₵ 23.00' },
];

export const DataBundlesPage: React.FC = () => {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent' || user?.role === 'admin' || user?.role === 'super_admin';

  const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [modalNetwork, setModalNetwork] = useState<NetworkProvider>(NetworkProvider.MTN);

  const filtered = ALL_BUNDLES.filter((b) => {
    const matchesNetwork = selectedNetwork === 'ALL' || b.network === selectedNetwork;
    const matchesSearch = b.volume.toLowerCase().includes(searchQuery.toLowerCase()) || b.network.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNetwork && matchesSearch;
  });

  const handlePurchase = (network: NetworkProvider) => {
    setModalNetwork(network);
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
                onClick={() => handlePurchase(bundle.network)}
              >
                Purchase {bundle.volume}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Modal */}
      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialNetwork={modalNetwork}
      />
    </div>
  );
};
