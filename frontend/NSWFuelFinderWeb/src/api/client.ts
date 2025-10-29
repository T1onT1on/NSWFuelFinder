import axios from "axios";

type ApiClientOptions = {
  token?: string;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7122";

export const createApiClient = ({ token }: ApiClientOptions = {}) => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
  });

  if (token) {
    instance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  return instance;
};

export const apiClient = createApiClient();
