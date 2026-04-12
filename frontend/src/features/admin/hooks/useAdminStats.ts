import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { AdminStats } from "../types";

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get<AdminStats>("/admin/stats");
      return data;
    },
    refetchInterval: 60_000, // atualizar a cada minuto
  });
}
