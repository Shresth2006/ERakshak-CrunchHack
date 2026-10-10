export type Congestion = "optimal" | "moderate" | "heavy" | "gridlock";

export type Lane = {
  id: string;
  name: string;
  density: number; // 0-100
  queue: number; // vehicles
  arrivalRate: number; // veh/min
};

export type SignalStatus = "GREEN" | "YELLOW" | "RED";

export type Junction = {
  id: string;
  name: string;
  zone: string;
  x: number; // 0-100 map space (legacy)
  y: number; // 0-100 map space (legacy)
  lat: number;
  lng: number;
  onBrts: boolean;
  congestion: Congestion;
  congestionIndex: number; // 0-100
  avgWait: number; // seconds
  throughput: number; // veh/hr
  signalStatus: SignalStatus;
  signalCountdown: number; // seconds left in current signal phase
  adaptiveCycle: { phase: string; seconds: number; color: string }[];
  staticCycle: { phase: string; seconds: number; color: string }[];
  whatIfDelta: number; // % congestion increase if reverted to fixed timing
  activeArm?: "N" | "E" | "S" | "W";
  current_phase?: string;
  lanes: Lane[];
  camera: { id: string; online: boolean };
};

export type SuratLane = {
  id: string;
  name: string;
  type: "brts" | "ring_road" | "emergency" | "diamond" | "river_crossing";
  color: string;
  description: string;
  activeVehicles: number;
  avgSpeedKmh: number;
  coordinates: [number, number][]; // Array of [lat, lng]
};

export type AlertKind = "brts" | "violation" | "congestion";
export type Severity = "critical" | "warning" | "info";

export type Alert = {
  id: string;
  type: "alert";
  kind: AlertKind;
  severity: Severity;
  junctionId: string;
  junctionName: string;
  message: string;
  ts: number;
};

export type Prediction = {
  id: string;
  type: "prediction";
  junctionId: string;
  junctionName: string;
  title: string;
  detail: string;
  confidence: number; // 0-100
  window: string;
  series: { t: string; v: number }[];
};

export type FeedItem = Alert | Prediction;

export type KpiKey =
  | "waitReduction"
  | "throughput"
  | "interventions"
  | "laneViolations"
  | "brtsIntrusions";

export type Kpi = {
  key: KpiKey;
  label: string;
  value: number;
  unit: string;
  baseline: string;
  baselineTone: "ok" | "warn" | "crit";
  spark: { i: number; v: number }[];
};

export type QueuePoint = { t: string } & Record<string, number | string>;

export type DetectionEvent = {
  id: string;
  ts: number;
  cameraId: string;
  junctionName: string;
  event: "vehicle_entry" | "vehicle_exit" | "lane_violation" | "brts_intrusion";
  objectClass: "car" | "bus" | "two-wheeler" | "truck" | "auto" | "ambulance";
  confidence: number;
  note?: string | undefined;
};

export type Box = {
  id: string;
  x: number; // % of tile
  y: number;
  w: number;
  h: number;
  cls: DetectionEvent["objectClass"];
  conf: number;
  intruding: boolean;
};

export type CameraFeed = {
  id: string;
  junctionId: string;
  junctionName: string;
  online: boolean;
  hasBrtsZone: boolean;
  boxes: Box[];
  vehicleCount: number;
  avgSpeed: number;
  queueLength: number;
  intrusionActive: boolean;
};
