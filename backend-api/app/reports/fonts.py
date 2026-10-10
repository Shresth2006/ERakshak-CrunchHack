# backend-api/app/reports/fonts.py
"""
Font registration for PDF reports.
Embeds Noto Sans family with fallback to Helvetica if font files are absent.
"""

from __future__ import annotations

import logging
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

log = logging.getLogger("reports.fonts")

FONT_DIR = Path(__file__).parent / "assets" / "fonts"
_registered = False
_primary_font = "Helvetica"

def register_fonts() -> str:
    global _registered, _primary_font
    if _registered:
        return _primary_font

    try:
        font_files = [
            ("NotoSans", "NotoSans-Regular.ttf"),
            ("NotoSans-Bold", "NotoSans-Bold.ttf"),
            ("NotoSans-Italic", "NotoSans-Italic.ttf"),
            ("NotoSans-BoldItalic", "NotoSans-BoldItalic.ttf"),
        ]
        
        all_exist = all((FONT_DIR / fn).exists() for _, fn in font_files)
        if all_exist:
            for name, fn in font_files:
                pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / fn)))
            
            pdfmetrics.registerFontFamily(
                "NotoSans",
                normal="NotoSans",
                bold="NotoSans-Bold",
                italic="NotoSans-Italic",
                boldItalic="NotoSans-BoldItalic",
            )
            _primary_font = "NotoSans"
            log.info("Successfully registered embedded NotoSans font family")
        else:
            log.warning("NotoSans TTF files missing in %s, falling back to Helvetica", FONT_DIR)
            _primary_font = "Helvetica"
    except Exception as exc:
        log.exception("Error registering NotoSans fonts: %s. Falling back to Helvetica.", exc)
        _primary_font = "Helvetica"

    _registered = True
    return _primary_font

def get_font_family() -> str:
    global _primary_font
    if not _registered:
        register_fonts()
    return _primary_font
