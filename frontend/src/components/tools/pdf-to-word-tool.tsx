"use client";

import * as React from "react";
import {
  FileText,
  ScanText,
  Download,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import {
  MAX_SERVER_FILE_BYTES,
  MAX_SERVER_FILE_MB,
  postFileToBackend,
} from "@/lib/api";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

export function PdfToWordTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [useOcr, setUseOcr] = React.useState(false);

  const [processing, setProcessing] = React.useState(false);
  const [slowStart, setSlowStart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    blob: Blob;
    filename: string;
    engine?: string;
  } | null>(null);

  const selectFile = React.useCallback((selected: File) => {
    setError(null);
    setResult(null);
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("Por favor selecciona un archivo con extensión .pdf.");
      return;
    }
    if (selected.size > MAX_SERVER_FILE_BYTES) {
      setError(
        `El archivo pesa ${formatBytes(selected.size)} y supera el límite de ${MAX_SERVER_FILE_MB} MB de la versión gratuita. Prueba comprimiéndolo o separándolo primero.`
      );
      return;
    }
    setFile(selected);
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) selectFile(pending);
  }, [consumePendingFile, selectFile]);

  const handleConvert = async () => {
    if (!file) return;
    setProcessing(true);
    setSlowStart(false);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("use_ocr", String(useOcr));

      const res = await postFileToBackend(
        "/api/pdf-to-word",
        formData,
        `${stripExtension(file.name)}.docx`,
        { onSlowStart: setSlowStart }
      );

      setResult({
        blob: res.blob,
        filename: res.filename,
        engine: res.headers.engine,
      });
      downloadBlob(res.blob, res.filename);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al convertir el PDF a Word."
      );
    } finally {
      setProcessing(false);
      setSlowStart(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => files[0] && selectFile(files[0])}
          title="Sube tu PDF para convertirlo a Word editable (.docx)"
          subtitle="Conserva tablas, columnas, fuentes e imágenes. Incluye opción de OCR para documentos escaneados."
          helperText={`Peso máximo: ${MAX_SERVER_FILE_MB} MB • Borrado automático tras la descarga`}
        />
      ) : (
        <Card className="mx-auto max-w-2xl space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#CA8A04] dark:text-[#FACC15]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{file.name}</p>
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
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar PDF
            </Button>
          </div>

          {/* OCR Toggle */}
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-background/70 p-4 transition-colors hover:border-[#FACC15]/60">
            <div className="flex items-start gap-3">
              <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-[#CA8A04] dark:text-[#FACC15]" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Activar OCR (Documento escaneado)
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Activa esta opción si tu PDF contiene imágenes de texto o páginas
                  escaneadas en lugar de texto seleccionable (Español + Inglés).
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useOcr}
              disabled={processing}
              onChange={(e) => setUseOcr(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FACC15]"
            />
          </label>

          {slowStart && (
            <div className="flex items-start gap-3 rounded-xl border border-[#FACC15]/50 bg-[#FACC15]/12 p-4 text-xs leading-relaxed text-foreground">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-[#CA8A04] dark:text-[#FACC15]" />
              <div>
                <p className="font-bold">
                  Iniciando motor de conversión gratuito, esto puede demorar hasta 40
                  segundos la primera vez...
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Por favor mantén esta pestaña abierta; la descarga comenzará
                  automáticamente en cuanto termine.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">¡Conversión completada!</p>
                  <p className="mt-0.5">
                    {result.filename} ({formatBytes(result.blob.size)})
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadBlob(result.blob, result.filename)}
              >
                <Download className="h-3.5 w-3.5" />
                Volver a descargar
              </Button>
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={processing}
            onClick={handleConvert}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {useOcr ? "Ejecutando OCR y generando .docx..." : "Convirtiendo PDF a Word..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Convertir a Word (.docx)
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
