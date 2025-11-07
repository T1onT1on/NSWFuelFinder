import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Tooltip,
  useTheme,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import DirectionsIcon from "@mui/icons-material/Directions";
import { Link as RouterLink } from "react-router-dom";
import type {
  CheapestPriceResponse,
  NearbyFuelStation,
  StationFuelPrice,
} from "../../types";
import { getFuelColor } from "../../utils/fuelColors";
import { buildMapLinks } from "../../utils/mapLinks";
import { useNotify } from "../feedback/NotifyProvider";

const formatCentsDisplay = (v: number) => Number(v.toFixed(1));
const formatDollarsDisplay = (v: number) => `${(v / 100).toFixed(3)}$/L`;
const formatDistanceLabel = (distanceKm?: number | null) => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return null;
  }
  if (distanceKm < 0.1) {
    return "<0.1km away";
  }
  const base =
    distanceKm < 10
      ? Number(distanceKm.toFixed(1)).toString()
      : Math.round(distanceKm).toString();
  return `${base}km away`;
};

export default function PriceCard({
  price,
  nearbyTitle,
}: {
  price: CheapestPriceResponse;
  nearbyTitle?: string;
}) {
  const theme = useTheme();
  const accent = getFuelColor(price.fuelType);
  const contrast = theme.palette.getContrastText(accent as any);
  const { notify } = useNotify();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);
  const distanceLabel = useMemo(
    () => formatDistanceLabel(price.station.distanceKm),
    [price.station.distanceKm]
  );
  const headerLabel = distanceLabel ?? nearbyTitle ?? null;

  const resolvedAddress = useMemo(() => {
    const parts = [
      price.station.address,
      price.station.suburb,
      price.station.state,
      price.station.postcode,
    ]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.trim())
      .filter((part, index, array) => part.length > 0 && array.indexOf(part) === index);

    if (parts.length > 0) {
      return parts.join(", ");
    }
    return price.station.name ?? price.station.stationCode;
  }, [
    price.station.address,
    price.station.name,
    price.station.postcode,
    price.station.state,
    price.station.stationCode,
    price.station.suburb,
  ]);

  const mapLinks = useMemo(
    () =>
      buildMapLinks({
        latitude: price.station.latitude,
        longitude: price.station.longitude,
      }),
    [price.station.latitude, price.station.longitude]
  );

  const mapOptions = useMemo(
    () => [
      { id: "appleMaps", label: "Apple Maps", url: mapLinks.appleMaps },
      { id: "googleMaps", label: "Google Maps", url: mapLinks.googleMaps },
      { id: "waze", label: "Waze", url: mapLinks.waze },
    ],
    [mapLinks.appleMaps, mapLinks.googleMaps, mapLinks.waze]
  );

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleOpenLink = (url?: string) => {
    if (!url) {
      notify("Map link unavailable for this station.", "warning");
      handleMenuClose();
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    handleMenuClose();
  };

  const handleCopyAddress = async () => {
    if (!resolvedAddress) {
      notify("Address unavailable to copy.", "warning");
      handleMenuClose();
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedAddress);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = resolvedAddress;
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      notify("Address copied to clipboard.", "success");
    } catch (err) {
      console.error("Failed to copy address", err);
      notify("Unable to copy address.", "error");
    } finally {
      handleMenuClose();
    }
  };

  return (
    <Card //variant="outlined" 
    sx={{ minHeight: 220, display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={
          <Typography variant="subtitle1" sx={{ color: contrast, fontWeight: 700 }}>
            {headerLabel ? `${price.fuelType} \u00b7 ${headerLabel}` : price.fuelType}
          </Typography>
        }
        action={
          <>
            <Button
              size="medium"
              variant="text"
              startIcon={<DirectionsIcon fontSize="large" />}
              onClick={handleMenuOpen}
              sx={{
                color: contrast,
                borderColor: contrast,
                textTransform: "none",
                fontWeight: 600,
                fontSize: 16,
                "&:hover": { borderColor: contrast, bgcolor: "rgba(255,255,255,0.12)" },
              }}
            >
              Navigate
            </Button>
            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              {mapOptions.map((option) => (
                <MenuItem
                  key={option.id}
                  onClick={() => handleOpenLink(option.url)}
                  disabled={!option.url}
                >
                  {option.label}
                </MenuItem>
              ))}
              <MenuItem onClick={handleCopyAddress}>Copy Address</MenuItem>
            </Menu>
          </>
        }
        sx={{
          bgcolor: accent,
          py: 1.2,
          "& .MuiCardHeader-action": { alignSelf: "center" },
        }}
      />
      <CardContent sx={{ pt: 2 }}>
        <Tooltip title={`${price.fuelType}: ${formatDollarsDisplay(price.centsPerLitre)}`}>
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.7 }}>
              Price
            </Typography>
            <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
              {formatCentsDisplay(price.centsPerLitre)}
              <Typography component="span" variant="subtitle2" sx={{ ml: 0.5, opacity: 0.7 }}>
                ¢/L
              </Typography>
            </Typography>
          </Box>
        </Tooltip>

        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body1" fontWeight={600}>
            {price.station.name ?? price.station.stationCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {price.station.brand ?? price.station.brandCanonical ?? "N/A"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {price.station.suburb ?? "NSW"}
          </Typography>
        </Box>

        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            component={RouterLink}
            to={`/stations/${price.station.stationCode}`}
            state={{
              station: toNearbyStation(price),
            }}
          >
            View Details
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function toNearbyStation(price: CheapestPriceResponse): NearbyFuelStation {
  const primaryPrice: StationFuelPrice = {
    fuelType: price.fuelType,
    centsPerLitre: price.centsPerLitre,
    unit: price.unit ?? "$/L",
    description: null,
    lastUpdated: price.lastUpdated ?? null,
    estimatedCost: null,
  };

  return {
    id: price.station.stationCode,
    name: price.station.name ?? `Station ${price.station.stationCode}`,
    brand: price.station.brand ?? null,
    brandCanonical: price.station.brandCanonical ?? null,
    brandOriginal: price.station.brandOriginal ?? null,
    address: price.station.address ?? null,
    suburb: price.station.suburb ?? null,
    state: price.station.state ?? null,
    postcode: price.station.postcode ?? null,
    latitude: price.station.latitude,
    longitude: price.station.longitude,
    distanceKm: price.station.distanceKm ?? null,
    prices: [primaryPrice],
  };
}
