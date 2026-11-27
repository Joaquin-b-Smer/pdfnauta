"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { PdfToolMeta } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { ToolIcon } from "@/components/tool-icon";
import { useLanguage } from "@/context/language-context";

interface ToolShellProps {
  tool: PdfToolMeta;
  children: React.ReactNode;
}

export function ToolShell({ tool, children }: ToolShellProps) {
  const { t } = useLanguage();
  const localized = t.tools[tool.slug as keyof typeof t.tools] as
    | { title?: string; description?: string; pageSubtitle?: string }
    | undefined;

  const title = localized?.title ?? tool.title;
  const subtitle =
    localized?.pageSubtitle ?? localized?.description ?? tool.pageSubtitle ?? tool.description;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#FACC15]/50 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.toolShell.backLink}
        </Link>

        <Badge variant="local" className="px-3 py-1 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.toolShell.badgeLocal}
        </Badge>
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${
              tool.icon === "pdf-excel"
                ? "bg-[#217346]/15 text-[#217346] ring-[#217346]/30 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30"
                : "bg-[#FACC15]/15 text-[#CA8A04] ring-[#FACC15]/30 dark:text-[#FACC15]"
            }`}
          >
            <ToolIcon name={tool.icon} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
