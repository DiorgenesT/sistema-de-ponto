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

export function RelatoriosTab() {
  const { employee: me } = useAuthStore();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const lastMonth = subMonths(new Date(), 1);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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
    setDownloadSuccess(false);
    try {
      const response = await api.get("/reports/afd/download", {
        params: {
          company_id: me.companyId,
          start_date: form.start_date,
          end_date: form.end_date,
        },
        responseType: "blob",
      });

      // Criar link de download automático
      const blob = new Blob([response.data as BlobPart], { type: "text/plain; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AFD_${form.start_date}_${form.end_date}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
    } catch {
      setFormError("Erro ao gerar o AFD. Verifique o período e tente novamente.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Relatórios e exportações</h2>
        <p className="mt-0.5 text-xs text-gray-500">Exportações para fins fiscais e de auditoria</p>
      </div>

      {/* AFD */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">AFD — Arquivo Fonte de Dados</h3>
            {!isSuperAdmin && (
              <span className="mt-0.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                Somente SUPER_ADMIN
              </span>
            )}
          </div>
        </div>
        <p className="mb-5 mt-2 text-sm text-gray-500">
          Exporta o arquivo AFD no formato exigido pela Portaria 671/2021, Anexo I.
          O download inicia automaticamente ao clicar em Gerar.
        </p>

        {!isSuperAdmin ? (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 ring-1 ring-gray-200">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
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
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                {formError}
              </div>
            )}

            {downloadSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                AFD gerado e baixado com sucesso.
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Gerando…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Gerar e baixar AFD
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Espelho de ponto */}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <svg className="mx-auto mb-2 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-sm font-medium text-gray-500">Espelho de ponto mensal</p>
        <p className="mt-1 text-xs text-gray-400">Em breve — exportação em PDF por funcionário</p>
      </div>
    </div>
  );
}
