"use client";

import * as React from "react";
import {
  ShieldCheck,
  MessageSquarePlus,
  X,
  CheckCircle2,
  Send,
  Compass,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/card";
import { PDF_TOOLS } from "@/lib/tools";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const WEB3FORMS_ACCESS_KEY =
  process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ||
  "244bd39e-6ccc-4d45-9f07-0c55a2eb248a";
const FALLBACK_EMAIL = "jbs.microapps@gmail.com";

const CATEGORY_LABELS: Record<"bug" | "suggestion" | "other", string> = {
  bug: "Reportar error",
  suggestion: "Sugerencia",
  other: "Otro",
};

export function Footer() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <footer className="mt-20 border-t border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FACC15] text-[#0A0A0A]">
                  <Compass className="h-4 w-4 stroke-[2.4]" />
                </span>
                <span className="text-base font-extrabold tracking-tight">
                  PDF<span className="text-[#EAB308] dark:text-[#FACC15]">Nauta</span>{" "}
                  <span className="text-xs font-semibold text-muted-foreground">
                    by JoApps
                  </span>
                </span>
              </div>

              <div className="flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p>
                  <strong className="text-foreground">
                    Privacidad primero (cero almacenamiento permanente):
                  </strong>{" "}
                  las operaciones locales nunca salen de tu navegador. En las conversiones
                  de servidor, los archivos temporales se eliminan inmediatamente al
                  finalizar tu descarga.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(true)}
                className="border-[#FACC15]/40 hover:border-[#FACC15] hover:bg-[#FACC15]/10"
              >
                <MessageSquarePlus className="h-4 w-4 text-[#EAB308] dark:text-[#FACC15]" />
                Enviar comentarios o reportar error
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} <strong className="text-foreground">JoApps</strong>{" "}
              — PDFNauta (Versión Gratuita de Prueba Beta).
            </p>
            <p>Sin registro • Sin marcas de agua • Arquitectura segura</p>
          </div>
        </div>
      </footer>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = React.useState<"bug" | "suggestion" | "other">("bug");
  const [tool, setTool] = React.useState("general");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showMailtoFallback, setShowMailtoFallback] = React.useState(false);
  const autoCloseTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (autoCloseTimerRef.current !== null) {
        window.clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [onClose]);

  const tipoSeleccionado = CATEGORY_LABELS[category];
  const herramientaRelacionada =
    tool === "general"
      ? "General / Portada"
      : PDF_TOOLS.find((t) => t.slug === tool)?.title || tool;

  const fallbackMailtoHref = React.useMemo(() => {
    const subject = encodeURIComponent(
      `[PDFNauta] ${tipoSeleccionado} - ${herramientaRelacionada}`
    );
    const body = encodeURIComponent(message.trim());
    return `mailto:${FALLBACK_EMAIL}?subject=${subject}${body ? `&body=${body}` : ""}`;
  }, [tipoSeleccionado, herramientaRelacionada, message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    if (message.trim().length < 5) {
      setShowMailtoFallback(false);
      setError("Cuéntanos brevemente qué ocurrió o qué te gustaría mejorar.");
      return;
    }

    setError(null);
    setShowMailtoFallback(false);
    setSending(true);

    const payload: Record<string, string> = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: `[PDFNauta] ${tipoSeleccionado} - ${herramientaRelacionada}`,
      from_name: "PDFNauta Feedback",
      tipo: tipoSeleccionado,
      herramienta: herramientaRelacionada,
      mensaje: message.trim(),
    };

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      payload.email = trimmedEmail;
    }

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setSent(true);
        setCategory("bug");
        setTool("general");
        setEmail("");
        setMessage("");
        autoCloseTimerRef.current = window.setTimeout(() => {
          onClose();
        }, 2800);
      } else {
        setShowMailtoFallback(true);
        setError(
          "No se pudo enviar tu mensaje en este momento. Intenta de nuevo o escríbenos directamente por correo."
        );
      }
    } catch {
      setShowMailtoFallback(true);
      setError(
        "No se pudo enviar el mensaje por un problema de conexión. Puedes intentarlo nuevamente o escribirnos por correo."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg animate-fade-up rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-modal-title" className="text-lg font-bold text-foreground">
              Comentarios o reporte de error
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ayúdanos a pulir PDFNauta by JoApps en esta versión Beta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-6 flex flex-col items-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold">
              ¡Mensaje enviado! Gracias por ayudar a mejorar PDFNauta
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Recibimos tus comentarios correctamente. Esta ventana se cerrará en unos
              segundos.
            </p>
            <Button type="button" onClick={onClose} className="mt-5">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "bug", label: "Reportar error" },
                { id: "suggestion", label: "Sugerencia" },
                { id: "other", label: "Otro" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={sending}
                  onClick={() => setCategory(item.id as "bug" | "suggestion" | "other")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    category === item.id
                      ? "border-[#FACC15] bg-[#FACC15]/15 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Herramienta relacionada
                </label>
                <select
                  value={tool}
                  disabled={sending}
                  onChange={(e) => setTool(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] disabled:opacity-50"
                >
                  <option value="general">General / Portada</option>
                  {PDF_TOOLS.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Email (opcional)
                </label>
                <Input
                  type="email"
                  disabled={sending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Mensaje *
              </label>
              <textarea
                rows={4}
                required
                disabled={sending}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe el problema, navegador utilizado o tu idea de mejora..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="space-y-1.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                <p className="font-medium">{error}</p>
                {showMailtoFallback && (
                  <a
                    href={fallbackMailtoHref}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#CA8A04] underline underline-offset-2 hover:text-[#EAB308] dark:text-[#FACC15]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {FALLBACK_EMAIL}
                  </a>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" disabled={sending} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
