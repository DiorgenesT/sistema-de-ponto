import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";
import { useCreateEmployee, useDeleteEmployee, useEmployees, useToggleEmployeeActive } from "../hooks/useEmployees";
import { useSchedules } from "../hooks/useSchedules";
import { FaceEnrollModal } from "./FaceEnrollModal";
import type { Employee, EmployeeRole } from "../types";

const ROLE_LABELS: Record<EmployeeRole, string> = {
  EMPLOYEE: "Funcionário",
  MANAGER: "Gestor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Super Admin",
};

const createSchema = z.object({
  full_name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos sem pontuação"),
  password: z.string().min(8, "Senha mínima de 8 caracteres"),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const),
  department: z.string().optional(),
  registration_number: z.string().optional(),
  hired_at: z.string().optional(),
  work_schedule_id: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export function FuncionariosTab() {
  const { employee: me } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Employee | null>(null);

  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);

  const { data, isLoading, isError } = useEmployees(me?.companyId ?? "");
  const { data: schedules } = useSchedules();
  const createMutation = useCreateEmployee();
  const toggleMutation = useToggleEmployeeActive();
  const deleteMutation = useDeleteEmployee();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: "EMPLOYEE" } });

  async function onSubmit(form: CreateForm) {
    if (!me) return;
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        ...form,
        company_id: me.companyId,
        department: form.department || undefined,
        registration_number: form.registration_number || undefined,
        hired_at: form.hired_at || undefined,
        work_schedule_id: form.work_schedule_id || undefined,
      });
      reset();
      setShowForm(false);
    } catch (err: unknown) {
      const msg = extractApiError(err);
      setFormError(msg);
    }
  }

  async function handleToggleActive(emp: Employee) {
    try {
      await toggleMutation.mutateAsync({ id: emp.id, is_active: !emp.is_active });
    } catch {
      // erro silencioso
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho da aba */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Funcionários</h2>
          {data && (
            <p className="mt-0.5 text-xs text-gray-500">
              {data.total} {data.total === 1 ? "cadastrado" : "cadastrados"}
            </p>
          )}
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
              Novo funcionário
            </>
          )}
        </button>
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-800">Cadastrar funcionário</h3>
            <p className="mt-0.5 text-xs text-gray-500">Preencha os dados abaixo. Um código de terminal será gerado automaticamente.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2" noValidate>
            <Field label="Nome completo" error={errors.full_name?.message}>
              <input {...register("full_name")} placeholder="João da Silva" className={inputCls(!!errors.full_name)} />
            </Field>
            <Field label="E-mail" error={errors.email?.message}>
              <input type="email" {...register("email")} placeholder="joao@empresa.com" className={inputCls(!!errors.email)} />
            </Field>
            <Field label="CPF (só números)" error={errors.cpf?.message}>
              <input {...register("cpf")} placeholder="12345678901" maxLength={11} className={inputCls(!!errors.cpf)} />
            </Field>
            <Field label="Senha inicial" error={errors.password?.message}>
              <input type="password" {...register("password")} placeholder="mínimo 8 caracteres" className={inputCls(!!errors.password)} />
            </Field>
            <Field label="Perfil de acesso" error={errors.role?.message}>
              <select {...register("role")} className={inputCls(!!errors.role)}>
                <option value="EMPLOYEE">Funcionário</option>
                <option value="MANAGER">Gestor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </Field>
            <Field label="Departamento (opcional)">
              <input {...register("department")} placeholder="ex: RH, TI, Vendas" className={inputCls(false)} />
            </Field>
            <Field label="Matrícula (opcional)">
              <input {...register("registration_number")} placeholder="ex: 00123" className={inputCls(false)} />
            </Field>
            <Field label="Data de admissão (opcional)">
              <input type="date" {...register("hired_at")} className={inputCls(false)} />
            </Field>
            <Field label="Horário de trabalho (opcional)">
              <select {...register("work_schedule_id")} className={inputCls(false)}>
                <option value="">Selecione a escala</option>
                {schedules?.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.default_start && s.default_end
                      ? ` — ${s.default_start.slice(0, 5)} às ${s.default_end.slice(0, 5)}`
                      : s.schedule_type === "12X36"
                      ? " — 12x36"
                      : ""}
                  </option>
                ))}
              </select>
              {(!schedules || schedules.length === 0) && (
                <p className="mt-1 text-xs text-gray-400">
                  Nenhuma escala cadastrada.
                </p>
              )}
            </Field>

            {formError && (
              <div className="col-span-full flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
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
                {isSubmitting ? "Cadastrando..." : "Cadastrar funcionário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}
        {isError && (
          <div className="py-12 text-center">
            <p className="text-sm text-red-500">Erro ao carregar funcionários.</p>
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Nenhum funcionário cadastrado</p>
            <p className="text-xs text-gray-400">Clique em "Novo funcionário" para começar.</p>
          </div>
        )}
        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">E-mail</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Terminal</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Perfil</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Depto.</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Admissão</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items.map((emp) => (
                    <tr key={emp.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                            {emp.full_name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp.email}</td>
                      <td className="px-4 py-3">
                        {emp.terminal_code ? (
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-widest text-slate-700">
                            {emp.terminal_code}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={emp.role} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp.department ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {emp.hired_at ? format(new Date(emp.hired_at + "T00:00:00"), "dd/MM/yyyy") : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={emp.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Biometria */}
                          <ActionButton
                            onClick={() => setEnrollTarget(emp)}
                            title={emp.has_face ? "Biometria cadastrada — clique para atualizar" : "Cadastrar biometria facial"}
                            variant={emp.has_face ? "success" : "primary"}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
                            </svg>
                          </ActionButton>

                          {emp.id !== me?.id && (
                            <>
                              {/* Ativar/Desativar */}
                              <ActionButton
                                onClick={() => void handleToggleActive(emp)}
                                disabled={toggleMutation.isPending}
                                title={emp.is_active ? "Desativar funcionário" : "Ativar funcionário"}
                                variant={emp.is_active ? "warning" : "default"}
                              >
                                {emp.is_active ? (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                ) : (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                  </svg>
                                )}
                              </ActionButton>

                              {/* Resetar senha */}
                              <ActionButton
                                onClick={() => setResetTarget(emp)}
                                title="Resetar senha"
                                variant="amber"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                              </ActionButton>

                              {/* Excluir */}
                              <ActionButton
                                onClick={() => {
                                  if (confirm(`Excluir permanentemente "${emp.full_name}"? Esta ação não pode ser desfeita.`)) {
                                    void deleteMutation.mutateAsync(emp.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                title="Excluir funcionário"
                                variant="danger"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <p className="text-xs text-gray-400">
                {data.total} {data.total === 1 ? "funcionário" : "funcionários"} no total
              </p>
            </div>
          </>
        )}
      </div>

      {enrollTarget && (
        <FaceEnrollModal
          employeeId={enrollTarget.id}
          employeeName={enrollTarget.full_name}
          onClose={() => setEnrollTarget(null)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          employee={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={(tempPassword) => {
            setResetResult({ name: resetTarget.full_name, tempPassword });
            setResetTarget(null);
          }}
        />
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">Senha resetada com sucesso</p>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Informe a senha temporária abaixo ao funcionário. Ele deverá trocá-la no próximo login.
            </p>
            <div className="rounded-xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200">
              <p className="text-xs font-medium text-amber-600">{resetResult.name}</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-amber-800">
                {resetResult.tempPassword}
              </p>
              <p className="mt-1 text-xs text-amber-500">Anote esta senha — ela não será exibida novamente.</p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="mt-4 w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- ActionButton -----------------------------------------------------------

type ActionVariant = "default" | "primary" | "success" | "warning" | "amber" | "danger";

const ACTION_VARIANT_CLASSES: Record<ActionVariant, string> = {
  default: "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
  primary: "text-primary-500 hover:bg-primary-50 hover:text-primary-700",
  success: "text-green-600 hover:bg-green-50",
  warning: "text-amber-500 hover:bg-amber-50 hover:text-amber-700",
  amber: "text-amber-600 hover:bg-amber-50 hover:text-amber-800",
  danger: "text-red-400 hover:bg-red-50 hover:text-red-600",
};

function ActionButton({
  children,
  onClick,
  disabled,
  title,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  variant?: ActionVariant;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
        ACTION_VARIANT_CLASSES[variant]
      )}
    >
      {children}
    </button>
  );
}

// ---- ResetPasswordModal ------------------------------------------------------

function ResetPasswordModal({
  employee,
  onClose,
  onSuccess,
}: {
  employee: Employee;
  onClose: () => void;
  onSuccess: (tempPassword: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    try {
      const { api } = await import("@/shared/lib/api");
      const { data } = await api.post<{ temp_password: string }>(`/employees/${employee.id}/reset-password`);
      onSuccess(data.temp_password);
    } catch {
      setError("Erro ao resetar senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800">Resetar senha</p>
        </div>
        <p className="text-sm text-gray-600">
          Uma senha temporária será gerada para <strong>{employee.full_name}</strong>. O funcionário
          deverá trocá-la no próximo login.
        </p>
        {error && (
          <p className="mt-3 text-xs text-red-600">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleReset()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 shadow-sm"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Gerar senha temporária
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----------------------------------------------------------------

function extractApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { error?: { message?: string }; detail?: unknown } } }).response;
    if (res?.data?.error?.message) return res.data.error.message;
    if (res?.data?.detail && Array.isArray(res.data.detail)) {
      const first = (res.data.detail as Array<{ msg?: string }>)[0];
      return first?.msg ?? "Dados inválidos.";
    }
  }
  return "Erro ao cadastrar funcionário. Tente novamente.";
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
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

function RoleBadge({ role }: { role: EmployeeRole }) {
  const colors: Record<EmployeeRole, string> = {
    EMPLOYEE: "bg-gray-100 text-gray-600",
    MANAGER: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    ADMIN: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    SUPER_ADMIN: "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", colors[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Inativo
    </span>
  );
}
