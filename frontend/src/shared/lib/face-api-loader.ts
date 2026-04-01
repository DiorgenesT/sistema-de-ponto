/**
 * Carregamento lazy dos modelos face-api.js.
 * Os modelos ficam em /public/models/ e são servidos pelo Cloudflare Pages.
 *
 * Modelos necessários:
 * - tiny_face_detector (detecção rápida client-side)
 * - face_landmark_68 (landmarks para qualidade da detecção)
 */

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const faceapi = await import("face-api.js");
    const MODEL_URL = "/models";

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
  })();

  return loadingPromise;
}

export async function detectFace(
  videoElement: HTMLVideoElement
): Promise<{ detected: boolean; confidence: number }> {
  const faceapi = await import("face-api.js");

  const detection = await faceapi
    .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true);

  if (!detection) {
    return { detected: false, confidence: 0 };
  }

  return {
    detected: true,
    confidence: detection.detection.score,
  };
}
