"use client";

import * as React from "react";
import { useParams, notFound } from "next/navigation";
import { getToolBySlug } from "@/lib/tools";
import { ToolShell } from "@/components/tool-shell";
import { MergePdfTool } from "@/components/tools/merge-pdf-tool";
import { SplitPdfTool } from "@/components/tools/split-pdf-tool";
import { OrganizePagesTool } from "@/components/tools/organize-pages-tool";
import { PdfImagesTool } from "@/components/tools/pdf-images-tool";
import { SignPdfTool } from "@/components/tools/sign-pdf-tool";
import { WatermarkNumberingTool } from "@/components/tools/watermark-numbering-tool";
import { ProtectUnlockTool } from "@/components/tools/protect-unlock-tool";
import { PdfToWordTool } from "@/components/tools/pdf-to-word-tool";
import { WordToPdfTool } from "@/components/tools/word-to-pdf-tool";
import { CompressPdfTool } from "@/components/tools/compress-pdf-tool";

export default function ToolPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const tool = slug ? getToolBySlug(slug) : undefined;

  if (!tool) {
    notFound();
  }

  const renderTool = () => {
    switch (tool.slug) {
      case "unir-pdf":
        return <MergePdfTool />;
      case "separar-pdf":
        return <SplitPdfTool />;
      case "organizar-paginas":
        return <OrganizePagesTool />;
      case "pdf-imagenes":
        return <PdfImagesTool />;
      case "firmar-pdf":
        return <SignPdfTool />;
      case "marca-agua-numeracion":
        return <WatermarkNumberingTool />;
      case "proteger-desbloquear":
        return <ProtectUnlockTool />;
      case "pdf-a-word":
        return <PdfToWordTool />;
      case "word-a-pdf":
        return <WordToPdfTool />;
      case "comprimir-pdf":
        return <CompressPdfTool />;
      default:
        return null;
    }
  };

  return <ToolShell tool={tool}>{renderTool()}</ToolShell>;
}
