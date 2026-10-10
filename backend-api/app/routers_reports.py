# backend-api/app/routers_reports.py
"""
routers_reports.py — Report Download & Analytics Router
======================================================
Exposes asynchronous, threadpool-isolated endpoints for:
  - Print-ready PDF command center reports (with Gemini narrative analysis)
  - Period-aligned structured CSV data exports
  - Real-time aggregated statistics preview
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Junction, Lane, TrafficMetric, Violation
import hashlib
from app.reports.aggregate import aggregate
from app.reports.narrative import narrate
from app.reports.pdf_builder import build_pdf
from app.reports.periods import IST, PeriodError, resolve_period

router = APIRouter(prefix="/api/reports", tags=["reports"])

PeriodKey = Literal["previous_week", "previous_month", "last_7_days", "last_30_days", "custom"]


@router.get("/download/pdf")
async def download_pdf_report(
    period: PeriodKey = "previous_week",
    start: Optional[date] = None,
    end: Optional[date] = None,
    ai: bool = Query(True, description="Enable Gemini AI narrative synthesis (falls back automatically)"),
    db: Session = Depends(get_db),
):
    """Generates and downloads an executive PDF report for the specified period."""
    try:
        p = resolve_period(period, start=start, end=end)
    except PeriodError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # Run blocking DB aggregation in threadpool
    stats = await run_in_threadpool(aggregate, db, p)

    narr, used_ai = await narrate(stats, use_ai=ai)

    generated_at = datetime.now(IST).strftime("%d %b %Y %H:%M IST")
    report_id = f"STR-{datetime.now(IST).strftime('%Y%m%d')}-0001"
    
    # Run CPU-intensive PDF compilation in threadpool
    pdf_bytes = await run_in_threadpool(build_pdf, p.label, stats, narr, used_ai, generated_at, report_id)

    from app.reports.titles import filename as get_pdf_filename
    pdf_filename = get_pdf_filename(p)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{pdf_filename}"',
            "Cache-Control": "no-store",
            "X-Report-AI-Used": str(used_ai).lower(),
            "X-Report-ID": report_id,
        },
    )


@router.get("/download/csv")
async def download_csv_report(
    type: Literal["violations", "metrics"] = "violations",
    period: PeriodKey = "previous_week",
    start: Optional[date] = None,
    end: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Exports structured database logs aligned with the exact period filter."""
    try:
        p = resolve_period(period, start=start, end=end)
    except PeriodError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    start_ts = p.start_utc.replace(tzinfo=None)
    end_ts = p.end_utc.replace(tzinfo=None)

    output = io.StringIO()
    writer = csv.writer(output)

    if type == "violations":
        writer.writerow(["ID", "Junction Name", "Lane Location", "Timestamp (UTC)", "Violation Type", "Vehicle Type"])
        violations = (
            db.query(Violation)
            .filter(Violation.timestamp >= start_ts, Violation.timestamp < end_ts)
            .order_by(Violation.timestamp.desc())
            .all()
        )
        if not violations:
            writer.writerow(["N/A", "All Junctions", "No violations recorded in period", p.start_local.isoformat(), "none", "none"])
        else:
            for v in violations:
                lane = db.query(Lane).filter(Lane.id == v.lane_id).first()
                j_name = db.query(Junction).filter(Junction.id == lane.junction_id).first().name if lane else "Unknown"
                writer.writerow([
                    v.id,
                    j_name,
                    lane.lane_name if lane else "Unknown Lane",
                    v.timestamp.isoformat(),
                    v.violation_type,
                    v.vehicle_type,
                ])
        filename = f"erakshak_violations_{p.slug}.csv"
    else:
        writer.writerow(["ID", "Lane ID", "Junction Name", "Timestamp (UTC)", "Vehicle Count", "Queue Length (m)", "Occupancy Ratio", "Avg Speed (km/h)"])
        metrics = (
            db.query(TrafficMetric)
            .filter(TrafficMetric.timestamp >= start_ts, TrafficMetric.timestamp < end_ts)
            .order_by(TrafficMetric.timestamp.desc())
            .limit(5000)
            .all()
        )
        if not metrics:
            writer.writerow(["N/A", "All Lanes", "All Junctions", p.start_local.isoformat(), 0, 0.0, 0.0, 0.0])
        else:
            for m in metrics:
                lane = db.query(Lane).filter(Lane.id == m.lane_id).first()
                j_name = db.query(Junction).filter(Junction.id == lane.junction_id).first().name if lane else "Unknown"
                writer.writerow([
                    m.id,
                    m.lane_id,
                    j_name,
                    m.timestamp.isoformat(),
                    m.vehicle_count,
                    m.queue_length_m,
                    m.occupancy_ratio,
                    m.average_speed_kmh,
                ])
        filename = f"erakshak_metrics_{p.slug}.csv"

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/preview")
async def preview_report_data(
    period: PeriodKey = "previous_week",
    start: Optional[date] = None,
    end: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Returns verified numerical aggregates for UI preview before download."""
    try:
        p = resolve_period(period, start=start, end=end)
    except PeriodError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    stats = await run_in_threadpool(aggregate, db, p)
    return stats
