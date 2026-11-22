"use client";

import * as React from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";
import {
  Stamp,
  Hash,
  Download,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument, renderPdfPageToDataUrl } from "@/lib/pdf-client";
import { downloadBlob, hexToRgbNormalized, stripExtension } from "@/lib/utils";

type Position9 =
  | "top-left"
  | "top-center"
  | "top-right"
  | "mid-left"
  | "center"
  | "mid-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const POSITIONS: { id: Position9; label: string }[] = [
  { id: "top-left", label: "Sup. Izq" },
  { id: "top-center", label: "Sup. Cen" },
  { id: "top-right", label: "Sup. Der" },
  { id: "mid-left", label: "Med. Izq" },
  { id: "center", label: "Centro" },
  { id: "mid-right", label: "Med. Der" },
  { id: "bottom-left", label: "Inf. Izq" },
  { id: "bottom-center", label: "Inf. Cen" },
  { id: "bottom-right", label: "Inf. Der" },
];

export function WatermarkNumberingTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Watermark config
  const [enableWatermark, setEnableWatermark] = React.useState(true);
  const [wmText, setWmText] = React.useState("CONFIDENCIAL");
  const [wmOpacity, setWmOpacity] = React.useState(0.28);
  const [wmColor, setWmColor] = React.useState("#DC2626");
  const [wmSize, setWmSize] = React.useState(48);
  const [wmAngle, setWmAngle] = React.useState(-45);
  const [wmPos, setWmPos] = React.useState<Position9>("center");

  // Page numbering config
  const [enableNumbering, setEnableNumbering] = React.useState(true);
  const [numTemplate, setNumTemplate] = React.useState<"page-x-of-y" | "x-slash-y" | "x">(
    "page-x-of-y"
  );
  const [numPosition, setNumPosition] = React.useState<
    "bottom-right" | "bottom-center" | "bottom-left" | "top-right" | "top-center"
  >("bottom-right");
  const [numColor, setNumColor] = React.useState("#18181B");
  const [numSize, setNumSize] = React.useState(11);
  const [numOpacity, setNumOpacity] = React.useState(0.85);

  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const loadFile = React.useCallback(async (selected: File) => {
    setLoading(true);
    setError(null);
    setDoneMessage(null);
    try {
      const doc = await loadPdfJsDocument(selected);
      try {
        setPageCount(doc.numPages);
        const rendered = await renderPdfPageToDataUrl(doc, 1, {
          maxWidth: 540,
          format: "image/jpeg",
          quality: 0.88,
        });
        setPreviewUrl(rendered.dataUrl);
        setFile(selected);
      } finally {
        await doc.destroy();
      }
    } catch {
      setError("No se pudo abrir el PDF. Asegúrate de que no esté cifrado.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) loadFile(pending);
  }, [consumePendingFile, loadFile]);

  const formatPageNumber = (idx: number, total: number) => {
    if (numTemplate === "page-x-of-y") return `Página ${idx} de ${total}`;
    if (numTemplate === "x-slash-y") return `${idx} / ${total}`;
    return `${idx}`;
  };

  const getPreviewAlignmentClasses = (pos: Position9): string => {
    const map: Record<Position9, string> = {
      "top-left": "items-start justify-start p-6",
      "top-center": "items-start justify-center p-6",
      "top-right": "items-start justify-end p-6",
      "mid-left": "items-center justify-start p-6",
      center: "items-center justify-center p-6",
      "mid-right": "items-center justify-end p-6",
      "bottom-left": "items-end justify-start p-6",
      "bottom-center": "items-end justify-center p-6",
      "bottom-right": "items-end justify-end p-6",
    };
    return map[pos];
  };

  const handleApply = async () => {
    if (!file) return;
    if (!enableWatermark && !enableNumbering) {
      setError("Activa al menos la marca de agua o la numeración de páginas.");
      return;
    }
    if (enableWatermark && !wmText.trim()) {
      setError("Ingresa el texto para la marca de agua.");
      return;
    }

    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const total = pages.length;
      const wmRgb = hexToRgbNormalized(wmColor);
      const numRgb = hexToRgbNormalized(numColor);

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const margin = 34;

        if (enableWatermark && wmText.trim()) {
          const text = wmText.trim();
          const textWidth = fontBold.widthOfTextAtSize(text, wmSize);
          const textHeight = wmSize;

          let x = width / 2;
          let y = height / 2;

          if (wmPos.includes("left")) x = margin + textWidth / 2;
          else if (wmPos.includes("right")) x = width - margin - textWidth / 2;

          if (wmPos.includes("top")) y = height - margin - textHeight;
          else if (wmPos.includes("bottom")) y = margin + textHeight / 2;

          // Center text accurately around (x, y) accounting for rotation
          const rad = (wmAngle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const dx = -textWidth / 2;
          const dy = -textHeight / 3;
          const drawX = x + dx * cos - dy * sin;
          const drawY = y + dx * sin + dy * cos;

          page.drawText(text, {
            x: drawX,
            y: drawY,
            size: wmSize,
            font: fontBold,
            color: rgb(wmRgb.r, wmRgb.g, wmRgb.b),
            opacity: wmOpacity,
            rotate: degrees(wmAngle),
          });
        }

        if (enableNumbering) {
          const label = formatPageNumber(i + 1, total);
          const labelWidth = fontRegular.widthOfTextAtSize(label, numSize);
          let nx = width - margin - labelWidth;
          let ny = 20;

          if (numPosition === "bottom-center") {
            nx = (width - labelWidth) / 2;
            ny = 20;
          } else if (numPosition === "bottom-left") {
            nx = margin;
            ny = 20;
          } else if (numPosition === "top-right") {
            nx = width - margin - labelWidth;
            ny = height - 26;
          } else if (numPosition === "top-center") {
            nx = (width - labelWidth) / 2;
            ny = height - 26;
          }

          page.drawText(label, {
            x: Math.max(12, nx),
            y: ny,
            size: numSize,
            font: fontRegular,
            color: rgb(numRgb.r, numRgb.g, numRgb.b),
            opacity: numOpacity,
          });
        }
      });

      const outBytes = await pdfDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        `${stripExtension(file.name)}_editado.pdf`
      );
      setDoneMessage(`¡Listo! Cambios aplicados a las ${total} página(s) del PDF.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al aplicar la marca de agua o numeración."
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
          title="Sube un PDF para añadir marca de agua o numeración"
          subtitle="Personaliza texto, opacidad, color, tamaño, rotación y formato Página X de Y con vista previa en vivo."
          helperText="Procesamiento 100% local en tu navegador"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls */}
          <Card className="space-y-6 p-5 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="text-sm font-bold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{pageCount} páginas</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setDoneMessage(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cambiar PDF
              </Button>
            </div>

            {/* Watermark Section */}
            <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Stamp className="h-4 w-4 text-[#FACC15]" />
                  Marca de Agua de Texto
                </span>
                <input
                  type="checkbox"
                  checked={enableWatermark}
                  onChange={(e) => setEnableWatermark(e.target.checked)}
                  className="h-4 w-4 accent-[#FACC15]"
                />
              </label>

              {enableWatermark && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Texto
                    </label>
                    <Input
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="Ej. CONFIDENCIAL, BORRADOR, JoApps"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Tamaño ({wmSize} pt)
                      </label>
                      <input
                        type="range"
                        min={16}
                        max={92}
                        value={wmSize}
                        onChange={(e) => setWmSize(Number(e.target.value))}
                        className="w-full accent-[#FACC15]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Opacidad ({Math.round(wmOpacity * 100)}%)
                      </label>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round(wmOpacity * 100)}
                        onChange={(e) => setWmOpacity(Number(e.target.value) / 100)}
                        className="w-full accent-[#FACC15]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Rotación ({wmAngle}°)
                      </label>
                      <input
                        type="range"
                        min={-90}
                        max={90}
                        step={5}
                        value={wmAngle}
                        onChange={(e) => setWmAngle(Number(e.target.value))}
                        className="w-full accent-[#FACC15]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={wmColor}
                          onChange={(e) => setWmColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {wmColor.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      Posición en la página
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {POSITIONS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setWmPos(p.id)}
                          className={`rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                            wmPos === p.id
                              ? "border-[#FACC15] bg-[#FACC15]/15 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Numbering Section */}
            <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Hash className="h-4 w-4 text-[#FACC15]" />
                  Numeración de Páginas
                </span>
                <input
                  type="checkbox"
                  checked={enableNumbering}
                  onChange={(e) => setEnableNumbering(e.target.checked)}
                  className="h-4 w-4 accent-[#FACC15]"
                />
              </label>

              {enableNumbering && (
                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Formato
                    </label>
                    <select
                      value={numTemplate}
                      onChange={(e) =>
                        setNumTemplate(
                          e.target.value as "page-x-of-y" | "x-slash-y" | "x"
                        )
                      }
                      className="flex h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs"
                    >
                      <option value="page-x-of-y">Página X de Y</option>
                      <option value="x-slash-y">X / Y</option>
                      <option value="x">Solo número (X)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Ubicación
                    </label>
                    <select
                      value={numPosition}
                      onChange={(e) =>
                        setNumPosition(
                          e.target.value as
                            | "bottom-right"
                            | "bottom-center"
                            | "bottom-left"
                            | "top-right"
                            | "top-center"
                        )
                      }
                      className="flex h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs"
                    >
                      <option value="bottom-right">Inferior derecha</option>
                      <option value="bottom-center">Inferior centro</option>
                      <option value="bottom-left">Inferior izquierda</option>
                      <option value="top-right">Superior derecha</option>
                      <option value="top-center">Superior centro</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Tamaño ({numSize} pt)
                    </label>
                    <input
                      type="range"
                      min={8}
                      max={20}
                      value={numSize}
                      onChange={(e) => setNumSize(Number(e.target.value))}
                      className="w-full accent-[#FACC15]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Color
                      </label>
                      <input
                        type="color"
                        value={numColor}
                        onChange={(e) => setNumColor(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Opacidad ({Math.round(numOpacity * 100)}%)
                      </label>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={Math.round(numOpacity * 100)}
                        onChange={(e) => setNumOpacity(Number(e.target.value) / 100)}
                        className="w-full accent-[#FACC15]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {doneMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {doneMessage}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={processing}
              onClick={handleApply}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando cambios...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Aplicar y descargar PDF
                </>
              )}
            </Button>
          </Card>

          {/* Live Preview */}
          <Card className="flex flex-col p-5 lg:col-span-6">
            <h2 className="mb-3 text-sm font-bold text-foreground">
              Vista previa en vivo (Página 1 de {pageCount})
            </h2>
            <div className="flex flex-1 items-center justify-center rounded-xl bg-zinc-900/10 p-4 dark:bg-black/40">
              {loading || !previewUrl ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#FACC15]" />
              ) : (
                <div className="relative inline-block overflow-hidden rounded border border-border shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="block max-h-[600px] w-auto"
                  />

                  {enableWatermark && wmText.trim() && (
                    <div
                      className={`pointer-events-none absolute inset-0 flex overflow-hidden ${getPreviewAlignmentClasses(
                        wmPos
                      )}`}
                    >
                      <span
                        className="whitespace-nowrap font-extrabold tracking-wide"
                        style={{
                          color: wmColor,
                          opacity: wmOpacity,
                          fontSize: `${Math.max(12, wmSize * 0.65)}px`,
                          transform: `rotate(${-wmAngle}deg)`,
                        }}
                      >
                        {wmText}
                      </span>
                    </div>
                  )}

                  {enableNumbering && (
                    <div
                      className={`pointer-events-none absolute inset-0 flex p-4 ${getPreviewAlignmentClasses(
                        numPosition
                      )}`}
                    >
                      <span
                        className="font-medium"
                        style={{
                          color: numColor,
                          opacity: numOpacity,
                          fontSize: `${Math.max(10, numSize * 0.9)}px`,
                        }}
                      >
                        {formatPageNumber(1, pageCount)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
