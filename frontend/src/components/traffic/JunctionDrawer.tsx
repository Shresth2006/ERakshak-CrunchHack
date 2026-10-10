import { useState, useEffect, useMemo } from "react";
import {
  X, Video, Gauge, SplitSquareHorizontal, Clock, Cpu, FileText,
  TrendingDown, TrendingUp, Download, CheckCircle2, AlertTriangle,
  ArrowRight, ShieldCheck, Flame, Compass, Activity, Play, Pause, ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell
} from "recharts";
import { getVideoForFeed } from "@/lib/video-feeds";
import {
  getRoadDensityColor,
  getRoadDensityBadgeText,
  getRoadDensityLOS,
  generateSignalTimerHistory,
  generatePhaseSplitHistory,
  generateAIDecisionLogs,
  generateLearningConvergenceData,
  generateSignalReportSummary,
  type TimerCycleHistoryPoint
} from "@/lib/signal-intelligence";
import type { Junction } from "@/lib/traffic-types";

type TabKey = "density" | "timer" | "learning" | "report" | "whatif";

export function JunctionDrawer({
  junction,
  onClose,
}: {
  junction: Junction | null;
  onClose: () => void;
  selectedTab?: TabKey;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("density");
  const [whatIf, setWhatIf] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const open = !!junction;

  // Close on Escape key press
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Derived intelligence data
  const timerHistory = useMemo(() => {
    return junction ? generateSignalTimerHistory(junction) : [];
  }, [junction]);

  const phaseSplits = useMemo(() => {
    return junction ? generatePhaseSplitHistory(junction) : [];
  }, [junction]);

  const decisionLogs = useMemo(() => {
    return junction ? generateAIDecisionLogs(junction) : [];
  }, [junction]);

  const learningConvergence = useMemo(() => {
    return generateLearningConvergenceData();
  }, []);

  const reportSummary = useMemo(() => {
    return junction ? generateSignalReportSummary(junction) : null;
  }, [junction]);

  if (!open || !junction) return null;

  const density = junction.congestionIndex || 50;
  const densityColor = getRoadDensityColor(density);
  const densityLabel = getRoadDensityBadgeText(density);
  const los = getRoadDensityLOS(density);

  const signalColor =
    junction.signalStatus === "GREEN"
      ? "#22c55e"
      : junction.signalStatus === "YELLOW"
      ? "#f59e0b"
      : "#ef4444";

  const videoSrc = getVideoForFeed(junction.camera?.id || junction.id);
  const hasVideo = !!videoSrc;

  // Export report handler
  const handleExportReport = () => {
    if (!reportSummary) return;
    const jsonStr = JSON.stringify(reportSummary, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ERakshak_Signal_Report_${junction.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice("Report downloaded successfully");
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-800 bg-[#0b0b0e] shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/90 px-5 py-3.5 bg-zinc-950/80 backdrop-blur-md gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {junction.id}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                {junction.zone}
              </span>
              {junction.onBrts && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  ✦ BRTS CORRIDOR
                </span>
              )}
              {/* Traffic Light State & Countdown */}
              <div
                className="flex items-center gap-1.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded border"
                style={{
                  borderColor: `${signalColor}60`,
                  color: signalColor,
                  backgroundColor: `${signalColor}15`,
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: signalColor }}
                />
                <span>{junction.signalStatus}</span>
                <span className="text-zinc-400">·</span>
                <span className="text-white">{junction.signalCountdown}s</span>
              </div>

              {/* Road Density Badge */}
              <div
                className="flex items-center gap-1.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded border"
                style={{
                  borderColor: `${densityColor}60`,
                  color: densityColor,
                  backgroundColor: `${densityColor}15`,
                }}
              >
                <span>DENSITY: {density}%</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-300 font-sans font-medium text-[10px]">{densityLabel}</span>
              </div>
            </div>
            
            <h2 className="mt-1 text-lg font-bold text-zinc-100 truncate">
              {junction.name}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all shadow-sm active:scale-95"
              title="Export complete telemetry report"
            >
              <Download className="h-3.5 w-3.5 text-zinc-400" />
              <span>Export Audit</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all flex items-center justify-center active:scale-95"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800/80 px-4 py-2 bg-zinc-950/40 shrink-0 scrollbar-none">
          {[
            { key: "density" as const, label: "Road Density & 4-Arms", icon: Compass },
            { key: "timer" as const, label: "Signal Timer & Graphs", icon: Clock },
            { key: "learning" as const, label: "AI Learning & Telemetry", icon: Cpu },
            { key: "report" as const, label: "Optimization Report", icon: FileText },
            { key: "whatif" as const, label: "What-If Simulator", icon: Gauge },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-zinc-100 text-zinc-950 shadow-md font-bold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-zinc-950" : "text-zinc-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notification Toast */}
        {exportNotice && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-1.5 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Body Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: ROAD DENSITY & 4 ARMS */}
          {activeTab === "density" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Density Overview Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-col justify-between">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Total Road Density
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black font-mono" style={{ color: densityColor }}>
                      {density}%
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {densityLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${density}%`, backgroundColor: densityColor }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Level of Service (LOS)
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-100 mt-1">
                    {los.los}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mt-1">
                    {los.desc}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Average Vehicle Wait
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-100 mt-1">
                    {junction.avgWait}s
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                    <TrendingDown className="h-3 w-3" />
                    <span>-41% vs fixed timing</span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Total Inflow Throughput
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-100 mt-1">
                    {junction.throughput.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    veh/hr peak capacity
                  </div>
                </div>
              </div>

              {/* 4-Way Physical Diagram & Camera Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* 4-Way Physical Intersection Diagram */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-200">
                        4-Way Intersection Physical Model
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                      Live Arm Sensors Active
                    </span>
                  </div>

                  <FourWayIntersectionDiagram junction={junction} />

                  <div className="mt-2 text-center text-[10px] text-zinc-400 font-mono">
                    <span className="text-zinc-300 font-bold">D = Road Density</span> (% physical capacity occupied) · <span className="text-zinc-300 font-bold">Q = Vehicle Queue</span> (waiting cars) · Green arm discharges inbound flow into junction
                  </div>
                </div>

                {/* Live Camera Surveillance Tile */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-200">
                        Live Surveillance & Computer Vision Feed
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      AI YOLOv8 ONLINE
                    </span>
                  </div>

                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                    {hasVideo ? (
                      <video
                        src={videoSrc}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#07090e] flex flex-col items-center justify-center">
                        <Video className="h-10 w-10 text-zinc-700 mb-2" />
                        <span className="text-xs font-mono text-zinc-500">Camera Feed Initializing...</span>
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 text-[10px] font-mono text-zinc-300 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                      {junction.camera?.id || "CAM-01"} · 1080p · 24 FPS · Zero Latency
                    </div>
                  </div>

                  {(() => {
                    const totalVehs = junction.lanes.reduce((acc, l) => acc + (l.arrivalRate || l.queue || 10), 0);
                    const twoWheelers = Math.round(totalVehs * 0.50);
                    const cars = Math.round(totalVehs * 0.31);
                    const autos = Math.round(totalVehs * 0.15);
                    const buses = Math.max(1, totalVehs - twoWheelers - cars - autos);
                    return (
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] font-mono text-zinc-400">
                        <div className="bg-zinc-950/60 p-1.5 rounded border border-zinc-800">
                          Cars: <span className="text-zinc-200 font-bold">{cars}</span>
                        </div>
                        <div className="bg-zinc-950/60 p-1.5 rounded border border-zinc-800">
                          2-Wheelers: <span className="text-zinc-200 font-bold">{twoWheelers}</span>
                        </div>
                        <div className="bg-zinc-950/60 p-1.5 rounded border border-zinc-800">
                          Buses: <span className="text-zinc-200 font-bold">{buses}</span>
                        </div>
                        <div className="bg-zinc-950/60 p-1.5 rounded border border-zinc-800">
                          Autos: <span className="text-zinc-200 font-bold">{autos}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Per-Arm Road Density Breakdown Cards */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200">
                      Directional Road Density & Queue Breakdown (4 Arms)
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Real-time density percentages, queue length, and arrival rates per roadway approach
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Capacity: 800 veh/hr/lane
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {junction.lanes.map((lane, index) => {
                    const laneColor = getRoadDensityColor(lane.density);
                    const laneLevel = getRoadDensityBadgeText(lane.density);
                    return (
                      <div
                        key={lane.id || index}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 flex flex-col justify-between"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold text-zinc-200">
                            {lane.name}
                          </span>
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                            style={{
                              borderColor: `${laneColor}50`,
                              color: laneColor,
                              backgroundColor: `${laneColor}15`,
                            }}
                          >
                            {lane.density}% · {laneLevel}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="my-2.5 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${lane.density}%`,
                              backgroundColor: laneColor,
                            }}
                          />
                        </div>

                        {/* Metrics Row */}
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-2">
                          <div>
                            <span className="text-zinc-500 block">Queue</span>
                            <span className="text-zinc-200 font-bold">{lane.queue} veh</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Inflow</span>
                            <span className="text-zinc-200 font-bold">{lane.arrivalRate} /min</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Queue Len</span>
                            <span className="text-zinc-200 font-bold">{lane.queue * 6}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SIGNAL TIMER & HISTORY GRAPH */}
          {activeTab === "timer" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              
              {/* Real-time Timer Visualizer Card */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Big Circular Countdown Display */}
                  <div className="flex items-center gap-4">
                    <div
                      className="relative h-20 w-20 shrink-0 rounded-2xl flex flex-col items-center justify-center border shadow-xl"
                      style={{
                        borderColor: `${signalColor}60`,
                        backgroundColor: `${signalColor}15`,
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: signalColor }}>
                        {junction.signalStatus}
                      </span>
                      <span className="text-3xl font-black font-mono text-white">
                        {junction.signalCountdown}s
                      </span>
                      <span className="text-[8px] font-mono text-zinc-400">REMAINING</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-200">
                          Active Phase: {junction.signalStatus === "GREEN" ? "North-South Corridor Discharge" : junction.signalStatus === "YELLOW" ? "Clearance Transition Phase" : "Cross-Street Green Servicing"}
                        </span>
                        <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                          AI DYNAMIC TIMING
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Controller calculated dynamic extension based on <strong className="text-zinc-200">{density}% road density</strong>. Static schedule would have forced a premature red.
                      </p>
                      {(() => {
                        const staticBase = junction.staticCycle?.find((p) => p.phase === "GREEN")?.seconds || 35;
                        const currentAlloc = junction.signalCountdown > 0 ? junction.signalCountdown : 28;
                        const boost = Math.max(0, currentAlloc - staticBase);
                        return (
                          <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                            <span>Total Allocated: <strong className="text-zinc-200">{currentAlloc}s</strong></span>
                            <span>·</span>
                            <span className="text-emerald-400 font-bold">+{boost}s dynamic boost</span>
                            <span>·</span>
                            <span>Next Phase: <strong className="text-zinc-300">Yellow in {junction.signalCountdown}s</strong></span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Quick Cycle Pill */}
                  {(() => {
                    const currentAlloc = junction.signalCountdown > 0 ? junction.signalCountdown : 28;
                    const cycleLen = junction.adaptiveCycle?.reduce((s, p) => s + p.seconds, 0) || 90;
                    const redSecs = Math.max(16, cycleLen - currentAlloc - 4);
                    return (
                      <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl min-w-[200px]">
                        <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                          Current Cycle Length
                        </div>
                        <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                          {cycleLen} seconds
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          Adaptive: {currentAlloc}s Green · 4s Amber · {redSecs}s Red
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Historical Timer Graph (15 Cycles Time Series) */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-sky-400" />
                      <span>Signal Timer History & Road Density Correlation (Last 15 Cycles)</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Historical tracking showing how the AI dynamically scaled green light duration in response to road density spikes
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      AI Adaptive Green (s)
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      Static Baseline (35s)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Road Density (%)
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={timerHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="cycleId"
                        tick={{ fontSize: 10, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10, fill: "#a1a1aa" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[10, 80]}
                        unit="s"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10, fill: "#f59e0b" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(9,9,11,0.95)",
                          borderColor: "#3f3f46",
                          borderRadius: 10,
                          fontSize: 11,
                          boxShadow: "0 10px 25px rgba(0,0,0,0.8)",
                        }}
                        labelStyle={{ color: "#e4e4e7", fontWeight: "bold" }}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="roadDensity"
                        name="Road Density (%)"
                        fill="#f59e0b"
                        fillOpacity={0.15}
                        stroke="#f59e0b"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="staticBaseline"
                        name="Static Baseline"
                        stroke="#52525b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="adaptiveGreen"
                        name="AI Adaptive Green (s)"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#38bdf8" }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-mono text-zinc-400 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                  <div>
                    <span className="text-zinc-500 block">Avg AI Green</span>
                    <span className="text-white font-bold text-xs">51.4 seconds</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Baseline Timer</span>
                    <span className="text-zinc-300 font-bold text-xs">35.0 seconds</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Wasted Green Saved</span>
                    <span className="text-emerald-400 font-bold text-xs">11.8s / cycle</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Queue Cleared / Cycle</span>
                    <span className="text-sky-400 font-bold text-xs">36.2 vehicles</span>
                  </div>
                </div>
              </div>

              {/* Phase Split History Chart */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3">
                  <h3 className="text-xs font-bold text-zinc-200">
                    Phase Split Breakdown Across Recent Cycles
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Proportionate time allocation between North-South green, East-West green, and yellow clearance
                  </p>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={phaseSplits} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} unit="s" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(9,9,11,0.95)",
                          borderColor: "#3f3f46",
                          borderRadius: 10,
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="northSouthGreen" name="North-South Green" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="eastWestGreen" name="East-West Green" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="amberClearance" name="Amber Clearance" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI LEARNING & TELEMETRY */}
          {activeTab === "learning" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              
              {/* Agent Specification Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">RL Algorithm</span>
                  <div className="text-base font-bold text-zinc-100 mt-1">DQN + PPO Multi-Agent</div>
                  <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">Online Policy v4.2.8</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Replay Memory</span>
                  <div className="text-base font-bold text-zinc-100 mt-1">142,500 Steps</div>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Prioritized Experience</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Exploration Rate (ε)</span>
                  <div className="text-base font-bold text-zinc-100 mt-1">0.02 (98% Exploit)</div>
                  <span className="text-[10px] text-sky-400 font-mono mt-0.5 block">Converged Optimal Control</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Spillback Prevention</span>
                  <div className="text-base font-bold text-emerald-400 mt-1">99.2% Score</div>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">Gridlock Hazard Eliminated</span>
                </div>
              </div>

              {/* Learning Convergence Chart */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3">
                  <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    <span>Agent Policy Convergence & Delay Reduction Curve</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Reward progression over 140,000 SUMO training iterations showing stabilization at minimal vehicle delay
                  </p>
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={learningConvergence} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="episode" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(9,9,11,0.95)",
                          borderColor: "#3f3f46",
                          borderRadius: 10,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="baselineReward"
                        name="Fixed Timer Baseline"
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="agentReward"
                        name="RL Agent Reward Score"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#22c55e" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Explainable AI Live Decision Stream */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-sky-400" />
                    <span>Explainable AI Decision Audit Stream (Live Actions)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                    Real-Time Inference Log
                  </span>
                </div>

                <div className="space-y-2.5">
                  {decisionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-zinc-400">{log.time}</span>
                          <span className="font-bold text-zinc-200">{log.action}</span>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                              log.severity === "boost"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : log.severity === "truncate"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                            }`}
                          >
                            {log.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-400 text-[11px] leading-relaxed">
                          {log.rationale}
                        </p>
                      </div>

                      <div className="shrink-0 font-mono text-[11px] text-zinc-300 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
                        {log.impact}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPTIMIZATION REPORT */}
          {activeTab === "report" && reportSummary && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              
              {/* Report Header Card */}
              <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                      VERIFIED AUDIT REPORT
                    </span>
                    <span className="text-xs text-zinc-400">Junction ID: {junction.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-100 mt-1">
                    AI Traffic Signal Optimization & Learning Performance Report
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Evaluation of Max-Pressure Adaptive Policy vs Static Fixed Timer Schedule for Surat Municipal Corporation
                  </p>
                </div>

                <button
                  onClick={handleExportReport}
                  className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Full Report (JSON)</span>
                </button>
              </div>

              {/* High-level Impact Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">Wait Time Saved</span>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    -{reportSummary.waitReductionPct}%
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    from 58s down to {junction.avgWait}s
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">Queue Length Cut</span>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    -{reportSummary.queueReductionPct}%
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    spillback prevented
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">Daily Fuel Saved</span>
                  <div className="text-2xl font-black font-mono text-sky-400 mt-1">
                    {reportSummary.fuelSavedLitersDay} L
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    approx ₹{reportSummary.economicSavingsInrDay.toLocaleString()} / day
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">Carbon Avoided</span>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    {reportSummary.co2SavedKgDay} kg
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    CO₂ emissions saved daily
                  </span>
                </div>
              </div>

              {/* Detailed Phase Audit Table */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h4 className="text-xs font-bold text-zinc-200 mb-3">
                  Intersection Approach Phase Efficiency Audit
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase">
                        <th className="pb-2.5 font-semibold">Approach Road</th>
                        <th className="pb-2.5 font-semibold">Road Density</th>
                        <th className="pb-2.5 font-semibold">Baseline Green</th>
                        <th className="pb-2.5 font-semibold">AI Adaptive Green</th>
                        <th className="pb-2.5 font-semibold">Vehicles Cleared</th>
                        <th className="pb-2.5 font-semibold">Delay Delta</th>
                        <th className="pb-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {reportSummary.phaseAudit.map((p, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30">
                          <td className="py-2.5 text-zinc-200 font-sans font-medium">{p.arm}</td>
                          <td className="py-2.5 text-zinc-300">
                            <span className="px-1.5 py-0.5 rounded" style={{ color: getRoadDensityColor(p.density) }}>
                              {p.density}%
                            </span>
                          </td>
                          <td className="py-2.5 text-zinc-400">{p.staticGreen}s</td>
                          <td className="py-2.5 text-sky-400 font-bold">{p.adaptiveGreen}s</td>
                          <td className="py-2.5 text-zinc-200">{p.queueCleared} veh</td>
                          <td className="py-2.5 text-emerald-400 font-bold">-{p.delaySavedPct}%</td>
                          <td className="py-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WHAT-IF SIMULATOR */}
          {activeTab === "whatif" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div
                className={`rounded-xl border p-4 transition-all ${
                  whatIf ? "border-rose-500/50 bg-rose-950/20" : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Gauge className="h-4 w-4 text-zinc-400" />
                      <span>Fixed Timer Baseline Sandbox Simulation</span>
                    </h3>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Simulate reverting this junction from adaptive AI control back to static fixed-time signal cycles (SUMO run simulation #418).
                    </p>
                  </div>

                  <button
                    onClick={() => setWhatIf((v) => !v)}
                    role="switch"
                    aria-checked={whatIf}
                    className={`relative h-6 w-12 shrink-0 rounded-full border transition-colors ${
                      whatIf ? "border-rose-500 bg-rose-500" : "border-zinc-700 bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
                        whatIf ? "left-[26px] bg-white shadow-md" : "left-0.5 bg-zinc-400"
                      }`}
                    />
                  </button>
                </div>

                {whatIf ? (
                  <div className="mt-4 pt-4 border-t border-rose-500/30">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      <span>WARNING: High Congestion Penalty Under Static Signal Timing</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Congestion Surge</span>
                        <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                          +{junction.whatIfDelta}%
                        </div>
                      </div>

                      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Wait Time Escalation</span>
                        <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                          +{Math.round(junction.avgWait * (junction.whatIfDelta / 100))}s
                        </div>
                      </div>

                      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Throughput Loss</span>
                        <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                          -{Math.round(junction.whatIfDelta * 0.7)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-zinc-500 font-mono">
                    ✦ Switch on to evaluate the degradation penalty if the city reverts to fixed schedules.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 4-Way Intersection Physical Diagram Component
function FourWayIntersectionDiagram({ junction }: { junction: Junction }) {
  const nLane = junction.lanes.find((l) => l.name.toLowerCase().includes("north") || (l as any).direction === "N") || junction.lanes[0];
  const sLane = junction.lanes.find((l) => l.name.toLowerCase().includes("south") || (l as any).direction === "S") || junction.lanes[1];
  const eLane = junction.lanes.find((l) => l.name.toLowerCase().includes("east") || (l as any).direction === "E") || junction.lanes[2];
  const wLane = junction.lanes.find((l) => l.name.toLowerCase().includes("west") || (l as any).direction === "W") || junction.lanes[3];

  let activeArm: "N" | "E" | "S" | "W" = junction.activeArm || "N";
  if (!junction.activeArm) {
    const phaseLower = ((junction as any).current_phase || "").toLowerCase();
    if (phaseLower.includes("south")) activeArm = "S";
    else if (phaseLower.includes("east")) activeArm = "E";
    else if (phaseLower.includes("west")) activeArm = "W";
    else if (phaseLower.includes("north")) activeArm = "N";
  }

  const isYellow = junction.signalStatus === "YELLOW";
  const isAllRed = junction.signalStatus === "RED";
  const nStatus = isAllRed ? "RED" : activeArm === "N" ? (isYellow ? "YELLOW" : "GREEN") : "RED";
  const sStatus = isAllRed ? "RED" : activeArm === "S" ? (isYellow ? "YELLOW" : "GREEN") : "RED";
  const eStatus = isAllRed ? "RED" : activeArm === "E" ? (isYellow ? "YELLOW" : "GREEN") : "RED";
  const wStatus = isAllRed ? "RED" : activeArm === "W" ? (isYellow ? "YELLOW" : "GREEN") : "RED";

  const statusColor = (st: string) =>
    st === "GREEN" ? "#22c55e" : st === "YELLOW" ? "#f59e0b" : "#ef4444";

  const armFullTitle = {
    N: "North Approach (Southbound Inflow)",
    S: "South Approach (Northbound Inflow)",
    E: "East Approach (Westbound Inflow)",
    W: "West Approach (Eastbound Inflow)",
  }[activeArm];

  return (
    <div className="relative mx-auto my-3 flex h-64 w-full max-w-[390px] items-center justify-center rounded-2xl border border-zinc-800 bg-[#07090e] p-2 overflow-hidden shadow-inner">
      {/* Asphalt Roads */}
      <div className="absolute inset-x-0 top-1/2 h-20 -translate-y-1/2 bg-[#12161f] border-y border-zinc-700/60" />
      <div className="absolute inset-y-0 left-1/2 w-20 -translate-x-1/2 bg-[#12161f] border-x border-zinc-700/60" />

      {/* Dashed Lane Dividers */}
      <div className="absolute inset-x-0 top-1/2 h-0 border-t border-dashed border-zinc-600/50" />
      <div className="absolute inset-y-0 left-1/2 w-0 border-l border-dashed border-zinc-600/50" />

      {/* Center Intersection Box with Countdown & Discharge Corridor */}
      <div className="relative z-10 flex h-24 w-28 flex-col items-center justify-center rounded-2xl border-2 border-zinc-700 bg-zinc-950 text-center shadow-2xl p-1">
        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">CORRIDOR</span>
        <span className="num text-lg font-black text-white">{junction.signalCountdown}s</span>
        <span className="text-[7.5px] text-emerald-400 font-mono font-bold leading-tight">
          {activeArm}-ARM DISCHARGE
        </span>
        <span className="text-[6.5px] text-zinc-400 font-mono mt-0.5">
          Flowing to All Exits
        </span>
      </div>

      {/* NORTH ARM (Top) — Vehicles approach SOUTHBOUND (⬇) into junction */}
      <div className="absolute top-1.5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        <span className="text-[9px] font-mono font-bold text-zinc-400">NORTH (N)</span>
        <div
          className="my-0.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9.5px] font-bold shadow-sm"
          style={{
            borderColor: statusColor(nStatus),
            color: statusColor(nStatus),
            backgroundColor: `${statusColor(nStatus)}20`,
          }}
          title="Vehicles approaching Southbound into intersection"
        >
          <span>⬇ {nStatus}</span>
          <span className="num font-mono text-zinc-200">D:{nLane?.density ?? 0}%</span>
          <span className="num font-mono text-zinc-400">Q:{nLane?.queue ?? 0}</span>
        </div>
      </div>

      {/* SOUTH ARM (Bottom) — Vehicles approach NORTHBOUND (⬆) into junction */}
      <div className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        <div
          className="my-0.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9.5px] font-bold shadow-sm"
          style={{
            borderColor: statusColor(sStatus),
            color: statusColor(sStatus),
            backgroundColor: `${statusColor(sStatus)}20`,
          }}
          title="Vehicles approaching Northbound into intersection"
        >
          <span>⬆ {sStatus}</span>
          <span className="num font-mono text-zinc-200">D:{sLane?.density ?? 0}%</span>
          <span className="num font-mono text-zinc-400">Q:{sLane?.queue ?? 0}</span>
        </div>
        <span className="text-[9px] font-mono font-bold text-zinc-400">SOUTH (S)</span>
      </div>

      {/* WEST ARM (Left) — Vehicles approach EASTBOUND (➡) into junction */}
      <div className="absolute left-1.5 top-1/2 z-20 flex -translate-y-1/2 flex-col items-start">
        <span className="text-[9px] font-mono font-bold text-zinc-400">WEST (W)</span>
        <div
          className="my-0.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9.5px] font-bold shadow-sm"
          style={{
            borderColor: statusColor(wStatus),
            color: statusColor(wStatus),
            backgroundColor: `${statusColor(wStatus)}20`,
          }}
          title="Vehicles approaching Eastbound into intersection"
        >
          <span>➡ {wStatus}</span>
          <span className="num font-mono text-zinc-200">D:{wLane?.density ?? 0}%</span>
          <span className="num font-mono text-zinc-400">Q:{wLane?.queue ?? 0}</span>
        </div>
      </div>

      {/* EAST ARM (Right) — Vehicles approach WESTBOUND (⬅) into junction */}
      <div className="absolute right-1.5 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end">
        <span className="text-[9px] font-mono font-bold text-zinc-400">EAST (E)</span>
        <div
          className="my-0.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9.5px] font-bold shadow-sm"
          style={{
            borderColor: statusColor(eStatus),
            color: statusColor(eStatus),
            backgroundColor: `${statusColor(eStatus)}20`,
          }}
          title="Vehicles approaching Westbound into intersection"
        >
          <span>⬅ {eStatus}</span>
          <span className="num font-mono text-zinc-200">D:{eLane?.density ?? 0}%</span>
          <span className="num font-mono text-zinc-400">Q:{eLane?.queue ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
