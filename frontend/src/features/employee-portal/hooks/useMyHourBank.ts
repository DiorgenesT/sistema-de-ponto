import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "@/shared/lib/api";
import type { HourBankSummary } from "../types";

export function useMyHourBank(start: Date, end: Date) {
  return useQuery<HourBankSummary>({
    queryKey: ["hour-bank", "me", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await api.get<HourBankSummary>("/hour-bank/me", {
        params: {
          start: format(start, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
        },
      });
      return data;
    },
  });
}
