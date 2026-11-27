"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShieldCheck,
  UploadCloud,
  Sparkles,
  ArrowRight,
  X,
  FileText,
  Zap,
  Lock,
} from "lucide-react";
import { PDF_TOOLS, TOOL_CATEGORIES, type ToolCategory, type PdfToolMeta } from "@/lib/tools";
import { usePendingFile } from "@/context/pending-file-context";
import { useLanguage } from "@/context/language-context";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/card";
import { ToolIcon } from "@/components/tool-icon";

export default function HomePage() {
  const router = useRouter();
  const { setPendingFile } = usePendingFile();
  const { t } = useLanguage();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<ToolCategory>("todas");
  const [draggingOverPage, setDraggingOverPage] = React.useState(false);
  const [smartDropFile, setSmartDropFile] = React.useState<File | null>(null);
  const smartInputRef = React.useRef<HTMLInputElement>(null);

  const getLocalizedTool = React.useCallback(
    (tool: PdfToolMeta) => {
      const entry = t.tools[tool.slug as keyof typeof t.tools];
      return {
        ...tool,
        title: entry?.title ?? tool.title,
        shortTitle: entry?.shortTitle ?? tool.shortTitle,
        description: entry?.description ?? tool.description,
        highlights: entry?.highlights ?? tool.highlights,
      };
    },
    [t]
  );

  const filteredTools = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return PDF_TOOLS.map(getLocalizedTool).filter((tool) => {
      const matchesCat = category === "todas" || tool.category === category;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.highlights.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [search, category, getLocalizedTool]);

  const handleSmartFile = (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp)$/i.test(name)
    ) {
      setPendingFile(file);
      router.push("/herramientas/pdf-imagenes");
      return;
    }
    setSmartDropFile(file);
  };

  const launchToolWithSmartFile = (slug: string) => {
    if (!smartDropFile) return;
    setPendingFile(smartDropFile);
    setSmartDropFile(null);
    router.push(`/herramientas/${slug}`);
  };

  const smartDropTools = React.useMemo(
    () => PDF_TOOLS.filter((tool) => tool.supportsPdfSmartDrop).map(getLocalizedTool),
    [getLocalizedTool]
  );

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOverPage(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDraggingOverPage(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingOverPage(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) handleSmartFile(dropped);
      }}
    >
      {/* Hero + Smart Drop */}
      <section className="relative overflow-hidden border-b border-border/70 bg-joapps-grid">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 max-w-3xl rounded-full bg-[#FACC15]/10 blur-3xl dark:bg-[#FACC15]/[0.08]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FACC15]/35 bg-[#FACC15]/10 px-3.5 py-1 text-xs font-semibold text-[#A16207] dark:text-[#FACC15]">
                <Sparkles className="h-3.5 w-3.5" />
                {t.hero.pill}
              </div>

              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-[1.1]">
                {t.hero.titleBefore}{" "}
                <span className="text-[#EAB308] dark:text-[#FACC15]">
                  {t.hero.titleAccent}
                </span>{" "}
                {t.hero.titleAfter}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.hero.subtitleBefore}{" "}
                <strong className="text-foreground">{t.hero.subtitleStrong}</strong>{" "}
                {t.hero.subtitleAfter}
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/80 px-3 py-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {t.hero.badgeLocal}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/80 px-3 py-1.5">
                  <Zap className="h-4 w-4 text-[#FACC15]" />
                  {t.hero.badgeNoWatermark}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/80 px-3 py-1.5">
                  <Lock className="h-4 w-4 text-[#FACC15]" />
                  {t.hero.badgeNoStorage}
                </span>
              </div>
            </div>

            {/* Smart Drop Box */}
            <div className="lg:col-span-5">
              <div
                onClick={() => smartInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    smartInputRef.current?.click();
                  }
                }}
                className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all duration-200 ${
                  draggingOverPage
                    ? "scale-[1.02] border-[#FACC15] bg-[#FACC15]/15 shadow-xl shadow-[#FACC15]/15"
                    : "border-[#FACC15]/45 bg-card/90 hover:border-[#FACC15] hover:bg-card hover:shadow-lg hover:shadow-[#FACC15]/10"
                }`}
              >
                <input
                  ref={smartInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    handleSmartFile(e.target.files?.[0]);
                    if (smartInputRef.current) smartInputRef.current.value = "";
                  }}
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FACC15] text-[#0A0A0A] shadow-md shadow-[#FACC15]/25 transition-transform duration-200 group-hover:scale-105">
                  <UploadCloud className="h-7 w-7" />
                </div>

                <span className="mt-3 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t.smartDrop.tag}
                </span>
                <h2 className="mt-2 text-base font-bold text-foreground sm:text-lg">
                  {t.smartDrop.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.smartDrop.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search + Category Tabs + Tool Grid */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Category Pills */}
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label={t.toolsSection.categoriesAria}
          >
            {TOOL_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? "bg-[#FACC15] text-[#0A0A0A] shadow-sm shadow-[#FACC15]/20"
                      : "border border-border bg-card text-muted-foreground hover:border-[#FACC15]/50 hover:text-foreground"
                  }`}
                >
                  {t.categories[cat.id]}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.toolsSection.searchPlaceholder}
              className="pl-10 pr-9"
              aria-label={t.toolsSection.searchAria}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t.toolsSection.clearSearchAria}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {filteredTools.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-base font-semibold text-foreground">
              {t.toolsSection.emptyTitle} &ldquo;{search}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("todas");
              }}
              className="mt-3 text-sm font-semibold text-[#EAB308] underline-offset-4 hover:underline dark:text-[#FACC15]"
            >
              {t.toolsSection.emptyReset}
            </button>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.slug}
                tool={tool}
                localLabel={t.toolsSection.badgeLocal}
                openLabel={t.toolsSection.openAction}
              />
            ))}
          </div>
        )}
      </section>

      {/* Smart Drop Modal */}
      {smartDropFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-drop-title"
          onClick={() => setSmartDropFile(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FACC15]/15 text-[#EAB308] dark:text-[#FACC15]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="smart-drop-title" className="text-lg font-extrabold text-foreground">
                    {t.smartDrop.modalTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {smartDropFile.name}
                    </span>{" "}
                    • {formatBytes(smartDropFile.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmartDropFile(null)}
                aria-label={t.smartDrop.closeAria}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {smartDropTools.map((tool) => (
                <button
                  key={tool.slug}
                  type="button"
                  onClick={() => launchToolWithSmartFile(tool.slug)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3.5 text-left transition-all hover:border-[#FACC15] hover:bg-[#FACC15]/[0.06]"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      tool.icon === "pdf-excel"
                        ? "bg-[#217346]/15 text-[#217346] group-hover:bg-[#217346] group-hover:text-white dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-[#FACC15]/12 text-[#CA8A04] group-hover:bg-[#FACC15] group-hover:text-[#0A0A0A] dark:text-[#FACC15]"
                    }`}
                  >
                    <ToolIcon name={tool.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {tool.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#FACC15]" />
                    </div>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {t.smartDrop.localTag}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  localLabel,
  openLabel,
}: {
  tool: PdfToolMeta;
  localLabel: string;
  openLabel: string;
}) {
  return (
    <Link
      href={`/herramientas/${tool.slug}`}
      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FACC15]/70 hover:shadow-xl hover:shadow-[#FACC15]/[0.07]"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 transition-all duration-200 ${
              tool.icon === "pdf-excel"
                ? "bg-[#217346]/15 text-[#217346] ring-[#217346]/30 group-hover:bg-[#217346] group-hover:text-white dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30"
                : "bg-[#FACC15]/12 text-[#CA8A04] ring-[#FACC15]/25 group-hover:bg-[#FACC15] group-hover:text-[#0A0A0A] dark:text-[#FACC15]"
            }`}
          >
            <ToolIcon name={tool.icon} className="h-6 w-6" />
          </div>

          <Badge variant="local" className="text-[11px]">
            <ShieldCheck className="h-3 w-3" />
            {localLabel}
          </Badge>
        </div>

        <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-[#CA8A04] dark:group-hover:text-[#FACC15]">
          {tool.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {tool.description}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3.5">
        <div className="flex flex-wrap gap-1.5">
          {tool.highlights.slice(0, 2).map((h) => (
            <span
              key={h}
              className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {h}
            </span>
          ))}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#CA8A04] dark:text-[#FACC15]">
          {openLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
