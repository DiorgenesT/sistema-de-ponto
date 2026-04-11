import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useDeleteFace, useEnrollFace, useFaceStatus } from "../hooks/useEmployees";

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
  const { data: faceStatus, isLoading: isLoadingStatus } = useFaceStatus(employeeId);
  const enrollMutation = useEnrollFace();
  const deleteMutation = useDeleteFace();

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (isLoadingStatus) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-2xl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-gray-600">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Biometria facial</h2>
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
        {faceStatus?.enrolled ? (
          <EnrolledView
            employeeId={employeeId}
            photob64={faceStatus.photo_b64 ?? null}
            enrolledAt={faceStatus.enrolled_at}
            deleteMutation={deleteMutation}
            onClose={onClose}
          />
        ) : (
          <CaptureView
            employeeId={employeeId}
            enrollMutation={enrollMutation}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ---- Vista: rosto já cadastrado -----------------------------------------------

interface EnrolledViewProps {
  employeeId: string;
  photob64: string | null;
  enrolledAt?: string;
  deleteMutation: ReturnType<typeof useDeleteFace>;
  onClose: () => void;
}

function EnrolledView({ employeeId, photob64, enrolledAt, deleteMutation, onClose }: EnrolledViewProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const enrollMutation = useEnrollFace();

  if (showCapture) {
    return (
      <CaptureView
        employeeId={employeeId}
        enrollMutation={enrollMutation}
        onClose={onClose}
        onBack={() => setShowCapture(false)}
      />
    );
  }

  async function handleDelete() {
    await deleteMutation.mutateAsync(employeeId);
    onClose();
  }

  const enrolledDate = enrolledAt
    ? new Date(enrolledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* Foto cadastrada */}
      <div className="overflow-hidden rounded-xl bg-gray-100" style={{ width: 280, height: 210 }}>
        {photob64 ? (
          <img
            src={`data:image/jpeg;base64,${photob64}`}
            alt="Foto cadastrada"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <span className="text-4xl">👤</span>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Biometria cadastrada
        </p>
        {enrolledDate && (
          <p className="mt-0.5 text-xs text-gray-400">Cadastrada em {enrolledDate}</p>
        )}
      </div>

      {deleteMutation.isError && (
        <p className="text-center text-xs text-red-600">Erro ao excluir. Tente novamente.</p>
      )}

      {confirmDelete ? (
        <div className="w-full rounded-lg bg-red-50 p-4 text-center">
          <p className="mb-3 text-sm font-medium text-red-700">Confirmar exclusão?</p>
          <p className="mb-4 text-xs text-red-500">
            Os dados biométricos serão excluídos permanentemente (Art. 18 LGPD).
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <button
            onClick={() => setShowCapture(true)}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Cadastrar novo rosto
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Excluir biometria
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Vista: captura -----------------------------------------------------------

interface CaptureViewProps {
  employeeId: string;
  enrollMutation: ReturnType<typeof useEnrollFace>;
  onClose: () => void;
  onBack?: () => void;
}

function CaptureView({ employeeId, enrollMutation, onClose, onBack }: CaptureViewProps) {
  const webcamRef = useRef<Webcam>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setError("Falha ao capturar imagem. Verifique a câmera.");
      return;
    }
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
      setError(extractApiError(err));
      setCaptured(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {onBack && (
        <button
          onClick={onBack}
          className="self-start text-xs text-gray-400 hover:text-gray-600"
        >
          ← Voltar
        </button>
      )}

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
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
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
  );
}
