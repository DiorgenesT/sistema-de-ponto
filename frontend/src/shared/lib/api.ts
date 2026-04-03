import axios, { type AxiosInstance, type AxiosError } from "axios";
import { useAuthStore } from "@/store/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ---- Request interceptor: injeta Authorization + X-Device-Token -----------
api.interceptors.request.use((config) => {
  const { accessToken, deviceToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (deviceToken) {
    config.headers["X-Device-Token"] = deviceToken;
  }
  return config;
});

// ---- Response interceptor: refresh token automático ----------------------
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      const { accessToken } = useAuthStore.getState();

      // Sem access token = terminal kiosk sem usuário logado.
      // O 401 é de device token inválido — não tentar refresh, só rejeitar.
      if (!accessToken) {
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        await useAuthStore.getState().refreshTokens();
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
