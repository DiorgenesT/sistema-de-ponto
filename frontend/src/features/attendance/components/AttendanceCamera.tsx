import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { collectFingerprint, fingerprintToString } from "@/shared/lib/device-fingerprint";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useAttendanceRegister } from "../hooks/useAttendanceRegister";
import { FaceOverlay } from "./FaceOverlay";
import type { AttendanceResponse } from "../types";

interface AttendanceCameraProps {
  terminalCode: string;
  onSuccess: (record: AttendanceResponse) => void;
  onError: (message: string, code?: string) => void;
  onCancel: () => void;
}

const CAPTURE_DELAY_MS = 1500; // aguardar 1.5s após detecção antes de capturar

export function AttendanceCamera({ terminalCode, onSuccess, onError, onCancel }: AttendanceCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const { faceStatus, confidence, startDetection, stopDetection, captureFrame } = useFaceDetection();
  const registerMutation = useAttendanceRegister();

  // Iniciar detecção quando webcam estiver pronta
  const handleWebcamReady = useCallback(() => {
    const video = webcamRef.current?.video;
    if (video) startDetection(video);
  }, [startDetection]);

  // Auto-capturar quando rosto detectado com boa confiança
  useEffect(() => {
    if (faceStatus === "detected" && confidence >= 0.7 && !isCapturing) {
      if (!captureTimerRef.current) {
        captureTimerRef.current = setTimeout(() => {
          void triggerCapture();
          captureTimerRef.current = null;
        }, CAPTURE_DELAY_MS);
      }
    } else {
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
        captureTimerRef.current = null;
      }
    }
  }, [faceStatus, confidence, isCapturing]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopDetection();
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, [stopDetection]);

  const triggerCapture = async () => {
    const video = webcamRef.current?.video;
    if (!video || isCapturing) return;

    const image_b64 = captureFrame(video);
    if (!image_b64) {
      onError("Falha ao capturar imagem da câmera.");
      return;
    }

    setIsCapturing(true);
    stopDetection();

    try {
      const fp = collectFingerprint();
      const record = await registerMutation.mutateAsync({
        image_b64,
        terminal_code: terminalCode,
        device_fingerprint: fingerprintToString(fp),
      });
      onSuccess(record);
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      const code = extractErrorCode(err);
      onError(message, code);
      // Reiniciar detecção após erro
      setIsCapturing(false);
      const video = webcamRef.current?.video;
      if (video) startDetection(video);
    }
  };

  const currentStatus = isCapturing ? "capturing" : faceStatus;

  return (
    <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        }}
        onUserMedia={handleWebcamReady}
        onUserMediaError={() => onError("Câmera não disponível.")}
        className="h-full w-full object-cover"
      />
      <FaceOverlay status={currentStatus} confidence={confidence} />
      {/* Botão cancelar */}
      <button
        onClick={onCancel}
        className="absolute top-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs text-gray-300 hover:bg-black/70"
      >
        ← Código
      </button>
    </div>
  );
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    return response?.data?.error?.message ?? "Erro no registro de ponto.";
  }
  return "Erro no registro de ponto.";
}

function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: { code?: string } } } }).response;
    return response?.data?.error?.code;
  }
  return undefined;
}
