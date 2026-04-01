import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Justification, JustificationCreatePayload } from "../types";

export function useMyJustifications() {
  return useQuery<Justification[]>({
    queryKey: ["justifications", "me"],
    queryFn: async () => {
      const { data } = await api.get<Justification[]>("/justifications/me");
      return data;
    },
  });
}

export function useCreateJustification() {
  const queryClient = useQueryClient();

  return useMutation<Justification, Error, JustificationCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Justification>("/justifications", payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["justifications", "me"] });
    },
  });
}
