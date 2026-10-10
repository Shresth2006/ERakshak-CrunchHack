import { getVideoForFeed } from "@/lib/video-feeds";
import type { CameraFeed } from "@/lib/traffic-types";

export function CameraTile({
  feed,
  overlays,
  brtsOnly,
  onClick,
  large = false,
  staggerIndex = 0,
  onTimeUpdate,
}: {
  feed: CameraFeed;
  overlays: boolean;
  brtsOnly: boolean;
  onClick?: () => void;
  large?: boolean;
  staggerIndex?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  const videoUrl = getVideoForFeed(feed);
  const hasLiveVideo = !!videoUrl && feed.online;
  const isPending = !feed.online;

  const showBrts = !brtsOnly || feed.hasBrtsZone;
  if (!showBrts) return null;

  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className="camera-tile group relative block w-full overflow-hidden text-left"
      style={{ animationDelay: staggerIndex * 50 + "ms" }}
    >
      <div className={"relative overflow-hidden " + (large ? "aspect-video" : "aspect-video")}>

        {/* ── Live Video Feed ───────────────────────── */}
        {hasLiveVideo && feed.online ? (
          <video
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
                if (el.paused) {
                  el.play().catch(() => {});
                }
              }
            }}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes("traffic3.mp4")) {
                target.src = "/videos/traffic3.mp4";
              }
            }}
            onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime, e.currentTarget.duration)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.9 }}
          />
        ) : feed.online && !hasLiveVideo ? (
          /* Online camera but no video file yet — show animated placeholder */
          <div className="absolute inset-0 bg-[#09090b]">
            <div className="pending-grid" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-primary/20 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-heartbeat" />
              </div>
              <span className="label-xs text-primary/40 text-[8px]">SIGNAL ACQUIRED</span>
            </div>
          </div>
        ) : (
          /* PENDING / OFFLINE tile */
          <div className="absolute inset-0 bg-[#09090b]">
            <div className="pending-grid" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-blink" />
              </div>
              <span className="label-xs text-[8px] text-muted-foreground/50">FEED PENDING</span>
            </div>
          </div>
        )}

        {/* ── Scan Line (live feeds only) ─────────── */}
        {feed.online && <div className="scan-line" />}

        {/* ── CRT scanline texture ─────────────────── */}
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,0.8) 2px 3px)", backgroundSize: "100% 3px" }} />



        {/* ── BRTS intrusion warning flash ─────────── */}
        {feed.intrusionActive && (
          <div className="pointer-events-none absolute inset-0 border-2 border-crit/70 animate-burst" />
        )}

        {/* ── Top-left overlays ────────────────────── */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          {feed.online ? (
            <span className="flex items-center gap-1 border border-crit/60 bg-crit/15 px-1.5 py-0.5 rounded-sm">
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-crit" />
              <span className="num text-[8px] font-bold text-crit">LIVE</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 border border-border bg-panel/80 px-1.5 py-0.5 rounded-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              <span className="num text-[8px] text-muted-foreground/60">PENDING</span>
            </span>
          )}
          {feed.hasBrtsZone && (
            <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 rounded-sm">
              <span className="num text-[8px] font-bold text-primary">BRTS</span>
            </span>
          )}
        </div>

        {/* ── Camera ID + bottom telemetry ─────────── */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-end justify-between gap-1">
            <div>
              <div className="num text-[9px] font-bold text-white/90 leading-none">{feed.id}</div>
              <div className="label-xs text-[7px] text-white/50 mt-0.5 truncate max-w-[100px]">{feed.junctionName}</div>
            </div>
            {feed.online && (
              <div className="flex items-center gap-2">
                <span className="num text-[9px] text-primary/90">{feed.vehicleCount}v</span>
                <span className="num text-[9px] text-white/60">{feed.avgSpeed}km/h</span>
                <span className="num text-[9px] text-warn/80">Q{feed.queueLength}m</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Hover expand hint ────────────────────── */}
        {onClick && (
          <div className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <span className="num text-[10px] text-primary font-bold bg-black/60 px-2 py-1 rounded">EXPAND ↗</span>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
