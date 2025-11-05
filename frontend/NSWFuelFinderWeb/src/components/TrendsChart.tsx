import * as React from "react";
import { Card, CardContent, Stack, Typography, Box, Alert, CircularProgress } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import dayjs from "dayjs";
import { getFuelColor } from "../utils/fuelColors";

// Flexible record shape
type AnyRecord = Record<string, any>;

export interface TrendsChartProps {
  loading?: boolean;
  data?: AnyRecord[] | null;
  title?: string;
  height?: number;
}

// Convert cents-per-litre to $/L text
function formatDollarPerL(valueCents: number | null | undefined) {
  if (valueCents == null) return "—";
  return `$${(valueCents / 100).toFixed(3)}/L`;
}

// Extract date from common keys
function getDate(rec: AnyRecord): Date | null {
  const keys = ["recordedAt", "timestamp", "ts", "date", "observedAt", "lastUpdated"];
  for (const k of keys) {
    const v = rec[k];
    if (v == null) continue;
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v < 2e11 ? v * 1000 : v);
    if (typeof v === "string") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// Extract cents-per-litre from common keys
function getCents(rec: AnyRecord): number | null {
  const keys = ["centsPerLitre", "priceCpl", "price", "value"];
  for (const k of keys) {
    const v = rec[k];
    if (v == null) continue;
    const num = typeof v === "string" ? Number(v) : (v as number);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

// Optional grouping key
function getFuelType(rec: AnyRecord): string | undefined {
  return rec.fuelType ?? rec.fuel ?? rec.type ?? undefined;
}

/**
 * Normalize raw trend points into dataset rows for MUI X Charts:
 *   dataset: [{ x: Date, "<labelA>": number|null, "<labelB>": number|null, ... }]
 *   labels:  ["<labelA>", "<labelB>", ...]
 */
function toDataset(raw?: AnyRecord[] | null) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { dataset: [] as Array<Record<string, Date | number | null>>, labels: [] as string[] };
  }

  const points: { x: Date; y: number; label: string }[] = [];

  for (const entry of raw) {
    const baseLabel = getFuelType(entry);
    const candidatePoints = Array.isArray(entry.points) ? entry.points : [entry];

    for (const point of candidatePoints) {
      const x = getDate(point);
      const y = getCents(point);
      if (!x || y == null) continue;

      const label = getFuelType(point) ?? baseLabel ?? "Price";
      points.push({ x, y, label });
    }
  }

  points.sort((a, b) => a.x.getTime() - b.x.getTime());

  if (points.length === 0) return { dataset: [], labels: [] as string[] };

  const timeKeys = Array.from(new Set(points.map((p) => p.x.getTime()))).sort((a, b) => a - b);
  const labels = Array.from(new Set(points.map((p) => p.label)));

  const dataset: Array<Record<string, Date | number | null>> = timeKeys.map((t) => {
    const row: Record<string, Date | number | null> = { x: new Date(t) };
    for (const lab of labels) row[lab] = null;
    for (const p of points) {
      if (p.x.getTime() === t) row[p.label] = p.y;
    }
    return row;
  });

  return { dataset, labels };
}

export const TrendsChart: React.FC<TrendsChartProps> = ({
  loading,
  data,
  title = "Price trends",
  height = 360,
}) => {
  const { dataset, labels } = React.useMemo(() => toDataset(data), [data]);
  const isEmpty = !loading && dataset.length === 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            {title}
          </Typography>

          {loading && (
            <Box sx={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          )}

          {isEmpty && <Alert severity="info">No trend data available for the current selection.</Alert>}

          {!loading && !isEmpty && (
            <LineChart
              height={height}
              dataset={dataset}
              xAxis={[
                {
                  scaleType: "time",
                  dataKey: "x",
                  label: "Date",
                  valueFormatter: (v: unknown) => dayjs(v as Date).format("MMM D"),
                },
              ]}
              series={labels.map((lab) => ({
                id: lab,
                label: lab,
                dataKey: lab,
                color: getFuelColor(lab), // use your existing color map
                valueFormatter: (v: number | null) =>
                  typeof v === "number" ? `${v.toFixed(1)}¢/L (${formatDollarPerL(v)})` : "",
              }))}
              yAxis={[
                {
                  label: "¢/L",
                  valueFormatter: (v: number | null) =>
                    typeof v === "number" ? `${v.toFixed(1)}¢/L` : "",
                },
              ]}
              sx={{
                "& .MuiChartsAxis-label": { fill: "text.secondary" },
                "& .MuiChartsLegend-series": { fontSize: 12 },
              }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TrendsChart;
