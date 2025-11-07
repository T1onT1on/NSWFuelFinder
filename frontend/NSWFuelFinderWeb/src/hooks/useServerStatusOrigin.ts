// src/hooks/useServerStatus.ts
import { useEffect, useMemo, useRef, useState } from "react";

export type ServerStatus =
  | "unknown"
  | "waking"          // /healthz ok, /readyz not ready or timeout
  | "healthy"         // /readyz 200
  | "degraded"        // /healthz 200, /readyz 503
  | "backend_error"   // 5xx other than 503
  | "unreachable";    // network/CORS/timeout

const HEALTHZ = "/healthz";
const READYZ = "/readyz";

function timeoutFetch(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 2000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...rest, signal: controller.signal, cache: "no-store" })
    .finally(() => clearTimeout(id));
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("unknown");
  const [lastHttpCode, setLastHttpCode] = useState<number | null>(null);
  const pollingRef = useRef<boolean>(false);

  const setSafely = (s: ServerStatus, code?: number | null) => {
    setStatus(s);
    setLastHttpCode(code ?? null);
  };

  const checkOnce = async (): Promise<ServerStatus> => {
    // Step 1: liveness
    try {
      const h = await timeoutFetch(HEALTHZ, { timeoutMs: 2000 });
      setLastHttpCode(h.status);
      if (!h.ok) {
        // 5xx on /healthz → backend_error
        setSafely("backend_error", h.status);
        return "backend_error";
      }
    } catch {
      setSafely("unreachable", null);
      return "unreachable";
    }

    // Step 2: readiness
    try {
      const r = await timeoutFetch(READYZ, { timeoutMs: 1200 });
      setLastHttpCode(r.status);
      if (r.ok) {
        setSafely("healthy", r.status);
        return "healthy";
      }
      if (r.status === 503) {
        setSafely("degraded", 503);
        return "degraded";
      }
      setSafely("backend_error", r.status);
      return "backend_error";
    } catch {
      // healthz ok but readyz timed out → treat as waking
      setSafely("waking", null);
      return "waking";
    }
  };

  const startProbe = async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const first = await checkOnce();
    if (first === "healthy" || first === "backend_error" || first === "unreachable") {
      pollingRef.current = false;
      return;
    }

    // Exponential backoff for waking/degraded
    const delays = [1000, 2000, 4000, 8000, 12000];
    for (const d of delays) {
      await new Promise((res) => setTimeout(res, d));
      const cur = await checkOnce();
      if (cur === "healthy") break;
    }
    pollingRef.current = false;
  };

  useEffect(() => {
    // auto probe on mount
    startProbe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    setStatus("unknown");
    startProbe();
  };

  const isServerReady = useMemo(() => status === "healthy", [status]);

  return {
    status,
    isServerReady,
    lastHttpCode,
    retry,
  };
}
