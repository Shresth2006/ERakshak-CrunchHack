export const LIVE_FEEDS: Record<string, string> = {
  "JN-01": "/videos/traffic1.mp4",
  "JN-02": "/videos/traffic2.mp4",
  "JN-03": "/videos/traffic3.mp4",
  "JN-04": "/videos/traffic4.mp4",
  "JN-05": "/videos/traffic5.mp4",
  "JN-06": "/videos/traffic6.mp4",
  "JN-07": "/videos/traffic7.mp4",
  "JN-08": "/videos/traffic8.mp4",
  "JN-09": "/videos/traffic9.mp4",
  "J001": "/videos/traffic1.mp4",
  "J002": "/videos/traffic2.mp4",
  "J003": "/videos/traffic3.mp4",
  "J004": "/videos/traffic4.mp4",
  "J005": "/videos/traffic5.mp4",
  "J006": "/videos/traffic6.mp4",
  "J007": "/videos/traffic7.mp4",
  "J008": "/videos/traffic8.mp4",
  "J009": "/videos/traffic9.mp4",
  "CAM-U01": "/videos/traffic1.mp4",
  "CAM-R02": "/videos/traffic2.mp4",
  "CAM-A03": "/videos/traffic3.mp4",
  "CAM-P04": "/videos/traffic4.mp4",
  "CAM-V05": "/videos/traffic5.mp4",
  "CAM-K06": "/videos/traffic6.mp4",
  "CAM-T07": "/videos/traffic7.mp4",
  "CAM-D08": "/videos/traffic8.mp4",
  "CAM-M09": "/videos/traffic9.mp4",
  "CAM-01": "/videos/traffic1.mp4",
  "CAM-02": "/videos/traffic2.mp4",
  "CAM-03": "/videos/traffic3.mp4",
  "CAM-04": "/videos/traffic4.mp4",
  "CAM-05": "/videos/traffic5.mp4",
  "CAM-06": "/videos/traffic6.mp4",
  "CAM-07": "/videos/traffic7.mp4",
  "CAM-08": "/videos/traffic8.mp4",
  "CAM-09": "/videos/traffic9.mp4",
  "traffic1": "/videos/traffic1.mp4",
  "traffic2": "/videos/traffic2.mp4",
  "traffic3": "/videos/traffic3.mp4",
  "traffic4": "/videos/traffic4.mp4",
  "traffic5": "/videos/traffic5.mp4",
  "traffic6": "/videos/traffic6.mp4",
  "traffic7": "/videos/traffic7.mp4",
  "traffic8": "/videos/traffic8.mp4",
  "traffic9": "/videos/traffic9.mp4",
};

export function getVideoForFeed(feed: { id?: string; junctionId?: string } | string | null | undefined): string | null {
  if (!feed) return null;
  const idStr = typeof feed === "string" ? feed : (feed.junctionId || feed.id || "");
  if (LIVE_FEEDS[idStr]) return LIVE_FEEDS[idStr];
  if (typeof feed !== "string") {
    if (feed.junctionId && LIVE_FEEDS[feed.junctionId]) return LIVE_FEEDS[feed.junctionId];
    if (feed.id && LIVE_FEEDS[feed.id]) return LIVE_FEEDS[feed.id];
  }
  const num = parseInt(idStr.replace(/\D/g, "") || "0", 10);
  if (num >= 1 && num <= 9) return `/videos/traffic${num}.mp4`;
  return null;
}
