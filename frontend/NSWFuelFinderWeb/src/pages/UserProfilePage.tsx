import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
  FormControlLabel,
  Switch,
  Autocomplete,
  Chip,
} from "@mui/material";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  readStoredUserProfile,
  updateStoredUserProfile,
  PROFILE_EVENT,
  PROFILE_STORAGE_KEY,
  mapPreferencesResponseToStoredProfile,
  type StoredUserProfile,
} from "../utils/userProfileStorage";
import { useNotify } from "../components/feedback/NotifyProvider";
import ChangePasswordDialog from "../components/ui/ChangePasswordDialog";
import FuelFilterChips from "../components/ui/FuelFilterChips";
import {
  DEFAULT_OVERVIEW_RADIUS_KM,
  OVERVIEW_BRAND_SHORTCUTS,
} from "../constants/overviewFilters";
import {
  getUserPreferences,
  updateUserPreferences,
  type UpdatePreferencesRequest as UpdatePreferencesRequestDto,
  type UserPreferencesResponse,
} from "../api/userPreferences";

const BRAND_SHORTCUT_LOOKUP = new Map<string, string[]>(
  OVERVIEW_BRAND_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.brands])
);


type OverviewSnapshot = {
  enabled: boolean;
  selectAll: boolean;
  fuelTypes: string[];
  brandNames: string[];
  radiusKm: number;
};

const canonicalizeFuelTypes = (values: readonly string[]) =>
  Array.from(new Set(values.map((value) => value.toUpperCase()))).sort();

const canonicalizeBrandNames = (values: readonly string[]) =>
  Array.from(new Set(values.map((value) => value.trim().toUpperCase()))).sort();

const arraysShallowEqual = (a: readonly string[], b: readonly string[]) => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const sanitizeBrandNames = (names: readonly string[]) =>
  Array.from(new Set(names.map((name) => name.trim()).filter((name) => name.length > 0)));

const sanitizeFuelTypes = (values: readonly string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

export default function UserProfilePage() {
  const { isAuthenticated } = useAuth();
  const { notify } = useNotify();

  const [storedProfile, setStoredProfile] = useState<StoredUserProfile>(() => readStoredUserProfile());
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [overviewFilterEnabled, setOverviewFilterEnabled] = useState(false);
  const [overviewFilterSelectAll, setOverviewFilterSelectAll] = useState(true);
  const [overviewFilterFuelTypes, setOverviewFilterFuelTypes] = useState<string[]>([]);
  const [overviewFilterBrandNames, setOverviewFilterBrandNames] = useState<string[]>([]);
  const [overviewFilterRadiusKm, setOverviewFilterRadiusKm] =
    useState<number>(DEFAULT_OVERVIEW_RADIUS_KM);
  const [overviewFilterRadiusInput, setOverviewFilterRadiusInput] = useState<string>(
    DEFAULT_OVERVIEW_RADIUS_KM.toString()
  );
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogBusy, setPasswordDialogBusy] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<{ nickname: string; avatarDataUrl: string | null }>({
    nickname: "",
    avatarDataUrl: null,
  });
  const [overviewBaseline, setOverviewBaseline] = useState<OverviewSnapshot>({
    enabled: false,
    selectAll: true,
    fuelTypes: [],
    brandNames: [],
    radiusKm: DEFAULT_OVERVIEW_RADIUS_KM,
  });
  const [hasFetchedPreferences, setHasFetchedPreferences] = useState(() => Boolean(storedProfile.overviewFilterPreference));
  const [isFetchingPreferences, setIsFetchingPreferences] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingOverview, setIsSavingOverview] = useState(false);

  const suggestedBrandOptions = useMemo(
    () =>
      Array.from(
        new Set<string>([
          ...overviewFilterBrandNames,
          ...OVERVIEW_BRAND_SHORTCUTS.flatMap((shortcut) => shortcut.brands ?? []),
        ])
      ),
    [overviewFilterBrandNames]
  );
  const profileDirty = useMemo(
    () => nickname !== profileBaseline.nickname || avatarDataUrl !== profileBaseline.avatarDataUrl,
    [avatarDataUrl, nickname, profileBaseline]
  );
  const currentOverviewSnapshot = useMemo<OverviewSnapshot>(
    () => ({
      enabled: overviewFilterEnabled,
      selectAll: overviewFilterSelectAll,
      fuelTypes: canonicalizeFuelTypes(overviewFilterFuelTypes),
      brandNames: canonicalizeBrandNames(overviewFilterBrandNames),
      radiusKm: overviewFilterRadiusKm,
    }),
    [
      overviewFilterBrandNames,
      overviewFilterEnabled,
      overviewFilterFuelTypes,
      overviewFilterRadiusKm,
      overviewFilterSelectAll,
    ]
  );
  const overviewDirty = useMemo(
    () =>
      currentOverviewSnapshot.enabled !== overviewBaseline.enabled ||
      currentOverviewSnapshot.selectAll !== overviewBaseline.selectAll ||
      currentOverviewSnapshot.radiusKm !== overviewBaseline.radiusKm ||
      !arraysShallowEqual(currentOverviewSnapshot.fuelTypes, overviewBaseline.fuelTypes) ||
      !arraysShallowEqual(currentOverviewSnapshot.brandNames, overviewBaseline.brandNames),
    [currentOverviewSnapshot, overviewBaseline]
  );

  const syncFromProfile = useCallback((profile: StoredUserProfile) => {
    const nextNickname = profile.nickname ?? "";
    const nextAvatar = profile.avatarDataUrl ?? null;
    setNickname(nextNickname);
    setEmail(profile.email ?? "");
    setAvatarDataUrl(nextAvatar);
    setProfileBaseline({ nickname: nextNickname, avatarDataUrl: nextAvatar });

    const pref = profile.overviewFilterPreference;
    if (pref) {
      const enabled = pref.enabled ?? false;
      setOverviewFilterEnabled(enabled);
      const nextSelectAll =
        pref.selectAll !== undefined
          ? pref.selectAll
          : !(pref.fuelTypes && pref.fuelTypes.length > 0);
      setOverviewFilterSelectAll(nextSelectAll);
      const nextFuelTypes = pref.fuelTypes ?? [];
      setOverviewFilterFuelTypes(nextFuelTypes);

      let normalizedBrands =
        pref.brandNames && pref.brandNames.length > 0
          ? Array.from(new Set<string>(pref.brandNames.map((name) => name.trim()).filter(Boolean)))
          : [];

      if (normalizedBrands.length === 0 && pref.brandShortcutIds) {
        const collected = new Set<string>();
        pref.brandShortcutIds.forEach((id) => {
          (BRAND_SHORTCUT_LOOKUP.get(id) ?? []).forEach((brand) => collected.add(brand));
        });
        if (collected.size > 0) {
          normalizedBrands = Array.from(collected);
        }
      }

      setOverviewFilterBrandNames(normalizedBrands);

      const resolvedRadius =
        typeof pref.radiusKm === "number" && pref.radiusKm > 0
          ? pref.radiusKm
          : DEFAULT_OVERVIEW_RADIUS_KM;
      setOverviewFilterRadiusKm(resolvedRadius);
      setOverviewFilterRadiusInput(resolvedRadius.toString());

      setOverviewBaseline({
        enabled,
        selectAll: nextSelectAll,
        fuelTypes: canonicalizeFuelTypes(nextFuelTypes),
        brandNames: canonicalizeBrandNames(normalizedBrands),
        radiusKm: resolvedRadius,
      });
    } else {
      setOverviewFilterEnabled(false);
      setOverviewFilterSelectAll(true);
      setOverviewFilterFuelTypes([]);
      setOverviewFilterBrandNames([]);
      setOverviewFilterRadiusKm(DEFAULT_OVERVIEW_RADIUS_KM);
      setOverviewFilterRadiusInput(DEFAULT_OVERVIEW_RADIUS_KM.toString());
      setOverviewBaseline({
        enabled: false,
        selectAll: true,
        fuelTypes: [],
        brandNames: [],
        radiusKm: DEFAULT_OVERVIEW_RADIUS_KM,
      });
    }
  }, []);
  useEffect(() => {
    if (!isAuthenticated) {
      setHasFetchedPreferences(false);
      return;
    }
    if (hasFetchedPreferences) {
      return;
    }

    let cancelled = false;
    const fetchPreferences = async () => {
      setIsFetchingPreferences(true);
      try {
        const response = await getUserPreferences();
        if (cancelled) {
          return;
        }
        const baseEmail = storedProfile.email ?? email;
        const mapped = mapPreferencesResponseToStoredProfile(response, baseEmail);
        const next = updateStoredUserProfile(mapped);
        setStoredProfile(next);
        setHasFetchedPreferences(true);
      } catch (err) {
        if (!cancelled) {
          notify("Unable to load profile preferences. Please try again later.", "error");
        }
          setHasFetchedPreferences(true);
      } finally {
        if (!cancelled) {
          setIsFetchingPreferences(false);
        }
      }
    };

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [email, hasFetchedPreferences, isAuthenticated, notify, storedProfile.email]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasFetchedPreferences(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    syncFromProfile(storedProfile);
  }, [storedProfile, syncFromProfile]);

  useEffect(() => {
    const handleProfileEvent = (event: Event) => {
      const custom = event as CustomEvent<StoredUserProfile>;
      setStoredProfile(custom.detail ?? {});
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY) {
        setStoredProfile(readStoredUserProfile());
      }
    };
    window.addEventListener(PROFILE_EVENT, handleProfileEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT, handleProfileEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const avatarLabel = useMemo(() => {
    const source = (nickname || email || "U").trim();
    return source ? source.charAt(0).toUpperCase() : "U";
  }, [nickname, email]);

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file for your avatar.", "warning");
      event.target.value = "";
      return;
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE_BYTES) {
      notify("Avatar file must be smaller than 2MB.", "warning");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAvatarDataUrl(result);
        notify("Avatar updated. Click Save Profile to apply.", "info");
      } else {
        notify("Unable to read the selected file. Please try again.", "error");
      }
    };
    reader.onerror = () => {
      notify("An error occurred while reading the file. Please try again.", "error");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleAvatarRemove = () => {
    setAvatarDataUrl(null);
    notify("Avatar removed. Click Save Profile to apply.", "info");
  };

  const applyServerPreferences = useCallback(
    (response: UserPreferencesResponse) => {
      const baseEmail = storedProfile.email ?? email;
      const mapped = mapPreferencesResponseToStoredProfile(response, baseEmail);
      const nextProfile = updateStoredUserProfile(mapped);
      setStoredProfile(nextProfile);
      return nextProfile;
    },
    [email, storedProfile.email]
  );

  const buildUpdatePayload = useCallback((): { payload: UpdatePreferencesRequestDto; radius: number } => {
    const trimmedNickname = nickname.trim();
    const sanitizedFuelTypes = overviewFilterSelectAll ? [] : sanitizeFuelTypes(overviewFilterFuelTypes);
    const sanitizedBrands = sanitizeBrandNames(overviewFilterBrandNames);

    let radius = overviewFilterRadiusKm;
    if (!Number.isFinite(radius) || radius <= 0) {
      radius = DEFAULT_OVERVIEW_RADIUS_KM;
    }
    radius = Math.min(50, Math.max(1, radius));

    const payload: UpdatePreferencesRequestDto = {
      displayName: trimmedNickname.length > 0 ? trimmedNickname : null,
      avatarDataUrl: avatarDataUrl ?? null,
      defaultSuburb: null,
      defaultRadiusKm: radius,
      preferredFuelTypes: sanitizedFuelTypes,
      overviewFilter: {
        enabled: overviewFilterEnabled,
        selectAll: overviewFilterSelectAll,
        fuelTypes: sanitizedFuelTypes,
        brandNames: sanitizedBrands,
        radiusKm: radius,
      },
    };
    return { payload, radius };
  }, [
    avatarDataUrl,
    nickname,
    overviewFilterBrandNames,
    overviewFilterEnabled,
    overviewFilterFuelTypes,
    overviewFilterRadiusKm,
    overviewFilterSelectAll,
  ]);

  const handleProfileSave = async () => {
    if (!profileDirty || !isAuthenticated) {
      if (!isAuthenticated) {
        notify("Please log in to update your profile.", "warning");
      }
      return;
    }
    try {
      setIsSavingProfile(true);
      const { payload, radius } = buildUpdatePayload();
      setOverviewFilterRadiusKm(radius);
      setOverviewFilterRadiusInput(radius.toString());
      const response = await updateUserPreferences(payload);
      applyServerPreferences(response);
      notify("Profile Updated", "success");
    } catch (err) {
      notify("Failed to update profile. Please try again.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOverviewFilterSave = async () => {
    if (!overviewDirty || !isAuthenticated) {
      if (!isAuthenticated) {
        notify("Please log in to update your preferences.", "warning");
      }
      return;
    }
    try {
      setIsSavingOverview(true);
      const { payload, radius } = buildUpdatePayload();
      setOverviewFilterRadiusKm(radius);
      setOverviewFilterRadiusInput(radius.toString());
      const response = await updateUserPreferences(payload);
      applyServerPreferences(response);
      notify("Customized Filter Updated", "success");
    } catch (err) {
      notify("Failed to update customized filter. Please try again.", "error");
    } finally {
      setIsSavingOverview(false);
    }
  };

  const handlePasswordSubmit = async ({
    currentPassword: _currentPassword,
    newPassword: _newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  }) => {
    setPasswordDialogError(null);
    setPasswordDialogBusy(true);
    try {
      // TODO: Integrate with backend password update endpoint.
      notify("Password update will be available soon.", "info");
      setPasswordDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordDialogError(message);
    } finally {
      setPasswordDialogBusy(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4, pb: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            My Preference
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your personal details and default experience settings.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                  <Avatar
                    sx={{ width: 72, height: 72, fontSize: 32, cursor: "pointer" }}
                    src={avatarDataUrl ?? undefined}
                    alt={nickname || email || "User avatar"}
                    onClick={handleAvatarPick}
                  >
                    {avatarLabel}
                  </Avatar>
                  <Button variant="text" size="small" onClick={handleAvatarPick}>
                    Change Avatar
                  </Button>
                  {avatarDataUrl && (
                    <Button variant="text" size="small" color="secondary" onClick={handleAvatarRemove}>
                      Remove Avatar
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarSelected}
                  />
                </Box>
                <Box flex={1}>
                  <Typography variant="h6" fontWeight={600}>
                    My Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Update your personal details, including nickname and avatar, to customise how you appear.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Nickname"
                  placeholder="Optional"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Email"
                  value={email || "Not available"}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={{
                    "& .MuiInputBase-input.Mui-readOnly": {
                      cursor: "default",
                    },
                  }}
                />
              </Stack>

              <Box>
                <Button
                  variant="contained"
                  onClick={handleProfileSave}
                  disabled={!profileDirty || isSavingProfile || isFetchingPreferences}
                >
                  Save Profile
                </Button>
              </Box>

              <Divider />

              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Password
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Change your password to keep your account secure.
                </Typography>
                <Box>
                  <Button variant="outlined" onClick={() => setPasswordDialogOpen(true)}>
                    Change Password
                  </Button>
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Overview Page Customized Filter
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose default filters that will be applied to the Overview page whenever you sign in.
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={overviewFilterEnabled}
                      onChange={(event) => setOverviewFilterEnabled(event.target.checked)}
                      color="primary"
                    />
                  }
                  label={overviewFilterEnabled ? "Enabled" : "Disabled"}
                  sx={{ m: 0 }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <FuelFilterChips
                  value={overviewFilterFuelTypes}
                  selectAll={overviewFilterSelectAll}
                  onChange={setOverviewFilterFuelTypes}
                  onSelectAllChange={setOverviewFilterSelectAll}
                  disabled={!overviewFilterEnabled}
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={suggestedBrandOptions}
                  value={overviewFilterBrandNames}
                  onChange={(_, newValue) => {
                    const cleaned = Array.from(
                      new Set<string>(newValue.map((name) => name.trim()).filter(Boolean))
                    );
                    setOverviewFilterBrandNames(cleaned);
                  }}
                  disabled={!overviewFilterEnabled}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={`${option}-${index}`} label={option} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Brands"
                      placeholder="e.g. Shell"
                    />
                  )}
                  filterSelectedOptions
                />
                <TextField
                  label="Distance (km)"
                  type="number"
                  size="small"
                  value={overviewFilterRadiusInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOverviewFilterRadiusInput(value);
                    const parsed = Number(value);
                    if (Number.isFinite(parsed)) {
                      const sanitized = Math.max(1, Math.min(50, Math.round(parsed)));
                      setOverviewFilterRadiusKm(sanitized);
                    }
                  }}
                  onBlur={() => {
                    if (
                      overviewFilterRadiusInput === "" ||
                      !Number.isFinite(Number(overviewFilterRadiusInput))
                    ) {
                      setOverviewFilterRadiusKm(DEFAULT_OVERVIEW_RADIUS_KM);
                      setOverviewFilterRadiusInput(DEFAULT_OVERVIEW_RADIUS_KM.toString());
                    }
                  }}
                  disabled={!overviewFilterEnabled}
                  inputProps={{ min: 1, max: 50, step: 1 }}
                  sx={{ maxWidth: 200 }}
                  helperText="Used when applying filters that rely on distance, such as nearby searches."
                />
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="contained"
                    onClick={handleOverviewFilterSave}
                    disabled={!overviewDirty || isSavingOverview || isFetchingPreferences}
                  >
                    Save Customized Filter
                  </Button>
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        busy={passwordDialogBusy}
        errorText={passwordDialogError}
        onClose={() => {
          if (!passwordDialogBusy) {
            setPasswordDialogError(null);
            setPasswordDialogOpen(false);
          }
        }}
        onSubmit={handlePasswordSubmit}
      />
    </Container>
  );
}








