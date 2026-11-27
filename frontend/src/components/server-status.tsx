"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import {
  ensureBackendWarmup,
  getBackendWarmupState,
  subscribeBackendWarmup,
  type BackendWarmupState,
  type OperationStage,
} from "@/lib/api";
import { useLanguage } from "@/context/language-context";

const INITIAL_SERVER_SNAPSHOT: BackendWarmupState = {
  status: "idle",
  lastReadyAt: null,
  errorMessage: null,
};

/**
 * Triggers a single lightweight GET /health warmup when mounting a server tool,
 * without background polling or repeated requests if the backend is already active.
 */
export function useBackendWarmup() {
  const state = React.useSyncExternalStore(
    subscribeBackendWarmup,
    getBackendWarmupState,
    () => INITIAL_SERVER_SNAPSHOT
  );

  React.useEffect(() => {
    void ensureBackendWarmup();
  }, []);

  const retry = React.useCallback(() => {
    void ensureBackendWarmup({ force: true });
  }, []);

  return { ...state, retry };
}

export function ServerWarmupStatus() {
  const { status, retry } = useBackendWarmup();
  const { t } = useLanguage();

  if (status === "ready") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {t.serverStatus.ready}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>{t.serverStatus.unverified}</span>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1 rounded-lg border border-current/25 px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-amber-500/15"
        >
          <RefreshCw className="h-3 w-3" />
          {t.serverStatus.retry}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/10 px-3 py-1.5 text-xs font-medium text-[#A16207] dark:text-[#FACC15]"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      {t.serverStatus.warming}
    </div>
  );
}

const ORDERED_STAGES: OperationStage[] = [
  "connecting",
  "processing",
  "downloading",
];

export function ServerOperationProgress({
  stage,
  slowStart,
}: {
  stage: OperationStage;
  slowStart: boolean;
}) {
  const { t } = useLanguage();
  const activeIndex = ORDERED_STAGES.indexOf(stage);
  const currentLabel = t.serverStatus.stages[stage];

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3.5 rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/[0.08] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#CA8A04] dark:text-[#FACC15]" />
          <span>{currentLabel}</span>
        </div>
      </div>

      {/* Indeterminate progress bar (no invented percentages) */}
      <div
        role="progressbar"
        aria-label={currentLabel}
        aria-busy="true"
        className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="animate-indeterminate-bar absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#FACC15]" />
      </div>

      {/* Clear 3-stage progression without fake percentages */}
      <ol className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-3">
        {ORDERED_STAGES.map((step, idx) => {
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          return (
            <li
              key={step}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
                isCurrent
                  ? "bg-[#FACC15]/15 font-semibold text-foreground"
                  : isCompleted
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    isCurrent
                      ? "animate-pulse bg-[#CA8A04] dark:bg-[#FACC15]"
                      : "bg-muted-foreground/40"
                  }`}
                />
              )}
              <span className="truncate">{t.serverStatus.stages[step]}</span>
            </li>
          );
        })}
      </ol>

      {slowStart && (
        <div className="flex items-start gap-2.5 border-t border-[#FACC15]/25 pt-3 text-xs leading-relaxed text-foreground/90">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-[#CA8A04] dark:text-[#FACC15]" />
          <p>{t.serverStatus.slowStartNote}</p>
        </div>
      )}
    </div>
  );
}
