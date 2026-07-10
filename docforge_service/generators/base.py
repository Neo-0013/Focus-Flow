"""
DocForge Design System — base.py
Colour palettes, paragraph styles, helper functions,
cover page builder, and page header/footer templates.

Every generator imports from here — this is what makes everything
look consistent across all document types.
"""

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.units import mm, inch
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from bs4 import BeautifulSoup, NavigableString
import datetime

# ══════════════════════════════════════════════════════════════
#  COLOUR THEMES
# ══════════════════════════════════════════════════════════════

THEMES = {
    "blue": {
        "primary":    colors.HexColor("#1A237E"),   # deep navy — cover bg, banners
        "accent":     colors.HexColor("#1565C0"),   # bright blue — section boxes
        "banner":     colors.HexColor("#283593"),   # mid blue — chapter headers
        "light":      colors.HexColor("#E3F2FD"),   # pale blue — table row alt / info bg
        "text_dark":  colors.HexColor("#0D1F6B"),   # dark text in coloured areas
        "hr":         colors.HexColor("#90CAF9"),   # horizontal rules
        "cover_text": colors.white,
        "badge_bg":   colors.HexColor("#1976D2"),
    },
    "purple": {
        "primary":    colors.HexColor("#4A148C"),
        "accent":     colors.HexColor("#7B1FA2"),
        "banner":     colors.HexColor("#6A1B9A"),
        "light":      colors.HexColor("#F3E5F5"),
        "text_dark":  colors.HexColor("#3A0070"),
        "hr":         colors.HexColor("#CE93D8"),
        "cover_text": colors.white,
        "badge_bg":   colors.HexColor("#8E24AA"),
    },
    "green": {
        "primary":    colors.HexColor("#1B5E20"),
        "accent":     colors.HexColor("#2E7D32"),
        "banner":     colors.HexColor("#388E3C"),
        "light":      colors.HexColor("#E8F5E9"),
        "text_dark":  colors.HexColor("#1B5E20"),
        "hr":         colors.HexColor("#A5D6A7"),
        "cover_text": colors.white,
        "badge_bg":   colors.HexColor("#43A047"),
    },
    "red": {
        "primary":    colors.HexColor("#B71C1C"),
        "accent":     colors.HexColor("#C62828"),
        "banner":     colors.HexColor("#D32F2F"),
        "light":      colors.HexColor("#FFEBEE"),
        "text_dark":  colors.HexColor("#7F0000"),
        "hr":         colors.HexColor("#EF9A9A"),
        "cover_text": colors.white,
        "badge_bg":   colors.HexColor("#E53935"),
    },
    "dark": {
        "primary":    colors.HexColor("#1A1A2E"),
        "accent":     colors.HexColor("#16213E"),
        "banner":     colors.HexColor("#0F3460"),
        "light":      colors.HexColor("#E8EAF6"),
        "text_dark":  colors.HexColor("#0D0D0D"),
        "hr":         colors.HexColor("#90A4AE"),
        "cover_text": colors.white,
        "badge_bg":   colors.HexColor("#533483"),
    },
}

BODY_TEXT_COLOR = colors.HexColor("#1A1A1A")
MUTED_TEXT_COLOR = colors.HexColor("#555555")
PAGE_BG = colors.white


def get_theme(name: str) -> dict:
    return THEMES.get(name, THEMES["blue"])


# ══════════════════════════════════════════════════════════════
#  PARAGRAPH STYLES
# ══════════════════════════════════════════════════════════════

def build_styles(theme: dict, font_size: int = 11, line_spacing: float = 1.6) -> dict:
    """
    Build a complete set of paragraph styles for the document.
    Every text element uses one of these styles — no ad-hoc formatting.
    """
    leading = font_size * line_spacing

    s = {}

    # ── Title / Cover ──
    s["doc_title"] = ParagraphStyle(
        "doc_title",
        fontName="Helvetica-Bold",
        fontSize=32,
        leading=40,
        alignment=TA_CENTER,
        textColor=colors.white,
        spaceAfter=6,
    )
    s["doc_subtitle"] = ParagraphStyle(
        "doc_subtitle",
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#BBDEFB"),
        spaceAfter=4,
    )
    s["doc_meta"] = ParagraphStyle(
        "doc_meta",
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#E3F2FD"),
    )

    # ── Headings ──
    s["h1"] = ParagraphStyle(
        "h1",
        fontName="Helvetica-Bold",
        fontSize=font_size + 7,
        leading=(font_size + 7) * 1.3,
        textColor=theme["primary"],
        spaceBefore=14,
        spaceAfter=6,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        fontName="Helvetica-Bold",
        fontSize=font_size + 3,
        leading=(font_size + 3) * 1.3,
        textColor=theme["accent"],
        spaceBefore=12,
        spaceAfter=4,
    )
    s["h3"] = ParagraphStyle(
        "h3",
        fontName="Helvetica-BoldOblique",
        fontSize=font_size + 1,
        leading=(font_size + 1) * 1.3,
        textColor=theme["banner"],
        spaceBefore=10,
        spaceAfter=3,
    )

    # ── Body Text ──
    s["body"] = ParagraphStyle(
        "body",
        fontName="Helvetica",
        fontSize=font_size,
        leading=leading,
        alignment=TA_JUSTIFY,
        textColor=BODY_TEXT_COLOR,
        spaceAfter=6,
    )
    s["body_left"] = ParagraphStyle(
        "body_left",
        fontName="Helvetica",
        fontSize=font_size,
        leading=leading,
        alignment=TA_LEFT,
        textColor=BODY_TEXT_COLOR,
        spaceAfter=6,
    )

    # ── Bullet / Lists ──
    s["bullet"] = ParagraphStyle(
        "bullet",
        fontName="Helvetica",
        fontSize=font_size,
        leading=leading,
        leftIndent=18,
        firstLineIndent=0,
        textColor=BODY_TEXT_COLOR,
        spaceAfter=3,
        bulletIndent=6,
    )
    s["ordered"] = ParagraphStyle(
        "ordered",
        fontName="Helvetica",
        fontSize=font_size,
        leading=leading,
        leftIndent=22,
        firstLineIndent=0,
        textColor=BODY_TEXT_COLOR,
        spaceAfter=3,
    )

    # ── Table / Banner text ──
    s["banner_title"] = ParagraphStyle(
        "banner_title",
        fontName="Helvetica-Bold",
        fontSize=font_size + 2,
        leading=(font_size + 2) * 1.3,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    s["table_header"] = ParagraphStyle(
        "table_header",
        fontName="Helvetica-Bold",
        fontSize=font_size - 1,
        leading=(font_size - 1) * 1.3,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    s["table_cell"] = ParagraphStyle(
        "table_cell",
        fontName="Helvetica",
        fontSize=font_size - 1,
        leading=(font_size - 1) * 1.4,
        textColor=BODY_TEXT_COLOR,
        alignment=TA_LEFT,
    )
    s["table_cell_key"] = ParagraphStyle(
        "table_cell_key",
        fontName="Helvetica-Bold",
        fontSize=font_size - 1,
        leading=(font_size - 1) * 1.4,
        textColor=MUTED_TEXT_COLOR,
        alignment=TA_LEFT,
    )

    # ── Code / Monospace ──
    s["code"] = ParagraphStyle(
        "code",
        fontName="Courier",
        fontSize=font_size - 1,
        leading=(font_size - 1) * 1.5,
        textColor=colors.HexColor("#1A237E"),
        backColor=colors.HexColor("#F5F7FA"),
        leftIndent=10,
        rightIndent=10,
        spaceAfter=4,
    )

    # ── Quote ──
    s["blockquote"] = ParagraphStyle(
        "blockquote",
        fontName="Helvetica-Oblique",
        fontSize=font_size,
        leading=leading,
        leftIndent=20,
        textColor=MUTED_TEXT_COLOR,
        spaceAfter=6,
    )

    # ── Caption / Footer ──
    s["caption"] = ParagraphStyle(
        "caption",
        fontName="Helvetica-Oblique",
        fontSize=font_size - 2,
        leading=(font_size - 2) * 1.3,
        textColor=MUTED_TEXT_COLOR,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    s["page_footer"] = ParagraphStyle(
        "page_footer",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=MUTED_TEXT_COLOR,
        alignment=TA_CENTER,
    )

    return s


# ══════════════════════════════════════════════════════════════
#  FLOWABLE HELPERS
# ══════════════════════════════════════════════════════════════

def chapter_banner(title: str, theme: dict, styles: dict, page_width_pts: float) -> Table:
    """
    A full-width coloured banner — used for major chapter headings.
    Built as a single-cell Table (the ReportLab layout control trick).
    """
    usable_w = page_width_pts - 2 * 22 * mm   # subtract left+right margins
    p = Paragraph(f"  {title}", styles["banner_title"])
    t = Table([[p]], colWidths=[usable_w])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), theme["primary"]),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [theme["primary"]]),
        ("TOPPADDING",  (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def section_box(title: str, theme: dict, styles: dict, page_width_pts: float) -> Table:
    """
    A lighter-toned sub-section header box.
    """
    usable_w = page_width_pts - 2 * 22 * mm
    p = Paragraph(f"  {title}", ParagraphStyle(
        "sb_text",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=theme["accent"],
    ))
    t = Table([[p]], colWidths=[usable_w])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), theme["light"]),
        ("TOPPADDING",  (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("LINEBELOW",   (0, 0), (-1, -1), 1.5, theme["accent"]),
    ]))
    return t


def info_table(rows: list, theme: dict, styles: dict, page_width_pts: float) -> Table:
    """
    Key-value metadata table — used for assignment header info block.
    Rows format: [("Student Name", "John Doe"), ("Subject", "Physics"), ...]
    """
    usable_w = page_width_pts - 2 * 22 * mm
    col_key_w = usable_w * 0.30
    col_val_w = usable_w * 0.70

    table_data = [
        [
            Paragraph(k, styles["table_cell_key"]),
            Paragraph(str(v), styles["table_cell"])
        ]
        for k, v in rows
    ]
    t = Table(table_data, colWidths=[col_key_w, col_val_w])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, theme["light"]]),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("LINEBELOW",     (0, -1), (-1, -1), 1.5, theme["accent"]),
    ]))
    return t


def styled_table(headers: list, rows: list, theme: dict, styles: dict, page_width_pts: float) -> Table:
    """
    Full data table with coloured header row.
    """
    usable_w = page_width_pts - 2 * 22 * mm
    n_cols = max(len(headers), max((len(r) for r in rows), default=1))
    col_w = usable_w / n_cols

    header_row = [Paragraph(h, styles["table_header"]) for h in headers]
    body_rows  = [[Paragraph(str(c), styles["table_cell"]) for c in r] for r in rows]

    t = Table([header_row] + body_rows, colWidths=[col_w] * n_cols, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1,  0), theme["accent"]),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, theme["light"]]),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def hr_line(theme: dict, page_width_pts: float) -> HRFlowable:
    usable_w = page_width_pts - 2 * 22 * mm
    return HRFlowable(width=usable_w, thickness=1, color=theme["hr"], spaceAfter=6, spaceBefore=6)


def sp(height_pts: float) -> Spacer:
    return Spacer(1, height_pts)


# ══════════════════════════════════════════════════════════════
#  COVER PAGE — Canvas API Drawing
# ══════════════════════════════════════════════════════════════

def draw_cover_page(canvas, doc, data: dict, theme: dict, page_size):
    """
    Full cover page drawn with ReportLab Canvas API.
    Every element is hand-placed using A4/Letter coordinates.
    A4 = 595 x 842 points.
    """
    canvas.saveState()
    W, H = page_size

    # ── 1. Background ──────────────────────────────────────────
    canvas.setFillColor(theme["primary"])
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # ── 2. Top accent stripe ────────────────────────────────────
    canvas.setFillColor(theme["accent"])
    canvas.rect(0, H - 14 * mm, W, 14 * mm, fill=1, stroke=0)

    # ── 3. Bottom accent stripe ─────────────────────────────────
    canvas.setFillColor(theme["banner"])
    canvas.rect(0, 0, W, 28 * mm, fill=1, stroke=0)

    # ── 4. Decorative circle emblem ─────────────────────────────
    circle_x = W / 2
    circle_y = H * 0.76
    canvas.setFillColor(colors.HexColor("#FFFFFF20"))   # translucent white
    canvas.circle(circle_x, circle_y, 38 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#FFFFFF10"))
    canvas.circle(circle_x, circle_y, 30 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.circle(circle_x, circle_y, 20 * mm, fill=1, stroke=0)

    # ── 5. Institution initials in circle ───────────────────────
    inst = data.get("institution", "")
    initials = "".join(w[0].upper() for w in inst.split()[:2]) if inst else "DF"
    canvas.setFillColor(theme["primary"])
    canvas.setFont("Helvetica-Bold", 22)
    canvas.drawCentredString(circle_x, circle_y - 7, initials)

    # ── 6. Institution name ─────────────────────────────────────
    canvas.setFillColor(colors.HexColor("#90CAF9"))
    canvas.setFont("Helvetica", 10)
    inst_text = inst.upper() if inst else "FOCUSFLOW DOCUMENT GENERATOR"
    canvas.drawCentredString(W / 2, H * 0.695, inst_text)

    # ── 7. Divider line ─────────────────────────────────────────
    canvas.setStrokeColor(colors.HexColor("#FFFFFF40"))
    canvas.setLineWidth(0.8)
    canvas.line(W * 0.15, H * 0.675, W * 0.85, H * 0.675)

    # ── 8. Document type badge ──────────────────────────────────
    doc_type_label = {
        "assignment":    "ASSIGNMENT",
        "report":        "ACADEMIC REPORT",
        "cover_letter":  "COVER LETTER",
        "resume":        "CURRICULUM VITAE",
        "lab_report":    "LABORATORY REPORT",
        "meeting_notes": "MEETING MINUTES",
        "blank":         "DOCUMENT",
    }.get(data.get("type", "blank"), "DOCUMENT")

    badge_w = 90
    badge_h = 16
    badge_x = W / 2 - badge_w / 2
    badge_y = H * 0.635
    canvas.setFillColor(theme["badge_bg"])
    canvas.roundRect(badge_x, badge_y, badge_w, badge_h, radius=8, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawCentredString(W / 2, badge_y + 5, doc_type_label)

    # ── 9. Main title ───────────────────────────────────────────
    title = data.get("title", "Untitled Document")
    canvas.setFillColor(colors.white)
    # Word-wrap title manually for long titles
    max_chars = 30
    if len(title) > max_chars:
        words = title.split()
        lines, line = [], ""
        for w in words:
            if len(line) + len(w) + 1 <= max_chars:
                line += (" " + w if line else w)
            else:
                if line: lines.append(line)
                line = w
        if line: lines.append(line)
        # Draw multi-line title
        y_title = H * 0.565
        canvas.setFont("Helvetica-Bold", 22)
        for i, l in enumerate(lines[:3]):
            canvas.drawCentredString(W / 2, y_title - i * 28, l)
    else:
        canvas.setFont("Helvetica-Bold", 26)
        canvas.drawCentredString(W / 2, H * 0.565, title)

    # ── 10. Divider ─────────────────────────────────────────────
    canvas.setStrokeColor(colors.HexColor("#FFFFFF30"))
    canvas.setLineWidth(0.5)
    canvas.line(W * 0.2, H * 0.50, W * 0.8, H * 0.50)

    # ── 11. Metadata (author, subject, date) ────────────────────
    meta_y = H * 0.470
    meta_items = []
    if data.get("author"):     meta_items.append(("Author", data["author"]))
    if data.get("subject"):    meta_items.append(("Subject", data["subject"]))
    if data.get("date"):
        meta_items.append(("Date", data["date"]))
    else:
        meta_items.append(("Date", datetime.date.today().strftime("%B %d, %Y")))

    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#90CAF9"))
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#E3F2FD"))

    for i, (k, v) in enumerate(meta_items):
        y = meta_y - i * 18
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(colors.HexColor("#90CAF9"))
        canvas.drawCentredString(W / 2 - 40, y, k.upper() + ":")
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.HexColor("#E3F2FD"))
        canvas.drawString(W / 2 - 15, y, v)

    # ── 12. Bottom footer text ──────────────────────────────────
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#BBDEFB"))
    canvas.drawCentredString(W / 2, 18 * mm, "Generated by DocForge — FocusFlow")
    canvas.drawCentredString(W / 2, 12 * mm, datetime.date.today().strftime("%B %d, %Y"))

    canvas.restoreState()


# ══════════════════════════════════════════════════════════════
#  HEADER + FOOTER — runs on every page after cover
# ══════════════════════════════════════════════════════════════

def draw_page_header_footer(canvas, doc, data: dict, theme: dict, page_size):
    """
    Called by onLaterPages callback — draws header bar + footer on every body page.
    """
    canvas.saveState()
    W, H = page_size

    # ── Header strip ────────────────────────────────────────────
    canvas.setFillColor(theme["primary"])
    canvas.rect(0, H - 12 * mm, W, 12 * mm, fill=1, stroke=0)

    header_text = data.get("header_text") or data.get("title", "")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(22 * mm, H - 8 * mm, header_text[:60])

    # Doc type badge top-right
    doc_type = data.get("type", "document").replace("_", " ").title()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#BBDEFB"))
    canvas.drawRightString(W - 22 * mm, H - 8 * mm, doc_type.upper())

    # ── Footer line ──────────────────────────────────────────────
    canvas.setStrokeColor(theme["hr"])
    canvas.setLineWidth(0.5)
    canvas.line(22 * mm, 14 * mm, W - 22 * mm, 14 * mm)

    # Footer text — left: title, right: page number
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#888888"))
    footer_left = data.get("footer_text") or data.get("author", "")
    canvas.drawString(22 * mm, 9 * mm, footer_left)
    canvas.drawRightString(W - 22 * mm, 9 * mm, f"Page {doc.page}")

    canvas.restoreState()


# ══════════════════════════════════════════════════════════════
#  HTML → STORY PARSER
# ══════════════════════════════════════════════════════════════

def html_to_story(html: str, styles: dict, theme: dict, page_width_pts: float) -> list:
    """
    Parse TipTap HTML into a list of ReportLab flowable elements.
    This is the core parser that converts the editor content into PDF content.
    """
    story = []
    if not html or html.strip() == "<p></p>":
        story.append(Paragraph("No content provided.", styles["body"]))
        return story

    soup = BeautifulSoup(html, "html.parser")
    ol_counter = [0]  # mutable counter for ordered lists

    def process_inline(tag) -> str:
        """Convert inline HTML tags to ReportLab XML markup."""
        if isinstance(tag, NavigableString):
            text = str(tag)
            # Escape XML special chars
            text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            return text
        name = tag.name
        inner = "".join(process_inline(c) for c in tag.children)
        if name == "strong" or name == "b":
            return f"<b>{inner}</b>"
        elif name == "em" or name == "i":
            return f"<i>{inner}</i>"
        elif name == "u":
            return f"<u>{inner}</u>"
        elif name == "s" or name == "del":
            return f"<strike>{inner}</strike>"
        elif name == "code":
            return f'<font name="Courier" size="9" color="#1A237E">{inner}</font>'
        elif name == "mark":
            return f'<font color="#B7860B">{inner}</font>'
        elif name == "a":
            href = tag.get("href", "#")
            return f'<link href="{href}" color="#1565C0"><u>{inner}</u></link>'
        elif name in ("span", "p", "div"):
            return inner
        elif name == "br":
            return "<br/>"
        else:
            return inner

    def el_text(el) -> str:
        """Get full markup text for a block element."""
        return "".join(process_inline(c) for c in el.children).strip()

    for el in soup.children:
        if isinstance(el, NavigableString):
            t = str(el).strip()
            if t:
                story.append(Paragraph(t, styles["body"]))
            continue

        tag = el.name
        if not tag:
            continue

        if tag == "h1":
            text = el_text(el)
            if text:
                story.append(sp(8))
                story.append(chapter_banner(text, theme, styles, page_width_pts))
                story.append(sp(10))

        elif tag == "h2":
            text = el_text(el)
            if text:
                story.append(sp(6))
                story.append(section_box(text, theme, styles, page_width_pts))
                story.append(sp(8))

        elif tag == "h3":
            text = el_text(el)
            if text:
                story.append(sp(4))
                story.append(Paragraph(text, styles["h3"]))
                story.append(sp(2))

        elif tag == "p":
            text = el_text(el)
            if text:
                story.append(Paragraph(text, styles["body"]))

        elif tag == "ul":
            for li in el.find_all("li", recursive=False):
                item_text = el_text(li)
                if item_text:
                    story.append(Paragraph(f"• &nbsp; {item_text}", styles["bullet"]))

        elif tag == "ol":
            for i, li in enumerate(el.find_all("li", recursive=False), 1):
                item_text = el_text(li)
                if item_text:
                    story.append(Paragraph(f"{i}.  {item_text}", styles["ordered"]))

        elif tag == "blockquote":
            text = el_text(el)
            if text:
                story.append(sp(4))
                story.append(Paragraph(f"❝ {text} ❞", styles["blockquote"]))
                story.append(sp(4))

        elif tag == "pre":
            code_el = el.find("code")
            raw = (code_el or el).get_text()
            # Split by lines, render each line
            story.append(sp(6))
            for line in raw.split("\n"):
                safe_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(safe_line or " ", styles["code"]))
            story.append(sp(6))

        elif tag == "hr":
            story.append(sp(6))
            story.append(hr_line(theme, page_width_pts))
            story.append(sp(6))

        elif tag == "table":
            headers = []
            rows = []
            thead = el.find("thead")
            tbody = el.find("tbody") or el
            if thead:
                for th in thead.find_all("th"):
                    headers.append(th.get_text(strip=True))
            for tr in tbody.find_all("tr"):
                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if cells:
                    rows.append(cells)
            if not headers and rows:
                headers = rows.pop(0)
            if headers or rows:
                story.append(sp(6))
                story.append(styled_table(headers, rows, theme, styles, page_width_pts))
                story.append(sp(6))

        elif tag == "div":
            # Recurse into div children
            sub = html_to_story(str(el), styles, theme, page_width_pts)
            story.extend(sub)

    return story
