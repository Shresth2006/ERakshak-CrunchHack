import { useMemo, useState, useEffect, useRef } from "react";
import { X, Cpu, Wifi, Thermometer, Eye, SlidersHorizontal, Camera, Siren, Zap, Radio, Sparkles } from "lucide-react";
import { AppShell } from "./AppShell";
import { TopStatusBar } from "./TopStatusBar";
import { CameraTile } from "./CameraTile";
import { DetectionLog } from "./DetectionLog";
import { useTrafficData } from "@/hooks/useTrafficData";
import { useCameraFeeds } from "@/hooks/useCameraFeeds";
import { fmtTime } from "@/lib/mock-traffic";
import { getVideoKeyForFeed, getRealDetectionsForVideoTime, type RealCheckpointEvent } from "@/lib/video-detections";
import type { DetectionEvent } from "@/lib/traffic-types";

const GRID_SIZE = 9; // 3×3

function useCameraHealth(feeds: any[]) {
  return feeds.map((f, i) => ({
    id: f.id,
    online: f.online,
    fps: f.online ? (24 + (i % 5)) : 0,
    signalQuality: f.online ? (72 + (i * 7) % 27) : 0,
    confidence: f.online ? (82 + (i * 5) % 16) : 0,
    weather: ["Clear", "Clear", "Haze", "Clear", "Clear", "Fog", "Clear", "Clear", "Clear"][i % 9],
    uptime: f.online ? `${String(Math.floor(i * 3.2 + 1)).padStart(2, "0")}:${String((i * 7 + 14) % 60).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}` : "00:00:00",
  }));
}

export function Surveillance() {
  const { stats, connected, detections, junctions } = useTrafficData();
  const { feeds, online, total } = useCameraFeeds();
  const [overlays, setOverlays] = useState(true);
  const [brtsOnly, setBrtsOnly] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const health = useCameraHealth(feeds);
  const avgConfidence = Math.round(health.filter(h => h.online).reduce((a, h) => a + h.confidence, 0) / Math.max(online, 1));

  const gridFeeds = [...feeds];
  while (gridFeeds.length < GRID_SIZE) {
    gridFeeds.push({
      id: "CAM-PENDING-" + gridFeeds.length,
      junctionId: "PENDING",
      junctionName: "Camera Slot " + (gridFeeds.length + 1),
      online: false,
      hasBrtsZone: false,
      boxes: [],
      vehicleCount: 0,
      avgSpeed: 0,
      queueLength: 0,
      intrusionActive: false,
    } as any);
  }

  const focused = feeds.find((f) => f.id === focus) ?? null;
  const focusedJunction = junctions.find((j) => j.id === focused?.junctionId || (focused?.junctionName && j.name.toLowerCase().includes(focused.junctionName.toLowerCase()))) ?? null;

  const triggerSnapshot = () => {
    setActionToast(`📸 Evidence Snapshot #${Math.floor(1000 + Math.random() * 9000)} saved for ${focused?.junctionName}`);
    setTimeout(() => setActionToast(null), 3000);
  };

  const triggerInterceptor = () => {
    setActionToast(`🚨 Interceptor Unit dispatched to ${focused?.junctionName}`);
    setTimeout(() => setActionToast(null), 3000);
  };

  const triggerEmergencyOverride = () => {
    setActionToast(`🟢 ATCS Emergency Green Preemption wave activated for ${focused?.junctionName}`);
    setTimeout(() => setActionToast(null), 3000);
  };

  const [currentFrameDetections, setCurrentFrameDetections] = useState<RealCheckpointEvent[]>([]);
  const [liveVideoEvents, setLiveVideoEvents] = useState<DetectionEvent[]>([]);
  const [playbackTime, setPlaybackTime] = useState({ current: 0, duration: 6 });
  const lastTimeRef = useRef<number>(-1);

  // Strict lane helper: only Lane 1, Lane 2, Lane 3, and BRTS Corridor allowed
  const cleanLane = (l?: string) => {
    if (!l || l.toLowerCase().includes("carriageway")) return "Lane 1";
    return l;
  };

  // When focus opens or changes camera, reset and load initial real detections from this video
  useEffect(() => {
    if (!focused) {
      setCurrentFrameDetections([]);
      setLiveVideoEvents([]);
      lastTimeRef.current = -1;
      setPlaybackTime({ current: 0, duration: 6 });
      return;
    }

    const vKey = getVideoKeyForFeed(focused.id || focused.junctionId);
    const initialEvents = getRealDetectionsForVideoTime(vKey, 0.5);
    setCurrentFrameDetections(initialEvents);

    const now = Date.now();
    const formatted: DetectionEvent[] = initialEvents.map((e, idx) => ({
      id: `real-${e.frame}-${e.objectClass}-${now}-${idx}`,
      ts: now - idx * 1200,
      cameraId: focused.id,
      junctionName: focused.junctionName,
      event: e.event,
      objectClass: e.objectClass,
      confidence: e.confidence,
      note: (e.note || `${cleanLane(e.lane)} • Active Flow`).replace(/Carriageway/gi, "Lane 1"),
    }));
    formatted.sort((a, b) => (a.event === "brts_intrusion" ? -1 : b.event === "brts_intrusion" ? 1 : 0));
    setLiveVideoEvents(formatted);
    lastTimeRef.current = 0.5;
  }, [focused?.id]);

  // Synchronize detection cards with actual video playback time
  const handleVideoTime = (currentTimeSec: number, durationSec?: number) => {
    if (!focused) return;
    if (durationSec && durationSec > 0) {
      setPlaybackTime({ current: currentTimeSec, duration: durationSec });
    }
    const rounded = Math.floor(currentTimeSec * 2.5) / 2.5;
    if (Math.abs(rounded - lastTimeRef.current) < 0.25) return;
    lastTimeRef.current = rounded;

    const vKey = getVideoKeyForFeed(focused.id || focused.junctionId);
    const matched = getRealDetectionsForVideoTime(vKey, currentTimeSec);
    setCurrentFrameDetections(matched);

    if (matched.length > 0) {
      const now = Date.now();
      const newItems: DetectionEvent[] = matched.map((e, idx) => ({
        id: `real-${e.frame}-${e.objectClass}-${now}-${idx}-${Math.random().toString(36).slice(2, 4)}`,
        ts: now - idx * 400,
        cameraId: focused.id,
        junctionName: focused.junctionName,
        event: e.event,
        objectClass: e.objectClass,
        confidence: e.confidence,
        note: (e.note || `${cleanLane(e.lane)} • Active Flow`).replace(/Carriageway/gi, "Lane 1"),
      }));
      newItems.sort((a, b) => (a.event === "brts_intrusion" ? -1 : b.event === "brts_intrusion" ? 1 : 0));

      setLiveVideoEvents((prev) => {
        const combined = [...newItems, ...prev];
        return combined.slice(0, 20);
      });
    }
  };

  const focusedEvents = useMemo(() => {
    if (!focus) return [];
    if (liveVideoEvents.length > 0) {
      return liveVideoEvents;
    }
    return detections
      .filter((d) => d.cameraId === focus || (focused && (d.cameraId === focused.id || d.junctionName === focused.junctionName)))
      .slice(0, 20);
  }, [detections, focus, focused, liveVideoEvents]);
  const focusedHealth = health.find(h => h.id === focus);

  return (
    <AppShell>
      <TopStatusBar
        junctionsOnline={stats.junctionsOnline}
        intrusions={stats.activeIntrusions}
        avgCongestion={stats.avgCongestion}
        connected={connected}
      />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Telemetry Bar */}
        <div className="border-b border-border bg-panel px-6 py-4 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="label-xs text-muted-foreground flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> ACTIVE CAMERAS</div>
              <div className="num text-2xl font-bold tracking-tight">
                {online}<span className="text-muted-foreground text-sm font-medium">/{total}</span>
              </div>
            </div>
            
            <div className="h-10 w-px bg-border" />
            
            <div className="flex flex-col gap-1">
              <div className="label-xs text-muted-foreground flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> AVG CONFIDENCE</div>
              <div className="num text-2xl font-bold tracking-tight">{avgConfidence}%</div>
            </div>

            <div className="h-10 w-px bg-border" />

            <div className="flex flex-col gap-1.5">
              <div className="label-xs text-muted-foreground">SYSTEM HEALTH STATUS</div>
              <div className="flex gap-1.5">
                {feeds.map(f => (
                  <button key={f.id} onClick={() => setFocus(f.id)} title={f.id}
                    className={"h-3 w-3 rounded-full transition-all " + (f.online ? "bg-ok hover:scale-125" : "bg-border")}
                    style={{ opacity: focus === f.id ? 1 : 0.6, outline: focus === f.id ? "2px solid var(--foreground)" : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-panel-raised p-1.5 rounded-xl border border-border">
            <Toggle active={overlays} onClick={() => setOverlays(v => !v)} label="Overlays" icon={<SlidersHorizontal className="h-3 w-3" />} />
            <Toggle active={brtsOnly} onClick={() => setBrtsOnly(v => !v)} label="BRTS Events" />
          </div>
        </div>

        {/* 3x3 Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {gridFeeds.slice(0, GRID_SIZE).map((f, i) => (
              <div key={f.id} className="h-full flex flex-col">
                <CameraTile feed={f as any} overlays={overlays} brtsOnly={brtsOnly} onClick={() => setFocus(f.id)} staggerIndex={i} />
                {f.online && (
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-ok" /> Live Stream</span>
                    <span className="num font-mono">{f.id}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-screen Modal */}
      {focused && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-background/90 p-6 backdrop-blur-xl">
          <div className="grid h-full max-h-[90vh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-border/50 bg-panel rounded-2xl shadow-2xl">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/50 px-6 py-4 bg-panel-raised/50">
              <div className="flex items-center gap-4 min-w-0">
                <div className={"h-2.5 w-2.5 rounded-full shrink-0 " + (focused.online ? "bg-ok animate-heartbeat" : "bg-muted")} />
                <div className="min-w-0 flex items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{focused.junctionName}</h2>
                    <div className="label-xs text-muted-foreground">{focused.id} · Focus View</div>
                  </div>
                  {currentFrameDetections.some(cd => cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus")) && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-tight bg-crit text-white shadow-lg shadow-crit/30 animate-pulse">
                      🚨 BRTS VIOLATION DETECTED
                    </span>
                  )}
                </div>
                {focusedHealth && (
                  <div className="flex items-center gap-6 ml-8 pl-8 border-l border-border/50">
                    <Chip label="FPS" value={String(focusedHealth.fps)} />
                    <Chip label="Confidence" value={focusedHealth.confidence + "%"} />
                    <Chip label="Weather" value={focusedHealth.weather ?? "—"} />
                    <Chip label="Uptime" value={focusedHealth.uptime} />
                  </div>
                )}
              </div>
              <button onClick={() => setFocus(null)} className="grid h-9 w-9 shrink-0 place-items-center border border-border/50 rounded-full bg-panel-raised hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 gap-6 overflow-y-auto p-6 lg:grid-cols-[2fr_1fr]">
              {/* Left Column: Camera Feed + Real-Time Lane Flow & Operator Deck */}
              <div className="min-w-0 flex flex-col gap-3.5">
                {/* 1. Camera Video Feed with Overlay */}
                <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black relative shrink-0">
                  <CameraTile 
                    feed={{
                      ...focused,
                      intrusionActive: currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || cd.lane === "BRTS Corridor") && cd.objectClass !== "bus" && cd.objectClass !== "ambulance")
                    }} 
                    overlays={overlays} 
                    brtsOnly={false} 
                    large 
                    onTimeUpdate={handleVideoTime}
                  />

                  {/* Instant Feedback Toast */}
                  {actionToast && (
                    <div className="absolute top-3 right-3 z-50 bg-zinc-950/95 border border-primary/60 text-white font-mono text-xs px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <Sparkles className="h-4 w-4 text-primary animate-spin" />
                      <span>{actionToast}</span>
                    </div>
                  )}

                  {/* Video Stream Mini Scrubber & AI Sync HUD */}
                  <div className="px-3 py-1.5 bg-zinc-950/95 border-t border-zinc-800/80 flex items-center justify-between gap-4 text-[10px] font-mono text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-zinc-300 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE 1080p
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span>
                        {Math.floor(playbackTime.current).toString().padStart(2, '0')}:
                        {Math.floor((playbackTime.current % 1) * 100).toString().padStart(2, '0')}s
                        {" / "}
                        {Math.floor(playbackTime.duration || 6).toString().padStart(2, '0')}.0s
                      </span>
                    </div>

                    {/* Scrubber Progress Bar */}
                    <div className="flex-1 max-w-sm relative flex items-center h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-100"
                        style={{ width: `${Math.min(100, ((playbackTime.current || 0) / Math.max(1, playbackTime.duration || 6)) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="text-zinc-400 font-semibold">24 FPS</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-emerald-400 font-bold">AI SYNC</span>
                    </div>
                  </div>
                </div>

                {/* 2. Tactical Lane & Junction Telemetry Grid (Rich Visual Depth & Micro-Gauges) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* BRTS Rapid Corridor Card */}
                  <div className={"rounded-xl p-3 border bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 shadow-lg flex flex-col justify-between transition-all " + 
                    (currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || cd.lane === "BRTS Corridor") && cd.objectClass !== "bus" && cd.objectClass !== "ambulance")
                      ? "border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.25)] border-t-2 border-t-red-500"
                      : currentFrameDetections.some(cd => cd.objectClass === "ambulance")
                      ? "border-amber-500/80 border-t-2 border-t-amber-500"
                      : "border-zinc-800/80 border-t-zinc-700/70")}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <span className={"h-1.5 w-1.5 rounded-full " + 
                            (currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || cd.lane === "BRTS Corridor") && cd.objectClass !== "bus" && cd.objectClass !== "ambulance")
                              ? "bg-red-500 animate-ping"
                              : "bg-amber-400/80")} />
                          BRTS Rapid
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-zinc-800/80 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700/60">
                          Transit
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono tracking-tight text-white mt-1">
                        {currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || cd.lane === "BRTS Corridor") && cd.objectClass !== "bus" && cd.objectClass !== "ambulance")
                          ? <span className="text-red-400 flex items-center gap-1 text-sm font-black">🚨 INTRUSION</span>
                          : currentFrameDetections.some(cd => cd.objectClass === "ambulance")
                          ? <span className="text-amber-400 flex items-center gap-1 text-sm font-black">🚑 AMBULANCE</span>
                          : <span className="text-zinc-200 text-sm">CLEAR CORRIDOR</span>}
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span>Speed Limit</span>
                        <span className="text-zinc-300 font-bold">50 km/h</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400/60 w-[78%]" />
                      </div>
                    </div>
                  </div>

                  {/* Lane 1 (Main Carriageway) Card */}
                  <div className="rounded-xl p-3 border border-zinc-800/80 border-t-zinc-700/70 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                          Lane 1 (Main)
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-zinc-800/80 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700/60">
                          Flow
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono tracking-tight text-white mt-1">
                        {focused.avgSpeed} <span className="text-xs text-zinc-400 font-normal">km/h</span>
                        <span className="text-zinc-600 mx-1.5 font-normal">·</span>
                        {Math.max(12, Math.round(focused.vehicleCount * 0.45))} <span className="text-xs text-zinc-400 font-normal">v/m</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span>Capacity Load</span>
                        <span className="text-zinc-300 font-bold">38%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400/60 w-[38%]" />
                      </div>
                    </div>
                  </div>

                  {/* Lane 2 (Passing) Card */}
                  <div className="rounded-xl p-3 border border-zinc-800/80 border-t-zinc-700/70 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                          Lane 2 (Fast)
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-zinc-800/80 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700/60">
                          Overtake
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono tracking-tight text-white mt-1">
                        {Math.round(focused.avgSpeed * 1.12)} <span className="text-xs text-zinc-400 font-normal">km/h</span>
                        <span className="text-zinc-600 mx-1.5 font-normal">·</span>
                        {Math.max(8, Math.round(focused.vehicleCount * 0.35))} <span className="text-xs text-zinc-400 font-normal">v/m</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span>Queue Length</span>
                        <span className="text-zinc-300 font-bold">Q{focused.queueLength}m</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400/60 w-[44%]" />
                      </div>
                    </div>
                  </div>

                  {/* Junction Signal Phase Card */}
                  <div className="rounded-xl p-3 border border-zinc-800/80 border-t-zinc-700/70 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <Radio className="h-3 w-3 text-zinc-400" />
                          Signal Phase
                        </span>
                        <span className={"text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded border " + 
                          (focusedJunction?.signalStatus === "GREEN" 
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" 
                            : focusedJunction?.signalStatus === "YELLOW"
                            ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/30")}>
                          {focusedJunction?.signalStatus ?? "GREEN"}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl font-black font-mono text-white leading-none">
                          {focusedJunction?.signalCountdown ?? 42}s
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Cycle</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span>ATCS Density</span>
                        <span className="text-zinc-300 font-bold">{focusedJunction?.congestionIndex ?? 35}%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500/70 via-amber-400/70 to-rose-400/70"
                          style={{ width: `${Math.min(100, focusedJunction?.congestionIndex ?? 35)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Tactical Command & Enforcement Console */}
                <div className="p-3 rounded-xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 shadow-xl flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={triggerSnapshot}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-semibold shadow-md transition-all active:scale-95 hover:border-zinc-500"
                      >
                        <Camera className="h-3.5 w-3.5 text-zinc-300" />
                        <span>Log Evidence Snapshot</span>
                      </button>
                      <button
                        onClick={triggerInterceptor}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-rose-200 border border-zinc-700/80 hover:border-rose-500/50 text-xs font-semibold shadow-md transition-all active:scale-95"
                      >
                        <Siren className="h-3.5 w-3.5 text-rose-400/90" />
                        <span>Dispatch Police Intercept</span>
                      </button>
                      <button
                        onClick={triggerEmergencyOverride}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-emerald-200 border border-zinc-700/80 hover:border-emerald-500/50 text-xs font-semibold shadow-md transition-all active:scale-95"
                      >
                        <Zap className="h-3.5 w-3.5 text-emerald-400/90" />
                        <span>Green Wave Preemption</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      <span className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded border border-white/5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 animate-pulse" />
                        ENGINE: YOLO26-ATCS
                      </span>
                      <span className="bg-black/50 px-2 py-1 rounded border border-white/5">
                        LATENCY: 14.2ms
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>Statutory Authority: Gujarat Motor Vehicles Rules · Surveillance & Enforcement Unit</span>
                    <span>Surat Smart City ATCS 2.6</span>
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex flex-col gap-4 overflow-hidden">
                <div className="panel-surface p-4 border-border/50 bg-panel-raised/30 flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="label-xs text-muted-foreground">LIVE DETECTION STREAM</div>
                    <span className="flex items-center gap-1 text-[10px] text-ok font-mono font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-ok animate-blink" /> ACTIVE (YOLO26)
                    </span>
                  </div>

                  {/* Active Targets currently in camera view */}
                  {currentFrameDetections.length > 0 && (
                    <div className={"mb-3 p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all " +
                      (currentFrameDetections.some(cd => cd.objectClass === "ambulance")
                        ? "border-red-500/80 bg-red-950/30 shadow-[0_0_24px_rgba(239,68,68,0.3)] animate-pulse"
                        : currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus")) && cd.objectClass !== "ambulance")
                        ? "border-crit/70 bg-crit/15 shadow-[0_0_20px_rgba(239,68,68,0.25)]" 
                        : "border-ok/30 bg-ok/5")}>
                      <div className="flex items-center justify-between">
                        <span className={"text-[10px] uppercase font-mono tracking-wider font-bold flex items-center gap-1.5 " +
                          (currentFrameDetections.some(cd => cd.objectClass === "ambulance")
                            ? "text-red-400 font-extrabold"
                            : currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus")) && cd.objectClass !== "ambulance") ? "text-crit animate-pulse" : "text-ok")}>
                          <span className={"h-2 w-2 rounded-full " + 
                            (currentFrameDetections.some(cd => cd.objectClass === "ambulance") 
                              ? "bg-red-500 animate-ping" 
                              : currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus")) && cd.objectClass !== "ambulance") ? "bg-crit animate-ping" : "bg-ok animate-pulse")} />
                          {currentFrameDetections.some(cd => cd.objectClass === "ambulance") 
                            ? "🚨 EMERGENCY AMBULANCE IN TRANSIT"
                            : currentFrameDetections.some(cd => (cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus")) && cd.objectClass !== "ambulance") ? "🚨 BRTS VIOLATION IN FRAME" : `In Active Frame (${currentFrameDetections.length})`}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">Frame Synced</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {currentFrameDetections.map((cd, i) => {
                          const isAmbulance = cd.objectClass === "ambulance";
                          const isIntrusion = !isAmbulance && (cd.event === "brts_intrusion" || (cd.lane === "BRTS Corridor" && cd.objectClass !== "bus"));
                          return (
                            <div key={i} className={"flex items-center justify-between px-2.5 py-1.5 rounded border text-xs transition-all " +
                              (isAmbulance 
                                ? "border-red-500/80 bg-red-950/50 text-red-100 shadow-md"
                                : isIntrusion ? "border-crit/70 bg-crit/25 text-crit shadow-sm" : "border-white/5 bg-black/40 text-foreground")}>
                              <span className="font-semibold capitalize flex items-center gap-1.5">
                                {isAmbulance ? '🚑 Ambulance' : cd.objectClass === 'two-wheeler' ? '🛵 Two-Wheeler' : cd.objectClass === 'car' ? '🚗 Car' : cd.objectClass === 'bus' ? '🚌 Bus' : '🚛 Truck'}
                                {isAmbulance && <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded font-bold font-mono tracking-tight uppercase animate-pulse">🚨 EMERGENCY 108</span>}
                                {isIntrusion && <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-crit text-white rounded font-bold font-mono tracking-tight uppercase">🚨 VIOLATION</span>}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={"text-[11px] font-mono " + (isAmbulance ? "text-red-300 font-bold" : isIntrusion ? "text-crit font-bold" : "text-muted-foreground")}>{cleanLane(cd.lane)}</span>
                                <span className={"font-mono text-[10px] px-1.5 py-0.5 rounded font-bold " + 
                                  (isAmbulance ? "bg-red-500/30 text-red-200 border border-red-500/40" : isIntrusion ? "bg-crit text-white" : "bg-ok/20 text-ok")}>{cd.confidence}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="label-xs text-muted-foreground mb-1">EVENT LOG STREAM</div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {focusedEvents.map((e) => {
                      const isBrts = e.event === "brts_intrusion";
                      const isViol = e.event === "lane_violation";
                      return (
                        <div key={e.id} className={"p-2.5 rounded-lg border flex flex-col gap-1 transition-all " + 
                          (isBrts ? "border-crit/50 bg-crit/10" : isViol ? "border-warn/40 bg-warn/10" : "border-border/50 bg-panel-raised/50")}>
                          <div className="flex justify-between items-center">
                            <span className={"text-xs font-bold tracking-tight " + (isBrts ? "text-crit" : isViol ? "text-warn" : "text-foreground")}>
                              {isBrts ? "🚨 BRTS INTRUSION" : isViol ? "⚠️ LANE VIOLATION" : e.event.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="num text-[10px] text-muted-foreground font-mono">{fmtTime(e.ts)}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex justify-between items-center">
                            <span className="capitalize font-medium text-foreground/80">{e.objectClass}</span>
                            <span className="num font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{e.confidence}% conf</span>
                          </div>
                          {e.note && <div className="text-[10px] text-muted-foreground font-mono">{e.note.replace(/Carriageway/gi, "Lane 1")}</div>}
                        </div>
                      );
                    })}
                    {focusedEvents.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Connecting to live vision detector...</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Toggle({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode; }) {
  return (
    <button onClick={onClick} className={"num flex items-center gap-2 px-4 py-2 text-[11px] font-semibold rounded-lg transition-all " + (active ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:bg-white/5")}>
      {icon}
      {label}
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string; }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="label-xs text-muted-foreground">{label}</div>
      <div className="num text-sm font-semibold tracking-tight">{value}</div>
    </div>
  );
}
