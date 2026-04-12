import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { format } from "date-fns";
import type { AdminAttendanceListResponse } from "../types";

interface UseAdminAttendanceParams {
  employeeId?: string;
  start?: Date;
  end?: Date;
  page?: number;
}

export function useAdminAttendance({ employeeId, start, end, page = 1 }: UseAdminAttendanceParams = {}) {
  return useQuery<AdminAttendanceListResponse>({
    queryKey: ["admin", "attendance", employeeId, start?.toISOString(), end?.toISOString(), page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 50 };
      if (employeeId) params.employee_id = employeeId;
      if (start) params.start = format(start, "yyyy-MM-dd");
      if (end) params.end = format(end, "yyyy-MM-dd");
      const { data } = await api.get<AdminAttendanceListResponse>("/admin/attendance", { params });
      return data;
    },
  });
}
