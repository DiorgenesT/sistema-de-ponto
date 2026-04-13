import { useState } from "react";
import { format, startOfMonth, endOfMonth, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMyAttendance } from "../hooks/useMyAttendance";
import type { AttendanceRecord } from "../types";
import { cn } from "@/shared/lib/cn";

// ─── Helpers ────────────────────────────────────────────────────────────────

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isToday(d))     return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

function groupByDate(items: AttendanceRecord[]): [string, AttendanceRecord[]][] {
  const map: Record<string, AttendanceRecord[]> = {};
  for (const r of items) {
    const key = r.recorded_at.slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
}

// ─── Componente principal ────────────────────────────────────────────────────

export function AttendanceTab() {
  const today = new Date();
  const [start, setStart] = useState(() => startOfMonth(today));
  const [end,   setEnd]   = useState(() => endOfMonth(today));

  const { data, isLoading, isError } = useMyAttendance(start, end);

  const grouped = data ? groupByDate(data.items) : [];

  return (
    <div className="space-y-5">
      {/* Filtro */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Período — início</label>
            <input
              type="date"
              defaultValue={format(start, "yyyy-MM-dd")}
              onChange={e => e.target.value && setStart(new Date(e.target.value + "T00:00:00"))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Fim</label>
            <input
              type="date"
              defaultValue={format(end, "yyyy-MM-dd")}
              onChange={e => e.target.value && setEnd(new Date(e.target.value + "T23:59:59"))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
        </div>
        {data && (
          <span className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
            {data.total} {data.total === 1 ? "marcação" : "marcações"}
          </span>
        )}
      </div>

      {/* Estados */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 py-10 text-center text-sm text-red-500">
          Erro ao carregar registros. Tente novamente.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Nenhum registro no período</p>
            <p className="mt-0.5 text-xs text-gray-400">Ajuste as datas acima para consultar outro período.</p>
          </div>
        </div>
      )}

      {/* Timeline agrupada por dia */}
      {grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([dateKey, records]) => {
            const ins  = records.filter(r => r.record_type === "IN").length;
            const outs = records.filter(r => r.record_type === "OUT").length;
            const dayStr = format(new Date(dateKey + "T00:00:00"), "yyyy-MM-dd");

            return (
              <div key={dateKey}>
                {/* Cabeçalho do dia */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="shrink-0">
                    <p className="text-sm font-bold capitalize text-gray-800">{dayLabel(dayStr)}</p>
                    <p className="text-xs text-gray-400">
                      {ins} entrada{ins !== 1 ? "s" : ""} · {outs} saída{outs !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex-1 border-t border-gray-100" />
                </div>

                {/* Cards do dia */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {records.map(record => (
                    <RecordCard key={record.id} record={record} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Card de marcação ────────────────────────────────────────────────────────

function RecordCard({ record }: { record: AttendanceRecord }) {
  const dt   = new Date(record.recorded_at);
  const isIn = record.record_type === "IN";

  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-shadow hover:shadow-sm",
      isIn
        ? "border-green-100 bg-gradient-to-r from-green-50 to-white"
        : "border-blue-100 bg-gradient-to-r from-blue-50 to-white"
    )}>
      {/* Ícone */}
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        isIn ? "bg-green-100" : "bg-blue-100"
      )}>
        {isIn ? (
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", isIn ? "text-green-700" : "text-blue-700")}>
          {isIn ? "Entrada" : "Saída"}
        </p>
        {record.is_adjustment && (
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
            Registro ajustado
          </span>
        )}
      </div>

      {/* Horário */}
      <div className="text-right shrink-0">
        <p className="font-mono text-2xl font-bold tracking-tight text-gray-900">
          {format(dt, "HH:mm")}
        </p>
        <p className="font-mono text-xs text-gray-400">{format(dt, "ss")}s</p>
      </div>
    </div>
  );
}
