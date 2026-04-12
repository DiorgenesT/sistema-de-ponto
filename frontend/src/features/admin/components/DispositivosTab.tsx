import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/shared/lib/cn";
import { useDeactivateDevice, useDevices, useOnboardDevice } from "../hooks/useDevices";
import type { Device } from "../types";

const onboardSchema = z.object({
  label: z.string().min(2, "Rótulo obrigatório (mínimo 2 caracteres)"),
  ip_ranges: z
    .string()
    .min(1, "Informe ao menos um CIDR")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

type OnboardForm = z.infer<typeof onboardSchema>;

export function DispositivosTab() {
  const { employee: me } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  const { data: devices, isLoading, isError } = useDevices();
  const onboardMutation = useOnboardDevice();
  const deactivateMutation = useDeactivateDevice();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OnboardForm>({ resolver: zodResolver(onboardSchema) });

  async function onSubmit(form: OnboardForm) {
    if (!me) return;
    setFormError(null);
    try {
      const result = await onboardMutation.mutateAsync({
        company_id: me.companyId,
        label: form.label,
        ip_ranges: form.ip_ranges as string[],
      });
      setNewToken(result.token);
      reset();
      setShowForm(false);
    } catch {
      setFormError("Erro ao cadastrar dispositivo. Verifique os dados.");
    }
  }

  async function handleDeactivate(deviceId: string) {
    try {
      await deactivateMutation.mutateAsync(deviceId);
      setConfirmDeactivate(null);
    } catch {
      // silencioso
    }
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Dispositivos autorizados</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {showForm ? "Cancelar" : "+ Novo dispositivo"}
        </button>
      </div>

      {/* Token recém-gerado — exibido uma única vez */}
      {newToken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-800">Token gerado — salve agora!</p>
              <p className="mt-1 text-sm text-amber-700">
                Este token será exibido apenas uma vez. Copie e salve em local seguro no dispositivo.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-sm text-amber-900 ring-1 ring-amber-200">
                  {newToken}
                </code>
                <button
                  onClick={copyToken}
                  className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  {tokenCopied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setNewToken(null)}
              className="text-sm text-amber-600 hover:underline"
            >
              Confirmar que salvei o token
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Registrar dispositivo</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Rótulo do dispositivo</label>
              <input
                {...register("label")}
                placeholder="ex: Recepção - PC 01"
                className={cn(
                  "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.label
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                )}
              />
              {errors.label && <p className="mt-1 text-xs text-red-600">{errors.label.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                IPs autorizados (CIDR, separados por vírgula)
              </label>
              <input
                {...register("ip_ranges")}
                placeholder="ex: 192.168.1.0/24, 10.0.0.5/32"
                className={cn(
                  "block w-full rounded-lg border px-3 py-2 font-mono text-sm shadow-sm transition focus:outline-none focus:ring-2",
                  errors.ip_ranges
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
                )}
              />
              {errors.ip_ranges && (
                <p className="mt-1 text-xs text-red-600">{errors.ip_ranges.message as string}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Use /32 para IP único. Exemplo: 192.168.1.50/32
              </p>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {formError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {isSubmitting ? "Registrando…" : "Registrar dispositivo"}
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
          <div className="py-12 text-center text-sm text-red-500">Erro ao carregar dispositivos.</div>
        )}
        {devices && devices.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Nenhum dispositivo cadastrado.</div>
        )}
        {devices && devices.length > 0 && (
          <div className="overflow-x-auto">
          <table className="min-w-[520px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Rótulo</th>
                <th className="px-4 py-3">IPs autorizados</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {devices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  confirming={confirmDeactivate === device.id}
                  onRequestDeactivate={() => setConfirmDeactivate(device.id)}
                  onCancelDeactivate={() => setConfirmDeactivate(null)}
                  onConfirmDeactivate={() => handleDeactivate(device.id)}
                  isPending={deactivateMutation.isPending}
                />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceRow({
  device,
  confirming,
  onRequestDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  isPending,
}: {
  device: Device;
  confirming: boolean;
  onRequestDeactivate: () => void;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: () => void;
  isPending: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 font-medium text-gray-900">{device.label}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {device.ip_ranges.map((cidr) => (
            <code key={cidr} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              {cidr}
            </code>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {device.last_seen_at
          ? format(new Date(device.last_seen_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "Nunca"}
      </td>
      <td className="px-4 py-3">
        {device.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Inativo
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {device.is_active && (
          confirming ? (
            <span className="flex items-center justify-end gap-2">
              <button
                onClick={onConfirmDeactivate}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                onClick={onCancelDeactivate}
                className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              onClick={onRequestDeactivate}
              className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600"
            >
              Desativar
            </button>
          )
        )}
      </td>
    </tr>
  );
}
