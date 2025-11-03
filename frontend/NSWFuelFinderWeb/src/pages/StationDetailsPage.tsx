import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "react-router-dom";
import { getFuelColor, compareFuelTypes } from "../utils/fuelColors";
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid"; // v7 official Grid API
import dayjs from "dayjs";

import { useNearbyStations, useStationTrends } from "../hooks/queries";
import { useApiClient } from "../hooks/useApiClient";
import type { NearbyFuelStation, NearbyStationsResponse } from "../types";
import { TrendsChart } from "../components/TrendsChart";

const periodOptions = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

type LocationState = {
  station?: NearbyFuelStation;
};

function DescriptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Grid
      container
      spacing={1.5}
      sx={{
        py: 1.25,
        "&:not(:last-of-type)": {
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        },
      }}
    >
      <Grid size={{ xs: 12, md: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <Typography variant="body1">{children}</Typography>
      </Grid>
    </Grid>
  );
}

export const StationDetailsPage: React.FC = () => {
  const { stationCode } = useParams<{ stationCode: string }>();
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const client = useApiClient();

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [fuelType, setFuelType] = useState<string | undefined>(undefined);

  // Fallback for direct entry without state
  const { data: fallbackData } = useNearbyStations(
    !state?.station && stationCode
      ? { latitude: -33.8688, longitude: 151.2093, radiusKm: 50 }
      : null
  );

  const seededStation = useMemo(() => {
    if (state?.station) return state.station;
    return fallbackData?.stations.find((s) => s.id === stationCode);
  }, [state?.station, fallbackData, stationCode]);

  const { data: latestData } = useQuery<NearbyStationsResponse>({
    queryKey: ["station-detail", stationCode, seededStation?.latitude, seededStation?.longitude],
    enabled: Boolean(stationCode && seededStation),
    queryFn: async () => {
      if (!stationCode || !seededStation) throw new Error("Missing station context");
      const params = new URLSearchParams();
      params.set("latitude", String(seededStation.latitude));
      params.set("longitude", String(seededStation.longitude));
      params.set("radiusKm", "50");
      const url = `/api/stations/nearby?${params.toString()}`;
      const { data } = await client.get<NearbyStationsResponse>(url);
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60 * 1000,
  });

  const station = useMemo(() => {
    if (latestData?.stations) {
      const match = latestData.stations.find((s) => s.id === stationCode);
      if (match) return match;
    }
    return seededStation;
  }, [latestData, seededStation, stationCode]);

  const { data: trendData, isLoading } = useStationTrends(stationCode, fuelType, periodDays);

  // Clear fuelType if not available in refreshed data
  useEffect(() => {
    if (!fuelType || !station) return;
    const found = station.prices.some((p) => p.fuelType === fuelType);
    if (!found) setFuelType(undefined);
  }, [station, fuelType]);

  if (!stationCode) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Missing station code.
      </Alert>
    );
  }

  if (!station) {
    return (
      <Stack spacing={2} sx={{ my: 2 }}>
        <Alert severity="warning">Station data unavailable.</Alert>
        <Typography color="text.secondary">
          We couldn&apos;t find this station. Please return to the search page and try again.
        </Typography>
      </Stack>
    );
  }

  const fuelOptions = station.prices.map((p) => p.fuelType);

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <Typography variant="h4" component="h1" fontWeight={600}>
        Station Details
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Grid container spacing={0}>
            <Grid size={{ xs: 12 }}>
              <DescriptionRow label="Name">{station.name}</DescriptionRow>
              <DescriptionRow label="Brand">{station.brand ?? "N/A"}</DescriptionRow>
              <DescriptionRow label="Address">{station.address ?? "N/A"}</DescriptionRow>
              <DescriptionRow label="Coordinates">
                {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
              </DescriptionRow>

              <DescriptionRow label="Fuel Prices">
                {station.prices.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {station.prices
                      .slice()
                      .sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType)) // keep your order
                      .map((price) => {
                        const centsValue = price.centsPerLitre.toFixed(1);
                        const dollarsValue = `${(price.centsPerLitre / 100).toFixed(3)}${
                          price.unit ?? "$/L"
                        }`;
                        const title = price.lastUpdated
                          ? `${price.fuelType}: ${dollarsValue} (updated ${dayjs(
                              price.lastUpdated
                            ).format("YYYY-MM-DD HH:mm")})`
                          : `${price.fuelType}: ${dollarsValue}`;
                        const bg = getFuelColor(price.fuelType);
                        // Simple readable text color (yellow → black, others → white)
                        const fg = bg.toLowerCase().includes("fadb14") ? "#000" : "#fff";

                        return (
                          <Tooltip title={title} key={`${price.fuelType}-${price.centsPerLitre}`}>
                            <Chip
                              label={`${price.fuelType}: ${centsValue}`}
                              sx={{
                                borderRadius: 1,
                                bgcolor: bg,
                                color: fg,
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                  </Stack>
                ) : (
                  "No prices available"
                )}
              </DescriptionRow>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filters */}
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="center">
        <Box sx={{ minWidth: 240 }}>
          <Autocomplete
            value={fuelType ?? null}
            onChange={(_, v) => setFuelType(v ?? undefined)}
            options={fuelOptions}
            renderInput={(params) => <TextField {...params} label="Fuel type" placeholder="Select..." />}
          />
        </Box>

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="period-label">Period</InputLabel>
          <Select
            labelId="period-label"
            label="Period"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
          >
            {periodOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <TrendsChart loading={isLoading} data={trendData} />
    </Stack>
  );
};

export default StationDetailsPage;
