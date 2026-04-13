import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export interface WorkSchedule {
  id: string;
  name: string;
  schedule_type: "FIXED" | "VARIABLE" | "12X36";
  default_start: string | null;
  default_end: string | null;
  daily_minutes: number;
  workdays_mask: number;
  description: string | null;
  is_active: boolean;
}

export interface WorkScheduleCreatePayload {
  company_id: string;
  name: string;
  schedule_type: "FIXED" | "VARIABLE" | "12X36";
  default_start?: string;
  default_end?: string;
  daily_minutes: number;
  workdays_mask?: number;
  description?: string;
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

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation<WorkSchedule, Error, WorkScheduleCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<WorkSchedule>("/schedules", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

export function useToggleScheduleActive() {
  const queryClient = useQueryClient();
  return useMutation<WorkSchedule, Error, { id: string; is_active: boolean }>({
    mutationFn: async ({ id, is_active }) => {
      const { data } = await api.patch<WorkSchedule>(`/schedules/${id}`, { is_active });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}
