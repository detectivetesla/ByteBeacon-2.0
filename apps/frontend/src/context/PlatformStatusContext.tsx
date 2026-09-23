import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/httpClient.js';

export interface PlatformStatusData {
  isMaintenanceMode: boolean;
  platformStatus: 'OPERATIONAL' | 'MAINTENANCE';
  environment?: string;
  message?: string;
  timestamp?: string;
  isOrderProcessingPaused?: boolean;
  isTotalOrderLockdown?: boolean;
  orderPauseMode?: 'TOTAL_LOCKDOWN' | 'OPERATIONAL_FREEZE' | 'NONE';
  orderProcessingMessage?: string;
}

export interface PlatformStatusContextType {
  isMaintenanceMode: boolean;
  platformStatus: 'OPERATIONAL' | 'MAINTENANCE';
  maintenanceMessage?: string;
  isOrderProcessingPaused: boolean;
  isTotalOrderLockdown: boolean;
  orderPauseMode: 'TOTAL_LOCKDOWN' | 'OPERATIONAL_FREEZE' | 'NONE';
  orderProcessingMessage?: string;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PlatformStatusContext = createContext<PlatformStatusContextType | undefined>(undefined);

export const PlatformStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [statusData, setStatusData] = useState<PlatformStatusData>({
    isMaintenanceMode: false,
    platformStatus: 'OPERATIONAL',
    isOrderProcessingPaused: false,
    isTotalOrderLockdown: false,
    orderPauseMode: 'NONE',
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
        const nextOrderPaused = Boolean(res.isOrderProcessingPaused);
        const nextTotalLockdown = Boolean(res.isTotalOrderLockdown);
        const nextPauseMode = res.orderPauseMode || (nextTotalLockdown ? 'TOTAL_LOCKDOWN' : (nextOrderPaused ? 'OPERATIONAL_FREEZE' : 'NONE'));
        const nextOrderMessage = res.orderProcessingMessage;
        const nextTimestamp = res.timestamp || new Date().toISOString();

        setStatusData((prev) => {
          if (
            prev.isMaintenanceMode === nextMaintenance &&
            prev.platformStatus === nextStatus &&
            prev.environment === nextEnv &&
            prev.message === nextMessage &&
            prev.isOrderProcessingPaused === nextOrderPaused &&
            prev.isTotalOrderLockdown === nextTotalLockdown &&
            prev.orderPauseMode === nextPauseMode &&
            prev.orderProcessingMessage === nextOrderMessage
          ) {
            return prev;
          }
          return {
            isMaintenanceMode: nextMaintenance,
            platformStatus: nextStatus,
            environment: nextEnv,
            message: nextMessage,
            timestamp: nextTimestamp,
            isOrderProcessingPaused: nextOrderPaused,
            isTotalOrderLockdown: nextTotalLockdown,
            orderPauseMode: nextPauseMode,
            orderProcessingMessage: nextOrderMessage,
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

    // Poll status periodically every 60 seconds for maintenance & order pause enforcement without socket starvation
    const interval = setInterval(fetchPlatformStatus, 60000);

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

    const handleOrderPauseEvent = (event: Event) => {
      const customEvt = event as CustomEvent;
      setStatusData((prev) => ({
        ...prev,
        isOrderProcessingPaused: true,
        orderProcessingMessage: customEvt.detail?.message || prev.orderProcessingMessage,
      }));
      fetchPlatformStatus();
    };

    const handleStatusCheckEvent = () => {
      fetchPlatformStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    window.addEventListener('platform-maintenance-active', handleMaintenanceEvent);
    window.addEventListener('order-processing-pause-active', handleOrderPauseEvent);
    window.addEventListener('platform-status-check', handleStatusCheckEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      window.removeEventListener('platform-maintenance-active', handleMaintenanceEvent);
      window.removeEventListener('order-processing-pause-active', handleOrderPauseEvent);
      window.removeEventListener('platform-status-check', handleStatusCheckEvent);
    };
  }, [fetchPlatformStatus]);

  return (
    <PlatformStatusContext.Provider
      value={{
        isMaintenanceMode: statusData.isMaintenanceMode,
        platformStatus: statusData.platformStatus,
        maintenanceMessage: statusData.message,
        isOrderProcessingPaused: Boolean(statusData.isOrderProcessingPaused),
        isTotalOrderLockdown: Boolean(statusData.isTotalOrderLockdown),
        orderPauseMode: statusData.orderPauseMode || 'NONE',
        orderProcessingMessage: statusData.orderProcessingMessage,
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
      isOrderProcessingPaused: false,
      isTotalOrderLockdown: false,
      orderPauseMode: 'NONE',
      isLoading: false,
      refetch: async () => {},
    };
  }
  return context;
};
