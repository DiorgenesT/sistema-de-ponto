import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth";
import { collectFingerprint, fingerprintToString } from "@/shared/lib/device-fingerprint";
import { api } from "@/shared/lib/api";
import { cn } from "@/shared/lib/cn";

const tokenSchema = z.object({
  token: z.string().min(10, "Token inválido — mínimo 10 caracteres"),
});

type TokenForm = z.infer<typeof tokenSchema>;

interface DeviceVerifyResponse {
  authorized: boolean;
  device_label: string;
}

export default function DeviceCheckPage() {
  const navigate = useNavigate();
  const { deviceToken, setDeviceToken } = useAuthStore();
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TokenForm>({ resolver: zodResolver(tokenSchema) });

  // Se já tem token persistido, valida e redireciona
  useEffect(() => {
    async function checkExistingToken() {
      const fp = collectFingerprint();
      setFingerprint(fingerprintToString(fp));

      if (!deviceToken) {
        setChecking(false);
        return;
      }

      try {
        await api.post<DeviceVerifyResponse>(
          "/devices/verify",
          { fingerprint: fp },
          { headers: { "X-Device-Token": deviceToken } }
        );
        navigate("/attendance");
      } catch {
        // Token inválido ou expirado — pede novo
        setChecking(false);
      }
    }

    void checkExistingToken();
  }, [deviceToken, navigate]);

  async function onSubmit(data: TokenForm) {
    setServerError(null);
    try {
      await api.post<DeviceVerifyResponse>(
        "/devices/verify",
        { fingerprint: fingerprint ?? "" },
        { headers: { "X-Device-Token": data.token } }
      );
      setDeviceToken(data.token);
      navigate("/attendance");
    } catch {
      setServerError(
        "Token inválido ou dispositivo não autorizado. Verifique com o administrador."
      );
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          <p className="text-sm">Verificando autorização do dispositivo…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
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
                d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dispositivo não reconhecido</h1>
          <p className="mt-2 text-sm text-gray-500">
            Este terminal precisa ser autorizado antes de registrar pontos.
            Insira o token fornecido pelo administrador.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700"
              >
                Token do dispositivo
              </label>
              <input
                id="token"
                type="text"
                autoComplete="off"
                spellCheck={false}
                {...register("token")}
                className={cn(
                  "mt-1 block w-full rounded-lg border px-3 py-2.5 font-mono text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.token
                    ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                )}
                placeholder="Cole o token aqui"
              />
              {errors.token && (
                <p className="mt-1 text-xs text-red-600">{errors.token.message}</p>
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
              className="flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verificando…
                </span>
              ) : (
                "Autorizar dispositivo"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          O token é gerado pelo administrador no painel de controle e é exibido
          apenas uma vez.
        </p>
      </div>
    </div>
  );
}
