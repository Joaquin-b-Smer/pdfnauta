export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export const MAX_SERVER_FILE_MB = 20;
export const MAX_SERVER_FILE_BYTES = MAX_SERVER_FILE_MB * 1024 * 1024;
export const SERVER_TIMEOUT_MS = 90_000;
export const COLD_START_NOTICE_MS = 5_000;
export const WARMUP_TIMEOUT_MS = 60_000;
// Reuse ready state for 10 minutes (Render Free Tier sleeps after ~15 min idle)
const WARMUP_READY_TTL_MS = 10 * 60 * 1000;

export type BackendWarmupStatus = "idle" | "warming" | "ready" | "error";

export interface BackendWarmupState {
  status: BackendWarmupStatus;
  lastReadyAt: number | null;
  errorMessage: string | null;
}

export type OperationStage = "connecting" | "processing" | "downloading";

export const OPERATION_STAGE_LABELS: Record<OperationStage, string> = {
  connecting: "Conectando con el servidor…",
  processing: "Procesando archivo…",
  downloading: "Preparando descarga…",
};

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

// Module-level shared warmup state (no polling, no background timers)
let warmupState: BackendWarmupState = {
  status: "idle",
  lastReadyAt: null,
  errorMessage: null,
};
let inFlightWarmup: Promise<boolean> | null = null;
const warmupListeners = new Set<() => void>();

function notifyWarmupListeners() {
  warmupListeners.forEach((listener) => listener());
}

function setWarmupState(next: BackendWarmupState) {
  warmupState = next;
  notifyWarmupListeners();
}

export function isBackendRecentlyWarm(): boolean {
  return (
    warmupState.status === "ready" &&
    warmupState.lastReadyAt !== null &&
    Date.now() - warmupState.lastReadyAt < WARMUP_READY_TTL_MS
  );
}

export function getBackendWarmupState(): BackendWarmupState {
  return warmupState;
}

export function subscribeBackendWarmup(listener: () => void): () => void {
  warmupListeners.add(listener);
  return () => {
    warmupListeners.delete(listener);
  };
}

export function markBackendReady(): void {
  setWarmupState({
    status: "ready",
    lastReadyAt: Date.now(),
    errorMessage: null,
  });
}

/**
 * Triggers a single lightweight GET /health request (no files sent) to wake up
 * the Render backend before the user clicks Convert.
 * Deduplicates concurrent calls and reuses the active "ready" state without polling.
 */
export function ensureBackendWarmup(options?: { force?: boolean }): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (!options?.force && isBackendRecentlyWarm()) {
    return Promise.resolve(true);
  }

  if (inFlightWarmup) {
    return inFlightWarmup;
  }

  setWarmupState({
    status: "warming",
    lastReadyAt: warmupState.lastReadyAt,
    errorMessage: null,
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort("warmup-timeout"), WARMUP_TIMEOUT_MS);

  inFlightWarmup = fetch(`${API_BASE_URL}/health`, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      if (data && data.status && data.status !== "ok") {
        throw new Error("Servicio no disponible");
      }
      markBackendReady();
      return true;
    })
    .catch(() => {
      setWarmupState({
        status: "error",
        lastReadyAt: null,
        errorMessage:
          "No pudimos verificar el servidor todavía. Al pulsar convertir volveremos a intentarlo.",
      });
      return false;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      inFlightWarmup = null;
    });

  return inFlightWarmup;
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

async function extractErrorDetailFromBlob(blob: Blob | null, status: number): Promise<string> {
  let detail = `Error del servidor (${status}).`;
  if (!blob) return detail;
  try {
    const text = await blob.text();
    if (!text) return detail;
    try {
      const json = JSON.parse(text);
      if (json?.detail) return String(json.detail);
    } catch {
      return text.slice(0, 240);
    }
  } catch {
    // ignore read error
  }
  return detail;
}

export async function postFileToBackend(
  endpoint: string,
  formData: FormData,
  fallbackFilename: string,
  options?: {
    onSlowStart?: (isSlow: boolean) => void;
    onStageChange?: (stage: OperationStage) => void;
    externalSignal?: AbortSignal;
  }
): Promise<BackendFileResult> {
  let currentStage: OperationStage = "connecting";
  const emitStage = (stage: OperationStage) => {
    if (currentStage !== stage) {
      currentStage = stage;
      options?.onStageChange?.(stage);
    }
  };

  options?.onStageChange?.("connecting");

  const slowStartId = window.setTimeout(() => {
    options?.onSlowStart?.(true);
  }, COLD_START_NOTICE_MS);

  try {
    // If a lightweight /health warmup is already running, wait for it while showing
    // "Conectando con el servidor…" so the file upload hits an already-awake backend.
    if (inFlightWarmup) {
      await inFlightWarmup;
    }

    if (options?.externalSignal?.aborted) {
      throw new DOMException("Operación cancelada", "AbortError");
    }

    const result = await new Promise<BackendFileResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}${endpoint}`, true);
      xhr.responseType = "blob";
      xhr.timeout = SERVER_TIMEOUT_MS;

      const onExternalAbort = () => {
        xhr.abort();
      };
      options?.externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

      const cleanup = () => {
        options?.externalSignal?.removeEventListener("abort", onExternalAbort);
      };

      // Once request body upload finishes, the file is on the backend being processed
      xhr.upload.onload = () => {
        emitStage("processing");
      };

      // Once response headers arrive with 2xx status, the backend finished processing
      // and the browser is receiving the converted file for download
      xhr.onreadystatechange = () => {
        if (
          xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED &&
          xhr.status >= 200 &&
          xhr.status < 300
        ) {
          emitStage("downloading");
        }
      };

      xhr.onload = async () => {
        cleanup();
        const responseBlob =
          xhr.response instanceof Blob ? xhr.response : new Blob([]);

        if (xhr.status < 200 || xhr.status >= 300) {
          const detail = await extractErrorDetailFromBlob(responseBlob, xhr.status);
          reject(new Error(detail));
          return;
        }

        emitStage("downloading");
        markBackendReady();

        const filename = parseFilenameFromDisposition(
          xhr.getResponseHeader("Content-Disposition"),
          fallbackFilename
        );
        const originalSizeHeader = xhr.getResponseHeader("X-Original-Size");
        const compressedSizeHeader = xhr.getResponseHeader("X-Compressed-Size");
        const savingsHeader = xhr.getResponseHeader("X-Savings-Percent");

        resolve({
          blob: responseBlob,
          filename,
          headers: {
            originalSize: originalSizeHeader ? Number(originalSizeHeader) : undefined,
            compressedSize: compressedSizeHeader ? Number(compressedSizeHeader) : undefined,
            savingsPercent: savingsHeader ? Number(savingsHeader) : undefined,
            engine: xhr.getResponseHeader("X-Conversion-Engine") || undefined,
            ocrUsed: xhr.getResponseHeader("X-OCR-Used") === "true",
          },
        });
      };

      xhr.ontimeout = () => {
        cleanup();
        reject(
          new Error(
            "La solicitud superó los 90 segundos de espera. Si el servidor gratuito recién despertaba, intenta nuevamente ahora que ya está activo."
          )
        );
      };

      xhr.onerror = () => {
        cleanup();
        reject(
          new Error(
            `No pudimos conectar con el motor de conversión (${API_BASE_URL}). Verifica tu conexión o si el servidor está activo.`
          )
        );
      };

      xhr.onabort = () => {
        cleanup();
        reject(new DOMException("Operación cancelada", "AbortError"));
      };

      xhr.send(formData);
    });

    return result;
  } finally {
    window.clearTimeout(slowStartId);
    options?.onSlowStart?.(false);
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
