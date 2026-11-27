"use client";

import * as React from "react";
import {
  FileType,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { ServerOperationProgress } from "@/components/server-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import {
  MAX_SERVER_FILE_BYTES,
  MAX_SERVER_FILE_MB,
  OPERATION_STAGE_LABELS,
  postFileToBackend,
  type OperationStage,
} from "@/lib/api";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

export function WordToPdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [stage, setStage] = React.useState<OperationStage>("connecting");
  const [slowStart, setSlowStart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

  const inFlightRef = React.useRef(false);

  const selectFile = React.useCallback((selected: File) => {
    if (inFlightRef.current) return;
    setError(null);
    setResult(null);
    const lower = selected.name.toLowerCase();
    if (!lower.endsWith(".doc") && !lower.endsWith(".docx")) {
      setError("Selecciona un archivo de Microsoft Word (.doc o .docx).");
      return;
    }
    if (selected.size > MAX_SERVER_FILE_BYTES) {
      setError(
        `El archivo pesa ${formatBytes(selected.size)} y excede el límite de ${MAX_SERVER_FILE_MB} MB de la versión gratuita.`
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
    if (!file || inFlightRef.current) return;
    inFlightRef.current = true;
    setProcessing(true);
    setStage("connecting");
    setSlowStart(false);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await postFileToBackend(
        "/api/word-to-pdf",
        formData,
        `${stripExtension(file.name)}.pdf`,
        {
          onSlowStart: setSlowStart,
          onStageChange: setStage,
        }
      );

      setResult({ blob: res.blob, filename: res.filename });
      downloadBlob(res.blob, res.filename);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al convertir Word a PDF."
      );
    } finally {
      inFlightRef.current = false;
      setProcessing(false);
      setSlowStart(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onFilesSelected={(files) => files[0] && selectFile(files[0])}
          title="Sube tu documento Word (.doc o .docx)"
          subtitle="Conversión rápida a PDF de alta fidelidad usando LibreOffice Writer headless."
          helperText={`Peso máximo: ${MAX_SERVER_FILE_MB} MB • Sin marcas de agua`}
        />
      ) : (
        <Card className="mx-auto max-w-2xl space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#CA8A04] dark:text-[#FACC15]">
                <FileType className="h-5 w-5" />
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
              Cambiar archivo
            </Button>
          </div>

          {processing && (
            <ServerOperationProgress stage={stage} slowStart={slowStart} />
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">¡PDF generado correctamente!</p>
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
            aria-busy={processing}
            onClick={handleConvert}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {OPERATION_STAGE_LABELS[stage]}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Convertir a PDF
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
