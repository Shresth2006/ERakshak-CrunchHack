import type {
  KpiCardData,
  DelayPoint,
  LosBlock,
  ViolationHour,
  HeatmapRowData,
  BottleneckRow,
  AdaptiveBenefitData,
  JunctionReportRow,
  RecommendationGrouped,
} from "@/hooks/useReportsData";
import { JUNCTIONS } from "./mock-traffic";

export const DEFAULT_SUMMARY_KPIS: KpiCardData[] = [
  {
    id: "avg_delay",
    label: "Average Delay",
    value: "24.2",
    unit: "s/veh",
    sub_label: "Network-wide average intersection delay",
    delta: -18.4,
    delta_formatted: "-18.4%",
    delta_is_good: true,
    status_dot: "green",
    icon: "Clock",
    sparkline: [34, 32, 30, 28, 26, 25, 24.2],
    tooltip: "Adaptive control delay savings vs fixed-cycle baseline",
  },
  {
    id: "green_wave",
    label: "Green Wave Efficiency",
    value: "89.6",
    unit: "%",
    sub_label: "Through corridor progression index",
    delta: 12.1,
    delta_formatted: "+12.1%",
    delta_is_good: true,
    status_dot: "green",
    icon: "Activity",
    sparkline: [72, 75, 78, 82, 85, 87, 89.6],
    tooltip: "Platoon throughput without mid-corridor stopping",
  },
  {
    id: "intrusions",
    label: "BRTS Intrusions",
    value: "2",
    unit: "events",
    sub_label: "Detected in dedicated bus lanes",
    delta: -60.0,
    delta_formatted: "-60.0%",
    delta_is_good: true,
    status_dot: "green",
    icon: "ShieldAlert",
    sparkline: [8, 6, 5, 4, 3, 2, 2],
    tooltip: "Automated YOLO camera corridor detection counts",
  },
  {
    id: "carbon_reduction",
    label: "Emissions Abated",
    value: "14.8",
    unit: "tonnes",
    sub_label: "Estimated fuel & idle emission reduction",
    delta: 8.2,
    delta_formatted: "+8.2%",
    delta_is_good: true,
    status_dot: "green",
    icon: "Leaf",
    sparkline: [9.2, 10.4, 11.5, 12.8, 13.6, 14.2, 14.8],
    tooltip: "Idle avoidance calculated via stop delay deltas",
  },
];

export const DEFAULT_DELAY_SERIES: DelayPoint[] = [
  { t: "00:00", adaptive: 14, baseline: 18, savings_s: 4, savings_pct: 22.2, vehicles_served: 420, is_peak: false },
  { t: "02:00", adaptive: 11, baseline: 15, savings_s: 4, savings_pct: 26.7, vehicles_served: 280, is_peak: false },
  { t: "04:00", adaptive: 12, baseline: 16, savings_s: 4, savings_pct: 25.0, vehicles_served: 310, is_peak: false },
  { t: "06:00", adaptive: 19, baseline: 26, savings_s: 7, savings_pct: 26.9, vehicles_served: 1150, is_peak: false },
  { t: "08:00", adaptive: 34, baseline: 46, savings_s: 12, savings_pct: 26.1, vehicles_served: 2840, is_peak: true },
  { t: "10:00", adaptive: 38, baseline: 52, savings_s: 14, savings_pct: 26.9, vehicles_served: 3120, is_peak: true },
  { t: "12:00", adaptive: 28, baseline: 37, savings_s: 9, savings_pct: 24.3, vehicles_served: 2240, is_peak: false },
  { t: "14:00", adaptive: 26, baseline: 34, savings_s: 8, savings_pct: 23.5, vehicles_served: 2190, is_peak: false },
  { t: "16:00", adaptive: 32, baseline: 42, savings_s: 10, savings_pct: 23.8, vehicles_served: 2650, is_peak: false },
  { t: "18:00", adaptive: 44, baseline: 62, savings_s: 18, savings_pct: 29.0, vehicles_served: 3780, is_peak: true },
  { t: "20:00", adaptive: 41, baseline: 56, savings_s: 15, savings_pct: 26.8, vehicles_served: 3420, is_peak: true },
  { t: "22:00", adaptive: 22, baseline: 29, savings_s: 7, savings_pct: 24.1, vehicles_served: 1620, is_peak: false },
];

export const DEFAULT_LOS_DISTRIBUTION: LosBlock[] = [
  { block: "night", label: "00:00 - 06:00", A_C: 20, D: 2, E: 0, F: 0 },
  { block: "morning_peak", label: "06:00 - 11:00", A_C: 13, D: 5, E: 3, F: 1 },
  { block: "inter_peak", label: "11:00 - 17:00", A_C: 15, D: 4, E: 2, F: 1 },
  { block: "evening_peak", label: "17:00 - 22:00", A_C: 11, D: 6, E: 3, F: 2 },
];

export const DEFAULT_VIOLATIONS: ViolationHour[] = Array.from({ length: 24 }, (_, h) => {
  const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
  const brts = isPeak ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 2);
  const lane = isPeak ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 2);
  const wrongWay = h === 9 || h === 18 ? 1 : 0;
  const other = isPeak ? 1 : 0;
  return {
    t: `${String(h).padStart(2, "0")}:00`,
    brts_intrusion: brts,
    lane_discipline: lane,
    wrong_way: wrongWay,
    other,
    total: brts + lane + wrongWay + other,
    escalated: brts > 2,
    is_current_hour: h === new Date().getHours(),
  };
});

export const DEFAULT_HEATMAP_ROWS: HeatmapRowData[] = JUNCTIONS.map((j) => {
  const base = j.congestionIndex || 45;
  const hours = Array.from({ length: 24 }, (_, h) => {
    const isPeak = (h >= 8 && h <= 10) || (h >= 18 && h <= 20);
    const mod = isPeak ? 22 : (h >= 0 && h <= 5) ? -20 : 0;
    return Math.min(96, Math.max(12, Math.round(base + mod + (Math.sin(h) * 8))));
  });
  return {
    id: j.id,
    name: j.name,
    short_name: j.name.split("/")[0] || j.id,
    zone: j.zone,
    on_brts: j.onBrts,
    mode: "ADAPTIVE",
    health: "live",
    peak_index: Math.max(...hours),
    peak_hour: "18:00",
    hours,
  };
});

export const DEFAULT_BOTTLENECKS: BottleneckRow[] = [
  { rank: "#1", id: "JN-18", name: "Kapodra Junction", zone: "Varachha", minutes_above_75: 78, peak_index: 88, peak_time: "18:45", flags: ["Heavy Platoon", "Diamond Surge"] },
  { rank: "#2", id: "JN-09", name: "Majura Gate Flyover", zone: "Central Surat", minutes_above_75: 64, peak_index: 85, peak_time: "19:15", flags: ["BRTS Intersection", "Arterial Merge"] },
  { rank: "#3", id: "JN-11", name: "Hirabaug Circle", zone: "Varachha", minutes_above_75: 58, peak_index: 83, peak_time: "18:20", flags: ["Bus Stop Dwell", "Left Turn Queue"] },
  { rank: "#4", id: "JN-20", name: "Surat Railway Station Circle", zone: "Central Surat", minutes_above_75: 46, peak_index: 81, peak_time: "09:30", flags: ["Auto Stand Spill", "Pedestrian Crossing"] },
  { rank: "#5", id: "JN-02", name: "Ring Road / Delhi Gate", zone: "Ring Road", minutes_above_75: 39, peak_index: 78, peak_time: "19:00", flags: ["Textile Market Traffic", "U-Turn Delays"] },
];

export const DEFAULT_ADAPTIVE_BENEFIT: AdaptiveBenefitData = {
  eyebrow: "SURAT SMART CITY TRAFFIC AUDIT",
  method: "Empirical floating-car & loop sensor telemetry vs fixed baseline",
  delay_reduction_pct: 18.4,
  confidence_interval: "±1.6% (95% CI)",
  sample_coverage: "22 Intersections · 168k Vehicle Records",
  vehicle_hours_saved: 1420,
  emissions_avoided_tonnes: 3.4,
  zones: [
    { zone: "Central Surat", benefit_pct: 21.2, status: "OPTIMIZED" },
    { zone: "Ring Road Arterial", benefit_pct: 19.4, status: "OPTIMIZED" },
    { zone: "Varachha Corridor", benefit_pct: 16.8, status: "OPTIMIZED" },
    { zone: "Dumas Road", benefit_pct: 15.2, status: "STABLE" },
  ],
};

export const DEFAULT_JUNCTIONS_REPORT: JunctionReportRow[] = JUNCTIONS.map((j) => {
  const c = j.congestionIndex || 50;
  const los = c < 35 ? "A" : c < 50 ? "B" : c < 65 ? "C" : c < 75 ? "D" : c < 85 ? "E" : "F";
  return {
    id: j.id,
    name: j.name,
    short_name: j.name.split("/")[0] || j.id,
    zone: j.zone,
    los,
    congestion_index: c,
    avg_delay_s: Math.round(c * 0.58),
    delay_delta_pct: -Math.round(10 + (c % 15)),
    p95_queue_m: Math.round(c * 1.8),
    saturation_vc: parseFloat((0.45 + c * 0.0055).toFixed(2)),
    throughput_pcu: Math.round(1400 + c * 22),
    cycle_failures_pct: Math.round(c * 0.08),
    violations_today: Math.round(c * 0.12),
    mode: "ADAPTIVE",
    on_brts: j.onBrts,
    adaptive_gain_pct: Math.round(12 + (c % 14)),
    health: "live",
    sparkline: [c - 12, c - 8, c - 2, c + 4, c - 1, c],
  };
});

export const DEFAULT_RECOMMENDATIONS: RecommendationGrouped[] = [
  {
    id: 1,
    category: "OPERATIONAL",
    severity: "HIGH",
    issue_title: "Hirabaug to Varachha Evening Rush Bandwidth",
    junction_ids: ["JN-11", "JN-05"],
    junction_names: "Hirabaug Circle -> Sardar Chowk",
    evidence: "Queue spillover observed across 4 consecutive cycles between 18:30 and 19:45 IST.",
    suggested_action: "Extend green phase offset by +8 seconds on eastbound approach during peak hours.",
    expected_impact: "-14% queue delay on arterial approach",
    confidence: "HIGH",
    age: "12m ago",
    status: "PENDING",
    measured_outcome: null,
  },
  {
    id: 2,
    category: "INFRASTRUCTURE",
    severity: "MEDIUM",
    issue_title: "Station Circle Auto Rickshaw Lane Obstruction",
    junction_ids: ["JN-20"],
    junction_names: "Surat Railway Station Circle",
    evidence: "CCTV feed CAM-S20 detected recurring commercial vehicle dwell in lane L1.",
    suggested_action: "Deploy automated lane enforcement camera barrier & dynamic guidance sign.",
    expected_impact: "-22% weaving conflicts at station approach",
    confidence: "HIGH",
    age: "45m ago",
    status: "PENDING",
    measured_outcome: null,
  },
  {
    id: 3,
    category: "OPERATIONAL",
    severity: "CRITICAL",
    issue_title: "Kapodra Junction Preemption Synchronization",
    junction_ids: ["JN-18"],
    junction_names: "Kapodra Junction",
    evidence: "Diamond worker commuter surge at 19:00 causing intersection saturation index > 88%.",
    suggested_action: "Trigger adaptive Green Wave corridor preemption toward Ring Road.",
    expected_impact: "-19s average cycle delay",
    confidence: "HIGH",
    age: "5m ago",
    status: "PENDING",
    measured_outcome: null,
  },
];
