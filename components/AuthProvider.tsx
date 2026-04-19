"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth-user";

const AUTH_SYNC_KEY = "mh_auth_sync";

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (nextUser: AuthUser | null) => void;
  clearUser: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncAuthAcrossTabs() {
  try {
    localStorage.setItem(AUTH_SYNC_KEY, Date.now().toString());
  } catch {
    // Ignore storage sync issues in restricted browser contexts.
  }
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUserState] = useState<AuthUser | null>(initialUser);

  const commitUser = useCallback((nextUser: AuthUser | null, shouldBroadcast = true) => {
    setUserState(nextUser);

    if (shouldBroadcast) {
      syncAuthAcrossTabs();
    }
  }, []);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    commitUser(nextUser);
  }, [commitUser]);

  const clearUser = useCallback(() => {
    setUser(null);
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        commitUser(null, false);
        return null;
      }

      const data = await response.json();
      const nextUser = data?.success ? (data.user as AuthUser) : null;
      commitUser(nextUser, false);
      return nextUser;
    } catch {
      return null;
    }
  }, [commitUser]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SYNC_KEY) {
        void refreshUser();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, clearUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
