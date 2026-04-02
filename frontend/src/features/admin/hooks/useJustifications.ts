import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Justification, JustificationStatus } from "../types";

export function usePendingJustifications() {
  return useQuery<Justification[]>({
    queryKey: ["admin", "justifications", "pending"],
    queryFn: async () => {
      const { data } = await api.get<Justification[]>("/justifications/pending");
      return data;
    },
  });
}

export function useReviewJustification() {
  const queryClient = useQueryClient();
  return useMutation<
    Justification,
    Error,
    { id: string; status: JustificationStatus; review_notes?: string }
  >({
    mutationFn: async ({ id, status, review_notes }) => {
      const { data } = await api.patch<Justification>(
        `/justifications/${id}/review`,
        { status, review_notes }
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "justifications"] });
    },
  });
}
