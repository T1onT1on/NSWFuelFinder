// src/components/data-display/PriceCard.tsx
// Fuel price card with colored header and safe contrast text.

import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Tooltip,
  useTheme,
  Button,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { CheapestPriceResponse } from "../../types";
import { getFuelColor } from "../../utils/fuelColors";

const formatCentsDisplay = (v: number) => Number(v.toFixed(1));
const formatDollarsDisplay = (v: number) => `${(v / 100).toFixed(3)}$/L`;

export default function PriceCard({
  price,
  nearbyTitle,
}: {
  price: CheapestPriceResponse;
  nearbyTitle?: string; // e.g., "within 5km"
}) {
  const theme = useTheme();
  const accent = getFuelColor(price.fuelType);
  const contrast = theme.palette.getContrastText(accent as any);

  return (
    <Card
      variant="outlined"
      sx={{ minHeight: 190, display: "flex", flexDirection: "column" }}
    >
      <CardHeader
        title={
          <Typography variant="subtitle1" sx={{ color: contrast }}>
            {nearbyTitle
              ? `${price.fuelType} — ${nearbyTitle}`
              : price.fuelType}
          </Typography>
        }
        sx={{ bgcolor: accent, py: 1.2 }}
      />
      <CardContent sx={{ pt: 2 }}>
        <Tooltip
          title={`${price.fuelType}: ${formatDollarsDisplay(
            price.centsPerLitre
          )}`}
        >
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.7 }}>
              Price
            </Typography>
            <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
              {formatCentsDisplay(price.centsPerLitre)}
              <Typography
                component="span"
                variant="subtitle2"
                sx={{ ml: 0.5, opacity: 0.7 }}
              >
                ¢/L
              </Typography>
            </Typography>
          </Box>
        </Tooltip>

        <Typography variant="body1" sx={{ mt: 1.5 }}>
          {price.station.name ?? price.station.stationCode}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {price.station.suburb ?? price.station.address ?? "NSW"}
        </Typography>

        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            component={RouterLink}
            to={`/stations/${price.station.stationCode}`}
          >
            View details
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
