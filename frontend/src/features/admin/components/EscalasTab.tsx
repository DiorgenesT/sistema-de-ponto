import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";
import { useSchedules, useCreateSchedule, useToggleScheduleActive } from "../hooks/useSchedules";
import type { WorkSchedule } from "../hooks/useSchedules";

const SCHEDULE_TYPE_LABELS: Record<WorkSchedule["schedule_type"], string> = {
  FIXED: "Fixo",
  VARIABLE: "Variável",
  "12X36": "12x36",
};

const createSchema = z.object({
  name: z.string().min(2, "Nome obrigatório (mín. 2 caracteres)"),
  schedule_type: z.enum(["FIXED", "VARIABLE", "12X36"] as const),
  default_start: z.string().optional(),
  default_end: z.string().optional(),
  daily_minutes: z.coerce.number().int().min(60).max(720),
});

type CreateForm = z.infer<typeof createSchema>;

export function EscalasTab() {
  const { employee: me } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: schedules, isLoading, isError } = useSchedules();
  const createMutation = useCreateSchedule();
  const toggleMutation = useToggleScheduleActive();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      schedule_type: "FIXED",
      daily_minutes: 480,
    },
  });

  const scheduleType = watch("schedule_type");

  async function onSubmit(form: CreateForm) {
    if (!me) return;
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        company_id: me.companyId,
        name: form.name,
        schedule_type: form.schedule_type,
        default_start: form.default_start || undefined,
        default_end: form.default_end || undefined,
        daily_minutes: form.daily_minutes,
      });
      reset();
      setShowForm(false);
    } catch {
      setFormError("Erro ao cadastrar escala. Tente novamente.");
    }
  }

  async function handleToggle(s: WorkSchedule) {
    try {
      await toggleMutation.mutateAsync({ id: s.id, is_active: !s.is_active });
    } catch {
      // silencioso
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Escalas de trabalho</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Configure os horários padrão atribuídos aos funcionários
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
            showForm
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300"
              : "bg-primary-600 text-white hover:bg-primary-700 shadow-sm focus:ring-primary-500"
          )}
        >
          {showForm ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Cancelar
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nova escala
            </>
          )}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-800">Cadastrar escala</h3>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2" noValidate>
            <Field label="Nome da escala" error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="Ex: Comercial 8h, Turno Noturno, 12x36"
                className={inputCls(!!errors.name)}
              />
            </Field>

            <Field label="Tipo de escala" error={errors.schedule_type?.message}>
              <select {...register("schedule_type")} className={inputCls(!!errors.schedule_type)}>
                <option value="FIXED">Fixo (mesmo horário todos os dias)</option>
                <option value="VARIABLE">Variável (horários diferentes por dia)</option>
                <option value="12X36">12x36 (12h trabalho, 36h descanso)</option>
              </select>
            </Field>

            {scheduleType !== "12X36" && (
              <>
                <Field label="Hora de entrada padrão">
                  <input type="time" {...register("default_start")} className={inputCls(false)} />
                </Field>
                <Field label="Hora de saída padrão">
                  <input type="time" {...register("default_end")} className={inputCls(false)} />
                </Field>
              </>
            )}

            <Field label="Minutos de trabalho por dia" error={errors.daily_minutes?.message}>
              <div className="relative">
                <input
                  type="number"
                  {...register("daily_minutes")}
                  min={60}
                  max={720}
                  className={inputCls(!!errors.daily_minutes)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
                  {watch("daily_minutes") ? `${Math.floor(Number(watch("daily_minutes")) / 60)}h${Number(watch("daily_minutes")) % 60 > 0 ? `${Number(watch("daily_minutes")) % 60}m` : ""}` : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Padrão: 480 = 8h/dia</p>
            </Field>

            {formError && (
              <div className="col-span-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {formError}
              </div>
            )}

            <div className="col-span-full flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { reset(); setShowForm(false); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
              >
                {isSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Cadastrar escala
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}
        {isError && (
          <div className="py-12 text-center text-sm text-red-500">Erro ao carregar escalas.</div>
        )}
        {schedules && schedules.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Nenhuma escala cadastrada</p>
            <p className="text-xs text-gray-400">Crie uma escala para atribuir aos funcionários.</p>
          </div>
        )}
        {schedules && schedules.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Horário</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Carga diária</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          s.schedule_type === "12X36"
                            ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
                            : s.schedule_type === "VARIABLE"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        )}>
                          {SCHEDULE_TYPE_LABELS[s.schedule_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {s.default_start && s.default_end
                          ? `${s.default_start.slice(0, 5)} — ${s.default_end.slice(0, 5)}`
                          : s.schedule_type === "12X36"
                          ? "12h / 36h"
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {Math.floor(s.daily_minutes / 60)}h{s.daily_minutes % 60 > 0 ? `${s.daily_minutes % 60}m` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {s.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void handleToggle(s)}
                          disabled={toggleMutation.isPending}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                            s.is_active
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-green-600 hover:bg-green-50"
                          )}
                        >
                          {s.is_active ? "Desativar" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <p className="text-xs text-gray-400">
                {schedules.length} {schedules.length === 1 ? "escala cadastrada" : "escalas cadastradas"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
  );
}
