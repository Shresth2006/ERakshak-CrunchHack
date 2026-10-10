import { useState, useRef, useEffect } from "react";
import { AppShell } from "./AppShell";
import { TopStatusBar } from "./TopStatusBar";
import { MapPanel } from "./MapPanel";
import { KPIPanel } from "./KPIPanel";
import { JunctionDrawer } from "./JunctionDrawer";
import { AlertsFeed } from "./AlertsFeed";
import { useTrafficData } from "@/hooks/useTrafficData";
import { getRoadDensityColor, getRoadDensityBadgeText } from "@/lib/signal-intelligence";
import { Activity, Clock, ChevronRight, Cpu } from "lucide-react";

export function CommandCentre() {
  const { junctions, kpis, queue, alerts, predictions, stats, connected, getJunction } =
    useTrafficData();
  const [selected, setSelected] = useState<string | null>(null);

  // Synchronize KPI sidebar height to square map so space is never wasted
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  const mapColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapColRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setMapHeight(Math.round(entry.contentRect.height));
        }
      }
    });
    ro.observe(mapColRef.current);
    return () => ro.disconnect();
  }, []);

  // Summary counts of road density states across all signals
  const densityCounts = {
    free: junctions.filter((j) => (j.congestionIndex || 0) < 45).length,
    moderate: junctions.filter((j) => (j.congestionIndex || 0) >= 45 && (j.congestionIndex || 0) < 65).length,
    heavy: junctions.filter((j) => (j.congestionIndex || 0) >= 65 && (j.congestionIndex || 0) < 80).length,
    critical: junctions.filter((j) => (j.congestionIndex || 0) >= 80).length,
  };

  return (
    <AppShell>
      <TopStatusBar
        junctionsOnline={stats.junctionsOnline}
        intrusions={stats.activeIntrusions}
        avgCongestion={stats.avgCongestion}
        connected={connected}
      />

      {/* Main layout */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-3">

        {/* Map & KPI Grid */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] items-start">
          {/* Map Column */}
          <div ref={mapColRef} className="w-full aspect-[4/3]">
            <MapPanel junctions={junctions} selectedId={selected} onSelect={setSelected} />
          </div>

          {/* KPI + charts scrollable sidebar matching map height */}
          <div
            className="overflow-y-auto pr-1"
            style={{
              height: mapHeight ? `${mapHeight}px` : undefined,
              maxHeight: mapHeight ? `${mapHeight}px` : undefined,
            }}
          >
            <KPIPanel kpis={kpis} queue={queue} />
          </div>
        </div>

        {/* Alerts feed */}
        <div className="shrink-0">
          <AlertsFeed alerts={alerts} predictions={predictions} onSelectJunction={setSelected} />
        </div>
      </div>

      {/* Full Signal Telemetry, Density, Timer History & AI Learning Report Inspector */}
      <JunctionDrawer junction={getJunction(selected)} onClose={() => setSelected(null)} />
    </AppShell>
  );
}
