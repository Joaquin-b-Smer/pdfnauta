"use client";

import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { loadPdfJsDocument } from "@/lib/pdf-client";

export interface ConversionProgress {
  percent: number;
  message: string;
  page?: number;
  totalPages?: number;
  usingOcr?: boolean;
}

export interface PdfToWordResult {
  blob: Blob;
  pageCount: number;
  ocrPages: number;
  textPages: number;
  tablesDetected: number;
}

interface TextToken {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  fontSize: number;
  isBold: boolean;
}

interface LineCell {
  text: string;
  x0: number;
  x1: number;
}

interface VisualLine {
  y0: number;
  y1: number;
  yCenter: number;
  fontSize: number;
  isBold: boolean;
  cells: LineCell[];
  fullText: string;
}

type StructuredBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string; isBold?: boolean }
  | { type: "list"; text: string; marker: string }
  | { type: "table"; rows: string[][] };

const OCR_DPI = 200;
const MAX_CANVAS_SIDE_PX = 2600;
const MIN_TEXT_CHARS_FOR_NATIVE = 20;

function median(values: number[]): number {
  if (values.length === 0) return 11;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildVisualLines(tokens: TextToken[], pageWidth: number): VisualLine[] {
  if (tokens.length === 0) return [];

  const medFont = median(tokens.map((t) => t.fontSize).filter((s) => s > 0));
  const sorted = [...tokens].sort((a, b) => {
    const ya = (a.y0 + a.y1) / 2;
    const yb = (b.y0 + b.y1) / 2;
    if (Math.abs(ya - yb) > Math.max(3, medFont * 0.45)) return ya - yb;
    return a.x0 - b.x0;
  });

  // Group into horizontal lines by Y center proximity
  const rawLines: { yCenter: number; tolerance: number; items: TextToken[] }[] = [];
  for (const tok of sorted) {
    const yc = (tok.y0 + tok.y1) / 2;
    const tol = Math.max(4, Math.min(tok.fontSize, medFont) * 0.55);
    let matched: (typeof rawLines)[number] | null = null;
    let bestDist = Infinity;
    for (const line of rawLines) {
      const dist = Math.abs(line.yCenter - yc);
      if (dist <= Math.max(line.tolerance, tol) && dist < bestDist) {
        bestDist = dist;
        matched = line;
      }
    }
    if (matched) {
      matched.items.push(tok);
      const count = matched.items.length;
      matched.yCenter = (matched.yCenter * (count - 1) + yc) / count;
    } else {
      rawLines.push({ yCenter: yc, tolerance: tol, items: [tok] });
    }
  }

  rawLines.sort((a, b) => a.yCenter - b.yCenter);

  const visualLines: VisualLine[] = [];
  for (const rawLine of rawLines) {
    const items = rawLine.items.sort((a, b) => a.x0 - b.x0);
    let totalW = 0;
    let totalChars = 0;
    for (const it of items) {
      const len = it.text.trim().length;
      if (len > 0 && it.x1 > it.x0) {
        totalW += it.x1 - it.x0;
        totalChars += len;
      }
    }
    const lineFont = median(items.map((i) => i.fontSize).filter((s) => s > 0));
    const avgCharW = totalChars > 0 ? totalW / totalChars : lineFont * 0.52;
    // Column break threshold: equivalent to ~2.1+ spaces or 2.4% of page width
    const colGapThreshold = Math.max(12, avgCharW * 2.15, pageWidth * 0.022);
    const spaceGapThreshold = Math.max(1.5, avgCharW * 0.28);

    const cells: LineCell[] = [];
    let currText = "";
    let currX0 = items[0].x0;
    let currX1 = items[0].x1;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cleaned = it.text.trim();
      if (!cleaned) continue;

      if (currText.length === 0) {
        currText = cleaned;
        currX0 = it.x0;
        currX1 = it.x1;
        continue;
      }

      const gap = it.x0 - currX1;
      if (gap >= colGapThreshold) {
        cells.push({
          text: currText.replace(/\s+/g, " ").trim(),
          x0: currX0,
          x1: currX1,
        });
        currText = cleaned;
        currX0 = it.x0;
        currX1 = it.x1;
      } else {
        currText += gap >= spaceGapThreshold ? ` ${cleaned}` : cleaned;
        currX1 = Math.max(currX1, it.x1);
      }
    }

    if (currText.trim().length > 0) {
      cells.push({
        text: currText.replace(/\s+/g, " ").trim(),
        x0: currX0,
        x1: currX1,
      });
    }

    if (cells.length === 0) continue;

    const y0 = Math.min(...items.map((i) => i.y0));
    const y1 = Math.max(...items.map((i) => i.y1));
    const boldChars = items
      .filter((i) => i.isBold)
      .reduce((acc, i) => acc + i.text.trim().length, 0);
    const isBold = totalChars > 0 && boldChars / totalChars >= 0.65;

    visualLines.push({
      y0,
      y1,
      yCenter: (y0 + y1) / 2,
      fontSize: lineFont,
      isBold,
      cells,
      fullText: cells.map((c) => c.text).join(" "),
    });
  }

  return visualLines;
}

function alignTableRows(lines: VisualLine[], pageWidth: number): string[][] {
  // Cluster cell start positions (x0) into column anchors so empty cells stay aligned
  const allX0 = lines.flatMap((line) => line.cells.map((c) => c.x0)).sort((a, b) => a - b);
  const clusterTol = Math.max(20, pageWidth * 0.036);

  const anchors: number[] = [];
  for (const x of allX0) {
    let matchedIdx = -1;
    for (let i = 0; i < anchors.length; i++) {
      if (Math.abs(anchors[i] - x) <= clusterTol) {
        matchedIdx = i;
        break;
      }
    }
    if (matchedIdx === -1) {
      anchors.push(x);
    } else {
      anchors[matchedIdx] = (anchors[matchedIdx] + x) / 2;
    }
  }
  anchors.sort((a, b) => a - b);

  // Fallback to simple sequential cells if anchor count explodes
  const maxCellsInAnyRow = Math.max(...lines.map((l) => l.cells.length));
  if (anchors.length < 2 || anchors.length > Math.max(maxCellsInAnyRow + 3, 14)) {
    return lines.map((l) => {
      const row = l.cells.map((c) => c.text);
      while (row.length < maxCellsInAnyRow) row.push("");
      return row;
    });
  }

  const grid: string[][] = lines.map((line) => {
    const row = Array<string>(anchors.length).fill("");
    for (const cell of line.cells) {
      let bestCol = 0;
      let bestDist = Infinity;
      for (let i = 0; i < anchors.length; i++) {
        const d = Math.abs(anchors[i] - cell.x0);
        if (d < bestDist) {
          bestDist = d;
          bestCol = i;
        }
      }
      row[bestCol] = row[bestCol] ? `${row[bestCol]} ${cell.text}` : cell.text;
    }
    return row;
  });

  // Remove completely empty columns
  const nonEmptyColIndices: number[] = [];
  for (let c = 0; c < anchors.length; c++) {
    if (grid.some((r) => r[c].trim().length > 0)) {
      nonEmptyColIndices.push(c);
    }
  }

  return grid.map((r) => nonEmptyColIndices.map((c) => r[c]));
}

function reconstructPageBlocks(
  tokens: TextToken[],
  pageWidth: number
): StructuredBlock[] {
  const lines = buildVisualLines(tokens, pageWidth);
  if (lines.length === 0) return [];

  const medFont = median(lines.map((l) => l.fontSize));
  const blocks: StructuredBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    // Check if we're starting a table block: >= 2 rows with >= 2 cells
    if (lines[i].cells.length >= 2) {
      let j = i;
      let multiCellCount = 0;
      while (j < lines.length) {
        const curr = lines[j];
        const prev = j > i ? lines[j - 1] : null;
        const vertGap = prev ? curr.y0 - prev.y1 : 0;
        const tooFarApart = prev !== null && vertGap > medFont * 3.4;
        if (tooFarApart) break;

        if (curr.cells.length >= 2) {
          multiCellCount++;
          j++;
        } else if (
          // Allow a single short continuation/sub-row inside a table if the next row also has >= 2 cells
          j + 1 < lines.length &&
          lines[j + 1].cells.length >= 2 &&
          curr.fullText.length < 70 &&
          lines[j + 1].y0 - curr.y1 <= medFont * 2.2
        ) {
          j++;
        } else {
          break;
        }
      }

      if (multiCellCount >= 2) {
        const tableLines = lines.slice(i, j);
        const rows = alignTableRows(tableLines, pageWidth);
        if (rows.length > 0 && rows[0].length >= 2) {
          blocks.push({ type: "table", rows });
          i = j;
          continue;
        }
      }
    }

    const line = lines[i];
    const text = line.fullText.trim();
    if (!text) {
      i++;
      continue;
    }

    // List detection
    const listMatch = text.match(/^([•●▪◦‣–—\-*]|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/);
    if (listMatch) {
      blocks.push({
        type: "list",
        marker: listMatch[1],
        text: listMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Heading detection
    const isUpperTitle =
      text.length >= 3 &&
      text.length <= 75 &&
      text === text.toUpperCase() &&
      /[A-ZÁÉÍÓÚÑ]/.test(text);

    if (line.fontSize >= medFont * 1.38) {
      blocks.push({ type: "heading", level: 1, text });
      i++;
      continue;
    }
    if (
      (line.fontSize >= medFont * 1.18 || (line.isBold && text.length <= 85) || isUpperTitle) &&
      !text.endsWith(".")
    ) {
      blocks.push({ type: "heading", level: 2, text });
      i++;
      continue;
    }

    // Paragraph merging for wrapped consecutive body lines
    let paraText = text;
    let k = i + 1;
    while (k < lines.length) {
      const next = lines[k];
      const prev = lines[k - 1];
      if (next.cells.length >= 2) break;
      if (next.fontSize >= medFont * 1.18) break;
      if (/^([•●▪◦‣–—\-*]|\d+[.)]|[a-zA-Z][.)])\s+/.test(next.fullText.trim())) break;
      const vertGap = next.y0 - prev.y1;
      if (vertGap > medFont * 0.95) break;
      if (/[.:!?]$/.test(prev.fullText.trim()) && prev.fullText.length < 55) break;

      const nextText = next.fullText.trim();
      if (paraText.endsWith("-") && !paraText.endsWith(" -")) {
        paraText = paraText.slice(0, -1) + nextText;
      } else {
        paraText = `${paraText} ${nextText}`;
      }
      k++;
    }

    blocks.push({ type: "paragraph", text: paraText, isBold: line.isBold });
    i = k;
  }

  return blocks;
}

async function extractNativeTokensFromPage(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfJsDocument>>["getPage"]>>
): Promise<{ tokens: TextToken[]; pageWidth: number; meaningfulChars: number }> {
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const tokens: TextToken[] = [];
  let meaningfulChars = 0;

  for (const raw of textContent.items) {
    if (!("str" in raw)) continue;
    const str = raw.str;
    if (!str || str.trim().length === 0) continue;

    meaningfulChars += str.replace(/\s+/g, "").length;
    const tr = raw.transform;
    const x = typeof tr?.[4] === "number" ? tr[4] : 0;
    const yBaseline = typeof tr?.[5] === "number" ? tr[5] : 0;
    const scaleFont =
      typeof tr?.[0] === "number" && typeof tr?.[1] === "number"
        ? Math.hypot(tr[0], tr[1])
        : 0;
    const fontSize =
      scaleFont > 0
        ? scaleFont
        : typeof raw.height === "number" && raw.height > 0
          ? raw.height
          : 11;
    const totalW =
      typeof raw.width === "number" && raw.width > 0
        ? raw.width
        : str.length * fontSize * 0.5;
    const isBold =
      "fontName" in raw && typeof raw.fontName === "string"
        ? /(bold|black|heavy|semi|demi)/i.test(raw.fontName)
        : false;

    const y1 = viewport.height - yBaseline;
    const y0 = y1 - fontSize;

    // Split spans containing explicit tabs or 2+ spaces proportionally along X
    const subMatches = Array.from(str.matchAll(/[^\t\s]+(?:\s[^\t\s]+)*/g));
    if (subMatches.length <= 1) {
      tokens.push({
        text: str.trim(),
        x0: x,
        y0,
        x1: x + totalW,
        y1,
        fontSize,
        isBold,
      });
    } else {
      // Split by tabs or 2+ consecutive spaces while preserving X proportions
      const parts = str.split(/(\t|\s{2,})/);
      let charCursor = 0;
      const totalLen = Math.max(1, str.length);
      for (const part of parts) {
        const partLen = part.length;
        if (part.trim().length > 0) {
          const px0 = x + (charCursor / totalLen) * totalW;
          const px1 = x + ((charCursor + partLen) / totalLen) * totalW;
          tokens.push({
            text: part.trim(),
            x0: px0,
            y0,
            x1: px1,
            y1,
            fontSize,
            isBold,
          });
        }
        charCursor += partLen;
      }
    }
  }

  return { tokens, pageWidth: viewport.width, meaningfulChars };
}

async function renderPageToGrayscaleCanvas(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfJsDocument>>["getPage"]>>
): Promise<HTMLCanvasElement> {
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height, 1);
  const scale = Math.min(OCR_DPI / 72, MAX_CANVAS_SIDE_PX / longestSide);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("No se pudo inicializar el lienzo 2D para OCR.");
  }

  // Solid white paper background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert to grayscale + mild contrast stretch to sharpen scanned text and tables
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum = Math.min(255, Math.max(0, (lum - 128) * 1.2 + 128));
    data[i] = data[i + 1] = data[i + 2] = lum;
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

interface TesseractWordLike {
  text?: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractDataLike {
  text?: string;
  words?: TesseractWordLike[];
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: TesseractWordLike[];
      }>;
    }>;
  }> | null;
}

function extractTokensFromOcrData(data: TesseractDataLike): TextToken[] {
  const collected: TesseractWordLike[] = [];

  if (Array.isArray(data.blocks) && data.blocks.length > 0) {
    for (const block of data.blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const word of line.words ?? []) {
            collected.push(word);
          }
        }
      }
    }
  } else if (Array.isArray(data.words) && data.words.length > 0) {
    collected.push(...data.words);
  }

  const tokens: TextToken[] = [];
  for (const w of collected) {
    const text = (w.text || "").trim();
    if (!text) continue;
    // Ignore isolated low-confidence noise punctuation (e.g. scan specks or grid border artifacts)
    if (
      typeof w.confidence === "number" &&
      w.confidence < 25 &&
      /^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+$/.test(text)
    ) {
      continue;
    }
    const bbox = w.bbox;
    if (!bbox) continue;
    const h = Math.max(8, bbox.y1 - bbox.y0);
    // Filter out pure vertical/horizontal table border lines misread as "|" or "_"
    if (/^[|_—–-]+$/.test(text) && (h > 45 || bbox.x1 - bbox.x0 < 3)) {
      continue;
    }
    tokens.push({
      text,
      x0: bbox.x0,
      y0: bbox.y0,
      x1: bbox.x1,
      y1: bbox.y1,
      fontSize: h,
      isBold: false,
    });
  }

  return tokens;
}

function buildDocxChildrenFromBlocks(blocks: StructuredBlock[]): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 220, after: 110 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              font: "Calibri",
              size: block.level === 1 ? 30 : 24,
              color: "111827",
            }),
          ],
        })
      );
    } else if (block.type === "list") {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 60 },
          indent: { left: 360, hanging: 180 },
          children: [
            new TextRun({
              text: `${block.marker} `,
              bold: true,
              font: "Calibri",
              size: 22,
            }),
            new TextRun({
              text: block.text,
              font: "Calibri",
              size: 22,
            }),
          ],
        })
      );
    } else if (block.type === "paragraph") {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 110 },
          children: [
            new TextRun({
              text: block.text,
              bold: Boolean(block.isBold),
              font: "Calibri",
              size: 22,
            }),
          ],
        })
      );
    } else if (block.type === "table") {
      const colCount = Math.max(1, block.rows[0]?.length || 1);
      const colPct = Math.floor(100 / colCount);
      const thinBorder = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CBD5E1",
      };

      const tableRows = block.rows.map((row, rowIdx) => {
        const isHeader = rowIdx === 0;
        return new TableRow({
          tableHeader: isHeader,
          children: row.map(
            (cellText) =>
              new TableCell({
                width: { size: colPct, type: WidthType.PERCENTAGE },
                shading: isHeader
                  ? {
                      type: ShadingType.CLEAR,
                      color: "auto",
                      fill: "F1F5F9",
                    }
                  : undefined,
                margins: { top: 80, bottom: 80, left: 110, right: 110 },
                borders: {
                  top: thinBorder,
                  bottom: thinBorder,
                  left: thinBorder,
                  right: thinBorder,
                },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: cellText,
                        bold: isHeader,
                        font: "Calibri",
                        size: 20,
                        color: "111827",
                      }),
                    ],
                  }),
                ],
              })
          ),
        });
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        })
      );
      children.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
    }
  }

  return children;
}

export async function convertPdfToWordClientSide(
  file: File,
  options?: {
    forceOcr?: boolean;
    onProgress?: (progress: ConversionProgress) => void;
  }
): Promise<PdfToWordResult> {
  const onProgress = options?.onProgress;
  const forceOcr = Boolean(options?.forceOcr);

  // Request screen wake lock on mobile if available so locking doesn't pause conversion
  let wakeLock: { release: () => Promise<void> } | null = null;
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock) {
      wakeLock = await nav.wakeLock.request("screen");
    }
  } catch {
    // Wake lock is optional and may not be supported on all browsers
  }

  onProgress?.({ percent: 2, message: "Analizando PDF..." });

  const pdfDoc = await loadPdfJsDocument(file);
  const totalPages = pdfDoc.numPages;

  let ocrWorker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null =
    null;
  let activeOcrPage = 0;
  let ocrPages = 0;
  let textPages = 0;
  let tablesDetected = 0;
  const docChildren: Array<Paragraph | Table> = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageBasePercent = 5 + ((pageNum - 1) / totalPages) * 85;
      const pageSpanPercent = 85 / totalPages;

      onProgress?.({
        percent: Math.round(pageBasePercent),
        message: `Analizando página ${pageNum} de ${totalPages}...`,
        page: pageNum,
        totalPages,
      });

      const page = await pdfDoc.getPage(pageNum);
      const native = await extractNativeTokensFromPage(page);
      const needsOcr = forceOcr || native.meaningfulChars < MIN_TEXT_CHARS_FOR_NATIVE;

      let pageBlocks: StructuredBlock[] = [];

      if (!needsOcr) {
        textPages++;
        onProgress?.({
          percent: Math.round(pageBasePercent + pageSpanPercent * 0.5),
          message: `Extrayendo página ${pageNum} de ${totalPages}...`,
          page: pageNum,
          totalPages,
          usingOcr: false,
        });
        pageBlocks = reconstructPageBlocks(native.tokens, native.pageWidth);
      } else {
        ocrPages++;
        activeOcrPage = pageNum;

        if (!ocrWorker) {
          onProgress?.({
            percent: Math.round(pageBasePercent + 1),
            message: `Cargando OCR en español (página ${pageNum} de ${totalPages})...`,
            page: pageNum,
            totalPages,
            usingOcr: true,
          });
          const Tesseract = await import("tesseract.js");
          ocrWorker = await Tesseract.createWorker("spa", 1, {
            // Lightweight fast Spanish model for mobile speed and low RAM
            langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
            logger: (msg) => {
              if (!activeOcrPage) return;
              const pBase = 5 + ((activeOcrPage - 1) / totalPages) * 85;
              const pSpan = 85 / totalPages;
              if (msg.status === "recognizing text" && typeof msg.progress === "number") {
                const pct = Math.min(
                  90,
                  Math.round(pBase + pSpan * (0.15 + msg.progress * 0.85))
                );
                onProgress?.({
                  percent: pct,
                  message: `Página ${activeOcrPage} de ${totalPages} con OCR...`,
                  page: activeOcrPage,
                  totalPages,
                  usingOcr: true,
                });
              }
            },
          });
          // PSM 4 (SINGLE_COLUMN) dramatically improves detection inside boxed/bordered tables
          await ocrWorker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
            preserve_interword_spaces: "1",
          });
        }

        onProgress?.({
          percent: Math.round(pageBasePercent + pageSpanPercent * 0.12),
          message: `Página ${pageNum} de ${totalPages} con OCR...`,
          page: pageNum,
          totalPages,
          usingOcr: true,
        });

        const canvas = await renderPageToGrayscaleCanvas(page);
        const canvasWidth = canvas.width;
        try {
          let result = await ocrWorker.recognize(canvas, {}, { blocks: true });
          let ocrData = result.data as unknown as TesseractDataLike;
          let ocrTokens = extractTokensFromOcrData(ocrData);

          // If a heavily bordered/complex scan yielded very few tokens in PSM 4, retry with SPARSE_TEXT (PSM 11)
          if (ocrTokens.length < 8) {
            const Tesseract = await import("tesseract.js");
            await ocrWorker.setParameters({
              tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
              preserve_interword_spaces: "1",
            });
            const sparseResult = await ocrWorker.recognize(canvas, {}, { blocks: true });
            const sparseData = sparseResult.data as unknown as TesseractDataLike;
            const sparseTokens = extractTokensFromOcrData(sparseData);
            if (sparseTokens.length > ocrTokens.length) {
              result = sparseResult;
              ocrData = sparseData;
              ocrTokens = sparseTokens;
            }
            await ocrWorker.setParameters({
              tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
              preserve_interword_spaces: "1",
            });
          }

          if (ocrTokens.length > 0) {
            pageBlocks = reconstructPageBlocks(ocrTokens, canvasWidth);
          } else if (ocrData.text && ocrData.text.trim().length > 0) {
            pageBlocks = ocrData.text
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((text) => ({ type: "paragraph" as const, text }));
          }
        } finally {
          // Immediately free page canvas memory before moving to next page
          canvas.width = 0;
          canvas.height = 0;
        }
      }

      if (pageNum > 1) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }

      if (pageBlocks.length === 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "",
                font: "Calibri",
                size: 22,
              }),
            ],
          })
        );
      } else {
        tablesDetected += pageBlocks.filter((b) => b.type === "table").length;
        docChildren.push(...buildDocxChildrenFromBlocks(pageBlocks));
      }

      onProgress?.({
        percent: Math.round(pageBasePercent + pageSpanPercent),
        message: needsOcr
          ? `Página ${pageNum} de ${totalPages} con OCR...`
          : `Página ${pageNum} de ${totalPages} lista...`,
        page: pageNum,
        totalPages,
        usingOcr: needsOcr,
      });
    }

    onProgress?.({ percent: 94, message: "Armando Word..." });

    const doc = new Document({
      creator: "PDFNauta by JoApps",
      description: "Documento convertido 100% en tu navegador con PDFNauta",
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1080,
                right: 1080,
                bottom: 1080,
                left: 1080,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    onProgress?.({ percent: 100, message: "¡Word listo para descargar!" });

    return {
      blob,
      pageCount: totalPages,
      ocrPages,
      textPages,
      tablesDetected,
    };
  } finally {
    activeOcrPage = 0;
    if (ocrWorker) {
      await ocrWorker.terminate().catch(() => {});
    }
    await pdfDoc.destroy().catch(() => {});
    if (wakeLock) {
      await wakeLock.release().catch(() => {});
    }
  }
}
