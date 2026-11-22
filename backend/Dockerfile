FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_THREAD_LIMIT=1 \
    MALLOC_ARENA_MAX=2 \
    PORT=8000

# System dependencies for LibreOffice (Word->PDF), Ghostscript (Compress),
# Tesseract OCR (Spanish + English), and PyMuPDF / pdf2docx
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-common \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

EXPOSE 8000

# Single worker optimizes memory usage for Render Free Tier (512 MB RAM)
# and guarantees global single-file concurrency via asyncio.Semaphore(1)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 120"]
