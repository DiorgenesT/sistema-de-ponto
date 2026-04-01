import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMyHourBank } from "../hooks/useMyHourBank";
import type { HourBankEntry } from "../types";

export function HourBankTab() {
  const today = new Date();
  const [start, setStart] = useState(() => startOfMonth(today));
  const [end, setEnd] = useState(() => endOfMonth(today));

  const { data, isLoading, isError } = useMyHourBank(start, end);

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setStart(new Date(e.target.value + "T00:00:00"));
  }

  function handleEndChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) setEnd(new Date(e.target.value + "T23:59:59"));
  }

  const totalHours = data?.total_balance_hours ?? 0;
  const isPositive = totalHours >= 0;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Saldo total"
          value={data ? formatBalanceHours(data.total_balance_hours) : "—"}
          sub={data ? `${Math.abs(data.total_balance_minutes)} min` : undefined}
          positive={isPositive}
          loading={isLoading}
        />
        <SummaryCard
          label="Horas extras 50%"
          value={data ? formatMinutes(sumExtra50(data.entries)) : "—"}
          loading={isLoading}
        />
        <SummaryCard
          label="Horas extras 100%"
          value={data ? formatMinutes(sumExtra100(data.entries)) : "—"}
          loading={isLoading}
        />
      </div>

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
      </div>

      {/* Tabela de entradas */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-sm text-red-500">
            Erro ao carregar banco de horas. Tente novamente.
          </div>
        )}

        {data && data.entries.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum dado no período selecionado.
          </div>
        )}

        {data && data.entries.length > 0 && (
          <table className="w-full text-sm">
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
                <HourBankRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HourBankRow({ entry }: { entry: HourBankEntry }) {
  const balance = entry.balance_minutes;
  const date = new Date(entry.reference_date + "T12:00:00");

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-gray-700 capitalize">
        {format(date, "EEE, dd/MM/yyyy", { locale: ptBR })}
        {entry.is_holiday && (
          <span className="ml-2 rounded-full bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600 ring-1 ring-purple-200">
            Feriado
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-gray-700">{formatMinutes(entry.worked_minutes)}</td>
      <td className="px-4 py-3 font-mono text-gray-500">{formatMinutes(entry.expected_minutes)}</td>
      <td className="px-4 py-3 font-mono font-semibold">
        <span className={balance >= 0 ? "text-green-600" : "text-red-600"}>
          {balance >= 0 ? "+" : ""}{formatMinutes(Math.abs(balance))}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-gray-600">
        {entry.extra_minutes_50pct > 0 ? formatMinutes(entry.extra_minutes_50pct) : "—"}
      </td>
      <td className="px-4 py-3 font-mono text-gray-600">
        {entry.extra_minutes_100pct > 0 ? formatMinutes(entry.extra_minutes_100pct) : "—"}
      </td>
    </tr>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  loading?: boolean;
}

function SummaryCard({ label, value, sub, positive, loading }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-100" />
      ) : (
        <>
          <p className={`mt-1 text-2xl font-bold ${positive === false ? "text-red-600" : positive === true ? "text-green-600" : "text-gray-900"}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </>
      )}
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function formatBalanceHours(hours: number): string {
  const sign = hours < 0 ? "−" : "+";
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

function sumExtra50(entries: HourBankEntry[]): number {
  return entries.reduce((acc, e) => acc + e.extra_minutes_50pct, 0);
}

function sumExtra100(entries: HourBankEntry[]): number {
  return entries.reduce((acc, e) => acc + e.extra_minutes_100pct, 0);
}
