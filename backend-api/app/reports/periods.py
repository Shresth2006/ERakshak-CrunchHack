# backend-api/app/reports/periods.py
"""
periods.py — Time-Window & Period Resolution Engine (IST-Aware)
==============================================================
Provides robust, timezone-accurate resolution of reporting periods
(previous week, previous month, last 7/30 days, custom ranges).
Guarantees exclusive end timestamps and paired comparison baselines.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc
MAX_RANGE_DAYS = 366


class PeriodError(ValueError):
    """Raised when an invalid period, date range, or parameter combination is supplied."""
    pass


@dataclass(frozen=True)
class ReportPeriod:
    """Represents a validated report time-window in both local IST and UTC."""
    key: str
    label: str                 # e.g., "Previous month (01 Sep 2026 – 30 Sep 2026)"
    start_local: date          # inclusive local date
    end_local: date            # inclusive local date (for UI display & titles)
    start_utc: datetime        # inclusive UTC timestamp for DB queries
    end_utc: datetime          # EXCLUSIVE UTC timestamp for DB queries
    days: int
    prev_start_utc: datetime   # comparison baseline window of matching length
    prev_end_utc: datetime     # exclusive baseline end
    label_option: str = ""     # e.g., "Last 7 days (today partial)"

    @property
    def slug(self) -> str:
        """Filesystem-safe identifier for file naming and caching."""
        return f"{self.key}_{self.start_local.isoformat()}_to_{self.end_local.isoformat()}"


def _to_utc_start(d: date) -> datetime:
    """Converts a local IST date at 00:00:00 to UTC."""
    return datetime.combine(d, time.min, tzinfo=IST).astimezone(UTC)


def resolve_period(
    period: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    now: Optional[datetime] = None,
) -> ReportPeriod:
    """Resolves period string into exact UTC start/end boundaries."""
    now_dt = now or datetime.now(IST)
    today = now_dt.astimezone(IST).date()

    if period == "previous_week":
        # Monday of current week
        this_monday = today - timedelta(days=today.weekday())
        # Previous week: Monday to Sunday
        s = this_monday - timedelta(days=7)
        e_excl = this_monday
        opt_label = "Previous week (Mon–Sun)"
    elif period == "previous_month":
        first_this_month = today.replace(day=1)
        last_prev_month = first_this_month - timedelta(days=1)
        s = last_prev_month.replace(day=1)
        e_excl = first_this_month
        opt_label = "Previous month"
    elif period == "last_7_days":
        e_excl = today + timedelta(days=1)
        s = e_excl - timedelta(days=7)
        opt_label = "Last 7 days (today partial)"
    elif period == "last_30_days":
        e_excl = today + timedelta(days=1)
        s = e_excl - timedelta(days=30)
        opt_label = "Last 30 days"
    elif period == "custom":
        if not start or not end:
            raise PeriodError("Custom period requires both start and end dates.")
        if start > end:
            raise PeriodError(f"Start date ({start}) must be on or before end date ({end}).")
        if end > today:
            raise PeriodError(f"End date ({end}) cannot be in the future (today is {today}).")
        s = start
        e_excl = end + timedelta(days=1)
        opt_label = "Custom range"
    else:
        raise PeriodError(
            f"Unknown period identifier: '{period}'. Supported: previous_week, previous_month, last_7_days, last_30_days, custom."
        )

    days = (e_excl - s).days
    if days <= 0:
        raise PeriodError("Period must cover at least 1 full day.")
    if days > MAX_RANGE_DAYS:
        raise PeriodError(f"Selected range ({days} days) exceeds maximum allowed range of {MAX_RANGE_DAYS} days.")

    end_incl = e_excl - timedelta(days=1)
    prev_s = s - timedelta(days=days)

    if period == "previous_month":
        label = f"Previous Month ({s:%d %b %Y} – {end_incl:%d %b %Y})"
    elif period == "previous_week":
        label = f"Previous Week ({s:%d %b %Y} – {end_incl:%d %b %Y})"
    else:
        label = f"{s:%d %b %Y} – {end_incl:%d %b %Y}"

    return ReportPeriod(
        key=period,
        label=label,
        start_local=s,
        end_local=end_incl,
        start_utc=_to_utc_start(s),
        end_utc=_to_utc_start(e_excl),
        days=days,
        prev_start_utc=_to_utc_start(prev_s),
        prev_end_utc=_to_utc_start(s),
        label_option=opt_label,
    )
