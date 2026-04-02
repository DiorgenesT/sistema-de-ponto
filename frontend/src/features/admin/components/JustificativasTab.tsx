import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePendingJustifications, useReviewJustification } from "../hooks/useJustifications";
import type { Justification, JustificationType } from "../types";

const TYPE_LABELS: Record<JustificationType, string> = {
  MANUAL_ADJUSTMENT: "Ajuste manual",
  MEDICAL_CERTIFICATE: "Atestado médico",
  ABSENCE: "Falta",
  OTHER: "Outro",
};

export function JustificativasTab() {
  const { data, isLoading, isError } = usePendingJustifications();
  const reviewMutation = useReviewJustification();
  const [reviewing, setReviewing] = useState<{ id: string; action: "APPROVED" | "REJECTED" } | null>(null);
  const [notes, setNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview() {
    if (!reviewing) return;
    setReviewError(null);
    try {
      await reviewMutation.mutateAsync({
        id: reviewing.id,
        status: reviewing.action,
        review_notes: notes.trim() || undefined,
      });
      setReviewing(null);
      setNotes("");
    } catch {
      setReviewError("Erro ao revisar justificativa. Tente novamente.");
    }
  }

  function startReview(id: string, action: "APPROVED" | "REJECTED") {
    setReviewing({ id, action });
    setNotes("");
    setReviewError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Justificativas pendentes</h2>
        {data && data.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {data.length} pendente{data.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Modal de revisão */}
      {reviewing && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            {reviewing.action === "APPROVED" ? "Aprovar" : "Rejeitar"} justificativa
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            Observações{reviewing.action === "REJECTED" ? " (obrigatório ao rejeitar)" : " (opcional)"}:
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Digite suas observações aqui…"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          {reviewError && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {reviewError}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => { setReviewing(null); setNotes(""); }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleReview}
              disabled={reviewMutation.isPending || (reviewing.action === "REJECTED" && !notes.trim())}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                reviewing.action === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {reviewMutation.isPending
                ? "Salvando…"
                : reviewing.action === "APPROVED"
                ? "Aprovar"
                : "Rejeitar"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}
        {isError && (
          <div className="py-12 text-center text-sm text-red-500">Erro ao carregar justificativas.</div>
        )}
        {data && data.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhuma justificativa pendente. Tudo em dia!
          </div>
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data de referência</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Solicitado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((j) => (
                <JustificationRow
                  key={j.id}
                  justification={j}
                  isBeingReviewed={reviewing?.id === j.id}
                  onApprove={() => startReview(j.id, "APPROVED")}
                  onReject={() => startReview(j.id, "REJECTED")}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function JustificationRow({
  justification: j,
  isBeingReviewed,
  onApprove,
  onReject,
}: {
  justification: Justification;
  isBeingReviewed: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <tr className={`transition-colors ${isBeingReviewed ? "bg-primary-50" : "hover:bg-gray-50/50"}`}>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">
        {j.employee_id.slice(0, 8)}…
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          {TYPE_LABELS[j.justification_type]}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700">
        {format(new Date(j.reference_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
      </td>
      <td className="max-w-xs px-4 py-3 text-gray-600">
        <span className="line-clamp-2">{j.description}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {format(new Date(j.created_at), "dd/MM HH:mm", { locale: ptBR })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onApprove}
            className="rounded px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            Aprovar
          </button>
          <button
            onClick={onReject}
            className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Rejeitar
          </button>
        </div>
      </td>
    </tr>
  );
}
