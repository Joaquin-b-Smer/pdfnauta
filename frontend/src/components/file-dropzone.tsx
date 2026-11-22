"use client";

import * as React from "react";
import { UploadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  helperText?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function FileDropzone({
  accept,
  multiple = false,
  onFilesSelected,
  title = "Arrastra tu archivo aquí o haz clic para seleccionar",
  subtitle,
  helperText,
  compact = false,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    onFilesSelected(multiple ? files : [files[0]]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all duration-200",
        compact ? "px-5 py-7" : "px-6 py-12 sm:py-16",
        dragging
          ? "scale-[1.01] border-[#FACC15] bg-[#FACC15]/10 shadow-lg shadow-[#FACC15]/10"
          : "border-border bg-card/60 hover:border-[#FACC15]/70 hover:bg-card",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border transition-all duration-200",
          compact ? "h-12 w-12" : "h-16 w-16",
          dragging
            ? "border-[#FACC15] bg-[#FACC15] text-[#0A0A0A]"
            : "border-[#FACC15]/30 bg-[#FACC15]/12 text-[#CA8A04] dark:text-[#FACC15] group-hover:scale-105 group-hover:bg-[#FACC15] group-hover:text-[#0A0A0A]"
        )}
      >
        {dragging ? (
          <FileText className={compact ? "h-5 w-5" : "h-7 w-7"} />
        ) : (
          <UploadCloud className={compact ? "h-6 w-6" : "h-8 w-8"} />
        )}
      </div>

      <h3
        className={cn(
          "mt-4 font-bold text-foreground",
          compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
        )}
      >
        {dragging ? "¡Suelta tus archivos ahora!" : title}
      </h3>

      {subtitle && (
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
          {subtitle}
        </p>
      )}

      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#0A0A0A] shadow-sm transition-colors group-hover:bg-[#EAB308] sm:text-sm">
        Elegir archivo{multiple ? "s" : ""}
      </div>

      {helperText && (
        <p className="mt-3 text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
