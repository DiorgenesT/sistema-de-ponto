import { type FaceStatus } from "../hooks/useFaceDetection";

interface FaceOverlayProps {
  status: FaceStatus;
  confidence: number;
}

const STATUS_CONFIG = {
  loading:    { color: "border-gray-400",  text: "Carregando reconhecimento facial...", pulse: true },
  no_face:    { color: "border-yellow-400", text: "Posicione seu rosto no centro",       pulse: false },
  detected:   { color: "border-green-400",  text: "Rosto detectado — aguarde...",        pulse: true },
  capturing:  { color: "border-blue-400",   text: "Capturando...",                       pulse: true },
  error:      { color: "border-red-500",    text: "Erro no reconhecimento facial",       pulse: false },
} as const;

export function FaceOverlay({ status, confidence }: FaceOverlayProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {/* Guia oval de posicionamento */}
      <div
        className={`
          h-72 w-56 rounded-full border-4 transition-colors duration-300
          ${config.color}
          ${config.pulse ? "animate-pulse" : ""}
        `}
      />

      {/* Cantos de enquadramento */}
      <div className="absolute top-1/2 left-1/2 h-72 w-56 -translate-x-1/2 -translate-y-1/2">
        {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4",
          "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((cls, i) => (
          <div key={i} className={`absolute h-8 w-8 ${cls} ${config.color} rounded-sm`} />
        ))}
      </div>

      {/* Status text */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1">
        <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
          {config.text}
        </p>
        {status === "detected" && (
          <div className="flex items-center gap-2 rounded-full bg-green-900/60 px-3 py-1 backdrop-blur-sm">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-green-300">
              Confiança: {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
