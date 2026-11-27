# PDFNauta by JoApps

Suite web **100% client-side (PWA)** rápida, privada y gratuita para gestionar y convertir documentos PDF desde PC o celular, sin backend y lista para desplegar gratis para siempre en **Cloudflare Pages**.

## 10 Herramientas 100% en el Navegador

Tus archivos **nunca salen de tu dispositivo**: todo se procesa localmente usando `pdf.js`, `Tesseract.js`, `docx`, `SheetJS (xlsx)`, `@cantoo/pdf-lib` y `JSZip`.

1. **Unir PDF** — Miniaturas en tiempo real y reordenamiento libre.
2. **Separar PDF** — Extrae rangos específicos o divide páginas en `.zip`.
3. **Organizar y Editar Páginas** — Rota, duplica, elimina y reordena en cuadrícula.
4. **PDF a JPG / PNG y viceversa** — Exporta páginas a imágenes o une JPG/PNG/WebP en un PDF.
5. **Firmar PDF** — Dibuja, escribe o sube tu firma PNG y ubícala libremente.
6. **Marca de Agua y Numeración** — Texto personalizado, opacidad, rotación y `Página X de Y`.
7. **Proteger y Desbloquear PDF** — Cifrado y descifrado 100% local.
8. **PDF a Word (.docx)** — Detección automática de texto vs escaneo/foto, **OCR en español (`Tesseract.js`) a 200 DPI en escala de grises** procesado de a 1 página por vez, reconstrucción de títulos, listas y **tablas en Word**, barra de progreso real sin timeout.
9. **PDF to Excel (.xlsx)** — Extracción de tablas con vista previa de las primeras 10 filas y descarga en `.xlsx`.
10. **Comprimir PDF** — 3 niveles (*Extrema, Recomendada, Baja*) 100% en el navegador con ahorro visible.

---

## Desarrollo Local

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:3000`.

---

## Despliegue en Cloudflare Pages (Gratis para siempre)

1. En **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**, conecta este repositorio.
2. Configura:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Node version (variable de entorno opcional):** `NODE_VERSION=20`
3. Cloudflare Pages publicará el sitio estático completo (incluyendo PWA `manifest.json`, `sw.js`, `_headers` y todas las rutas pre-renderizadas en `out/`).
