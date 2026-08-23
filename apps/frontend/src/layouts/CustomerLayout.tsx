import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell.js';
import { CUSTOMER_NAVIGATION_GROUPS } from '../components/navigation/navigation.config.js';
import { Zap } from 'lucide-react';
import { PurchaseModal } from '../components/commerce/PurchaseModal.js';
import { WhatsAppFloat } from '../components/ui/WhatsAppFloat.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
import { NetworkProvider } from '@bytebeacon/shared';

import { useWalletBalance } from '../hooks/useWalletBalance.js';

export const CustomerLayout: React.FC = () => {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const { balancePesewas } = useWalletBalance();
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  return (
    <>
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />
      <AppShell
        portalTitle="ByteBeacon"
        portalSubtitle="Customer Portal"
        portalLogoIcon={<Zap size={18} strokeWidth={2.8} />}
        portalRoleBadge="CUSTOMER"
        portalRoleColor="var(--color-brand)"
        navigationGroups={CUSTOMER_NAVIGATION_GROUPS}
        userRole="customer"
        balancePesewas={balancePesewas}
        onTopUpClick={() => (window.location.href = '/app/wallet')}
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
