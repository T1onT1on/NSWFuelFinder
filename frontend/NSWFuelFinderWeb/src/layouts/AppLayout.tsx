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
  Button,
  Stack,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import LoginDialog from "../components/ui/LoginDialog";
import { useAuth } from "../context/AuthContext";
import { registerUser, loginUser, extractErrorMessage } from "../api/auth";
import { getUserPreferences } from "../api/userPreferences";
import { useNotify } from "../components/feedback/NotifyProvider";
import {
  clearStoredUserProfile,
  readStoredUserProfile,
  updateStoredUserProfile,
  PROFILE_EVENT,
  PROFILE_STORAGE_KEY,
  mapPreferencesResponseToStoredProfile,
  type StoredUserProfile,
} from "../utils/userProfileStorage";

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
  const navigate = useNavigate();

  // ---- Auth from your existing context ----
  const { isAuthenticated, setSession, setSessionWithRemember, logout } = useAuth();
  const { notify } = useNotify();

  // ---- Login dialog state ----
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- User menu ----
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const [profile, setProfile] = useState<StoredUserProfile>(() => readStoredUserProfile());
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    if (desktopUp && mobileOpen) setMobileOpen(false);
  }, [desktopUp, mobileOpen]);

  useEffect(() => {
    const handleProfileEvent = (event: Event) => {
      const custom = event as CustomEvent<StoredUserProfile>;
      if (custom.detail) {
        setProfile(custom.detail);
      } else {
        setProfile({});
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY) {
        setProfile(readStoredUserProfile());
      }
    };

    window.addEventListener(PROFILE_EVENT, handleProfileEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT, handleProfileEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
  useEffect(() => {
    if (!isAuthenticated) {
      setPreferencesLoaded(false);
      return;
    }
    if (preferencesLoaded) {
      return;
    }

    let cancelled = false;
    const fetchPreferences = async () => {
      try {
        const response = await getUserPreferences();
        if (cancelled) {
          return;
        }
        const next = updateStoredUserProfile(
          mapPreferencesResponseToStoredProfile(response, profile.email ?? undefined)
        );
        setProfile(next);
        setPreferencesLoaded(true);
      } catch (err) {
        // Ignore preference fetch errors at layout level
      }
    };
        setPreferencesLoaded(true);

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, preferencesLoaded, profile.email]);

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

  const profileInitialSource =
    profile.nickname?.trim() || profile.email?.trim() || (isAuthenticated ? "U" : "G");
  const profileInitial = profileInitialSource ? profileInitialSource.charAt(0).toUpperCase() : "U";

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
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            NSW Fuel Finder
          </Typography>

          {/* Right side */}
          <Stack direction="row" spacing={2} alignItems="center">
            {!isAuthenticated ? (
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  setLoginError(null);
                  setLoginOpen(true);
                }}
                sx={{
                  fontWeight: 600,
                  color: theme.palette.getContrastText(theme.palette.secondary.main),
                  "&:hover": { bgcolor: theme.palette.secondary.dark },
                }}
              >
                Log In
              </Button>
            ) : (
              <>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" aria-label="user menu">
                  <Avatar
                    sx={{ width: 32, height: 32 }}
                    src={profile.avatarDataUrl || undefined}
                    alt={profile.nickname || profile.email || "User"}
                  >
                    {profileInitial}
                  </Avatar>
                </IconButton>
                <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
                  <MenuItem disabled>Logged In</MenuItem>
                  <MenuItem
                    onClick={() => {
                      setAnchorEl(null);
                      navigate("/profile");
                    }}
                  >
                    My Preference
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={async () => {
                      setAnchorEl(null);
                      clearStoredUserProfile();
                      setProfile({});
                      await logout();
                    }}
                  >
                    Log Out
                  </MenuItem>
                </Menu>
              </>
            )}
          </Stack>
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
          pt: 2,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {/* Login dialog connected to your API & AuthContext */}
      <LoginDialog
        open={loginOpen}
        onClose={() => (!busy ? setLoginOpen(false) : null)}
        errorText={loginError}
        busy={busy}
        onLogin={async ({ email, password, remember }) => {
          setLoginError(null);
          setBusy(true);
          try {
            const tokens = await loginUser({ email, password });
            if (setSessionWithRemember) {
              setSessionWithRemember(tokens, !!remember);
            } else {
              setSession(tokens);
            }
            const nextProfile = updateStoredUserProfile({ email: email.trim() });
            setProfile(nextProfile);
            setLoginOpen(false);
            notify("Logged in successfully.", "success");
          } catch (err) {
            setLoginError(extractErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        onRegister={async ({ email, password }) => {
          setLoginError(null);
          setBusy(true);
          try {
            await registerUser({ email, password });
            const tokens = await loginUser({ email, password });
            if (setSessionWithRemember) {
              // Remember newly registered users by default; adjust if needed.
              setSessionWithRemember(tokens, true);
            } else {
              setSession(tokens);
            }
            const nextProfile = updateStoredUserProfile({ email: email.trim() });
            setProfile(nextProfile);
            setLoginOpen(false);
            notify("Account created successfully.", "success");
          } catch (err) {
            setLoginError(extractErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        onGoogle={undefined}
      />
    </Box>
  );
}
