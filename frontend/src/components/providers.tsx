"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { PendingFileProvider } from "@/context/pending-file-context";
import { LanguageProvider } from "@/context/language-context";
import { PwaRegister } from "@/components/pwa-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <LanguageProvider>
        <PwaRegister />
        <PendingFileProvider>{children}</PendingFileProvider>
      </LanguageProvider>
    </NextThemesProvider>
  );
}
