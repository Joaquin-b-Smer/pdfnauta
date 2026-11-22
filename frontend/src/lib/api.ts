export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export const MAX_SERVER_FILE_MB = 20;
export const MAX_SERVER_FILE_BYTES = MAX_SERVER_FILE_MB * 1024 * 1024;
export const SERVER_TIMEOUT_MS = 90_000;
export const COLD_START_NOTICE_MS = 5_000;

export interface BackendFileResult {
  blob: Blob;
  filename: string;
  headers: {
    originalSize?: number;
    compressedSize?: number;
    savingsPercent?: number;
    engine?: string;
    ocrUsed?: boolean;
  };
}

function parseFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // ignore decode error
    }
  }
  const simpleMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1].trim();
  }
  return fallback;
}

export async function postFileToBackend(
  endpoint: string,
  formData: FormData,
  fallbackFilename: string,
  options?: {
    onSlowStart?: (isSlow: boolean) => void;
    externalSignal?: AbortSignal;
  }
): Promise<BackendFileResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort("timeout"), SERVER_TIMEOUT_MS);
  const slowStartId = window.setTimeout(() => {
    options?.onSlowStart?.(true);
  }, COLD_START_NOTICE_MS);

  const onExternalAbort = () => controller.abort("cancelled");
  options?.externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Error del servidor (${response.status}).`;
      try {
        const json = await response.json();
        if (json?.detail) detail = String(json.detail);
      } catch {
        const txt = await response.text().catch(() => "");
        if (txt) detail = txt.slice(0, 240);
      }
      throw new Error(detail);
    }

    const blob = await response.blob();
    const filename = parseFilenameFromDisposition(
      response.headers.get("Content-Disposition"),
      fallbackFilename
    );
    const originalSizeHeader = response.headers.get("X-Original-Size");
    const compressedSizeHeader = response.headers.get("X-Compressed-Size");
    const savingsHeader = response.headers.get("X-Savings-Percent");

    return {
      blob,
      filename,
      headers: {
        originalSize: originalSizeHeader ? Number(originalSizeHeader) : undefined,
        compressedSize: compressedSizeHeader ? Number(compressedSizeHeader) : undefined,
        savingsPercent: savingsHeader ? Number(savingsHeader) : undefined,
        engine: response.headers.get("X-Conversion-Engine") || undefined,
        ocrUsed: response.headers.get("X-OCR-Used") === "true",
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "La solicitud superó los 90 segundos de espera. Si el servidor gratuito recién despertaba, intenta nuevamente ahora que ya está activo."
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        `No pudimos conectar con el motor de conversión (${API_BASE_URL}). Verifica tu conexión o si el servidor está activo.`
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    window.clearTimeout(slowStartId);
    options?.onSlowStart?.(false);
    options?.externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function sendFeedbackToBackend(payload: {
  category: string;
  message: string;
  email?: string;
  tool?: string;
}): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${API_BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
