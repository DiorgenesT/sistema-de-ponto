import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useEnrollFace } from "../hooks/useEmployees";

interface FaceEnrollModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

function extractApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    if (res?.data?.error?.message) return res.data.error.message;
  }
  return "Erro ao cadastrar biometria. Tente novamente.";
}

export function FaceEnrollModal({ employeeId, employeeName, onClose }: FaceEnrollModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enrollMutation = useEnrollFace();

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setError("Falha ao capturar imagem. Verifique a câmera.");
      return;
    }
    // Remover prefixo data URL — backend espera só o base64
    const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, "");
    setCaptured(base64);
    setError(null);
  }, []);

  const handleRetake = () => {
    setCaptured(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!captured) return;
    setError(null);
    try {
      await enrollMutation.mutateAsync({ employeeId, image_b64: captured });
      onClose();
    } catch (err: unknown) {
      const msg = extractApiError(err);
      setError(msg);
      setCaptured(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Cadastro de biometria facial</h2>
            <p className="text-xs text-gray-500">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <div className="flex flex-col items-center gap-4 p-6">
          {!captured ? (
            <>
              <div className="overflow-hidden rounded-xl bg-gray-100" style={{ width: 280, height: 210 }}>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user", width: 280, height: 210 }}
                  onUserMediaError={() => setError("Câmera não disponível.")}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-center text-xs text-gray-500">
                Centralize o rosto do funcionário e clique em Capturar
              </p>
              {error && <p className="text-center text-xs text-red-600">{error}</p>}
              <button
                onClick={handleCapture}
                className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                Capturar foto
              </button>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl bg-gray-100" style={{ width: 280, height: 210 }}>
                <img
                  src={`data:image/jpeg;base64,${captured}`}
                  alt="Foto capturada"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-center text-xs text-gray-500">
                Confirme que o rosto está nítido e centralizado
              </p>
              {error && <p className="text-center text-xs text-red-600">{error}</p>}
              <div className="flex w-full gap-3">
                <button
                  onClick={handleRetake}
                  disabled={enrollMutation.isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Tirar novamente
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={enrollMutation.isPending}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {enrollMutation.isPending ? "Salvando…" : "Confirmar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
