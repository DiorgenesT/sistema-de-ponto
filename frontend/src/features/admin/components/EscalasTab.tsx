import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";
import { useSchedules, useCreateSchedule, useToggleScheduleActive } from "../hooks/useSchedules";
import type { WorkSchedule } from "../hooks/useSchedules";

// ─── Constantes ────────────────────────────────────────────────────────────────

const DAYS = [
  { bit: 1,  short: "Seg", label: "Segunda" },
  { bit: 2,  short: "Ter", label: "Terça"   },
  { bit: 4,  short: "Qua", label: "Quarta"  },
  { bit: 8,  short: "Qui", label: "Quinta"  },
  { bit: 16, short: "Sex", label: "Sexta"   },
  { bit: 32, short: "Sáb", label: "Sábado"  },
  { bit: 64, short: "Dom", label: "Domingo" },
];

type ScheduleType = "FIXED" | "VARIABLE" | "12X36";

const TYPE_META: Record<ScheduleType, { label: string; desc: string; icon: JSX.Element; color: string; ring: string; bg: string; text: string }> = {
  FIXED: {
    label: "Fixo",
    desc: "Mesmo horário em todos os dias úteis",
    color: "blue",
    ring: "ring-blue-400",
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  VARIABLE: {
    label: "Variável",
    desc: "Horários diferentes por dia da semana",
    color: "amber",
    ring: "ring-amber-400",
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  "12X36": {
    label: "12×36",
    desc: "12h de trabalho seguidas de 36h de descanso",
    color: "purple",
    ring: "ring-purple-400",
    bg: "bg-purple-50",
    text: "text-purple-700",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function minutesDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, diff);
}

function formatMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}m` : `${h}h`;
}

function maskLabel(mask: number): string {
  const active = DAYS.filter(d => (mask & d.bit) !== 0);
  if (!active.length) return "Nenhum dia";
  if (mask === 31)  return "Seg – Sex";
  if (mask === 63)  return "Seg – Sáb";
  if (mask === 127) return "Todos os dias";
  return active.map(d => d.short).join(", ");
}

function parsePerDay(description: string | null): Record<number, { start: string; end: string }> | null {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as { days?: Record<string, { start: string; end: string }> };
    if (parsed.days) {
      const result: Record<number, { start: string; end: string }> = {};
      for (const [k, v] of Object.entries(parsed.days)) {
        result[Number(k)] = v;
      }
      return result;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Tipo do estado per-day ──────────────────────────────────────────────────

interface DayState {
  active: boolean;
  start: string;
  end: string;
}

function defaultPerDay(): Record<number, DayState> {
  const r: Record<number, DayState> = {};
  DAYS.forEach(d => {
    r[d.bit] = { active: d.bit <= 16, start: "08:00", end: "17:00" };
  });
  return r;
}

// ─── Componente principal ────────────────────────────────────────────────────

export function EscalasTab() {
  const { employee: me } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Campos do formulário
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("FIXED");

  // FIXED
  const [fixedMask, setFixedMask] = useState(31); // seg-sex
  const [fixedStart, setFixedStart] = useState("08:00");
  const [fixedEnd, setFixedEnd] = useState("17:00");

  // VARIABLE
  const [perDay, setPerDay] = useState<Record<number, DayState>>(defaultPerDay);

  const { data: schedules, isLoading, isError } = useSchedules();
  const createMutation = useCreateSchedule();
  const toggleMutation = useToggleScheduleActive();

  function openForm() {
    setShowForm(true);
    setFormError(null);
    setName("");
    setNameError("");
    setScheduleType("FIXED");
    setFixedMask(31);
    setFixedStart("08:00");
    setFixedEnd("17:00");
    setPerDay(defaultPerDay());
  }

  function closeForm() {
    setShowForm(false);
    setFormError(null);
  }

  function toggleDay(bit: number) {
    setFixedMask(prev => (prev & bit) ? prev & ~bit : prev | bit);
  }

  function toggleVarDay(bit: number) {
    setPerDay(prev => ({
      ...prev,
      [bit]: { ...prev[bit], active: !prev[bit].active },
    }));
  }

  function setVarTime(bit: number, field: "start" | "end", value: string) {
    setPerDay(prev => ({
      ...prev,
      [bit]: { ...prev[bit], [field]: value },
    }));
  }

  // Computed
  const fixedMinutes = minutesDiff(fixedStart, fixedEnd);
  const varActiveDays = DAYS.filter(d => perDay[d.bit]?.active);
  const varMask = varActiveDays.reduce((m, d) => m | d.bit, 0);
  const varAvgMinutes = varActiveDays.length
    ? Math.round(varActiveDays.reduce((sum, d) => sum + minutesDiff(perDay[d.bit].start, perDay[d.bit].end), 0) / varActiveDays.length)
    : 480;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setNameError("");
    setFormError(null);

    if (name.trim().length < 2) {
      setNameError("Nome deve ter ao menos 2 caracteres");
      return;
    }

    let payload: Parameters<typeof createMutation.mutateAsync>[0];

    if (scheduleType === "FIXED") {
      if (!fixedMask) { setFormError("Selecione ao menos um dia de trabalho"); return; }
      if (fixedMinutes < 60) { setFormError("O intervalo entre entrada e saída deve ser de ao menos 1 hora"); return; }
      payload = {
        company_id: me.companyId,
        name: name.trim(),
        schedule_type: "FIXED",
        default_start: fixedStart,
        default_end: fixedEnd,
        daily_minutes: fixedMinutes,
        workdays_mask: fixedMask,
      };
    } else if (scheduleType === "VARIABLE") {
      if (!varActiveDays.length) { setFormError("Ative ao menos um dia de trabalho"); return; }
      const invalid = varActiveDays.find(d => minutesDiff(perDay[d.bit].start, perDay[d.bit].end) < 60);
      if (invalid) { setFormError(`Horário de ${invalid.label} inválido — entrada deve ser antes da saída com ao menos 1h de intervalo`); return; }

      const daysJson: Record<string, { start: string; end: string }> = {};
      varActiveDays.forEach(d => { daysJson[String(d.bit)] = { start: perDay[d.bit].start, end: perDay[d.bit].end }; });

      payload = {
        company_id: me.companyId,
        name: name.trim(),
        schedule_type: "VARIABLE",
        daily_minutes: varAvgMinutes,
        workdays_mask: varMask,
        description: JSON.stringify({ days: daysJson }),
      };
    } else {
      // 12X36
      payload = {
        company_id: me.companyId,
        name: name.trim(),
        schedule_type: "12X36",
        daily_minutes: 720,
        workdays_mask: 0,
      };
    }

    setSubmitting(true);
    try {
      await createMutation.mutateAsync(payload);
      closeForm();
    } catch {
      setFormError("Erro ao cadastrar escala. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(s: WorkSchedule) {
    try {
      await toggleMutation.mutateAsync({ id: s.id, is_active: !s.is_active });
    } catch { /* silencioso */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Escalas de trabalho</h2>
          <p className="mt-0.5 text-xs text-gray-500">Configure os horários atribuídos aos funcionários</p>
        </div>
        {!showForm && (
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nova escala
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Form header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
                  <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Nova escala de trabalho</p>
                  <p className="text-xs text-gray-400">Preencha as informações abaixo</p>
                </div>
              </div>
              <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Seção 1: Nome */}
              <div className="px-5 py-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Nome da escala
                </label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError(""); }}
                  placeholder="Ex: Comercial, Turno A, 12×36 Noturno"
                  className={cn(
                    "block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                    nameError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-200 focus:border-primary-400 focus:ring-primary-100"
                  )}
                />
                {nameError && <p className="mt-1.5 text-xs text-red-600">{nameError}</p>}
              </div>

              {/* Seção 2: Tipo */}
              <div className="px-5 py-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de escala</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(["FIXED", "VARIABLE", "12X36"] as ScheduleType[]).map(type => {
                    const meta = TYPE_META[type];
                    const selected = scheduleType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setScheduleType(type)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                          selected
                            ? `border-${meta.color}-400 ${meta.bg} ring-1 ${meta.ring}`
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <span className={cn("mt-0.5 shrink-0", selected ? meta.text : "text-gray-400")}>
                          {meta.icon}
                        </span>
                        <div>
                          <p className={cn("text-sm font-semibold", selected ? meta.text : "text-gray-700")}>
                            {meta.label}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400 leading-tight">{meta.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seção 3: Config por tipo */}
              {scheduleType === "FIXED" && (
                <div className="px-5 py-5 space-y-5">
                  {/* Dias */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Dias de trabalho</p>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(d => {
                        const active = (fixedMask & d.bit) !== 0;
                        const isWeekend = d.bit >= 32;
                        return (
                          <button
                            key={d.bit}
                            type="button"
                            onClick={() => toggleDay(d.bit)}
                            className={cn(
                              "flex h-10 w-14 flex-col items-center justify-center rounded-xl border-2 text-xs font-semibold transition-all select-none",
                              active
                                ? isWeekend
                                  ? "border-amber-400 bg-amber-50 text-amber-700"
                                  : "border-primary-400 bg-primary-50 text-primary-700"
                                : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                            )}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horário */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Horário</p>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex-1 min-w-[120px]">
                        <label className="mb-1 block text-xs text-gray-500">Entrada</label>
                        <input
                          type="time"
                          value={fixedStart}
                          onChange={e => setFixedStart(e.target.value)}
                          className="block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>
                      <div className="flex h-10 items-center text-gray-300">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="mb-1 block text-xs text-gray-500">Saída</label>
                        <input
                          type="time"
                          value={fixedEnd}
                          onChange={e => setFixedEnd(e.target.value)}
                          className="block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>
                      {fixedMinutes >= 60 && (
                        <div className="shrink-0 rounded-xl bg-green-50 px-4 py-2.5 text-center">
                          <p className="text-xs text-green-600">Carga diária</p>
                          <p className="text-sm font-bold text-green-700">{formatMin(fixedMinutes)}</p>
                        </div>
                      )}
                    </div>
                    {fixedMinutes < 60 && fixedStart && fixedEnd && (
                      <p className="mt-2 text-xs text-amber-600">Saída deve ser ao menos 1h depois da entrada</p>
                    )}
                  </div>

                  {/* Resumo */}
                  {fixedMask > 0 && fixedMinutes >= 60 && (
                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      <span className="font-medium text-gray-800">{maskLabel(fixedMask)}</span>
                      {" "}·{" "}
                      {fixedStart.slice(0, 5)} às {fixedEnd.slice(0, 5)}
                      {" "}·{" "}
                      {formatMin(fixedMinutes)}/dia
                      {" "}·{" "}
                      {formatMin(DAYS.filter(d => (fixedMask & d.bit) !== 0).length * fixedMinutes)}/semana
                    </div>
                  )}
                </div>
              )}

              {scheduleType === "VARIABLE" && (
                <div className="px-5 py-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Horário por dia</p>
                    {varActiveDays.length > 0 && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        {varActiveDays.length} dias · {formatMin(varAvgMinutes)} média/dia
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    {DAYS.map((d, i) => {
                      const state = perDay[d.bit];
                      const isWeekend = d.bit >= 32;
                      const mins = state.active ? minutesDiff(state.start, state.end) : 0;
                      return (
                        <div
                          key={d.bit}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-colors",
                            i !== 0 && "border-t border-gray-100",
                            state.active ? "bg-white" : "bg-gray-50/60"
                          )}
                        >
                          {/* Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleVarDay(d.bit)}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
                              state.active
                                ? isWeekend ? "bg-amber-400 focus:ring-amber-400" : "bg-primary-500 focus:ring-primary-500"
                                : "bg-gray-200 focus:ring-gray-300"
                            )}
                          >
                            <span className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              state.active ? "translate-x-4" : "translate-x-0"
                            )} />
                          </button>

                          {/* Label */}
                          <span className={cn(
                            "w-10 shrink-0 text-sm font-semibold",
                            state.active ? isWeekend ? "text-amber-700" : "text-gray-800" : "text-gray-400"
                          )}>
                            {d.short}
                          </span>

                          {/* Horários */}
                          {state.active ? (
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                              <input
                                type="time"
                                value={state.start}
                                onChange={e => setVarTime(d.bit, "start", e.target.value)}
                                className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                              />
                              <svg className="h-3.5 w-3.5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                              </svg>
                              <input
                                type="time"
                                value={state.end}
                                onChange={e => setVarTime(d.bit, "end", e.target.value)}
                                className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                              />
                              {mins >= 60 && (
                                <span className="ml-auto rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                  {formatMin(mins)}
                                </span>
                              )}
                              {mins > 0 && mins < 60 && (
                                <span className="ml-auto text-xs text-red-500">Mín. 1h</span>
                              )}
                            </div>
                          ) : (
                            <span className="flex-1 text-xs text-gray-400">Folga</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {scheduleType === "12X36" && (
                <div className="px-5 py-5">
                  <div className="flex items-start gap-4 rounded-xl bg-purple-50 p-4 ring-1 ring-purple-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                      <svg className="h-4.5 w-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                      </svg>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-purple-800">Escala 12×36</p>
                      <p className="mt-1 text-xs leading-relaxed text-purple-600">
                        O funcionário trabalha 12h seguidas e descansa as 36h seguintes. O sistema irá calcular automaticamente os dias de trabalho e folga a partir da data de início do funcionário.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-lg bg-purple-100 px-2.5 py-1 font-medium text-purple-700">12h de trabalho</span>
                        <span className="rounded-lg bg-purple-100 px-2.5 py-1 font-medium text-purple-700">36h de descanso</span>
                        <span className="rounded-lg bg-purple-100 px-2.5 py-1 font-medium text-purple-700">~182h/mês</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Erro + Botões */}
              <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  {formError && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      {formError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors sm:flex-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 transition-colors sm:flex-none"
                  >
                    {submitting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {submitting ? "Cadastrando…" : "Cadastrar escala"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Lista de escalas */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-red-100 bg-red-50 py-8 text-center text-sm text-red-500">
          Erro ao carregar escalas.
        </div>
      )}

      {schedules && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Nenhuma escala cadastrada</p>
            <p className="mt-0.5 text-xs text-gray-400">Clique em "Nova escala" para começar.</p>
          </div>
        </div>
      )}

      {schedules && schedules.length > 0 && (
        <div className="space-y-3">
          {/* Grid de cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {schedules.map(s => (
              <ScheduleCard key={s.id} schedule={s} onToggle={() => void handleToggle(s)} toggling={toggleMutation.isPending} />
            ))}
          </div>
          <p className="text-right text-xs text-gray-400">
            {schedules.length} {schedules.length === 1 ? "escala cadastrada" : "escalas cadastradas"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card de escala ──────────────────────────────────────────────────────────

function ScheduleCard({
  schedule: s,
  onToggle,
  toggling,
}: {
  schedule: WorkSchedule;
  onToggle: () => void;
  toggling: boolean;
}) {
  const meta = TYPE_META[s.schedule_type as ScheduleType];
  const perDayConfig = s.schedule_type === "VARIABLE" ? parsePerDay(s.description) : null;

  const timeRange = () => {
    if (s.schedule_type === "12X36") return "12h / 36h";
    if (s.default_start && s.default_end)
      return `${s.default_start.slice(0, 5)} – ${s.default_end.slice(0, 5)}`;
    return null;
  };

  const daysLabel = s.schedule_type === "12X36" ? "Escala rotativa" : maskLabel(s.workdays_mask ?? 31);

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md",
      s.is_active ? "border-gray-200" : "border-gray-100 opacity-70"
    )}>
      {/* Accent top bar */}
      <div className={cn(
        "h-1 w-full",
        s.schedule_type === "12X36" ? "bg-purple-400"
          : s.schedule_type === "VARIABLE" ? "bg-amber-400"
          : "bg-primary-400"
      )} />

      <div className="flex flex-1 flex-col p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-lg p-1.5", meta.bg, meta.text)}>
              {meta.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{s.name}</p>
              <p className={cn("mt-0.5 text-xs font-medium", meta.text)}>{meta.label}</p>
            </div>
          </div>
          {s.is_active ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Ativa
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              Inativa
            </span>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 space-y-2">
          {/* Dias */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span>{daysLabel}</span>
          </div>

          {/* Horário / carga */}
          {s.schedule_type === "VARIABLE" && perDayConfig ? (
            <div className="space-y-1">
              {DAYS.filter(d => perDayConfig[d.bit]).map(d => {
                const cfg = perDayConfig[d.bit];
                const mins = minutesDiff(cfg.start, cfg.end);
                return (
                  <div key={d.bit} className="flex items-center justify-between text-xs">
                    <span className={cn("font-medium w-8", d.bit >= 32 ? "text-amber-600" : "text-gray-600")}>{d.short}</span>
                    <span className="font-mono text-gray-500">{cfg.start.slice(0, 5)} – {cfg.end.slice(0, 5)}</span>
                    <span className="text-gray-400">{formatMin(mins)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="font-mono">{timeRange() ?? "—"}</span>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-gray-600">{formatMin(s.daily_minutes)}/dia</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-end border-t border-gray-50 pt-3">
          <button
            onClick={onToggle}
            disabled={toggling}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
              s.is_active
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            )}
          >
            {s.is_active ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>
    </div>
  );
}
