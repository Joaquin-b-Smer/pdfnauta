import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar, BetaNoticeBanner } from "@/components/navbar";
import { Footer } from "@/components/footer";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@600;700&family=Great+Vibes&family=Caveat:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-sans: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
            --font-display: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
            --font-jakarta-sans: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
            --font-inter: "Inter", "Plus Jakarta Sans", system-ui, sans-serif;
            --font-dancing-script: "Dancing Script", cursive;
            --font-great-vibes: "Great Vibes", cursive;
            --font-caveat: "Caveat", cursive;
          }
          body {
            font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif !important;
          }
        `}</style>
      </head>
      <body className="min-h-screen font-sans">
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
