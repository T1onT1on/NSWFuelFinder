export type StationFuelPrice = {
  fuelType: string;
  centsPerLitre: number;
  unit?: string | null;
  description?: string | null;
  lastUpdated?: string | null;
  estimatedCost?: number | null;
};

export type NearbyFuelStation = {
  id: string;
  name: string;
  brand?: string | null;
  brandCanonical?: string | null;
  brandOriginal?: string | null;
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  prices: StationFuelPrice[];
};

export type NearbyStationsResponse = {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm: number;
  count: number;
  availableBrands?: string[];
  stations: NearbyFuelStation[];
};

export type CheapestPriceResponse = {
  fuelType: string;
  centsPerLitre: number;
  unit?: string | null;
  lastUpdated?: string | null;
  station: {
    stationCode: string;
    name?: string | null;
    brand?: string | null;
    brandCanonical?: string | null;
    brandOriginal?: string | null;
    address?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
  };
};

export type FuelPriceTrendPoint = {
  recordedAt: string;
  centsPerLitre: number;
};

export type FuelPriceTrendResponse = {
  fuelType: string;
  points: FuelPriceTrendPoint[];
};
