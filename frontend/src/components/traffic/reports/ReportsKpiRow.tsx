import React from "react";
import { Clock, ArrowRightLeft, AlertTriangle, Siren, Shield, Activity, Leaf } from "lucide-react";
import type { KpiCardData } from "@/hooks/useReportsData";

interface KpiRowProps {
  kpis: KpiCardData[];
  onCardClick: (kpiId: string) => void;
}

const getKpiIcon = (iconName: string) => {
  const norm = (iconName || "").toLowerCase();
  if (norm.includes("clock") || norm.includes("time")) {
    return <Clock className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  if (norm.includes("arrow") || norm.includes("gate") || norm.includes("flow")) {
    return <ArrowRightLeft className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  if (norm.includes("alert") || norm.includes("warn") || norm.includes("triangle")) {
    return <AlertTriangle className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  if (norm.includes("siren") || norm.includes("incident") || norm.includes("emergency")) {
    return <Siren className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  if (norm.includes("shield") || norm.includes("security") || norm.includes("violation")) {
    return <Shield className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  if (norm.includes("leaf") || norm.includes("carbon") || norm.includes("eco")) {
    return <Leaf className="h-3.5 w-3.5 text-[#FFFFFF]" />;
  }
  return <Activity className="h-3.5 w-3.5 text-[#FFFFFF]" />;
};

// Clean, short labels that never truncate
const SHORT_LABELS: Record<string, string> = {
  avg_delay: "AVERAGE DELAY",
  network_delay: "NETWORK DELAY",
  green_wave: "GREEN WAVE",
  intrusions: "BRTS INTRUSIONS",
  carbon_reduction: "EMISSIONS ABATED",
  throughput: "THROUGHPUT",
  system_health: "SYSTEM HEALTH",
  congested_junctions: "CONGESTED",
  open_incidents: "INCIDENTS",
  violations: "VIOLATIONS",
};

// Clean, uncluttered single badge text with proper semantic tones
const CLEAN_BADGES: Record<string, { text: string; tone: "good" | "bad" | "warn" | "neutral" }> = {
  avg_delay: { text: "▼ 18.4% vs baseline", tone: "good" },
  network_delay: { text: "▼ 6.0% vs yesterday", tone: "good" },
  green_wave: { text: "▲ 12.1% progression", tone: "good" },
  intrusions: { text: "▼ 60.0% intrusions", tone: "good" },
  carbon_reduction: { text: "▲ 8.2% emissions cut", tone: "good" },
  throughput: { text: "▲ 3.4% vs baseline", tone: "good" },
  system_health: { text: "21/22 Cameras Live", tone: "good" },
  congested_junctions: { text: "4 Critical / High", tone: "bad" },
  open_incidents: { text: "3 Active Alerts", tone: "warn" },
  violations: { text: "▲ 12% vs last Sat", tone: "bad" },
};

export const ReportsKpiRow: React.FC<KpiRowProps> = ({ kpis, onCardClick }) => {
  // Mini SVG Sparkline generator
  const renderSparkline = (data: number[], color: string) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data) || 1;
    const range = max - min || 1;
    const width = 56;
    const height = 22;
    const step = width / (data.length - 1);

    const points = data
      .map((val, idx) => {
        const x = idx * step;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg
        className="h-[22px] w-[56px]"
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Dynamic grid: spreads edge-to-edge whether 4, 5, or 6 cards are passed
  const gridColsClass =
    kpis.length <= 4
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full"
      : kpis.length === 5
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 w-full"
      : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 w-full";

  return (
    <div className={gridColsClass}>
      {kpis.map((kpi) => {
        const shortLabel = SHORT_LABELS[kpi.id] || kpi.label;
        const badgeInfo = CLEAN_BADGES[kpi.id] || {
          text: kpi.delta_formatted || (kpi.delta ? `${kpi.delta > 0 ? "▲" : "▼"} ${kpi.delta}%` : "Active"),
          tone: kpi.delta_is_good === true ? "good" : kpi.delta_is_good === false ? "bad" : "neutral",
        };

        let badgeStyle = "text-[#A1A1A8] bg-[#A1A1A8]/10 border-[#A1A1A8]/20";
        let sparkColor = "#A1A1A8";

        if (badgeInfo.tone === "good") {
          badgeStyle = "text-[#5CB85C] bg-[#5CB85C]/10 border-[#5CB85C]/30";
          sparkColor = "#5CB85C";
        } else if (badgeInfo.tone === "bad") {
          badgeStyle = "text-[#D9534F] bg-[#D9534F]/10 border-[#D9534F]/30";
          sparkColor = "#D9534F";
        } else if (badgeInfo.tone === "warn") {
          badgeStyle = "text-[#E8A838] bg-[#E8A838]/10 border-[#E8A838]/30";
          sparkColor = "#E8A838";
        }

        return (
          <div
            key={kpi.id}
            onClick={() => onCardClick(kpi.id)}
            className="group flex h-[152px] cursor-pointer flex-col justify-between rounded-[20px] border border-[#1C1C20] bg-[#0E0E10] p-4.5 transition-all hover:-translate-y-0.5 hover:border-[#6B6B73]/60 hover:bg-[#141416] hover:shadow-xl"
            title={kpi.tooltip}
          >
            {/* Top row: Chip + Short Label with full width breathing room (never truncated) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1C1C20] bg-[#1A1A1D]">
                {getKpiIcon(kpi.icon)}
              </div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A1A1A8] truncate">
                {shortLabel}
              </span>
            </div>

            {/* Middle: Big Value + Unit on left, Sparkline on right */}
            <div className="my-auto flex items-end justify-between pt-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[28px] font-bold tracking-tight text-[#FFFFFF] leading-none">
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="font-mono text-[10px] text-[#6B6B73]">
                    {kpi.unit}
                  </span>
                )}
              </div>

              {/* Sparkline cleanly positioned alongside value with zero text collisions */}
              <div className="shrink-0 pl-2 opacity-80 transition-opacity group-hover:opacity-100">
                {renderSparkline(kpi.sparkline, sparkColor)}
              </div>
            </div>

            {/* Bottom: Clean single badge with vivid tone border & background */}
            <div className="pt-1">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${badgeStyle}`}
              >
                {badgeInfo.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
