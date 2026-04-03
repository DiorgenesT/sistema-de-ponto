import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AttendanceCamera } from "./components/AttendanceCamera";
import { AttendanceResult } from "./components/AttendanceResult";
import { useAuthStore } from "@/store/auth";
import type { AttendanceResponse } from "./types";

type PageState =
  | { view: "camera" }
  | { view: "success"; record: AttendanceResponse }
  | { view: "error"; message: string };

export default function AttendancePage() {
  const [state, setState] = useState<PageState>({ view: "camera" });
  const deviceToken = useAuthStore((s) => s.deviceToken);

  // Terminal quiosque: bloqueado se não há device token autorizado
  if (!deviceToken) {
    return <TerminalLocked />;
  }

  const handleSuccess = (record: AttendanceResponse) => {
    setState({ view: "success", record });
  };

  const handleError = (message: string) => {
    setState({ view: "error", message });
    setTimeout(() => setState({ view: "camera" }), 4000);
  };

  const handleDismiss = () => setState({ view: "camera" });

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gray-950 px-4 py-8">
      {/* Header */}
      <div className="flex w-full max-w-sm items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Sistema de Ponto</p>
          <p className="text-sm font-medium text-gray-300 capitalize">
            {format(new Date(), "EEEE, dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <Clock />
      </div>

      {/* Conteúdo central */}
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {state.view === "camera" && (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-white">Registro de Ponto</h1>
              <p className="mt-1 text-sm text-gray-400">
                Olhe para a câmera para registrar sua entrada ou saída
              </p>
            </div>
            <AttendanceCamera
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </>
        )}

        {state.view === "success" && (
          <AttendanceResult
            record={state.record}
            employeeName={state.record.employee_name ?? ""}
            onDismiss={handleDismiss}
          />
        )}

        {state.view === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-red-950/50 border border-red-800 p-8 text-center">
            <div className="text-4xl">⚠</div>
            <div>
              <p className="font-semibold text-red-300">Falha no registro</p>
              <p className="mt-1 text-sm text-red-400">{state.message}</p>
            </div>
            <p className="text-xs text-gray-500">Tentando novamente...</p>
          </div>
        )}
      </div>

      {/* Footer — info do terminal */}
      <div className="text-center">
        <p className="text-xs text-gray-700">Terminal autorizado • Acesso monitorado</p>
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState(() => format(new Date(), "HH:mm:ss"));
  useEffect(() => {
    const interval = setInterval(() => setTime(format(new Date(), "HH:mm:ss")), 1000);
    return () => clearInterval(interval);
  }, []);
  return <span className="font-mono text-lg font-bold text-white">{time}</span>;
}

function TerminalLocked() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950">
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-semibold text-white">Terminal não autorizado</h1>
      <p className="text-sm text-gray-400">
        Este dispositivo precisa ser configurado pelo administrador.
      </p>
    </div>
  );
}
