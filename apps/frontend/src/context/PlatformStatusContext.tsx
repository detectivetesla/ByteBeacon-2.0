import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/httpClient.js';

export interface PlatformStatusData {
  isMaintenanceMode: boolean;
  platformStatus: 'OPERATIONAL' | 'MAINTENANCE';
  environment?: string;
  message?: string;
  timestamp?: string;
}

export interface PlatformStatusContextType {
  isMaintenanceMode: boolean;
  platformStatus: 'OPERATIONAL' | 'MAINTENANCE';
  maintenanceMessage?: string;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PlatformStatusContext = createContext<PlatformStatusContextType | undefined>(undefined);

export const PlatformStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [statusData, setStatusData] = useState<PlatformStatusData>({
    isMaintenanceMode: false,
    platformStatus: 'OPERATIONAL',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPlatformStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<PlatformStatusData>('/platform/status', {
        skipAuth: true,
        timeoutMs: 10000,
      });
      if (res) {
        setStatusData({
          isMaintenanceMode: Boolean(res.isMaintenanceMode),
          platformStatus: res.platformStatus || (res.isMaintenanceMode ? 'MAINTENANCE' : 'OPERATIONAL'),
          environment: res.environment,
          message: res.message,
          timestamp: res.timestamp,
        });
      }
    } catch {
      // On network error or fallback, retain existing or default state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatformStatus();

    // Poll status periodically every 30 seconds
    const interval = setInterval(fetchPlatformStatus, 30000);

    // Refresh when browser tab gains focus
    const handleFocus = () => {
      fetchPlatformStatus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPlatformStatus]);

  return (
    <PlatformStatusContext.Provider
      value={{
        isMaintenanceMode: statusData.isMaintenanceMode,
        platformStatus: statusData.platformStatus,
        maintenanceMessage: statusData.message,
        isLoading,
        refetch: fetchPlatformStatus,
      }}
    >
      {children}
    </PlatformStatusContext.Provider>
  );
};

export const usePlatformStatus = (): PlatformStatusContextType => {
  const context = useContext(PlatformStatusContext);
  if (!context) {
    return {
      isMaintenanceMode: false,
      platformStatus: 'OPERATIONAL',
      isLoading: false,
      refetch: async () => {},
    };
  }
  return context;
};
