import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar.js';
import { Footer } from '../components/navigation/Footer.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';
import { isStorefrontHostname } from '../config/storefront.config.js';

export const PublicLayout: React.FC = () => {
  const { isMaintenanceMode, maintenanceMessage, isOrderProcessingPaused, orderProcessingMessage } = usePlatformStatus();
  const isStorefront = isStorefrontHostname();

  // On apisolutions.store (or any storefront subdomain), NEVER render ByteBeacon's SaaS Navbar and Footer!
  if (isStorefront) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MaintenanceBanner
          isMaintenanceMode={isMaintenanceMode}
          message={maintenanceMessage}
          isOrderProcessingPaused={isOrderProcessingPaused}
          orderProcessingMessage={orderProcessingMessage}
        />
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    );
  }

  // On main platform (bytebeacon.online), render standard ByteBeacon SaaS Navbar & Footer
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-base)' }}>
      <MaintenanceBanner
        isMaintenanceMode={isMaintenanceMode}
        message={maintenanceMessage}
        isOrderProcessingPaused={isOrderProcessingPaused}
        orderProcessingMessage={orderProcessingMessage}
      />
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
