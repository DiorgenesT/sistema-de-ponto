/**
 * Coleta fingerprint do dispositivo para validação terciária (CLAUDE.md §Segurança).
 * Discrepância gera alerta, mas não bloqueia sozinho.
 */

export interface DeviceFingerprint {
  canvasHash: string;
  userAgent: string;
  timezone: string;
  screenResolution: string;
  colorDepth: number;
  hardwareConcurrency: number;
  platform: string;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function getCanvasHash(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "unavailable";

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Sistema Ponto 🕐", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Sistema Ponto 🕐", 4, 17);

    return hashString(canvas.toDataURL());
  } catch {
    return "unavailable";
  }
}

export function collectFingerprint(): DeviceFingerprint {
  return {
    canvasHash: getCanvasHash(),
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    platform: navigator.platform,
  };
}

export function fingerprintToString(fp: DeviceFingerprint): string {
  return hashString(JSON.stringify(fp));
}
