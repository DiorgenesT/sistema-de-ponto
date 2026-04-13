import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";

const loginSchema = z.object({
  username: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  must_change_password: boolean;
  employee: {
    id: string;
    full_name: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
    company_id: string;
    company_name: string;
    company_cnpj: string;
  };
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { setTokens, setEmployee } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setServerError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", data.username);
      params.append("password", data.password);

      const response = await api.post<LoginResponse>("/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token, employee, must_change_password } = response.data;
      setTokens(access_token);
      setEmployee({
        id: employee.id,
        fullName: employee.full_name,
        role: employee.role,
        companyId: employee.company_id,
        companyName: employee.company_name,
        companyCnpj: employee.company_cnpj,
      });

      if (must_change_password) {
        navigate("/change-password");
        return;
      }

      const isPrivileged = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(employee.role);
      navigate(isPrivileged ? "/admin" : "/portal");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setServerError("E-mail ou senha inválidos.");
      } else if (axios.isAxiosError(err) && !err.response) {
        setServerError("Não foi possível conectar ao servidor. Tente novamente em instantes.");
      } else {
        setServerError("Erro inesperado. Tente novamente.");
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-7">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-900/40">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PontoFácil</h1>
          <p className="mt-1 text-sm text-gray-400">
            Portal e painel administrativo
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-300 mb-1.5">
                E-mail
              </label>
              <input
                id="username"
                type="email"
                autoComplete="email"
                {...register("username")}
                className={cn(
                  "block w-full rounded-lg border bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition focus:outline-none focus:ring-2",
                  errors.username
                    ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/20"
                    : "border-white/10 focus:border-primary-500 focus:ring-primary-500/20"
                )}
                placeholder="voce@empresa.com"
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-300 mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className={cn(
                  "block w-full rounded-lg border bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition focus:outline-none focus:ring-2",
                  errors.password
                    ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/20"
                    : "border-white/10 focus:border-primary-500 focus:ring-primary-500/20"
                )}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-300">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-900/30 transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600">
          Para registrar ponto, use o terminal biométrico.
        </p>
      </div>
    </div>
  );
}
