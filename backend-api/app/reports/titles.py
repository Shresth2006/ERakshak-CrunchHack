# backend-api/app/reports/titles.py
"""
Title, period phrasing, and filename resolution for Surat Police reports.
"""

from __future__ import annotations

from datetime import timedelta
from app.reports.periods import ReportPeriod

TITLE = "Surat Police Traffic Report"

def period_phrase(p: ReportPeriod) -> str:
    """Returns clean, human-readable date range."""
    s, e = p.start_local, p.end_local
    if s == e:
        return f"{s:%A, %d %b %Y}"
    first = s.day == 1
    last = (e + timedelta(days=1)).day == 1
    if first and last and (s.year, s.month) == (e.year, e.month):
        return f"{s:%B %Y}"
    if first and last:
        return f"{s:%B %Y} to {e:%B %Y}"
    left = f"{s:%d %b}" if s.year == e.year else f"{s:%d %b %Y}"
    return f"{left} to {e:%d %b %Y}"

def kind_label(p: ReportPeriod) -> str:
    s, e = p.start_local, p.end_local
    if s == e:
        return "Daily report"
    if s.weekday() == 0 and (e - s).days == 6:
        return "Weekly report"
    if s.day == 1 and (e + timedelta(days=1)).day == 1 and (s.year, s.month) == (e.year, e.month):
        return "Monthly report"
    return {"last_7_days": "Last 7 days", "last_30_days": "Last 30 days"}.get(p.key, "Custom range")

def kind_line(p: ReportPeriod) -> str:
    """Avoids duplicate strings (Fix 5 in Fix Guide v2)."""
    kind = kind_label(p)
    opt = getattr(p, "label_option", None)
    if not opt:
        return kind
    return opt if kind in opt else f"{kind} · {opt}"

def full_title(p: ReportPeriod) -> str:
    """For metadata and running header."""
    return f"{TITLE} — {period_phrase(p)}"

def filename(p: ReportPeriod) -> str:
    """ASCII safe filename for HTTP header."""
    return f"SuratPolice_TrafficReport_{p.start_local.isoformat()}_to_{p.end_local.isoformat()}.pdf"
