import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/shared/lib/api";

interface AuthState {
  accessToken: string | null;
  deviceToken: string | null;
  employee: {
    id: string;
    fullName: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
    companyId: string;
  } | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string) => void;
  setDeviceToken: (deviceToken: string) => void;
  setEmployee: (employee: AuthState["employee"]) => void;
  refreshTokens: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      accessToken: null,
      deviceToken: null,
      employee: null,
      isAuthenticated: false,

      setTokens: (accessToken) =>
        set({ accessToken, isAuthenticated: true }),

      setDeviceToken: (deviceToken) =>
        set({ deviceToken }),

      setEmployee: (employee) =>
        set({ employee }),

      refreshTokens: async () => {
        const response = await api.post<{ access_token: string }>(
          "/auth/refresh"
        );
        set({
          accessToken: response.data.access_token,
          isAuthenticated: true,
        });
      },

      logout: () =>
        set({
          accessToken: null,
          employee: null,
          isAuthenticated: false,
          // deviceToken é mantido — pertence à máquina, não ao usuário
        }),
    }),
    {
      name: "ponto-auth",
      // Persistir apenas o device token — access token não persiste por segurança
      partialize: (state) => ({ deviceToken: state.deviceToken }),
    }
  )
);
