"use client";

import * as React from "react";
import {
  FileText,
  ScanText,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import {
  convertPdfToWordClientSide,
  type ConversionProgress,
} from "@/lib/pdf-to-word-engine";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

export function PdfToWordTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [forceOcr, setForceOcr] = React.useState(false);

  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState<ConversionProgress>({
    percent: 0,
    message: "Analizando PDF...",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    blob: Blob;
    filename: string;
    pageCount: number;
    ocrPages: number;
    textPages: number;
    tablesDetected: number;
  } | null>(null);

  const inFlightRef = React.useRef(false);

  const selectFile = React.useCallback((selected: File) => {
    if (inFlightRef.current) return;
    setError(null);
    setResult(null);
    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Por favor selecciona un archivo con extensión .pdf.");
      return;
    }
    setFile(selected);
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) selectFile(pending);
  }, [consumePendingFile, selectFile]);

  const handleConvert = async () => {
    if (!file || inFlightRef.current) return;
    inFlightRef.current = true;
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgress({ percent: 2, message: "Analizando PDF..." });

    try {
      const converted = await convertPdfToWordClientSide(file, {
        forceOcr,
        onProgress: setProgress,
      });

      const outFilename = `${stripExtension(file.name)}.docx`;
      setResult({
        blob: converted.blob,
        filename: outFilename,
        pageCount: converted.pageCount,
        ocrPages: converted.ocrPages,
        textPages: converted.textPages,
        tablesDetected: converted.tablesDetected,
      });

      downloadBlob(converted.blob, outFilename);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No pudimos convertir el PDF: ${err.message}`
          : "No pudimos convertir este PDF. Verificá que no esté dañado o protegido con contraseña."
      );
    } finally {
      inFlightRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="space-y-4">
          <FileDropzone
            accept=".pdf,application/pdf"
            onFilesSelected={(files) => files[0] && selectFile(files[0])}
            title="Elegí o arrastrá tu PDF para convertirlo a Word (.docx)"
            subtitle="Detectamos automáticamente si el PDF tiene texto o es una foto/escaneo y reconstruimos títulos, listas y tablas directamente en tu dispositivo."
            buttonLabel="Elegir PDF"
            buttonClassName="px-6 py-2.5 text-sm sm:text-base"
            helperText="100% en tu navegador • Sin límite de servidor • Sin tiempo máximo"
          />

          {error && (
            <div
              role="alert"
              className="mx-auto flex max-w-2xl items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500 sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <Card className="mx-auto max-w-2xl space-y-5 p-5 sm:p-6">
          {/* File header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#CA8A04] dark:text-[#FACC15]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-bold text-foreground"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => {
                setFile(null);
                setResult(null);
                setError(null);
              }}
              className="min-h-10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar PDF
            </Button>
          </div>

          {/* Smart Auto-OCR info + Force OCR toggle */}
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-background/70 p-4 transition-colors hover:border-[#FACC15]/60">
            <div className="flex items-start gap-3">
              <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-[#CA8A04] dark:text-[#FACC15]" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Forzar OCR en todas las páginas (Español)
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Por defecto detectamos automáticamente si cada página es texto o
                  escaneo/foto. Activá esta opción solo si querés leer todas las páginas
                  con OCR a 200 DPI.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={forceOcr}
              disabled={processing}
              onChange={(e) => setForceOcr(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FACC15]"
            />
          </label>

          {/* Real Progress Bar (no timeout) */}
          {processing && (
            <div
              role="status"
              aria-live="polite"
              className="space-y-3 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/[0.08] p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#CA8A04] dark:text-[#FACC15]" />
                  <span>{progress.message}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[#CA8A04] dark:text-[#FACC15]">
                  {progress.percent}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                aria-label={progress.message}
                className="h-3 w-full overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-[#FACC15] transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(3, progress.percent)}%` }}
                />
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Procesando de a 1 página en tu dispositivo (sin límite de tiempo). Si
                usás OCR por primera vez, se descarga el modelo liviano de español una
                sola vez.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500 sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 sm:text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">¡Conversión completada en tu dispositivo!</p>
                  <p>
                    {result.filename} ({formatBytes(result.blob.size)})
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold">
                      {result.pageCount} pág.
                    </span>
                    {result.ocrPages > 0 && (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold">
                        {result.ocrPages} con OCR
                      </span>
                    )}
                    {result.textPages > 0 && (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold">
                        {result.textPages} texto directo
                      </span>
                    )}
                    {result.tablesDetected > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold">
                        <Table2 className="h-3 w-3" />
                        {result.tablesDetected} tabla
                        {result.tablesDetected === 1 ? "" : "s"} reconstruida
                        {result.tablesDetected === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                className="min-h-12 w-full text-base"
                onClick={() => downloadBlob(result.blob, result.filename)}
              >
                <Download className="h-5 w-5" />
                Descargar Word (.docx)
              </Button>
            </div>
          )}

          {!result && (
            <Button
              type="button"
              size="lg"
              className="min-h-12 w-full text-base"
              disabled={processing}
              aria-busy={processing}
              onClick={handleConvert}
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {progress.message} ({progress.percent}%)
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Convertir a Word (.docx)
                </>
              )}
            </Button>
          )}
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tus archivos nunca salen de tu celular o PC. Todo el análisis, OCR y armado del
          Word ocurren localmente.
        </span>
      </p>
    </div>
  );
}
