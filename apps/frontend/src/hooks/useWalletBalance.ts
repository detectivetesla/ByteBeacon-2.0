import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { walletApi } from '../api/wallet.api.js';
import { apiClient } from '../api/httpClient.js';
import { UserSummaryDto } from '@bytebeacon/shared';

export interface UseWalletBalanceResult {
  balancePesewas: number;
  balanceGhs: number;
  availablePesewas: number;
  availableGhs: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Authoritative Wallet Balance Hook
 * Strictly queries real backend wallet/profile data without mock or demo fallbacks.
 */
export const useWalletBalance = (): UseWalletBalanceResult => {
  const { user, updateUser } = useAuth();
  const [balancePesewas, setBalancePesewas] = useState<number>(user?.walletBalancePesewas || 0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize state if user balance in auth context updates
  useEffect(() => {
    if (typeof user?.walletBalancePesewas === 'number') {
      setBalancePesewas(user.walletBalancePesewas);
    }
  }, [user?.walletBalancePesewas]);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Authoritative wallet balance endpoint for ALL roles (customer, agent, admin)
      const data = await walletApi.getBalance();
      if (data && typeof data.balancePesewas === 'number') {
        setBalancePesewas(data.balancePesewas);
        if (user && user.walletBalancePesewas !== data.balancePesewas) {
          updateUser({ walletBalancePesewas: data.balancePesewas });
        }
        return;
      }

      // Profile endpoint fallback
      const profileRes = await apiClient.get<UserSummaryDto>('/auth/me');
      if (profileRes && typeof profileRes.walletBalancePesewas === 'number') {
        setBalancePesewas(profileRes.walletBalancePesewas);
        if (user?.walletBalancePesewas !== profileRes.walletBalancePesewas) {
          updateUser({ walletBalancePesewas: profileRes.walletBalancePesewas });
        }
        return;
      }

      // If user object has a balance, use it as real authoritative data
      if (user && typeof user.walletBalancePesewas === 'number') {
        setBalancePesewas(user.walletBalancePesewas);
      } else {
        setBalancePesewas(0);
      }
    } catch (err: any) {
      // On network failure, fallback strictly to cached authenticated user balance or 0 — NEVER manufacture fake balances
      if (user && typeof user.walletBalancePesewas === 'number') {
        setBalancePesewas(user.walletBalancePesewas);
      } else {
        setBalancePesewas(0);
      }
      setError(err?.message || 'Failed to fetch wallet balance');
    } finally {
      setIsLoading(false);
    }
  }, [user?.walletBalancePesewas, updateUser]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Synchronize across multiple components on deposit/purchase events
  useEffect(() => {
    const handleBalanceEvent = () => {
      fetchBalance();
    };
    window.addEventListener('wallet-balance-updated', handleBalanceEvent);
    return () => {
      window.removeEventListener('wallet-balance-updated', handleBalanceEvent);
    };
  }, [fetchBalance]);

  return {
    balancePesewas,
    balanceGhs: balancePesewas / 100,
    availablePesewas: balancePesewas,
    availableGhs: balancePesewas / 100,
    isLoading,
    error,
    refresh: fetchBalance,
  };
};
