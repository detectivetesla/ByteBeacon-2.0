import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar.js';
import { Footer } from '../components/navigation/Footer.js';
import { MaintenanceBanner } from '../components/navigation/MaintenanceBanner.js';
import { usePlatformStatus } from '../context/PlatformStatusContext.js';

export const PublicLayout: React.FC = () => {
  const { isMaintenanceMode, maintenanceMessage } = usePlatformStatus();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-base)' }}>
      <MaintenanceBanner isMaintenanceMode={isMaintenanceMode} message={maintenanceMessage} />
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
