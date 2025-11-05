import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./useApiClient";
import type {
  CheapestPriceResponse,
  FuelPriceTrendResponse,
  NearbyStationsResponse,
} from "../types";

const appendSearchParams = (params: URLSearchParams, key: string, value: string | number | undefined | null) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  params.append(key, String(value));
};

export const useCheapestPrices = (fuelTypes?: string[], brands?: string[]) => {
  const client = useApiClient();
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
      if (queryString) {
        url = `${url}?${queryString}`;
      }
      const { data } = await client.get<CheapestPriceResponse[]>(url);
      return data;
    },
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

export const useNearbyStations = (filter: NearbyFilter | null) => {
  const client = useApiClient();
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
    enabled: Boolean(filter),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: filter ? 60 * 1000 : false,
  });
};

export const useStationTrends = (
  stationCode: string | undefined,
  fuelType?: string,
  periodDays: number = 7
) => {
  const client = useApiClient();
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
    enabled: Boolean(stationCode),
  });
};
