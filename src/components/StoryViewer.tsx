import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Pause, Play } from "lucide-react";
import type { StoryGroup } from "./StoriesBar";
import { Avatar } from "./Avatar";
import { formatDistanceToNowStrict } from "date-fns";

const DEFAULT_SEGMENT_DURATION_MS = 5500;

export function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[] | null;
  startIndex: number;
  onClose: () => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [tapEffect, setTapEffect] = useState<"left" | "right" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtProgressRef = useRef<number>(0);
  const pressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartYRef = useRef<number>(0);

  useEffect(() => {
    setGi(startIndex);
    setSi(0);
    setProgress(0);
    pausedAtProgressRef.current = 0;
  }, [startIndex, groups]);

  const group = groups?.[gi];
  const seg = group?.segments[si];
  const isVideo = seg?.media_type === "video";

  // Navigation handlers
  const advance = useCallback(() => {
    if (!groups || !group) return;
    if (si + 1 < group.segments.length) {
      setSi((prev) => prev + 1);
      setProgress(0);
      pausedAtProgressRef.current = 0;
    } else if (gi + 1 < groups.length) {
      setGi((prev) => prev + 1);
      setSi(0);
      setProgress(0);
      pausedAtProgressRef.current = 0;
    } else {
      onClose();
    }
  }, [groups, group, si, gi, onClose]);

  const back = useCallback(() => {
    if (!groups) return;
    // If progress is more than 20% into the current segment, restart current segment first
    if (progress > 0.2) {
      setProgress(0);
      pausedAtProgressRef.current = 0;
      startTimeRef.current = performance.now();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      return;
    }

    if (si > 0) {
      setSi((prev) => prev - 1);
      setProgress(0);
      pausedAtProgressRef.current = 0;
    } else if (gi > 0) {
      const prevGroup = groups[gi - 1];
      setGi((prev) => prev - 1);
      setSi(prevGroup.segments.length - 1);
      setProgress(0);
      pausedAtProgressRef.current = 0;
    } else {
      // At beginning of first story: reset progress
      setProgress(0);
      pausedAtProgressRef.current = 0;
      startTimeRef.current = performance.now();
    }
  }, [groups, si, gi, progress]);

  // Main progress and timer loop
  useEffect(() => {
    if (!seg) return;

    if (isVideo) {
      // Video drives its own progress
      return;
    }

    const duration = DEFAULT_SEGMENT_DURATION_MS;

    if (isPaused) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    startTimeRef.current = performance.now() - pausedAtProgressRef.current * duration;

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const currentFrac = Math.min(elapsed / duration, 1);
      setProgress(currentFrac);
      pausedAtProgressRef.current = currentFrac;

      if (currentFrac >= 1) {
        advance();
      } else {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [seg, isPaused, isVideo, advance]);

  // Video time update handler
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    const cur = videoRef.current.currentTime;
    if (dur && dur > 0) {
      const frac = cur / dur;
      setProgress(frac);
      pausedAtProgressRef.current = frac;
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") {
        advance();
        showTapFeedback("right");
      } else if (e.key === "ArrowLeft") {
        back();
        showTapFeedback("left");
      } else if (e.key === " " || e.key === "Spacebar") {
        setIsPaused((p) => !p);
      }
    };
    if (groups) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups, advance, back, onClose]);

  const showTapFeedback = (side: "left" | "right") => {
    setTapEffect(side);
    window.setTimeout(() => setTapEffect(null), 320);
  };

  // Tap vs Long-Press handling for screen areas
  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartYRef.current = e.clientY;
    isLongPressRef.current = false;
    pressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      setIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }, 220);
  };

  const handlePointerUp = (side: "left" | "right", e: React.PointerEvent) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    // Check vertical swipe down to dismiss
    const deltaY = e.clientY - touchStartYRef.current;
    if (deltaY > 90) {
      onClose();
      return;
    }

    if (isLongPressRef.current) {
      // Long press ended: resume playback
      isLongPressRef.current = false;
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    } else {
      // Short tap: navigate
      showTapFeedback(side);
      if (side === "left") {
        back();
      } else {
        advance();
      }
    }
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    isLongPressRef.current = false;
    setIsPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  return (
    <AnimatePresence>
      {groups && group && seg && (
        <motion.div
          className="fixed inset-0 z-[80] bg-black overflow-hidden select-none"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ height: "100dvh" }}
        >
          {/* Top Segment Progress Bars */}
          <div className="absolute top-2.5 inset-x-3 flex items-center gap-1.5 z-40 pointer-events-none">
            {group.segments.map((s, i) => {
              const isPast = i < si;
              const isCurrent = i === si;
              const fillPercent = isPast ? 100 : isCurrent ? progress * 100 : 0;

              return (
                <div
                  key={`${group.author.id}-${s.id}-${i}`}
                  className="flex-1 h-1.5 rounded-full bg-white/20 backdrop-blur-sm overflow-hidden relative"
                >
                  <div
                    className="h-full bg-snap rounded-full transition-[width] ease-linear"
                    style={{
                      width: `${fillPercent}%`,
                      transitionDuration: isCurrent ? "70ms" : "0ms",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Top Header: Author, timestamp, controls */}
          <div className="absolute top-6 inset-x-4 mt-2 flex items-center justify-between z-40 pointer-events-none">
            <div className="flex items-center gap-2.5">
              <Avatar url={group.author.avatar_url} name={group.author.display_name} size={38} />
              <div className="text-white drop-shadow-md">
                <div className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  @{group.author.handle}
                  {group.segments.length > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/90 font-medium">
                      {si + 1}/{group.segments.length}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/70">
                  {formatDistanceToNowStrict(new Date(seg.created_at))} ago
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Pause indicator / button */}
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                title={isPaused ? "Play story" : "Pause story"}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition border border-white/10"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <Pause className="w-4 h-4" />}
              </button>

              {/* Mute button (for videos) */}
              {isVideo && (
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  title={isMuted ? "Unmute" : "Mute"}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition border border-white/10"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close story viewer"
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center transition border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Media Content Surface */}
          <div className="absolute inset-0 grid place-items-center bg-black">
            {isVideo ? (
              <video
                ref={videoRef}
                key={seg.id}
                src={seg.image_url}
                autoPlay
                playsInline
                muted={isMuted}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={advance}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <img
                key={seg.id}
                src={seg.image_url}
                alt={seg.caption || "Story image"}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
            )}

            {/* Story Caption Overlay */}
            {seg.caption && (
              <div className="absolute bottom-16 inset-x-0 text-center text-white text-base md:text-lg font-semibold px-6 drop-shadow-xl z-20 pointer-events-none">
                <span className="inline-block px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
                  {seg.caption}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Navigation Zones (Left & Right Sides) */}
          <div className="absolute inset-0 z-30 flex">
            {/* LEFT INTERACTIVE AREA (Previous Story Segment) */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Previous story segment"
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp("left", e)}
              onPointerCancel={handlePointerCancel}
              className="w-2/5 h-full relative cursor-pointer group focus:outline-none flex items-center"
            >
              {/* Subtle visual hover cue */}
              <div className="absolute left-3 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md border border-white/15 opacity-0 group-hover:opacity-80 transition-opacity flex items-center justify-center text-white pointer-events-none">
                <ChevronLeft className="w-6 h-6 -ml-0.5" />
              </div>
            </div>

            {/* RIGHT INTERACTIVE AREA (Next Story Segment) */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Next story segment"
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp("right", e)}
              onPointerCancel={handlePointerCancel}
              className="w-3/5 h-full relative cursor-pointer group focus:outline-none flex items-center justify-end"
            >
              {/* Subtle visual hover cue */}
              <div className="absolute right-3 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md border border-white/15 opacity-0 group-hover:opacity-80 transition-opacity flex items-center justify-center text-white pointer-events-none">
                <ChevronRight className="w-6 h-6 ml-0.5" />
              </div>
            </div>
          </div>

          {/* Tap Feedback Ripples / Indicators */}
          <AnimatePresence>
            {tapEffect === "left" && (
              <motion.div
                initial={{ opacity: 0.8, scale: 0.8, x: 20 }}
                animate={{ opacity: 0, scale: 1.4, x: -10 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-40 pointer-events-none w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30"
              >
                <ChevronLeft className="w-8 h-8" />
              </motion.div>
            )}
            {tapEffect === "right" && (
              <motion.div
                initial={{ opacity: 0.8, scale: 0.8, x: -20 }}
                animate={{ opacity: 0, scale: 1.4, x: 10 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-40 pointer-events-none w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30"
              >
                <ChevronRight className="w-8 h-8" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Paused Indicator Overlay */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-xs font-semibold flex items-center gap-1.5 pointer-events-none"
              >
                <Pause className="w-3.5 h-3.5 fill-current" /> Paused
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
