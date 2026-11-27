import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar, BetaNoticeBanner } from "@/components/navbar";
import { Footer } from "@/components/footer";

const jakarta = { variable: "" };
const inter = { variable: "" };
const dancing = { variable: "" };
const vibes = { variable: "" };
const caveat = { variable: "" };

export const metadata: Metadata = {
  title: "PDFNauta by JoApps — Suite PDF Rápida, Privada y Gratuita",
  description:
    "Une, separa, organiza, firma, protege, comprime y convierte archivos PDF a Word o imágenes. Procesamiento 100% local en tu navegador y motor Python de alta precisión sin registro ni marcas de agua.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${inter.variable} ${dancing.variable} ${vibes.variable} ${caveat.variable} min-h-screen font-sans`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <BetaNoticeBanner />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
