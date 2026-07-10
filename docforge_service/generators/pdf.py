"""
DocForge PDF Generator — pdf.py
Uses ReportLab Platypus + Canvas API.

Architecture:
  - Cover page → drawn with Canvas API (full creative control)
  - Body → Platypus "story" list of flowables (auto-pagination)
  - Header/footer → onLaterPages callback (runs on every body page)
  - All styling → imported from base.py design system
"""

from io import BytesIO
from functools import partial
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.units import mm
from reportlab.lib import colors
import datetime

from generators.base import (
    get_theme, build_styles,
    chapter_banner, section_box, info_table, styled_table, hr_line, sp,
    html_to_story,
    draw_cover_page, draw_page_header_footer,
)


# ══════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════

def generate_pdf(data: dict) -> bytes:
    """
    Generate a professional PDF from the document data.
    Returns raw PDF bytes to stream back to the browser.
    """
    buffer = BytesIO()
    theme  = get_theme(data.get("theme", "blue"))
    page_size = LETTER if data.get("page_size") == "LETTER" else A4
    W, H = page_size
    margin = 22 * mm

    styles = build_styles(
        theme,
        font_size=data.get("font_size", 11),
        line_spacing=data.get("line_spacing", 1.6),
    )

    # ── Document template ───────────────────────────────────────
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title=data.get("title", "Document"),
        author=data.get("author", ""),
        subject=data.get("subject", ""),
    )

    # ── Page callbacks ──────────────────────────────────────────
    cover_fn = partial(draw_cover_page, data=data, theme=theme, page_size=page_size)
    later_fn = partial(draw_page_header_footer, data=data, theme=theme, page_size=page_size)

    # ── Build story ─────────────────────────────────────────────
    story = []

    # Cover page (if requested)
    if data.get("show_cover", True):
        story.append(PageBreak())   # cover is drawn by onFirstPage; break to body

    # Metadata info block at top of body
    story += _build_meta_block(data, theme, styles, W)

    # Main content from HTML
    html = data.get("html_content", "")
    if html and html.strip() not in ("", "<p></p>", "<p><br></p>"):
        story += html_to_story(html, styles, theme, W)
    else:
        story.append(Paragraph(
            "Start writing your document in DocForge to see content here.",
            styles["body"]
        ))

    # ── Compile ─────────────────────────────────────────────────
    if data.get("show_cover", True):
        doc.build(story, onFirstPage=cover_fn, onLaterPages=later_fn)
    else:
        doc.build(story, onFirstPage=later_fn, onLaterPages=later_fn)

    return buffer.getvalue()


# ══════════════════════════════════════════════════════════════
#  METADATA BLOCK — top of body content
# ══════════════════════════════════════════════════════════════

def _build_meta_block(data: dict, theme: dict, styles: dict, page_width: float) -> list:
    """
    Build a styled info table at the top of the document body.
    Shows author, subject, institution, date — only non-empty fields.
    """
    rows = []
    if data.get("author"):      rows.append(("Author",      data["author"]))
    if data.get("subject"):     rows.append(("Subject",     data["subject"]))
    if data.get("institution"): rows.append(("Institution", data["institution"]))

    date = data.get("date") or datetime.date.today().strftime("%B %d, %Y")
    rows.append(("Date", date))

    doc_type = {
        "assignment":    "Assignment",
        "report":        "Academic Report",
        "cover_letter":  "Cover Letter",
        "resume":        "Curriculum Vitae",
        "lab_report":    "Laboratory Report",
        "meeting_notes": "Meeting Minutes",
        "blank":         "Document",
    }.get(data.get("type", "blank"), "Document")
    rows.append(("Document Type", doc_type))

    elements = []
    if rows:
        elements.append(sp(8))
        elements.append(info_table(rows, theme, styles, page_width))
        elements.append(sp(16))
    return elements
