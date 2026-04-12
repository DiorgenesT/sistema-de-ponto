import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/shared/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";

const schema = z
  .object({
    current_password: z.string().min(1, "Senha atual obrigatória"),
    new_password: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
    confirm_password: z.string().min(1, "Confirmação obrigatória"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  });

type Form = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { employee } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  if (!employee) return <Navigate to="/login" replace />;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setServerError(null);
    try {
      await api.post("/auth/change-password", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      const isPrivileged = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(employee!.role);
      navigate(isPrivileged ? "/admin" : "/portal", { replace: true });
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: { message?: string } | string } } }).response;
      const detail = res?.data?.detail;
      if (detail && typeof detail === "object" && detail.message) {
        setServerError(detail.message);
      } else {
        setServerError("Erro ao trocar senha. Verifique a senha atual e tente novamente.");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Troca de senha obrigatória</h1>
          <p className="mt-1 text-sm text-gray-500">
            Olá, <strong>{employee.fullName}</strong>. Por segurança, defina uma nova senha antes de continuar.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700">Senha atual</label>
              <input
                type="password"
                autoComplete="current-password"
                {...register("current_password")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.current_password
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-primary-200"
                )}
                placeholder="Senha fornecida pelo administrador"
              />
              {errors.current_password && (
                <p className="mt-1 text-xs text-red-600">{errors.current_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                {...register("new_password")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.new_password
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-primary-200"
                )}
                placeholder="Mínimo 8 caracteres"
              />
              {errors.new_password && (
                <p className="mt-1 text-xs text-red-600">{errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                {...register("confirm_password")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.confirm_password
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-primary-200"
                )}
                placeholder="Repita a nova senha"
              />
              {errors.confirm_password && (
                <p className="mt-1 text-xs text-red-600">{errors.confirm_password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Salvando…
                </span>
              ) : (
                "Definir nova senha"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
