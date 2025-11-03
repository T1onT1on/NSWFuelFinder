// src/components/filters/SearchFiltersCard.tsx
import * as React from "react";
import {
  Card, CardHeader, CardContent, CardActions,
  TextField, Button, Divider, Collapse,
  Autocomplete, Chip, MenuItem, Stack, Tooltip, Box,
  useTheme, useMediaQuery, Grid
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

type Option = { label: string; value: string };

export type SearchFiltersCardProps = {
  mode: "location" | "suburb";

  latitude?: number;
  longitude?: number;
  suburb?: string;
  radiusKm?: number;
  fuelTypes: string[];
  brandNames: string[];
  sortBy: "distance" | "price";
  sortOrder: "asc" | "desc";
  volumeLitres?: number;

  fuelTypeOptions: Option[];
  brandOptions: string[];

  geolocating: boolean;
  geolocationSupported: boolean;

  onChange: (patch: Partial<{
    latitude: number | undefined;
    longitude: number | undefined;
    suburb: string | undefined;
    radiusKm: number | undefined;
    fuelTypes: string[];
    brandNames: string[];
    sortBy: "distance" | "price";
    sortOrder: "asc" | "desc";
    volumeLitres: number | undefined;
  }>) => void;

  onLocate: () => void;
  onSearch: () => void;
  isSearching: boolean;
  hasFilterChanges: boolean;

  onApplyVolume: () => void;
  onClearVolume: () => void;
  hasPendingVolumeChange: boolean;
};

export default function SearchFiltersCard(props: SearchFiltersCardProps) {
  const {
    mode,
    latitude, longitude, suburb, radiusKm,
    fuelTypes, brandNames, sortBy, sortOrder, volumeLitres,
    fuelTypeOptions, brandOptions,
    geolocating, geolocationSupported,
    onChange, onLocate, onSearch, isSearching, hasFilterChanges,
    onApplyVolume, onClearVolume, hasPendingVolumeChange,
  } = props;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const wide1024 = useMediaQuery("(min-width:1024px)");
  const [expanded, setExpanded] = React.useState(false);

  // Build brand option objects once
  const brandOptionObjs = React.useMemo(
    () => (brandOptions ?? []).map((s) => ({ label: s, value: s })),
    [brandOptions]
  );

  return (
    <Card elevation={1}>
      <CardHeader
        title="Search Filters"
        action={
          <Button
            size="medium"
            endIcon={
              <ExpandMoreIcon
                sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
              />
            }
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide advanced" : "Advanced filters"}
          </Button>
        }
      />
      <Divider />

      {/* Basic filters */}
      <CardContent>
        <Grid container spacing={2}>
          {mode === "location" ? (
            <>
              {/* Latitude + Longitude in one row */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Latitude"
                  value={latitude ?? ""}
                  onChange={(e) =>
                    onChange({
                      latitude: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="Enter Manually or Use Location"
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Longitude"
                  value={longitude ?? ""}
                  onChange={(e) =>
                    onChange({
                      longitude: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="Enter Manually or Use Location"
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Grid>

              {/* Radius + Locate Me in one row */}
              <Grid size={{ xs: 12 }}>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  flexWrap={isMobile ? "wrap" : "nowrap"}
                >
                  <TextField
                    label="Fuel Stations Within (km)"
                    value={radiusKm ?? ""}
                    onChange={(e) =>
                      onChange({
                        radiusKm: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="5"
                    size="small"
                    variant="outlined"
                    sx={{ width: 200, flexShrink: 0 }}
                  />

                  <Tooltip
                    title={
                      geolocationSupported
                        ? "Use my current location"
                        : "Geolocation not available"
                    }
                  >
                    <span>
                      <Button
                        onClick={onLocate}
                        startIcon={<MyLocationIcon />}
                        disabled={!geolocationSupported || geolocating}
                        variant="contained"
                        color="primary"
                        sx={{ whiteSpace: "nowrap", height: 40, px: 2.5 }}
                      >
                        {geolocating ? "Locating..." : "Locate Me"}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Grid>
            </>
          ) : (
            <>
              {/* Suburb mode */}
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="Suburb"
                  value={suburb ?? ""}
                  onChange={(e) => onChange({ suburb: e.target.value || undefined })}
                  placeholder="e.g. Kingsford"
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Fuel Stations Within (km)"
                  value={radiusKm ?? ""}
                  onChange={(e) =>
                    onChange({
                      radiusKm: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="5"
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>

      <CardActions sx={{ px: 2, pb: expanded ? 0 : 2 }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant={hasFilterChanges ? "contained" : "outlined"}
            startIcon={<SearchIcon />}
            onClick={onSearch}
            disabled={isSearching}
          >
            Search
          </Button>
        </Stack>
      </CardActions>

      {/* Advanced filters */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider sx={{ mt: 2 }} />
        <CardContent sx={{ pt: 2 }}>
          {/* Fuel Types + Brand row keeps Grid for natural wrapping */}
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Autocomplete
                multiple
                options={fuelTypeOptions}
                value={fuelTypes.map((v) => ({ label: v, value: v }))}
                onChange={(_, val) => onChange({ fuelTypes: val.map((v) => v.value) })}
                getOptionLabel={(o) => o.label}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option.value} label={option.label} />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Fuel Types" placeholder="All" />
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                multiple
                options={brandOptionObjs}
                value={(brandNames ?? []).map((v) => ({ label: v, value: v }))}
                onChange={(_, val) => onChange({ brandNames: val.map((x) => x.value) })}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option.value} label={option.label} />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Brand" placeholder="All" />
                )}
              />
            </Grid>
          </Grid>

          {/* Sort / Order / Cost / Active / Clear — responsive at 1024px */}
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gap: 2,
              alignItems: "center",
              gridTemplateColumns: wide1024 ? "1fr 1fr 2fr auto auto" : "1fr 1fr",
            }}
          >
            {/* Sort By */}
            <TextField
              select
              label="Sort By"
              value={sortBy}
              onChange={(e) => onChange({ sortBy: e.target.value as "distance" | "price" })}
              size="small"
              fullWidth
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="distance">Distance</MenuItem>
              <MenuItem value="price">Price</MenuItem>
            </TextField>

            {/* Order By */}
            <TextField
              select
              label="Order By"
              value={sortOrder}
              onChange={(e) => onChange({ sortOrder: e.target.value as "asc" | "desc" })}
              size="small"
              fullWidth
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </TextField>

            {/* Cost Prediction — span full row when <1024 */}
            <TextField
              label="Cost Prediction"
              value={volumeLitres ?? ""}
              onChange={(e) =>
                onChange({
                  volumeLitres: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Enter Volume Charging (L). e.g. 50"
              size="small"
              fullWidth
              sx={{ gridColumn: wide1024 ? "auto" : "1 / -1", minWidth: wide1024 ? 240 : 200 }}
            />

            {/* Active */}
            <Button
              variant="contained"
              color={hasPendingVolumeChange ? "primary" : "inherit"}
              startIcon={<DoneAllIcon />}
              onClick={onApplyVolume}
              sx={{ justifySelf: "start", whiteSpace: "nowrap" }}
            >
              Active&nbsp;Prediction
            </Button>

            {/* Clear */}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestartAltIcon />}
              onClick={onClearVolume}
              sx={{ justifySelf: "start", whiteSpace: "nowrap" }}
            >
              Clear&nbsp;Prediction
            </Button>
          </Box>
        </CardContent>

        {/* keep footer empty intentionally */}
        <CardActions sx={{ px: 2, pb: 2 }} />
      </Collapse>
    </Card>
  );
}
