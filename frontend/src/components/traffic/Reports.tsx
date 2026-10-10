import React, { useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import { AppShell } from "./AppShell";
import { TopStatusBar } from "./TopStatusBar";
import { ExportModal } from "./ExportModal";
import { useTrafficData } from "@/hooks/useTrafficData";
import { useReportsData } from "@/hooks/useReportsData";
import { ReportsKpiRow } from "./reports/ReportsKpiRow";
import { ReportsChartsRow } from "./reports/ReportsChartsRow";
import { ReportsHeatmapRow } from "./reports/ReportsHeatmapRow";
import { AdaptiveBenefitPanel } from "./reports/AdaptiveBenefitPanel";
import { RecommendationsTable } from "./reports/RecommendationsTable";
import { JunctionPerformanceTable } from "./reports/JunctionPerformanceTable";
import { JunctionDetailDrawer } from "./reports/JunctionDetailDrawer";
import { ReportsSecondaryTabs } from "./reports/ReportsSecondaryTabs";

type SubTab =
  | "OVERVIEW"
  | "CONGESTION"
  | "SIGNALS"
  | "ENFORCEMENT"
  | "INCIDENTS"
  | "RECOMMENDATIONS"
  | "SYSTEM HEALTH";

export function Reports() {
  const { stats, connected } = useTrafficData();
  const [activeTab, setActiveTab] = useState<SubTab>("OVERVIEW");
  const [exportOpen, setExportOpen] = useState(false);

  const {
    range,
    setRange,
    compare,
    setCompare,
    zone,
    setZone,
    corridor,
    setCorridor,
    delayScope,
    setDelayScope,
    heatmapMetric,
    setHeatmapMetric,
    summary,
    delaySeries,
    losDistribution,
    violations,
    heatmapRows,
    bottlenecks,
    adaptiveBenefit,
    junctions,
    recommendations,
    drawerJunction,
    drawerOpen,
    setDrawerOpen,
    openJunctionDrawer,
    handleRecDecision,
    incidents,
    signals,
    systemHealth,
  } = useReportsData();

  // Click on KPI card routes directly to deep tab
  const handleKpiCardClick = (kpiId: string) => {
    if (
      kpiId === "network_delay" ||
      kpiId === "avg_delay" ||
      kpiId === "throughput" ||
      kpiId === "congested_junctions" ||
      kpiId === "green_wave"
    ) {
      setActiveTab("CONGESTION");
    } else if (kpiId === "open_incidents") {
      setActiveTab("INCIDENTS");
    } else if (kpiId === "violations" || kpiId === "intrusions") {
      setActiveTab("ENFORCEMENT");
    } else if (kpiId === "system_health" || kpiId === "carbon_reduction") {
      setActiveTab("SYSTEM HEALTH");
    }
  };

  const pendingRecsCount = recommendations.filter((r) => r.status === "PENDING").length;

  return (
    <AppShell>
      <TopStatusBar
        junctionsOnline={stats.junctionsOnline}
        intrusions={stats.activeIntrusions}
        avgCongestion={stats.avgCongestion}
        connected={connected}
        right={
          <button
            onClick={() => setExportOpen(true)}
            className="num flex items-center gap-1.5 border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground rounded-lg transition-all hover:bg-foreground hover:text-background shadow-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
        }
      />

      <div className="flex h-full w-full flex-col bg-[#0A0A0B] text-[#FFFFFF] overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {activeTab !== "OVERVIEW" && (
            <div className="flex items-center justify-between pb-2 border-b border-[#1C1C20]">
              <button
                onClick={() => setActiveTab("OVERVIEW")}
                className="flex items-center gap-2 text-xs font-mono text-[#A1A1A8] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview Report
              </button>
              <span className="font-mono text-xs uppercase text-[#E8A838] font-semibold">
                Viewing: {activeTab}
              </span>
            </div>
          )}

          {activeTab === "OVERVIEW" && (
            <>
              {/* Row 1: 6 KPI Cards */}
              <ReportsKpiRow
                kpis={summary.kpis}
                onCardClick={handleKpiCardClick}
              />

              {/* Row 2: 3 Charts */}
              <ReportsChartsRow
                delaySeries={delaySeries}
                delayScope={delayScope}
                setDelayScope={setDelayScope}
                losBlocks={losDistribution}
                violations={violations}
                onOpenCongestion={() => setActiveTab("CONGESTION")}
                onOpenEnforcement={() => setActiveTab("ENFORCEMENT")}
              />

              {/* Row 3: Heatmap (2/3) + Top Bottlenecks (1/3) */}
              <ReportsHeatmapRow
                heatmapRows={heatmapRows}
                bottlenecks={bottlenecks}
                heatmapMetric={heatmapMetric}
                setHeatmapMetric={setHeatmapMetric}
                onSelectJunction={openJunctionDrawer}
              />

              {/* Row 4: Adaptive Benefit Panel */}
              <AdaptiveBenefitPanel data={adaptiveBenefit} />

              {/* Row 5: AI Recommendations Table */}
              <RecommendationsTable
                recommendations={recommendations}
                onDecision={handleRecDecision}
                onSelectJunction={openJunctionDrawer}
              />

              {/* Row 6: Junction Performance Report Table */}
              <JunctionPerformanceTable
                junctions={junctions}
                onSelectJunction={openJunctionDrawer}
              />
            </>
          )}

          {activeTab === "RECOMMENDATIONS" && (
            <div className="space-y-6">
              <RecommendationsTable
                recommendations={recommendations}
                onDecision={handleRecDecision}
                onSelectJunction={openJunctionDrawer}
              />
            </div>
          )}

          {activeTab !== "OVERVIEW" && activeTab !== "RECOMMENDATIONS" && (
            <ReportsSecondaryTabs
              activeTab={activeTab}
              incidents={incidents}
              signals={signals}
              systemHealth={systemHealth}
              onSelectJunction={openJunctionDrawer}
              onExportPdf={() => setExportOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Junction Detail Drawer */}
      <JunctionDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={drawerJunction}
      />

      {/* Export Report Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        range={range}
        setRange={setRange}
        compare={compare}
        setCompare={setCompare}
        zone={zone}
        setZone={setZone}
        corridor={corridor}
        setCorridor={setCorridor}
      />
    </AppShell>
  );
}
