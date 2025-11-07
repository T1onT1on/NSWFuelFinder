import { Card, CardContent, CardHeader, Skeleton, Typography, Box } from "@mui/material";

/**
 * Neutral skeleton for PriceCard (single card).
 * - Does NOT depend on fuel type color.
 * - Keeps the same overall layout & height to avoid layout shift.
 */
export function PriceCardSkeleton() {
  return (
    <Card sx={{ minHeight: 220, display: "flex", flexDirection: "column" }} aria-busy>
      {/* Neutral header bar (grey) */}
      <CardHeader
        title={<Typography variant="subtitle1" sx={{ color: "transparent" }}>.</Typography>}
        action={
          <Skeleton variant="rounded" width={110} height={36} sx={{ borderRadius: 1.5 }} />
        }
        sx={{
          py: 1.2,
          bgcolor: (t) => t.palette.action.hover, // neutral grey
          "& .MuiCardHeader-action": { alignSelf: "center" },
        }}
      />

      <CardContent sx={{ pt: 2 }}>
        <Skeleton variant="text" width={60} height={18} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width={140} height={56} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="70%" height={24} />
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="35%" height={20} sx={{ mb: 1 }} />
        <Box sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" width={110} height={32} />
        </Box>
      </CardContent>
    </Card>
  );
}
