import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { api } from "@/shared/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";

const afdSchema = z.object({
  start_date: z.string().min(1, "Data inicial obrigatória"),
  end_date: z.string().min(1, "Data final obrigatória"),
}).refine((d) => d.start_date <= d.end_date, {
  message: "Data inicial deve ser anterior à final",
  path: ["end_date"],
});

type AfdForm = z.infer<typeof afdSchema>;

interface AfdTaskResponse {
  task_id: string;
  status: string;
  message: string;
}

interface AfdStatusResponse {
  task_id: string;
  status: string;
  result: unknown;
}

export function RelatoriosTab() {
  const { employee: me } = useAuthStore();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const lastMonth = subMonths(new Date(), 1);
  const [taskInfo, setTaskInfo] = useState<AfdTaskResponse | null>(null);
  const [taskStatus, setTaskStatus] = useState<AfdStatusResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AfdForm>({
    resolver: zodResolver(afdSchema),
    defaultValues: {
      start_date: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
      end_date: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
    },
  });

  async function onSubmit(form: AfdForm) {
    if (!me) return;
    setFormError(null);
    setTaskInfo(null);
    setTaskStatus(null);
    try {
      const { data } = await api.post<AfdTaskResponse>("/reports/afd", null, {
        params: {
          company_id: me.companyId,
          start_date: form.start_date,
          end_date: form.end_date,
        },
      });
      setTaskInfo(data);
      void pollStatus(data.task_id);
    } catch {
      setFormError("Erro ao solicitar geração do AFD.");
    }
  }

  async function pollStatus(taskId: string) {
    setPolling(true);
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const { data } = await api.get<AfdStatusResponse>(`/reports/afd/status/${taskId}`);
        setTaskStatus(data);
        if (data.status === "SUCCESS" || data.status === "FAILURE") {
          setPolling(false);
          return;
        }
      } catch {
        setPolling(false);
        return;
      }
    }
    setPolling(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-800">Relatórios e exportações</h2>

      {/* AFD */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">AFD — Arquivo Fonte de Dados</h3>
          {!isSuperAdmin && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              Somente SUPER_ADMIN
            </span>
          )}
        </div>
        <p className="mb-5 text-sm text-gray-500">
          Exporta o arquivo AFD no formato exigido pela Portaria 671/2021. Processamento assíncrono
          — o arquivo será salvo no Supabase Storage ao concluir.
        </p>

        {!isSuperAdmin ? (
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 ring-1 ring-gray-200">
            Você não tem permissão para gerar o AFD. Solicite a um Super Administrador.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Data inicial</label>
                <input
                  type="date"
                  {...register("start_date")}
                  className={cn(
                    "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.start_date
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                  )}
                />
                {errors.start_date && (
                  <p className="mt-1 text-xs text-red-600">{errors.start_date.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Data final</label>
                <input
                  type="date"
                  {...register("end_date")}
                  className={cn(
                    "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
                    errors.end_date
                      ? "border-red-300 focus:ring-red-200"
                      : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                  )}
                />
                {errors.end_date && (
                  <p className="mt-1 text-xs text-red-600">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {formError}
              </div>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting || polling}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {isSubmitting ? "Solicitando…" : "Gerar AFD"}
              </button>

              {polling && (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  Aguardando processamento…
                </span>
              )}
            </div>

            {taskInfo && (
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm ring-1 ring-blue-200">
                <p className="font-medium text-blue-800">Tarefa enfileirada</p>
                <p className="mt-0.5 font-mono text-xs text-blue-600">ID: {taskInfo.task_id}</p>
                <p className="mt-1 text-blue-700">{taskInfo.message}</p>
              </div>
            )}

            {taskStatus && (
              <div
                className={cn(
                  "rounded-lg px-4 py-3 text-sm ring-1",
                  taskStatus.status === "SUCCESS"
                    ? "bg-green-50 text-green-800 ring-green-200"
                    : taskStatus.status === "FAILURE"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-gray-50 text-gray-700 ring-gray-200"
                )}
              >
                <p className="font-medium">
                  Status:{" "}
                  {taskStatus.status === "SUCCESS"
                    ? "Concluído"
                    : taskStatus.status === "FAILURE"
                    ? "Falhou"
                    : taskStatus.status}
                </p>
                {taskStatus.status === "SUCCESS" && (
                  <p className="mt-1 text-sm">
                    AFD gerado com sucesso. Acesse o Supabase Storage para baixar o arquivo.
                  </p>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Espelho de ponto — placeholder para expansão futura */}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm font-medium text-gray-500">Espelho de ponto mensal</p>
        <p className="mt-1 text-xs text-gray-400">Em breve — exportação em PDF por funcionário</p>
      </div>
    </div>
  );
}
