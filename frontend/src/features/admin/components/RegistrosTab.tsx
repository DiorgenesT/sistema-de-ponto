import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/cn";
import { useAdminAttendance } from "../hooks/useAdminAttendance";
import { useEmployees } from "../hooks/useEmployees";
import { useAuthStore } from "@/store/auth";

const PAGE_SIZE = 50;

export function RegistrosTab() {
  const { employee: me } = useAuthStore();
  const today = new Date();

  const [start,      setStart]      = useState(() => startOfMonth(today));
  const [end,        setEnd]        = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [page,       setPage]       = useState(1);

  const { data, isLoading, isError } = useAdminAttendance({
    employeeId: employeeId || undefined,
    start, end, page,
  });

  const { data: employeesData } = useEmployees(me?.companyId ?? "");
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Registros de Ponto</h2>
        {data && (
          <p className="mt-0.5 text-xs text-gray-500">
            {data.total.toLocaleString("pt-BR")} {data.total === 1 ? "registro encontrado" : "registros encontrados"}
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">De</label>
            <input
              type="date"
              defaultValue={format(start, "yyyy-MM-dd")}
              onChange={e => { if (e.target.value) { setStart(new Date(e.target.value + "T00:00:00")); setPage(1); }}}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Até</label>
            <input
              type="date"
              defaultValue={format(end, "yyyy-MM-dd")}
              onChange={e => { if (e.target.value) { setEnd(new Date(e.target.value + "T23:59:59")); setPage(1); }}}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Funcionário</label>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <select
                value={employeeId}
                onChange={e => { setEmployeeId(e.target.value); setPage(1); }}
                className="w-full min-w-[200px] appearance-none rounded-xl border border-gray-200 py-2 pl-9 pr-8 text-sm text-gray-800 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="">Todos os funcionários</option>
                {employeesData?.items.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <svg className="h-8 w-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-red-500">Erro ao carregar registros.</p>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Nenhum registro no período</p>
              <p className="mt-0.5 text-xs text-gray-400">Tente ajustar os filtros acima.</p>
            </div>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Funcionário</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Hora</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Marcação</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Reconhecimento facial</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((record, idx) => {
                    const dt   = new Date(record.recorded_at);
                    const isIn = record.record_type === "IN";

                    // Linha separadora de dia
                    const prevRecord = idx > 0 ? data.items[idx - 1] : null;
                    const isNewDay   = !prevRecord || prevRecord.recorded_at.slice(0, 10) !== record.recorded_at.slice(0, 10);

                    return (
                      <>
                        {isNewDay && idx > 0 && (
                          <tr key={`sep-${record.id}`}>
                            <td colSpan={6} className="border-t-4 border-gray-50 p-0" />
                          </tr>
                        )}
                        <tr
                          key={record.id}
                          className={cn(
                            "border-b border-gray-50 transition-colors last:border-0",
                            isIn ? "hover:bg-green-50/30" : "hover:bg-blue-50/30"
                          )}
                        >
                          {/* Funcionário */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                                {(record.employee_name ?? "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
                              </div>
                              <span className="whitespace-nowrap font-medium text-gray-900">
                                {record.employee_name ?? "—"}
                              </span>
                            </div>
                          </td>

                          {/* Data */}
                          <td className="px-4 py-3 capitalize whitespace-nowrap text-gray-500 text-xs">
                            {format(dt, "EEE, dd/MM/yyyy", { locale: ptBR })}
                          </td>

                          {/* Hora */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold text-gray-900">{format(dt, "HH:mm")}</span>
                            <span className="font-mono text-xs text-gray-400">:{format(dt, "ss")}</span>
                          </td>

                          {/* Tipo */}
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                              isIn
                                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                                : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            )}>
                              {isIn ? (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
                                </svg>
                              ) : (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                </svg>
                              )}
                              {isIn ? "Entrada" : "Saída"}
                            </span>
                          </td>

                          {/* Reconhecimento facial */}
                          <td className="px-4 py-3">
                            <RecognitionBadge value={record.facial_confidence} />
                          </td>

                          {/* Origem */}
                          <td className="px-4 py-3">
                            {record.is_adjustment ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                </svg>
                                Ajuste manual
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                                <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                                </svg>
                                Biometria
                              </span>
                            )}
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all",
                          p === page
                            ? "bg-primary-600 text-white shadow-sm"
                            : "text-gray-500 hover:bg-white hover:shadow-sm"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                >
                  Próxima
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Badge de reconhecimento facial ─────────────────────────────────────────

function RecognitionBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);

  const { label, bg, text, bar, ring } =
    pct >= 85
      ? { label: "Ótimo",   bg: "bg-green-50",  text: "text-green-700",  bar: "bg-green-500",  ring: "ring-green-200" }
      : pct >= 70
      ? { label: "Bom",     bg: "bg-amber-50",  text: "text-amber-700",  bar: "bg-amber-500",  ring: "ring-amber-200" }
      : { label: "Baixo",   bg: "bg-red-50",    text: "text-red-700",    bar: "bg-red-500",    ring: "ring-red-200"   };

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold ring-1 tabular-nums", bg, text, ring)}>
        {pct}% · {label}
      </span>
    </div>
  );
}
