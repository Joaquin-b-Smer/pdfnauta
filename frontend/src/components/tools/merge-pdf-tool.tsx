"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
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
  GripVertical,
  Trash2,
  Plus,
  Download,
  FileText,
  ArrowUp,
  ArrowDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { renderFirstPageThumbnail } from "@/lib/pdf-client";
import { downloadBlob, formatBytes } from "@/lib/utils";

interface MergeItem {
  id: string;
  file: File;
  thumbnailUrl: string | null;
  pageCount: number;
  loadingThumb: boolean;
}

export function MergePdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [items, setItems] = React.useState<MergeItem[]>([]);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);
  const addMoreRef = React.useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addFiles = React.useCallback(async (files: File[]) => {
    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) {
      setError("Por favor selecciona archivos en formato PDF.");
      return;
    }
    setError(null);
    setDoneMessage(null);

    const newEntries: MergeItem[] = pdfs.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      thumbnailUrl: null,
      pageCount: 0,
      loadingThumb: true,
    }));

    setItems((prev) => [...prev, ...newEntries]);

    // Generate thumbnails asynchronously
    for (const entry of newEntries) {
      const result = await renderFirstPageThumbnail(entry.file);
      setItems((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                thumbnailUrl: result.thumbnailUrl,
                pageCount: result.pageCount,
                loadingThumb: false,
              }
            : item
        )
      );
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) {
      addFiles([pending]);
    }
  }, [consumePendingFile, addFiles]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, index, target);
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDoneMessage(null);
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      setError("Agrega al menos 2 archivos PDF para unirlos.");
      return;
    }
    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const mergedPdf = await PDFDocument.create();
      let totalPages = 0;

      for (const item of items) {
        const bytes = await item.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
        totalPages += copiedPages.length;
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      downloadBlob(blob, "PDFNauta_unido.pdf");
      setDoneMessage(
        `¡Listo! Se unieron ${items.length} archivos (${totalPages} páginas en total).`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Error al unir los PDF: ${err.message}`
          : "Ocurrió un error al unir los archivos. Verifica que ninguno esté corrupto o cifrado."
      );
    } finally {
      setProcessing(false);
    }
  };

  const totalPages = items.reduce((acc, i) => acc + i.pageCount, 0);
  const totalBytes = items.reduce((acc, i) => acc + i.file.size, 0);

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          multiple
          onFilesSelected={addFiles}
          title="Arrastra tus archivos PDF para unirlos"
          subtitle="Puedes seleccionar varios archivos a la vez y luego arrastrarlos para definir el orden exacto."
          helperText="Procesamiento 100% local en tu navegador • Tus archivos nunca se suben a internet"
        />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Documentos seleccionados ({items.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Arrastra las tarjetas para reordenar •{" "}
                  {totalPages > 0 ? `${totalPages} páginas totales • ` : ""}
                  {formatBytes(totalBytes)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={addMoreRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    if (addMoreRef.current) addMoreRef.current.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMoreRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                  Agregar más PDF
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setItems([]);
                    setDoneMessage(null);
                    setError(null);
                  }}
                >
                  Limpiar todo
                </Button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={rectSortingStrategy}
              >
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item, idx) => (
                    <SortableMergeCard
                      key={item.id}
                      item={item}
                      index={idx}
                      total={items.length}
                      onMoveUp={() => moveItem(idx, -1)}
                      onMoveDown={() => moveItem(idx, 1)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

          <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {items.length < 2
                ? "Agrega al menos un archivo PDF más para habilitar la unión."
                : `Se generará un único archivo PDF con tus ${items.length} documentos en el orden mostrado.`}
            </p>
            <Button
              type="button"
              size="lg"
              disabled={items.length < 2 || processing}
              onClick={handleMerge}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uniendo PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Unir y descargar PDF
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SortableMergeCard({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: MergeItem;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-all hover:border-[#FACC15]/60"
    >
      {/* Order badge + Drag handle */}
      <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center gap-1.5 text-xs font-bold text-foreground active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#FACC15] text-[11px] font-extrabold text-[#0A0A0A]">
            {index + 1}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="Mover antes"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Mover después"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Eliminar archivo"
            className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="flex h-44 items-center justify-center bg-zinc-900/5 p-3 dark:bg-black/30">
        {item.loadingThumb ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#FACC15]" />
        ) : item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={`Portada de ${item.file.name}`}
            className="max-h-full max-w-full rounded border border-border/80 object-contain shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            <FileText className="h-10 w-10" />
            <span className="mt-1 text-[11px]">Sin vista previa</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3">
        <p className="truncate text-xs font-semibold text-foreground" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {item.pageCount > 0 ? `${item.pageCount} pág. • ` : ""}
          {formatBytes(item.file.size)}
        </p>
      </div>
    </div>
  );
}
