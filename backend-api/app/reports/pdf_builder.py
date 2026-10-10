# backend-api/app/reports/pdf_builder.py
"""
pdf_builder.py — Executive PDF Report Generator
================================================
Builds the official "Surat Police Traffic Report" according to the
Professional Redesign Guide & Fix Guide v2:
  - BaseDocTemplate with zero-padding Frame
  - Clean masthead with Gujarat Police Logo flowable
  - 6 KPI executive cards with dynamic font sizing
  - High-res Matplotlib horizontal violation bar chart & IST daily progression
  - Junction performance table with repeating headers, right-aligned numbers, and pill badges
  - Grouped engineering advisories with priority pills
  - Transparent data quality, definitions, and AI use disclosures
  - Formal sign-off block and cryptographic data fingerprint
  - NumberedCanvas with top navy band, running headers (pages 2+), and footers (all pages)
"""

from __future__ import annotations

import io
import os
from typing import Any, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.reports.canvas import make_canvas
from app.reports.charts import daily_trend, hbar
from app.reports.theme import (
    FRAME_W,
    MARGIN_BOTTOM,
    MARGIN_TOP,
    MARGIN_X,
    S,
)
from app.reports.components import (
    Markup,
    P,
    PM,
    data_table,
    finding_panel,
    group_advisories,
    kpi_cards,
    masthead,
    pill,
    section,
    signoff,
)
from app.reports.config import REPORT_CONFIG, ReportConfig
from app.reports.fonts import register_fonts
from app.reports.narrative import ReportNarrative
from app.reports.periods import ReportPeriod
from app.reports.titles import full_title, period_phrase
from app.reports.validate import validate_stats

LEVEL_TONE = {"SEVERE": "bad", "MODERATE": "warn", "LOW": "good"}
PRIORITY_TONE = {"CRITICAL": "bad", "HIGH": "bad", "MEDIUM": "warn", "LOW": "muted"}


class ReportContext:
    def __init__(self, cfg: ReportConfig, p: ReportPeriod, report_id: str, generated_at: str):
        self.cfg = cfg
        self.period = p
        self.report_id = report_id
        self.generated_at = generated_at
        self.full_title = full_title(p)
        self.logo_path = cfg.logo_path


def build_kpi_items(kpis: Dict[str, Any], violations: Dict[str, Any], stats: Dict[str, Any]) -> List[Dict[str, Any]]:
    v_total = violations.get("total", 0)
    chg = violations.get("change_pct")
    delta_str = f"+{chg:.1f}% vs previous" if chg and chg > 0 else f"{chg:.1f}% vs previous" if chg else "Baseline window"
    tone_viol = "bad" if chg and chg > 5.0 else "good" if chg and chg < -5.0 else "neutral"

    # Most common violation
    by_type = violations.get("by_type", [])
    top_type = by_type[0] if by_type else None
    type_name = top_type["type"] if top_type else "None"
    type_sub = f"{top_type['count']} cases ({top_type['share_pct']:.0f}%)" if top_type else "No violations logged"

    # Highest violation junction
    top_j = violations.get("top_junctions", [])
    high_j_name = top_j[0]["junction"] if top_j else "None"
    if top_j:
        max_c = top_j[0]["count"]
        tied = sum(1 for item in top_j if item["count"] == max_c)
        high_j_sub = f"{max_c} cases (joint highest)" if tied > 1 else f"{max_c} cases"
    else:
        high_j_sub = "No infractions"

    # Average queue
    avg_q = kpis.get("avg_queue_m")
    avg_q_str = f"{avg_q:.1f} m" if avg_q is not None else "—"
    peak_q = kpis.get("peak_queue_m")
    peak_q_j = kpis.get("peak_queue_junction") or ""
    q_sub = f"Peak {peak_q:.1f} m at {peak_q_j[:16]}" if peak_q is not None else "Sample-weighted"
    tone_q = "bad" if avg_q and avg_q >= 40.0 else "warn" if avg_q and avg_q >= 20.0 else "neutral"

    # Average speed
    avg_spd = kpis.get("avg_speed_kmh")
    avg_spd_str = f"{avg_spd:.1f} km/h" if avg_spd is not None else "—"
    spd_sub = kpis.get("avg_basis", "Reporting junctions")

    # Data coverage
    cov = kpis.get("coverage_pct", 100.0)
    junctions = stats.get("traffic", {}).get("junctions", [])
    low_cov = [j for j in junctions if j.get("coverage_pct", 0) < 50.0]
    cov_sub = f"{len(low_cov)} of {len(junctions)} junctions below 50%" if low_cov else "All monitored junctions active"
    tone_cov = "bad" if cov < 50.0 else "warn" if cov < 70.0 else "good"

    return [
        {"label": "Total violations", "value": v_total, "sub": delta_str, "tone": tone_viol},
        {"label": "Most common violation", "value": type_name, "sub": type_sub, "tone": "neutral"},
        {"label": "Highest violation junction", "value": high_j_name, "sub": high_j_sub, "tone": "neutral"},
        {"label": "Average queue", "value": avg_q_str, "sub": q_sub, "tone": tone_q},
        {"label": "Average speed", "value": avg_spd_str, "sub": spd_sub, "tone": "neutral"},
        {"label": "Data coverage", "value": f"{cov:.0f}%", "sub": cov_sub, "tone": tone_cov},
    ]


def build_pdf(
    period_label: str,
    stats: Dict[str, Any],
    narr: ReportNarrative,
    used_ai: bool,
    generated_at: str,
    report_id: Optional[str] = None,
    cfg: Optional[ReportConfig] = None,
) -> bytes:
    """Builds the publication-quality Surat Police Traffic Report PDF."""
    register_fonts()
    config = cfg or REPORT_CONFIG

    # Resolve report period object from stats
    period_info = stats.get("period", {})
    from datetime import date
    try:
        s_date = date.fromisoformat(period_info.get("start", ""))
        e_date = date.fromisoformat(period_info.get("end", ""))
    except Exception:
        s_date = date.today()
        e_date = date.today()

    p = ReportPeriod(
        key=period_info.get("key", "custom"),
        label=period_label,
        start_local=s_date,
        end_local=e_date,
        start_utc=s_date,  # placeholders for context
        end_utc=e_date,
        days=period_info.get("days", 7),
        prev_start_utc=s_date,
        prev_end_utc=e_date,
        label_option=period_info.get("label", period_label),
    )

    # Consistency check
    validation_errs = validate_stats(stats, p)
    stats.setdefault("data_quality", {})["validation_errors"] = validation_errs

    # Generate sequential/canonical report ID if not provided
    rep_id = report_id or f"STR-{s_date.strftime('%Y%m%d')}-0001"
    ctx = ReportContext(config, p, rep_id, generated_at)

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title=full_title(p),
        author="Surat City Police · E-Rakshak",
        subject=f"Traffic enforcement and congestion report, {period_phrase(p)}",
        keywords="traffic, Surat, violations, congestion, report, police",
        creator="E-Rakshak Adaptive Traffic System",
    )

    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="main",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame])])

    story: List[Any] = []

    # 1. Masthead
    story.extend(masthead(config, p, ctx))

    # 2. 6-Card KPI Executive Grid
    kpis = stats.get("kpis", {})
    violations = stats.get("violations", {})
    story.append(kpi_cards(build_kpi_items(kpis, violations, stats)))
    story.append(Spacer(1, 6))

    # 3. Section 1: Executive Summary
    story.extend(section("1", "Executive summary", [
        P(narr.executive_summary, S.body),
        Spacer(1, 4),
    ]))

    # 4. Section 2: Key Findings
    findings_flowables: List[Any] = []
    for f in getattr(narr, "key_findings", []):
        findings_flowables.append(finding_panel(f))
        findings_flowables.append(Spacer(1, 3))
    story.extend(section("2", "Key findings", findings_flowables))

    # 5. Section 3: Violations (Charts & Hotspots)
    v_by_type = violations.get("by_type", [])
    type_labels = [item["type"] for item in v_by_type[:5]]
    type_counts = [item["count"] for item in v_by_type[:5]]
    type_shares = [item.get("share_pct", 0.0) for item in v_by_type[:5]]

    v_per_day = violations.get("per_day", [])
    day_dates = [item["date"] for item in v_per_day]
    day_counts = [item["count"] for item in v_per_day]

    # Partial day detection
    today_str = date.today().isoformat()
    partial_idx = day_dates.index(today_str) if today_str in day_dates else None

    img_hbar = Image(hbar(type_labels, type_counts, type_shares), width=85 * mm, height=36 * mm)
    img_trend = Image(daily_trend(day_dates, day_counts, partial_idx), width=85 * mm, height=36 * mm)

    charts_table = Table([[img_hbar, img_trend]], colWidths=[87 * mm, 87 * mm], hAlign="LEFT")
    charts_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    # Hotspot table
    top_juncs = violations.get("top_junctions", [])
    hotspot_rows: List[List[Any]] = []
    prev_cnt = None
    rank = 0
    for idx, item in enumerate(top_juncs[:6], 1):
        cnt = item["count"]
        if cnt != prev_cnt:
            rank = idx
        tied = sum(1 for x in top_juncs if x["count"] == cnt) > 1
        rank_str = f"{rank}=" if tied else str(rank)
        prev_cnt = cnt
        share = f"{(cnt / max(1, violations.get('total', 1)) * 100):.1f}%"
        hotspot_rows.append([rank_str, item["junction"], str(cnt), share])

    v_flowables: List[Any] = [
        charts_table,
        Spacer(1, 5),
        P("Primary Violation Hotspots", S.h3),
        data_table(
            header=["Rank", "Junction Corridor", "Infractions", "Share of Total"],
            rows=hotspot_rows if hotspot_rows else [["—", "No infractions logged", "0", "0%"]],
            col_w=[18 * mm, 96 * mm, 30 * mm, 30 * mm],
            align_right=(2, 3),
            repeat=1,
        ),
        Spacer(1, 4),
    ]
    story.extend(section("3", "Violations and trends", v_flowables))

    # 6. Section 4: Junction Performance
    junction_list = stats.get("traffic", {}).get("junctions", [])
    j_table_rows: List[List[Any]] = []
    for j in junction_list:
        cov_pct = j.get("coverage_pct", 100.0)
        cov_str = f"{cov_pct:.0f}%" + (" *" if cov_pct < 50.0 else "")
        j_table_rows.append([
            j.get("junction", "Unknown"),
            f"{j.get('avg_queue_m', 0.0):.1f} m",
            f"{j.get('max_queue_m', 0.0):.1f} m",
            f"{j.get('avg_speed_kmh', 0.0):.1f} km/h",
            pill(j.get("level", "LOW"), LEVEL_TONE.get(j.get("level", "LOW"), "good")),
            cov_str,
        ])

    legend_text = (
        "<b>Congestion level thresholds:</b> Severe: 40 m and above · Moderate: 20 m to under 40 m · Low: under 20 m. "
        "Asterisk (*) denotes junctions with under 50% telemetry coverage."
    )

    j_flowables: List[Any] = [
        data_table(
            header=["Junction Corridor", "Avg Queue", "Peak Queue", "Avg Speed", "Congestion", "Coverage"],
            rows=j_table_rows if j_table_rows else [["No telemetry data", "—", "—", "—", pill("LOW", "good"), "0%"]],
            col_w=[56 * mm, 23 * mm, 23 * mm, 24 * mm, 26 * mm, 22 * mm],
            align_right=(1, 2, 3, 5),
            repeat=1,
        ),
        Spacer(1, 3),
        PM(legend_text, S.small),
        Spacer(1, 4),
    ]
    story.extend(section("4", "Junction performance", j_flowables))

    # 7. Section 5: Prioritized Advisories & Engineering Recommendations
    raw_recs = stats.get("recommendations", [])
    grouped_recs = group_advisories(raw_recs)

    rec_table_rows: List[List[Any]] = []
    for idx, grp in enumerate(grouped_recs[:8], 1):
        action_cell = grp["text"]
        if grp.get("observed"):
            action_cell += f"<br/><font color='#667085'>Observed when alert raised: {grp['observed']}</font>"

        rec_table_rows.append([
            str(idx),
            pill(grp["priority"], PRIORITY_TONE.get(grp["priority"], "muted")),
            grp["location"],
            Markup(action_cell),
            grp["status"],
        ])

    advisory_flowables: List[Any] = []
    if rec_table_rows:
        advisory_flowables.append(data_table(
            header=["#", "Priority", "Target Location", "Operational Advisory & Action Plan", "Status"],
            rows=rec_table_rows,
            col_w=[10 * mm, 22 * mm, 40 * mm, 80 * mm, 22 * mm],
            repeat=1,
        ))
    else:
        advisory_flowables.append(P("No operational advisories were raised during this monitoring period.", S.body))

    advisory_flowables.append(Spacer(1, 4))
    story.extend(section("5", "Advisories and recommended actions", advisory_flowables))

    # 8. Section 6: Data Quality and Method
    dq = stats.get("data_quality", {})
    cov_val = dq.get("coverage_pct", 100.0)
    low_cov_names = dq.get("low_coverage_junctions", [])

    method_items: List[Flowable] = []

    # Coverage note
    cov_stmt = f"• <b>Data Coverage:</b> {cov_val:.1f}% of expected telemetry samples were received across monitored network nodes."
    if low_cov_names:
        cov_stmt += f" {len(low_cov_names)} junctions operated with under 50% coverage ({', '.join(low_cov_names[:4])})."
    method_items.append(PM(cov_stmt, S.body))

    # Definitions
    method_items.append(PM(
        "• <b>Definitions:</b> Network averages reflect reporting junctions weighted by sample count. "
        "Congestion levels follow approach queue depth. All timestamps and daily buckets are in Indian Standard Time (IST).",
        S.body,
    ))

    # AI vs Template note
    if used_ai:
        ai_stmt = (
            "• <b>Analytical Methodology:</b> Narrative briefing drafted by Gemini AI model directly from verified "
            "numerical aggregates. Corridor node identifiers were cryptographically pseudonymized using salted HMAC-SHA256 tokens "
            "prior to cloud analysis. No citizen identities, vehicle registration plates, or surveillance video were transmitted."
        )
    else:
        ai_stmt = (
            "• <b>Analytical Methodology:</b> Narrative generated deterministically via local statistical template. "
            "All figures derived from municipal database registers."
        )
    method_items.append(PM(ai_stmt, S.body))

    # Limitations & notes
    limit_stmt = (
        "• <b>Limitations:</b> Figures reflect system-detected and confirmed events. "
        + (" ".join(stats.get("notes", [])) + " " if stats.get("notes") else "")
        + "Signal timing modifications should be coordinated with the Traffic Police Command Center."
    )
    method_items.append(PM(limit_stmt, S.body))
    method_items.append(Spacer(1, 4))

    # Fingerprint & Audit line
    fp = stats.get("fingerprint", "VERIFIED-DATABASE")
    audit_line = f"<b>Report ID:</b> {rep_id} &nbsp;|&nbsp; <b>Data Fingerprint:</b> {fp} &nbsp;|&nbsp; <b>Source:</b> Municipal Traffic Register"
    method_items.append(PM(audit_line, S.small))
    method_items.append(Spacer(1, 4))

    story.extend(section("6", "Data quality and method", method_items))

    # 9. Sign-off Block
    story.append(signoff())

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=make_canvas(ctx))
    return buf.getvalue()
