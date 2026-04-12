import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { format } from "date-fns";
import type { HourBankSummary } from "@/features/employee-portal/types";

export function useAdminHourBank(employeeId: string, start: Date, end: Date) {
  return useQuery<HourBankSummary>({
    queryKey: ["admin", "hour-bank", employeeId, format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await api.get<HourBankSummary>(`/hour-bank/${employeeId}`, {
        params: {
          start: format(start, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
        },
      });
      return data;
    },
    enabled: !!employeeId,
  });
}
