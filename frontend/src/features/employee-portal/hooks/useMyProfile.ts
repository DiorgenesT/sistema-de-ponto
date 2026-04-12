import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

interface FaceStatus {
  enrolled: boolean;
  enrolled_at?: string;
}

interface EmployeeMe {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  terminal_code: string | null;
  created_at: string;
}

export function useMyProfile() {
  return useQuery<EmployeeMe>({
    queryKey: ["employee", "me"],
    queryFn: async () => {
      const { data } = await api.get<EmployeeMe>("/employees/me");
      return data;
    },
  });
}

export function useMyFaceStatus() {
  return useQuery<FaceStatus>({
    queryKey: ["employee", "me", "face"],
    queryFn: async () => {
      const { data } = await api.get<FaceStatus>("/employees/me/face");
      return data;
    },
  });
}

export function useDeleteMyFace() {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: async () => {
      await api.delete("/employees/me/face");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["employee", "me", "face"] });
    },
  });
}
