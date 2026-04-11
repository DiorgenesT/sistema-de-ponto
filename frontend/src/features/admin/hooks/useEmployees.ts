import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Employee, EmployeeCreatePayload, EmployeeListResponse, FaceStatus } from "../types";

export function useEmployees(companyId: string, page = 1) {
  return useQuery<EmployeeListResponse>({
    queryKey: ["admin", "employees", companyId, page],
    queryFn: async () => {
      const { data } = await api.get<EmployeeListResponse>("/employees", {
        params: { page, page_size: 20 },
      });
      return data;
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<Employee, Error, EmployeeCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Employee>("/employees", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
    },
  });
}

export function useFaceStatus(employeeId: string) {
  return useQuery<FaceStatus>({
    queryKey: ["admin", "face-status", employeeId],
    queryFn: async () => {
      const { data } = await api.get<FaceStatus>(`/employees/${employeeId}/face-status`);
      return data;
    },
  });
}

export function useEnrollFace() {
  const queryClient = useQueryClient();
  return useMutation<{ enrolled: boolean }, Error, { employeeId: string; image_b64: string }>({
    mutationFn: async ({ employeeId, image_b64 }) => {
      const { data } = await api.post(`/employees/${employeeId}/enroll-face`, { image_b64 });
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "face-status", variables.employeeId] });
    },
  });
}

export function useDeleteFace() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (employeeId) => {
      await api.delete(`/employees/${employeeId}/face`);
    },
    onSuccess: (_data, employeeId) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "face-status", employeeId] });
    },
  });
}

export function useToggleEmployeeActive() {
  const queryClient = useQueryClient();
  return useMutation<Employee, Error, { id: string; is_active: boolean }>({
    mutationFn: async ({ id, is_active }) => {
      const { data } = await api.patch<Employee>(`/employees/${id}`, { is_active });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
    },
  });
}
