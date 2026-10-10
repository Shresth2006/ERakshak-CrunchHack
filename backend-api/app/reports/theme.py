# backend-api/app/reports/theme.py
"""
Theme, colors, dimensions, and paragraph styles.
"""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm

from app.reports.fonts import get_font_family

NAVY = colors.HexColor("#12284C")
STEEL = colors.HexColor("#3E5C76")
GOLD = colors.HexColor("#B8902F")
RED = colors.HexColor("#B42318")
AMBER = colors.HexColor("#B54708")
GREEN = colors.HexColor("#067647")
PANEL = colors.HexColor("#F4F6F9")
BORDER = colors.HexColor("#D0D5DD")
TEXT = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#667085")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 18 * mm
FRAME_W = PAGE_W - 2 * MARGIN_X  # 174 mm


def _font_names() -> tuple[str, str]:
    fam = get_font_family()
    if fam == "NotoSans":
        return "NotoSans", "NotoSans-Bold"
    return "Helvetica", "Helvetica-Bold"


class StyleRegistry:
    def __init__(self):
        self._cache = {}

    def _s(self, name: str, is_bold: bool = False, **kwargs) -> ParagraphStyle:
        normal_font, bold_font = _font_names()
        font = bold_font if is_bold else normal_font
        base = dict(fontName=font, textColor=TEXT, fontSize=9.5, leading=14)
        base.update(kwargs)
        return ParagraphStyle(name, **base)

    @property
    def body(self) -> ParagraphStyle:
        return self._s("body")

    @property
    def small(self) -> ParagraphStyle:
        return self._s("small", fontSize=8, leading=11, textColor=MUTED)

    @property
    def eyebrow(self) -> ParagraphStyle:
        return self._s("eyebrow", is_bold=True, fontSize=8, leading=10, textColor=STEEL, spaceAfter=2)

    @property
    def title(self) -> ParagraphStyle:
        return self._s("title", is_bold=True, fontSize=20, leading=24, textColor=NAVY)

    @property
    def subtitle(self) -> ParagraphStyle:
        return self._s("subtitle", is_bold=True, fontSize=12, leading=16, textColor=STEEL, spaceBefore=2)

    @property
    def kind(self) -> ParagraphStyle:
        return self._s("kind", fontSize=8.5, leading=11, textColor=MUTED)

    @property
    def meta(self) -> ParagraphStyle:
        return self._s("meta", fontSize=8, leading=11, textColor=MUTED, alignment=TA_RIGHT)

    @property
    def h2(self) -> ParagraphStyle:
        return self._s("h2", is_bold=True, fontSize=12, leading=15, textColor=NAVY, spaceBefore=8, spaceAfter=4)

    @property
    def h3(self) -> ParagraphStyle:
        return self._s("h3", is_bold=True, fontSize=10, leading=13, textColor=NAVY, spaceBefore=4, spaceAfter=2)

    @property
    def th(self) -> ParagraphStyle:
        return self._s("th", is_bold=True, fontSize=8, leading=10, textColor=NAVY)

    @property
    def th_r(self) -> ParagraphStyle:
        return self._s("th_r", is_bold=True, fontSize=8, leading=10, textColor=NAVY, alignment=TA_RIGHT)

    @property
    def td(self) -> ParagraphStyle:
        return self._s("td", fontSize=8.5, leading=11)

    @property
    def td_r(self) -> ParagraphStyle:
        return self._s("td_r", fontSize=8.5, leading=11, alignment=TA_RIGHT)

    @property
    def kpi_label(self) -> ParagraphStyle:
        return self._s("kpi_label", is_bold=True, fontSize=7.5, leading=9, textColor=MUTED)

    @property
    def kpi_val(self) -> ParagraphStyle:
        return self._s("kpi_val", is_bold=True, fontSize=19, leading=23, textColor=NAVY)

    @property
    def kpi_sub(self) -> ParagraphStyle:
        return self._s("kpi_sub", fontSize=8, leading=10, textColor=MUTED)


S = StyleRegistry()
