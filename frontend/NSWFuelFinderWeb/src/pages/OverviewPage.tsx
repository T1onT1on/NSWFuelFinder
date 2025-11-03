import { useMemo, useState } from "react";
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
} from "@mui/material";

import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationDisabledIcon from "@mui/icons-material/LocationDisabled";


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

const NEARBY_RADIUS_KM = 5;

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
          address: s.address,
          suburb: s.suburb,
          state: s.state,
          postcode: s.postcode,
          latitude: s.latitude,
          longitude: s.longitude,
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

  // UI state
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(true);
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter | null>(null);
  const [isLocating, setIsLocating] = useState(false);


  const apiFuelTypes = useMemo(() => {
    if (selectAll || !selectedFuelTypes.length) return []; 
    const set = new Set(selectedFuelTypes.map((t) => t.toUpperCase()));
    if (set.has("DL")) set.add("PDL");                     //DL includes PDL
    return Array.from(set);
  }, [selectedFuelTypes, selectAll]);

  // Data
  const { data: globalData, isLoading: isGlobalLoading } =
    useCheapestPrices(apiFuelTypes);
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

  const filteredPrices = useMemo(() => {
    if (selectAll) return activePrices;
    if (!selectedFuelTypes.length) return [];
    const set = new Set(selectedFuelTypes.map((f) => f.toUpperCase()));
    return activePrices.filter((p) => {
      const fuel = p.fuelType.toUpperCase();
      if (set.has(fuel)) return true;
      //Put DL and PDL together
      if (set.has("DL") && fuel === "PDL") return true;
      return false;
    });
  }, [activePrices, selectedFuelTypes, selectAll]);

  // Toggle for location
  const handleNearbyToggle = () => {
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
          setNearbyFilter({ latitude, longitude, radiusKm: NEARBY_RADIUS_KM });
          setIsLocating(false);
          notify(
            "Using your location: showing lowest prices within 5 km.",
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
  };

  const isLoading = isNearbyMode
    ? isNearbyLoading || isLocating
    : isGlobalLoading;
  const showEmptyState = !isLoading && filteredPrices.length === 0;

  return (
    <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 }, pb: 6 }}>
    
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Lowest Fuel Prices in NSW
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select fuel types to view the cheapest stations across NSW. Data
        refreshes twice daily.
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
          onSelectAllChange={setSelectAll}
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
          Displaying the lowest price for each fuel within {NEARBY_RADIUS_KM} km
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
                nearbyTitle={isNearbyMode ? "within 5km" : undefined}
              />
            </Box>
          ))}
        </Box>
      )}
    </Container>
  );
}
