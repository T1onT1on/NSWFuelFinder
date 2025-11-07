// src/hooks/useServerStatus.ts
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "./useApiClient";

export type ServerStatus = "unknown" | "waking" | "degraded" | "healthy" | "unreachable" | "backend_error";

export type UseServerStatusOptions = {
  healthPath?: string;           // 默认为 /healthz
  pollWhileUnreadyMs?: number;   // 默认 3000
  pollWhileHealthyMs?: number;   // 默认 60000
};

// 进程级记忆：如果发现需要回退，就记住，不要每次都多打一跳
let _preferApiHealthz = false;

export function useServerStatus(opts?: UseServerStatusOptions) {
  const client = useApiClient();
  const qc = useQueryClient();
  const basePreferred = opts?.healthPath ?? "/healthz";
  const preferredPath = _preferApiHealthz ? "/api/healthz" : basePreferred;

  const unreadyMs = opts?.pollWhileUnreadyMs ?? 3000;
  const healthyMs = opts?.pollWhileHealthyMs ?? 60000;

  const { data, error, isError, status: rqStatus, refetch } = useQuery({
    queryKey: ["server-status", preferredPath],
    queryFn: async () => {
      try {
        const res = await client.get(preferredPath);
        const code = res.status;
        const body = res.data ?? {};

        const hinted = String(body?.status ?? "").toLowerCase();
        let mapped: ServerStatus =
          code >= 200 && code < 300 ? "healthy" : code === 503 ? "waking" : "backend_error";
        if (hinted === "ok" || hinted === "healthy") mapped = "healthy";
        else if (hinted === "waking" || hinted === "starting" || hinted === "warmup") mapped = "waking";
        else if (hinted === "degraded") mapped = "degraded";

        return { status: mapped, lastHttpCode: code, body };
      } catch (e: any) {
        const code: number | undefined = e?.response?.status;

        // 如果是 404，且当前不是 /api/healthz，自动回退一次到 /api/healthz
        if (code === 404 && preferredPath !== "/api/healthz") {
          _preferApiHealthz = true;
          // 触发一次立即重试（使用新的 queryKey）
          qc.invalidateQueries({ queryKey: ["server-status", preferredPath] });
          throw new Error("healthz 404, switching to /api/healthz");
        }

        if (typeof code === "number") {
          const mapped: ServerStatus = code === 503 ? "waking" : code >= 500 ? "backend_error" : "unreachable";
          return { status: mapped, lastHttpCode: code, body: e?.response?.data };
        }
        return { status: "unreachable" as ServerStatus, lastHttpCode: undefined, body: undefined };
      }
    },
    refetchInterval: (q) => {
      const st: ServerStatus | undefined = (q.state.data as any)?.status;
      return st === "healthy" ? healthyMs : unreadyMs;
    },
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  const serverStatus: ServerStatus = data?.status ?? "unknown";
  const lastHttpCode: number | undefined = data?.lastHttpCode;
  const isServerReady = serverStatus === "healthy" || serverStatus === "degraded";

  const retry = () => {
    qc.invalidateQueries({ queryKey: ["server-status", preferredPath] });
    return refetch();
  };

  return useMemo(
    () => ({ status: serverStatus, isServerReady, lastHttpCode, lastError: isError ? (error as Error) : undefined, retry, rqStatus }),
    [serverStatus, isServerReady, lastHttpCode, isError, error, retry, rqStatus]
  );
}
