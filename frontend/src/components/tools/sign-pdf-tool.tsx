"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  PenTool,
  Type,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  Eraser,
  Plus,
  Move,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument, renderPdfPageToDataUrl } from "@/lib/pdf-client";
import { downloadBlob, stripExtension } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PlacedSignature {
  id: string;
  pageNumber: number; // 1-based
  dataUrl: string; // PNG data URL
  xPct: number; // 0..1 from left
  yPct: number; // 0..1 from top
  wPct: number; // 0..1 of page width
  aspectRatio: number; // height / width
}

const CALLIGRAPHY_FONTS = [
  { id: "dancing", label: "Elegante", cssFamily: "var(--font-dancing), cursive", canvasFont: "'Dancing Script', cursive" },
  { id: "vibes", label: "Clásica", cssFamily: "var(--font-vibes), cursive", canvasFont: "'Great Vibes', cursive" },
  { id: "caveat", label: "Manuscrita", cssFamily: "var(--font-caveat), cursive", canvasFont: "'Caveat', cursive" },
];

const INK_COLORS = [
  { hex: "#0F172A", label: "Negro" },
  { hex: "#1D4ED8", label: "Azul tinta" },
  { hex: "#B91C1C", label: "Rojo" },
  { hex: "#3F3F46", label: "Grafito" },
];

export function SignPdfTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [pdfProxy, setPdfProxy] = React.useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pagePreview, setPagePreview] = React.useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [loadingPage, setLoadingPage] = React.useState(false);

  // Signature creator state
  const [sigTab, setSigTab] = React.useState<"draw" | "type" | "upload">("draw");
  const [inkColor, setInkColor] = React.useState("#0F172A");
  const [strokeWidth, setStrokeWidth] = React.useState(3);
  const [typedName, setTypedName] = React.useState("Tu Firma");
  const [fontId, setFontId] = React.useState("dancing");
  const [uploadedSig, setUploadedSig] = React.useState<{
    dataUrl: string;
    aspectRatio: number;
  } | null>(null);

  const drawCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawingRef = React.useRef(false);
  const hasDrawnRef = React.useRef(false);

  // Placed signatures on PDF
  const [placements, setPlacements] = React.useState<PlacedSignature[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    origWPct: number;
  } | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const loadFile = React.useCallback(async (selected: File) => {
    setError(null);
    setDoneMessage(null);
    setLoadingPage(true);
    try {
      const doc = await loadPdfJsDocument(selected);
      setPdfProxy((prev) => {
        prev?.destroy();
        return doc;
      });
      setFile(selected);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setPlacements([]);
      setActiveId(null);
    } catch {
      setError("No se pudo cargar este PDF. Verifica que no esté cifrado o dañado.");
      setLoadingPage(false);
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) loadFile(pending);
  }, [consumePendingFile, loadFile]);

  React.useEffect(() => {
    return () => {
      pdfProxy?.destroy();
    };
  }, [pdfProxy]);

  React.useEffect(() => {
    if (!pdfProxy) return;
    let cancelled = false;
    setLoadingPage(true);
    renderPdfPageToDataUrl(pdfProxy, currentPage, {
      maxWidth: 760,
      format: "image/jpeg",
      quality: 0.9,
    })
      .then((res) => {
        if (!cancelled) setPagePreview(res);
      })
      .catch(() => {
        if (!cancelled) setError("Error al renderizar la página seleccionada.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfProxy, currentPage]);

  // Drawing canvas pointer handlers
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDrawDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth * 1.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    isDrawingRef.current = true;
    hasDrawnRef.current = true;
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleDrawUp = () => {
    isDrawingRef.current = false;
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
    }
  };

  const createSignaturePng = (): { dataUrl: string; aspectRatio: number } | null => {
    if (sigTab === "draw") {
      const canvas = drawCanvasRef.current;
      if (!canvas || !hasDrawnRef.current) {
        setError("Primero dibuja tu firma en el recuadro.");
        return null;
      }
      return {
        dataUrl: canvas.toDataURL("image/png"),
        aspectRatio: canvas.height / canvas.width,
      };
    }

    if (sigTab === "type") {
      const text = typedName.trim();
      if (!text) {
        setError("Escribe el texto para tu firma.");
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 760;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const selectedFont =
        CALLIGRAPHY_FONTS.find((f) => f.id === fontId) || CALLIGRAPHY_FONTS[0];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = inkColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `italic 600 96px ${selectedFont.canvasFont}`;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 40);
      return {
        dataUrl: canvas.toDataURL("image/png"),
        aspectRatio: canvas.height / canvas.width,
      };
    }

    if (!uploadedSig) {
      setError("Sube una imagen PNG o JPG de tu firma.");
      return null;
    }
    return uploadedSig;
  };

  const handlePlaceSignature = () => {
    setError(null);
    const created = createSignaturePng();
    if (!created) return;

    const newItem: PlacedSignature = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageNumber: currentPage,
      dataUrl: created.dataUrl,
      xPct: 0.55,
      yPct: 0.72,
      wPct: 0.3,
      aspectRatio: created.aspectRatio,
    };
    setPlacements((prev) => [...prev, newItem]);
    setActiveId(newItem.id);
  };

  const handleUploadSigImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        // Convert to PNG via canvas so pdf-lib embedPng always works
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        setUploadedSig({
          dataUrl: c.toDataURL("image/png"),
          aspectRatio: img.naturalHeight / Math.max(1, img.naturalWidth),
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
  };

  // Drag / Resize handlers on stage
  const startDrag = (
    e: React.PointerEvent,
    sig: PlacedSignature,
    mode: "move" | "resize"
  ) => {
    e.stopPropagation();
    setActiveId(sig.id);
    dragStateRef.current = {
      id: sig.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origXPct: sig.xPct,
      origYPct: sig.yPct,
      origWPct: sig.wPct,
    };
  };

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const dxPct = (e.clientX - drag.startX) / rect.width;
      const dyPct = (e.clientY - drag.startY) / rect.height;

      setPlacements((prev) =>
        prev.map((item) => {
          if (item.id !== drag.id) return item;
          if (drag.mode === "move") {
            return {
              ...item,
              xPct: Math.min(Math.max(0, drag.origXPct + dxPct), 1 - item.wPct),
              yPct: Math.min(Math.max(0, drag.origYPct + dyPct), 0.92),
            };
          } else {
            const nextW = Math.min(
              Math.max(0.08, drag.origWPct + dxPct),
              1 - item.xPct
            );
            return { ...item, wPct: nextW };
          }
        })
      );
    };

    const onUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handleSaveSignedPdf = async () => {
    if (!file || placements.length === 0) {
      setError("Coloca al menos una firma sobre el documento antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      for (const sig of placements) {
        const targetPage = pages[sig.pageNumber - 1];
        if (!targetPage) continue;
        const pngRes = await fetch(sig.dataUrl);
        const pngBytes = new Uint8Array(await pngRes.arrayBuffer());
        const pngImg = await pdfDoc.embedPng(pngBytes);

        const { width: pW, height: pH } = targetPage.getSize();
        const drawW = pW * sig.wPct;
        const drawH = drawW * sig.aspectRatio;
        const x = pW * sig.xPct;
        // PDF origin is bottom-left; preview origin is top-left
        const y = pH - pH * sig.yPct - drawH;

        targetPage.drawImage(pngImg, {
          x,
          y: Math.max(0, y),
          width: drawW,
          height: drawH,
        });
      }

      const outBytes = await pdfDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        `${stripExtension(file.name)}_firmado.pdf`
      );
      setDoneMessage(
        `¡Documento firmado! Se incrustaron ${placements.length} firma(s) correctamente.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos aplicar la firma al PDF."
      );
    } finally {
      setSaving(false);
    }
  };

  const currentPagePlacements = placements.filter((p) => p.pageNumber === currentPage);

  return (
    <div className="space-y-6">
      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => files[0] && loadFile(files[0])}
          title="Sube el PDF que deseas firmar"
          subtitle="Dibuja con el mouse o dedo, escribe con tipografía caligráfica o sube una firma PNG transparente."
          helperText="Firma 100% local • Tu documento nunca abandona tu dispositivo"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Panel: Signature Creator */}
          <Card className="space-y-5 p-5 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">1. Crea tu firma</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setPlacements([]);
                  setDoneMessage(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Otro PDF
              </Button>
            </div>

            {/* Creator tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary p-1">
              {[
                { id: "draw" as const, label: "Dibujar", icon: PenTool },
                { id: "type" as const, label: "Escribir", icon: Type },
                { id: "upload" as const, label: "Imagen", icon: ImagePlus },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSigTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    sigTab === t.id
                      ? "bg-[#FACC15] text-[#0A0A0A]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Color picker */}
            {sigTab !== "upload" && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Color de tinta:
                </span>
                <div className="flex items-center gap-2">
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setInkColor(c.hex)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${
                        inkColor === c.hex
                          ? "scale-110 border-[#FACC15]"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sigTab === "draw" && (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-border bg-white">
                  <canvas
                    ref={drawCanvasRef}
                    width={520}
                    height={190}
                    onPointerDown={handleDrawDown}
                    onPointerMove={handleDrawMove}
                    onPointerUp={handleDrawUp}
                    onPointerLeave={handleDrawUp}
                    className="h-44 w-full touch-none cursor-crosshair"
                  />
                  <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-zinc-400">
                    Dibuja aquí con mouse o dedo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Grosor:
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="w-24 accent-[#FACC15]"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearDrawCanvas}
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Limpiar
                  </Button>
                </div>
              </div>
            )}

            {sigTab === "type" && (
              <div className="space-y-3">
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Escribe tu nombre o iniciales"
                />
                <div className="grid grid-cols-3 gap-2">
                  {CALLIGRAPHY_FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontId(f.id)}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                        fontId === f.id
                          ? "border-[#FACC15] bg-[#FACC15]/15 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex h-28 items-center justify-center rounded-xl border border-border bg-white px-4">
                  <span
                    className="truncate text-4xl"
                    style={{
                      color: inkColor,
                      fontFamily:
                        CALLIGRAPHY_FONTS.find((f) => f.id === fontId)?.cssFamily,
                    }}
                  >
                    {typedName || "Tu Firma"}
                  </span>
                </div>
              </div>
            )}

            {sigTab === "upload" && (
              <div className="space-y-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background/60 p-6 text-center hover:border-[#FACC15]">
                  <ImagePlus className="h-6 w-6 text-[#FACC15]" />
                  <span className="mt-2 text-xs font-semibold">
                    Subir PNG transparente o JPG
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleUploadSigImage}
                    className="hidden"
                  />
                </label>
                {uploadedSig && (
                  <div className="flex h-28 items-center justify-center rounded-xl border border-border bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedSig.dataUrl}
                      alt="Firma cargada"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              className="w-full"
              onClick={handlePlaceSignature}
            >
              <Plus className="h-4 w-4" />
              Insertar firma en página {currentPage}
            </Button>

            {/* Placed signatures list */}
            {placements.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-bold text-foreground">
                  Firmas ubicadas ({placements.length})
                </p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {placements.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPage(p.pageNumber);
                          setActiveId(p.id);
                        }}
                        className="font-medium hover:text-[#FACC15]"
                      >
                        Firma #{idx + 1} • Página {p.pageNumber}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPlacements((prev) => prev.filter((x) => x.id !== p.id))
                        }
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              disabled={saving || placements.length === 0}
              onClick={handleSaveSignedPdf}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Firmando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Descargar PDF firmado
                </>
              )}
            </Button>
          </Card>

          {/* Right Panel: Interactive Page Stage */}
          <Card className="flex flex-col p-5 lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  2. Ubica y redimensiona sobre la página
                </h2>
                <p className="text-xs text-muted-foreground">
                  Arrastra la firma libremente o tira de la esquina amarilla para cambiar
                  su tamaño.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[82px] text-center text-xs font-bold">
                  Pág. {currentPage} / {numPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-zinc-900/10 p-4 dark:bg-black/40">
              {loadingPage || !pagePreview ? (
                <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-[#FACC15]" />
                  Cargando página...
                </div>
              ) : (
                <div
                  ref={stageRef}
                  onClick={() => setActiveId(null)}
                  className="relative inline-block select-none shadow-2xl"
                  style={{ maxWidth: "100%" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pagePreview.dataUrl}
                    alt={`Página ${currentPage}`}
                    draggable={false}
                    className="block max-h-[680px] w-auto rounded border border-border"
                  />

                  {currentPagePlacements.map((sig) => {
                    const isSelected = activeId === sig.id;
                    return (
                      <div
                        key={sig.id}
                        onPointerDown={(e) => startDrag(e, sig, "move")}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          left: `${sig.xPct * 100}%`,
                          top: `${sig.yPct * 100}%`,
                          width: `${sig.wPct * 100}%`,
                        }}
                        className={`group absolute cursor-move touch-none rounded border-2 transition-colors ${
                          isSelected
                            ? "border-[#FACC15] bg-[#FACC15]/10"
                            : "border-dashed border-[#FACC15]/70 hover:border-[#FACC15]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sig.dataUrl}
                          alt="Firma"
                          draggable={false}
                          className="pointer-events-none block h-auto w-full"
                        />

                        {/* Move indicator + delete */}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            setPlacements((prev) => prev.filter((x) => x.id !== sig.id))
                          }
                          title="Quitar firma"
                          className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>

                        <span className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0A0A] text-[#FACC15] shadow">
                          <Move className="h-2.5 w-2.5" />
                        </span>

                        {/* Resize handle */}
                        <div
                          onPointerDown={(e) => startDrag(e, sig, "resize")}
                          title="Arrastra para redimensionar"
                          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-[#0A0A0A] bg-[#FACC15] shadow"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
