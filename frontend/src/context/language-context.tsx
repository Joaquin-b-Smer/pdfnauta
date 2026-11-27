"use client";

import * as React from "react";
import es from "@/locales/es.json";
import en from "@/locales/en.json";

export type Language = "es" | "en";
export type Translations = typeof es;

const STORAGE_KEY = "pdfnauta-lang";

const DICTIONARIES: Record<Language, Translations> = {
  es,
  en,
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("es");

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "es" || saved === "en") {
        setLanguageState(saved);
        document.documentElement.lang = saved;
      } else {
        document.documentElement.lang = "es";
      }
    } catch {
      document.documentElement.lang = "es";
    }
  }, []);

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (e.g. restricted private mode)
    }
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: DICTIONARIES[language],
    }),
    [language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
