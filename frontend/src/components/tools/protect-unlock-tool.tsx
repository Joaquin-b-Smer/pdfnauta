"use client";

import * as React from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Download,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/card";
import { usePendingFile } from "@/context/pending-file-context";
import { downloadBlob, formatBytes, stripExtension } from "@/lib/utils";

export function ProtectUnlockTool() {
  const { consumePendingFile } = usePendingFile();
  const [mode, setMode] = React.useState<"protect" | "unlock">("protect");
  const [file, setFile] = React.useState<File | null>(null);

  // Protect state
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [allowPrinting, setAllowPrinting] = React.useState(true);
  const [allowCopying, setAllowCopying] = React.useState(false);

  // Unlock state
  const [unlockPassword, setUnlockPassword] = React.useState("");
  const [showUnlockPass, setShowUnlockPass] = React.useState(false);

  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const pending = consumePendingFile();
    if (pending) setFile(pending);
  }, [consumePendingFile]);

  const passwordStrength = React.useMemo(() => {
    if (!password) return { label: "", color: "bg-secondary", pct: 0 };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: "Débil", color: "bg-red-500", pct: 25 };
    if (score === 2) return { label: "Media", color: "bg-amber-500", pct: 55 };
    if (score === 3) return { label: "Buena", color: "bg-[#FACC15]", pct: 80 };
    return { label: "Fuerte", color: "bg-emerald-500", pct: 100 };
  }, [password]);

  const handleProtect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (password.length < 4) {
      setError("Usa una contraseña de al menos 4 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      await pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: allowPrinting ? "highResolution" : false,
          modifying: false,
          copying: allowCopying,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false,
        },
      });

      const encryptedBytes = await pdfDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(encryptedBytes)], { type: "application/pdf" }),
        `${stripExtension(file.name)}_protegido.pdf`
      );
      setDoneMessage(
        "¡PDF protegido con contraseña! Se cifró localmente en tu navegador sin enviarse a ningún servidor."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `No pudimos cifrar este PDF: ${err.message}`
          : "Error al proteger el PDF. Si ya tiene contraseña, desbloquéalo primero."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setProcessing(true);
    setError(null);
    setDoneMessage(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, {
        password: unlockPassword || undefined,
      });

      // Copy pages to a brand-new unencrypted document to guarantee encryption dictionary removal
      const unlockedDoc = await PDFDocument.create();
      const copiedPages = await unlockedDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((p) => unlockedDoc.addPage(p));

      const outBytes = await unlockedDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: "application/pdf" }),
        `${stripExtension(file.name)}_desbloqueado.pdf`
      );
      setDoneMessage(
        "¡Contraseña eliminada! Se descargó una copia desbloqueada de tu PDF."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("password") || msg.includes("encrypt")) {
        setError(
          "La contraseña ingresada es incorrecta o el archivo requiere la contraseña actual para desbloquearse."
        );
      } else {
        setError(
          "No pudimos desbloquear este PDF. Verifica que la contraseña actual sea correcta."
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-2">
        <button
          type="button"
          onClick={() => {
            setMode("protect");
            setError(null);
            setDoneMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            mode === "protect"
              ? "bg-[#FACC15] text-[#0A0A0A] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" />
          Proteger con contraseña
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("unlock");
            setError(null);
            setDoneMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            mode === "unlock"
              ? "bg-[#FACC15] text-[#0A0A0A] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Unlock className="h-4 w-4" />
          Desbloquear PDF
        </button>
      </div>

      {!file ? (
        <FileDropzone
          accept=".pdf,application/pdf"
          onFilesSelected={(files) => {
            if (files[0]) {
              setFile(files[0]);
              setError(null);
              setDoneMessage(null);
            }
          }}
          title={
            mode === "protect"
              ? "Sube el PDF que deseas proteger con contraseña"
              : "Sube el PDF protegido del que deseas quitar la contraseña"
          }
          subtitle="Tus contraseñas y documentos nunca salen de tu dispositivo."
          helperText="Cifrado y descifrado 100% local en el navegador"
        />
      ) : (
        <Card className="mx-auto max-w-2xl space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-sm font-bold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setError(null);
                setDoneMessage(null);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Cambiar archivo
            </Button>
          </div>

          {mode === "protect" ? (
            <form onSubmit={handleProtect} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Nueva contraseña para abrir el PDF
                </label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full transition-all ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Seguridad: <strong className="text-foreground">{passwordStrength.label}</strong>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Confirmar contraseña
                </label>
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-background/60 p-4">
                <p className="text-xs font-bold text-foreground">Permisos del documento</p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    className="h-4 w-4 accent-[#FACC15]"
                  />
                  Permitir impresión del PDF
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowCopying}
                    onChange={(e) => setAllowCopying(e.target.checked)}
                    className="h-4 w-4 accent-[#FACC15]"
                  />
                  Permitir copiar texto e imágenes
                </label>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cifrando PDF...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Proteger y descargar PDF
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Contraseña actual del PDF
                </label>
                <div className="relative">
                  <Input
                    type={showUnlockPass ? "text" : "password"}
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Ingresa la contraseña del documento"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showUnlockPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Solo debes desbloquear archivos de los que seas propietario o tengas
                  autorización.
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Desbloqueando PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Desbloquear y descargar PDF
                  </>
                )}
              </Button>
            </form>
          )}

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {doneMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {doneMessage}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
