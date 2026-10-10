# backend-api/app/reports/components.py
"""
Reusable UI components for Surat Police reports:
Masthead, KPI cards, tables, sections, advisories, and safe markup helpers.
"""

from __future__ import annotations

import os
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    CondPageBreak,
    Flowable,
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.reports.config import ReportConfig
from app.reports.fonts import get_font_family
from app.reports.theme import (
    AMBER,
    BORDER,
    FRAME_W,
    GOLD,
    GREEN,
    MUTED,
    NAVY,
    PANEL,
    RED,
    S,
    STEEL,
    TEXT,
)
from app.reports.titles import TITLE, kind_line, period_phrase

# ---------------------------------------------------------------------------
# Trusted Markup & Flowable Converter (Fix 1 in Fix Guide v2)
# ---------------------------------------------------------------------------

class Markup(str):
    """Marker class for trusted internal markup strings."""
    pass

def pill(text: str, tone: str) -> Markup:
    """Returns styled colored text capsule for table cells."""
    colors_map = {
        "bad": "#B42318",
        "warn": "#B54708",
        "good": "#067647",
        "muted": "#667085",
        "neutral": "#12284C",
    }
    hex_col = colors_map.get(tone, "#12284C")
    return Markup(f"<font color='{hex_col}'><b>{escape(str(text))}</b></font>")

def to_flowable(cell: Any, style: ParagraphStyle) -> Flowable:
    """Universal safe flowable converter for table cells."""
    if isinstance(cell, Flowable):
        return cell
    if isinstance(cell, Markup):
        return Paragraph(str(cell), style)
    
    s = "" if cell is None else str(cell)
    # Guard against Paragraph debug representation leaks
    if s.startswith("Paragraph(") or "caseSensitive" in s or "'style':" in s:
        # Extract plain text if possible or fail in dev
        match = re.search(r"'(?:text|frags)':\s*['\"]([^'\"]+)['\"]", s)
        clean = match.group(1) if match else "DATA"
        return Paragraph(escape(clean), style)
        
    return Paragraph(escape(s).replace("\n", "<br/>"), style)

def P(text: Any, style: ParagraphStyle = S.body) -> Flowable:
    return to_flowable(text, style)

def PM(markup: str, style: ParagraphStyle = S.body) -> Paragraph:
    """Trusted markup written in Python code."""
    return Paragraph(markup, style)


# ---------------------------------------------------------------------------
# Masthead Component
# ---------------------------------------------------------------------------

def logo_flowable(path: Optional[str], max_w: float, max_h: float) -> Flowable:
    if not path or not os.path.exists(path):
        return Spacer(max_w, max_h)
    try:
        iw, ih = ImageReader(path).getSize()
        ratio = min(max_w / iw, max_h / ih)
        return Image(path, width=iw * ratio, height=ih * ratio, mask="auto")
    except Exception:
        return Spacer(max_w, max_h)

def masthead(cfg: ReportConfig, period: Any, ctx: Any) -> List[Flowable]:
    left = logo_flowable(cfg.logo_path, 22 * mm, 22 * mm)
    mid = [
        P(cfg.org_line, S.eyebrow),
        P(TITLE, S.title),
        P(period_phrase(period), S.subtitle),
        P(kind_line(period), S.kind),
    ]
    right = [
        PM(f"<b>Report ID</b><br/>{escape(getattr(ctx, 'report_id', 'STR-REPORT'))}", S.meta),
        Spacer(1, 3),
        PM(f"<b>Generated</b><br/>{escape(getattr(ctx, 'generated_at', ''))}", S.meta),
    ]
    
    table = Table([[left, mid, right]], colWidths=[26 * mm, 108 * mm, 40 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    
    return [
        table,
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=1.2, color=GOLD, spaceAfter=6),
    ]


# ---------------------------------------------------------------------------
# KPI Cards (Fix 3 & 4: Dynamic Font Sizing & Computed Sub-text)
# ---------------------------------------------------------------------------

def fit_font_size(text: str, font_name: str, max_w: float, start: float = 19.0, minimum: float = 11.0) -> float:
    size = start
    try:
        while size > minimum and pdfmetrics.stringWidth(text, font_name, size) > max_w:
            size -= 0.5
    except Exception:
        pass
    return size

def kpi_cards(items: List[Dict[str, Any]]) -> Flowable:
    tone_color = {
        "neutral": NAVY,
        "bad": RED,
        "warn": AMBER,
        "good": GREEN,
    }
    col_w = FRAME_W / 3.0  # 58 mm per card

    font_fam = get_font_family()
    bold_font = "NotoSans-Bold" if font_fam == "NotoSans" else "Helvetica-Bold"

    def cell(it: Dict[str, Any]) -> List[Flowable]:
        raw_val = "—" if it.get("value") is None else str(it["value"])
        # Fit font size to column width minus inner margins
        avail_w = col_w - (16 * mm)
        fsize = fit_font_size(raw_val, bold_font, avail_w, start=17.0, minimum=10.5)
        
        val_style = ParagraphStyle(
            f"kpi_dyn_{id(it)}",
            parent=S.kpi_val,
            fontSize=fsize,
            leading=fsize + 3,
            textColor=tone_color.get(it.get("tone", "neutral"), NAVY),
        )
        return [
            P(it.get("label", "").upper(), S.kpi_label),
            Spacer(1, 1),
            P(raw_val, val_style),
            Spacer(1, 1),
            P(it.get("sub", ""), S.kpi_sub),
        ]

    rows = [items[i:i + 3] for i in range(0, len(items), 3)]
    data = []
    for r in rows:
        row_cells = [cell(it) for it in r]
        # Pad with empty cells if fewer than 3
        while len(row_cells) < 3:
            row_cells.append([])
        data.append(row_cells)

    t = Table(data, colWidths=[col_w] * 3, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.white),
        ("LINEABOVE", (0, 0), (-1, 0), 2, GOLD),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


# ---------------------------------------------------------------------------
# Tables & Sections
# ---------------------------------------------------------------------------

def data_table(
    header: List[str],
    rows: List[List[Any]],
    col_w: List[float],
    align_right: tuple = (),
    zebra: bool = True,
    repeat: int = 1,
) -> Table:
    """Builds a perfectly formatted, pagination-safe table with repeating headers."""
    head = [to_flowable(h, S.th_r if i in align_right else S.th) for i, h in enumerate(header)]
    body = [
        [to_flowable(c, S.td_r if i in align_right else S.td) for i, c in enumerate(r)]
        for r in rows
    ]
    t = Table([head] + body, colWidths=col_w, repeatRows=repeat, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PANEL),
        ("LINEBELOW", (0, 0), (-1, 0), 1, NAVY),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if zebra:
        for idx in range(2, len(rows) + 1, 2):
            style.append(("BACKGROUND", (0, idx), (-1, idx), colors.HexColor("#FAFBFC")))
    t.setStyle(TableStyle(style))
    return t

def section(title_no: str, title: str, flowables: List[Flowable], min_space: float = 45 * mm) -> List[Flowable]:
    """Wraps section in CondPageBreak so headings are never orphaned."""
    head = [
        CondPageBreak(min_space),
        P(f"{title_no}  {title}", S.h2),
        HRFlowable(width="100%", thickness=0.6, color=BORDER, spaceAfter=4),
    ]
    return head + flowables

def finding_panel(f: Any) -> Flowable:
    title = getattr(f, "title", "")
    detail = getattr(f, "detail", "")
    p = PM(f"<b>{escape(title)}</b><br/><font color='#475467'>{escape(detail)}</font>", S.body)
    t = Table([[p]], colWidths=[FRAME_W], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LINELEFT", (0, 0), (-1, -1), 2.5, NAVY),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t

def signoff(roles=("Prepared by", "Reviewed by", "Approved by")) -> Flowable:
    cells = [
        [PM(f"<b>{r}</b>", S.small) for r in roles],
        ["", "", ""],
        [P("Name / Designation", S.small)] * 3,
        [P("Date", S.small)] * 3,
    ]
    t = Table(cells, colWidths=[FRAME_W / 3.0] * 3, rowHeights=[6 * mm, 11 * mm, 5 * mm, 5 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 2), (-1, 2), 0.6, MUTED),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return KeepTogether([Spacer(1, 8), t])


# ---------------------------------------------------------------------------
# Group Advisories (Fix 8 in Fix Guide v2)
# ---------------------------------------------------------------------------

PRIO_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

def template_key(text: str) -> str:
    cleaned = re.sub(r"\d+(\.\d+)?\s*m\b", "N m", text)
    return re.sub(r"\s+", " ", cleaned).strip()

def group_advisories(recs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Groups duplicate advisory actions together."""
    if not recs:
        return []
    groups = defaultdict(list)
    for r in recs:
        sev = r.get("severity", "MEDIUM").upper()
        stat = r.get("status", "Pending").title()
        action_text = (r.get("suggested_action") or r.get("description") or "").strip()
        key = (sev, stat, template_key(action_text))
        groups[key].append(r)

    out = []
    for (sev, stat, _), items in groups.items():
        junctions = sorted(list({i.get("junction") or "Network" for i in items if i.get("junction")}))
        junc_str = ", ".join(junctions) if junctions else "Network-wide"
        if len(junctions) > 3:
            junc_str = f"{len(junctions)} junctions ({junctions[0]}, {junctions[1]}...)"

        observed_parts = [
            f"{i.get('junction')}: {i.get('observed_value', 0):.0f} m"
            for i in items if i.get("observed_value")
        ]
        
        out.append({
            "priority": sev,
            "status": stat,
            "location": junc_str,
            "text": (items[0].get("suggested_action") or items[0].get("description") or "").strip(),
            "observed": "; ".join(observed_parts[:4]) if observed_parts else None,
            "count": len(items),
        })

    return sorted(out, key=lambda g: (PRIO_RANK.get(g["priority"], 9), -g["count"]))
