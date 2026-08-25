import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { beneficiaryApi } from '../api/beneficiary.api.js';
import { useAuth } from './AuthContext.js';

export interface PendingApprovalsContextType {
  pendingCount: number;
  isLoading: boolean;
  refreshPendingCount: () => Promise<void>;
}

const PendingApprovalsContext = createContext<PendingApprovalsContextType>({
  pendingCount: 0,
  isLoading: false,
  refreshPendingCount: async () => {},
});

export const PendingApprovalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await beneficiaryApi.getPendingCount();
      if (res && typeof res.pendingCount === 'number') {
        setPendingCount(res.pendingCount);
      }
    } catch {
      // Keep existing count on transient network issue
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [user]);

  // Periodic real-time poll and visibility/focus/custom events listener
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    fetchCount();

    // 8-second real-time polling interval
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchCount();
      }
    }, 8000);

    const handleFocus = () => {
      fetchCount();
    };

    const handleCustomUpdate = () => {
      fetchCount();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pending-approvals-updated', handleCustomUpdate);
      window.addEventListener('order-created', handleCustomUpdate);
      window.addEventListener('beneficiary-updated', handleCustomUpdate);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pending-approvals-updated', handleCustomUpdate);
        window.removeEventListener('order-created', handleCustomUpdate);
        window.removeEventListener('beneficiary-updated', handleCustomUpdate);
      }
    };
  }, [user, fetchCount]);

  return (
    <PendingApprovalsContext.Provider
      value={{
        pendingCount,
        isLoading,
        refreshPendingCount: fetchCount,
      }}
    >
      {children}
    </PendingApprovalsContext.Provider>
  );
};

export const usePendingApprovals = (): PendingApprovalsContextType => {
  return useContext(PendingApprovalsContext);
};
