// src/api/setupAuthInterceptors.ts
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

/**
 * Attach auth interceptors to a given axios instance.
 * - Adds Authorization header if accessToken exists
 * - On 401, tries refresh() once and retries the original request
 *
 * You must pass callbacks from your AuthContext at runtime:
 *   getAccessToken: () => string | null
 *   refresh: () => Promise<boolean>   // true if refreshed successfully
 *   onHardLogout: () => Promise<void> // when refresh fails
 */
export function attachAuthInterceptors(
  api: AxiosInstance,
  {
    getAccessToken,
    refresh,
    onHardLogout,
  }: {
    getAccessToken: () => string | null;
    refresh: () => Promise<boolean>;
    onHardLogout: () => Promise<void>;
  }
) {
  // Avoid duplicate attaching
  if ((api as any).__nswff_interceptors_installed) return;
  (api as any).__nswff_interceptors_installed = true;

  // Request: add Authorization
  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response: on 401 -> refresh -> retry once
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error?.response?.status;
      const original: AxiosRequestConfig & { __isRetry?: boolean } = error?.config ?? {};
      if (status === 401 && original && !original.__isRetry) {
        original.__isRetry = true;
        try {
          const ok = await refresh();
          if (ok) {
            const t = getAccessToken();
            original.headers = original.headers ?? {};
            if (t) (original.headers as any).Authorization = `Bearer ${t}`;
            return api.request(original);
          }
        } catch {
          // fallthrough to hard logout
        }
        await onHardLogout();
      }
      return Promise.reject(error);
    }
  );
}
