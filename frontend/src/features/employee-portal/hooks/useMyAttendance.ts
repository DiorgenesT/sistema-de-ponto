import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "@/shared/lib/api";
import type { AttendanceListResponse } from "../types";

export function useMyAttendance(start: Date, end: Date) {
  return useQuery<AttendanceListResponse>({
    queryKey: ["attendance", "me", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await api.get<AttendanceListResponse>("/attendance/me", {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      return data;
    },
  });
}
