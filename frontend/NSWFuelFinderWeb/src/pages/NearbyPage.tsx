// src/pages/NearbyPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stack,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { fuelDisplayOrder } from "../utils/fuelColors";
import StationsDataGrid from "../components/tables/StationsDataGrid";
import SearchFiltersCard from "../components/filters/SearchFiltersCard";
import { useNearbyStations, type NearbyFilter } from "../hooks/queries";
import type { NearbyFuelStation } from "../types";

/** Page-level search mode */
type SearchMode = "location" | "suburb" | null;

/** Form shape we keep in local state */
type FormValues = {
  latitude?: number;
  longitude?: number;
  suburb?: string;
  radiusKm?: number;
  fuelTypes?: string[];
  brands?: string[]; // brand names
  volumeLitres?: number;
  sortBy?: "distance" | "price";
  sortOrder?: "asc" | "desc";
};

/** Persisted state saved in module scope to keep UX across navigation */
type PersistedState = {
  mode: Exclude<SearchMode, null>;
  formValues: FormValues;
  searchParams: NearbyFilter | null;
};

// ---------- constants ----------
const defaultRadiusKm = 5;
const fuelTypeOptions = fuelDisplayOrder.map((value) => ({ label: value, value }));

// Persist between mounts within the same JS runtime
let persistedState: PersistedState | null = null;

// ---------- helpers ----------
const buildDefaultFormValues = (): FormValues => ({
  latitude: undefined,
  longitude: undefined,
  suburb: undefined,
  radiusKm: defaultRadiusKm,
  fuelTypes: [],
  brands: [],
  volumeLitres: undefined,
  sortBy: "distance",
  sortOrder: "asc",
});

const volumeEquals = (a?: number, b?: number) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.0001;
};

export const NearbyPage: React.FC = () => {
  // ---------- persisted bootstrapping ----------
  const initialPersisted = useRef(persistedState);
  const initialMode = initialPersisted.current?.mode ?? null;
  const initialForm = initialPersisted.current?.formValues ?? buildDefaultFormValues();
  const initialVolume = initialForm.volumeLitres;

  // ---------- local UI states ----------
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [formVals, setFormVals] = useState<FormValues>(initialForm);
  const [searchParams, setSearchParams] = useState<NearbyFilter | null>(
    initialPersisted.current?.searchParams ?? null
  );

  const [geolocating, setGeolocating] = useState(false);
  const geolocationSupported =
    typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  const [/*costCalcExpanded*/ /* kept for API parity */, setCostCalcExpanded] =
    useState<boolean>(Boolean(initialVolume));
  const [volumeInput, setVolumeInput] = useState<number | undefined>(initialVolume);
  const [appliedVolume, setAppliedVolume] = useState<number | undefined>(initialVolume);

  const [hasFilterChanges, setHasFilterChanges] = useState<boolean>(
    !initialPersisted.current
  );
  const [hasPendingVolumeChange, setHasPendingVolumeChange] =
    useState<boolean>(false);

  // ---------- data ----------
  const { data, isLoading, isError } = useNearbyStations(searchParams);
  const stations: NearbyFuelStation[] = useMemo(
    () => data?.stations ?? [],
    [data]
  );

  // Build brand options (prefer API; fallback to result set)
  const availableBrands = useMemo(
    () => data?.availableBrands ?? [],
    [data?.availableBrands]
  );
  const brandOptions = useMemo(() => {
    const normalized = (availableBrands ?? [])
      .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      .map((b) => b.trim());
    if (normalized.length) {
      return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
    }
    const fallback = Array.from(
      stations.reduce((set, s) => {
        if (s.brand) set.add(s.brand.trim());
        return set;
      }, new Set<string>())
    ).filter((b) => b.length > 0);
    return fallback.sort((a, b) => a.localeCompare(b));
  }, [availableBrands, stations]);

  // ---------- effects ----------
  useEffect(() => {
    // align pending state for volume at mount
    setHasPendingVolumeChange(!volumeEquals(volumeInput, appliedVolume));
    // keep advanced card open state aligned (not strictly necessary)
    setCostCalcExpanded(Boolean(initialVolume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- handlers ----------
  const patchForm = (patch: Partial<FormValues>) => {
    setFormVals((prev) => ({ ...prev, ...patch }));
    setHasFilterChanges(true);
  };

  const handleModeSelect = (target: Exclude<SearchMode, null>) => {
    if (mode === target) return;
    setMode(target);
    setSearchParams(null);
    persistedState = null;

    const next = buildDefaultFormValues();
    setFormVals(next);
    setAppliedVolume(undefined);
    setVolumeInput(undefined);
    setCostCalcExpanded(false);
    setHasFilterChanges(true);
    setHasPendingVolumeChange(false);
  };

  const handleLocate = () => {
    if (!geolocationSupported) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(4));
        const longitude = Number(position.coords.longitude.toFixed(4));
        patchForm({ latitude, longitude });
        setGeolocating(false);
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        setGeolocating(false);
      }
    );
  };

  const performSearch = (): boolean => {
    if (!mode) {
      console.warn("Select a search mode first.");
      return false;
    }

    const radius = Math.min(Math.max(formVals.radiusKm ?? defaultRadiusKm, 1), 50);
    const trimmedSuburb = formVals.suburb?.trim() || undefined;
    const sortByValue = formVals.sortBy ?? "distance";
    const sortOrderValue = formVals.sortOrder ?? "asc";
    const normalizedBrands =
      (formVals.brands ?? [])
        .map((b) => (typeof b === "string" ? b.trim() : ""))
        .filter((b): b is string => b.length > 0) ?? [];
    const volumeFromState =
      appliedVolume && appliedVolume > 0 ? appliedVolume : undefined;

    let filter: NearbyFilter | null = null;

    if (mode === "location") {
      if (formVals.latitude == null || formVals.longitude == null) {
        console.warn("Latitude and longitude are required for location search.");
        return false;
      }
      filter = {
        latitude: formVals.latitude,
        longitude: formVals.longitude,
        radiusKm: radius,
        suburb: trimmedSuburb,
        fuelTypes: formVals.fuelTypes,
        brands: normalizedBrands,
        volumeLitres: volumeFromState,
        sortBy: sortByValue,
        sortOrder: sortOrderValue,
      };
    } else {
      if (!trimmedSuburb) {
        console.warn("Please enter a suburb to search.");
        return false;
      }
      filter = {
        suburb: trimmedSuburb,
        radiusKm: radius,
        fuelTypes: formVals.fuelTypes,
        brands: normalizedBrands,
        volumeLitres: volumeFromState,
        sortBy: sortByValue,
        sortOrder: sortOrderValue,
      };
    }

    // persist in form
    setFormVals((prev) => ({
      ...prev,
      latitude: filter.latitude,
      longitude: filter.longitude,
      suburb: filter.suburb,
      radiusKm: filter.radiusKm,
      fuelTypes: filter.fuelTypes ?? [],
      brands: normalizedBrands,
      volumeLitres: volumeFromState,
      sortBy: sortByValue,
      sortOrder: sortOrderValue,
    }));

    setSearchParams(filter);
    persistedState = {
      mode: mode,
      formValues: {
        latitude: filter.latitude,
        longitude: filter.longitude,
        suburb: filter.suburb,
        radiusKm: filter.radiusKm,
        fuelTypes: filter.fuelTypes ?? [],
        brands: normalizedBrands,
        volumeLitres: volumeFromState,
        sortBy: sortByValue,
        sortOrder: sortOrderValue,
      },
      searchParams: filter,
    };

    setHasFilterChanges(false);
    setHasPendingVolumeChange(!volumeEquals(volumeInput, volumeFromState));
    return true;
  };

  const handleSearchButtonClick = () => {
    if (!hasFilterChanges) {
      // still allow search
      console.info("No changes to apply; searching with current filters.");
    }
    performSearch();
  };

  const syncPersistedVolume = (
    volume: number | undefined,
    nextFilter?: NearbyFilter | null
  ) => {
    if (!persistedState) return;
    const nextFormValues = { ...persistedState.formValues, volumeLitres: volume };
    const nextSearchParams =
      nextFilter !== undefined
        ? nextFilter
        : persistedState.searchParams
        ? { ...persistedState.searchParams, volumeLitres: volume }
        : null;
    persistedState = {
      mode: persistedState.mode,
      formValues: nextFormValues,
      searchParams: nextSearchParams,
    };
  };

  const performApplyVolume = (): boolean => {
    if (volumeInput == null || Number.isNaN(volumeInput) || volumeInput <= 0) {
      console.warn("Enter a volume in litres greater than zero.");
      return false;
    }
    const normalized = Number(volumeInput);
    setAppliedVolume(normalized);
    setFormVals((prev) => ({ ...prev, volumeLitres: normalized }));

    let hadActiveSearch = false;
    setSearchParams((prev) => {
      if (!prev) {
        syncPersistedVolume(normalized);
        return prev;
      }
      hadActiveSearch = true;
      const updated = { ...prev, volumeLitres: normalized };
      syncPersistedVolume(normalized, updated);
      return updated;
    });
    setHasFilterChanges(!hadActiveSearch);
    setHasPendingVolumeChange(false);
    return true;
  };

  const handleApplyVolumeClick = () => {
    if (!hasPendingVolumeChange) {
      console.info("Adjust volume before applying again.");
      return;
    }
    performApplyVolume();
  };

  const handleClearVolume = () => {
    setAppliedVolume(undefined);
    setVolumeInput(undefined);
    setCostCalcExpanded(false);
    setFormVals((prev) => ({ ...prev, volumeLitres: undefined }));

    let hadActiveSearch = false;
    setSearchParams((prev) => {
      if (!prev) {
        syncPersistedVolume(undefined);
        return prev;
      }
      hadActiveSearch = true;
      const updated: NearbyFilter = { ...prev, volumeLitres: undefined };
      syncPersistedVolume(undefined, updated);
      return updated;
    });
    setHasFilterChanges(!hadActiveSearch);
    setHasPendingVolumeChange(false);
  };

  const currentSortBy =
    (searchParams?.sortBy as FormValues["sortBy"]) ??
    (formVals.sortBy ?? "distance");
  const currentSortOrder =
    (searchParams?.sortOrder as FormValues["sortOrder"]) ??
    (formVals.sortOrder ?? "asc");

  const applySortPersistence = (
    nextSortBy: FormValues["sortBy"],
    nextSortOrder: FormValues["sortOrder"],
    nextFilter: NearbyFilter
  ) => {
    setFormVals((prev) => ({ ...prev, sortBy: nextSortBy, sortOrder: nextSortOrder }));
    const derivedMode: Exclude<SearchMode, null> =
      mode ??
      (nextFilter.latitude != null && nextFilter.longitude != null
        ? "location"
        : "suburb");

    persistedState = {
      mode: derivedMode,
      formValues: { ...formVals, sortBy: nextSortBy, sortOrder: nextSortOrder },
      searchParams: nextFilter,
    };
    setHasFilterChanges(false);
  };

  const handleTableSort = (
    sortBy: "distance" | "price",
    sortOrder: "asc" | "desc"
  ) => {
    setSearchParams((prev) => {
      if (!prev) return prev;
      if (prev.sortBy === sortBy && prev.sortOrder === sortOrder) {
        applySortPersistence(sortBy, sortOrder, prev);
        return prev;
      }
      const updated = { ...prev, sortBy, sortOrder };
      applySortPersistence(sortBy, sortOrder, updated);
      return updated;
    });
  };

  // ---------- UI ----------
  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h5" fontWeight={700}>
        Find Nearby Stations
      </Typography>

      {/* Mode selector */}
      <Stack direction="row" spacing={1}>
        <Button
          variant={mode === "location" ? "contained" : "outlined"}
          onClick={() => handleModeSelect("location")}
          startIcon={<SearchIcon />}
        >
          Search by Location
        </Button>
        <Button
          variant={mode === "suburb" ? "contained" : "outlined"}
          onClick={() => handleModeSelect("suburb")}
          startIcon={<SearchIcon />}
        >
          Search by Suburb
        </Button>
      </Stack>

      {/* Filters */}
      {mode && (
        <SearchFiltersCard
          mode={mode}
          // values
          latitude={formVals.latitude}
          longitude={formVals.longitude}
          suburb={formVals.suburb}
          radiusKm={formVals.radiusKm}
          fuelTypes={formVals.fuelTypes ?? []}
          brandNames={(formVals.brands ?? []) as string[]}
          sortBy={formVals.sortBy ?? "distance"}
          sortOrder={formVals.sortOrder ?? "asc"}
          volumeLitres={formVals.volumeLitres}
          // options
          fuelTypeOptions={fuelTypeOptions}
          brandOptions={brandOptions}
          // location helpers
          geolocating={geolocating}
          geolocationSupported={geolocationSupported}
          // events
          onChange={(p) => {
            setFormVals((prev) => ({ ...prev, ...p }));
            setHasFilterChanges(true);

            if (Object.prototype.hasOwnProperty.call(p, "volumeLitres")) {
              const next = p.volumeLitres as number | undefined;
              setVolumeInput(next);
              setHasPendingVolumeChange(!volumeEquals(next, appliedVolume));
            }
          }}
          onLocate={handleLocate}
          onSearch={handleSearchButtonClick}
          isSearching={isLoading}
          hasFilterChanges={hasFilterChanges}
          onApplyVolume={handleApplyVolumeClick}
          onClearVolume={handleClearVolume}
          hasPendingVolumeChange={hasPendingVolumeChange}
        />
      )}

      {/* Results */}
      {isError ? (
        <Alert severity="error">
          Failed to load stations. Please check your inputs and try again.
        </Alert>
      ) : searchParams ? (
        <StationsDataGrid
          data={stations}
          loading={isLoading}
          sortBy={currentSortBy}
          sortOrder={currentSortOrder}
          appliedVolume={appliedVolume}
          onSortChange={handleTableSort}
        />
      ) : (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            {isLoading ? (
              <>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading...
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  {mode ? "Configure your filters" : "Choose how you want to search"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mode
                    ? "Adjust the filters above and click Search to see nearby stations."
                    : "Select Search by Current Location or Search by Suburb to get started."}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default NearbyPage;
