import type { AxiosError } from "axios";
import { apiClient } from "./client";

export type RegisterPayload = {
  email: string;
  password: string;
};

export type LoginPayload = RegisterPayload;

export type AuthTokenResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshTokenExpiresAt: string;
};

export type RefreshPayload = {
  refreshTokenId: string;
  refreshToken: string;
};

export type LogoutPayload = {
  refreshTokenId: string;
};

export const registerUser = async (payload: RegisterPayload) => {
  await apiClient.post("/api/auth/register", payload);
};

export const loginUser = async (payload: LoginPayload) => {
  const { data } = await apiClient.post<AuthTokenResponse>("/api/auth/login", payload);
  return data;
};

export const refreshAuthToken = async (payload: RefreshPayload) => {
  const { data } = await apiClient.post<AuthTokenResponse>("/api/auth/refresh", payload);
  return data;
};

export const logoutUser = async (payload: LogoutPayload) => {
  await apiClient.post("/api/auth/logout", payload);
};

export const extractErrorMessage = (error: unknown): string => {
  if ((error as AxiosError)?.isAxiosError) {
    const axiosError = error as AxiosError<{ title?: string; detail?: string; errors?: string[] }>;
    const status = axiosError.response?.status;
    if (status === 401) {
      return "Invalid credentials, please try again.";
    }
    if (status === 409) {
      return "This email is already registered.";
    }
    const responseMessage =
      axiosError.response?.data?.detail ??
      axiosError.response?.data?.title ??
      axiosError.response?.data?.errors?.join(", ");
    if (responseMessage) {
      return responseMessage;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please try again.";
};
