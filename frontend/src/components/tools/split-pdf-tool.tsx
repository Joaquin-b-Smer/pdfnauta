"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import JSZip from "jszip";
import {
  Scissors,
  Download,
  Loader2,
  FileArchive,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import {
  loadPdfJsDocument,
  renderPdfPageToDataUrl,
  parsePageRanges,
} from "@/lib/pdf-client";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

interface ThumbPreview {
  pageNumber: number;
  dataUrl: string;
}

export function SplitPdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [thumbs, setThumbs] = React.useState<ThumbPreview[]>([]);
  const [loadingPdf, setLoadingPdf] = React.useState(false);

  const [mode, setMode] = React.useState<"ranges" | "all-zip">("ranges");
  const [rangeInput, setRangeInput] = React.useState("1");
  const [selectedSet, setSelectedSet] = React.useState<Set<number>>(new Set([1]));

  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const loadFile = React.useCallback(async (selected: File) => {
    setLoadingPdf(true);
    setError(null);
    setDoneMessage(null);
    setFile(selected);
    setThumbs([]);

    try {
      const doc = await loadPdfJsDocument(selected);
      try {
        setPageCount(doc.numPages);
        const defaultRange = doc.numPages > 1 ? `1-${Math.min(3, doc.numPages)}` : "1";
        setRangeInput(defaultRange);
        const initialSet = new Set<number>();
        for (let i = 1; i <= Math.min(3, doc.numPages); i++) initialSet.add(i);
        setSelectedSet(initialSet);

        const maxPreview = Math.min(doc.numPages, 24);
        const generated: ThumbPreview[] = [];
        for (let p = 1; p <= maxPreview; p++) {
          const rendered = await renderPdfPageToDataUrl(doc, p, {
            maxWidth: 160,
            format: "image/jpeg",
            quality: 0.72,
          });
          generated.push({ pageNumber: p, dataUrl: rendered.dataUrl });
        }
        setThumbs(generated);
      } finally {
        await doc.destroy();
      }
    } catch {
      setError(
        "No pudimos leer este PDF. Verifica que no esté dañado o protegido con contraseña."
      );
      setFile(null);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) loadFile(pending);
  }, [consumePendingFile, loadFile]);

  const syncRangeFromSet = (nextSet: Set<number>) => {
    const sorted = Array.from(nextSet).sort((a, b) => a - b);
    if (sorted.length === 0) {
      setRangeInput("");
      return;
    }
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    setRangeInput(ranges.join(", "));
  };

  const toggleThumbPage = (pageNum: number) => {
    if (mode !== "ranges") setMode("ranges");
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      syncRangeFromSet(next);
      return next;
    });
  };

  const handleRangeChange = (val: string) => {
    setRangeInput(val);
    const parsed = parsePageRanges(val, pageCount);
    if (!parsed.error) {
      setSelectedSet(new Set(parsed.pages));
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const stem = stripExtension(file.name);

      if (mode === "ranges") {
        const parsed = parsePageRanges(rangeInput, srcPdf.getPageCount());
        if (parsed.error || parsed.pages.length === 0) {
          setError(parsed.error || "Selecciona al menos una página válida.");
          setProcessing(false);
          return;
        }

        const outPdf = await PDFDocument.create();
        const indices = parsed.pages.map((p) => p - 1);
        const copied = await outPdf.copyPages(srcPdf, indices);
        copied.forEach((p) => outPdf.addPage(p));

        const outBytes = await outPdf.save();
        downloadBlob(
          new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
          `${stem}_paginas_${parsed.pages.length}.pdf`
        );
        setDoneMessage(
          `¡Extracción completada! Se descargó un PDF con ${parsed.pages.length} página(s).`
        );
      } else {
        const zip = new JSZip();
        const total = srcPdf.getPageCount();
        for (let i = 0; i < total; i++) {
          const single = await PDFDocument.create();
          const [copiedPage] = await single.copyPages(srcPdf, [i]);
          single.addPage(copiedPage);
          const singleBytes = await single.save();
          const pad = String(i + 1).padStart(String(total).length, "0");
          zip.file(`${stem}_pagina_${pad}.pdf`, singleBytes);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${stem}_paginas_individuales.zip`);
        setDoneMessage(
          `¡División completada! Se generó un .zip con ${total} archivos PDF individuales.`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al separar el archivo PDF."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => files[0] && loadFile(files[0])}
          title="Selecciona el PDF que deseas separar"
          subtitle="Extrae rangos específicos (ej. 1-3, 5, 8-10) o divide todas las páginas en un .zip."
          helperText="Procesamiento 100% local • Instantáneo y privado"
        />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#EAB308] dark:text-[#FACC15]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pageCount} páginas • {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setThumbs([]);
                  setDoneMessage(null);
                  setError(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cambiar archivo
              </Button>
            </div>

            {/* Mode selector */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("ranges")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  mode === "ranges"
                    ? "border-[#FACC15] bg-[#FACC15]/10"
                    : "border-border bg-background hover:border-[#FACC15]/50"
                }`}
              >
                <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-[#CA8A04] dark:text-[#FACC15]" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Extraer rangos específicos
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Indica páginas exactas (ej. 1-3, 5, 8-10) o haz clic en las
                    miniaturas.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("all-zip")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  mode === "all-zip"
                    ? "border-[#FACC15] bg-[#FACC15]/10"
                    : "border-border bg-background hover:border-[#FACC15]/50"
                }`}
              >
                <FileArchive className="mt-0.5 h-5 w-5 shrink-0 text-[#CA8A04] dark:text-[#FACC15]" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Todas las páginas en .ZIP
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Divide cada una de las {pageCount} páginas en un PDF individual dentro
                    de un archivo comprimido.
                  </p>
                </div>
              </button>
            </div>

            {mode === "ranges" && (
              <div className="mt-5 space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Páginas o rangos a extraer (de 1 a {pageCount}):
                </label>
                <Input
                  value={rangeInput}
                  onChange={(e) => handleRangeChange(e.target.value)}
                  placeholder="Ej: 1-3, 5, 8-10"
                />
              </div>
            )}

            {/* Page thumbnail picker */}
            {loadingPdf ? (
              <div className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-[#FACC15]" />
                Generando miniaturas...
              </div>
            ) : (
              thumbs.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    {mode === "ranges"
                      ? "Haz clic en las páginas para incluirlas o quitarlas de la extracción:"
                      : "Vista previa del documento:"}
                    {pageCount > thumbs.length &&
                      ` (Mostrando primeras ${thumbs.length} de ${pageCount} páginas)`}
                  </p>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {thumbs.map((t) => {
                      const active = mode === "all-zip" || selectedSet.has(t.pageNumber);
                      return (
                        <button
                          key={t.pageNumber}
                          type="button"
                          onClick={() => toggleThumbPage(t.pageNumber)}
                          className={`group relative overflow-hidden rounded-xl border p-2 text-center transition-all ${
                            active
                              ? "border-[#FACC15] bg-[#FACC15]/10 ring-1 ring-[#FACC15]"
                              : "border-border bg-background opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={t.dataUrl}
                            alt={`Página ${t.pageNumber}`}
                            className="mx-auto h-28 w-auto rounded object-contain"
                          />
                          <span className="mt-1.5 block text-[11px] font-bold text-foreground">
                            Pág. {t.pageNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </Card>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {doneMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {doneMessage}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              size="lg"
              disabled={processing || loadingPdf}
              onClick={handleSplit}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {mode === "ranges" ? "Extraer y descargar PDF" : "Dividir y descargar .ZIP"}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
