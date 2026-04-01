import { useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AttendanceResponse } from "../types";

interface AttendanceResultProps {
  record: AttendanceResponse;
  employeeName: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function AttendanceResult({
  record,
  employeeName,
  onDismiss,
  autoDismissMs = 5000,
}: AttendanceResultProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  const isIn = record.record_type === "IN";
  const time = format(new Date(record.recorded_at), "HH:mm:ss", { locale: ptBR });
  const date = format(new Date(record.recorded_at), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-gray-800 p-8 text-center shadow-2xl">
      {/* Ícone */}
      <div className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl
        ${isIn ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>
        {isIn ? "✓" : "→"}
      </div>

      {/* Nome */}
      <div>
        <p className="text-lg font-semibold text-white">{employeeName}</p>
        <p className={`text-sm font-medium ${isIn ? "text-green-400" : "text-blue-400"}`}>
          {isIn ? "Entrada registrada" : "Saída registrada"}
        </p>
      </div>

      {/* Horário */}
      <div className="rounded-xl bg-gray-700/50 px-8 py-4">
        <p className="text-4xl font-mono font-bold text-white">{time}</p>
        <p className="mt-1 text-sm capitalize text-gray-400">{date}</p>
      </div>

      {/* Confiança facial */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
        Confiança biométrica: {Math.round(record.facial_confidence * 100)}%
      </div>

      {/* Barra de auto-dismiss */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full ${isIn ? "bg-green-500" : "bg-blue-500"} animate-[shrink_5s_linear_forwards]`}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
