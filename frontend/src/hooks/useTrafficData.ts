import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  BRTS_INTRUSIONS,
  INITIAL_ALERTS,
  INITIAL_DETECTIONS,
  INITIAL_KPIS,
  INITIAL_PREDICTIONS,
  JUNCTIONS,
  QUEUE_JUNCTIONS,
  QUEUE_SERIES,
} from "@/lib/mock-traffic";
import type {
  Alert,
  DetectionEvent,
  Junction,
  Kpi,
  Prediction,
} from "@/lib/traffic-types";
import { VIDEO_DETECTIONS } from "@/lib/video-detections";
import { apiUrl, wsUrl } from "../config";

type QueueRow = { t: string } & Record<string, number | string>;

type State = {
  connected: boolean;
  junctions: Junction[];
  kpis: Kpi[];
  queue: QueueRow[];
  alerts: Alert[];
  predictions: Prediction[];
  detections: DetectionEvent[];
  lastUpdate: number;
};

type Action =
  | { type: "SET_INITIAL_DATA"; payload: { junctions?: Junction[]; alerts?: Alert[]; predictions?: Prediction[] } }
  | { type: "UPDATE_JUNCTION_WS"; payload: any }
  | { type: "ALERT"; payload: Alert }
  | { type: "PREDICTION"; payload: Prediction }
  | { type: "DETECTION"; payload: DetectionEvent }
  | { type: "CONNECTION"; payload: boolean }
  | { type: "TICK_DECAY" };

const initialState: State = {
  connected: false,
  junctions: JUNCTIONS,
  kpis: INITIAL_KPIS,
  queue: QUEUE_SERIES,
  alerts: INITIAL_ALERTS,
  predictions: INITIAL_PREDICTIONS,
  detections: INITIAL_DETECTIONS,
  lastUpdate: Date.now(),
};

const drift = (v: number, amp: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v + (Math.random() - 0.5) * amp));

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CONNECTION":
      return { ...state, connected: action.payload };

    case "SET_INITIAL_DATA":
      return {
        ...state,
        junctions: action.payload.junctions?.length ? action.payload.junctions : state.junctions,
        alerts: action.payload.alerts?.length ? action.payload.alerts : state.alerts,
        predictions: action.payload.predictions?.length ? action.payload.predictions : state.predictions,
      };

    case "UPDATE_JUNCTION_WS": {
      const eventData = action.payload;

      const updatedJunctions = state.junctions.map((j) => {
        const eventNum = parseInt((eventData.junction_id || "").replace(/\D/g, "") || "0", 10);
        const jNum = parseInt(j.id.replace(/\D/g, "") || "0", 10);
        const isMatch =
          j.id === eventData.junction_id ||
          j.name === eventData.name ||
          (eventNum > 0 && eventNum === jNum);

        if (isMatch) {
          const avgQ = eventData.avg_queue_length_m ?? 0;
          const ci = Math.min(100, Math.max(5, Math.round(avgQ * 1.1)));
          // Allocate dynamic green duration calculated by Backend Max-Pressure Controller
          const allocatedGreen = eventData.cycle_length 
            ? Math.round(eventData.cycle_length)
            : Math.min(85, Math.max(18, Math.round(20 + avgQ * 0.6)));

          const signalStatus = eventData.current_phase?.toLowerCase().includes("red")
            ? ("RED" as const)
            : eventData.current_phase?.toLowerCase().includes("yellow")
            ? ("YELLOW" as const)
            : ("GREEN" as const);

          // Only reset countdown when phase changes, allowing smooth 1s decrements
          const phaseChanged = (j as any).current_phase !== eventData.current_phase;
          const nextCountdown = phaseChanged ? allocatedGreen : Math.max(1, j.signalCountdown);

          return {
            ...j,
            current_phase: eventData.current_phase,
            congestionIndex: ci,
            signalCountdown: nextCountdown,
            congestion:
              ci > 80
                ? ("gridlock" as const)
                : ci > 65
                ? ("heavy" as const)
                : ci > 40
                ? ("moderate" as const)
                : ("optimal" as const),
            avgWait: Math.round(avgQ * 1.8 + 15),
            throughput: eventData.total_vehicles ? eventData.total_vehicles * 40 : j.throughput,
            signalStatus,
            lanes: eventData.lanes?.length
              ? eventData.lanes.map((l: any, idx: number) => ({
                  id: l.lane_id || `l-${idx}`,
                  name: l.lane_name || `Lane ${idx + 1}`,
                  density: Math.round(l.occupancy_ratio * 100),
                  queue: Math.round(l.queue_length_m / 6),
                  arrivalRate: Math.round(l.vehicle_count * 2),
                }))
              : j.lanes,
          };
        }
        return j;
      });

      // Update KPI metrics dynamically
      const kpis = state.kpis
        .filter((k) => (k.key as string) !== "interventions")
        .map((k) => {
          if (k.key === "brtsIntrusions") {
            const totalIntrusions = updatedJunctions.reduce(
              (acc, j) => acc + (j.camera.online ? 1 : 0),
              0
            );
            return { ...k, value: totalIntrusions };
          }
          return k;
        });

      return {
        ...state,
        junctions: updatedJunctions,
        kpis,
        lastUpdate: Date.now(),
      };
    }

    case "TICK_DECAY": {
      // Local timer tick to smoothly decrement signal countdowns, discharge vehicles, and transition states
      const updatedJunctions = state.junctions.map((j) => {
        let newCountdown = j.signalCountdown - 1;
        let newStatus = j.signalStatus;
        let activeArm: "N" | "E" | "S" | "W" = j.activeArm || "N";

        // Map lanes to directional keys
        const getArmKey = (name: string, idx: number): "N" | "E" | "S" | "W" => {
          const lower = name.toLowerCase();
          if (lower.includes("north")) return "N";
          if (lower.includes("east")) return "E";
          if (lower.includes("south")) return "S";
          if (lower.includes("west")) return "W";
          return (["N", "S", "E", "W"] as const)[idx % 4] || "N";
        };

        // Update lanes: discharge queue for GREEN arm, accumulate queue for RED arms
        const updatedLanes = j.lanes.map((lane, idx) => {
          const armKey = getArmKey(lane.name, idx);
          const isGreenArm = armKey === activeArm && (j.signalStatus === "GREEN");

          if (isGreenArm) {
            // GREEN: queue decreases at a good rate (discharging 1-2 vehicles per second)
            const dischargeRate = Math.random() < 0.75 ? 1 : 2;
            const newQ = Math.max(3, lane.queue - dischargeRate);
            const newD = Math.max(12, Math.min(95, Math.round((newQ / 42) * 80)));
            return {
              ...lane,
              queue: newQ,
              density: newD,
            };
          } else {
            // RED / WAITING: vehicle queue accumulates steadily
            const vehicleArrived = Math.random() < 0.35;
            const newQ = vehicleArrived ? Math.min(58, lane.queue + 1) : lane.queue;
            const newD = Math.max(25, Math.min(98, Math.round((newQ / 42) * 85)));
            return {
              ...lane,
              queue: newQ,
              density: newD,
            };
          }
        });

        if (newCountdown <= 0) {
          if (j.signalStatus === "GREEN") {
            // Green ends -> 3s Yellow clearance
            newStatus = "YELLOW";
            newCountdown = 3;
          } else if (j.signalStatus === "YELLOW") {
            // Yellow ends -> 2s all-red clearance
            newStatus = "RED";
            newCountdown = 2;

            // Select NEXT arm using Max-Pressure (highest queue among non-recently-serviced arms)
            // Exclude the arm that just finished so it CANNOT get the next green signal immediately!
            const candidateArms: ("N" | "E" | "S" | "W")[] = (["N", "E", "S", "W"] as const).filter(
              (arm) => arm !== activeArm
            );

            // Pick the candidate arm with the maximum queue pressure
            let highestArm = candidateArms[0];
            let maxQueue = -1;
            candidateArms.forEach((arm) => {
              const lane = updatedLanes.find((l, idx) => getArmKey(l.name, idx) === arm);
              const q = lane ? lane.queue : 0;
              if (q > maxQueue) {
                maxQueue = q;
                highestArm = arm;
              }
            });

            activeArm = highestArm;
          } else {
            // RED clearance ends -> Selected arm turns GREEN!
            newStatus = "GREEN";
            const currentLane = updatedLanes.find((l, idx) => getArmKey(l.name, idx) === activeArm);
            const targetQueue = currentLane ? currentLane.queue : 35;
            // Adaptive Green duration dynamically proportional to queue pressure (20s to 55s)
            newCountdown = Math.min(55, Math.max(20, Math.round(18 + targetQueue * 0.8)));
          }
        }

        // Recalculate average junction congestion index from lanes
        const avgLaneDensity = Math.round(
          updatedLanes.reduce((sum, l) => sum + l.density, 0) / Math.max(1, updatedLanes.length)
        );

        const armLabels = {
          N: "North Approach Phase",
          E: "East Approach Phase",
          S: "South Approach Phase",
          W: "West Approach Phase",
        };

        return {
          ...j,
          signalCountdown: newCountdown,
          signalStatus: newStatus,
          activeArm,
          current_phase: armLabels[activeArm],
          lanes: updatedLanes,
          congestionIndex: avgLaneDensity,
        };
      });

      return {
        ...state,
        junctions: updatedJunctions,
      };
    }

    case "ALERT":
      return { ...state, alerts: [action.payload, ...state.alerts].slice(0, 60) };

    case "PREDICTION":
      return { ...state, predictions: [action.payload, ...state.predictions].slice(0, 30) };

    case "DETECTION":
      return {
        ...state,
        detections: [action.payload, ...state.detections].slice(0, 120),
      };

    default:
      return state;
  }
}

const SURAT_JUNCTION_NAMES: Record<string, string> = {
  J001: "Majura Gate Flyover",
  J002: "Sahara Darwaja Junction",
  J003: "Athwa Gate Circle",
  J004: "Ring Road / Delhi Gate",
  J005: "Adajan Gam / Patia",
  J006: "Piplod Junction",
  J007: "Varachha / Sardar Chowk",
  J008: "Udhna Darwaja",
  J009: "Khatodara GIDC Cross",
  J010: "Katargam Darwaja",
  J011: "Vesu VIP Road Crossing",
  J012: "Dindoli Bridge Approach",
  J013: "Kamrej Highway Junction",
  J014: "Textile Market Corridor",
  J015: "Palanpur Jakatnaka",
  J016: "Sarthana Jakatnaka",
  J017: "Cable Bridge Adajan",
  J018: "Gopipura Main Road",
  J019: "Bhatar Char Rasta",
  J020: "Althan Canal Road",
  J021: "Ichhapore GIDC Cross",
  J022: "Dumas Beach Approach",
  "JN-01": "Udhna Darwaja",
  "JN-02": "Ring Road / Delhi Gate",
  "JN-03": "Athwa Gate Circle",
  "JN-04": "Majura Gate",
  "JN-05": "Varachha / Sardar Chowk",
  "JN-06": "Kargil Chowk",
  "JN-07": "Textile Market",
  "JN-08": "Delhi Gate",
  "JN-09": "Majura Gate",
};

function formatSimpleTitle(issueType?: string, suggestedAction?: string): string {
  if (suggestedAction) {
    if (
      suggestedAction.startsWith("🚨") ||
      suggestedAction.startsWith("🟢") ||
      suggestedAction.startsWith("🚦") ||
      suggestedAction.startsWith("⚠️")
    ) {
      return suggestedAction.split(".")[0];
    }
  }
  const type = (issueType || "").toLowerCase();
  if (type.includes("brts") || type.includes("intrusion")) {
    return "🚨 Send Police Officer — Bus Lane Intrusion Warning";
  }
  if (type.includes("asymmetric") || type.includes("flow")) {
    return "🟢 Open Extra Inbound Lane for Evening Rush";
  }
  if (type.includes("spillback") || type.includes("queue")) {
    return "🚦 Increase Green Light Time (+15s) to Clear Backlog";
  }
  return "🟢 Extend Green Light Phase (+12s)";
}

export function useTrafficData() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 1. Initial REST API Fetch
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [jRes, vRes, rRes] = await Promise.all([
          fetch(apiUrl("/api/junctions")).catch(() => null),
          fetch(apiUrl("/api/violations")).catch(() => null),
          fetch(apiUrl("/api/recommendations")).catch(() => null),
        ]);

        let fetchedJunctions: Junction[] | undefined;
        let fetchedAlerts: Alert[] | undefined;
        let fetchedPredictions: Prediction[] | undefined;

        if (jRes && jRes.ok) {
          const rawJunctions = await jRes.json();
          if (Array.isArray(rawJunctions) && rawJunctions.length > 0) {
            fetchedJunctions = JUNCTIONS.map((j) => {
              const matched = rawJunctions.find((rj: any) => rj.id === j.id || rj.name === j.name);
              if (matched) {
                return {
                  ...j,
                  name: matched.name || j.name,
                  lat: matched.latitude || j.lat,
                  lng: matched.longitude || j.lng,
                };
              }
              return j;
            });
          }
        }

        if (vRes && vRes.ok) {
          const rawViolations = await vRes.json();
          if (Array.isArray(rawViolations)) {
            fetchedAlerts = rawViolations.map((v: any) => ({
              id: `V-${v.id}`,
              type: "alert" as const,
              kind: v.violation_type?.includes("brts") ? ("brts" as const) : ("violation" as const),
              severity: "critical" as const,
              junctionId: v.lane_id?.split("_")[0] || "J001",
              junctionName: `Junction ${v.lane_id?.split("_")[0] || "J001"}`,
              message: `${v.vehicle_type?.toUpperCase() || "Vehicle"} detected violating ${v.violation_type?.replace("_", " ")}`,
              ts: new Date(v.timestamp).getTime() || Date.now(),
            }));
          }
        }

        if (rRes && rRes.ok) {
          const rawRecs = await rRes.json();
          if (Array.isArray(rawRecs)) {
            fetchedPredictions = rawRecs.map((r: any) => ({
              id: `P-${r.id}`,
              type: "prediction" as const,
              junctionId: r.junction_id,
              junctionName: SURAT_JUNCTION_NAMES[r.junction_id] || r.junction_name || `Junction ${r.junction_id}`,
              title: formatSimpleTitle(r.issue_type, r.suggested_action),
              detail: r.suggested_action || r.description,
              confidence: r.severity === "critical" ? 96 : 88,
              window: "Next 15m",
              series: [
                { t: "10m ago", v: 40 },
                { t: "5m ago", v: 65 },
                { t: "Now", v: 85 },
                { t: "In 5m", v: 92 },
              ],
            }));
          }
        }

        dispatch({
          type: "SET_INITIAL_DATA",
          payload: {
            junctions: fetchedJunctions,
            alerts: fetchedAlerts,
            predictions: fetchedPredictions,
          } as any,
        });
      } catch (e) {
        console.warn("Failed to load initial REST traffic data, falling back to mock defaults", e);
      }
    }

    loadBackendData();
  }, []);

  // 2. Real-time WebSocket Stream Subscriber
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        socket = new WebSocket(wsUrl("/api/ws/traffic"));

        socket.onopen = () => {
          console.log("Connected to E-Rakshak Live Traffic WebSocket Stream");
          dispatch({ type: "CONNECTION", payload: true });
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "junction_update") {
              dispatch({ type: "UPDATE_JUNCTION_WS", payload: data });
            } else if (data.type === "new_violation") {
              const uniqueId = `V-${data.id || "auto"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              dispatch({
                type: "ALERT",
                payload: {
                  id: uniqueId,
                  type: "alert",
                  kind: data.violation_type?.includes("brts") ? "brts" : "violation",
                  severity: "critical",
                  junctionId: data.lane_id?.split("_")[0] || "J001",
                  junctionName: data.junction_name || "Surat Junction",
                  message: `${data.vehicle_type?.toUpperCase() || "VEHICLE"} intruded ${data.lane_name || "BRTS Corridor"}`,
                  ts: Date.now(),
                },
              });
            } else if (data.type === "new_recommendation") {
              const uniqueId = `P-${data.id || "rec"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              dispatch({
                type: "PREDICTION",
                payload: {
                  id: uniqueId,
                  type: "prediction",
                  junctionId: data.junction_id,
                  junctionName: SURAT_JUNCTION_NAMES[data.junction_id] || data.junction_name || "Surat Junction",
                  title: formatSimpleTitle(data.issue_type, data.suggested_action),
                  detail: data.suggested_action || data.description || "Extend green light by +12s to clear queue",
                  confidence: data.severity === "critical" ? 95 : 85,
                  window: "Next 15m",
                  series: [
                    { t: "10m ago", v: 30 },
                    { t: "5m ago", v: 60 },
                    { t: "Now", v: 80 },
                    { t: "In 5m", v: 95 },
                  ],
                },
              });
            } else if (data.type === "detection" || data.type === "detection_event") {
              dispatch({
                type: "DETECTION",
                payload: {
                  id: data.id || `DET-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  ts: data.ts || Date.now(),
                  cameraId: data.camera_id || data.cameraId || "CAM-M09",
                  junctionName: data.junction_name || data.junctionName || "Majura Gate",
                  event: data.event || "vehicle_entry",
                  objectClass: data.object_class || data.objectClass || "car",
                  confidence: data.confidence || 88,
                  note: data.note,
                },
              });
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
        };

        socket.onclose = () => {
          dispatch({ type: "CONNECTION", payload: false });
          reconnectTimeout = setTimeout(connect, 3000);
        };

        socket.onerror = (err) => {
          console.warn("WebSocket error:", err);
          socket?.close();
        };
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    const countdownTimer = setInterval(() => {
      dispatch({ type: "TICK_DECAY" });
    }, 1000);

    // 3. Real YOLO Video Detections Stream across active camera feeds
    const cameraMap: { id: string; jName: string; videoKey: string }[] = [
      { id: "CAM-M09", jName: "Majura Gate", videoKey: "traffic9" },
      { id: "CAM-U01", jName: "Udhna Darwaja", videoKey: "traffic1" },
      { id: "CAM-R02", jName: "Ring Road / Delhi Gate", videoKey: "traffic2" },
      { id: "CAM-A03", jName: "Adajan Gam / Patia", videoKey: "traffic3" },
      { id: "CAM-P04", jName: "Piplod Junction", videoKey: "traffic4" },
      { id: "CAM-V05", jName: "Varachha / Sardar Chowk", videoKey: "traffic5" },
      { id: "CAM-K06", jName: "Kargil Chowk", videoKey: "traffic6" },
      { id: "CAM-T07", jName: "Textile Market", videoKey: "traffic7" },
      { id: "CAM-D08", jName: "Delhi Gate", videoKey: "traffic8" },
    ];

    let camPointer = 0;
    const checkpointIndices: Record<string, number> = {};

    const detectionTimer = setInterval(() => {
      const cam = cameraMap[camPointer % cameraMap.length];
      camPointer++;

      const checkpoints = VIDEO_DETECTIONS[cam.videoKey] || [];
      if (!checkpoints.length) return;

      const currIdx = (checkpointIndices[cam.videoKey] || 0) % checkpoints.length;
      checkpointIndices[cam.videoKey] = currIdx + 1;

      const cp = checkpoints[currIdx];
      if (!cp || !cp.events.length) return;

      for (const ev of cp.events) {
        const uid = `DET-${ev.frame}-${ev.objectClass}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        dispatch({
          type: "DETECTION",
          payload: {
            id: uid,
            ts: Date.now(),
            cameraId: cam.id,
            junctionName: cam.jName,
            event: ev.event,
            objectClass: ev.objectClass,
            confidence: ev.confidence,
            note: ev.note,
          },
        });

        // Broadcast alert when real vehicle intrudes into BRTS corridor
        if (ev.event === "brts_intrusion") {
          dispatch({
            type: "ALERT",
            payload: {
              id: `V-LIVE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "alert",
              kind: "brts",
              severity: "critical",
              junctionId: cam.id,
              junctionName: cam.jName,
              message: `${ev.objectClass.toUpperCase()} unauthorized intrusion in ${ev.lane || "BRTS Corridor"}`,
              ts: Date.now(),
            },
          });
        }
      }
    }, 1800);

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(countdownTimer);
      clearInterval(detectionTimer);
    };
  }, []);

  const stats = useMemo(() => {
    const online = state.junctions.filter((j: Junction) => j.camera.online).length;
    const avgCongestion = Math.round(
      state.junctions.reduce((a: number, j: Junction) => a + j.congestionIndex, 0) /
        state.junctions.length,
    );
    return {
      junctionsOnline: state.junctions.length,
      camerasOnline: online,
      camerasTotal: state.junctions.length,
      avgCongestion,
      activeIntrusions: BRTS_INTRUSIONS.length,
    };
  }, [state.junctions]);

  const getJunction = useCallback(
    (id: string | null) => state.junctions.find((j: Junction) => j.id === id) ?? null,
    [state.junctions],
  );

  return { ...state, stats, getJunction };
}

export type TrafficData = ReturnType<typeof useTrafficData>;
