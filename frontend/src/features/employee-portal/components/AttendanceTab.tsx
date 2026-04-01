import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMyAttendance } from "../hooks/useMyAttendance";
import type { AttendanceRecord } from "../types";

export function AttendanceTab() {
  const today = new Date();
  const [start, setStart] = useState(() => startOfMonth(today));
  const [end, setEnd] = useState(() => endOfMonth(today));

  const { data, isLoading, isError } = useMyAttendance(start, end);

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setStart(new Date(e.target.value + "T00:00:00"));
  }

  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setEnd(new Date(e.target.value + "T23:59:59"));
  }

  return (
    <div className="space-y-4">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">De</label>
          <input
            type="date"
            defaultValue={format(start, "yyyy-MM-dd")}
            onChange={handleStartChange}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">até</label>
          <input
            type="date"
            defaultValue={format(end, "yyyy-MM-dd")}
            onChange={handleEndChange}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        {data && (
          <span className="ml-auto text-sm text-gray-500">
            {data.total} {data.total === 1 ? "registro" : "registros"}
          </span>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-500">
            Erro ao carregar registros. Tente novamente.
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum registro no período selecionado.
          </div>
        )}

        {data && data.items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Confiança</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((record) => (
                <AttendanceRow key={record.id} record={record} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AttendanceRow({ record }: { record: AttendanceRecord }) {
  const date = new Date(record.recorded_at);
  const isIn = record.record_type === "IN";

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-gray-700 capitalize">
        {format(date, "EEE, dd/MM/yyyy", { locale: ptBR })}
      </td>
      <td className="px-4 py-3 font-mono font-medium text-gray-900">
        {format(date, "HH:mm:ss")}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
            ${isIn
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
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
}
