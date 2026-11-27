"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Server, Clock } from "lucide-react";
import type { PdfToolMeta } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { ToolIcon } from "@/components/tool-icon";
import { ServerWarmupStatus } from "@/components/server-status";

interface ToolShellProps {
  tool: PdfToolMeta;
  children: React.ReactNode;
}

export function ToolShell({ tool, children }: ToolShellProps) {
  const isLocal = tool.execution === "local";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#FACC15]/50 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a todas las herramientas
        </Link>

        {isLocal ? (
          <Badge variant="local" className="px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Procesamiento local • 100% Privado
          </Badge>
        ) : (
          <Badge variant="server" className="px-3 py-1 text-xs">
            <Server className="h-3.5 w-3.5" />
            Motor de Alta Precisión • Máx. 20 MB
          </Badge>
        )}
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
              {tool.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {tool.pageSubtitle ?? tool.description}
            </p>
          </div>
        </div>
      </div>

      {!isLocal && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#FACC15]/30 bg-[#FACC15]/[0.07] p-4 text-xs leading-relaxed text-foreground/90 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#CA8A04] dark:text-[#FACC15]" />
            <div>
              <strong className="font-semibold text-foreground">
                Nota de la versión gratuita de prueba (JoApps):
              </strong>{" "}
              Esta herramienta utiliza nuestro motor Python dedicado (límite de{" "}
              <strong>20 MB</strong>, sin marcas de agua, borrado automático tras la
              descarga). Si el servidor gratuito estuvo inactivo, la primera conversión
              puede demorar ~30-40 segundos en despertar.
            </div>
          </div>
          <div className="shrink-0 pl-7 sm:pl-0">
            <ServerWarmupStatus />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
