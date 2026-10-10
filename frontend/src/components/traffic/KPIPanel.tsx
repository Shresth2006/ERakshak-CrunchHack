import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ComposedChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowUpRight, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
import { QUEUE_JUNCTIONS } from "@/lib/mock-traffic";
import { useAnalytics, generateMockCompare } from "@/hooks/useAnalytics";
import type { Kpi } from "@/lib/traffic-types";

// Update colors to the sleek monochrome/subtle palette
const LINE_COLORS = ["#f4f4f5", "#a1a1aa", "#52525b", "#3f3f46", "#27272a"];
const JUNCTION_IDS = ["J001", "J002", "J003"];

function heatColor(v: number): string {
  if (v > 75) return "#ef4444";
  if (v > 55) return "#f59e0b";
  if (v > 35) return "#a1a1aa";
  return "#3f3f46";
}

export function KPIPanel({
  kpis,
  queue,
}: {
  kpis: Kpi[];
  queue: ({ t: string } & Record<string, number | string>)[];
}) {
  const [selectedJunction, setSelectedJunction] = useState<string>("J001");
  const { compareData, fetchCompare, heatmap, recommendations, updateRecStatus } = useAnalytics();

  const handleJunctionSelect = (jId: string) => {
    setSelectedJunction(jId);
    fetchCompare(jId);
  };

  const comparePoints =
    compareData[selectedJunction] && compareData[selectedJunction].length > 0
      ? compareData[selectedJunction]
      : generateMockCompare(selectedJunction);

  return (
    <section className="flex min-w-0 flex-col gap-4">

      {/* KPI Cards */}
      {kpis.filter((k) => (k.key as string) !== "interventions").map((k) => (
        <KpiCard key={k.key} kpi={k} />
      ))}

      {/* Queue Length Chart */}
      <div className="panel-surface min-w-0 p-4 transition-all hover:border-foreground/20">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <div>
            <div className="label-xs text-muted-foreground">Queue length per junction</div>
            <h3 className="text-sm font-semibold mt-1">Last 30 minutes · live</h3>
          </div>
          <span className="num text-[10px] text-foreground bg-foreground/10 px-2 py-1 rounded-full flex items-center gap-1.5 font-semibold">
            <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-foreground" />
            STREAMING
          </span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={queue} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                {QUEUE_JUNCTIONS.map((j, i) => (
                  <linearGradient key={j.id} id={"qg-" + j.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={34} />
              <Tooltip 
                contentStyle={{ background: "rgba(9, 9, 11, 0.9)", backdropFilter: "blur(8px)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11, boxShadow: "0 12px 24px rgba(0,0,0,0.5)" }} 
                labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 600 }} 
                itemStyle={{ padding: 0 }}
              />
              {QUEUE_JUNCTIONS.map((j, i) => (
                <Area key={j.id} type="monotone" dataKey={j.id} name={j.name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2}
                  fill={"url(#qg-" + j.id + ")"} dot={false} isAnimationActive={true} animationDuration={600} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {QUEUE_JUNCTIONS.map((j, i) => (
            <span key={j.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
              {j.name.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Fixed vs Adaptive Comparison */}
      <div className="panel-surface min-w-0 p-4 transition-all hover:border-foreground/20">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <div>
            <div className="label-xs text-muted-foreground">Adaptive vs Fixed Signal Timing</div>
            <h3 className="text-sm font-semibold mt-1">Wait time · seconds</h3>
          </div>
          <div className="flex gap-1 bg-panel-raised p-1 rounded-lg border border-border">
            {JUNCTION_IDS.map((jId) => (
              <button key={jId} onClick={() => handleJunctionSelect(jId)}
                className={"num text-[10px] px-2.5 py-1 rounded-md transition-all font-semibold " +
                  (selectedJunction === jId ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground")}>
                {jId}
              </button>
            ))}
          </div>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comparePoints} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="adapt-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={34} domain={[0, 'auto']} />
              <Tooltip 
                contentStyle={{ background: "rgba(9, 9, 11, 0.9)", backdropFilter: "blur(8px)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11, boxShadow: "0 12px 24px rgba(0,0,0,0.5)" }} 
                labelStyle={{ display: "none" }}
                formatter={(v: any) => [Math.round(v) + "s"]} 
              />
              <Area type="monotone" dataKey="fixed" name="Fixed Timing" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="adaptive" name="Adaptive (Max-Pressure)" stroke="#ffffff" strokeWidth={2.5} fill="url(#adapt-grad)" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-[10px] text-foreground font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-foreground inline-block" />Adaptive</span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 inline-block" />Fixed</span>
          {comparePoints.length > 1 && (() => {
            const last = comparePoints[comparePoints.length - 1];
            if (!last || last.fixed === 0) return null;
            const saving = Math.round(((last.fixed - last.adaptive) / last.fixed) * 100);
            return saving > 0 ? <span className="ml-auto num text-[11px] text-foreground bg-foreground/10 px-2 py-0.5 rounded-full font-bold">-{saving}% wait saved</span> : null;
          })()}
        </div>
      </div>

      {/* Hourly Heatmap */}
      <div className="panel-surface min-w-0 p-4 transition-all hover:border-foreground/20">
        <div className="mb-4">
          <div className="label-xs text-muted-foreground">City-wide Congestion Heatmap</div>
          <h3 className="text-sm font-semibold mt-1">Junction × Hour · vehicle density</h3>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[280px]">
            <div className="flex items-center gap-1 mb-2 pl-[84px]">
              {[0,4,8,12,16,20].map(h => (
                <div key={h} className="num text-[9px] font-semibold text-muted-foreground flex-1">{h}h</div>
              ))}
            </div>
            {heatmap.slice(0, 7).map(row => (
              <div key={row.id} className="flex items-center gap-1 mb-1">
                <div className="label-xs text-[9px] font-medium truncate shrink-0" style={{ width: 80 }}>{row.junction}</div>
                {row.hours.map((v, h) => (
                  <div key={h}
                    title={row.junction + " " + h + ":00 — " + v}
                    className="heatmap-cell flex-1 rounded-sm"
                    style={{ height: 12, backgroundColor: heatColor(v), opacity: 0.15 + (v / 100) * 0.85, minWidth: 6 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor:"#3f3f46"}} />Low</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor:"#a1a1aa"}} />Moderate</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor:"#f59e0b"}} />High</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor:"#ef4444"}} />Critical</span>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="panel-surface min-w-0 p-4 transition-all hover:border-foreground/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="label-xs text-muted-foreground">AI Recommendations</div>
              <h3 className="text-sm font-semibold mt-1">{recommendations.filter(r => r.status === "pending").length} pending actions</h3>
            </div>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {recommendations.slice(0, 6).map(rec => (
              <div key={rec.id} className={"rec-card severity-" + rec.severity + " relative overflow-hidden"}>
                <div className="flex items-start justify-between gap-3 mb-1.5 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={"num text-[9px] font-bold px-2 py-0.5 rounded-full " +
                        (rec.severity === "high" ? "bg-crit/20 text-crit" :
                         rec.severity === "medium" ? "bg-warn/20 text-warn" : "bg-ok/20 text-ok")}>
                        {rec.severity.toUpperCase()}
                      </span>
                      <span className="label-xs text-[10px] text-foreground">{rec.issue_type?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">{rec.suggested_action || rec.description}</p>
                  </div>
                  {rec.status === "pending" ? (
                    <div className="flex gap-1.5 shrink-0 bg-background/50 backdrop-blur-sm p-1 rounded-lg border border-border/50">
                      <button onClick={() => updateRecStatus(rec.id, "applied")} title="Apply"
                        className="grid h-6 w-6 place-items-center rounded-md text-foreground hover:bg-foreground hover:text-background transition-colors">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => updateRecStatus(rec.id, "dismissed")} title="Dismiss"
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-panel transition-colors">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={"num text-[9px] px-2 py-1 rounded-md font-bold " + (rec.status === "applied" ? "bg-foreground/10 text-foreground" : "bg-border/50 text-muted-foreground")}>
                      {rec.status.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="label-xs text-[9px] text-muted-foreground/60 relative z-10">{rec.junction_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  // Update border styles to be monochrome
  const borderClass = kpi.baselineTone === "ok" ? "border-l-[3px] border-l-foreground" : kpi.baselineTone === "warn" ? "border-l-[3px] border-l-warn" : "border-l-[3px] border-l-crit";
  const badgeClass = kpi.baselineTone === "ok" ? "bg-foreground/10 text-foreground" : kpi.baselineTone === "warn" ? "bg-warn/15 text-warn" : "bg-crit/15 text-crit";
  const lineStroke = kpi.baselineTone === "ok" ? "var(--foreground)" : kpi.baselineTone === "warn" ? "var(--warn)" : "var(--crit)";

  const value =
    kpi.key === "throughput"
      ? kpi.value.toLocaleString("en-IN")
      : kpi.key === "waitReduction"
        ? kpi.value.toFixed(1)
        : String(Math.round(kpi.value));

  return (
    <div className={"panel-surface min-w-0 p-4 transition-all hover:bg-panel-raised/50 " + borderClass}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="label-xs text-muted-foreground truncate">{kpi.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-3xl font-bold tracking-tight text-foreground">{value}</span>
            <span className="num text-[11px] font-medium text-muted-foreground">{kpi.unit}</span>
          </div>
        </div>
        <div className="h-12 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={kpi.spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={"sp-" + kpi.key} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineStroke} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={lineStroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={lineStroke} strokeWidth={2.5} fill={"url(#sp-" + kpi.key + ")"} isAnimationActive={true} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className={"num mt-4 inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold rounded-full " + badgeClass}>
        {kpi.baselineTone === "ok" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {kpi.baseline}
      </div>
    </div>
  );
}
