// src/components/data-grid/StationsDataGrid.tsx
// MUI X DataGrid wrapper: type-only imports + columnVisibilityModel for responsive hiding.

import * as React from "react";
import { DataGrid } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridColumnVisibilityModel,
} from "@mui/x-data-grid";
import { Box, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export interface StationsDataGridProps {
  rows: any[];
  columns: GridColDef[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
  getRowId?: (row: any) => string | number;
  pageSizeOptions?: number[];
}

export default function StationsDataGrid({
  rows,
  columns,
  loading,
  onRowClick,
  getRowId,
  pageSizeOptions = [10, 25, 50],
}: StationsDataGridProps) {
  const theme = useTheme();
  const smDown = useMediaQuery(theme.breakpoints.down("sm"));

  // Ensure flex-based columns and sane min widths (no deprecated "hide" prop).
  const adaptedColumns = React.useMemo<GridColDef[]>(
    () =>
      columns.map((c) => ({
        ...c,
        flex: c.flex ?? 1,
        minWidth: c.minWidth ?? 120,
      })),
    [columns]
  );

  // Responsive visibility: hide some columns on small screens.
  const columnVisibilityModel = React.useMemo<GridColumnVisibilityModel>(() => {
    const model: GridColumnVisibilityModel = {};
    for (const c of columns) {
      if (
        smDown &&
        (c.field === "postcode" || c.field === "state" || c.field === "brand")
      ) {
        model[c.field] = false;
      } else {
        // undefined means "use default (visible)"
        // explicit true also ok:
        // model[c.field] = true;
      }
    }
    return model;
  }, [columns, smDown]);

  return (
    <Box sx={{ width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={adaptedColumns}
        columnVisibilityModel={columnVisibilityModel}
        getRowId={getRowId}
        autoHeight
        disableRowSelectionOnClick
        loading={loading}
        pageSizeOptions={pageSizeOptions}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
        onRowClick={(p) => onRowClick?.(p.row)}
      />
    </Box>
  );
}
