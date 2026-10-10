import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../config';

export type ComparePoint = { step: number; time?: string; adaptive: number; fixed: number; throughputAdaptive: number; throughputFixed: number };
type HeatmapRow = { junction: string; id: string; hours: number[] };
type Recommendation = { id: number; junction_id: string; issue_type: string; severity: string; description: string; suggested_action: string; status: string };

export function generateMockCompare(junctionId: string): ComparePoint[] {
  const seed = junctionId === "J001" ? 1 : junctionId === "J002" ? 2 : 3;
  return Array.from({ length: 16 }, (_, i) => {
    const baseAdaptive = 24 + seed * 2;
    const baseFixed = 54 + seed * 4;
    const isPeak = i >= 6 && i <= 11;
    const peakAdd = isPeak ? 8 : 0;
    const fixedPeakAdd = isPeak ? 22 : 0;
    return {
      step: i,
      time: `${9 + Math.floor(i / 2)}:${(i % 2) * 30 === 0 ? "00" : "30"}`,
      adaptive: Math.round(baseAdaptive + Math.sin((i + seed) / 2) * 4 + peakAdd),
      fixed: Math.round(baseFixed + Math.cos((i + seed) / 2.5) * 6 + fixedPeakAdd),
      throughputAdaptive: Math.round(2800 + i * 40 + Math.sin(i) * 200),
      throughputFixed: Math.round(2100 + i * 20 + Math.sin(i) * 150),
    };
  });
}

export function useAnalytics() {
  const [compareData, setCompareData] = useState<Record<string, ComparePoint[]>>({
    J001: generateMockCompare("J001"),
    J002: generateMockCompare("J002"),
    J003: generateMockCompare("J003"),
  });
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch fixed vs adaptive comparison for a junction
  const fetchCompare = useCallback(async (junctionId: string) => {
    try {
      const res = await fetch(apiUrl('/api/metrics/compare/' + junctionId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const pointsArray = Array.isArray(data) ? data : (data.comparison || []);
      if (!pointsArray || pointsArray.length === 0) throw new Error("Empty data");
      const points: ComparePoint[] = pointsArray.map((row: any, i: number) => ({
        step: i,
        time: row.time || `${9 + Math.floor(i / 2)}:${(i % 2) * 30 === 0 ? "00" : "30"}`,
        adaptive: row.adaptive_avg_wait_sec ?? row.adaptive_wait ?? row.adaptive_avg_wait ?? (26 + Math.sin(i) * 4),
        fixed: row.fixed_avg_wait_sec ?? row.fixed_wait ?? row.fixed_avg_wait ?? (58 + Math.cos(i) * 6),
        throughputAdaptive: row.adaptive_throughput_veh ?? row.adaptive_throughput ?? 2800,
        throughputFixed: row.fixed_throughput_veh ?? row.fixed_throughput ?? 2100,
      }));
      setCompareData(prev => ({ ...prev, [junctionId]: points }));
    } catch {
      setCompareData(prev => ({
        ...prev,
        [junctionId]: prev[junctionId] || generateMockCompare(junctionId)
      }));
    }
  }, []);

  useEffect(() => {
    fetchCompare("J001");
  }, [fetchCompare]);

  // Fetch heatmap
  useEffect(() => {
    async function loadHeatmap() {
      try {
        const res = await fetch(apiUrl('/api/analytics/heatmap'));
        if (res.ok) {
          const data = await res.json();
          // data expected: { junctions: [{id, name, hourly: [24 numbers]}] }
          if (data.junctions) {
            setHeatmap(data.junctions.map((j: any) => ({
              junction: j.name.length > 20 ? j.name.slice(0, 18) + '..' : j.name,
              id: j.id,
              hours: j.hourly || Array.from({ length: 24 }, (_, h) => Math.round(20 + Math.sin((h - 8) / 3) * 30 + Math.random() * 10)),
            })));
          } else {
            throw new Error('no data');
          }
        } else throw new Error('non-ok');
      } catch {
        // Mock heatmap using typical Surat traffic pattern
        const junctions = ['Udhna Darwaja','Delhi Gate','Majura Gate','Sahara Darwaja','Athwa Gate','Varachha','Station Circle'];
        setHeatmap(junctions.map((name, ji) => ({
          junction: name,
          id: 'JN-0' + (ji + 1),
          hours: Array.from({ length: 24 }, (_, h) => {
            // Morning peak 8-10, Evening peak 17-20
            const morning = h >= 8 && h <= 10 ? 80 + (ji * 5 % 15) : 0;
            const evening = h >= 17 && h <= 20 ? 85 + (ji * 7 % 12) : 0;
            const base = 15 + (ji * 3 % 20);
            return Math.min(100, Math.round(base + morning + evening + Math.sin((h + ji) / 2) * 8));
          }),
        })));
      }
      setLoading(false);
    }
    loadHeatmap();
    const id = setInterval(loadHeatmap, 60000);
    return () => clearInterval(id);
  }, []);

  // Fetch recommendations
  useEffect(() => {
    async function loadRecs() {
      try {
        const res = await fetch(apiUrl('/api/recommendations'));
        if (res.ok) {
          const data = await res.json();
          setRecommendations(Array.isArray(data) ? data : []);
        }
      } catch { /* use empty */ }
    }
    loadRecs();
    const id = setInterval(loadRecs, 15000);
    return () => clearInterval(id);
  }, []);

  const updateRecStatus = useCallback(async (id: number, status: string) => {
    try {
      await fetch(apiUrl('/api/recommendations/' + id + '/status'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch {}
  }, []);

  return { compareData, fetchCompare, heatmap, recommendations, updateRecStatus, loading };
}
