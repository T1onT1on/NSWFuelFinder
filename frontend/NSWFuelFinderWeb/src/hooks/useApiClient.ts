import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { createApiClient } from "../api/client";

export const useApiClient = () => {
  const { accessToken } = useAuth();
  return useMemo(() => createApiClient({ token: accessToken ?? undefined }), [accessToken]);
};
