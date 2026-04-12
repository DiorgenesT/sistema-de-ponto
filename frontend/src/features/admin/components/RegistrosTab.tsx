import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdminAttendance } from "../hooks/useAdminAttendance";
import { useEmployees } from "../hooks/useEmployees";
import { useAuthStore } from "@/store/auth";

export function RegistrosTab() {
  const { employee: me } = useAuthStore();
  const today = new Date();
  const [start, setStart] = useState(() => startOfMonth(today));
  const [end, setEnd] = useState(today);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 50;

  const { data, isLoading, isError } = useAdminAttendance({
    employeeId: employeeId || undefined,
    start,
    end,
    page,
  });

  const { data: employeesData } = useEmployees(me?.companyId ?? "");

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      setStart(new Date(e.target.value + "T00:00:00"));
      setPage(1);
    }
  }

  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      setEnd(new Date(e.target.value + "T23:59:59"));
      setPage(1);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Registros de Ponto</h2>
          {data && (
            <p className="mt-0.5 text-xs text-gray-500">
              {data.total} {data.total === 1 ? "registro encontrado" : "registros encontrados"}
            </p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">De</label>
          <input
            type="date"
            defaultValue={format(start, "yyyy-MM-dd")}
            onChange={handleStartChange}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Até</label>
          <input
            type="date"
            defaultValue={format(end, "yyyy-MM-dd")}
            onChange={handleEndChange}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Funcionário</label>
          <select
            value={employeeId}
            onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
            className="min-w-[180px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">Todos os funcionários</option>
            {employeesData?.items.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-500">
            Erro ao carregar registros.
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Nenhum registro no período</p>
            <p className="text-xs text-gray-400">Tente ajustar o filtro de datas ou funcionário.</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[680px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Funcionário</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Hora</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Confiança</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items.map((record) => {
                    const dt = new Date(record.recorded_at);
                    const isIn = record.record_type === "IN";
                    return (
                      <tr key={record.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {record.employee_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize whitespace-nowrap">
                          {format(dt, "EEE, dd/MM/yy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {format(dt, "HH:mm")}
                          </span>
                          <span className="font-mono text-xs text-gray-400">:{format(dt, "ss")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                              isIn
                                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                                : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isIn ? "bg-green-500" : "bg-blue-500"}`} />
                            {isIn ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ConfidenceBar value={record.facial_confidence} />
                        </td>
                        <td className="px-4 py-3">
                          {record.is_adjustment ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                              Ajuste
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Original</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  Anterior
                </button>
                <span className="text-xs font-medium text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 85 ? "text-green-700" : pct >= 70 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}
