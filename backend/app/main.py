from __future__ import annotations

import asyncio
import gc
import logging
import shutil
import tempfile
from pathlib import Path
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.services.converters import (
    compress_pdf,
    convert_pdf_to_word,
    convert_word_to_pdf,
    detect_available_engines,
    sanitize_stem,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pdfnauta.api")

MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
CHUNK_SIZE = 512 * 1024  # 512 KB streaming chunks for low RAM usage

# Render Free Tier (512 MB RAM): process strictly one heavy document job at a time
PROCESSING_SEMAPHORE = asyncio.Semaphore(1)

app = FastAPI(
    title="PDFNauta by JoApps — API",
    description=(
        "Motor de conversión y compresión PDF de alta precisión para PDFNauta by JoApps. "
        "Optimizado para Render Free Tier (512 MB RAM, límite 20 MB, cero almacenamiento permanente)."
    ),
    version="1.0.0-beta",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-Original-Size",
        "X-Compressed-Size",
        "X-Savings-Percent",
        "X-Conversion-Engine",
        "X-OCR-Used",
    ],
)


def cleanup_temp_dir(path: Path) -> None:
    """Delete temporary job files immediately after sending response."""
    try:
        shutil.rmtree(path, ignore_errors=True)
    finally:
        gc.collect()


async def save_upload_checked(
    upload: UploadFile,
    dest_dir: Path,
    allowed_extensions: tuple[str, ...],
    require_pdf_header: bool = False,
) -> tuple[Path, str]:
    """Stream upload to disk while enforcing the 20 MB ceiling and file type."""
    original_name = upload.filename or "documento"
    ext = Path(original_name).suffix.lower()
    if ext not in allowed_extensions:
        expected = ", ".join(allowed_extensions)
        raise HTTPException(
            status_code=400,
            detail=f"Formato no compatible ({ext or 'sin extensión'}). Se esperaba: {expected}.",
        )

    stem = sanitize_stem(original_name)
    input_path = dest_dir / f"input{ext}"
    total_bytes = 0
    first_chunk_checked = False

    try:
        with open(input_path, "wb") as out_file:
            while True:
                chunk = await upload.read(CHUNK_SIZE)
                if not chunk:
                    break
                if not first_chunk_checked:
                    first_chunk_checked = True
                    if require_pdf_header and not chunk.lstrip().startswith(b"%PDF"):
                        raise HTTPException(
                            status_code=400,
                            detail="El archivo subido no parece ser un documento PDF válido.",
                        )
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"El archivo supera el límite máximo de {MAX_FILE_SIZE_MB} MB "
                            "de la versión gratuita de prueba. Intenta comprimirlo o dividirlo primero."
                        ),
                    )
                out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error leyendo el archivo subido")
        raise HTTPException(
            status_code=500, detail=f"No se pudo leer el archivo subido: {exc}"
        ) from exc
    finally:
        await upload.close()

    if total_bytes == 0:
        raise HTTPException(
            status_code=400, detail="El archivo está vacío. Selecciona un documento válido."
        )

    return input_path, stem


def build_content_disposition(filename: str) -> str:
    """RFC 5987 safe Content-Disposition header supporting Spanish accents."""
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "resultado"
    quoted = quote(filename)
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quoted}"


@app.get("/")
async def root():
    return {
        "name": "PDFNauta by JoApps API",
        "version": "1.0.0-beta",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "PDFNauta by JoApps",
        "max_file_size_mb": MAX_FILE_SIZE_MB,
        "engines": detect_available_engines(),
    }


@app.post("/api/pdf-to-word")
async def api_pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    use_ocr: bool = Form(False),
):
    tmp_dir = Path(tempfile.mkdtemp(prefix="pdfnauta_p2w_"))
    try:
        input_path, stem = await save_upload_checked(
            file, tmp_dir, allowed_extensions=(".pdf",), require_pdf_header=True
        )
        async with PROCESSING_SEMAPHORE:
            output_path, engine = await asyncio.to_thread(
                convert_pdf_to_word, input_path, tmp_dir, stem, use_ocr
            )
    except HTTPException:
        cleanup_temp_dir(tmp_dir)
        raise
    except Exception as exc:
        cleanup_temp_dir(tmp_dir)
        logger.exception("Error en PDF a Word")
        raise HTTPException(
            status_code=500,
            detail=f"No pudimos convertir el PDF a Word. Verifica que el archivo no esté protegido con contraseña. ({exc})",
        ) from exc

    background_tasks.add_task(cleanup_temp_dir, tmp_dir)
    download_name = f"{stem}.docx"
    return FileResponse(
        path=str(output_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": build_content_disposition(download_name),
            "X-Conversion-Engine": engine,
            "X-OCR-Used": "true" if use_ocr else "false",
        },
    )


@app.post("/api/word-to-pdf")
async def api_word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    tmp_dir = Path(tempfile.mkdtemp(prefix="pdfnauta_w2p_"))
    try:
        input_path, stem = await save_upload_checked(
            file, tmp_dir, allowed_extensions=(".doc", ".docx"), require_pdf_header=False
        )
        async with PROCESSING_SEMAPHORE:
            output_path, engine = await asyncio.to_thread(
                convert_word_to_pdf, input_path, tmp_dir, stem
            )
    except HTTPException:
        cleanup_temp_dir(tmp_dir)
        raise
    except RuntimeError as exc:
        cleanup_temp_dir(tmp_dir)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        cleanup_temp_dir(tmp_dir)
        logger.exception("Error en Word a PDF")
        raise HTTPException(
            status_code=500,
            detail=f"No pudimos convertir el documento Word a PDF: {exc}",
        ) from exc

    background_tasks.add_task(cleanup_temp_dir, tmp_dir)
    download_name = f"{stem}.pdf"
    return FileResponse(
        path=str(output_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": build_content_disposition(download_name),
            "X-Conversion-Engine": engine,
        },
    )


@app.post("/api/compress-pdf")
async def api_compress_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    level: str = Form("recommended"),
):
    tmp_dir = Path(tempfile.mkdtemp(prefix="pdfnauta_cmp_"))
    try:
        input_path, stem = await save_upload_checked(
            file, tmp_dir, allowed_extensions=(".pdf",), require_pdf_header=True
        )
        async with PROCESSING_SEMAPHORE:
            output_path, original_size, final_size, engine = await asyncio.to_thread(
                compress_pdf, input_path, tmp_dir, stem, level
            )
    except HTTPException:
        cleanup_temp_dir(tmp_dir)
        raise
    except Exception as exc:
        cleanup_temp_dir(tmp_dir)
        logger.exception("Error en Comprimir PDF")
        raise HTTPException(
            status_code=500,
            detail=f"No pudimos comprimir el PDF. Verifica que no esté corrupto o bloqueado. ({exc})",
        ) from exc

    savings_pct = (
        max(0.0, round(((original_size - final_size) / original_size) * 100, 1))
        if original_size > 0
        else 0.0
    )
    background_tasks.add_task(cleanup_temp_dir, tmp_dir)
    download_name = f"{stem}_comprimido.pdf"
    return FileResponse(
        path=str(output_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": build_content_disposition(download_name),
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(final_size),
            "X-Savings-Percent": str(savings_pct),
            "X-Conversion-Engine": engine,
        },
    )


class FeedbackPayload(BaseModel):
    category: str = Field(default="suggestion", max_length=40)
    message: str = Field(..., min_length=3, max_length=2000)
    email: str | None = Field(default=None, max_length=120)
    tool: str | None = Field(default=None, max_length=80)


@app.post("/api/feedback")
async def api_feedback(payload: FeedbackPayload):
    logger.info(
        "Feedback recibido [%s] tool=%s email=%s: %s",
        payload.category,
        payload.tool or "general",
        payload.email or "anon",
        payload.message.replace("\n", " ")[:300],
    )
    return JSONResponse(
        status_code=200,
        content={
            "status": "received",
            "message": "¡Gracias por ayudar a mejorar PDFNauta by JoApps!",
        },
    )
