import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AttendanceCamera } from "./components/AttendanceCamera";
import { AttendanceResult } from "./components/AttendanceResult";
import { useAuthStore } from "@/store/auth";
import type { AttendanceResponse } from "./types";

type PageState =
  | { view: "code" }
  | { view: "camera"; terminalCode: string }
  | { view: "success"; record: AttendanceResponse }
  | { view: "error"; message: string };

export default function AttendancePage() {
  const [state, setState] = useState<PageState>({ view: "code" });
  const navigate = useNavigate();
  const { deviceToken, setDeviceToken } = useAuthStore();

  if (!deviceToken) {
    return <TerminalLocked />;
  }

  const handleCodeConfirmed = (code: string) => {
    setState({ view: "camera", terminalCode: code });
  };

  const handleSuccess = (record: AttendanceResponse) => {
    setState({ view: "success", record });
  };

  const handleError = (message: string, code?: string) => {
    if (code === "INVALID_DEVICE_TOKEN" || code === "UNAUTHORIZED_DEVICE") {
      setDeviceToken(null);
      navigate("/device-check", { replace: true });
      return;
    }
    setState({ view: "error", message });
    setTimeout(() => setState({ view: "code" }), 4000);
  };

  const handleDismiss = () => setState({ view: "code" });
  const handleCancelCamera = () => setState({ view: "code" });

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
        {state.view === "code" && (
          <CodeEntry onConfirm={handleCodeConfirmed} />
        )}

        {state.view === "camera" && (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-white">Verificação facial</h1>
              <p className="mt-1 text-sm text-gray-400">
                Código <span className="font-mono font-bold text-white">{state.terminalCode}</span> — olhe para a câmera
              </p>
            </div>
            <AttendanceCamera
              terminalCode={state.terminalCode}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancelCamera}
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
            <p className="text-xs text-gray-500">Voltando em instantes...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-xs text-gray-700">Terminal autorizado • Acesso monitorado</p>
      </div>
    </div>
  );
}

// ---- Tela de entrada do código -----------------------------------------------

function CodeEntry({ onConfirm }: { onConfirm: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const MAX_DIGITS = 4;

  const handleKey = (key: string) => {
    if (key === "C") {
      setDigits([]);
      return;
    }
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    const next = [...digits, key];
    setDigits(next);
    if (next.length === MAX_DIGITS) {
      setTimeout(() => {
        onConfirm(next.join(""));
        setDigits([]);
      }, 200);
    }
  };

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["C", "0", "⌫"],
  ];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-white">Registro de Ponto</h1>
        <p className="mt-1 text-sm text-gray-400">Digite seu código de acesso</p>
      </div>

      {/* Indicadores de dígitos */}
      <div className="flex gap-4">
        {Array.from({ length: MAX_DIGITS }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full transition-colors duration-150 ${
              i < digits.length ? "bg-white" : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className={`
              flex h-16 w-20 items-center justify-center rounded-2xl text-xl font-semibold
              transition-all duration-100 active:scale-95
              ${key === "C"
                ? "bg-red-900/40 text-red-400 hover:bg-red-900/60"
                : key === "⌫"
                ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                : "bg-gray-800 text-white hover:bg-gray-700"
              }
            `}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Clock -------------------------------------------------------------------

function Clock() {
  const [time, setTime] = useState(() => format(new Date(), "HH:mm:ss"));
  useEffect(() => {
    const interval = setInterval(() => setTime(format(new Date(), "HH:mm:ss")), 1000);
    return () => clearInterval(interval);
  }, []);
  return <span className="font-mono text-lg font-bold text-white">{time}</span>;
}

// ---- Terminal bloqueado ------------------------------------------------------

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
