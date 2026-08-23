import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell.js';
import { AGENT_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { Store } from 'lucide-react';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { WhatsAppFloat } from '../components/ui/WhatsAppFloat.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
import { NetworkProvider } from '@bytebeacon/shared';

import { useWalletBalance } from '../hooks/useWalletBalance.js';

export const AgentLayout: React.FC = () => {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const { balancePesewas } = useWalletBalance();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  return (
    <>
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />
      <AppShell
        portalTitle="ByteBeacon"
        portalSubtitle="Agent Operations"
        portalLogoIcon={<Store size={18} strokeWidth={2.6} />}
        portalRoleBadge="RESELLER PARTNER"
        portalRoleColor="var(--color-agent)"
        navigationGroups={AGENT_NAVIGATION_GROUPS}
        userRole="agent"
        balancePesewas={balancePesewas}
        onTopUpClick={() => (window.location.href = '/agent/wallet')}
        storeSlug="datahub-express"
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
