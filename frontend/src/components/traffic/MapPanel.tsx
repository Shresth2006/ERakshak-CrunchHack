import { useEffect, useRef, useState } from "react";
import {
  Layers, Activity, Radio, Filter, Eye, Navigation, Siren,
  CheckCircle2, RotateCcw, Info, Sliders, ChevronDown, ChevronUp
} from "lucide-react";
import { SURAT_LANES } from "@/lib/mock-traffic";
import { getRoadDensityColor, getRoadDensityBadgeText } from "@/lib/signal-intelligence";
import type { Junction } from "@/lib/traffic-types";

// Emergency route from Top-Right (Kapodra) to Bottom-Left (Piplod)
const AMBULANCE_ROUTE = [
  { id: "JN-18", name: "Kapodra Junction", lat: 21.2270, lng: 72.8850 },
  { id: "JN-11", name: "Hirabaug Circle", lat: 21.2185, lng: 72.8710 },
  { id: "JN-05", name: "Varachha / Sardar Chowk", lat: 21.2150, lng: 72.8600 },
  { id: "JN-20", name: "Station Circle", lat: 21.2050, lng: 72.8410 },
  { id: "JN-02", name: "Ring Road / Delhi Gate", lat: 21.2005, lng: 72.8385 },
  { id: "JN-09", name: "Majura Gate Circle", lat: 21.1798, lng: 72.8188 },
  { id: "JN-07", name: "Athwalines / Athwa Gate", lat: 21.1834, lng: 72.8092 },
  { id: "JN-08", name: "Dumas Road / SVNIT Circle", lat: 21.1650, lng: 72.7840 },
  { id: "JN-04", name: "Piplod Junction", lat: 21.1550, lng: 72.7750 },
];

// Cross-traffic junctions held on RED to clear conflicting traffic
const CROSS_STREET_JUNCTIONS_TO_HOLD = ["JN-01", "JN-10", "JN-14", "JN-17", "JN-21"];

export function MapPanel({
  junctions,
  selectedId,
  onSelect,
}: {
  junctions: Junction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const polylinesRef = useRef<{ [key: string]: any[] }>({});

  const [activeLaneIds, setActiveLaneIds] = useState<string[]>([
    "LANE-BRTS",
    "LANE-RING",
    "LANE-EMERGENCY",
  ]);
  const [signalFilter, setSignalFilter] = useState<"all" | "critical" | "red" | "green">("all");
  const [visMode, setVisMode] = useState<"combined" | "density" | "signal">("combined");
  const [showLanesPanel, setShowLanesPanel] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // ── Ambulance Emergency Wave State ─────────────────────
  const [ambulanceActive, setAmbulanceActive] = useState(false);
  const [ambulanceProgress, setAmbulanceProgress] = useState(0);
  const [ambulanceArrived, setAmbulanceArrived] = useState(false);
  const ambulanceMarkerRef = useRef<any>(null);
  const ambulancePathLinesRef = useRef<any[]>([]);
  const animFrameRef = useRef<any>(null);

  // Determine current preemption targets
  const currentWaypointIndex = Math.floor(ambulanceProgress);
  const upcomingJunction = AMBULANCE_ROUTE[Math.min(AMBULANCE_ROUTE.length - 1, currentWaypointIndex + 1)];
  const nextUpcomingJunction = AMBULANCE_ROUTE[Math.min(AMBULANCE_ROUTE.length - 1, currentWaypointIndex + 2)];

  // Apply dynamic AI green wave overrides to junctions
  const processedJunctions = junctions.map((j) => {
    if (!ambulanceActive) return j;

    const isUpcoming = (upcomingJunction && j.id === upcomingJunction.id) ||
                       (nextUpcomingJunction && j.id === nextUpcomingJunction.id);
    const isCrossHeld = CROSS_STREET_JUNCTIONS_TO_HOLD.includes(j.id);

    if (isUpcoming) {
      return {
        ...j,
        signalStatus: "GREEN" as const,
        signalCountdown: 60,
        isPreempted: true,
      } as Junction & { isPreempted?: boolean; isHeld?: boolean };
    }

    if (isCrossHeld) {
      return {
        ...j,
        signalStatus: "RED" as const,
        signalCountdown: 45,
        isHeld: true,
      } as Junction & { isPreempted?: boolean; isHeld?: boolean };
    }

    return j as Junction & { isPreempted?: boolean; isHeld?: boolean };
  });

  // Filter junctions based on selected filter tag
  const filteredJunctions = processedJunctions.filter((j) => {
    if (signalFilter === "critical") return (j.congestionIndex || 0) > 75;
    if (signalFilter === "red") return j.signalStatus === "RED";
    if (signalFilter === "green") return j.signalStatus === "GREEN";
    return true;
  });

  const [mapTheme, setMapTheme] = useState<"tactical" | "grayscale">("tactical");

  // Helper to build tile layer dynamically based on theme (100% free, zero watermarks, no API key)
  const createTileLayer = (L: any, theme: "tactical" | "grayscale") => {
    return L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        className: theme === "grayscale" ? "grayscale-map-tiles" : "dark-map-tiles",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );
  };

  // Initialize Leaflet Map dynamically
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      leafletRef.current = L;
      if (mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current!, {
        center: [21.1850, 72.8300],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const tile = createTileLayer(L, mapTheme);
      tile.addTo(map);
      tileRef.current = tile;
      mapInstanceRef.current = map;

      setTimeout(() => { map.invalidateSize(); }, 100);
      setTimeout(() => { map.invalidateSize(); }, 400);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer dynamically when Map Theme changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // Fast path: toggle class name directly on tile container to switch instantly without reloading
    if (tileRef.current && typeof tileRef.current.getContainer === "function") {
      const container = tileRef.current.getContainer();
      if (container) {
        if (mapTheme === "grayscale") {
          container.classList.remove("dark-map-tiles");
          container.classList.add("grayscale-map-tiles");
        } else {
          container.classList.remove("grayscale-map-tiles");
          container.classList.add("dark-map-tiles");
        }
        return;
      }
    }

    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }

    const newLayer = createTileLayer(L, mapTheme);
    newLayer.addTo(map);
    tileRef.current = newLayer;
    if (newLayer.bringToBack) {
      newLayer.bringToBack();
    }
  }, [mapTheme]);

  // Resize Observer
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Ambulance Simulation Loop ─────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (!ambulanceActive) {
      if (ambulanceMarkerRef.current) {
        ambulanceMarkerRef.current.remove();
        ambulanceMarkerRef.current = null;
      }
      ambulancePathLinesRef.current.forEach((line) => line.remove());
      ambulancePathLinesRef.current = [];
      setAmbulanceProgress(0);
      setAmbulanceArrived(false);
      if (animFrameRef.current) {
        clearInterval(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    ambulancePathLinesRef.current.forEach((line) => line.remove());
    ambulancePathLinesRef.current = [];

    const routeLatLngs = AMBULANCE_ROUTE.map((w) => [w.lat, w.lng]);

    const glowPath = L.polyline(routeLatLngs, {
      color: "#22c55e",
      weight: 12,
      opacity: 0.35,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    const corePath = L.polyline(routeLatLngs, {
      color: "#4ade80",
      weight: 4,
      opacity: 0.95,
      dashArray: "8, 8",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    ambulancePathLinesRef.current = [glowPath, corePath];

    const startPoint = AMBULANCE_ROUTE[0];
    if (!startPoint) return;

    const ambulanceIcon = L.divIcon({
      className: "custom-leaflet-ambulance-marker",
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(239,68,68,0.35);animation:ts-pulse-ring 1.5s cubic-bezier(0.2,0.6,0.4,1) infinite;"></div>
          <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(56,189,248,0.4);animation:ts-pulse-ring 1.5s cubic-bezier(0.2,0.6,0.4,1) infinite;animation-delay:0.75s;"></div>
          <div style="position:relative;width:36px;height:36px;border-radius:12px;background:#09090b;border:2px solid #ef4444;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(239,68,68,0.8),0 0 30px rgba(56,189,248,0.5);">
            <span style="font-size:18px;line-height:1;transform:scaleX(-1);">🚑</span>
          </div>
          <div style="position:absolute;top:-26px;white-space:nowrap;background:rgba(9,9,11,0.95);border:1px solid #ef4444;color:#fecaca;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.8);letter-spacing:0.04em;display:flex;align-items:center;gap:4px;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;animation:ts-blink 0.8s infinite;"></span>
            AMBULANCE 108 · GREEN WAVE
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (ambulanceMarkerRef.current) {
      ambulanceMarkerRef.current.remove();
    }
    const ambMarker = L.marker([startPoint.lat, startPoint.lng], {
      icon: ambulanceIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    ambulanceMarkerRef.current = ambMarker;

    map.flyTo([21.1920, 72.8350], 13, { duration: 1 });

    let currentP = 0;
    const maxP = AMBULANCE_ROUTE.length - 1;
    const stepDuration = 60;
    const stepIncrement = 0.024;

    animFrameRef.current = setInterval(() => {
      currentP += stepIncrement;
      if (currentP >= maxP) {
        currentP = maxP;
        setAmbulanceProgress(maxP);
        setAmbulanceArrived(true);
        const lastPt = AMBULANCE_ROUTE[maxP];
        if (lastPt) {
          ambMarker.setLatLng([lastPt.lat, lastPt.lng]);
        }
        clearInterval(animFrameRef.current);
        animFrameRef.current = null;
        return;
      }

      const idx = Math.floor(currentP);
      const frac = currentP - idx;
      const p1 = AMBULANCE_ROUTE[idx];
      const p2 = AMBULANCE_ROUTE[Math.min(maxP, idx + 1)];
      if (!p1 || !p2) return;

      const currLat = p1.lat + frac * (p2.lat - p1.lat);
      const currLng = p1.lng + frac * (p2.lng - p1.lng);

      ambMarker.setLatLng([currLat, currLng]);
      setAmbulanceProgress(currentP);
    }, stepDuration);

    return () => {
      if (animFrameRef.current) {
        clearInterval(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [ambulanceActive]);

  // ── Render Enhanced Dual-Layer Markers ───────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    filteredJunctions.forEach((j: any) => {
      const isSelected = selectedId === j.id;
      const isPreempted = !!j.isPreempted;
      const isHeld = !!j.isHeld;

      const density = j.congestionIndex || 50;
      const densityColor = getRoadDensityColor(density);
      const densityText = getRoadDensityBadgeText(density);

      const sigColor =
        j.signalStatus === "GREEN"
          ? "#22c55e"
          : j.signalStatus === "YELLOW"
          ? "#f59e0b"
          : "#ef4444";

      const showCriticalPulse = density > 75 || isPreempted;
      const outerSize = isSelected ? 42 : 36;
      const innerSize = isSelected ? 28 : 24;

      // HTML for the Dual-Ring Marker
      const customIcon = L.divIcon({
        className: "custom-leaflet-dual-marker",
        html: `
          <div class="signal-marker-dual" style="width:${outerSize}px;height:${outerSize + 14}px">
            ${
              showCriticalPulse
                ? `<div style="position:absolute;width:${outerSize + 12}px;height:${outerSize + 12}px;top:-6px;border-radius:50%;background:${densityColor}30;animation:ts-pulse-ring 1.8s infinite;border:1px solid ${densityColor}60;"></div>`
                : ""
            }

            <!-- Outer Road Density Ring -->
            <div style="
              width:${outerSize}px;
              height:${outerSize}px;
              border-radius:50%;
              background:#09090b;
              border: 3px solid ${densityColor};
              display:flex;
              align-items:center;
              justify-content:center;
              box-shadow: 0 0 14px ${densityColor}50, inset 0 0 6px rgba(0,0,0,0.8);
              ${isSelected ? "outline: 3px solid #00f4ff; outline-offset: 2px;" : ""}
            ">
              <!-- Inner Traffic Light LED Bulb -->
              <div style="
                width:${innerSize}px;
                height:${innerSize}px;
                border-radius:50%;
                background:${sigColor};
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow: 0 0 10px ${sigColor};
              ">
                <span style="
                  font-family:'JetBrains Mono',monospace;
                  font-size:10px;
                  font-weight:900;
                  color:#000000;
                  line-height:1;
                ">
                  ${isPreempted ? "GO" : isHeld ? "STOP" : `${j.signalCountdown}s`}
                </span>
              </div>
            </div>

            <!-- Road Density Pill Badge -->
            <div style="
              margin-top:2px;
              white-space:nowrap;
              background:#09090b;
              border:1px solid ${densityColor}90;
              color:${densityColor};
              font-family:'JetBrains Mono',monospace;
              font-size:9px;
              font-weight:800;
              padding:1px 4px;
              border-radius:4px;
              box-shadow:0 2px 8px rgba(0,0,0,0.9);
              letter-spacing:0.02em;
            ">
              ${density}% DENS
            </div>
          </div>
        `,
        iconSize: [outerSize, outerSize + 14],
        iconAnchor: [outerSize / 2, (outerSize + 14) / 2],
      });

      const marker = L.marker([j.lat, j.lng], { icon: customIcon }).addTo(map);

      // Sleek Glassmorphism Hover Tooltip
      const nLane = j.lanes?.[0]?.density ?? 0;
      const sLane = j.lanes?.[1]?.density ?? 0;
      const eLane = j.lanes?.[2]?.density ?? 0;
      const wLane = j.lanes?.[3]?.density ?? 0;

      const tooltipContent = `
        <div style="font-family:Inter,sans-serif;min-width:180px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:9px;font-weight:800;color:#a1a1aa;text-transform:uppercase;">${j.zone}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:${densityColor};background:${densityColor}20;padding:1px 5px;border-radius:4px;border:1px solid ${densityColor}50;">
              ${density}% ${densityText}
            </span>
          </div>
          <div style="font-size:12px;font-weight:700;color:#f4f4f5;margin-bottom:6px;">${j.name}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;margin-bottom:6px;background:#18181b;padding:4px 6px;border-radius:6px;border:1px solid #27272a;">
            <span style="color:${sigColor};font-weight:700;">● ${j.signalStatus} PHASE</span>
            <span style="color:#ffffff;font-weight:800;">${j.signalCountdown}s REMAINING</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;font-family:'JetBrains Mono',monospace;color:#a1a1aa;margin-bottom:6px;">
            <div>N: <b style="color:#fff">${nLane}%</b></div>
            <div>S: <b style="color:#fff">${sLane}%</b></div>
            <div>E: <b style="color:#fff">${eLane}%</b></div>
            <div>W: <b style="color:#fff">${wLane}%</b></div>
          </div>
          <div style="text-align:center;font-size:9px;color:#38bdf8;font-weight:700;letter-spacing:0.04em;">
            TOUCH / CLICK TO OPEN TELEMETRY →
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -22],
        className: "leaflet-tooltip-signal",
        opacity: 0.98,
      });

      // Direct selection on touch/click: Opens the comprehensive Inspector immediately!
      marker.on("click", () => {
        onSelect(j.id);
      });

      markersRef.current[j.id] = marker;
    });
  }, [filteredJunctions, selectedId, visMode, onSelect]);

  // Update Highlighted Polylines for Lanes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    Object.values(polylinesRef.current).forEach((lines) =>
      lines.forEach((line) => line.remove())
    );
    polylinesRef.current = {};

    SURAT_LANES.forEach((lane) => {
      if (!activeLaneIds.includes(lane.id)) return;

      const glowLine = L.polyline(lane.coordinates, {
        color: lane.color,
        weight: 9,
        opacity: 0.3,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const coreLine = L.polyline(lane.coordinates, {
        color: lane.color,
        weight: 3.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        dashArray: lane.type === "emergency" ? "6, 6" : undefined,
      }).addTo(map);

      coreLine.bindTooltip(`<b>${lane.name}</b><br/>${lane.description}`, {
        sticky: true,
      });

      polylinesRef.current[lane.id] = [glowLine, coreLine];
    });
  }, [activeLaneIds]);

  const toggleLane = (id: string) => {
    setActiveLaneIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAmbulanceDemo = () => {
    setAmbulanceActive((prev) => !prev);
  };

  const resetAmbulanceDemo = () => {
    setAmbulanceActive(false);
    setTimeout(() => {
      setAmbulanceActive(true);
    }, 150);
  };

  return (
    <div className="relative flex h-full w-full aspect-[4/3] flex-col overflow-hidden bg-panel border border-border rounded-2xl">
      {/* Map Header Overlay Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Side: Filter Signals Badges */}
        <div className="flex items-center gap-1.5 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-800/90 px-2.5 py-1.5 shadow-2xl pointer-events-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-1 hidden sm:inline">
            Signals:
          </span>
          {[
            { id: "all" as const, label: "All" },
            { id: "critical" as const, label: "Heavy >75%" },
            { id: "red" as const, label: "Red Lights" },
            { id: "green" as const, label: "Green Waves" },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSignalFilter(filter.id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                signalFilter === filter.id
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800/60"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Right Side: Map Theme Toggle, Corridors & Ambulance Demo */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Map Basemap Style Toggle */}
          <div className="flex items-center rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 p-0.5 shadow-2xl">
            <button
              onClick={() => setMapTheme("tactical")}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                mapTheme === "tactical"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Tactical Dark Map (High-Contrast OSM)"
            >
              Tactical
            </button>
            <button
              onClick={() => setMapTheme("grayscale")}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
                mapTheme === "grayscale"
                  ? "bg-zinc-200 text-zinc-950 font-extrabold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Grayscale Dark Map (Monochrome Smooth Basemap)"
            >
              Grayscale
            </button>
          </div>

          {/* Ambulance Emergency Wave Button */}
          <button
            onClick={toggleAmbulanceDemo}
            className={`flex items-center gap-1.5 rounded-xl backdrop-blur-md px-3 py-1.5 text-xs font-semibold shadow-2xl transition-all active:scale-95 border ${
              ambulanceActive
                ? "bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse"
                : "bg-zinc-950/85 border-red-500/40 text-red-300 hover:text-white hover:bg-red-500/15 hover:border-red-400"
            }`}
            title="Demonstrate AI Emergency Green Wave Signal Preemption"
          >
            <span className="text-sm">🚑</span>
            <span className="hidden sm:inline font-mono uppercase tracking-wider text-[11px]">
              {ambulanceActive ? "Priority Active" : "Ambulance Demo"}
            </span>
            {ambulanceActive && (
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>

          {/* Corridors Layer Button */}
          <button
            onClick={() => setShowLanesPanel((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white hover:border-zinc-700 shadow-2xl transition-all active:scale-95"
          >
            <Layers className="h-3.5 w-3.5 text-zinc-400" />
            <span>Corridors</span>
            <span className="text-[10px] font-mono font-bold bg-zinc-800/90 text-zinc-300 px-1.5 py-0.5 rounded-md border border-zinc-700/60">
              {activeLaneIds.length}
            </span>
          </button>
        </div>
      </div>

      {/* Corridor Layers Dropdown Drawer */}
      {showLanesPanel && (
        <div className="absolute top-14 right-3 z-30 w-64 rounded-xl bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3 shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-xs font-bold text-zinc-200">Surat Dedicated Corridors</span>
            <span className="text-[10px] text-zinc-500 font-mono">GIS Layers</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {SURAT_LANES.map((lane) => {
              const active = activeLaneIds.includes(lane.id);
              return (
                <button
                  key={lane.id}
                  onClick={() => toggleLane(lane.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all ${
                    active
                      ? "border-zinc-700 bg-zinc-800/60 text-white font-medium"
                      : "border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: lane.color }}
                    />
                    <span className="truncate text-[11px]">{lane.name}</span>
                  </div>
                  <Eye
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                      active ? "text-white" : "text-zinc-600"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Interactive Map Legend */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-auto">
        <div className="rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-800/90 p-2.5 shadow-2xl transition-all max-w-[280px]">
          <div className="flex items-center justify-between gap-4 cursor-pointer" onClick={() => setShowLegend(v => !v)}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono">
              <Info className="h-3 w-3 text-sky-400" />
              <span>Color Coding Legend</span>
            </div>
            {showLegend ? <ChevronDown className="h-3 w-3 text-zinc-400" /> : <ChevronUp className="h-3 w-3 text-zinc-400" />}
          </div>

          {showLegend && (
            <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-2 text-[10px] font-mono animate-in fade-in duration-150">
              {/* Traffic Light State */}
              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-sans font-semibold block mb-1">
                  Inner Core = Traffic Light Phase
                </span>
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Green (Go)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Amber (Clear)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Red (Stop)
                  </span>
                </div>
              </div>

              {/* Road Density Scale */}
              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-sans font-semibold block mb-1">
                  Outer Ring & Pill = Road Density
                </span>
                <div className="grid grid-cols-2 gap-1 text-[9px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Free Flow (&lt;45%)
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Moderate (45-65%)
                  </span>
                  <span className="flex items-center gap-1 text-orange-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Heavy (65-80%)
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Gridlock (&gt;80%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active Ambulance Emergency HUD Overlay ─────────── */}
      {ambulanceActive && (
        <div className="absolute bottom-5 left-3 right-3 sm:right-auto sm:w-96 z-20 rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-red-500/50 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_24px_rgba(239,68,68,0.25)] flex flex-col gap-2.5 animate-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 font-mono flex items-center gap-1.5">
                AI GREEN WAVE PREEMPTION
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {ambulanceArrived && (
                <button
                  onClick={resetAmbulanceDemo}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase bg-ok/20 hover:bg-ok/30 text-ok px-2 py-0.5 rounded border border-ok/40 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Replay
                </button>
              )}
              <button
                onClick={() => setAmbulanceActive(false)}
                className="text-[10px] font-mono uppercase bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-0.5 rounded border border-red-500/40 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-zinc-900/80 p-2 rounded-xl border border-zinc-800/80 font-mono">
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-400 uppercase">Emergency Path</span>
              <span className="font-bold text-zinc-200 text-[11px] truncate">
                Kapodra (Top-Right) ➔ Piplod (Bottom-Left)
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-400 uppercase">Dispatch Status</span>
              <span className={`font-bold text-[11px] flex items-center gap-1 ${ambulanceArrived ? "text-ok" : "text-amber-400"}`}>
                {ambulanceArrived ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Siren className="h-3.5 w-3.5 animate-bounce text-red-400" />}
                {ambulanceArrived ? "REACHED SAFELY" : "CLEARING ROUTE"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300 px-0.5">
            <span className="text-ok font-bold flex items-center gap-1 truncate max-w-[210px]">
              <span>🟢</span> Next: {upcomingJunction ? upcomingJunction.name : "Destination Reached"}
            </span>
            <span className="text-zinc-400 shrink-0">
              ⏱️ 4.8m saved via AI
            </span>
          </div>

          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 h-full transition-all duration-150"
              style={{ width: `${(ambulanceProgress / (AMBULANCE_ROUTE.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Leaflet GIS Map Canvas */}
      <div ref={mapContainerRef} className="h-full w-full flex-1 min-h-0 z-0 bg-[#07090e]" />
    </div>
  );
}
