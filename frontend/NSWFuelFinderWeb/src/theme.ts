// src/theme.ts
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#3F51B5",  // Indigo
      dark: "#303F9F",
      light: "#C5CAE9",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#FF4081",  // Pink (accent)
      contrastText: "#FFFFFF",
    },
    text: {
      primary: "#212121",
      secondary: "#757575",
    },
    divider: "#BDBDBD",
    background: { default: "#FAFAFA", paper: "#FFFFFF" },
  },
  typography: {
    h5: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: { defaultProps: { color: "primary" } },
    MuiButton: { styleOverrides: { root: { textTransform: "none", borderRadius: 8 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

export default theme;
