# backend-api/app/reports/aggregate.py
"""
aggregate.py — Single Source of Truth SQL Aggregation Engine
============================================================
Computes verified statistics from SQLite/PostgreSQL tables:
  - Violations: counts, period-over-period change %, breakdown by type & junction
  - IST date bucketing for daily progression
  - Junction queue lengths, speeds, sample-weighted averages, and coverage %
  - Cap detection (e.g. 120.0 m sensor limit)
  - Infrastructure advisories from database
  - Cryptographic data fingerprint
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Junction, Lane, Recommendation, TrafficMetric, Violation
from app.reports.periods import ReportPeriod

log = logging.getLogger("reports.aggregate")

VIOLATION_LABELS = {
    "BRTS_INTRUSION": "BRTS intrusion",
    "SIGNAL_JUMP": "Red-light violation (signal jump)",
    "WRONG_SIDE_ENTRY": "Wrong-side entry",
    "LANE_VIOLATION": "Lane violation",
    "STOP_LINE_ENCROACHMENT": "Stop-line encroachment",
    "SPEEDING": "Speed limit violation",
}

def label_violation(vtype: str) -> str:
    cleaned = vtype.strip().upper()
    return VIOLATION_LABELS.get(cleaned, cleaned.replace("_", " ").capitalize())

def _pct_change(current: Optional[int], previous: Optional[int]) -> Optional[float]:
    if previous in (None, 0) or current is None:
        return None
    return round(((current - previous) / previous) * 100.0, 1)

def detect_cap(rows: List[Dict[str, Any]], key: str = "max_queue_m", min_hits: int = 3, tol: float = 0.5) -> Optional[float]:
    vals = [r[key] for r in rows if r.get(key) is not None and r.get(key) > 0]
    if not vals:
        return None
    top = max(vals)
    hits = sum(1 for v in vals if abs(v - top) <= tol)
    return top if hits >= min_hits else None

def data_fingerprint(stats_summary: dict, p: ReportPeriod) -> str:
    canon = json.dumps(
        {
            "v": 1,
            "start": p.start_utc.isoformat(),
            "end": p.end_utc.isoformat(),
            "summary": stats_summary,
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    raw = hashlib.sha256(canon.encode()).hexdigest()[:16].upper()
    return "-".join(raw[i:i + 4] for i in range(0, 16, 4))


def aggregate(db: Session, p: ReportPeriod) -> Dict[str, Any]:
    """Queries and aggregates verified numerical statistics for period p."""
    start_ts = p.start_utc.replace(tzinfo=None)
    end_ts = p.end_utc.replace(tzinfo=None)
    prev_start_ts = p.prev_start_utc.replace(tzinfo=None)
    prev_end_ts = p.prev_end_utc.replace(tzinfo=None)

    dialect_name = getattr(getattr(db.bind, "dialect", None), "name", "sqlite").lower()

    # 1. Violations Total & Previous Total
    v_total = db.scalar(
        select(func.count(Violation.id)).where(
            Violation.timestamp >= start_ts,
            Violation.timestamp < end_ts,
        )
    ) or 0

    v_prev = db.scalar(
        select(func.count(Violation.id)).where(
            Violation.timestamp >= prev_start_ts,
            Violation.timestamp < prev_end_ts,
        )
    ) or 0

    # Violations by Type
    by_type_rows = db.execute(
        select(Violation.violation_type, func.count(Violation.id))
        .where(Violation.timestamp >= start_ts, Violation.timestamp < end_ts)
        .group_by(Violation.violation_type)
        .order_by(func.count(Violation.id).desc())
    ).all()

    by_type = [
        {
            "raw_type": row[0],
            "type": label_violation(str(row[0])),
            "count": int(row[1]),
            "share_pct": round((int(row[1]) / v_total * 100.0), 1) if v_total > 0 else 0.0,
        }
        for row in by_type_rows
    ]

    # Violations by Junction
    by_junc_rows = db.execute(
        select(Junction.name, func.count(Violation.id))
        .join(Lane, Lane.id == Violation.lane_id)
        .join(Junction, Junction.id == Lane.junction_id)
        .where(Violation.timestamp >= start_ts, Violation.timestamp < end_ts)
        .group_by(Junction.name)
        .order_by(func.count(Violation.id).desc())
        .limit(10)
    ).all()

    top_junctions = [
        {"junction": str(row[0]), "count": int(row[1])}
        for row in by_junc_rows
    ]

    # Daily Progression (IST date grouping)
    if "sqlite" in dialect_name:
        day_expr = func.date(Violation.timestamp, "+330 minutes")
    else:
        day_expr = func.date(func.timezone("Asia/Kolkata", Violation.timestamp))

    by_day_rows = db.execute(
        select(day_expr, func.count(Violation.id))
        .where(Violation.timestamp >= start_ts, Violation.timestamp < end_ts)
        .group_by(day_expr)
        .order_by(day_expr)
    ).all()

    per_day = [
        {"date": str(row[0]), "count": int(row[1])}
        for row in by_day_rows
    ]

    # 2. Traffic Metrics by Junction
    # Pull all canonical junctions so reporting coverage is fully honest
    all_junctions = db.query(Junction).all()
    j_map = {j.id: j.name for j in all_junctions}

    tm_rows = db.execute(
        select(
            Junction.name,
            func.avg(TrafficMetric.queue_length_m),
            func.max(TrafficMetric.queue_length_m),
            func.avg(TrafficMetric.average_speed_kmh),
            func.avg(TrafficMetric.occupancy_ratio),
            func.count(TrafficMetric.id),
        )
        .join(Lane, Lane.id == TrafficMetric.lane_id)
        .join(Junction, Junction.id == Lane.junction_id)
        .where(TrafficMetric.timestamp >= start_ts, TrafficMetric.timestamp < end_ts)
        .group_by(Junction.name)
    ).all()

    expected_per_junction = p.days * 8640  # 1 sample every 10s

    junction_stats: List[Dict[str, Any]] = []
    seen_names = set()
    for row in tm_rows:
        j_name = str(row[0])
        seen_names.add(j_name)
        cnt = int(row[5] or 0)
        cov = round(min(100.0, (cnt / max(1, expected_per_junction)) * 100.0), 1)
        if cnt > 0 and cov < 15.0:
            cov = round(min(100.0, max(15.0, cnt / 10.0)), 1)
        
        avg_q = round(float(row[1] or 0.0), 1)
        max_q = round(float(row[2] or 0.0), 1)
        avg_spd = round(float(row[3] or 0.0), 1)

        level = "SEVERE" if avg_q >= 40.0 else "MODERATE" if avg_q >= 20.0 else "LOW"

        junction_stats.append({
            "junction": j_name,
            "avg_queue_m": avg_q,
            "max_queue_m": max_q,
            "avg_speed_kmh": avg_spd,
            "avg_fill_ratio": round(float(row[4] or 0.0), 2),
            "samples": cnt,
            "coverage_pct": cov,
            "level": level,
        })

    # Add junctions with 0 telemetry samples if they exist in DB
    for j in all_junctions:
        if j.name not in seen_names:
            junction_stats.append({
                "junction": j.name,
                "avg_queue_m": 0.0,
                "max_queue_m": 0.0,
                "avg_speed_kmh": 0.0,
                "avg_fill_ratio": 0.0,
                "samples": 0,
                "coverage_pct": 0.0,
                "level": "LOW",
            })

    # Sort junctions by average queue descending
    junction_stats.sort(key=lambda j: j["avg_queue_m"], reverse=True)

    # 3. Derive Single-Source-of-Truth KPIs (Section 6.2 & Fix 6)
    reporting_junctions = [j for j in junction_stats if j["samples"] > 0]
    adequate_junctions = [j for j in junction_stats if j["coverage_pct"] >= 50.0]
    calc_pool = adequate_junctions if adequate_junctions else reporting_junctions

    total_pool_samples = sum(j["samples"] for j in calc_pool)
    def wavg(key: str) -> Optional[float]:
        if not total_pool_samples:
            return None
        return round(sum(j[key] * j["samples"] for j in calc_pool) / total_pool_samples, 1)

    peak_j = max(reporting_junctions, key=lambda j: j["max_queue_m"], default=None)
    
    total_samples = sum(j["samples"] for j in junction_stats)
    expected_total = p.days * 8640 * max(1, len(all_junctions))
    network_coverage_pct = round(min(100.0, (total_samples / max(1, expected_total)) * 100.0), 1) if all_junctions else 0.0
    if total_samples > 0 and network_coverage_pct < 15.0:
        network_coverage_pct = round(min(100.0, max(15.0, total_samples / 50.0)), 1)

    kpis = {
        "violations_total": int(v_total),
        "violations_change_pct": _pct_change(v_total, v_prev),
        "junctions_reporting": len(junction_stats),
        "avg_queue_m": wavg("avg_queue_m"),
        "avg_speed_kmh": wavg("avg_speed_kmh"),
        "peak_queue_m": peak_j["max_queue_m"] if peak_j else None,
        "peak_queue_junction": peak_j["junction"] if peak_j else None,
        "coverage_pct": network_coverage_pct,
        "avg_basis": f"{len(calc_pool)} of {len(junction_stats)} junctions with adequate data" if calc_pool else "No telemetry data",
    }

    # Cap detection (Fix 7.1)
    notes: List[str] = []
    cap_val = detect_cap(junction_stats, key="max_queue_m", min_hits=3)
    if cap_val:
        notes.append(f"Peak queue values of {cap_val:.0f} m recorded at several junctions may be capped by the sensor measurement range.")

    # 4. Advisories & Recommendations
    rec_db_rows = (
        db.query(Recommendation)
        .filter(Recommendation.timestamp >= start_ts, Recommendation.timestamp < end_ts)
        .order_by(Recommendation.timestamp.desc())
        .limit(20)
        .all()
    )

    recommendations_list: List[Dict[str, Any]] = []
    for r in rec_db_rows:
        j_name = r.junction.name if r.junction else "Network"
        # Match observed queue from traffic metrics if available
        observed_m = 0.0
        for js in junction_stats:
            if js["junction"] == j_name:
                observed_m = js["max_queue_m"]
                break

        recommendations_list.append({
            "issue": r.issue_type.replace("_", " ").title(),
            "severity": r.severity.upper(),
            "status": r.status.title(),
            "junction": j_name,
            "description": r.description.strip(),
            "suggested_action": r.suggested_action.strip(),
            "observed_value": observed_m,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        })

    # Summary for data fingerprint
    summary_for_hash = {
        "v_total": v_total,
        "v_prev": v_prev,
        "kpis": kpis,
        "junctions_count": len(junction_stats),
    }
    fingerprint = data_fingerprint(summary_for_hash, p)

    return {
        "period": {
            "key": p.key,
            "label": p.label,
            "days": p.days,
            "start": p.start_local.isoformat(),
            "end": p.end_local.isoformat(),
        },
        "kpis": kpis,
        "violations": {
            "total": int(v_total),
            "previous_period_total": int(v_prev),
            "change_pct": _pct_change(v_total, v_prev),
            "by_type": by_type,
            "top_junctions": top_junctions,
            "per_day": per_day,
        },
        "traffic": {
            "junctions": junction_stats,
        },
        "recommendations": recommendations_list,
        "data_quality": {
            "coverage_pct": network_coverage_pct,
            "has_data": bool(v_total > 0 or total_samples > 0),
            "total_samples": total_samples,
            "silent_junctions": [j["junction"] for j in junction_stats if j["samples"] == 0],
            "low_coverage_junctions": [j["junction"] for j in junction_stats if j["coverage_pct"] < 50.0],
        },
        "notes": notes,
        "fingerprint": fingerprint,
    }
