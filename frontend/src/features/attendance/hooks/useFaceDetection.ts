import { useCallback, useEffect, useRef, useState } from "react";
import { detectFace, loadFaceApiModels } from "@/shared/lib/face-api-loader";

export type FaceStatus = "loading" | "no_face" | "detected" | "capturing" | "error";

interface UseFaceDetectionReturn {
  faceStatus: FaceStatus;
  confidence: number;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
  captureFrame: (video: HTMLVideoElement) => string | null;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("loading");
  const [confidence, setConfidence] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadFaceApiModels()
      .then(() => setFaceStatus("no_face"))
      .catch(() => setFaceStatus("error"));

    return () => stopDetection();
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      try {
        const result = await detectFace(video);
        if (result.detected) {
          setFaceStatus("detected");
          setConfidence(result.confidence);
        } else {
          setFaceStatus("no_face");
          setConfidence(0);
        }
      } catch {
        setFaceStatus("error");
      }
    }, 500); // checar a cada 500ms
  }, []);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const captureFrame = useCallback((video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      // Retorna base64 sem o prefixo data:image/jpeg;base64,
      return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    } catch {
      return null;
    }
  }, []);

  return { faceStatus, confidence, startDetection, stopDetection, captureFrame };
}
