import type {
  Alert,
  Box,
  CameraFeed,
  Congestion,
  DetectionEvent,
  Junction,
  Kpi,
  Prediction,
  SuratLane,
} from "./traffic-types";

export const CONGESTION_COLOR: Record<Congestion, string> = {
  optimal: "var(--ok)",
  moderate: "var(--warn)",
  heavy: "oklch(0.7 0.2 45)",
  gridlock: "var(--crit)",
};

export const CLASS_COLOR: Record<Box["cls"], string> = {
  car: "oklch(0.8 0.14 195)",
  bus: "oklch(0.75 0.18 152)",
  "two-wheeler": "oklch(0.8 0.16 78)",
  truck: "oklch(0.72 0.14 285)",
  auto: "oklch(0.78 0.1 220)",
  ambulance: "oklch(0.7 0.22 25)",
};

const lanes = (seed: number, base: number) =>
  ["North Approach", "South Approach", "East Approach", "West Approach"].map(
    (name, i) => ({
      id: `L${i + 1}`,
      name,
      density: Math.min(98, Math.round(base + ((seed * (i + 3)) % 34) - 12)),
      queue: Math.max(2, Math.round(base / 3 + ((seed * (i + 5)) % 22))),
      arrivalRate: Math.round(18 + ((seed * (i + 2)) % 31)),
    }),
  );

const cycle = (g: number, y: number, r: number) => [
  { phase: "GREEN", seconds: g, color: "var(--ok)" },
  { phase: "AMBER", seconds: y, color: "var(--warn)" },
  { phase: "RED", seconds: r, color: "var(--crit)" },
];

export const JUNCTIONS: Junction[] = [
  {
    id: "JN-01",
    name: "Udhna Darwaja",
    zone: "South Zone",
    x: 46,
    y: 71,
    lat: 21.1685,
    lng: 72.8315,
    onBrts: true,
    congestion: "gridlock",
    congestionIndex: 88,
    avgWait: 112,
    throughput: 3120,
    signalStatus: "RED",
    signalCountdown: 42,
    adaptiveCycle: cycle(58, 4, 38),
    staticCycle: cycle(30, 5, 65),
    whatIfDelta: 41,
    lanes: lanes(7, 82),
    camera: { id: "CAM-U01", online: true },
  },
  {
    id: "JN-02",
    name: "Ring Road / Delhi Gate",
    zone: "Central Zone",
    x: 58,
    y: 55,
    lat: 21.2005,
    lng: 72.8385,
    onBrts: true,
    congestion: "heavy",
    congestionIndex: 74,
    avgWait: 89,
    throughput: 2860,
    signalStatus: "RED",
    signalCountdown: 18,
    adaptiveCycle: cycle(52, 4, 44),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 33,
    lanes: lanes(3, 70),
    camera: { id: "CAM-R02", online: true },
  },
  {
    id: "JN-03",
    name: "Adajan Gam / Patia",
    zone: "West Zone",
    x: 30,
    y: 44,
    lat: 21.1962,
    lng: 72.7932,
    onBrts: true,
    congestion: "moderate",
    congestionIndex: 52,
    avgWait: 61,
    throughput: 2410,
    signalStatus: "YELLOW",
    signalCountdown: 4,
    adaptiveCycle: cycle(46, 4, 40),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 22,
    lanes: lanes(5, 52),
    camera: { id: "CAM-A03", online: true },
  },
  {
    id: "JN-04",
    name: "Piplod Junction",
    zone: "South West Zone",
    x: 24,
    y: 63,
    lat: 21.1550,
    lng: 72.7750,
    onBrts: false,
    congestion: "optimal",
    congestionIndex: 27,
    avgWait: 34,
    throughput: 1980,
    signalStatus: "GREEN",
    signalCountdown: 40,
    adaptiveCycle: cycle(40, 4, 36),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 14,
    lanes: lanes(2, 30),
    camera: { id: "CAM-P04", online: true },
  },
  {
    id: "JN-05",
    name: "Varachha / Sardar Chowk",
    zone: "East Zone",
    x: 74,
    y: 38,
    lat: 21.2150,
    lng: 72.8600,
    onBrts: true,
    congestion: "heavy",
    congestionIndex: 79,
    avgWait: 96,
    throughput: 3040,
    signalStatus: "RED",
    signalCountdown: 31,
    adaptiveCycle: cycle(55, 4, 41),
    staticCycle: cycle(30, 5, 65),
    whatIfDelta: 37,
    lanes: lanes(11, 76),
    camera: { id: "CAM-V05", online: true },
  },
  {
    id: "JN-06",
    name: "Katargam Gate",
    zone: "North Zone",
    x: 52,
    y: 24,
    lat: 21.2215,
    lng: 72.8255,
    onBrts: false,
    congestion: "moderate",
    congestionIndex: 48,
    avgWait: 57,
    throughput: 2210,
    signalStatus: "GREEN",
    signalCountdown: 22,
    adaptiveCycle: cycle(44, 4, 38),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 19,
    lanes: lanes(13, 48),
    camera: { id: "CAM-K06", online: true },
  },
  {
    id: "JN-07",
    name: "Athwalines / Athwa Gate",
    zone: "Central Zone",
    x: 38,
    y: 57,
    lat: 21.1834,
    lng: 72.8092,
    onBrts: false,
    congestion: "moderate",
    congestionIndex: 56,
    avgWait: 66,
    throughput: 2530,
    signalStatus: "GREEN",
    signalCountdown: 35,
    adaptiveCycle: cycle(48, 4, 39),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 25,
    lanes: lanes(17, 58),
    camera: { id: "CAM-T07", online: true },
  },
  {
    id: "JN-08",
    name: "Dumas Road / SVNIT Circle",
    zone: "South West Zone",
    x: 16,
    y: 80,
    lat: 21.1650,
    lng: 72.7840,
    onBrts: false,
    congestion: "optimal",
    congestionIndex: 22,
    avgWait: 29,
    throughput: 1640,
    signalStatus: "GREEN",
    signalCountdown: 19,
    adaptiveCycle: cycle(38, 4, 34),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 11,
    lanes: lanes(19, 26),
    camera: { id: "CAM-D08", online: true },
  },
  {
    id: "JN-09",
    name: "Majura Gate Circle",
    zone: "Central Zone",
    x: 42,
    y: 62,
    lat: 21.1798,
    lng: 72.8188,
    onBrts: true,
    congestion: "heavy",
    congestionIndex: 76,
    avgWait: 84,
    throughput: 3420,
    signalStatus: "GREEN",
    signalCountdown: 28,
    adaptiveCycle: cycle(50, 4, 40),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 31,
    lanes: lanes(21, 74),
    camera: { id: "CAM-M09", online: true },
  },
  {
    id: "JN-10",
    name: "Sahara Darwaja",
    zone: "Central Zone",
    x: 54,
    y: 58,
    lat: 21.1920,
    lng: 72.8465,
    onBrts: true,
    congestion: "gridlock",
    congestionIndex: 91,
    avgWait: 125,
    throughput: 3580,
    signalStatus: "RED",
    signalCountdown: 50,
    adaptiveCycle: cycle(60, 4, 40),
    staticCycle: cycle(30, 5, 65),
    whatIfDelta: 45,
    lanes: lanes(23, 88),
    camera: { id: "CAM-S10", online: true },
  },
  {
    id: "JN-11",
    name: "Hirabaug Circle",
    zone: "East Zone",
    x: 78,
    y: 35,
    lat: 21.2185,
    lng: 72.8710,
    onBrts: true,
    congestion: "moderate",
    congestionIndex: 61,
    avgWait: 68,
    throughput: 2750,
    signalStatus: "GREEN",
    signalCountdown: 14,
    adaptiveCycle: cycle(45, 4, 35),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 24,
    lanes: lanes(25, 60),
    camera: { id: "CAM-H11", online: true },
  },
  {
    id: "JN-12",
    name: "Pal RTO Junction",
    zone: "West Zone",
    x: 22,
    y: 40,
    lat: 21.1990,
    lng: 72.7710,
    onBrts: false,
    congestion: "optimal",
    congestionIndex: 32,
    avgWait: 38,
    throughput: 2100,
    signalStatus: "GREEN",
    signalCountdown: 33,
    adaptiveCycle: cycle(42, 4, 34),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 16,
    lanes: lanes(27, 34),
    camera: { id: "CAM-PL12", online: true },
  },
  {
    id: "JN-13",
    name: "VIP Road / Vesu",
    zone: "South West Zone",
    x: 18,
    y: 72,
    lat: 21.1415,
    lng: 72.7950,
    onBrts: false,
    congestion: "moderate",
    congestionIndex: 45,
    avgWait: 52,
    throughput: 2310,
    signalStatus: "YELLOW",
    signalCountdown: 3,
    adaptiveCycle: cycle(44, 4, 36),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 18,
    lanes: lanes(29, 44),
    camera: { id: "CAM-V13", online: true },
  },
  {
    id: "JN-14",
    name: "Bhatar Four Ways",
    zone: "South Zone",
    x: 36,
    y: 75,
    lat: 21.1610,
    lng: 72.8110,
    onBrts: false,
    congestion: "heavy",
    congestionIndex: 68,
    avgWait: 79,
    throughput: 2680,
    signalStatus: "GREEN",
    signalCountdown: 27,
    adaptiveCycle: cycle(48, 4, 40),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 28,
    lanes: lanes(31, 66),
    camera: { id: "CAM-B14", online: true },
  },
  {
    id: "JN-15",
    name: "Althan Tenement",
    zone: "South Zone",
    x: 40,
    y: 82,
    lat: 21.1480,
    lng: 72.8210,
    onBrts: false,
    congestion: "optimal",
    congestionIndex: 29,
    avgWait: 35,
    throughput: 1850,
    signalStatus: "GREEN",
    signalCountdown: 45,
    adaptiveCycle: cycle(40, 4, 32),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 12,
    lanes: lanes(33, 28),
    camera: { id: "CAM-AL15", online: true },
  },
  {
    id: "JN-16",
    name: "Kamrej Highway Crossroad",
    zone: "Outer East",
    x: 92,
    y: 15,
    lat: 21.2680,
    lng: 72.9600,
    onBrts: false,
    congestion: "heavy",
    congestionIndex: 72,
    avgWait: 85,
    throughput: 3890,
    signalStatus: "RED",
    signalCountdown: 29,
    adaptiveCycle: cycle(54, 4, 42),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 35,
    lanes: lanes(35, 71),
    camera: { id: "CAM-KM16", online: true },
  },
  {
    id: "JN-17",
    name: "Parvat Patiya Junction",
    zone: "East Zone",
    x: 68,
    y: 65,
    lat: 21.1820,
    lng: 72.8680,
    onBrts: true,
    congestion: "gridlock",
    congestionIndex: 84,
    avgWait: 108,
    throughput: 3290,
    signalStatus: "RED",
    signalCountdown: 38,
    adaptiveCycle: cycle(56, 4, 40),
    staticCycle: cycle(30, 5, 65),
    whatIfDelta: 39,
    lanes: lanes(37, 81),
    camera: { id: "CAM-PP17", online: true },
  },
  {
    id: "JN-18",
    name: "Kapoddra Junction",
    zone: "East Zone",
    x: 82,
    y: 30,
    lat: 21.2270,
    lng: 72.8850,
    onBrts: true,
    congestion: "moderate",
    congestionIndex: 59,
    avgWait: 64,
    throughput: 2610,
    signalStatus: "GREEN",
    signalCountdown: 16,
    adaptiveCycle: cycle(46, 4, 38),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 23,
    lanes: lanes(39, 58),
    camera: { id: "CAM-KP18", online: true },
  },
  {
    id: "JN-19",
    name: "Sachin GIDC Intersection",
    zone: "Outer South",
    x: 50,
    y: 95,
    lat: 21.0850,
    lng: 72.8620,
    onBrts: false,
    congestion: "optimal",
    congestionIndex: 25,
    avgWait: 30,
    throughput: 2450,
    signalStatus: "GREEN",
    signalCountdown: 52,
    adaptiveCycle: cycle(42, 4, 30),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 10,
    lanes: lanes(41, 24),
    camera: { id: "CAM-SC19", online: true },
  },
  {
    id: "JN-20",
    name: "Station Circle (Railway Station)",
    zone: "Central Zone",
    x: 60,
    y: 50,
    lat: 21.2050,
    lng: 72.8410,
    onBrts: true,
    congestion: "gridlock",
    congestionIndex: 94,
    avgWait: 138,
    throughput: 4120,
    signalStatus: "RED",
    signalCountdown: 41,
    adaptiveCycle: cycle(62, 4, 44),
    staticCycle: cycle(30, 5, 65),
    whatIfDelta: 48,
    lanes: lanes(43, 93),
    camera: { id: "CAM-ST20", online: true },
  },
  {
    id: "JN-21",
    name: "Kharwarnagar Circle",
    zone: "South Zone",
    x: 48,
    y: 68,
    lat: 21.1710,
    lng: 72.8400,
    onBrts: true,
    congestion: "moderate",
    congestionIndex: 54,
    avgWait: 59,
    throughput: 2780,
    signalStatus: "GREEN",
    signalCountdown: 20,
    adaptiveCycle: cycle(46, 4, 36),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 21,
    lanes: lanes(45, 53),
    camera: { id: "CAM-KN21", online: true },
  },
  {
    id: "JN-22",
    name: "Textile Market Gate",
    zone: "Central Zone",
    x: 52,
    y: 60,
    lat: 21.1890,
    lng: 72.8415,
    onBrts: true,
    congestion: "heavy",
    congestionIndex: 78,
    avgWait: 92,
    throughput: 3340,
    signalStatus: "YELLOW",
    signalCountdown: 5,
    adaptiveCycle: cycle(52, 4, 42),
    staticCycle: cycle(35, 5, 60),
    whatIfDelta: 34,
    lanes: lanes(47, 77),
    camera: { id: "CAM-TM22", online: true },
  },
];

export const SURAT_LANES: SuratLane[] = [
  {
    id: "LANE-BRTS",
    name: "Surat BRTS Dedicated Corridor",
    type: "brts",
    color: "#00f3ff",
    description: "Dedicated High-Speed Transit Corridor connecting Dumas to Varachha & Kamrej",
    activeVehicles: 84,
    avgSpeedKmh: 42,
    coordinates: [
      [21.1550, 72.7750], // Piplod
      [21.1650, 72.7840], // Dumas Road / SVNIT
      [21.1834, 72.8092], // Athwa Gate
      [21.1798, 72.8188], // Majura Gate
      [21.1685, 72.8315], // Udhna Darwaja
      [21.1710, 72.8400], // Kharwarnagar
      [21.1890, 72.8415], // Textile Market
      [21.1920, 72.8465], // Sahara Darwaja
      [21.2005, 72.8385], // Delhi Gate
      [21.2150, 72.8600], // Varachha Sardar Chowk
      [21.2185, 72.8710], // Hirabaug
      [21.2270, 72.8850], // Kapoddra
    ],
  },
  {
    id: "LANE-RING",
    name: "Surat Inner Ring Road",
    type: "ring_road",
    color: "#00ff88",
    description: "Arterial Outer Ring encircling Central Surat & Railway Station",
    activeVehicles: 340,
    avgSpeedKmh: 28,
    coordinates: [
      [21.1798, 72.8188], // Majura Gate
      [21.1685, 72.8315], // Udhna Darwaja
      [21.1710, 72.8400], // Kharwarnagar
      [21.1890, 72.8415], // Textile Market Gate
      [21.1920, 72.8465], // Sahara Darwaja
      [21.2050, 72.8410], // Station Circle
      [21.2005, 72.8385], // Delhi Gate
      [21.2215, 72.8255], // Katargam Gate
      [21.1962, 72.7932], // Adajan Patia
      [21.1834, 72.8092], // Athwa Gate
      [21.1798, 72.8188], // Majura Gate
    ],
  },
  {
    id: "LANE-EMERGENCY",
    name: "Airport Emergency Green Corridor",
    type: "emergency",
    color: "#ff0055",
    description: "Priority Ambulance & VIP Rapid Transit Link from Airport to Civil Hospital",
    activeVehicles: 12,
    avgSpeedKmh: 65,
    coordinates: [
      [21.1415, 72.7950], // VIP Road / Vesu
      [21.1550, 72.7750], // Piplod
      [21.1650, 72.7840], // Dumas Road
      [21.1834, 72.8092], // Athwa Gate
      [21.1798, 72.8188], // Majura Gate (Civil Hospital)
    ],
  },
  {
    id: "LANE-DIAMOND",
    name: "Varachha Diamond Trade Expressway",
    type: "diamond",
    color: "#ffb700",
    description: "Heavy Industrial Traffic Axis linking Diamond Bourse & Kamrej National Highway",
    activeVehicles: 215,
    avgSpeedKmh: 34,
    coordinates: [
      [21.2050, 72.8410], // Station Circle
      [21.2005, 72.8385], // Delhi Gate
      [21.2150, 72.8600], // Varachha Sardar Chowk
      [21.2185, 72.8710], // Hirabaug Circle
      [21.2270, 72.8850], // Kapoddra Junction
      [21.2680, 72.9600], // Kamrej Highway
    ],
  },
  {
    id: "LANE-RIVER",
    name: "Adajan-Pal River Crossing Link",
    type: "river_crossing",
    color: "#38bdf8",
    description: "Tapi River Bridge & Cable-Stayed Corridor to West Surat and Hazira",
    activeVehicles: 160,
    avgSpeedKmh: 38,
    coordinates: [
      [21.1834, 72.8092], // Athwa Gate
      [21.1962, 72.7932], // Adajan Patia
      [21.1990, 72.7710], // Pal RTO
    ],
  },
];

/** Polyline (map space) of the BRTS trunk corridor through the city. */
export const BRTS_CORRIDOR: { x: number; y: number }[] = [
  { x: 12, y: 88 },
  { x: 46, y: 71 },
  { x: 38, y: 57 },
  { x: 58, y: 55 },
  { x: 30, y: 44 },
  { x: 52, y: 24 },
  { x: 74, y: 38 },
  { x: 88, y: 20 },
];

export const ROADS: { d: string; w: number }[] = [
  { d: "M4,66 C22,60 34,66 48,72 C62,78 78,74 96,68", w: 2.4 },
  { d: "M10,20 C26,30 38,34 52,26 C66,18 80,26 94,16", w: 1.6 },
  { d: "M20,4 C24,26 28,44 30,62 C32,78 30,90 28,98", w: 1.6 },
  { d: "M62,2 C60,22 58,42 60,58 C62,76 66,88 70,98", w: 1.6 },
  { d: "M2,44 C24,42 44,50 66,48 C80,46 90,40 99,38", w: 1.6 },
  { d: "M84,4 C80,26 78,48 82,70 C84,84 88,92 92,98", w: 1.2 },
];

export const BOTTLENECK_ZONES = [
  { x: 46, y: 71, r: 14, w: 0.95 },
  { x: 58, y: 55, r: 11, w: 0.8 },
  { x: 74, y: 38, r: 12, w: 0.85 },
  { x: 38, y: 57, r: 9, w: 0.5 },
  { x: 30, y: 44, r: 8, w: 0.42 },
];

export const BRTS_INTRUSIONS = [
  {
    id: "INT-1188",
    x: 52,
    y: 63,
    junctionId: "JN-01",
    junctionName: "Udhna Darwaja",
    vehicle: "two-wheeler",
  },
  {
    id: "INT-1189",
    x: 66,
    y: 47,
    junctionId: "JN-02",
    junctionName: "Ring Road / Delhi Gate",
    vehicle: "auto",
  },
];

const now = Date.now();

const spark = (base: number, amp: number, seed: number) =>
  Array.from({ length: 18 }, (_, i) => ({
    i,
    v: Math.round(base + Math.sin((i + seed) / 2.1) * amp + ((i * seed) % 5)),
  }));

export const INITIAL_KPIS: Kpi[] = [
  {
    key: "waitReduction",
    label: "Avg wait time reduction",
    value: 31.4,
    unit: "%",
    baseline: "-31% wait vs fixed timing",
    baselineTone: "ok",
    spark: spark(28, 4, 3),
  },
  {
    key: "throughput",
    label: "Vehicles processed / hour",
    value: 19790,
    unit: "veh/h",
    baseline: "+28% throughput vs fixed timing",
    baselineTone: "ok",
    spark: spark(19000, 900, 5),
  },
  {
    key: "laneViolations",
    label: "Lane-discipline violations today",
    value: 268,
    unit: "events",
    baseline: "-12% vs 7-day average",
    baselineTone: "warn",
    spark: spark(240, 30, 7),
  },
  {
    key: "brtsIntrusions",
    label: "BRTS intrusions today",
    value: 37,
    unit: "events",
    baseline: "2 active right now",
    baselineTone: "crit",
    spark: spark(30, 8, 11),
  },
];

export const QUEUE_JUNCTIONS = JUNCTIONS.slice(0, 5);

export const QUEUE_SERIES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(now - (29 - i) * 60_000);
  const row: Record<string, number | string> = {
    t: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
  QUEUE_JUNCTIONS.forEach((j, k) => {
    row[j.id] = Math.max(
      3,
      Math.round(
        j.congestionIndex / 2.4 + Math.sin((i + k * 3) / 3.4) * 9 + ((i * (k + 2)) % 6),
      ),
    );
  });
  return row as { t: string } & Record<string, number | string>;
});

export const INITIAL_ALERTS: Alert[] = [
  {
    id: "A-9001",
    type: "alert",
    kind: "brts",
    severity: "critical",
    junctionId: "JN-01",
    junctionName: "Udhna Darwaja",
    message: "BRTS corridor intrusion — 2-wheeler in dedicated lane, 6.4s dwell",
    ts: now - 42_000,
  },
  {
    id: "A-9002",
    type: "alert",
    kind: "congestion",
    severity: "critical",
    junctionId: "JN-01",
    junctionName: "Udhna Darwaja",
    message: "Gridlock threshold breached — queue > 280m on south approach",
    ts: now - 118_000,
  },
  {
    id: "A-9003",
    type: "alert",
    kind: "brts",
    severity: "critical",
    junctionId: "JN-02",
    junctionName: "Ring Road / Delhi Gate",
    message: "BRTS corridor intrusion — auto-rickshaw crossed lane separator",
    ts: now - 205_000,
  },
  {
    id: "A-9004",
    type: "alert",
    kind: "violation",
    severity: "warning",
    junctionId: "JN-05",
    junctionName: "Varachha / Sardar Chowk",
    message: "Lane-discipline violation cluster — 9 events in 5 min",
    ts: now - 320_000,
  },
  {
    id: "A-9005",
    type: "alert",
    kind: "congestion",
    severity: "warning",
    junctionId: "JN-07",
    junctionName: "Athwalines Circle",
    message: "Sudden congestion spike — arrival rate up 44% in 3 min",
    ts: now - 488_000,
  },
  {
    id: "A-9006",
    type: "alert",
    kind: "violation",
    severity: "info",
    junctionId: "JN-03",
    junctionName: "Adajan Gam",
    message: "Signal jump detected — heavy vehicle, plate captured",
    ts: now - 615_000,
  },
];

const predSeries = (b: number, seed: number) =>
  ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((t, i) => ({
    t,
    v: Math.round(b + Math.sin((i + seed) / 1.4) * 14 + i * 4),
  }));

export const INITIAL_PREDICTIONS: Prediction[] = [
  {
    id: "P-501",
    type: "prediction",
    junctionId: "JN-01",
    junctionName: "Udhna Darwaja",
    title: "🟢 Open Extra Inbound Lane for Evening Rush",
    detail:
      "Heavy evening traffic expected between 6:10 PM – 7:40 PM. Allow inbound vehicles to use 1 extra lane to cut traffic backlog by 23%.",
    confidence: 92,
    window: "Today 18:10 – 19:40",
    series: predSeries(52, 2),
  },
  {
    id: "P-502",
    type: "prediction",
    junctionId: "JN-05",
    junctionName: "Varachha / Sardar Chowk",
    title: "🟢 Keep East Signal Green +12 Seconds Longer",
    detail:
      "Diamond Market workers leaving at 5:45 PM (~1,400 vehicles). Extending the East green light by 12s will keep Ring Road clear of traffic jams.",
    confidence: 87,
    window: "Today 17:45 – 18:30",
    series: predSeries(44, 5),
  },
  {
    id: "P-503",
    type: "prediction",
    junctionId: "JN-02",
    junctionName: "Ring Road / Delhi Gate",
    title: "🚨 Send Police Officer — Bus Lane Intrusion Warning",
    detail:
      "Heavy traffic in the next 2 hours will cause cars to illegally cut into the BRTS Bus Lane. Send an officer to guard the entrance.",
    confidence: 78,
    window: "Next 2 hours",
    series: predSeries(30, 9),
  },
  {
    id: "P-504",
    type: "prediction",
    junctionId: "JN-03",
    junctionName: "Athwa Gate Circle",
    title: "🚦 Sync Next 3 Signals for Smooth Traffic Flow",
    detail:
      "Traffic moving from Cable Bridge to Athwa Gate is slowing down. Coordinate green lights across the next 3 junctions to prevent queuing.",
    confidence: 84,
    window: "Next 30 mins",
    series: predSeries(38, 7),
  },
];

const box = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  cls: Box["cls"],
  conf: number,
  intruding = false,
): Box => ({ id, x, y, w, h, cls, conf, intruding });

export const CAMERA_FEEDS: CameraFeed[] = JUNCTIONS.map((j, i) => ({
  id: j.camera.id,
  junctionId: j.id,
  junctionName: j.name,
  online: i < 9,
  hasBrtsZone: j.onBrts,
  intrusionActive: i < 3,
  vehicleCount: 12 + ((i * 7) % 19),
  avgSpeed: 14 + ((i * 5) % 24),
  queueLength: 30 + ((i * 13) % 120),
  boxes: [
    box(`${j.id}-b1`, 12, 46, 18, 20, "car", 94),
    box(`${j.id}-b2`, 38, 38, 22, 24, "bus", 97),
    box(`${j.id}-b3`, 66, 52, 12, 14, "two-wheeler", 88, j.id === "JN-01"),
    box(`${j.id}-b4`, 54, 66, 20, 22, "truck", 91),
    box(`${j.id}-b5`, 24, 70, 14, 15, "auto", 85, j.id === "JN-02"),
    box(`${j.id}-b6`, 78, 34, 11, 12, "car", 82),
  ],
}));

export const INITIAL_DETECTIONS: DetectionEvent[] = Array.from(
  { length: 26 },
  (_, i) => {
    const j = JUNCTIONS[i % JUNCTIONS.length]!;
    const classes: DetectionEvent["objectClass"][] = [
      "car",
      "bus",
      "two-wheeler",
      "truck",
      "auto",
    ];
    const events: DetectionEvent["event"][] = [
      "vehicle_entry",
      "vehicle_exit",
      "vehicle_entry",
      "lane_violation",
      "vehicle_exit",
      "brts_intrusion",
    ];
    const event = events[i % events.length]!;
    return {
      id: `D-${8000 + i}`,
      ts: now - i * 7_400,
      cameraId: j.camera.id,
      junctionName: j.name,
      event,
      objectClass: classes[(i * 3) % classes.length]!,
      confidence: 72 + ((i * 7) % 27),
      note:
        event === "brts_intrusion"
          ? `dwell ${(2 + (i % 5) + 0.2).toFixed(1)}s`
          : event === "lane_violation"
            ? "lane_id=L2"
            : undefined,
    };
  },
);

export const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export const ago = (ts: number) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

export type { Alert, CameraFeed, DetectionEvent, Junction, Kpi, Prediction, SuratLane };
