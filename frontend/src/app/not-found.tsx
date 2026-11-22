import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FACC15]/15 text-[#FACC15]">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-3xl font-extrabold text-foreground">
        Herramienta no encontrada
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La ruta que buscas no existe en PDFNauta by JoApps.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#0A0A0A] hover:bg-[#EAB308]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
