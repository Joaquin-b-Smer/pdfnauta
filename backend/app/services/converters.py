from __future__ import annotations

import gc
import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Tuple

logger = logging.getLogger("pdfnauta.converters")


def sanitize_stem(filename: str, fallback: str = "documento") -> str:
    """Create a safe base filename without directory traversal or unsafe chars."""
    stem = Path(filename or fallback).stem
    stem = re.sub(r"[^\w\-. ]+", "_", stem, flags=re.UNICODE).strip(" .")
    return (stem or fallback)[:80]


def find_libreoffice() -> str | None:
    """Locate LibreOffice binary across Linux (Docker/Render) and Windows."""
    for candidate in ("soffice", "libreoffice"):
        found = shutil.which(candidate)
        if found:
            return found
    win_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for path in win_paths:
        if os.path.isfile(path):
            return path
    return None


def find_ghostscript() -> str | None:
    """Locate Ghostscript binary across Linux and Windows."""
    for candidate in ("gs", "gswin64c", "gswin32c"):
        found = shutil.which(candidate)
        if found:
            return found
    return None


def find_tesseract() -> str | None:
    """Locate Tesseract OCR binary across Linux and Windows."""
    found = shutil.which("tesseract")
    if found:
        return found
    win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.isfile(win_path):
        return win_path
    return None


def detect_available_engines() -> dict[str, bool]:
    """Report which system and Python engines are available."""
    engines: dict[str, bool] = {
        "libreoffice": find_libreoffice() is not None,
        "ghostscript": find_ghostscript() is not None,
        "tesseract": find_tesseract() is not None,
    }
    for mod_name, key in (
        ("fitz", "pymupdf"),
        ("pdf2docx", "pdf2docx"),
        ("docx", "python_docx"),
        ("pypdf", "pypdf"),
        ("reportlab", "reportlab"),
    ):
        try:
            __import__(mod_name)
            engines[key] = True
        except Exception:
            engines[key] = False
    return engines


def _pdf_to_word_with_ocr(pdf_path: Path, docx_path: Path) -> Tuple[Path, str]:
    """Convert scanned PDF to DOCX using PyMuPDF rendering + Tesseract OCR."""
    import docx  # type: ignore
    import fitz  # type: ignore
    from PIL import Image

    tesseract_bin = find_tesseract()
    use_tesseract = False
    pytesseract = None
    if tesseract_bin:
        try:
            import pytesseract as _pytesseract  # type: ignore

            _pytesseract.pytesseract.tesseract_cmd = tesseract_bin
            pytesseract = _pytesseract
            use_tesseract = True
        except Exception as exc:
            logger.warning("pytesseract unavailable: %s", exc)

    doc_out = docx.Document()
    pdf_doc = fitz.open(str(pdf_path))
    try:
        # Check installed tesseract languages
        ocr_lang = "spa+eng"
        if use_tesseract and pytesseract is not None:
            try:
                langs = pytesseract.get_languages(config="")
                if "spa" in langs and "eng" in langs:
                    ocr_lang = "spa+eng"
                elif "spa" in langs:
                    ocr_lang = "spa"
                elif "eng" in langs:
                    ocr_lang = "eng"
            except Exception:
                ocr_lang = "eng"

        for idx, page in enumerate(pdf_doc):
            if idx > 0:
                doc_out.add_page_break()

            extracted_text = ""
            if use_tesseract and pytesseract is not None:
                # 180 DPI balances OCR accuracy with Render 512 MB RAM ceiling
                mat = fitz.Matrix(180 / 72, 180 / 72)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                try:
                    extracted_text = pytesseract.image_to_string(img, lang=ocr_lang)
                finally:
                    img.close()
                    del pix
            else:
                extracted_text = page.get_text("text") or ""

            cleaned_lines = [line.rstrip() for line in extracted_text.splitlines()]
            paragraph_buffer: list[str] = []
            for line in cleaned_lines:
                if line.strip():
                    paragraph_buffer.append(line.strip())
                elif paragraph_buffer:
                    doc_out.add_paragraph(" ".join(paragraph_buffer))
                    paragraph_buffer.clear()
            if paragraph_buffer:
                doc_out.add_paragraph(" ".join(paragraph_buffer))
            elif not any(l.strip() for l in cleaned_lines):
                doc_out.add_paragraph("")
    finally:
        pdf_doc.close()
        gc.collect()

    doc_out.save(str(docx_path))
    engine = "tesseract-ocr" if use_tesseract else "pymupdf-text-fallback"
    return docx_path, engine


def _pdf_to_word_pymupdf_fallback(pdf_path: Path, docx_path: Path) -> Tuple[Path, str]:
    """Structured text/block fallback using PyMuPDF or pypdf + python-docx."""
    import docx  # type: ignore

    doc_out = docx.Document()
    try:
        import fitz  # type: ignore

        pdf_doc = fitz.open(str(pdf_path))
        try:
            for idx, page in enumerate(pdf_doc):
                if idx > 0:
                    doc_out.add_page_break()
                blocks = page.get_text("blocks")
                blocks.sort(key=lambda b: (round(b[1], 1), round(b[0], 1)))
                for b in blocks:
                    text = (b[4] or "").strip()
                    if text:
                        doc_out.add_paragraph(text)
        finally:
            pdf_doc.close()
        doc_out.save(str(docx_path))
        return docx_path, "pymupdf-fallback"
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        for idx, page in enumerate(reader.pages):
            if idx > 0:
                doc_out.add_page_break()
            text = (page.extract_text() or "").strip()
            for para in text.split("\n\n"):
                cleaned = " ".join(para.splitlines()).strip()
                if cleaned:
                    doc_out.add_paragraph(cleaned)
        doc_out.save(str(docx_path))
        return docx_path, "pypdf-fallback"


def convert_pdf_to_word(
    pdf_path: Path, output_dir: Path, stem: str, use_ocr: bool = False
) -> Tuple[Path, str]:
    """Convert a PDF file to DOCX preserving layout or using OCR."""
    docx_path = output_dir / f"{stem}.docx"

    if use_ocr:
        try:
            return _pdf_to_word_with_ocr(pdf_path, docx_path)
        except Exception as exc:
            logger.warning("OCR pipeline failed (%s), falling back to text extraction", exc)
            return _pdf_to_word_pymupdf_fallback(pdf_path, docx_path)

    # Primary high-fidelity engine: pdf2docx
    try:
        from pdf2docx import Converter  # type: ignore

        cv = Converter(str(pdf_path))
        try:
            cv.convert(str(docx_path), start=0, end=None)
        finally:
            cv.close()
            gc.collect()
        if docx_path.exists() and docx_path.stat().st_size > 0:
            return docx_path, "pdf2docx"
    except Exception as exc:
        logger.warning("pdf2docx failed or unavailable (%s), using fallback", exc)

    return _pdf_to_word_pymupdf_fallback(pdf_path, docx_path)


def _docx_to_pdf_reportlab_fallback(docx_path: Path, pdf_path: Path) -> Tuple[Path, str]:
    """Pure-Python fallback for local Windows dev when LibreOffice isn't installed."""
    import docx  # type: ignore
    from xml.sax.saxutils import escape
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    document = docx.Document(str(docx_path))
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "PDFNautaBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        spaceAfter=6,
    )
    h1_style = ParagraphStyle(
        "PDFNautaH1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        spaceBefore=10,
        spaceAfter=8,
    )
    h2_style = ParagraphStyle(
        "PDFNautaH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        spaceBefore=8,
        spaceAfter=6,
    )

    story = []
    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            story.append(Spacer(1, 6))
            continue
        style_name = (para.style.name if para.style else "").lower()
        safe_text = escape(text).replace("\n", "<br/>")
        if "heading 1" in style_name or "title" in style_name:
            story.append(Paragraph(safe_text, h1_style))
        elif "heading" in style_name:
            story.append(Paragraph(safe_text, h2_style))
        else:
            story.append(Paragraph(safe_text, body_style))

    for tbl in document.tables:
        rows_data = []
        for row in tbl.rows:
            rows_data.append(
                [Paragraph(escape(cell.text.strip()), body_style) for cell in row.cells]
            )
        if rows_data:
            t = Table(rows_data, repeatRows=1)
            t.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("PADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(Spacer(1, 6))
            story.append(t)
            story.append(Spacer(1, 10))

    if not story:
        story.append(Paragraph(" ", body_style))

    pdf_doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    pdf_doc.build(story)
    return pdf_path, "reportlab-fallback"


def convert_word_to_pdf(
    word_path: Path, output_dir: Path, stem: str
) -> Tuple[Path, str]:
    """Convert DOC/DOCX to PDF via LibreOffice headless (with local DOCX fallback)."""
    soffice = find_libreoffice()
    target_pdf = output_dir / f"{stem}.pdf"

    if soffice:
        lo_profile = output_dir / "lo_profile"
        lo_profile.mkdir(exist_ok=True)
        cmd = [
            soffice,
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--norestore",
            f"-env:UserInstallation={lo_profile.as_uri()}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(word_path),
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=85,
            check=False,
        )
        generated = output_dir / f"{word_path.stem}.pdf"
        if result.returncode == 0 and generated.exists() and generated.stat().st_size > 0:
            if generated != target_pdf:
                generated.rename(target_pdf)
            return target_pdf, "libreoffice"
        logger.warning(
            "LibreOffice conversion failed (code %s): %s",
            result.returncode,
            result.stderr or result.stdout,
        )

    if word_path.suffix.lower() == ".docx":
        return _docx_to_pdf_reportlab_fallback(word_path, target_pdf)

    raise RuntimeError(
        "La conversión de archivos .doc antiguos requiere LibreOffice Writer en el servidor."
    )


def _compress_with_ghostscript(
    input_pdf: Path, output_pdf: Path, level: str
) -> bool:
    """Compress PDF using Ghostscript preset."""
    gs_bin = find_ghostscript()
    if not gs_bin:
        return False

    preset_map = {
        "extreme": "/screen",
        "recommended": "/ebook",
        "low": "/printer",
    }
    dpi_map = {
        "extreme": "72",
        "recommended": "144",
        "low": "240",
    }
    preset = preset_map.get(level, "/ebook")
    dpi = dpi_map.get(level, "144")

    cmd = [
        gs_bin,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={preset}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        "-dColorImageDownsampleType=/Bicubic",
        f"-dColorImageResolution={dpi}",
        "-dGrayImageDownsampleType=/Bicubic",
        f"-dGrayImageResolution={dpi}",
        "-dMonoImageDownsampleType=/Subsample",
        f"-dMonoImageResolution={dpi}",
        f"-sOutputFile={output_pdf}",
        str(input_pdf),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=85, check=False)
    return res.returncode == 0 and output_pdf.exists() and output_pdf.stat().st_size > 0


def _compress_with_pymupdf(
    input_pdf: Path, output_pdf: Path, level: str
) -> bool:
    """Compress PDF using PyMuPDF image recompression + garbage collection."""
    try:
        import io
        import fitz  # type: ignore
        from PIL import Image
    except Exception:
        return False

    quality_map = {"extreme": 42, "recommended": 68, "low": 85}
    max_dim_map = {"extreme": 900, "recommended": 1400, "low": 2200}
    jpeg_quality = quality_map.get(level, 68)
    max_dim = max_dim_map.get(level, 1400)

    doc = fitz.open(str(input_pdf))
    try:
        seen_xrefs: set[int] = set()
        for page in doc:
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)
                try:
                    base = doc.extract_image(xref)
                    if not base or not base.get("image"):
                        continue
                    # Skip images with soft-mask transparency to preserve visual integrity
                    if base.get("smask", 0) != 0:
                        continue
                    raw = base["image"]
                    with Image.open(io.BytesIO(raw)) as pil_img:
                        if pil_img.mode not in ("RGB", "L"):
                            pil_img = pil_img.convert("RGB")
                        w, h = pil_img.size
                        scale = min(1.0, max_dim / max(w, h, 1))
                        if scale < 1.0:
                            pil_img = pil_img.resize(
                                (max(1, int(w * scale)), max(1, int(h * scale))),
                                Image.Resampling.LANCZOS,
                            )
                        buf = io.BytesIO()
                        pil_img.save(buf, format="JPEG", quality=jpeg_quality, optimize=True)
                        new_bytes = buf.getvalue()
                        if len(new_bytes) < len(raw):
                            page.replace_image(xref, stream=new_bytes)
                except Exception:
                    continue

        doc.save(
            str(output_pdf),
            garbage=4,
            deflate=True,
            clean=True,
            deflate_images=True,
            deflate_fonts=True,
        )
    finally:
        doc.close()
        gc.collect()

    return output_pdf.exists() and output_pdf.stat().st_size > 0


def _compress_with_pypdf(
    input_pdf: Path, output_pdf: Path, level: str
) -> bool:
    """Pure-Python stream & image compression using pypdf + Pillow."""
    from pypdf import PdfReader, PdfWriter

    quality_map = {"extreme": 40, "recommended": 65, "low": 82}
    jpeg_quality = quality_map.get(level, 65)

    reader = PdfReader(str(input_pdf))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    for page in writer.pages:
        try:
            page.compress_content_streams(level=9)
        except Exception:
            pass
        try:
            for img in page.images:
                try:
                    img.replace(img.image, quality=jpeg_quality)
                except Exception:
                    continue
        except Exception:
            pass

    if level == "extreme":
        writer.add_metadata({})
    try:
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    except Exception:
        pass

    with open(output_pdf, "wb") as fh:
        writer.write(fh)
    return output_pdf.exists() and output_pdf.stat().st_size > 0


def compress_pdf(
    input_pdf: Path, output_dir: Path, stem: str, level: str = "recommended"
) -> Tuple[Path, int, int, str]:
    """Compress PDF and return (output_path, original_size, final_size, engine)."""
    normalized_level = level.lower().strip()
    if normalized_level not in ("extreme", "recommended", "low"):
        normalized_level = "recommended"

    original_size = input_pdf.stat().st_size
    candidate_gs = output_dir / f"{stem}_gs.pdf"
    candidate_alt = output_dir / f"{stem}_alt.pdf"
    final_path = output_dir / f"{stem}_comprimido.pdf"

    best_path = input_pdf
    best_size = original_size
    best_engine = "original-already-optimal"

    # 1. Try Ghostscript (primary engine in Docker / Render)
    if _compress_with_ghostscript(input_pdf, candidate_gs, normalized_level):
        gs_size = candidate_gs.stat().st_size
        if gs_size < best_size:
            best_path = candidate_gs
            best_size = gs_size
            best_engine = "ghostscript"

    # 2. If Ghostscript unavailable or didn't shrink enough, try PyMuPDF / pypdf
    if best_engine != "ghostscript":
        if _compress_with_pymupdf(input_pdf, candidate_alt, normalized_level):
            alt_size = candidate_alt.stat().st_size
            if alt_size < best_size:
                best_path = candidate_alt
                best_size = alt_size
                best_engine = "pymupdf"
        elif _compress_with_pypdf(input_pdf, candidate_alt, normalized_level):
            alt_size = candidate_alt.stat().st_size
            if alt_size < best_size:
                best_path = candidate_alt
                best_size = alt_size
                best_engine = "pypdf"

    shutil.copy2(best_path, final_path)
    return final_path, original_size, best_size, best_engine
