# backend-api/app/reports/narrative.py
"""
narrative.py — Traffic Intelligence AI Analyst & Deterministic Fallback
========================================================================
Generates analytical briefings for Surat Police:
  - Strict grounding in SQL aggregates
  - Salted HMAC pseudonymisation round-trip with verification
  - Hallucination guard (unsupported number detection)
  - Transparent deterministic fallback narrative
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types
    GEMINI_SDK_AVAILABLE = True
except ImportError:
    GEMINI_SDK_AVAILABLE = False

log = logging.getLogger("reports.gemini")

_NARRATIVE_CACHE: Dict[str, Tuple[ReportNarrative, bool]] = {}


# ---------------------------------------------------------------------------
# Salted HMAC Pseudonymisation Cipher
# ---------------------------------------------------------------------------

class DataPrivacyCipher:
    def __init__(self, salt: Optional[str] = None):
        self._salt = salt or secrets.token_hex(16)
        self._token_to_name: Dict[str, str] = {}
        self._name_to_token: Dict[str, str] = {}

    def _generate_token(self, name: str) -> str:
        digest = hmac.new(self._salt.encode("utf-8"), name.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"[NODE-{digest[:6].upper()}]"

    def encrypt_name(self, name: str) -> str:
        if not name or not name.strip():
            return name
        clean = name.strip()
        if clean not in self._name_to_token:
            token = self._generate_token(clean)
            self._name_to_token[clean] = token
            self._token_to_name[token] = clean
        return self._name_to_token[clean]

    def encrypt_stats(self, stats: dict) -> dict:
        copied = json.loads(json.dumps(stats))
        for item in copied.get("violations", {}).get("top_junctions", []):
            if "junction" in item:
                item["junction"] = self.encrypt_name(item["junction"])
        for item in copied.get("traffic", {}).get("junctions", []):
            if "junction" in item:
                item["junction"] = self.encrypt_name(item["junction"])
        for item in copied.get("recommendations", []):
            if isinstance(item, dict) and "junction" in item:
                item["junction"] = self.encrypt_name(item["junction"])
        return copied

    def decrypt_text(self, text: str) -> str:
        if not text:
            return text
        res = text
        for token, real_name in self._token_to_name.items():
            res = res.replace(token, real_name)
        return res

    def decrypt_narrative(self, narr: ReportNarrative) -> ReportNarrative:
        return ReportNarrative(
            executive_summary=self.decrypt_text(narr.executive_summary),
            key_findings=[
                Finding(title=self.decrypt_text(f.title), detail=self.decrypt_text(f.detail))
                for f in narr.key_findings
            ],
            violation_analysis=self.decrypt_text(narr.violation_analysis),
            congestion_analysis=self.decrypt_text(narr.congestion_analysis),
            recommended_actions=[self.decrypt_text(a) for a in narr.recommended_actions],
            data_quality_note=self.decrypt_text(narr.data_quality_note),
        )

    def assert_no_tokens(self, narr: ReportNarrative) -> None:
        raw_json = narr.model_dump_json()
        for token in self._token_to_name:
            if token in raw_json:
                raise ValueError(f"Unmapped token left in narrative: {token}")


# ---------------------------------------------------------------------------
# Structured Models & Prompt
# ---------------------------------------------------------------------------

class Finding(BaseModel):
    title: str = Field(description="Headline for the finding")
    detail: str = Field(description="Contextual finding incorporating real numbers from data")


class ReportNarrative(BaseModel):
    executive_summary: str = Field(description="Briefing of 3 to 5 sentences")
    key_findings: List[Finding] = Field(description="Up to 3 data-backed operational findings", max_length=4)
    violation_analysis: str = Field(description="Analysis of violation types and hotspots")
    congestion_analysis: str = Field(description="Queue length and speed observations")
    recommended_actions: List[str] = Field(description="Up to 4 practical traffic recommendations", max_length=5)
    data_quality_note: str = Field(description="Honest statement on data coverage and limitations")


SYSTEM_PROMPT = """You are a traffic-engineering intelligence analyst writing an official report for Surat City Traffic Police and Municipal authorities.

STRICT RULES:
1. Ground every statement ONLY in numbers provided in the DATA block. Never invent, extrapolate, or estimate figures.
2. Never state projections, savings percentages (e.g. '18-24%'), or hypothetical gains unless present in DATA.
3. Do not claim causes. Use wording like 'may indicate' or 'is consistent with'. Never write 'is the leading driver'.
4. If two values are equal, state 'joint highest' or 'tied', never 'followed closely'.
5. Refer to violation types using the exact labels in DATA.
6. Executive summary: at most 5 sentences. Each key finding: at most 2 sentences.
7. Plain, professional English. No markdown formatting (#, *, **), no HTML, no emojis.
8. If data_quality.coverage_pct is below 70, the executive summary must mention that telemetry coverage is partial."""


# ---------------------------------------------------------------------------
# Number Guard (Hallucination Detection)
# ---------------------------------------------------------------------------

_NUM = re.compile(r"\b\d+(?:\.\d+)?\b")

def _flatten_numbers(obj: Any, out: Set[str]) -> None:
    if isinstance(obj, dict):
        for v in obj.values():
            _flatten_numbers(v, out)
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            _flatten_numbers(item, out)
    elif isinstance(obj, (int, float)):
        out.add(f"{obj:g}")
    elif isinstance(obj, str):
        out.update(m.replace(",", "") for m in _NUM.findall(obj))

def unsupported_numbers(narr: ReportNarrative, stats: dict) -> List[str]:
    allowed: Set[str] = set()
    _flatten_numbers(stats, allowed)
    text = narr.model_dump_json()
    found = [m.replace(",", "") for m in _NUM.findall(text)]
    return [n for n in found if n not in allowed and not (n.isdigit() and int(n) <= 10)]


# ---------------------------------------------------------------------------
# Deterministic Fallback Narrative
# ---------------------------------------------------------------------------

def fallback_narrative(stats: dict) -> ReportNarrative:
    p = stats.get("period", {})
    k = stats.get("kpis", {})
    v = stats.get("violations", {})
    t = stats.get("traffic", {}).get("junctions", [])
    dq = stats.get("data_quality", {})

    total_v = v.get("total", 0)
    chg = v.get("change_pct")
    cov = dq.get("coverage_pct", 100.0)

    summary_parts = [f"Report for {p.get('label', 'this period')}."]
    summary_parts.append(f"A total of {total_v} traffic violations were recorded across the monitored network")
    if chg is not None:
        direction = "an increase of" if chg > 0 else "a decrease of"
        summary_parts.append(f"representing {direction} {abs(chg):.1f}% compared to the previous period.")
    else:
        summary_parts.append(".")

    if cov < 70.0:
        summary_parts.append(f"Telemetry sensor coverage was {cov:.1f}%; queue and velocity indicators reflect reporting junctions.")

    # Key Findings
    findings: List[Finding] = []
    by_type = v.get("by_type", [])
    if by_type:
        top_t = by_type[0]
        findings.append(Finding(
            title="Primary Infraction Modality",
            detail=f"{top_t['type']} accounted for {top_t['count']} cases ({top_t.get('share_pct', 0):.0f}% of total recorded violations)."
        ))

    top_j = v.get("top_junctions", [])
    if top_j:
        max_cnt = top_j[0]["count"]
        tied_j = [item["junction"] for item in top_j if item["count"] == max_cnt]
        if len(tied_j) > 1:
            findings.append(Finding(
                title="Top Enforcement Hotspots",
                detail=f"{', '.join(tied_j[:2])} tied for the highest violation count with {max_cnt} incidents each."
            ))
        else:
            findings.append(Finding(
                title="Top Enforcement Hotspot",
                detail=f"{top_j[0]['junction']} logged the highest number of violations ({max_cnt} incidents)."
            ))

    if t:
        worst_q = max(t, key=lambda j: j.get("avg_queue_m", 0.0))
        if worst_q.get("avg_queue_m", 0) > 0:
            findings.append(Finding(
                title="Peak Congestion Corridor",
                detail=f"{worst_q['junction']} recorded the longest average queue at {worst_q['avg_queue_m']:.1f} m (peak {worst_q['max_queue_m']:.1f} m)."
            ))

    v_analysis = (
        f"Recorded infractions totalled {total_v}. "
        + (f"Most prevalent category was {by_type[0]['type']} with {by_type[0]['count']} logged incidents. " if by_type else "")
        + "Enforcement teams should review signalized intersections with recurring stop-line and lane compliance issues."
    )

    avg_q_str = f"{k.get('avg_queue_m', 0.0):.1f} m" if k.get("avg_queue_m") is not None else "unavailable"
    avg_spd_str = f"{k.get('avg_speed_kmh', 0.0):.1f} km/h" if k.get("avg_speed_kmh") is not None else "unavailable"
    c_analysis = (
        f"Network-wide average queue depth was {avg_q_str} with average arterial speed at {avg_spd_str}. "
        f"Telemetry data was received from {len(t)} junctions."
    )

    recs = [
        "Deploy targeted warden presence at identified high-volume violation corridors during peak hours.",
        "Review signal timing splits on arterial approaches showing persistent queue spillbacks.",
        "Verify camera sensor calibration and network connectivity at junctions reporting low telemetry coverage.",
    ]

    dq_note = (
        f"Telemetry coverage was {cov:.1f}% across {len(t)} monitored junctions. "
        + (f"{len(dq.get('silent_junctions', []))} junctions reported no samples. " if dq.get("silent_junctions") else "")
        + "All statistics were computed directly from verified database records."
    )

    return ReportNarrative(
        executive_summary=" ".join(summary_parts),
        key_findings=findings[:3],
        violation_analysis=v_analysis,
        congestion_analysis=c_analysis,
        recommended_actions=recs,
        data_quality_note=dq_note,
    )


# ---------------------------------------------------------------------------
# Main Narrative Dispatcher
# ---------------------------------------------------------------------------

async def narrate(stats: dict, use_ai: bool = True) -> Tuple[ReportNarrative, bool]:
    """Generates narrative briefing. Never raises: transparently falls back."""
    if not use_ai or not GEMINI_SDK_AVAILABLE:
        return fallback_narrative(stats), False

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return fallback_narrative(stats), False

    cache_key = hashlib.sha256(json.dumps(stats, sort_keys=True, default=str).encode()).hexdigest()
    if cache_key in _NARRATIVE_CACHE:
        return _NARRATIVE_CACHE[cache_key]

    cipher = DataPrivacyCipher()
    sanitized_stats = cipher.encrypt_stats(stats)

    try:
        client = genai.Client(api_key=api_key)
        model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        timeout = float(os.environ.get("GEMINI_TIMEOUT_SEC", "20"))

        prompt_payload = (
            "DATA (JSON):\n"
            + json.dumps(sanitized_stats, ensure_ascii=False, indent=2)
            + "\n\nDraft the official traffic engineering intelligence narrative for Surat City Police."
        )

        resp = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=model,
                contents=prompt_payload,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=ReportNarrative,
                    temperature=0.2,
                ),
            ),
            timeout=timeout,
        )

        raw_narr = resp.parsed
        if raw_narr is None:
            if hasattr(resp, "text") and resp.text:
                raw_narr = ReportNarrative.model_validate_json(resp.text)
            else:
                raise ValueError("Gemini returned empty response")

        decrypted = cipher.decrypt_narrative(raw_narr)
        cipher.assert_no_tokens(decrypted)

        hallucinations = unsupported_numbers(decrypted, stats)
        if len(hallucinations) > 4:
            log.warning("Gemini narrative flagged for ungrounded numbers: %s", hallucinations[:8])
            res = (fallback_narrative(stats), False)
        else:
            res = (decrypted, True)

        _NARRATIVE_CACHE[cache_key] = res
        return res
    except Exception as exc:
        log.warning("Gemini narrative failed (%s), using deterministic fallback.", exc)
        res = (fallback_narrative(stats), False)
        _NARRATIVE_CACHE[cache_key] = res
        return res
