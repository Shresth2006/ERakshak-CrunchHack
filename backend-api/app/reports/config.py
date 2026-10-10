# backend-api/app/reports/config.py
"""
Configuration settings for Surat Police Traffic Reports.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_LOGO = str(Path(__file__).parent / "assets" / "gujarat_police_logo.png")

@dataclass(frozen=True)
class ReportConfig:
    logo_path: str | None = os.getenv("REPORT_LOGO_PATH", DEFAULT_LOGO)
    org_line: str = os.getenv("REPORT_ORG_LINE", "SURAT CITY POLICE · TRAFFIC BRANCH")
    classification: str = os.getenv("REPORT_CLASSIFICATION", "RESTRICTED")
    demo_mode: bool = os.getenv("REPORT_DEMO_MODE", "1") == "1"
    demo_note: str = "Prototype report for demonstration. Not an official Gujarat Police document."
    severe_threshold: float = float(os.getenv("REPORT_SEVERE_QUEUE_M", "40.0"))
    moderate_threshold: float = float(os.getenv("REPORT_MODERATE_QUEUE_M", "20.0"))

REPORT_CONFIG = ReportConfig()
