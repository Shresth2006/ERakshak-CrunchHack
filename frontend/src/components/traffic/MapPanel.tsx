import { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers, Eye, Siren,
  CheckCircle2, RotateCcw
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

const densClass = (d: number) => (d < 45 ? "free" : d <= 65 ? "mod" : d <= 80 ? "heavy" : "grid");

interface SignalItem {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  dens: number;
  phase: "green" | "amber" | "red";
  remaining: number;
  visible: boolean;
  lanes?: any[];
  isPreempted?: boolean;
  isHeld?: boolean;
  marker?: any;
  halo?: any;
}

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
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const signalsRef = useRef<SignalItem[]>([]);
  const polylinesRef = useRef<{ [key: string]: any[] }>({});
  const initialFittedRef = useRef<boolean>(false);

  const [activeLaneIds, setActiveLaneIds] = useState<string[]>([
    "LANE-BRTS",
    "LANE-RING",
    "LANE-EMERGENCY",
  ]);
  const [activeFilter, setActiveFilter] = useState<"all" | "heavy" | "red" | "green">("all");
  const [showLanesPanel, setShowLanesPanel] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  const [mapTheme, setMapTheme] = useState<"tactical" | "grayscale">("tactical");

  // ── Ambulance Emergency Wave State ─────────────────────
  const [ambulanceActive, setAmbulanceActive] = useState(false);
  const [ambulanceProgress, setAmbulanceProgress] = useState(0);
  const [ambulanceArrived, setAmbulanceArrived] = useState(false);
  const ambulanceMarkerRef = useRef<any>(null);
  const ambulancePathLinesRef = useRef<any[]>([]);
  const animFrameRef = useRef<any>(null);

  // Preemption targets along emergency corridor
  const currentWaypointIndex = Math.floor(ambulanceProgress);
  const upcomingJunction = AMBULANCE_ROUTE[Math.min(AMBULANCE_ROUTE.length - 1, currentWaypointIndex + 1)];
  const nextUpcomingJunction = AMBULANCE_ROUTE[Math.min(AMBULANCE_ROUTE.length - 1, currentWaypointIndex + 2)];

  // ── Marker HTML Builder (Section 5.1) ─────────────────
  const markerHTML = useCallback((s: SignalItem, isSelected: boolean) => {
    const coreText = s.isPreempted ? "GO" : s.isHeld ? "STOP" : `${s.remaining}s`;
    return `
      <div class="sig p-${s.phase} d-${densClass(s.dens)}${isSelected ? " is-selected" : ""}">
        <div class="sig__ring"><div class="sig__core">${coreText}</div></div>
        <div class="sig__pill">${Math.round(s.dens)}% DENS</div>
      </div>
    `;
  }, []);

  // ── Halo Spec (Section 6) ─────────────────────────────
  const haloSpec = useCallback((s: SignalItem) => {
    const c = densClass(s.dens);
    if (c !== "heavy" && c !== "grid") return null; // No halo below 65%
    const col = c === "grid" ? "#ef4444" : "#f97316";
    return {
      radius: 26 + (s.dens - 65) * 1.4,
      style: {
        color: col,
        weight: 1,
        opacity: 0.35,
        fillColor: col,
        fillOpacity: 0.14,
      },
    };
  }, []);

  // ── Paint Halo (Section 6) ────────────────────────────
  const paintHalo = useCallback((s: SignalItem) => {
    if (!s.halo) return;
    const h = haloSpec(s);
    if (!h || !s.visible) {
      s.halo.setStyle({ opacity: 0, fillOpacity: 0 });
      return;
    }
    s.halo.setRadius(h.radius);
    s.halo.setStyle(h.style);
  }, [haloSpec]);

  // ── Zero-Flicker Marker Paint (Section 5.3) ────────────
  const paint = useCallback((s: SignalItem, isSelected: boolean) => {
    if (!s.marker) return;
    const el = s.marker.getElement();
    if (!el) return;
    const root = el.querySelector(".sig");
    if (!root) return;

    root.className = `sig p-${s.phase} d-${densClass(s.dens)}${isSelected ? " is-selected" : ""}${
      s.visible ? "" : " is-hidden"
    }`;

    const core = root.querySelector(".sig__core");
    if (core) {
      core.textContent = s.isPreempted ? "GO" : s.isHeld ? "STOP" : `${s.remaining}s`;
    }

    const pill = root.querySelector(".sig__pill");
    if (pill) {
      pill.textContent = `${Math.round(s.dens)}% DENS`;
    }

    // Update z-index offset by severity
    const zOffset = Math.round(s.dens * 10) + (s.phase === "red" ? 500 : 0) + (isSelected ? 2000 : 0);
    s.marker.setZIndexOffset(zOffset);
  }, []);

  // ── Zoom Scale (Section 7.2) ──────────────────────────
  const applyZoomScale = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const z = map.getZoom();
    const scale = z <= 11 ? 0.6 : z <= 12 ? 0.75 : z <= 13 ? 0.9 : 1;
    const container = map.getContainer();
    container.style.setProperty("--sig-scale", String(scale));
    container.classList.toggle("labels-off", z < 12);
  }, []);

  // ── Collision Detection & Declutter (Section 7.3) ─────
  const overlap = (a: DOMRect, b: DOMRect) =>
    !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

  const declutter = useCallback(() => {
    const vis = signalsRef.current.filter((s) => s.visible && s.marker && s.marker.getElement());
    const rings = vis
      .map((s) => {
        const ringEl = s.marker.getElement()?.querySelector(".sig__ring");
        return { id: s.id, r: ringEl ? ringEl.getBoundingClientRect() : null };
      })
      .filter((item): item is { id: string; r: DOMRect } => item.r !== null);

    const placed: DOMRect[] = [];

    [...vis]
      .sort((a, b) => b.dens - a.dens)
      .forEach((s) => {
        const pill = s.marker.getElement()?.querySelector(".sig__pill");
        if (!pill) return;
        pill.classList.remove("is-collapsed");
        const r = pill.getBoundingClientRect();
        if (!r.width || !r.height) return;

        const hitsRing = rings.some((o) => o.id !== s.id && overlap(r, o.r));
        const hitsPill = placed.some((p) => overlap(r, p));

        if (hitsRing || hitsPill) {
          pill.classList.add("is-collapsed");
        } else {
          placed.push(r);
        }
      });
  }, []);

  const rafRef = useRef<number | null>(null);
  const scheduleDeclutter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      declutter();
    });
  }, [declutter]);

  // ── Filter Evaluation (Section 9) ──────────────────────
  const evaluateVisibility = useCallback((s: SignalItem, filterType: "all" | "heavy" | "red" | "green") => {
    if (filterType === "heavy") return s.dens > 75;
    if (filterType === "red") return s.phase === "red";
    if (filterType === "green") return s.phase === "green";
    return true;
  }, []);

  // ── Initialize Leaflet Map (Section 3.2 & 4) ────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      leafletRef.current = L;
      if (mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current!, {
        center: [21.1850, 72.8300],
        zoom: 13.5,
        zoomControl: false,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        attributionControl: true,
      });

      // Basemap tile layer: plain OSM tiles with filter handled strictly on .leaflet-tile-pane in CSS
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Section 8.5: Zoom control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Section 6: Create halos pane below markers (markers are 600, overlays 400)
      map.createPane("halos").style.zIndex = 450;

      mapInstanceRef.current = map;

      map.on("zoomend", () => {
        applyZoomScale();
        scheduleDeclutter();
      });

      applyZoomScale();
      scheduleDeclutter();

      setTimeout(() => { map.invalidateSize(); }, 100);
      setTimeout(() => { map.invalidateSize(); }, 350);
    });

    const handleResize = () => {
      scheduleDeclutter();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [applyZoomScale, scheduleDeclutter]);

  // ── Build / Update Signals & Markers ───────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L || junctions.length === 0) return;

    // Convert raw junctions to signals with ambulance preemption overrides
    const updatedSignals: SignalItem[] = junctions.map((j) => {
      const isUpcoming =
        ambulanceActive &&
        ((upcomingJunction && j.id === upcomingJunction.id) ||
          (nextUpcomingJunction && j.id === nextUpcomingJunction.id));
      const isCrossHeld = ambulanceActive && CROSS_STREET_JUNCTIONS_TO_HOLD.includes(j.id);

      const dens = j.congestionIndex ?? 50;
      let phase: "green" | "amber" | "red" =
        j.signalStatus === "GREEN" ? "green" : j.signalStatus === "YELLOW" ? "amber" : "red";
      let remaining = j.signalCountdown ?? 30;

      if (isUpcoming) {
        phase = "green";
        remaining = 60;
      } else if (isCrossHeld) {
        phase = "red";
        remaining = 45;
      }

      return {
        id: j.id,
        name: j.name,
        zone: j.zone,
        lat: j.lat,
        lng: j.lng,
        dens,
        phase,
        remaining,
        visible: true,
        lanes: j.lanes,
        isPreempted: isUpcoming,
        isHeld: isCrossHeld,
      };
    });

    // Check if markers already exist to update in place (zero flicker)
    const existingSignals = signalsRef.current;
    const hasExisting = existingSignals.length > 0 && existingSignals[0]?.marker;

    if (!hasExisting) {
      // First-time creation
      signalsRef.current = updatedSignals.map((s) => {
        s.visible = evaluateVisibility(s, activeFilter);

        // Under-marker Halo (CircleMarker)
        const halo = L.circleMarker([s.lat, s.lng], {
          pane: "halos",
          interactive: false,
          radius: 0,
        }).addTo(map);
        s.halo = halo;

        // Custom divIcon Marker (Section 5.1)
        const icon = L.divIcon({
          className: "sig-icon",
          html: markerHTML(s, selectedId === s.id),
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const marker = L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: Math.round(s.dens * 10) + (s.phase === "red" ? 500 : 0) + (selectedId === s.id ? 2000 : 0),
        }).addTo(map);
        s.marker = marker;

        // Sleek Telemetry Tooltip on hover
        const densityColor = getRoadDensityColor(s.dens);
        const densityText = getRoadDensityBadgeText(s.dens);
        const sigColor = s.phase === "green" ? "#22c55e" : s.phase === "amber" ? "#f59e0b" : "#ef4444";
        const nLane = s.lanes?.[0]?.density ?? 0;
        const sLane = s.lanes?.[1]?.density ?? 0;
        const eLane = s.lanes?.[2]?.density ?? 0;
        const wLane = s.lanes?.[3]?.density ?? 0;

        const tooltipContent = `
          <div style="font-family:Inter,sans-serif;min-width:180px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:9px;font-weight:800;color:#a1a1aa;text-transform:uppercase;">${s.zone}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:${densityColor};background:${densityColor}20;padding:1px 5px;border-radius:4px;border:1px solid ${densityColor}50;">
                ${Math.round(s.dens)}% ${densityText}
              </span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#f4f4f5;margin-bottom:6px;">${s.name}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;margin-bottom:6px;background:#18181b;padding:4px 6px;border-radius:6px;border:1px solid #27272a;">
              <span style="color:${sigColor};font-weight:700;">● ${s.phase.toUpperCase()} PHASE</span>
              <span style="color:#ffffff;font-weight:800;">${s.remaining}s REMAINING</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;font-family:'JetBrains Mono',monospace;color:#a1a1aa;margin-bottom:6px;">
              <div>N: <b style="color:#fff">${nLane}%</b></div>
              <div>S: <b style="color:#fff">${sLane}%</b></div>
              <div>E: <b style="color:#fff">${eLane}%</b></div>
              <div>W: <b style="color:#fff">${wLane}%</b></div>
            </div>
            <div style="text-align:center;font-size:9px;color:#38bdf8;font-weight:700;letter-spacing:0.04em;">
              CLICK TO OPEN TELEMETRY →
            </div>
          </div>
        `;

        marker.bindTooltip(tooltipContent, {
          direction: "top",
          offset: [0, -22],
          className: "leaflet-tooltip-signal",
          opacity: 0.98,
        });

        marker.on("click", () => {
          onSelect(s.id);
        });

        paintHalo(s);
        return s;
      });

      // Initial Fit Bounds (Section 4)
      if (!initialFittedRef.current && signalsRef.current.length > 0) {
        const bounds = L.latLngBounds(signalsRef.current.map((s) => [s.lat, s.lng]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            paddingTopLeft: [40, 110], // clears top filter bar
            paddingBottomRight: [40, 40],
            maxZoom: 14,
          });
          map.setMinZoom(11);
          initialFittedRef.current = true;
        }
      }

      applyZoomScale();
      scheduleDeclutter();
    } else {
      // In-place update: zero DOM flash/flicker (Section 5.3)
      updatedSignals.forEach((upd) => {
        const existing = signalsRef.current.find((s) => s.id === upd.id);
        if (!existing) return;

        existing.dens = upd.dens;
        existing.phase = upd.phase;
        existing.remaining = upd.remaining;
        existing.isPreempted = upd.isPreempted;
        existing.isHeld = upd.isHeld;
        existing.visible = evaluateVisibility(existing, activeFilter);

        paint(existing, selectedId === existing.id);
        paintHalo(existing);
      });
      scheduleDeclutter();
    }
  }, [
    junctions,
    ambulanceActive,
    upcomingJunction,
    nextUpcomingJunction,
    selectedId,
    activeFilter,
    markerHTML,
    paint,
    paintHalo,
    evaluateVisibility,
    applyZoomScale,
    scheduleDeclutter,
    onSelect,
  ]);

  // ── Handle Filter Chip Click (Section 9) ───────────────
  const handleFilterClick = (filter: "all" | "heavy" | "red" | "green") => {
    setActiveFilter(filter);
    signalsRef.current.forEach((s) => {
      s.visible = evaluateVisibility(s, filter);
      paint(s, selectedId === s.id);
      paintHalo(s);
    });
    scheduleDeclutter();
  };

  // ── Highlighted Polylines for Surat GIS Corridors ──────
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
        weight: 8,
        opacity: 0.3,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const coreLine = L.polyline(lane.coordinates, {
        color: lane.color,
        weight: 3,
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
      zIndexOffset: 3000,
    }).addTo(map);
    ambulanceMarkerRef.current = ambMarker;

    map.flyTo([21.1920, 72.8350], 13.5, { duration: 1 });

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
    <div
      className="map-shell relative flex h-full w-full aspect-[4/3] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0c0f]"
      data-basemap={mapTheme === "grayscale" ? "grey" : "dark"}
    >
      {/* ── Leaflet Canvas (Section 8.1 Sibling Layout) ─────── */}
      <div ref={mapContainerRef} id="map" className="absolute inset-0 z-0 bg-[#0b0c0f]" />

      {/* ── HUD Top-Left: Filter Chips (Section 8.2 & 9) ───── */}
      <div className="hud hud-tl panel-hud filters" role="toolbar" aria-label="Signal filters">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
        </svg>
        <span className="filters__label">Signals:</span>
        <button
          className={`chip ${activeFilter === "all" ? "is-active" : ""}`}
          onClick={() => handleFilterClick("all")}
        >
          All
        </button>
        <button
          className={`chip ${activeFilter === "heavy" ? "is-active" : ""}`}
          onClick={() => handleFilterClick("heavy")}
        >
          Heavy &gt;75%
        </button>
        <button
          className={`chip ${activeFilter === "red" ? "is-active" : ""}`}
          onClick={() => handleFilterClick("red")}
        >
          Red lights
        </button>
        <button
          className={`chip ${activeFilter === "green" ? "is-active" : ""}`}
          onClick={() => handleFilterClick("green")}
        >
          Green waves
        </button>
      </div>

      {/* ── HUD Top-Right: Controls & Corridors (Section 8.3) ── */}
      <div className="hud hud-tr">

        {/* Ambulance Demo Button */}
        <button
          onClick={toggleAmbulanceDemo}
          className={`btn-hud btn--ambulance ${ambulanceActive ? "is-active" : ""}`}
          id="ambulanceBtn"
        >
          <span>🚑 Ambulance demo</span>
          {ambulanceActive && <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />}
        </button>

        {/* Corridors Toggle Button */}
        <button
          onClick={() => setShowLanesPanel((prev) => !prev)}
          className="btn-hud panel-hud"
          id="corridorsBtn"
        >
          <Layers className="h-4 w-4 text-zinc-400" />
          <span>Corridors</span>
          <span className="badge-hud">{activeLaneIds.length}</span>
        </button>
      </div>

      {/* ── Corridor Layers Drawer ───────────────────────────── */}
      {showLanesPanel && (
        <div className="absolute top-14 right-3 z-[600] w-64 rounded-xl bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-3 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
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
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${
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

      {/* ── HUD Bottom-Left: Color Coding Legend (Section 8.4) ── */}
      <section
        className={`hud hud-bl panel-hud legend ${legendCollapsed ? "is-collapsed" : ""}`}
        id="legend"
        aria-label="Colour coding legend"
      >
        <button
          className="legend__head"
          id="legendToggle"
          aria-expanded={!legendCollapsed}
          onClick={() => setLegendCollapsed((prev) => !prev)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4aa3ff" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v5h1" />
          </svg>
          <span>Color coding legend</span>
          <svg
            className="legend__chev"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <div className="legend__body">
          <h4>Inner core = traffic light phase</h4>
          <ul className="legend__row">
            <li><i style={{ background: "var(--phase-green)" }} />Green (Go)</li>
            <li><i style={{ background: "var(--phase-amber)" }} />Amber (Clear)</li>
            <li><i style={{ background: "var(--phase-red)" }} />Red (Stop)</li>
          </ul>

          <h4>Outer ring &amp; pill = road density</h4>
          <ul className="legend__grid">
            <li><i style={{ background: "var(--d-free)" }} />Free Flow (&lt;45%)</li>
            <li><i style={{ background: "var(--d-mod)" }} />Moderate (45–65%)</li>
            <li><i style={{ background: "var(--d-heavy)" }} />Heavy (65–80%)</li>
            <li><i style={{ background: "var(--d-grid)" }} />Gridlock (&gt;80%)</li>
          </ul>
        </div>
      </section>

      {/* ── Active Ambulance Emergency HUD Overlay ─────────── */}
      {ambulanceActive && (
        <div className="absolute bottom-5 left-3 right-3 sm:right-auto sm:w-96 z-[550] rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-red-500/50 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_24px_rgba(239,68,68,0.25)] flex flex-col gap-2.5 animate-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 font-mono flex items-center gap-1.5">
                AI GREEN WAVE PREEMPTION
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {ambulanceArrived && (
                <button
                  onClick={resetAmbulanceDemo}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 transition-colors"
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
                Kapodra ➔ Piplod
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-400 uppercase">Dispatch Status</span>
              <span
                className={`font-bold text-[11px] flex items-center gap-1 ${
                  ambulanceArrived ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {ambulanceArrived ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Siren className="h-3.5 w-3.5 animate-bounce text-red-400" />
                )}
                {ambulanceArrived ? "REACHED SAFELY" : "CLEARING ROUTE"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300 px-0.5">
            <span className="text-emerald-400 font-bold flex items-center gap-1 truncate max-w-[210px]">
              <span>🟢</span> Next: {upcomingJunction ? upcomingJunction.name : "Destination Reached"}
            </span>
            <span className="text-zinc-400 shrink-0">⏱️ 4.8m saved via AI</span>
          </div>

          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 h-full transition-all duration-150"
              style={{
                width: `${(ambulanceProgress / (AMBULANCE_ROUTE.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── HUD Bottom-Right: Tactical / Grayscale Theme Toggle ── */}
      <div className="hud hud-br">
        <div className="flex items-center rounded-xl bg-zinc-950/85 backdrop-blur-md border border-white/10 p-0.5 shadow-2xl">
          <button
            onClick={() => setMapTheme("tactical")}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
              mapTheme === "tactical"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Tactical Dark Map (Inverted OSM)"
          >
            Tactical
          </button>
          <button
            onClick={() => setMapTheme("grayscale")}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 ${
              mapTheme === "grayscale"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Grayscale Dark Map (Monochrome OSM)"
          >
            Grayscale
          </button>
        </div>
      </div>
    </div>
  );
}
