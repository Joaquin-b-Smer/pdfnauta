"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  Minimize2,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument } from "@/lib/pdf-client";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

type CompressionLevel = "extreme" | "recommended" | "low";

const LEVELS: {
  id: CompressionLevel;
  title: string;
  tag: string;
  description: string;
  dpi: number;
  maxSide: number;
  quality: number;
}[] = [
  {
    id: "extreme",
    title: "Extrema",
    tag: "Máximo ahorro",
    description: "Menor peso posible (ideal para enviar por correo o WhatsApp).",
    dpi: 96,
    maxSide: 1200,
    quality: 0.48,
  },
  {
    id: "recommended",
    title: "Recomendada",
    tag: "Equilibrio ideal",
    description: "Buena reducción de peso manteniendo una lectura muy clara.",
    dpi: 132,
    maxSide: 1650,
    quality: 0.7,
  },
  {
    id: "low",
    title: "Baja",
    tag: "Alta fidelidad",
    description: "Compresión ligera conservando alta nitidez para impresión.",
    dpi: 175,
    maxSide: 2200,
    quality: 0.85,
  },
];

export function CompressPdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [level, setLevel] = React.useState<CompressionLevel>("recommended");

  const [processing, setProcessing] = React.useState(false);
  const [progressPct, setProgressPct] = React.useState(0);
  const [progressMsg, setProgressMsg] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    blob: Blob;
    filename: string;
    originalSize: number;
    compressedSize: number;
    savingsPercent: number;
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
      setError("Por favor selecciona un archivo PDF.");
      return;
    }
    setFile(selected);
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) selectFile(pending);
  }, [consumePendingFile, selectFile]);

  const handleCompress = async () => {
    if (!file || inFlightRef.current) return;
    inFlightRef.current = true;
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgressPct(5);
    setProgressMsg("Analizando PDF...");

    try {
      const cfg = LEVELS.find((l) => l.id === level) ?? LEVELS[1];
      const originalBytes = new Uint8Array(await file.arrayBuffer());
      const originalSize = originalBytes.byteLength;

      // 1. Try lossless re-serialization via pdf-lib first
      let bestBytes: Uint8Array = originalBytes;
      try {
        const cleanDoc = await PDFDocument.load(originalBytes, {
          ignoreEncryption: true,
        });
        const reserialized = await cleanDoc.save({ useObjectStreams: true });
        if (reserialized.byteLength < bestBytes.byteLength) {
          bestBytes = new Uint8Array(reserialized);
        }
      } catch {
        // Continue with raster optimization
      }

      // 2. Page-by-page JPEG optimization in the browser (1 page at a time for low RAM)
      const pdfProxy = await loadPdfJsDocument(originalBytes);
      try {
        const total = pdfProxy.numPages;
        const outPdf = await PDFDocument.create();

        for (let p = 1; p <= total; p++) {
          setProgressMsg(`Optimizando página ${p} de ${total}...`);
          setProgressPct(Math.round(10 + ((p - 1) / total) * 80));

          const page = await pdfProxy.getPage(p);
          const baseVp = page.getViewport({ scale: 1 });
          const longest = Math.max(baseVp.width, baseVp.height, 1);
          const scale = Math.min(cfg.dpi / 72, cfg.maxSide / longest);
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(vp.width));
          canvas.height = Math.max(1, Math.floor(vp.height));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("No se pudo inicializar el lienzo 2D.");

          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;

          const jpegBlob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("Error al comprimir página"))),
              "image/jpeg",
              cfg.quality
            )
          );
          canvas.width = 0;
          canvas.height = 0;

          const jpgBytes = new Uint8Array(await jpegBlob.arrayBuffer());
          const embedded = await outPdf.embedJpg(jpgBytes);
          const newPage = outPdf.addPage([baseVp.width, baseVp.height]);
          newPage.drawImage(embedded, {
            x: 0,
            y: 0,
            width: baseVp.width,
            height: baseVp.height,
          });
        }

        setProgressMsg("Guardando PDF comprimido...");
        setProgressPct(95);
        const rasterBytes = new Uint8Array(await outPdf.save({ useObjectStreams: true }));
        if (rasterBytes.byteLength < bestBytes.byteLength) {
          bestBytes = rasterBytes;
        }
      } finally {
        await pdfProxy.destroy();
      }

      const finalSize = bestBytes.byteLength;
      const savings =
        originalSize > 0
          ? Math.max(0, Math.round(((originalSize - finalSize) / originalSize) * 1000) / 10)
          : 0;

      const outFilename = `${stripExtension(file.name)}_comprimido.pdf`;
      const outBlob = new Blob([new Uint8Array(bestBytes)], { type: "application/pdf" });

      setProgressPct(100);
      setResult({
        blob: outBlob,
        filename: outFilename,
        originalSize,
        compressedSize: finalSize,
        savingsPercent: savings,
      });
      downloadBlob(outBlob, outFilename);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos comprimir el PDF. Verificá que no esté protegido o dañado."
      );
    } finally {
      inFlightRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => files[0] && selectFile(files[0])}
          title="Elegí o arrastrá tu PDF para reducir su tamaño"
          subtitle="Elegí entre 3 niveles de compresión (Extrema, Recomendada o Baja) 100% en tu navegador."
          buttonLabel="Elegir PDF"
          buttonClassName="px-6 py-2.5 text-sm sm:text-base"
          helperText="Procesamiento 100% local • Sin subir archivos a ningún servidor"
        />
      ) : (
        <Card className="mx-auto max-w-3xl space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#CA8A04] dark:text-[#FACC15]">
                <Minimize2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{file.name}</p>
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
              className="min-h-10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar PDF
            </Button>
          </div>

          {/* 3 Compression levels */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Elegí el nivel de compresión
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

          {processing && (
            <div
              role="status"
              aria-live="polite"
              className="space-y-2.5 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/[0.08] p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#CA8A04] dark:text-[#FACC15]" />
                  {progressMsg}
                </span>
                <span className="tabular-nums text-[#CA8A04] dark:text-[#FACC15]">
                  {progressPct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
                className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-[#FACC15] transition-all duration-200"
                  style={{ width: `${Math.max(4, progressPct)}%` }}
                />
              </div>
            </div>
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
            className="min-h-12 w-full text-base"
            disabled={processing}
            aria-busy={processing}
            onClick={handleCompress}
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {progressMsg} ({progressPct}%)
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Comprimir y descargar PDF
              </>
            )}
          </Button>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tus archivos no salen de tu dispositivo. Todo se comprime localmente en tu
          navegador.
        </span>
      </p>
    </div>
  );
}
