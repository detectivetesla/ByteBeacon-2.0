import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from './AppShell.js';
import { AGENT_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { Store } from 'lucide-react';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { WhatsAppFloat } from '../components/ui/WhatsAppFloat.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
import { NetworkProvider } from '@bytebeacon/shared';
import { useWalletBalance } from '../hooks/useWalletBalance.js';
import { storesApi } from '../api/stores.api.js';

export const AgentLayout: React.FC = () => {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const { balancePesewas } = useWalletBalance();
  const { isMaintenanceMode, maintenanceMessage, isOrderProcessingPaused, orderProcessingMessage } = usePlatformStatus();
  const [storeSlug, setStoreSlug] = useState<string | undefined>(undefined);
  const [isStoreApproved, setIsStoreApproved] = useState<boolean>(false);
  const navigate = useNavigate();

  const fetchStoreStatus = useCallback(() => {
    storesApi
      .getStore()
      .then((store) => {
        if (store && store.id) {
          if (store.slug) {
            setStoreSlug(store.slug);
          }
          // Only show My Store in the header after the store setup has been APPROVED and ACTIVE
          setIsStoreApproved(store.approvalStatus === 'APPROVED' && store.storeStatus === 'ACTIVE');
        } else {
          setIsStoreApproved(false);
          setStoreSlug(undefined);
        }
      })
      .catch(() => {
        setIsStoreApproved(false);
        setStoreSlug(undefined);
      });
  }, []);

  useEffect(() => {
    fetchStoreStatus();

    const handleStoreUpdated = () => {
      fetchStoreStatus();
    };

    window.addEventListener('bytebeacon:store-updated', handleStoreUpdated);
    return () => {
      window.removeEventListener('bytebeacon:store-updated', handleStoreUpdated);
    };
  }, [fetchStoreStatus]);

  return (
    <>
      <MaintenanceBanner
        isMaintenanceMode={isMaintenanceMode}
        message={maintenanceMessage}
        isOrderProcessingPaused={isOrderProcessingPaused}
        orderProcessingMessage={orderProcessingMessage}
      />
      <AppShell
        portalTitle="ByteBeacon"
        portalSubtitle="Agent Operations"
        portalLogoIcon={<Store size={18} strokeWidth={2.6} />}
        portalRoleBadge="RESELLER PARTNER"
        portalRoleColor="var(--color-agent)"
        navigationGroups={AGENT_NAVIGATION_GROUPS}
        userRole="agent"
        balancePesewas={balancePesewas}
        onTopUpClick={() => navigate('/agent/wallet')}
        storeSlug={storeSlug}
        isStoreApproved={isStoreApproved}
      >
        <Outlet />
      </AppShell>

      <PurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialNetwork={NetworkProvider.MTN}
      />

      <WhatsAppFloat />
    </>
  );
};

