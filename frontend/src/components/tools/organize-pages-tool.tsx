"use client";

import * as React from "react";
import { PDFDocument, degrees } from "@cantoo/pdf-lib";
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
  RotateCcw,
  RotateCw,
  Copy,
  Trash2,
  GripVertical,
  Download,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument, renderPdfPageToDataUrl } from "@/lib/pdf-client";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

interface EditablePageItem {
  id: string;
  originalIndex: number; // 0-based
  thumbnailUrl: string;
  rotation: number; // multiple of 90 added by user
}

export function OrganizePagesTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [pages, setPages] = React.useState<EditablePageItem[]>([]);
  const [initialPages, setInitialPages] = React.useState<EditablePageItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadFile = React.useCallback(async (selected: File) => {
    setLoading(true);
    setError(null);
    setDoneMessage(null);
    setFile(selected);
    setPages([]);

    try {
      const doc = await loadPdfJsDocument(selected);
      try {
        const items: EditablePageItem[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const rendered = await renderPdfPageToDataUrl(doc, p, {
            maxWidth: 200,
            format: "image/jpeg",
            quality: 0.76,
          });
          items.push({
            id: `page-${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            originalIndex: p - 1,
            thumbnailUrl: rendered.dataUrl,
            rotation: 0,
          });
        }
        setPages(items);
        setInitialPages(items);
      } finally {
        await doc.destroy();
      }
    } catch {
      setError("No se pudo abrir el PDF. Asegúrate de que no esté dañado o encriptado.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) loadFile(pending);
  }, [consumePendingFile, loadFile]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const rotatePage = (id: string, delta: 90 | -90) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
      )
    );
  };

  const duplicatePage = (index: number) => {
    setPages((prev) => {
      const target = prev[index];
      const copy: EditablePageItem = {
        ...target,
        id: `dup-${target.originalIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const deletePage = (id: string) => {
    setPages((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const handleSave = async () => {
    if (!file || pages.length === 0) return;
    setSaving(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();

      for (const item of pages) {
        const [copied] = await outDoc.copyPages(srcDoc, [item.originalIndex]);
        if (item.rotation !== 0) {
          const existingAngle = copied.getRotation().angle || 0;
          copied.setRotation(degrees((existingAngle + item.rotation) % 360));
        }
        outDoc.addPage(copied);
      }

      const outBytes = await outDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        `${stripExtension(file.name)}_organizado.pdf`
      );
      setDoneMessage(
        `¡PDF guardado con éxito! Documento final con ${pages.length} página(s).`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al aplicar los cambios al PDF."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => files[0] && loadFile(files[0])}
          title="Sube un PDF para organizar sus páginas"
          subtitle="Rota individualmente (90° izq/der), elimina, duplica o arrastra páginas para cambiar su orden."
          helperText="Procesamiento 100% local en tu dispositivo"
        />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pages.length} páginas activas • {formatBytes(file.size)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPages((prev) =>
                      prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))
                    )
                  }
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Rotar todas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPages((prev) => [...prev].reverse())}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Invertir orden
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPages(initialPages)}
                >
                  Restablecer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPages([]);
                    setDoneMessage(null);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Otro PDF
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-[#FACC15]" />
                Renderizando páginas del documento...
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pages.map((p) => p.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {pages.map((page, index) => (
                      <SortablePageCard
                        key={page.id}
                        item={page}
                        displayNumber={index + 1}
                        canDelete={pages.length > 1}
                        onRotateLeft={() => rotatePage(page.id, -90)}
                        onRotateRight={() => rotatePage(page.id, 90)}
                        onDuplicate={() => duplicatePage(index)}
                        onDelete={() => deletePage(page.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
              disabled={saving || loading || pages.length === 0}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando cambios...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Guardar y descargar PDF
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SortablePageCard({
  item,
  displayNumber,
  canDelete,
  onRotateLeft,
  onRotateRight,
  onDuplicate,
  onDelete,
}: {
  item: EditablePageItem;
  displayNumber: number;
  canDelete: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-all hover:border-[#FACC15]/60"
    >
      <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center gap-1 text-xs font-bold text-foreground active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Pág. {displayNumber}</span>
        </button>
        {item.rotation !== 0 && (
          <span className="rounded bg-[#FACC15]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#CA8A04] dark:text-[#FACC15]">
            {item.rotation}°
          </span>
        )}
      </div>

      <div className="flex h-40 items-center justify-center overflow-hidden bg-zinc-900/5 p-3 dark:bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnailUrl}
          alt={`Página ${displayNumber}`}
          style={{ transform: `rotate(${item.rotation}deg)` }}
          className="max-h-32 max-w-full rounded border border-border/70 object-contain shadow-sm transition-transform duration-200"
        />
      </div>

      <div className="grid grid-cols-4 divide-x divide-border/70 border-t border-border/70 bg-card">
        <button
          type="button"
          onClick={onRotateLeft}
          title="Rotar 90° izquierda"
          className="flex items-center justify-center py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRotateRight}
          title="Rotar 90° derecha"
          className="flex items-center justify-center py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar página"
          className="flex items-center justify-center py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-[#FACC15]"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={!canDelete}
          onClick={onDelete}
          title="Eliminar página"
          className="flex items-center justify-center py-2 text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-500 disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
