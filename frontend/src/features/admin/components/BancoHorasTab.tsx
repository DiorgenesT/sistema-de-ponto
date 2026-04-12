import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdminHourBank } from "../hooks/useAdminHourBank";
import { useEmployees } from "../hooks/useEmployees";
import { useAuthStore } from "@/store/auth";
import type { HourBankEntry } from "@/features/employee-portal/types";

function fmtMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

export function BancoHorasTab() {
  const { employee: me } = useAuthStore();
  const today = new Date();
  const [start, setStart] = useState(() => startOfMonth(today));
  const [end, setEnd] = useState(today);
  const [employeeId, setEmployeeId] = useState<string>("");

  const { data: employeesData } = useEmployees(me?.companyId ?? "");
  const { data, isLoading, isError } = useAdminHourBank(employeeId, start, end);

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setStart(new Date(e.target.value + "T00:00:00"));
  }
  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setEnd(new Date(e.target.value + "T23:59:59"));
  }

  const selectedEmployee = employeesData?.items.find((e) => e.id === employeeId);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Banco de Horas</h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">Selecione um funcionário</option>
          {employeesData?.items.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
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
      </div>

      {/* Placeholder antes de selecionar */}
      {!employeeId && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          Selecione um funcionário para ver o banco de horas.
        </div>
      )}

      {employeeId && isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {employeeId && isError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          Erro ao carregar banco de horas.
        </div>
      )}

      {data && (
        <>
          {/* Card de saldo */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {selectedEmployee?.full_name}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
                  {data.total_balance_hours}
                </p>
                <p className="text-sm text-gray-500">
                  {fmtMinutes(data.total_balance_minutes)} no período
                </p>
              </div>
              <div className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                data.total_balance_minutes >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {data.total_balance_minutes >= 0 ? "Crédito" : "Débito"}
              </div>
            </div>

            {/* Alerta de saldo alto */}
            {data.total_balance_minutes >= 2400 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
                <span>⚠</span>
                Saldo acima de 40h — verifique o prazo de compensação (6 meses).
              </div>
            )}
          </div>

          {/* Tabela de entradas diárias */}
          {data.entries.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Trabalhado</th>
                    <th className="px-4 py-3">Esperado</th>
                    <th className="px-4 py-3">Saldo</th>
                    <th className="px-4 py-3">Extra 50%</th>
                    <th className="px-4 py-3">Extra 100%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.entries.map((entry) => (
                    <HourBankEntryRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {data.entries.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
              Nenhuma entrada no período selecionado.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HourBankEntryRow({ entry }: { entry: HourBankEntry }) {
  const refDate = new Date(entry.reference_date + "T12:00:00");
  const balance = entry.balance_minutes;

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-gray-700 capitalize">
        <div>{format(refDate, "EEE, dd/MM/yyyy", { locale: ptBR })}</div>
        {entry.is_holiday && (
          <span className="text-xs text-purple-600">Feriado/DSR</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-gray-700">
        {fmtMinutes(entry.worked_minutes).replace(/^[+-]/, "")}
      </td>
      <td className="px-4 py-3 font-mono text-gray-500">
        {fmtMinutes(entry.expected_minutes).replace(/^[+-]/, "")}
      </td>
      <td className="px-4 py-3">
        <span
          className={`font-mono font-medium ${
            balance >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {fmtMinutes(balance)}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-gray-500">
        {entry.extra_minutes_50pct > 0 ? fmtMinutes(entry.extra_minutes_50pct) : "—"}
      </td>
      <td className="px-4 py-3 font-mono text-gray-500">
        {entry.extra_minutes_100pct > 0 ? fmtMinutes(entry.extra_minutes_100pct) : "—"}
      </td>
    </tr>
  );
}
