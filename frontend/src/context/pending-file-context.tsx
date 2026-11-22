"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface PendingFileContextValue {
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
  consumePendingFile: () => File | null;
}

const PendingFileContext = createContext<PendingFileContextValue | undefined>(undefined);

export function PendingFileProvider({ children }: { children: React.ReactNode }) {
  const [pendingFile, setPendingFileState] = useState<File | null>(null);

  const setPendingFile = useCallback((file: File | null) => {
    setPendingFileState(file);
  }, []);

  const consumePendingFile = useCallback(() => {
    let fileToReturn: File | null = null;
    setPendingFileState((current) => {
      fileToReturn = current;
      return null;
    });
    return fileToReturn;
  }, []);

  return (
    <PendingFileContext.Provider
      value={{ pendingFile, setPendingFile, consumePendingFile }}
    >
      {children}
    </PendingFileContext.Provider>
  );
}

export function usePendingFile() {
  const ctx = useContext(PendingFileContext);
  if (!ctx) {
    throw new Error("usePendingFile must be used within PendingFileProvider");
  }
  return ctx;
}
