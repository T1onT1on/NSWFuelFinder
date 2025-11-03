// src/layouts/AppLayout.tsx
import { useEffect, useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

const drawerWidth = 240;

const nav = [
  { text: "Overview", to: "/overview" },
  { text: "Advance Search", to: "/nearby" },
];

export default function AppLayout() {
  const theme = useTheme();
  const desktopUp = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (desktopUp && mobileOpen) setMobileOpen(false);
  }, [desktopUp, mobileOpen]);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar />
      <Divider />
      <List component="nav" sx={{ px: 1 }}>
        {nav.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={pathname.startsWith(item.to)}
            onClick={() => !desktopUp && setMobileOpen(false)}
          >
            <ListItemText primary={item.text} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
    </Box>
  );

  return (
    <Box
      sx={{
        display: { xs: "block", lg: "grid" },
        gridTemplateColumns: { lg: `${drawerWidth}px 1fr` },
        minHeight: "100vh",
      }}
    >
      <CssBaseline />

      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          {!desktopUp && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
              aria-label="open navigation"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div">
            NSW Fuel Finder
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ gridColumn: { lg: 1 }, display: { xs: "none", lg: "block" } }}>
        {desktopUp && (
          <Drawer
            variant="permanent"
            open
            sx={{
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {!desktopUp && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
      )}

    
      <Box
        component="main"
        sx={{
          gridColumn: { lg: 2 },
          px: { xs: 2, sm: 3, lg: 4 }, 
          pb: 4,
        }}
      >
        +  <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
