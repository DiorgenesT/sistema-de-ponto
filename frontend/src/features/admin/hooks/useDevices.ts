import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Device, DeviceCreatePayload, DeviceOnboardResponse } from "../types";

export function useDevices() {
  return useQuery<Device[]>({
    queryKey: ["admin", "devices"],
    queryFn: async () => {
      const { data } = await api.get<Device[]>("/devices");
      return data;
    },
  });
}

export function useOnboardDevice() {
  const queryClient = useQueryClient();
  return useMutation<DeviceOnboardResponse, Error, DeviceCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<DeviceOnboardResponse>("/devices", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "devices"] });
    },
  });
}

export function useDeactivateDevice() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (deviceId) => {
      await api.delete(`/devices/${deviceId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "devices"] });
    },
  });
}
