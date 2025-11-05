import type { UserPreferencesResponse } from "../api/userPreferences";
import { DEFAULT_OVERVIEW_RADIUS_KM } from "../constants/overviewFilters";

export type OverviewFilterPreference = {
  enabled: boolean;
  selectAll?: boolean;
  fuelTypes?: string[];
  brandShortcutIds?: string[];
  brandNames?: string[];
  radiusKm?: number;
};

export type StoredUserProfile = {
  email?: string;
  nickname?: string;
  avatarDataUrl?: string;
  overviewFilterPreference?: OverviewFilterPreference;
};

export const PROFILE_STORAGE_KEY = "nswff_user_profile";
export const PROFILE_EVENT = "nswff_profile_updated";

const isBrowser = typeof window !== "undefined";

const safeParse = (raw: string | null): StoredUserProfile => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StoredUserProfile;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const dispatchProfileEvent = (profile: StoredUserProfile) => {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: profile }));
};

export const readStoredUserProfile = (): StoredUserProfile => {
  if (!isBrowser) return {};
  return safeParse(window.localStorage.getItem(PROFILE_STORAGE_KEY));
};

const writeStoredUserProfile = (profile: StoredUserProfile) => {
  if (!isBrowser) return;
  const cleaned: StoredUserProfile = {};

  Object.entries(profile).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim() === "") return;
    (cleaned as Record<string, unknown>)[key] = value;
  });

  if (Object.keys(cleaned).length === 0) {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    dispatchProfileEvent({});
    return;
  }

  const serialized = JSON.stringify(cleaned);
  window.localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
  dispatchProfileEvent(cleaned);
};

export const updateStoredUserProfile = (patch: StoredUserProfile): StoredUserProfile => {
  if (!isBrowser) return {};
  const current = readStoredUserProfile();
  const next: StoredUserProfile = { ...current };

  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      delete next[key as keyof StoredUserProfile];
    } else if (typeof value === "string" && value.trim() === "") {
      delete next[key as keyof StoredUserProfile];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  });

  writeStoredUserProfile(next);
  return next;
};

export const mapPreferencesResponseToStoredProfile = (
  response: UserPreferencesResponse,
  email?: string | null
): StoredUserProfile => {
  const overview = response.overviewFilter;
  const overviewPreference: OverviewFilterPreference = overview
    ? {
        enabled: overview.enabled,
        selectAll: overview.selectAll,
        fuelTypes: overview.selectAll ? [] : overview.fuelTypes ?? [],
        brandNames: overview.brandNames ?? [],
        radiusKm:
          typeof overview.radiusKm === "number" && Number.isFinite(overview.radiusKm)
            ? overview.radiusKm
            : DEFAULT_OVERVIEW_RADIUS_KM,
      }
    : {
        enabled: false,
        selectAll: true,
        fuelTypes: [],
        brandNames: [],
        radiusKm: DEFAULT_OVERVIEW_RADIUS_KM,
      };

  return {
    email: email ?? undefined,
    nickname: response.displayName ?? undefined,
    avatarDataUrl: response.avatarDataUrl ?? undefined,
    overviewFilterPreference: overviewPreference,
  };
};

export const clearStoredUserProfile = () => {
  if (!isBrowser) return;
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  dispatchProfileEvent({});
};
