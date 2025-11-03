// src/components/tables/StationsDataGrid.tsx
import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box,
  Chip,
  Link,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DataGrid,
  GridOverlay,
  type GridColDef,
  type GridSortModel,
} from "@mui/x-data-grid";

import type { NearbyFuelStation, StationFuelPrice } from "../../types";
import { getFuelColor, compareFuelTypes } from "../../utils/fuelColors";

type Props = {
  data: NearbyFuelStation[];
  loading?: boolean;
  sortBy?: "distance" | "price";
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortBy: "distance" | "price", sortOrder: "asc" | "desc") => void;
  appliedVolume?: number;
};

// Minimal param shape for renderers to avoid generic typing pitfalls
type RowParam = { row: NearbyFuelStation; value?: unknown };

const formatVolumeLabel = (value: number) => Number(value.toFixed(2)).toString();

const renderPriceChip = (price: StationFuelPrice) => {
  const cents = price.centsPerLitre.toFixed(1);
  const dollars = `${(price.centsPerLitre / 100).toFixed(3)}${price.unit ?? "$/L"}`;
  const title = price.lastUpdated
    ? `${price.fuelType}: ${dollars} (updated ${dayjs(price.lastUpdated).format(
        "YYYY-MM-DD HH:mm"
      )})`
    : `${price.fuelType}: ${dollars}`;
  const bg = getFuelColor(price.fuelType);

  return (
    <Tooltip title={title} key={`${price.fuelType}-${price.centsPerLitre}`}>
      <Chip
        size="small"
        label={`${price.fuelType}: ${cents}`}
        sx={{
          bgcolor: bg,
          color: "white",
          fontWeight: 600,
          height: 24,
          "& .MuiChip-label": { px: 1 },
        }}
      />
    </Tooltip>
  );
};

const renderPredictedCostChips = (prices: StationFuelPrice[], volume: number) => {
  const vLabel = formatVolumeLabel(volume);
  const sorted = [...prices].sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType));

  return sorted.map((p) => {
    const baseCost =
      p.estimatedCost != null
        ? Number(p.estimatedCost)
        : Number(((p.centsPerLitre * volume) / 100).toFixed(2));
    if (Number.isNaN(baseCost)) return null;

    const cost = baseCost.toFixed(2);
    const bg = getFuelColor(p.fuelType);

    return (
      <Tooltip title={`${p.fuelType}: $${cost} for ${vLabel} L`} key={`cost-${p.fuelType}-${cost}`}>
        <Chip
          size="small"
          label={`${p.fuelType}: $${cost}`}
          sx={{
            bgcolor: bg,
            color: "white",
            fontWeight: 600,
            height: 24,
            "& .MuiChip-label": { px: 1 },
          }}
        />
      </Tooltip>
    );
  });
};

const toSortModel = (
  sortBy?: "distance" | "price",
  sortOrder?: "asc" | "desc"
): GridSortModel => {
  if (!sortBy || !sortOrder) return [];
  // IMPORTANT: use the actual field name we expose in the column
  return [{ field: sortBy === "price" ? "prices" : "distanceKm", sort: sortOrder }];
};

export default function StationsDataGrid({
  data,
  loading,
  sortBy,
  sortOrder,
  onSortChange,
  appliedVolume,
}: Props) {
  const theme = useTheme();
  const smDown = useMediaQuery(theme.breakpoints.down("sm"));
  const mdDown = useMediaQuery(theme.breakpoints.down("md"));

  // Column defs (no generics) + RowParam keeps renderers simple and safe.
  const columns = React.useMemo<GridColDef[]>(() => {
    const cols: GridColDef[] = [];

    const hasVolume = typeof appliedVolume === "number" && appliedVolume > 0;
    if (hasVolume && appliedVolume) {
      cols.push({
        field: "predictedCost",
        headerName: `Predicted Cost [${formatVolumeLabel(appliedVolume)} L]`,
        flex: 1.4,
        minWidth: 240,
        sortable: false,
        renderCell: (params: RowParam) => {
          const prices = params.row.prices ?? [];
          return (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {renderPredictedCostChips(prices, appliedVolume)}
            </Box>
          );
        },
      });
    }

    cols.push(
      {
        field: "name",
        headerName: "Station",
        flex: 1.2,
        minWidth: 180,
        sortable: false,
        renderCell: (params: RowParam) => {
          const r = params.row;
          const label = r.name ?? `Station ${r.id}`;
          return (
            <Link component={RouterLink} to={`/stations/${r.id}`} state={{ station: r }}>
              {label}
            </Link>
          );
        },
      },
      {
        field: "brand",
        headerName: "Brand",
        width: 120,
        sortable: false,
        renderCell: (params: any) =>
          (params?.row as NearbyFuelStation | undefined)?.brand ?? "",
      },
      {
        field: "address",
        headerName: "Address",
        flex: 1.4,
        minWidth: 220,
        sortable: false,
        renderCell: (params: any) => {
          const r = params?.row as NearbyFuelStation | undefined;
          if (!r) return "";
          return (r.address ?? `${r.suburb ?? ""} ${r.state ?? ""}`).trim();
        },
      },
      {
        field: "distanceKm",
        headerName: "Distance (km)",
        width: 140,
        sortable: true,
      
        valueGetter: (params: any) => {
          const r = params?.row ?? {};
          const raw =
            r.distanceKm ?? r.DistanceKm ?? r.distance ?? r.Distance ?? r.distance_km ?? null;
          if (raw == null) return null;
          const n = typeof raw === "string" ? Number(raw) : raw;
          return Number.isFinite(n) ? n : null;
        },
      
        
        renderCell: (params: any) => {
          const r = params?.row ?? {};
          const raw =
            r.distanceKm ?? r.DistanceKm ?? r.distance ?? r.Distance ?? r.distance_km ?? null;
          const n = typeof raw === "string" ? Number(raw) : raw;
          return n == null || !Number.isFinite(n) ? "-" : (n as number).toFixed(2);
        },
      

        sortComparator: (a: number | null, b: number | null) => {
          const an = a == null ? Number.POSITIVE_INFINITY : a;
          const bn = b == null ? Number.POSITIVE_INFINITY : b;
          return an - bn;
        },
      },
      {
        field: "prices",
        headerName: "Prices",
        flex: 1.6,
        minWidth: 260,
        sortable: true,
        sortComparator: (a, b) => {
          const arrA = (a as StationFuelPrice[]) ?? [];
          const arrB = (b as StationFuelPrice[]) ?? [];
          const minA = arrA.length ? Math.min(...arrA.map((p) => p.centsPerLitre)) : Number.POSITIVE_INFINITY;
          const minB = arrB.length ? Math.min(...arrB.map((p) => p.centsPerLitre)) : Number.POSITIVE_INFINITY;
          return minA - minB;
        },
        renderCell: (params: RowParam) => {
          const prices = (params.row.prices ?? [])
            .slice()
            .sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType));
          return (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {prices.map(renderPriceChip)}
            </Box>
          );
        },
      }
    );

    return cols;
  }, [appliedVolume]);

  // Responsive column visibility
  const columnVisibilityModel = React.useMemo(
    () => ({
      brand: !smDown,
      address: !mdDown,
    }),
    [smDown, mdDown]
  );

  const handleSortModelChange = (model: GridSortModel) => {
    if (!onSortChange) return;
    if (!model.length || !model[0].sort) {
      onSortChange("distance", "asc");
      return;
    }
    const { field, sort } = model[0];
    const nextSortBy = field === "prices" ? "price" : "distance";
    const nextSortOrder = sort === "desc" ? "desc" : "asc";
    onSortChange(nextSortBy, nextSortOrder);
  };

  function NoRows() {
    return (
      <GridOverlay>
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="subtitle2" color="text.secondary">
            No stations to show. Adjust filters and click Search.
          </Typography>
        </Box>
      </GridOverlay>
    );
  }

  return (
    <Box sx={{ height: 640, width: "100%" }}>
      <DataGrid
        rows={data}
        getRowId={(r) => (r as NearbyFuelStation).id}
        columns={columns}
        loading={Boolean(loading)}
        disableRowSelectionOnClick
        pagination
        pageSizeOptions={[10, 25, 50]}
        initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
            sorting: { sortModel: toSortModel(sortBy, sortOrder) },
          }}
        sortingOrder={["asc", "desc"]}
        onSortModelChange={handleSortModelChange}
        columnVisibilityModel={columnVisibilityModel}
        slots={{ noRowsOverlay: NoRows }}
        sx={{
          "& .MuiDataGrid-columnHeaders": { fontWeight: 600 },
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
        }}
      />
    </Box>
  );
}
