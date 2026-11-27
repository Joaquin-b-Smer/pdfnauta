"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Compass, Sparkles, Info, X, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/context/language-context";
import { APP_VERSION } from "@/config/version";

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="group flex items-center gap-3 focus:outline-none"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FACC15] text-[#0A0A0A] shadow-md shadow-[#FACC15]/20 transition-transform duration-200 group-hover:scale-105">
            <Compass className="h-5 w-5 stroke-[2.4]" />
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                PDF<span className="text-[#EAB308] dark:text-[#FACC15]">Nauta</span>
              </span>
              <span className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-400/15 px-2 py-0.5 text-[10px] font-bold leading-none text-purple-700 dark:border-purple-300/35 dark:bg-purple-400/20 dark:text-purple-200 sm:text-[11px]">
                {APP_VERSION}
              </span>
              <span className="hidden text-xs font-semibold text-muted-foreground xs:inline sm:inline">
                by <span className="text-foreground">JoApps</span>
              </span>
            </div>
            <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:inline">
              {t.navbar.tagline}
            </span>
          </div>
        </Link>

        {/* Desktop right controls: Beta badge -> ES | EN pill -> Theme action */}
        <div className="hidden items-center gap-3 md:flex">
          <Badge variant="beta" className="py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>{t.navbar.betaFull}</span>
          </Badge>

          <LanguageToggle />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? t.navbar.switchToLight : t.navbar.switchToDark}
            title={isDark ? t.navbar.switchToLight : t.navbar.switchToDark}
            className="rounded-xl border-border/90"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-[#FACC15]" />
            ) : (
              <Moon className="h-4 w-4 text-zinc-700" />
            )}
          </Button>
        </div>

        {/* Mobile right controls: compact menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <Badge variant="beta" className="py-1 text-[11px]">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span>{t.navbar.betaShort}</span>
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t.navbar.closeMenuAria : t.navbar.menuAria}
            className="rounded-xl border-border/90"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile collapsible dropdown menu: links -> ES | EN pill -> theme/CTA */}
      {mobileMenuOpen && (
        <div className="border-t border-border/80 bg-background/95 px-4 py-4 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              {t.navbar.allToolsLink}
            </Link>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t.navbar.languageLabel}
              </span>
              <LanguageToggle />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTheme(isDark ? "light" : "dark");
                setMobileMenuOpen(false);
              }}
              className="w-full justify-center rounded-xl border-border/90"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-[#FACC15]" />
                  {t.navbar.switchToLight}
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-zinc-700" />
                  {t.navbar.switchToDark}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function BetaNoticeBanner() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-[#FACC15]/20 bg-[#FACC15]/[0.07] dark:bg-[#FACC15]/[0.05]">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-2.5 text-xs text-foreground/90 sm:items-center sm:px-6 lg:px-8">
        <div className="flex items-start gap-2.5 sm:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#CA8A04] dark:text-[#FACC15] sm:mt-0" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-foreground">
              {t.betaBanner.title}
            </strong>{" "}
            {t.betaBanner.beforeLocal}{" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {t.betaBanner.localHighlight}
            </span>
            {t.betaBanner.middle}{" "}
            <strong className="font-semibold">{t.betaBanner.limit}</strong>{" "}
            {t.betaBanner.after}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.betaBanner.dismissAria}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
