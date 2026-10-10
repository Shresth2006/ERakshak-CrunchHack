# backend-api/app/reports/validate.py
"""
Data consistency validator for report statistics.
Catches contradictions before rendering.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict, List
from app.reports.periods import ReportPeriod

log = logging.getLogger("reports.validate")

def validate_stats(stats: Dict[str, Any], p: ReportPeriod) -> List[str]:
    """Validates data consistency across KPIs, tables, and temporal series."""
    errs: List[str] = []
    kpis = stats.get("kpis", {})
    violations = stats.get("violations", {})
    v_total = violations.get("total", 0)
    
    rows = stats.get("traffic", {}).get("junctions", [])
    if rows:
        j_reporting = kpis.get("junctions_reporting", 0)
        if j_reporting != len(rows):
            errs.append(f"KPI junction count ({j_reporting}) does not match junction table rows ({len(rows)})")
        if kpis.get("peak_queue_m") is None:
            errs.append("Peak queue missing while junction data exists")
        if kpis.get("avg_speed_kmh") is None:
            errs.append("Average speed missing while junction data exists")

    by_type = violations.get("by_type", [])
    if by_type and sum(r.get("count", 0) for r in by_type) != v_total:
        errs.append(f"By-type counts sum ({sum(r.get('count', 0) for r in by_type)}) does not match total ({v_total})")

    per_day = violations.get("per_day", [])
    if per_day and sum(r.get("count", 0) for r in per_day) != v_total:
        errs.append(f"Per-day counts sum ({sum(r.get('count', 0) for r in per_day)}) does not match total ({v_total})")

    for r in per_day:
        try:
            d = date.fromisoformat(r["date"])
            if not (p.start_local <= d <= p.end_local):
                errs.append(f"Day {d} outside report window ({p.start_local} to {p.end_local})")
        except Exception:
            pass

    if errs:
        log.warning("Validation warnings in report statistics: %s", "; ".join(errs))

    return errs
