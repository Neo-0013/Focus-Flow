"""
DocForge Python Service — FastAPI Entry Point
Runs on port 3001, handles document generation for all formats.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import io
import traceback

from generators.pdf import generate_pdf
from generators.word import generate_word
from generators.excel import generate_excel

# ─────────────────────────── App Setup ──────────────────────────────
app = FastAPI(title="DocForge Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────── Request Models ──────────────────────────────
class DocRequest(BaseModel):
    type: str = "assignment"          # assignment | report | cover_letter | resume | lab_report | meeting_notes | blank
    title: str = "Untitled Document"
    author: str = ""
    subject: str = ""
    institution: str = ""
    date: str = ""
    theme: str = "blue"               # blue | purple | green | red | dark
    html_content: str = ""            # Raw TipTap HTML — parsed server-side
    font_family: str = "helvetica"    # helvetica | times | courier
    font_size: int = 11
    line_spacing: float = 1.6
    page_size: str = "A4"             # A4 | LETTER
    show_cover: bool = True
    show_header: bool = True
    show_footer: bool = True
    header_text: str = ""
    footer_text: str = ""
    metadata: Optional[Dict[str, Any]] = {}

# ─────────────────────────── Routes ──────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "DocForge Engine", "version": "1.0.0"}


@app.post("/generate/pdf")
async def gen_pdf(req: DocRequest):
    try:
        pdf_bytes = generate_pdf(req.dict())
        filename = _safe_filename(req.title) + ".pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/docx")
async def gen_docx(req: DocRequest):
    try:
        docx_bytes = generate_word(req.dict())
        filename = _safe_filename(req.title) + ".docx"
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/xlsx")
async def gen_xlsx(req: DocRequest):
    try:
        xlsx_bytes = generate_excel(req.dict())
        filename = _safe_filename(req.title) + ".xlsx"
        return StreamingResponse(
            io.BytesIO(xlsx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────── Helpers ──────────────────────────────
def _safe_filename(title: str) -> str:
    import re
    safe = re.sub(r'[^\w\s-]', '', title).strip()
    safe = re.sub(r'[\s]+', '_', safe)
    return safe[:60] or "document"
