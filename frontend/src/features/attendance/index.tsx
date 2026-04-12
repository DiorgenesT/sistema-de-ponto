import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AttendanceCamera } from "./components/AttendanceCamera";
import { AttendanceResult } from "./components/AttendanceResult";
import { validateTerminalCode } from "./hooks/useValidateCode";
import { useAuthStore } from "@/store/auth";
import type { AttendanceResponse } from "./types";

type PageState =
  | { view: "code" }
  | { view: "camera"; terminalCode: string; employeeName: string }
  | { view: "success"; record: AttendanceResponse }
  | { view: "error"; message: string };

export default function AttendancePage() {
  const [state, setState] = useState<PageState>({ view: "code" });
  const navigate = useNavigate();
  const { deviceToken, setDeviceToken } = useAuthStore();

  if (!deviceToken) {
    return <TerminalLocked />;
  }

  const handleCodeConfirmed = (code: string, employeeName: string) => {
    setState({ view: "camera", terminalCode: code, employeeName });
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
              <p className="text-sm font-medium text-gray-400">Olá,</p>
              <h1 className="text-2xl font-bold text-white">{state.employeeName}</h1>
              <p className="mt-1 text-sm text-gray-400">Olhe para a câmera para registrar o ponto</p>
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

type CodeStatus = "idle" | "loading" | "error";

function CodeEntry({ onConfirm }: { onConfirm: (code: string, employeeName: string) => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const MAX_DIGITS = 4;

  const handleKey = (key: string) => {
    if (status === "loading") return;
    if (key === "C") {
      setDigits([]);
      setStatus("idle");
      setErrorMsg("");
      return;
    }
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      if (status === "error") { setStatus("idle"); setErrorMsg(""); }
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    const next = [...digits, key];
    setDigits(next);
    setStatus("idle");
    setErrorMsg("");

    if (next.length === MAX_DIGITS) {
      void submitCode(next.join(""));
    }
  };

  async function submitCode(code: string) {
    setStatus("loading");
    try {
      const employee = await validateTerminalCode(code);
      // breve pausa para o usuário ver o código completo antes de abrir câmera
      setTimeout(() => {
        onConfirm(code, employee.full_name);
        setDigits([]);
        setStatus("idle");
      }, 300);
    } catch {
      setStatus("error");
      setErrorMsg("Código inválido. Tente novamente.");
      // limpar dígitos após 1.5s para nova tentativa
      setTimeout(() => {
        setDigits([]);
        setStatus("idle");
        setErrorMsg("");
      }, 1500);
    }
  }

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
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-4">
          {Array.from({ length: MAX_DIGITS }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full transition-colors duration-150 ${
                status === "error"
                  ? "bg-red-500"
                  : status === "loading"
                  ? "bg-yellow-400 animate-pulse"
                  : i < digits.length
                  ? "bg-white"
                  : "bg-gray-700"
              }`}
            />
          ))}
        </div>
        {status === "loading" && (
          <p className="text-xs text-gray-400">Verificando...</p>
        )}
        {status === "error" && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            disabled={status === "loading"}
            className={`
              flex h-16 w-20 items-center justify-center rounded-2xl text-xl font-semibold
              transition-all duration-100 active:scale-95 disabled:opacity-50
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
