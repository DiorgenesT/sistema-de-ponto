import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/cn";
import { useMyJustifications, useCreateJustification } from "../hooks/useMyJustifications";
import type { Justification, JustificationType } from "../types";

const JUSTIFICATION_TYPE_LABELS: Record<JustificationType, string> = {
  MANUAL_ADJUSTMENT: "Ajuste manual",
  MEDICAL_CERTIFICATE: "Atestado médico",
  ABSENCE: "Falta justificada",
  OTHER: "Outro",
};

const STATUS_CONFIG = {
  PENDING: { label: "Pendente", classes: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Aprovado", classes: "bg-green-50 text-green-700 ring-green-200" },
  REJECTED: { label: "Rejeitado", classes: "bg-red-50 text-red-700 ring-red-200" },
} as const;

const createSchema = z.object({
  justification_type: z.enum([
    "MANUAL_ADJUSTMENT",
    "MEDICAL_CERTIFICATE",
    "ABSENCE",
    "OTHER",
  ] as const),
  reference_date: z.string().min(1, "Data obrigatória"),
  description: z.string().min(10, "Mínimo 10 caracteres").max(1000, "Máximo 1000 caracteres"),
});

type CreateForm = z.infer<typeof createSchema>;

export function JustificationsTab() {
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading, isError } = useMyJustifications();
  const createMutation = useCreateJustification();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  async function onSubmit(formData: CreateForm) {
    await createMutation.mutateAsync({
      justification_type: formData.justification_type,
      reference_date: formData.reference_date,
      description: formData.description,
    });
    reset();
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Header + botão */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Solicite ajustes ou envie justificativas para aprovação do gestor.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {showForm ? "Cancelar" : "+ Nova solicitação"}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Nova solicitação</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  {...register("justification_type")}
                  className={cn(
                    "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.justification_type
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:ring-primary-200"
                  )}
                >
                  <option value="">Selecione o tipo</option>
                  {(Object.entries(JUSTIFICATION_TYPE_LABELS) as [JustificationType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
                {errors.justification_type && (
                  <p className="mt-1 text-xs text-red-600">{errors.justification_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data de referência</label>
                <input
                  type="date"
                  {...register("reference_date")}
                  className={cn(
                    "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.reference_date
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:ring-primary-200"
                  )}
                />
                {errors.reference_date && (
                  <p className="mt-1 text-xs text-red-600">{errors.reference_date.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea
                rows={3}
                {...register("description")}
                placeholder="Descreva o motivo da solicitação..."
                className={cn(
                  "mt-1 block w-full resize-none rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                  errors.description
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-primary-200"
                )}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            {createMutation.isError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                Erro ao enviar solicitação. Tente novamente.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { reset(); setShowForm(false); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Enviar solicitação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-500">
            Erro ao carregar justificativas.
          </div>
        )}

        {data && data.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhuma solicitação enviada ainda.
          </div>
        )}

        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Data ref.</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((j) => (
                <JustificationRow key={j.id} justification={j} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function JustificationRow({ justification: j }: { justification: Justification }) {
  const refDate = new Date(j.reference_date + "T12:00:00");
  const createdAt = new Date(j.created_at);
  const statusCfg = STATUS_CONFIG[j.status];

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-gray-700">
        {format(refDate, "dd/MM/yyyy", { locale: ptBR })}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {JUSTIFICATION_TYPE_LABELS[j.justification_type]}
      </td>
      <td className="max-w-xs px-4 py-3">
        <p className="truncate text-gray-600">{j.description}</p>
        {j.review_notes && (
          <p className="mt-0.5 truncate text-xs text-gray-400">Obs: {j.review_notes}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusCfg.classes}`}>
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500">
        {format(createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </td>
    </tr>
  );
}
