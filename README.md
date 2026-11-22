# PDFNauta by JoApps

Suite web moderna, rápida y privada para gestionar y convertir documentos PDF, diseñada con arquitectura dividida lista para desplegarse gratis en **Netlify (Frontend)** y **Render (Backend)**.

## Arquitectura del Monorepo

- `/frontend` — **Next.js 15 (App Router) + TypeScript + Tailwind CSS**
  - **7 herramientas 100% locales en el navegador** (`@cantoo/pdf-lib`, `pdfjs-dist`, `jszip`, `@dnd-kit`):
    1. **Unir PDF** (miniaturas + drag-and-drop)
    2. **Separar PDF** (rangos como `1-3, 5, 8-10` o `.zip` individual)
    3. **Organizar y Editar Páginas** (rotar 90° izq/der, duplicar, eliminar, reordenar)
    4. **PDF a JPG / PNG y viceversa** (exportación en `.zip` o unión de JPG/PNG/WebP con márgenes y orientación)
    5. **Firmar PDF** (dibujar, escribir con tipografía caligráfica o subir PNG transparente, arrastrar y redimensionar)
    6. **Marca de Agua y Numeración** (`Página X de Y`, opacidad, color, tamaño, rotación y posición con vista previa)
    7. **Proteger y Desbloquear PDF** (cifrado y descifrado 100% en el navegador)
  - **Smart Drop** en la portada: suelta un PDF y elige la acción al instante.
  - **Diseño JoApps**: Modo oscuro por defecto (`#0A0A0A`, `#18181B`, acento amarillo `#FACC15`) + selector de tema claro/oscuro, aviso de Versión Gratuita de Prueba (Beta) y modal de comentarios.

- `/backend` — **Python FastAPI + Docker** (optimizado para Render Free Tier 512 MB RAM)
  - **3 endpoints de alta precisión**:
    8. `POST /api/pdf-to-word` (`pdf2docx` + opción OCR con `PyMuPDF` + `Tesseract` en español/inglés)
    9. `POST /api/word-to-pdf` (`LibreOffice Writer` headless para `.doc` y `.docx`)
    10. `POST /api/compress-pdf` (`Ghostscript` / `PyMuPDF` con 3 niveles: Extrema, Recomendada, Baja)
  - `GET /health` -> `{"status": "ok", ...}`
  - Concurrencia controlada con `asyncio.Semaphore(1)`, límite de **20 MB** por archivo y borrado inmediato mediante `BackgroundTasks`.

---

## Desarrollo Local

### 1. Backend (puerto 8000)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (puerto 3000)
```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:3000` en tu navegador. El frontend usa `NEXT_PUBLIC_API_URL` con fallback automático a `http://localhost:8000`.

---

## Despliegue Gratuito

### Backend en Render (Free Tier)
1. Conecta el repositorio en Render usando el archivo `render.yaml` incluido (o crea un **Web Service** con runtime **Docker**, Root Directory `backend`, Health Check Path `/health`).
2. Copia la URL pública generada (ej. `https://pdfnauta-backend.onrender.com`).

### Frontend en Netlify
1. Conecta el repositorio en Netlify configurando **Base directory**: `frontend`.
2. Define la variable de entorno:
   - `NEXT_PUBLIC_API_URL=https://pdfnauta-backend.onrender.com`
3. Netlify detectará automáticamente `frontend/netlify.toml` y `@netlify/plugin-nextjs`.
