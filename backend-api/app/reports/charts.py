# backend-api/app/reports/charts.py
"""
Matplotlib chart generation for PDF reports.
Always closes figures to prevent memory leaks across requests.
"""

from __future__ import annotations

import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from pathlib import Path
from typing import List, Optional

FONT_DIR = Path(__file__).parent / "assets" / "fonts"
for font_file in FONT_DIR.glob("*.ttf"):
    try:
        font_manager.fontManager.addfont(str(font_file))
    except Exception:
        pass

NAVY = "#12284C"
STEEL = "#3E5C76"
GOLD = "#B8902F"
RED = "#B42318"

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.size": 8,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": "#98A2B3",
    "axes.labelcolor": "#475467",
    "xtick.color": "#475467",
    "ytick.color": "#475467",
    "axes.grid": True,
    "grid.color": "#E4E7EC",
    "grid.linewidth": 0.6,
    "axes.axisbelow": True,
})

def _png(fig: plt.Figure, dpi: int = 220) -> io.BytesIO:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf

def hbar(labels: List[str], values: List[int], share: Optional[List[float]] = None) -> io.BytesIO:
    """Horizontal bar chart for violations by type."""
    if not labels or not values:
        fig, ax = plt.subplots(figsize=(5.6, 2.0))
        ax.text(0.5, 0.5, "No violations recorded", ha="center", va="center", color="#667085", fontsize=9)
        ax.axis("off")
        return _png(fig)

    fig, ax = plt.subplots(figsize=(5.6, max(1.8, 0.38 * len(labels) + 0.5)))
    y = list(range(len(labels)))
    bars = ax.barh(y, values, color=NAVY, height=0.55)
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=8)
    ax.invert_yaxis()
    ax.grid(axis="y", visible=False)
    ax.set_xlabel("Violations", fontsize=8)

    label_texts = []
    for idx, (v, s) in enumerate(zip(values, share or values)):
        if share:
            label_texts.append(f"{v} ({s:.0f}%)")
        else:
            label_texts.append(f"{v}")

    ax.bar_label(bars, labels=label_texts, padding=4, fontsize=7.5, color="#12284C", fontweight="bold")
    return _png(fig)

def daily_trend(dates: List[str], counts: List[int], partial_idx: Optional[int] = None) -> io.BytesIO:
    """Daily violations progression line chart."""
    if not dates or not counts:
        fig, ax = plt.subplots(figsize=(5.6, 2.2))
        ax.text(0.5, 0.5, "No temporal data recorded", ha="center", va="center", color="#667085", fontsize=9)
        ax.axis("off")
        return _png(fig)

    fig, ax = plt.subplots(figsize=(5.6, 2.2))
    x_indices = list(range(len(dates)))
    ax.plot(x_indices, counts, color=NAVY, linewidth=1.8, marker="o", markersize=4)

    # Highlight peak
    if counts and max(counts) > 0:
        max_idx = counts.index(max(counts))
        ax.plot([max_idx], [counts[max_idx]], marker="o", markersize=6, color=RED)
        ax.annotate(
            f"Peak {counts[max_idx]}",
            (max_idx, counts[max_idx]),
            textcoords="offset points",
            xytext=(0, 7),
            ha="center",
            fontsize=7.5,
            fontweight="bold",
            color=RED,
        )

    # If today is partial
    if partial_idx is not None and 0 <= partial_idx < len(dates):
        ax.plot([partial_idx], [counts[partial_idx]], marker="s", markersize=5, color=GOLD)
        ax.annotate(
            "Partial",
            (partial_idx, counts[partial_idx]),
            textcoords="offset points",
            xytext=(0, -12),
            ha="center",
            fontsize=6.5,
            color=GOLD,
        )

    ax.set_ylim(bottom=0)
    ax.set_xticks(x_indices)
    # Format dates as 'DD Mon'
    formatted_dates = []
    for d in dates:
        parts = d.split("-")
        if len(parts) == 3:
            formatted_dates.append(f"{parts[2]}/{parts[1]}")
        else:
            formatted_dates.append(d)
    ax.set_xticklabels(formatted_dates, rotation=0, fontsize=7.5)
    ax.set_ylabel("Daily Violations", fontsize=8)
    return _png(fig)
