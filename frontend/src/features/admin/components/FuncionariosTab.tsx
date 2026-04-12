import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";
import { useCreateEmployee, useDeleteEmployee, useEmployees, useToggleEmployeeActive } from "../hooks/useEmployees";
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
});

type CreateForm = z.infer<typeof createSchema>;

export function FuncionariosTab() {
  const { employee: me } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Employee | null>(null);

  const { data, isLoading, isError } = useEmployees(me?.companyId ?? "");
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
      // erro silencioso — lista será recarregada pelo invalidate
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Funcionários</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {showForm ? "Cancelar" : "+ Novo funcionário"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Cadastrar funcionário</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
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
            <Field label="Perfil" error={errors.role?.message}>
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

            {formError && (
              <div className="col-span-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {formError}
              </div>
            )}

            <div className="col-span-full flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {isSubmitting ? "Salvando…" : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        )}
        {isError && (
          <div className="py-12 text-center text-sm text-red-500">Erro ao carregar funcionários.</div>
        )}
        {data && data.items.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum funcionário cadastrado.</div>
        )}
        {data && data.items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Cód. Terminal</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Depto.</th>
                  <th className="px-4 py-3">Admissão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{emp.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                    <td className="px-4 py-3">
                      {emp.terminal_code ? (
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-700">
                          {emp.terminal_code}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={emp.role} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{emp.department ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {emp.hired_at ? format(new Date(emp.hired_at + "T00:00:00"), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={emp.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEnrollTarget(emp)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium",
                            emp.has_face
                              ? "text-green-700 hover:bg-green-50"
                              : "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                          )}
                          title={emp.has_face ? "Biometria cadastrada" : "Cadastrar biometria facial"}
                        >
                          {emp.has_face && (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          )}
                          Rosto
                        </button>
                        {emp.id !== me?.id && (
                          <>
                            <button
                              onClick={() => handleToggleActive(emp)}
                              disabled={toggleMutation.isPending}
                              className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                            >
                              {emp.is_active ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Excluir permanentemente "${emp.full_name}"? Esta ação não pode ser desfeita.`)) {
                                  void deleteMutation.mutateAsync(emp.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
              {data.total} {data.total === 1 ? "funcionário" : "funcionários"} no total
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
    </div>
  );
}

function extractApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { error?: { message?: string }; detail?: unknown } } }).response;
    if (res?.data?.error?.message) return res.data.error.message;
    // Pydantic 422
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
    EMPLOYEE: "bg-gray-100 text-gray-700",
    MANAGER: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    ADMIN: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    SUPER_ADMIN: "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", colors[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Inativo
    </span>
  );
}
