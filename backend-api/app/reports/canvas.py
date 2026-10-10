# backend-api/app/reports/canvas.py
"""
Numbered running header & footer canvas.
Two-pass architecture ensures exact 'Page x of y' counts.
"""

from __future__ import annotations

import os
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

from app.reports.theme import BORDER, GOLD, MARGIN_X, MUTED, NAVY, PAGE_H, PAGE_W

class NumberedCanvas(rl_canvas.Canvas):
    ctx = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_decorations(total_pages)
            super().showPage()
        super().save()

    def _draw_decorations(self, total: int):
        c = self.ctx
        x0, x1 = MARGIN_X, PAGE_W - MARGIN_X
        self.saveState()

        # 1. Top navy band (4 mm)
        self.setFillColor(NAVY)
        self.rect(0, PAGE_H - 4 * mm, PAGE_W, 4 * mm, stroke=0, fill=1)

        # 2. Running header (pages 2+)
        if self._pageNumber > 1 and c:
            if getattr(c, "logo_path", None) and os.path.exists(c.logo_path):
                try:
                    self.drawImage(
                        c.logo_path,
                        x0,
                        PAGE_H - 15 * mm,
                        width=8 * mm,
                        height=8 * mm,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    pass

            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(NAVY)
            self.drawString(x0 + 10 * mm, PAGE_H - 11.5 * mm, getattr(c, "full_title", "Surat Police Traffic Report"))

            self.setFont("Helvetica", 7.5)
            self.setFillColor(MUTED)
            self.drawRightString(x1, PAGE_H - 11.5 * mm, getattr(c, "report_id", ""))

            self.setStrokeColor(BORDER)
            self.setLineWidth(0.5)
            self.line(x0, PAGE_H - 16 * mm, x1, PAGE_H - 16 * mm)

        # 3. Running footer (all pages)
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.5)
        self.line(x0, 14 * mm, x1, 14 * mm)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(MUTED)
        
        left_text = "RESTRICTED"
        if c:
            cfg = getattr(c, "cfg", None)
            if cfg:
                left_text = f"{cfg.classification}"
                if cfg.demo_mode:
                    left_text += f" · {cfg.demo_note}"

        self.drawString(x0, 9.5 * mm, left_text)
        self.drawRightString(x1, 9.5 * mm, f"Page {self._pageNumber} of {total}")
        self.restoreState()


def make_canvas(ctx):
    return type("ReportCanvas", (NumberedCanvas,), {"ctx": ctx})
