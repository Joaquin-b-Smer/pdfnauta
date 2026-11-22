"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      if (typeof window !== "undefined") {
        mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return mod;
    });
  }
  return pdfjsPromise;
}

export async function loadPdfJsDocument(
  source: File | Uint8Array | ArrayBuffer,
  password?: string
): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfJs();
  let data: Uint8Array;
  if (source instanceof File) {
    data = new Uint8Array(await source.arrayBuffer());
  } else if (source instanceof ArrayBuffer) {
    data = new Uint8Array(source.slice(0));
  } else {
    data = source.slice(0);
  }

  const loadingTask = pdfjs.getDocument({
    data,
    password,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  return loadingTask.promise;
}

export async function renderPdfPageToDataUrl(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  options?: {
    scale?: number;
    maxWidth?: number;
    format?: "image/jpeg" | "image/png";
    quality?: number;
    rotationOffset?: number;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({
    scale: 1,
    rotation: (page.rotate + (options?.rotationOffset || 0)) % 360,
  });

  let scale = options?.scale ?? 1.2;
  if (options?.maxWidth && baseViewport.width > 0) {
    scale = options.maxWidth / baseViewport.width;
  }

  const viewport = page.getViewport({
    scale,
    rotation: (page.rotate + (options?.rotationOffset || 0)) % 360,
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo inicializar el lienzo 2D en el navegador.");
  }

  // White paper background for JPEG / clean PDF rendering
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const format = options?.format ?? "image/jpeg";
  const quality = options?.quality ?? 0.88;
  const dataUrl = canvas.toDataURL(format, quality);

  // Free canvas memory promptly
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

export async function renderFirstPageThumbnail(file: File): Promise<{
  thumbnailUrl: string | null;
  pageCount: number;
}> {
  try {
    const doc = await loadPdfJsDocument(file);
    try {
      const rendered = await renderPdfPageToDataUrl(doc, 1, {
        maxWidth: 220,
        format: "image/jpeg",
        quality: 0.78,
      });
      return { thumbnailUrl: rendered.dataUrl, pageCount: doc.numPages };
    } finally {
      await doc.destroy();
    }
  } catch {
    return { thumbnailUrl: null, pageCount: 0 };
  }
}

export function parsePageRanges(
  input: string,
  totalPages: number
): { pages: number[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { pages: [], error: "Ingresa al menos una página o rango (ej. 1-3, 5, 8-10)." };
  }

  const resultSet = new Set<number>();
  const ordered: number[] = [];
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > totalPages) {
        return {
          pages: [],
          error: `La página ${n} está fuera de rango (el PDF tiene ${totalPages} páginas).`,
        };
      }
      if (!resultSet.has(n)) {
        resultSet.add(n);
        ordered.push(n);
      }
    } else if (/^\d+\s*-\s*\d+$/.test(part)) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        return {
          pages: [],
          error: `El rango "${part}" excede el total de ${totalPages} páginas.`,
        };
      }
      if (start > end) {
        return {
          pages: [],
          error: `El rango "${part}" es inválido (el inicio debe ser menor o igual al fin).`,
        };
      }
      for (let i = start; i <= end; i++) {
        if (!resultSet.has(i)) {
          resultSet.add(i);
          ordered.push(i);
        }
      }
    } else {
      return {
        pages: [],
        error: `Formato inválido en "${part}". Usa números y guiones separados por comas (ej. 1-3, 5).`,
      };
    }
  }

  return { pages: ordered };
}
