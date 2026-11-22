"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import JSZip from "jszip";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Images,
  FileText,
  Download,
  Loader2,
  Trash2,
  GripVertical,
  Plus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument, renderPdfPageToDataUrl } from "@/lib/pdf-client";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

interface ImageEntry {
  id: string;
  file: File;
  previewUrl: string;
}

export function PdfImagesTool() {
  const { consumePendingFile } = usePendingFile();
  const [tab, setTab] = React.useState<"pdf-to-img" | "img-to-pdf">("pdf-to-img");

  // PDF -> Images state
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [pdfPages, setPdfPages] = React.useState(0);
  const [imgFormat, setImgFormat] = React.useState<"image/jpeg" | "image/png">("image/jpeg");
  const [scale, setScale] = React.useState<number>(2);
  const [jpgQuality, setJpgQuality] = React.useState<number>(92);
  const [progress, setProgress] = React.useState(0);

  // Images -> PDF state
  const [images, setImages] = React.useState<ImageEntry[]>([]);
  const [pageSize, setPageSize] = React.useState<"a4" | "letter" | "fit">("a4");
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = React.useState<"none" | "small" | "normal">("small");
  const addImgRef = React.useRef<HTMLInputElement>(null);

  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSelectPdf = React.useCallback(async (file: File) => {
    setError(null);
    setDoneMessage(null);
    try {
      const doc = await loadPdfJsDocument(file);
      setPdfPages(doc.numPages);
      setPdfFile(file);
      await doc.destroy();
    } catch {
      setError("No se pudo leer este PDF. Verifica que no esté protegido o dañado.");
    }
  }, []);

  const handleAddImages = React.useCallback((files: File[]) => {
    const valid = files.filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name)
    );
    if (valid.length === 0) {
      setError("Selecciona imágenes válidas (JPG, PNG o WebP).");
      return;
    }
    setError(null);
    setDoneMessage(null);
    const entries: ImageEntry[] = valid.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setImages((prev) => [...prev, ...entries]);
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (!pending) return;
    if (pending.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(pending.name)) {
      setTab("img-to-pdf");
      handleAddImages([pending]);
    } else {
      setTab("pdf-to-img");
      handleSelectPdf(pending);
    }
  }, [consumePendingFile, handleAddImages, handleSelectPdf]);

  React.useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportImages = async () => {
    if (!pdfFile) return;
    setProcessing(true);
    setProgress(0);
    setError(null);
    setDoneMessage(null);

    try {
      const doc = await loadPdfJsDocument(pdfFile);
      const ext = imgFormat === "image/png" ? "png" : "jpg";
      const stem = stripExtension(pdfFile.name);
      const total = doc.numPages;

      try {
        if (total === 1) {
          const rendered = await renderPdfPageToDataUrl(doc, 1, {
            scale,
            format: imgFormat,
            quality: jpgQuality / 100,
          });
          setProgress(100);
          const res = await fetch(rendered.dataUrl);
          const blob = await res.blob();
          downloadBlob(blob, `${stem}_pagina_1.${ext}`);
          setDoneMessage(`¡Imagen ${ext.toUpperCase()} descargada!`);
        } else {
          const zip = new JSZip();
          for (let p = 1; p <= total; p++) {
            const rendered = await renderPdfPageToDataUrl(doc, p, {
              scale,
              format: imgFormat,
              quality: jpgQuality / 100,
            });
            const base64 = rendered.dataUrl.split(",")[1];
            const pad = String(p).padStart(String(total).length, "0");
            zip.file(`${stem}_pagina_${pad}.${ext}`, base64, { base64: true });
            setProgress(Math.round((p / total) * 100));
          }
          const zipBlob = await zip.generateAsync({ type: "blob" });
          downloadBlob(zipBlob, `${stem}_imagenes_${ext}.zip`);
          setDoneMessage(
            `¡Listo! Se exportaron ${total} páginas como ${ext.toUpperCase()} en un archivo .zip.`
          );
        }
      } finally {
        await doc.destroy();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al convertir páginas en imágenes."
      );
    } finally {
      setProcessing(false);
    }
  };

  const convertFileToPngOrJpgBytes = async (
    file: File
  ): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> => {
    if (file.type === "image/jpeg") {
      return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "jpg" };
    }
    if (file.type === "image/png") {
      return { bytes: new Uint8Array(await file.arrayBuffer()), kind: "png" };
    }
    // Convert WebP or other browser-supported image via canvas to PNG
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen WebP.");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falló la conversión de WebP"))),
        "image/png"
      )
    );
    canvas.width = 0;
    canvas.height = 0;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: "png" };
  };

  const handleBuildPdfFromImages = async () => {
    if (images.length === 0) return;
    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const marginPt = margin === "none" ? 0 : margin === "small" ? 24 : 54;

      for (const entry of images) {
        const { bytes, kind } = await convertFileToPngOrJpgBytes(entry.file);
        const embedded =
          kind === "jpg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

        let pageW: number;
        let pageH: number;

        if (pageSize === "fit") {
          pageW = embedded.width + marginPt * 2;
          pageH = embedded.height + marginPt * 2;
        } else {
          const base = pageSize === "a4" ? [595.28, 841.89] : [612, 792];
          pageW = orientation === "portrait" ? base[0] : base[1];
          pageH = orientation === "portrait" ? base[1] : base[0];
        }

        const page = pdfDoc.addPage([pageW, pageH]);
        const availW = Math.max(10, pageW - marginPt * 2);
        const availH = Math.max(10, pageH - marginPt * 2);
        const ratio = Math.min(availW / embedded.width, availH / embedded.height);
        const drawW = embedded.width * ratio;
        const drawH = embedded.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        page.drawImage(embedded, { x, y, width: drawW, height: drawH });
      }

      const outBytes = await pdfDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        "PDFNauta_imagenes.pdf"
      );
      setDoneMessage(
        `¡PDF creado! Se unieron ${images.length} imagen(es) en un solo documento.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el PDF desde las imágenes."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  return (
    <div className="space-y-6">
      {/* Direction tabs */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-2">
        <button
          type="button"
          onClick={() => {
            setTab("pdf-to-img");
            setError(null);
            setDoneMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            tab === "pdf-to-img"
              ? "bg-[#FACC15] text-[#0A0A0A] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          PDF a JPG / PNG
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("img-to-pdf");
            setError(null);
            setDoneMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            tab === "img-to-pdf"
              ? "bg-[#FACC15] text-[#0A0A0A] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Images className="h-4 w-4" />
          Imágenes a PDF
        </button>
      </div>

      {tab === "pdf-to-img" ? (
        !pdfFile ? (
          <FileDropzone
            accept=".pdf,application/pdf"
            onFilesSelected={(files) => files[0] && handleSelectPdf(files[0])}
            title="Sube un PDF para exportar sus páginas como imágenes"
            subtitle="Convierte cada página a JPG o PNG de alta resolución y descárgalas en un .zip."
            helperText="Procesamiento 100% local en tu navegador"
          />
        ) : (
          <Card className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">{pdfFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pdfPages} página(s) • {formatBytes(pdfFile.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPdfFile(null);
                  setDoneMessage(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cambiar PDF
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Formato de salida
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: "image/jpeg" as const, label: "JPG" },
                    { val: "image/png" as const, label: "PNG" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setImgFormat(opt.val)}
                      className={`rounded-xl border py-2 text-xs font-bold ${
                        imgFormat === opt.val
                          ? "border-[#FACC15] bg-[#FACC15]/15 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Resolución / Nitidez
                </label>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value={1.5}>Estándar (108 DPI)</option>
                  <option value={2}>Alta calidad (144 DPI)</option>
                  <option value={2.8}>Ultra nitidez (200 DPI)</option>
                </select>
              </div>

              {imgFormat === "image/jpeg" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Calidad JPG: {jpgQuality}%
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={100}
                    value={jpgQuality}
                    onChange={(e) => setJpgQuality(Number(e.target.value))}
                    className="mt-2 w-full accent-[#FACC15]"
                  />
                </div>
              )}
            </div>

            {processing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>Renderizando páginas...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-[#FACC15] transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                disabled={processing}
                onClick={handleExportImages}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {pdfPages > 1 ? "Exportar imágenes (.ZIP)" : "Descargar imagen"}
                  </>
                )}
              </Button>
            </div>
          </Card>
        )
      ) : images.length === 0 ? (
        <FileDropzone
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          onFilesSelected={handleAddImages}
          title="Arrastra tus imágenes (JPG, PNG, WebP)"
          subtitle="Únelas en un solo PDF configurando tamaño de página, márgenes y orientación."
          helperText="Soporta múltiples imágenes con reordenamiento libre"
        />
      ) : (
        <Card className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-sm font-bold text-foreground">
                {images.length} imagen(es) seleccionada(s)
              </p>
              <p className="text-xs text-muted-foreground">
                Arrastra las imágenes para definir el orden de las páginas del PDF.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={addImgRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleAddImages(Array.from(e.target.files));
                  if (addImgRef.current) addImgRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addImgRef.current?.click()}
              >
                <Plus className="h-4 w-4" />
                Agregar imágenes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImages([])}
              >
                Limpiar
              </Button>
            </div>
          </div>

          {/* Layout config */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Tamaño de página
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as "a4" | "letter" | "fit")}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">Carta (Letter)</option>
                <option value="fit">Ajustar a cada imagen</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Orientación
              </label>
              <select
                value={orientation}
                disabled={pageSize === "fit"}
                onChange={(e) =>
                  setOrientation(e.target.value as "portrait" | "landscape")
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="portrait">Vertical (Portrait)</option>
                <option value="landscape">Horizontal (Landscape)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Márgenes
              </label>
              <select
                value={margin}
                onChange={(e) => setMargin(e.target.value as "none" | "small" | "normal")}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="none">Sin margen</option>
                <option value="small">Margen pequeño</option>
                <option value="normal">Margen normal</option>
              </select>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleImageDragEnd}
          >
            <SortableContext
              items={images.map((i) => i.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((img, idx) => (
                  <SortableImageCard
                    key={img.id}
                    entry={img}
                    index={idx}
                    onRemove={() =>
                      setImages((prev) => prev.filter((item) => item.id !== img.id))
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="lg"
              disabled={processing}
              onClick={handleBuildPdfFromImages}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Crear y descargar PDF
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

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
    </div>
  );
}

function SortableImageCard({
  entry,
  index,
  onRemove,
}: {
  entry: ImageEntry;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-background"
    >
      <div className="flex items-center justify-between bg-secondary/40 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center gap-1 text-xs font-bold"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          #{index + 1}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex h-32 items-center justify-center bg-black/10 p-2 dark:bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.previewUrl}
          alt={entry.file.name}
          className="max-h-full max-w-full rounded object-contain"
        />
      </div>
      <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">
        {entry.file.name}
      </p>
    </div>
  );
}
