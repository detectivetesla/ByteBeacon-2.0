import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserSummaryDto } from '@bytebeacon/shared';
import { apiClient } from '../api/httpClient.js';
import { catalogApi } from '../api/catalog.api.js';
import { AuthTokens } from '../api/types.js';

interface AuthContextType {
  user: UserSummaryDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: UserSummaryDto, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (user: Partial<UserSummaryDto>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'bytebeacon_auth_user';
const AUTH_TOKENS_KEY = 'bytebeacon_auth_tokens';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSummaryDto | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parsing error
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setUser(null);
    catalogApi.clearCache();
    try {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKENS_KEY);
    } catch {
      // LocalStorage access failsafe
    }
  }, []);

  useEffect(() => {
    // Configure centralized API Client with dynamic token getters and auth failure callback
    apiClient.setConfig({
      getAccessToken: () => {
        try {
          const stored = localStorage.getItem(AUTH_TOKENS_KEY);
          if (stored) return JSON.parse(stored).accessToken || null;
        } catch {}
        return null;
      },
      getRefreshToken: () => {
        try {
          const stored = localStorage.getItem(AUTH_TOKENS_KEY);
          if (stored) return JSON.parse(stored).refreshToken || null;
        } catch {}
        return null;
      },
      onTokensRefreshed: (tokens: AuthTokens) => {
        try {
          localStorage.setItem(AUTH_TOKENS_KEY, JSON.stringify(tokens));
        } catch {}
      },
      onAuthFailure: () => {
        logout();
      },
    });

    // Check initial authentication state
    try {
      const storedUser = localStorage.getItem(AUTH_USER_KEY);
      const storedTokens = localStorage.getItem(AUTH_TOKENS_KEY);
      if (storedUser && storedTokens) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = useCallback((newUser: UserSummaryDto, newTokens: AuthTokens) => {
    setUser(newUser);
    catalogApi.clearCache();
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
      localStorage.setItem(AUTH_TOKENS_KEY, JSON.stringify(newTokens));
    } catch {
      // LocalStorage access failsafe
    }
  }, []);

  const updateUser = useCallback((updatedFields: Partial<UserSummaryDto>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      let hasChanges = false;
      for (const [key, value] of Object.entries(updatedFields)) {
        if ((prevUser as any)[key] !== value) {
          hasChanges = true;
          break;
        }
      }
      if (!hasChanges) {
        return prevUser;
      }
      const updated = { ...prevUser, ...updatedFields };
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: () => {},
      logout: () => {},
      updateUser: () => {},
    };
  }
  return context;
};
