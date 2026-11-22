"use client";

import * as React from "react";
import {
  Minimize2,
  Download,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
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

type CompressionLevel = "extreme" | "recommended" | "low";

const LEVELS: {
  id: CompressionLevel;
  title: string;
  tag: string;
  description: string;
}[] = [
  {
    id: "extreme",
    title: "Extrema",
    tag: "Máximo ahorro",
    description: "Menor peso posible (ideal para correo o formularios con límite estricto).",
  },
  {
    id: "recommended",
    title: "Recomendada",
    tag: "Equilibrio ideal",
    description: "Excelente reducción de peso manteniendo muy buena lectura e imágenes.",
  },
  {
    id: "low",
    title: "Baja",
    tag: "Alta fidelidad",
    description: "Compresión ligera conservando gran nitidez para impresión o archivo.",
  },
];

export function CompressPdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [level, setLevel] = React.useState<CompressionLevel>("recommended");

  const [processing, setProcessing] = React.useState(false);
  const [slowStart, setSlowStart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    blob: Blob;
    filename: string;
    originalSize: number;
    compressedSize: number;
    savingsPercent: number;
  } | null>(null);

  const selectFile = React.useCallback((selected: File) => {
    setError(null);
    setResult(null);
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("Por favor selecciona un archivo PDF.");
      return;
    }
    if (selected.size > MAX_SERVER_FILE_BYTES) {
      setError(
        `El archivo pesa ${formatBytes(selected.size)} y supera el límite de ${MAX_SERVER_FILE_MB} MB de la versión gratuita.`
      );
      return;
    }
    setFile(selected);
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) selectFile(pending);
  }, [consumePendingFile, selectFile]);

  const handleCompress = async () => {
    if (!file) return;
    setProcessing(true);
    setSlowStart(false);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("level", level);

      const res = await postFileToBackend(
        "/api/compress-pdf",
        formData,
        `${stripExtension(file.name)}_comprimido.pdf`,
        { onSlowStart: setSlowStart }
      );

      const origSize = res.headers.originalSize ?? file.size;
      const compSize = res.headers.compressedSize ?? res.blob.size;
      const savings =
        res.headers.savingsPercent ??
        (origSize > 0
          ? Math.max(0, Math.round(((origSize - compSize) / origSize) * 1000) / 10)
          : 0);

      setResult({
        blob: res.blob,
        filename: res.filename,
        originalSize: origSize,
        compressedSize: compSize,
        savingsPercent: savings,
      });
      downloadBlob(res.blob, res.filename);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al comprimir el archivo PDF."
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
          title="Sube tu PDF para reducir su tamaño"
          subtitle="Elige entre 3 niveles de compresión (Extrema, Recomendada o Baja) y conoce el ahorro exacto."
          helperText={`Peso máximo: ${MAX_SERVER_FILE_MB} MB • Eliminación inmediata tras la descarga`}
        />
      ) : (
        <Card className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#CA8A04] dark:text-[#FACC15]">
                <Minimize2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  Peso original:{" "}
                  <strong className="text-foreground">{formatBytes(file.size)}</strong>
                </p>
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

          {/* 3 Compression levels */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Elige el nivel de compresión
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {LEVELS.map((item) => {
                const active = level === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={processing}
                    onClick={() => setLevel(item.id)}
                    className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-[#FACC15] bg-[#FACC15]/12 ring-1 ring-[#FACC15]"
                        : "border-border bg-background hover:border-[#FACC15]/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-foreground">
                          {item.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            active
                              ? "bg-[#FACC15] text-[#0A0A0A]"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {item.tag}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {slowStart && (
            <div className="flex items-start gap-3 rounded-xl border border-[#FACC15]/50 bg-[#FACC15]/12 p-4 text-xs leading-relaxed text-foreground">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-[#CA8A04] dark:text-[#FACC15]" />
              <div>
                <p className="font-bold">
                  Iniciando motor de conversión gratuito, esto puede demorar hasta 40
                  segundos la primera vez...
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Estamos despertando el servidor de compresión; tu archivo se descargará
                  automáticamente.
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
            <div className="space-y-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-extrabold">
                    ¡Compresión completada!
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FACC15] px-3 py-1 text-xs font-extrabold text-[#0A0A0A]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {result.savingsPercent > 0
                    ? `-${result.savingsPercent}% de peso ahorrado`
                    : "PDF ya optimizado al máximo"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-xl border border-border bg-card px-3.5 py-2">
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    Original
                  </span>
                  <span className="font-bold">{formatBytes(result.originalSize)}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="rounded-xl border border-[#FACC15]/50 bg-card px-3.5 py-2">
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    Comprimido
                  </span>
                  <span className="font-extrabold text-[#CA8A04] dark:text-[#FACC15]">
                    {formatBytes(result.compressedSize)}
                  </span>
                </div>
                <div className="ml-auto">
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
              </div>
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={processing}
            onClick={handleCompress}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Comprimiendo PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Comprimir y descargar PDF
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
