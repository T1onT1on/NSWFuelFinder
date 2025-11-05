// src/app/AppProviders.tsx
// Wrap app with Theme, CssBaseline, React Query, Date localization, and global Notifier.

import React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import theme from "../theme";
import { NotifyProvider } from "../components/feedback/NotifyProvider";
// Import Roboto fonts (official recommended way)
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <NotifyProvider>{children}</NotifyProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
