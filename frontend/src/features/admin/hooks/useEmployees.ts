import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Employee, EmployeeCreatePayload, EmployeeListResponse } from "../types";

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

export function useEnrollFace() {
  return useMutation<{ enrolled: boolean }, Error, { employeeId: string; image_b64: string }>({
    mutationFn: async ({ employeeId, image_b64 }) => {
      const { data } = await api.post(`/employees/${employeeId}/enroll-face`, { image_b64 });
      return data;
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
