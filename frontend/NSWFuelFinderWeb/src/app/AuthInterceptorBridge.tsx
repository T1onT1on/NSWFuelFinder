// src/app/AuthInterceptorBridge.tsx
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { attachAuthInterceptors } from "../api/setupAuthInterceptors";

export default function AuthInterceptorBridge() {
  const { accessToken, refreshSession, logout } = useAuth();
  const accessTokenRef = useRef<string | null>(accessToken);
  const refreshRef = useRef(refreshSession);
  const logoutRef = useRef(logout);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshRef.current = refreshSession;
  }, [refreshSession]);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    attachAuthInterceptors(apiClient, {
      getAccessToken: () => accessTokenRef.current,
      refresh: async () => {
        const res = await refreshRef.current();
        return !!res?.accessToken;
      },
      onHardLogout: async () => {
        await logoutRef.current();
      },
    });
    // Attach only once; refs keep callbacks fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
