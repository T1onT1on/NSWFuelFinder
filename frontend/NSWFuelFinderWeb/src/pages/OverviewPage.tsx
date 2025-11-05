import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Container,
  useTheme,
  useMediaQuery,
  FormControlLabel,
  Switch,
  ToggleButton,
} from "@mui/material";

import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationDisabledIcon from "@mui/icons-material/LocationDisabled";
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';


import {
  useCheapestPrices,
  useNearbyStations,
  type NearbyFilter,
} from "../hooks/queries";


import type { CheapestPriceResponse, NearbyFuelStation } from "../types";
import { compareFuelTypes, fuelDisplayOrder } from "../utils/fuelColors";
import PriceCard from "../components/data-display/PriceCard";
import FuelFilterChips from "../components/ui/FuelFilterChips";
import { useNotify } from "../components/feedback/NotifyProvider";
import BrandShortcutButtons from "../components/ui/BrandShortcutButtons";
import {
  OVERVIEW_BRAND_SHORTCUTS,
  OVERVIEW_BRAND_SHORTCUT_ALL_ID,
  DEFAULT_OVERVIEW_BRAND_SHORTCUT_IDS,
  DEFAULT_OVERVIEW_RADIUS_KM,
} from "../constants/overviewFilters";
import {
  PROFILE_EVENT,
  PROFILE_STORAGE_KEY,
  readStoredUserProfile,
  type StoredUserProfile,
} from "../utils/userProfileStorage";
import { useAuth } from "../context/AuthContext";
const BRAND_SHORTCUT_LOOKUP = new Map<string, string[]>(
  OVERVIEW_BRAND_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.brands])
);

const arraysEqualIgnoreCase = (a: readonly string[] | undefined, b: readonly string[]) => {
  const arrA = a ?? [];
  if (arrA.length !== b.length) {
    return false;
  }
  const setA = new Set(arrA.map((value) => value.toUpperCase()));
  return b.every((value) => setA.has(value.toUpperCase()));
};

function buildCheapestFromNearby(
  stations: NearbyFuelStation[]
): CheapestPriceResponse[] {
  const cheapest = new Map<string, CheapestPriceResponse>();
  stations.forEach((s) => {
    s.prices.forEach((p) => {
      const key = p.fuelType?.toUpperCase() ?? "";
      if (!fuelDisplayOrder.includes(key)) return;
      const cand: CheapestPriceResponse = {
        fuelType: key,
        centsPerLitre: p.centsPerLitre,
        unit: p.unit ?? "$/L",
        lastUpdated: p.lastUpdated ?? null,
        station: {
          stationCode: s.id,
          name: s.name,
          brand: s.brand,
          brandCanonical: s.brandCanonical ?? s.brand ?? null,
          brandOriginal: s.brandOriginal ?? s.brand ?? null,
          address: s.address,
          suburb: s.suburb,
          state: s.state,
          postcode: s.postcode,
          latitude: s.latitude,
          longitude: s.longitude,
          distanceKm: s.distanceKm ?? null,
        },
      };
      const ex = cheapest.get(key);
      if (!ex || cand.centsPerLitre < ex.centsPerLitre) cheapest.set(key, cand);
    });
  });
  return fuelDisplayOrder
    .map((k) => cheapest.get(k))
    .filter((v): v is CheapestPriceResponse => Boolean(v));
}

export default function OverviewPage() {
  const { notify } = useNotify();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { isAuthenticated } = useAuth();
  const [storedProfile, setStoredProfile] = useState<StoredUserProfile>(() => readStoredUserProfile());
  const overviewPref = storedProfile.overviewFilterPreference;

  // UI state
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(true);
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activeBrandShortcuts, setActiveBrandShortcuts] = useState<string[]>(
    DEFAULT_OVERVIEW_BRAND_SHORTCUT_IDS
  );
  const [customBrandNames, setCustomBrandNames] = useState<string[]>([]);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_OVERVIEW_RADIUS_KM);
  const [customFilterActive, setCustomFilterActive] = useState(false);
  const hasAppliedCustomPreferenceRef = useRef(false);
  const autoNearbyAppliedRef = useRef(false);

  useEffect(() => {
    const handleProfileEvent = (event: Event) => {
      const custom = event as CustomEvent<StoredUserProfile>;
      setStoredProfile(custom.detail ?? {});
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY) {
        setStoredProfile(readStoredUserProfile());
      }
    };

    window.addEventListener(PROFILE_EVENT, handleProfileEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT, handleProfileEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const resetToDefaultFilters = useCallback(() => {
    setSelectAll(true);
    setSelectedFuelTypes([]);
    setActiveBrandShortcuts(DEFAULT_OVERVIEW_BRAND_SHORTCUT_IDS);
    setCustomBrandNames([]);
    setNearbyRadiusKm(DEFAULT_OVERVIEW_RADIUS_KM);
    setCustomFilterActive(false);
  }, []);

  const applyOverviewPreference = useCallback(
    (
      pref: StoredUserProfile["overviewFilterPreference"],
      { notifyUser = false }: { notifyUser?: boolean } = {}
    ) => {
      if (!pref) return;
      const nextSelectAll =
        pref.selectAll !== undefined ? pref.selectAll : !(pref.fuelTypes && pref.fuelTypes.length > 0);
      const nextFuelTypes = nextSelectAll ? [] : pref.fuelTypes ?? [];
      setSelectAll(nextSelectAll);
      setSelectedFuelTypes(nextFuelTypes);

      const normalizedCustomBrands =
        pref.brandNames && pref.brandNames.length > 0
          ? Array.from(
              new Set<string>(
                pref.brandNames
                  .map((name: string) => name.trim())
                  .filter((name: string) => name.length > 0)
              )
            )
          : [];

      if (normalizedCustomBrands.length > 0) {
        const matchedShortcutEntry = [...BRAND_SHORTCUT_LOOKUP.entries()].find(([id, brands]) => {
          if (id === OVERVIEW_BRAND_SHORTCUT_ALL_ID) return false;
          return arraysEqualIgnoreCase(normalizedCustomBrands, brands);
        });

        if (matchedShortcutEntry) {
          setCustomBrandNames([]);
          setActiveBrandShortcuts([matchedShortcutEntry[0]]);
        } else {
          setCustomBrandNames(normalizedCustomBrands);
          setActiveBrandShortcuts([]);
        }
      } else {
        setCustomBrandNames([]);
        const candidateIds =
          pref.brandShortcutIds && pref.brandShortcutIds.length > 0
            ? Array.from(
                new Set<string>(
                  pref.brandShortcutIds.filter((id: string) => BRAND_SHORTCUT_LOOKUP.has(id))
                )
              )
            : [OVERVIEW_BRAND_SHORTCUT_ALL_ID];
        setActiveBrandShortcuts(
          candidateIds.length > 0 ? candidateIds : [OVERVIEW_BRAND_SHORTCUT_ALL_ID]
        );
      }

      const radius =
        typeof pref.radiusKm === "number" && pref.radiusKm > 0 ? pref.radiusKm : DEFAULT_OVERVIEW_RADIUS_KM;
      setNearbyRadiusKm(radius);

      setCustomFilterActive(Boolean(pref.enabled));

      if (notifyUser) {
        notify("Customized Filter Enabled! Change your settings in Profile Page", "success");
      }
    },
    [notify]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      resetToDefaultFilters();
      hasAppliedCustomPreferenceRef.current = false;
      return;
    }

    if (overviewPref?.enabled) {
      if (!hasAppliedCustomPreferenceRef.current) {
        applyOverviewPreference(overviewPref, { notifyUser: true });
        hasAppliedCustomPreferenceRef.current = true;
      }
    } else {
      hasAppliedCustomPreferenceRef.current = false;
      resetToDefaultFilters();
    }
  }, [isAuthenticated, overviewPref, applyOverviewPreference, resetToDefaultFilters]);

  const handleCustomFilterToggle = () => {
    if (!isAuthenticated) {
      notify("Log in to set up and remember your own filter.", "info", {
        durationMs: 3000,
        color: "#795548",
        textColor: "#fff",
      });
      return;
    }

    if (!overviewPref?.enabled) {
      notify("Set up and Enable the Customized Filter in Profile Page.", "info");
      return;
    }

    if (customFilterActive) {
      resetToDefaultFilters();
      return;
    }

    applyOverviewPreference(overviewPref);
    hasAppliedCustomPreferenceRef.current = true;
  };

  const brandFilteringEnabled = useMemo(
    () =>
      customBrandNames.length > 0 ||
      !activeBrandShortcuts.includes(OVERVIEW_BRAND_SHORTCUT_ALL_ID),
    [customBrandNames, activeBrandShortcuts]
  );

  const effectiveBrandCanonical = useMemo(() => {
    if (!brandFilteringEnabled) {
      return [] as string[];
    }
    if (customBrandNames.length > 0) {
      return customBrandNames;
    }
    const collected = new Set<string>();
    activeBrandShortcuts.forEach((id) => {
      (BRAND_SHORTCUT_LOOKUP.get(id) ?? []).forEach((brand) => collected.add(brand));
    });
    return Array.from(collected);
  }, [activeBrandShortcuts, brandFilteringEnabled, customBrandNames]);

  const brandAllowedUpper = useMemo(
    () => new Set(effectiveBrandCanonical.map((brand) => brand.toUpperCase())),
    [effectiveBrandCanonical]
  );


  const apiFuelTypes = useMemo(() => {
    if (selectAll || !selectedFuelTypes.length) return []; 
    const set = new Set(selectedFuelTypes.map((t) => t.toUpperCase()));
    if (set.has("DL")) set.add("PDL");                     //DL includes PDL
    return Array.from(set);
  }, [selectedFuelTypes, selectAll]);

  // Data
  const { data: globalData, isLoading: isGlobalLoading } =
    useCheapestPrices(apiFuelTypes, brandFilteringEnabled ? effectiveBrandCanonical : []);
  const { data: nearbyData, isLoading: isNearbyLoading } =
    useNearbyStations(nearbyFilter);

  const globalPrices = useMemo<CheapestPriceResponse[]>(
    () => globalData ?? [],
    [globalData]
  );
  const sortedGlobalPrices = useMemo(
    () =>
      globalPrices
        .slice()
        .sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType)),
    [globalPrices]
  );



  const nearbyPrices = useMemo(() => {
    if (!nearbyData?.stations?.length) return [] as CheapestPriceResponse[];
    return buildCheapestFromNearby(nearbyData.stations).sort((a, b) =>
      compareFuelTypes(a.fuelType, b.fuelType)
    );
  }, [nearbyData]);

  const isNearbyMode = Boolean(nearbyFilter);
  const activePrices = isNearbyMode ? nearbyPrices : sortedGlobalPrices;

  const brandFilteredPrices = useMemo(() => {
    if (!brandFilteringEnabled || brandAllowedUpper.size === 0) {
      return activePrices;
    }
    return activePrices.filter((price) => {
      const canonical = price.station?.brandCanonical;
      if (!canonical) return false;
      return brandAllowedUpper.has(canonical.toUpperCase());
    });
  }, [activePrices, brandAllowedUpper, brandFilteringEnabled]);

  const filteredPrices = useMemo(() => {
    if (selectAll) return brandFilteredPrices;
    if (!selectedFuelTypes.length) return [];
    const set = new Set(selectedFuelTypes.map((f) => f.toUpperCase()));
    return brandFilteredPrices.filter((p) => {
      const fuel = p.fuelType.toUpperCase();
      if (set.has(fuel)) return true;
      //Put DL and PDL together
      if (set.has("DL") && fuel === "PDL") return true;
      return false;
    });
  }, [brandFilteredPrices, selectedFuelTypes, selectAll]);

  // Toggle for location
  const handleNearbyToggle = useCallback(() => {
    if (!isNearbyMode) {
      if (!navigator.geolocation) {
        notify("Geolocation is not supported by this browser.", "warning");
        return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latitude = Number(pos.coords.latitude.toFixed(4));
          const longitude = Number(pos.coords.longitude.toFixed(4));
          setNearbyFilter({
            latitude,
            longitude,
            radiusKm: nearbyRadiusKm,
            brands: brandFilteringEnabled ? effectiveBrandCanonical : undefined,
          });
          setIsLocating(false);
          notify(
            `Using your location: showing lowest prices within ${nearbyRadiusKm} km.`,
            "success"
          );
        },
        (err) => {
          setIsLocating(false);
          notify(`Unable to retrieve location: ${err.message}`, "error");
        }
      );
    } else {
      setNearbyFilter(null);
      setIsLocating(false);
      notify("Showing NSW-wide lowest prices.", "info");
    }
  }, [
    brandFilteringEnabled,
    effectiveBrandCanonical,
    isNearbyMode,
    nearbyRadiusKm,
    notify,
  ]);

  const handleBrandShortcutsChange = (nextIds: string[]) => {
    setCustomBrandNames([]);
    let selection = (nextIds ?? []).filter((id) => BRAND_SHORTCUT_LOOKUP.has(id));
    if (selection.includes(OVERVIEW_BRAND_SHORTCUT_ALL_ID)) {
      selection = selection.filter((id) => id !== OVERVIEW_BRAND_SHORTCUT_ALL_ID);
    }
    if (selection.length === 0) {
      setActiveBrandShortcuts([OVERVIEW_BRAND_SHORTCUT_ALL_ID]);
    } else {
      setActiveBrandShortcuts(Array.from(new Set(selection)));
    }
  };

  const customizedToggle = (
    <ToggleButton
      value="customized"
      selected={customFilterActive}
      onChange={(event, _selected) => {
        event.preventDefault();
        handleCustomFilterToggle();
      }}
      color="secondary"
      sx={{
        px: 2,
        py: 0.7,
        gap: 1,
        fontWeight: 600,
        borderRadius: 2,
        textTransform: "none",
        border: "1px solid",
        borderColor: "secondary.main",
        color: customFilterActive ? "#fff" : "secondary.main",
        "&:hover": { bgcolor: "secondary.main", color: "#fff" },
        "&.Mui-selected": {
          bgcolor: "secondary.main",
          color: "#fff",
          borderColor: "secondary.main",
          "&:hover": { bgcolor: "secondary.dark" },
        },
      }}
    >{customFilterActive ? (<CheckBoxIcon fontSize="small" />) : (<CheckBoxOutlineBlankIcon fontSize="small" />)}
      Customized Filter
    </ToggleButton>
  );

  useEffect(() => {
    if (!isNearbyMode) {
      return;
    }
    setNearbyFilter((prev) => {
      if (!prev) {
        return prev;
      }
      if (!brandFilteringEnabled || brandAllowedUpper.size === 0) {
        if (!prev.brands || prev.brands.length === 0) {
          return prev;
        }
        return { ...prev, brands: undefined };
      }
      if (arraysEqualIgnoreCase(prev.brands, effectiveBrandCanonical)) {
        return prev;
      }
      return { ...prev, brands: effectiveBrandCanonical };
    });
  }, [brandAllowedUpper, brandFilteringEnabled, effectiveBrandCanonical, isNearbyMode]);

  useEffect(() => {
    const enabled = overviewPref?.enabled ?? false;
    const radius = overviewPref?.radiusKm;

    if (!customFilterActive || !enabled || typeof radius !== "number" || radius <= 0) {
      autoNearbyAppliedRef.current = false;
      return;
    }

    if (autoNearbyAppliedRef.current) {
      return;
    }
    autoNearbyAppliedRef.current = true;

    if (!isNearbyMode && !isLocating) {
      handleNearbyToggle();
    }
  }, [
    customFilterActive,
    handleNearbyToggle,
    isLocating,
    isNearbyMode,
    overviewPref?.enabled,
    overviewPref?.radiusKm,
  ]);

  const isLoading = isNearbyMode
    ? isNearbyLoading || isLocating
    : isGlobalLoading;
  const showEmptyState = !isLoading && filteredPrices.length === 0;

  const handleSelectAllChange = useCallback(
    (next: boolean) => {
      setSelectAll(next);
      if (next && customFilterActive) {
        setCustomFilterActive(false);
        autoNearbyAppliedRef.current = false;
      }
    },
    [customFilterActive]
  );

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 }, pb: 6 }}>
    
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {customFilterActive ? "Lowest Fuel Prices Around You" : "Lowest Fuel Prices in NSW"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {customFilterActive ? "Welcome back! Your customized filter is enabled, by you, for you." : "Select fuel types to view the cheapest stations across NSW. Data refreshes twice daily."}
        
      </Typography>

      {/* Filter + Location buttons */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={1.5}
        useFlexGap
        flexWrap="wrap"
        alignItems={isMobile ? "stretch" : "center"}
        justifyContent="flex-start"
        sx={{ mb: 2 }}
      >
        <FuelFilterChips
          value={selectedFuelTypes}
          selectAll={selectAll}
          onChange={setSelectedFuelTypes}
          onSelectAllChange={handleSelectAllChange}
          customControl={customizedToggle}
        />
        <BrandShortcutButtons
          options={OVERVIEW_BRAND_SHORTCUTS}
          value={activeBrandShortcuts}
          onChange={handleBrandShortcutsChange}
          allOptionId={OVERVIEW_BRAND_SHORTCUT_ALL_ID}
          closeIconIds={OVERVIEW_BRAND_SHORTCUTS.map((opt) => opt.id).filter((id) => id !== OVERVIEW_BRAND_SHORTCUT_ALL_ID)}
          size="small"
          allowEmptySelection
        />

<FormControlLabel
  control={
    <Switch
      checked={isNearbyMode}
      onChange={handleNearbyToggle}
      color="primary"
      disabled={isLocating}
    />
  }
  label={
    <Box display="flex" alignItems="center">
      {/* 左侧图标 */}
      {isNearbyMode ? (
        <MyLocationIcon
          sx={{
            fontSize: 20,
            mr: 1,
            color: "primary.main",
            transition: "color 0.2s ease",
          }}
        />
      ) : (
        <LocationDisabledIcon
          sx={{
            fontSize: 20,
            mr: 1,
            color: "text.secondary",
            transition: "color 0.2s ease",
          }}
        />
      )}

      {/* 文字部分 */}
      <Typography
        sx={{
          fontWeight: isNearbyMode ? 700 : 400,
          color: isNearbyMode ? "primary.main" : "text.primary",
          transition: "color 0.2s ease, font-weight 0.2s ease",
        }}
      >
        {isLocating ? "Locating..." : "Check by My Location"}
      </Typography>
    </Box>
  }
/>
      </Stack>

      {isNearbyMode && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Displaying the lowest price for each fuel within {nearbyRadiusKm} km
          of your current location.
        </Typography>
      )}

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading...
          </Typography>
        </Stack>
      )}

      {!isLoading && showEmptyState && (
        <Alert severity="info" sx={{ my: 2 }}>
          No data available. Try selecting different fuel types.
        </Alert>
      )}

      {/* Cards */}
      {!isLoading && !showEmptyState && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(3, 1fr)",
              xl: "repeat(4, 1fr)"
            },
          }}
        >
          {filteredPrices.map((price) => (
            <Box key={price.fuelType}>
              <PriceCard
                price={price}
              />
            </Box>
          ))}
        </Box>
      )}
    </Container>
  );
}


