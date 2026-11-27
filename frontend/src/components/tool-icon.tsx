"use client";

import * as React from "react";
import {
  FileStack,
  Scissors,
  LayoutGrid,
  Images,
  PenTool,
  Stamp,
  Lock,
  FileText,
  FileSpreadsheet,
  Minimize2,
} from "lucide-react";
import type { ToolIconName } from "@/lib/tools";

export function ToolIcon({
  name,
  className = "h-5 w-5",
}: {
  name: ToolIconName;
  className?: string;
}) {
  switch (name) {
    case "merge":
      return <FileStack className={className} />;
    case "split":
      return <Scissors className={className} />;
    case "organize":
      return <LayoutGrid className={className} />;
    case "images":
      return <Images className={className} />;
    case "signature":
      return <PenTool className={className} />;
    case "watermark":
      return <Stamp className={className} />;
    case "lock":
      return <Lock className={className} />;
    case "pdf-word":
      return <FileText className={className} />;
    case "pdf-excel":
      return <FileSpreadsheet className={className} />;
    case "compress":
      return <Minimize2 className={className} />;
  }
}
