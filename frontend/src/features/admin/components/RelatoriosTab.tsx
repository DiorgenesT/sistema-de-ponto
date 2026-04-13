import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, subMonths, getDaysInMonth } from "date-fns";
import { api } from "@/shared/lib/api";
import { useAuthStore } from "@/store/auth";
import { useEmployees } from "../hooks/useEmployees";
import { cn } from "@/shared/lib/cn";
import { openEspelhoPDF } from "@/shared/lib/espelho-pdf";

// ─── AFD ─────────────────────────────────────────────────────────────────────

const afdSchema = z.object({
  start_date: z.string().min(1, "Data inicial obrigatória"),
  end_date:   z.string().min(1, "Data final obrigatória"),
}).refine(d => d.start_date <= d.end_date, {
  message: "Data inicial deve ser anterior à final",
  path: ["end_date"],
});

type AfdForm = z.infer<typeof afdSchema>;

function AfdSection({ companyId, isSuperAdmin }: { companyId: string; isSuperAdmin: boolean }) {
  const lastMonth = subMonths(new Date(), 1);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AfdForm>({
    resolver: zodResolver(afdSchema),
    defaultValues: {
      start_date: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
      end_date:   format(endOfMonth(lastMonth),   "yyyy-MM-dd"),
    },
  });

  async function onSubmit(form: AfdForm) {
    setFormError(null);
    setDownloadSuccess(false);
    try {
      const response = await api.get("/reports/afd/download", {
        params: { company_id: companyId, start_date: form.start_date, end_date: form.end_date },
        responseType: "blob",
      });
      const blob = new Blob([response.data as BlobPart], { type: "text/plain; charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
          <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">AFD — Arquivo Fonte de Dados</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Formato fixo conforme Portaria 671/2021, Anexo I. Obrigatório para fiscalização do MTE.
          </p>
          {!isSuperAdmin && (
            <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              Somente SUPER_ADMIN
            </span>
          )}
        </div>
      </div>

      {!isSuperAdmin ? (
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 ring-1 ring-gray-200">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Solicite ao Super Administrador para gerar o AFD.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Data inicial</label>
              <input type="date" {...register("start_date")}
                className={cn("block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                  errors.start_date ? "border-red-300 focus:ring-red-100" : "border-gray-200 focus:border-primary-400 focus:ring-primary-100")} />
              {errors.start_date && <p className="mt-1 text-xs text-red-600">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Data final</label>
              <input type="date" {...register("end_date")}
                className={cn("block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2",
                  errors.end_date ? "border-red-300 focus:ring-red-100" : "border-gray-200 focus:border-primary-400 focus:ring-primary-100")} />
              {errors.end_date && <p className="mt-1 text-xs text-red-600">{errors.end_date.message}</p>}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {formError}
            </div>
          )}

          {downloadSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              AFD gerado e baixado com sucesso.
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {isSubmitting ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Gerando…</>
            ) : (
              <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>Gerar e baixar AFD</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Espelho de Ponto ─────────────────────────────────────────────────────────

function EspelhoSection({ companyId, companyName, companyCnpj }: { companyId: string; companyName: string; companyCnpj: string }) {
  const today     = new Date();
  const lastMonth = subMonths(today, 1);

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [year,  setYear]  = useState(lastMonth.getFullYear());
  const [month, setMonth] = useState(lastMonth.getMonth() + 1); // 1-12
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: employeesData } = useEmployees(companyId);

  const MONTHS = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  const years = Array.from({ length: 3 }, (_, i) => today.getFullYear() - i);

  async function handleGenerate() {
    if (!selectedEmployee) { setError("Selecione um funcionário."); return; }
    setError(null);
    setLoading(true);
    try {
      const start = `${year}-${String(month).padStart(2,"0")}-01`;
      const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
      const end   = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;

      // Busca até 500 registros do período (mês tem no máximo ~90 marcações)
      const { data } = await api.get<{ items: { recorded_at: string; record_type: string }[]; total: number }>(
        "/admin/attendance",
        { params: { employee_id: selectedEmployee, start, end, page: 1, page_size: 500 } }
      );

      const emp = employeesData?.items.find(e => e.id === selectedEmployee);

      openEspelhoPDF({
        companyName,
        companyCnpj,
        employeeName: emp?.full_name ?? "Funcionário",
        employeeRegistration: emp?.registration_number ?? undefined,
        employeeDepartment: emp?.department ?? undefined,
        year,
        month,
        punches: data.items.map(r => ({
          recorded_at: r.recorded_at,
          record_type: r.record_type as "IN" | "OUT",
        })),
      });
    } catch {
      setError("Erro ao gerar o espelho. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Espelho de Ponto Mensal</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            PDF com todas as marcações do mês, totais e espaço para assinatura.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Funcionário */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Funcionário</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 py-2.5 pl-9 pr-8 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              <option value="">Selecione um funcionário…</option>
              {employeesData?.items.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Período */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Mês</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Ano</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <button onClick={() => void handleGenerate()} disabled={loading || !selectedEmployee}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors sm:w-auto">
          {loading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Gerando…</>
          ) : (
            <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>Gerar Espelho PDF</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RelatoriosTab() {
  const { employee: me } = useAuthStore();
  if (!me) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Relatórios e exportações</h2>
        <p className="mt-0.5 text-xs text-gray-500">Exportações para fins legais, auditoria e comprovantes</p>
      </div>

      <EspelhoSection
        companyId={me.companyId}
        companyName={me.companyName}
        companyCnpj={me.companyCnpj}
      />

      <AfdSection companyId={me.companyId} isSuperAdmin={me.role === "SUPER_ADMIN"} />
    </div>
  );
}
