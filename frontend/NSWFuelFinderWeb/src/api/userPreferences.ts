// src/api/userPreferences.ts
import { apiClient } from "./client";

export type OverviewFilterSettingsDto = {
  enabled: boolean;
  selectAll: boolean;
  fuelTypes: string[];
  brandNames: string[];
  radiusKm: number;
};

export type UserPreferencesResponse = {
  defaultSuburb?: string | null;
  defaultRadiusKm?: number | null;
  preferredFuelTypes: string[];
  displayName?: string | null;
  avatarDataUrl?: string | null;
  overviewFilter?: OverviewFilterSettingsDto | null;
};

export type UpdatePreferencesRequest = {
  defaultSuburb?: string | null;
  defaultRadiusKm?: number | null;
  preferredFuelTypes?: string[] | null;
  displayName?: string | null;
  avatarDataUrl?: string | null;
  overviewFilter?: OverviewFilterSettingsDto | null;
};


export const getUserPreferences = async (accessToken?: string) => {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const { data } = await apiClient.get<UserPreferencesResponse>(
    "/api/users/me/preferences",
    { headers }
  );
  return data;
};


export const updateUserPreferences = async (
  payload: UpdatePreferencesRequest,
  accessToken?: string
) => {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const { data } = await apiClient.put<UserPreferencesResponse>(
    "/api/users/me/preferences",
    payload,
    { headers }
  );
  return data;
};
