import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar, BetaNoticeBanner } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "PDFNauta by JoApps — Suite PDF 100% Local, Rápida y Gratuita",
  description:
    "Convierte PDF a Word con OCR, extrae tablas a Excel, comprime, une, separa, organiza, firma y protege PDFs 100% en tu navegador y celular sin subir archivos a ningún servidor.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PDFNauta",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#FACC15" },
  ],
  width: "device-width",
  initialScale: 1,
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
