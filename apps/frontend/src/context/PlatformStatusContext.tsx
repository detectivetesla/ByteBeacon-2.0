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
        const nextMaintenance = Boolean(res.isMaintenanceMode);
        const nextStatus = res.platformStatus || (res.isMaintenanceMode ? 'MAINTENANCE' : 'OPERATIONAL');
        const nextEnv = res.environment;
        const nextMessage = res.message;
        const nextTimestamp = res.timestamp;

        setStatusData((prev) => {
          if (
            prev.isMaintenanceMode === nextMaintenance &&
            prev.platformStatus === nextStatus &&
            prev.environment === nextEnv &&
            prev.message === nextMessage
          ) {
            return prev;
          }
          return {
            isMaintenanceMode: nextMaintenance,
            platformStatus: nextStatus,
            environment: nextEnv,
            message: nextMessage,
            timestamp: nextTimestamp,
          };
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

    // Poll status periodically every 10 seconds for timely maintenance enforcement
    const interval = setInterval(fetchPlatformStatus, 10000);

    // Refresh when browser tab gains focus or returns online
    const handleFocus = () => {
      fetchPlatformStatus();
    };

    // Fast reactive listener for 503 maintenance mode responses or admin toggle events
    const handleMaintenanceEvent = (event: Event) => {
      const customEvt = event as CustomEvent;
      setStatusData((prev) => ({
        ...prev,
        isMaintenanceMode: true,
        platformStatus: 'MAINTENANCE',
        message: customEvt.detail?.message || prev.message,
      }));
      fetchPlatformStatus();
    };

    const handleStatusCheckEvent = () => {
      fetchPlatformStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('platform-maintenance-active', handleMaintenanceEvent);
    window.addEventListener('platform-status-check', handleStatusCheckEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('platform-maintenance-active', handleMaintenanceEvent);
      window.removeEventListener('platform-status-check', handleStatusCheckEvent);
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
