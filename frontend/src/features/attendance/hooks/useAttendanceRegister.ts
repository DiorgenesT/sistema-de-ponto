import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { AttendanceResponse } from "../types";

interface RegisterPayload {
  image_b64: string;
  terminal_code?: string;
  device_fingerprint?: string;
}

export function useAttendanceRegister() {
  return useMutation<AttendanceResponse, Error, RegisterPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<AttendanceResponse>("/attendance", payload);
      return data;
    },
  });
}
