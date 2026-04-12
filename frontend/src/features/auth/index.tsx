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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <svg
              className="h-9 w-9 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Ponto</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acesso ao portal e painel administrativo
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                E-mail
              </label>
              <input
                id="username"
                type="email"
                autoComplete="email"
                {...register("username")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.username
                    ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                )}
                placeholder="voce@empresa.com"
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.password
                    ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                )}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.password.message}
                </p>
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
              className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Entrando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Para registrar ponto, use o terminal biométrico na tela principal.
        </p>
      </div>
    </div>
  );
}
