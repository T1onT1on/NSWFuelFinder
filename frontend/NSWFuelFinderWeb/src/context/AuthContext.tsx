// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthTokenResponse } from "../api/auth";
import { logoutUser, refreshAuthToken } from "../api/auth";

type AuthState = {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  refreshTokenId: string | null;
  refreshTokenExpiresAt: string | null;
};

type AuthContextValue = {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  refreshTokenId: string | null;
  isAuthenticated: boolean;
  setSession: (tokens: AuthTokenResponse | null) => void; // default to localStorage
  setSessionWithRemember: (tokens: AuthTokenResponse | null, remember: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthTokenResponse | null>;
};

const KEY = "nswff_auth_v2";

const defaultState: AuthState = {
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenId: null,
  refreshTokenExpiresAt: null,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readAny(): AuthState {
  const ls = localStorage.getItem(KEY);
  const ss = sessionStorage.getItem(KEY);
  const raw = ls ?? ss;
  if (!raw) return defaultState;
  try {
    const p = JSON.parse(raw) as Partial<AuthState>;
    return {
      accessToken: p.accessToken ?? null,
      accessTokenExpiresAt: p.accessTokenExpiresAt ?? null,
      refreshToken: p.refreshToken ?? null,
      refreshTokenId: p.refreshTokenId ?? null,
      refreshTokenExpiresAt: p.refreshTokenExpiresAt ?? null,
    };
  } catch {
    return defaultState;
  }
}

function clearAllStores() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

function writeTo(remember: boolean, next: AuthState) {
  clearAllStores();
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(next));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => readAny());

  const persistState = useCallback((next: AuthState, remember: boolean) => {
    setState(next);
    if (next.accessToken || next.refreshToken) {
      writeTo(remember, next);
    } else {
      clearAllStores();
    }
  }, []);

  const setSessionWithRemember = useCallback(
    (tokens: AuthTokenResponse | null, remember: boolean) => {
      if (!tokens) {
        persistState(defaultState, remember);
        return;
      }
      const next: AuthState = {
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenId: tokens.refreshTokenId,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      };
      persistState(next, remember);
    },
    [persistState]
  );

  // keep old API (defaults to remember=true)
  const setSession = useCallback(
    (tokens: AuthTokenResponse | null) => setSessionWithRemember(tokens, true),
    [setSessionWithRemember]
  );

  const logout = useCallback(async () => {
    if (state.refreshTokenId) {
      try {
        await logoutUser({ refreshTokenId: state.refreshTokenId });
      } catch {}
    }
    persistState(defaultState, true);
  }, [persistState, state.refreshTokenId]);

  const refreshSession = useCallback(async (): Promise<AuthTokenResponse | null> => {
    if (!state.refreshToken || !state.refreshTokenId) return null;
    try {
      const data = await refreshAuthToken({
        refreshToken: state.refreshToken,
        refreshTokenId: state.refreshTokenId,
      });
      // preserve where it was stored: detect current store
      const wasLocal = !!localStorage.getItem(KEY);
      setSessionWithRemember(data, wasLocal);
      return data;
    } catch {
      persistState(defaultState, true);
      return null;
    }
  }, [persistState, setSessionWithRemember, state.refreshToken, state.refreshTokenId]);

  // cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) setState(readAny());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const ctx = useMemo<AuthContextValue>(
    () => ({
      accessToken: state.accessToken,
      accessTokenExpiresAt: state.accessTokenExpiresAt,
      refreshToken: state.refreshToken,
      refreshTokenId: state.refreshTokenId,
      isAuthenticated: Boolean(state.accessToken && state.refreshToken),
      setSession,
      setSessionWithRemember,
      logout,
      refreshSession,
    }),
    [logout, refreshSession, setSession, setSessionWithRemember, state]
  );

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
