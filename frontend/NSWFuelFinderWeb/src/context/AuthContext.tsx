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
  setSession: (tokens: AuthTokenResponse | null) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthTokenResponse | null>;
};

const LOCAL_STORAGE_KEY = "nswff_auth_v2";

const defaultState: AuthState = {
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenId: null,
  refreshTokenExpiresAt: null,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseStoredState = (): AuthState => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return {
      accessToken: parsed.accessToken ?? null,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? null,
      refreshToken: parsed.refreshToken ?? null,
      refreshTokenId: parsed.refreshTokenId ?? null,
      refreshTokenExpiresAt: parsed.refreshTokenExpiresAt ?? null,
    };
  } catch {
    return defaultState;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => parseStoredState());

  const persistState = useCallback((next: AuthState) => {
    setState(next);
    if (
      next.accessToken ||
      next.refreshToken
    ) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const setSession = useCallback(
    (tokens: AuthTokenResponse | null) => {
      if (!tokens) {
        persistState(defaultState);
        return;
      }

      persistState({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshToken: tokens.refreshToken,
        refreshTokenId: tokens.refreshTokenId,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      });
    },
    [persistState]
  );

  const logout = useCallback(async () => {
    if (state.refreshTokenId) {
      try {
        await logoutUser({ refreshTokenId: state.refreshTokenId });
      } catch {
      }
    }
    persistState(defaultState);
  }, [persistState, state.refreshTokenId]);

  const refreshSession = useCallback(async (): Promise<AuthTokenResponse | null> => {
    if (!state.refreshToken || !state.refreshTokenId) {
      return null;
    }

    try {
      const data = await refreshAuthToken({
        refreshToken: state.refreshToken,
        refreshTokenId: state.refreshTokenId,
      });
      setSession(data);
      return data;
    } catch {
      persistState(defaultState);
      return null;
    }
  }, [persistState, setSession, state.refreshToken, state.refreshTokenId]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY) {
        setState(parseStoredState());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      accessToken: state.accessToken,
      accessTokenExpiresAt: state.accessTokenExpiresAt,
      refreshToken: state.refreshToken,
      refreshTokenId: state.refreshTokenId,
      isAuthenticated: Boolean(state.accessToken && state.refreshToken),
      setSession,
      logout,
      refreshSession,
    }),
    [logout, refreshSession, setSession, state.accessToken, state.accessTokenExpiresAt, state.refreshToken, state.refreshTokenId]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
