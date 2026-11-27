"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Table2,
  ShieldCheck,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { loadPdfJsDocument } from "@/lib/pdf-client";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

const MAX_EXCEL_FILE_MB = 10;
const MAX_EXCEL_FILE_BYTES = MAX_EXCEL_FILE_MB * 1024 * 1024;
const PREVIEW_ROW_LIMIT = 10;

const SCANNED_PDF_MESSAGE =
  "Este PDF parece ser una imagen escaneada y no tiene texto para extraer. Probá con un PDF con texto seleccionable.";

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExtractedTableData {
  rows: string[][];
  maxColumns: number;
  pageCount: number;
}

function splitRowItemsIntoColumns(items: PositionedTextItem[]): string[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.x - b.x);

  // Estimate average character width across this line to detect column gaps accurately
  let totalWidth = 0;
  let totalChars = 0;
  for (const item of sorted) {
    const len = item.str.trim().length;
    if (len > 0 && item.width > 0) {
      totalWidth += item.width;
      totalChars += len;
    }
  }
  const avgCharWidth = totalChars > 0 ? totalWidth / totalChars : 6;
  const columnGapThreshold = Math.max(10, avgCharWidth * 2.2);
  const spaceGapThreshold = Math.max(1.5, avgCharWidth * 0.3);

  const cells: string[] = [];
  let currentCell = "";
  let prevEndX: number | null = null;

  const pushCell = () => {
    const cleaned = currentCell.replace(/\s+/g, " ").trim();
    if (cleaned.length > 0 || cells.length > 0) {
      cells.push(cleaned);
    }
    currentCell = "";
  };

  for (const item of sorted) {
    const raw = item.str;
    if (!raw || raw.trim().length === 0) {
      continue;
    }

    // If a single text span contains tabs or 2+ consecutive spaces, split it into columns
    const subParts = raw.split(/\t|\s{2,}/).filter((p) => p.trim().length > 0);
    if (subParts.length === 0) continue;

    if (prevEndX !== null) {
      const gap = item.x - prevEndX;
      if (gap >= columnGapThreshold) {
        pushCell();
      } else if (gap >= spaceGapThreshold && currentCell && !currentCell.endsWith(" ")) {
        currentCell += " ";
      }
    }

    subParts.forEach((part, idx) => {
      if (idx > 0) {
        pushCell();
      }
      currentCell += part.trim();
    });

    const itemWidth = item.width > 0 ? item.width : raw.length * avgCharWidth;
    prevEndX = item.x + itemWidth;
  }

  if (currentCell.trim().length > 0) {
    pushCell();
  }

  // Trim trailing empty cells
  while (cells.length > 0 && cells[cells.length - 1] === "") {
    cells.pop();
  }

  return cells;
}

async function extractTableFromPdf(file: File): Promise<ExtractedTableData> {
  const pdfDoc = await loadPdfJsDocument(file);
  const allRows: string[][] = [];
  let totalMeaningfulChars = 0;

  try {
    const pageCount = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const items: PositionedTextItem[] = [];
      for (const rawItem of textContent.items) {
        if (!("str" in rawItem)) continue;
        const text = rawItem.str;
        if (!text || text.trim().length === 0) continue;

        totalMeaningfulChars += text.replace(/\s+/g, "").length;
        const transform = rawItem.transform;
        const x = typeof transform?.[4] === "number" ? transform[4] : 0;
        const y = typeof transform?.[5] === "number" ? transform[5] : 0;
        const height =
          typeof rawItem.height === "number" && rawItem.height > 0
            ? rawItem.height
            : Math.abs(transform?.[3] || 10);
        const width = typeof rawItem.width === "number" ? rawItem.width : 0;

        items.push({ str: text, x, y, width, height });
      }

      if (items.length === 0) continue;

      // Sort top-to-bottom (higher Y first in PDF coordinates), then left-to-right
      items.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
        return a.x - b.x;
      });

      // Cluster text items into horizontal lines using Y proximity
      const lines: { y: number; tolerance: number; items: PositionedTextItem[] }[] = [];

      for (const item of items) {
        const itemTol = Math.max(3, item.height * 0.45);
        let matchedLine = null;
        for (const line of lines) {
          if (Math.abs(line.y - item.y) <= Math.max(line.tolerance, itemTol)) {
            matchedLine = line;
            break;
          }
        }
        if (matchedLine) {
          matchedLine.items.push(item);
        } else {
          lines.push({ y: item.y, tolerance: itemTol, items: [item] });
        }
      }

      lines.sort((a, b) => b.y - a.y);

      for (const line of lines) {
        const cols = splitRowItemsIntoColumns(line.items);
        if (cols.length > 0 && cols.some((c) => c.trim().length > 0)) {
          allRows.push(cols);
        }
      }
    }

    if (totalMeaningfulChars < 3 || allRows.length === 0) {
      throw new Error(SCANNED_PDF_MESSAGE);
    }

    const maxColumns = allRows.reduce((max, row) => Math.max(max, row.length), 1);
    const normalizedRows = allRows.map((row) => {
      if (row.length === maxColumns) return row;
      return [...row, ...Array(maxColumns - row.length).fill("")];
    });

    return {
      rows: normalizedRows,
      maxColumns,
      pageCount,
    };
  } finally {
    await pdfDoc.destroy();
  }
}

export function PdfToExcelTool() {
  const { consumePendingFile } = usePendingFile();
  const [file, setFile] = React.useState<File | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [tableData, setTableData] = React.useState<ExtractedTableData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const handleSelectFile = React.useCallback(async (selected: File) => {
    setError(null);
    setDoneMessage(null);
    setTableData(null);

    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFile(null);
      setError("Solo se aceptan archivos en formato .pdf.");
      return;
    }

    if (selected.size > MAX_EXCEL_FILE_BYTES) {
      setFile(null);
      setError(
        `El archivo pesa ${formatBytes(selected.size)} y supera el máximo permitido de ${MAX_EXCEL_FILE_MB} MB.`
      );
      return;
    }

    setFile(selected);
    setExtracting(true);

    try {
      const extracted = await extractTableFromPdf(selected);
      setTableData(extracted);
    } catch (err) {
      if (err instanceof Error && err.message === SCANNED_PDF_MESSAGE) {
        setError(SCANNED_PDF_MESSAGE);
      } else {
        setError(
          "No pudimos leer este PDF. Verificá que no esté dañado ni protegido con contraseña."
        );
      }
    } finally {
      setExtracting(false);
    }
  }, []);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) {
      void handleSelectFile(pending);
    }
  }, [consumePendingFile, handleSelectFile]);

  const handleDownloadExcel = () => {
    if (!file || !tableData || tableData.rows.length === 0 || downloading) return;
    setDownloading(true);
    setError(null);

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(tableData.rows);

      // Auto-fit column widths so the spreadsheet opens cleanly in Excel
      const colWidths = Array.from({ length: tableData.maxColumns }, (_, colIdx) => {
        let maxLen = 10;
        for (const row of tableData.rows) {
          const val = row[colIdx] ?? "";
          if (val.length > maxLen) maxLen = val.length;
        }
        return { wch: Math.min(maxLen + 3, 55) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tablas PDF");

      const excelArrayBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const outName = `${stripExtension(file.name)}.xlsx`;
      downloadBlob(blob, outName);
      setDoneMessage(`¡Listo! Se descargó "${outName}" con ${tableData.rows.length} filas.`);
    } catch {
      setError("Ocurrió un error al generar el archivo Excel (.xlsx). Intentá nuevamente.");
    } finally {
      setDownloading(false);
    }
  };

  const resetTool = () => {
    setFile(null);
    setTableData(null);
    setError(null);
    setDoneMessage(null);
  };

  const previewRows = tableData ? tableData.rows.slice(0, PREVIEW_ROW_LIMIT) : [];

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="space-y-4">
          <FileDropzone
            accept=".pdf,application/pdf"
            onFilesSelected={(files) => files[0] && void handleSelectFile(files[0])}
            title="Arrastrá tu PDF aquí o tocá el botón para subirlo"
            subtitle="Detectamos las filas y columnas del texto de tu PDF para que puedas editarlo en Excel."
            buttonLabel="Elegir PDF"
            buttonClassName="px-6 py-2.5 text-sm sm:text-base"
            helperText={`Solo archivos .pdf • Máximo ${MAX_EXCEL_FILE_MB} MB`}
          />

          {error && (
            <div
              role="alert"
              className="mx-auto flex max-w-2xl items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500 sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <Card className="space-y-5 p-5 sm:p-6">
          {/* File header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#217346]/15 text-[#217346] ring-1 ring-[#217346]/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-bold text-foreground"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                  {tableData &&
                    ` • ${tableData.pageCount} pág. • ${tableData.rows.length} filas • ${tableData.maxColumns} col.`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={extracting || downloading}
              onClick={resetTool}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Elegir otro PDF
            </Button>
          </div>

          {/* Loading state */}
          {extracting && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#217346] dark:text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Leyendo tablas del PDF en tu navegador…
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Analizando líneas y columnas sin subir tu documento.
                </p>
              </div>
            </div>
          )}

          {/* Error (including scanned PDF message) */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs leading-relaxed text-red-500 sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table preview (first 10 rows) */}
          {tableData && previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Table2 className="h-4 w-4 text-[#217346] dark:text-emerald-400" />
                  <span>Vista previa de la tabla</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Mostrando {previewRows.length} de {tableData.rows.length} fila
                  {tableData.rows.length === 1 ? "" : "s"}
                  {tableData.rows.length > PREVIEW_ROW_LIMIT
                    ? ` (primeras ${PREVIEW_ROW_LIMIT})`
                    : ""}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border bg-background">
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[#217346]/10 dark:bg-emerald-500/10">
                      <th className="w-10 border-r border-border/70 px-3 py-2 text-center text-[11px] font-bold text-muted-foreground">
                        #
                      </th>
                      {Array.from({ length: tableData.maxColumns }, (_, colIdx) => (
                        <th
                          key={colIdx}
                          className="whitespace-nowrap border-r border-border/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#217346] last:border-r-0 dark:text-emerald-400"
                        >
                          Col {colIdx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {previewRows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="transition-colors hover:bg-secondary/40"
                      >
                        <td className="border-r border-border/70 bg-secondary/20 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, colIdx) => (
                          <td
                            key={colIdx}
                            className="max-w-[260px] truncate border-r border-border/60 px-3 py-2 text-foreground last:border-r-0"
                            title={cell}
                          >
                            {cell || (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {doneMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-400 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{doneMessage}</span>
            </div>
          )}

          {/* Excel Green Download Button */}
          {tableData && tableData.rows.length > 0 && (
            <div className="pt-1">
              <Button
                type="button"
                size="lg"
                disabled={downloading || extracting}
                onClick={handleDownloadExcel}
                className="w-full bg-[#217346] text-white shadow-sm shadow-[#217346]/25 hover:bg-[#185C37] focus-visible:ring-[#217346]"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando Excel (.xlsx)…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Descargar Excel (.xlsx)
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Privacy footer note */}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tus archivos no salen de tu dispositivo. Todo se procesa en tu navegador.
        </span>
      </p>
    </div>
  );
}
