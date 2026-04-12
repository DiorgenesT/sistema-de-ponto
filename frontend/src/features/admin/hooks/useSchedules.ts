import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export interface WorkSchedule {
  id: string;
  name: string;
  schedule_type: "FIXED" | "VARIABLE" | "12X36";
  default_start: string | null;
  default_end: string | null;
  daily_minutes: number;
  is_active: boolean;
}

export function useSchedules() {
  return useQuery<WorkSchedule[]>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const { data } = await api.get<WorkSchedule[]>("/schedules");
      return data;
    },
  });
}
