"use client";

import * as React from "react";
import { useLanguage, type Language } from "@/context/language-context";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  className?: string;
}

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t.navbar.languageAria}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-black/[0.08] bg-black/[0.05] p-0.5 font-sans backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.06]",
        className
      )}
    >
      {LANGUAGES.map((item) => {
        const active = language === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLanguage(item.code)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-2.5 py-1 text-[13px] leading-none tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]",
              active
                ? "bg-[#FDE68A] font-bold text-[#0A0A0A] shadow-sm"
                : "bg-transparent font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
