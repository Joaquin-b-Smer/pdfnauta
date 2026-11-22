"use client";

import * as React from "react";
import {
  ShieldCheck,
  MessageSquarePlus,
  X,
  CheckCircle2,
  Send,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/card";
import { sendFeedbackToBackend } from "@/lib/api";
import { PDF_TOOLS } from "@/lib/tools";

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

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Cuéntanos brevemente qué ocurrió o qué te gustaría mejorar.");
      return;
    }
    setError(null);
    setSending(true);
    await sendFeedbackToBackend({
      category,
      tool,
      email: email.trim() || undefined,
      message: message.trim(),
    });
    setSending(false);
    setSent(true);
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
            <h3 className="mt-3 text-base font-bold">¡Gracias por tu aporte!</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Registramos tu mensaje para el equipo de JoApps. Seguimos mejorando cada
              herramienta.
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
                  onChange={(e) => setTool(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]"
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe el problema, navegador utilizado o tu idea de mejora..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]"
              />
            </div>

            {error && <p className="text-xs font-medium text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={sending}>
                <Send className="h-4 w-4" />
                {sending ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
