import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./useApiClient";
import type {
  CheapestPriceResponse,
  FuelPriceTrendResponse,
  NearbyStationsResponse,
} from "../types";

type UseQueryExtras = {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnReconnect?: boolean | "always";
  refetchOnWindowFocus?: boolean | "always";
  refetchInterval?: number | false;
  retry?: boolean | number;
};


const appendSearchParams = (
  params: URLSearchParams,
  key: string,
  value: string | number | undefined | null
) => {
  if (value === undefined || value === null || value === "") return;
  params.append(key, String(value));
};

/**
 * Cheapest prices across NSW (optionally filtered by fuel types & brands)
 * Now supports options.enabled to defer until backend is ready.
 */
export const useCheapestPrices = (
  fuelTypes?: string[],
  brands?: string[],
  options?: UseQueryExtras
) => {
  const client = useApiClient();
  const enabled = options?.enabled ?? true;

  return useQuery<CheapestPriceResponse[]>({
    queryKey: [
      "cheapest",
      fuelTypes?.slice().sort().join(","),
      brands?.slice().sort().join(","),
    ],
    queryFn: async () => {
      let url = "/api/prices/cheapest";
      const params = new URLSearchParams();
      if (fuelTypes && fuelTypes.length > 0) {
        fuelTypes.forEach((fuel) => params.append("fuelTypes", fuel));
      }
      if (brands && brands.length > 0) {
        brands.forEach((brand) => params.append("brands", brand));
      }
      const queryString = params.toString();
      if (queryString) url = `${url}?${queryString}`;
      const { data } = await client.get<CheapestPriceResponse[]>(url);
      return data;
    },
    enabled,
    retry: options?.retry ?? 0,
    staleTime: options?.staleTime ?? 60_000,
    gcTime: options?.gcTime ?? 5 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount ?? "always",
    refetchOnReconnect: options?.refetchOnReconnect ?? "always",
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? "always",
    refetchInterval: options?.refetchInterval ?? false,
  });
};

export type NearbyFilter = {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  suburb?: string;
  fuelTypes?: string[];
  brands?: string[];
  volumeLitres?: number;
  sortBy?: string;
  sortOrder?: string;
};

/**
 * Nearby stations query (requires a filter).
 * Now supports options.enabled; effective enabled = Boolean(filter) && options.enabled.
 */
export const useNearbyStations = (
  filter: NearbyFilter | null,
  options?: UseQueryExtras
) => {
  const client = useApiClient();
  const enabled = (options?.enabled ?? true) && Boolean(filter);

  return useQuery<NearbyStationsResponse>({
    queryKey: ["nearby", filter],
    queryFn: async () => {
      if (!filter) {
        throw new Error("Filter is required");
      }

      const params = new URLSearchParams();
      appendSearchParams(params, "latitude", filter.latitude);
      appendSearchParams(params, "longitude", filter.longitude);
      appendSearchParams(params, "radiusKm", filter.radiusKm ?? 5);
      appendSearchParams(params, "suburb", filter.suburb);
      if (filter.fuelTypes?.length) {
        filter.fuelTypes.forEach((fuel) => params.append("fuelTypes", fuel));
      }
      if (filter.brands?.length) {
        filter.brands.forEach((brand) => params.append("brands", brand));
      }
      appendSearchParams(params, "volumeLitres", filter.volumeLitres);
      appendSearchParams(params, "sortBy", filter.sortBy);
      appendSearchParams(params, "sortOrder", filter.sortOrder);

      const url = `/api/stations/nearby?${params.toString()}`;
      const { data } = await client.get<NearbyStationsResponse>(url);
      return data;
    },
    enabled,
    retry: options?.retry ?? 0,
    staleTime: options?.staleTime ?? 0,
    gcTime: options?.gcTime ?? 5 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount ?? "always",
    refetchOnReconnect: options?.refetchOnReconnect ?? "always",
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? "always",
    // Only poll when actually enabled and filter exists
    refetchInterval: enabled ? (options?.refetchInterval ?? 60 * 1000) : false,
  });
};

/**
 * Station price trends.
 * Optionally accepts options to gate by server readiness.
 */
export const useStationTrends = (
  stationCode: string | undefined,
  fuelType?: string,
  periodDays: number = 7,
  options?: UseQueryExtras
) => {
  const client = useApiClient();
  const enabled = (options?.enabled ?? true) && Boolean(stationCode);

  return useQuery<FuelPriceTrendResponse[]>({
    queryKey: ["trend", stationCode, fuelType, periodDays],
    queryFn: async () => {
      if (!stationCode) throw new Error("stationCode required");
      const params = new URLSearchParams();
      appendSearchParams(params, "periodDays", periodDays);
      appendSearchParams(params, "fuelType", fuelType);
      const url = `/api/stations/${stationCode}/trends?${params.toString()}`;
      const { data } = await client.get<FuelPriceTrendResponse[]>(url);
      return data;
    },
    enabled,
    retry: options?.retry ?? 0,
    staleTime: options?.staleTime ?? 60_000,
    gcTime: options?.gcTime ?? 5 * 60 * 1000,
  });
};
