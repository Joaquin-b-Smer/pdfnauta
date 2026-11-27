"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Compass, Sparkles, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3 focus:outline-none">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] text-[#0A0A0A] shadow-md shadow-[#FACC15]/20 transition-transform duration-200 group-hover:scale-105">
            <Compass className="h-5 w-5 stroke-[2.4]" />
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                PDF<span className="text-[#EAB308] dark:text-[#FACC15]">Nauta</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                by <span className="text-foreground">JoApps</span>
              </span>
            </div>
            <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:inline">
              Suite PDF rápida, privada y sin marcas de agua
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="beta" className="py-1 text-[11px] sm:text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">
              Versión Gratuita de Prueba (Beta)
            </span>
            <span className="sm:hidden">Beta Gratuita</span>
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="rounded-xl border-border/90"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-[#FACC15]" />
            ) : (
              <Moon className="h-4 w-4 text-zinc-700" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

export function BetaNoticeBanner() {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-[#FACC15]/20 bg-[#FACC15]/[0.07] dark:bg-[#FACC15]/[0.05]">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-2.5 text-xs text-foreground/90 sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-start gap-2.5 sm:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#CA8A04] dark:text-[#FACC15] sm:mt-0" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-foreground">
              Versión gratuita de prueba de JoApps:
            </strong>{" "}
            sin registro y sin marcas de agua. Las 8 herramientas locales operan{" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              100% en tu dispositivo
            </span>
            ; las conversiones de servidor admiten hasta{" "}
            <strong className="font-semibold">20 MB</strong> y pueden tardar ~30-40s la
            primera vez si el servidor gratuito entra en reposo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ocultar aviso"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
