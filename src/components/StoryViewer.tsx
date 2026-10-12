import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Eye,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { StoryGroup } from "./StoriesBar";
import { Avatar } from "./Avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { StoryViewersOverlay } from "./StoryViewersOverlay";
import {
  getStoryViews,
  recordStoryView,
  addStoryReaction,
  listenStoryViews,
  type StoryViewsData,
} from "@/lib/storyViews";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";

const DEFAULT_SEGMENT_DURATION_MS = 5500;
const REACTION_EMOJIS = ["🔥", "❤️", "😂", "😮", "👏"] as const;

export function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[] | null;
  startIndex: number;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [tapEffect, setTapEffect] = useState<"left" | "right" | null>(null);
  const [showViewersOverlay, setShowViewersOverlay] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string }[]>([]);

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
    setShowViewersOverlay(false);
  }, [startIndex, groups]);

  const group = groups?.[gi];
  const seg = group?.segments[si];
  const isVideo = seg?.media_type === "video";

  // Story views data for the active segment
  const [viewsData, setViewsData] = useState<StoryViewsData>(() =>
    seg ? getStoryViews(seg.id) : { totalCount: 0, viewers: [], reactions: {} }
  );

  // Sync and record story views
  useEffect(() => {
    if (!seg) return;
    const current = getStoryViews(seg.id);
    setViewsData(current);

    if (user && profile) {
      const updated = recordStoryView(seg.id, {
        id: user.id,
        handle: profile.handle,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
      setViewsData(updated);
    }

    const unsub = listenStoryViews(seg.id, (fresh) => {
      setViewsData(fresh);
    });

    return () => unsub();
  }, [seg, user, profile]);

  // Pause when viewers overlay is open
  useEffect(() => {
    if (showViewersOverlay) {
      setIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    } else {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  }, [showViewersOverlay]);

  // Navigation handlers
  const advance = useCallback(() => {
    if (!groups || !group || showViewersOverlay) return;
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
  }, [groups, group, si, gi, onClose, showViewersOverlay]);

  const back = useCallback(() => {
    if (!groups || showViewersOverlay) return;
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
      setProgress(0);
      pausedAtProgressRef.current = 0;
      startTimeRef.current = performance.now();
    }
  }, [groups, si, gi, progress, showViewersOverlay]);

  // Main progress and timer loop
  useEffect(() => {
    if (!seg || showViewersOverlay) return;

    if (isVideo) {
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
  }, [seg, isPaused, isVideo, advance, showViewersOverlay]);

  // Video time update handler
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || showViewersOverlay) return;
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
      if (e.key === "Escape") {
        if (showViewersOverlay) setShowViewersOverlay(false);
        else onClose();
      } else if (e.key === "ArrowRight" && !showViewersOverlay) {
        advance();
        showTapFeedback("right");
      } else if (e.key === "ArrowLeft" && !showViewersOverlay) {
        back();
        showTapFeedback("left");
      } else if (e.key === "ArrowUp") {
        setShowViewersOverlay(true);
      } else if (e.key === "ArrowDown") {
        setShowViewersOverlay(false);
      } else if ((e.key === " " || e.key === "Spacebar") && !showViewersOverlay) {
        setIsPaused((p) => !p);
      }
    };
    if (groups) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups, advance, back, onClose, showViewersOverlay]);

  const showTapFeedback = (side: "left" | "right") => {
    setTapEffect(side);
    window.setTimeout(() => setTapEffect(null), 320);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (showViewersOverlay) return;
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
    if (showViewersOverlay) return;

    const deltaY = e.clientY - touchStartYRef.current;
    // Swipe down to dismiss story
    if (deltaY > 90) {
      onClose();
      return;
    }
    // Swipe up to open viewers overlay!
    if (deltaY < -60) {
      setShowViewersOverlay(true);
      return;
    }

    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    } else {
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
    if (!showViewersOverlay) {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  const handleQuickReaction = (emoji: string) => {
    if (!seg) return;
    const actor = profile || {
      id: user?.id || "u-current",
      handle: "me",
      display_name: "You",
      avatar_url: null,
    };
    const updated = addStoryReaction(seg.id, actor, emoji);
    setViewsData(updated);

    // Floating reaction animation
    const id = `float-${Date.now()}-${Math.random()}`;
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 1400);

    // Trigger fullstack notification for the story author
    if (group?.author?.id) {
      notify({
        kind: "like",
        title: `${actor.display_name} reacted to your story`,
        message: `${emoji} reaction on your story flick`,
        actor: {
          id: actor.id,
          display_name: actor.display_name,
          handle: actor.handle,
          avatar_url: actor.avatar_url,
        },
        recipients: [group.author.id],
        url: "/",
      });
    }
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
              <div className="absolute bottom-20 inset-x-0 text-center text-white text-base md:text-lg font-semibold px-6 drop-shadow-xl z-20 pointer-events-none">
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
              <div className="absolute right-3 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md border border-white/15 opacity-0 group-hover:opacity-80 transition-opacity flex items-center justify-center text-white pointer-events-none">
                <ChevronRight className="w-6 h-6 ml-0.5" />
              </div>
            </div>
          </div>

          {/* BOTTOM INTERACTIVE BAR: Viewers Count Trigger & Quick Reactions */}
          <div
            className="absolute bottom-4 inset-x-4 z-40 pointer-events-auto flex items-center justify-between gap-3"
            style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
          >
            {/* Viewers Overlay Trigger Pill */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setShowViewersOverlay(true)}
              className="bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/20 rounded-full py-1.5 px-3 flex items-center gap-2 shadow-xl group transition-colors"
              title="View story viewers and analytics"
            >
              {/* Mini avatar stack of first 3 viewers */}
              <div className="flex -space-x-2 shrink-0">
                {viewsData.viewers.slice(0, 3).map((v, idx) => (
                  <div
                    key={v.id || idx}
                    className="w-6 h-6 rounded-full border-2 border-black overflow-hidden bg-secondary relative"
                  >
                    <Avatar url={v.avatar_url} name={v.display_name} size={24} />
                  </div>
                ))}
              </div>

              {/* Total Viewers Count */}
              <div className="flex items-center gap-1.5 text-white">
                <Eye className="w-3.5 h-3.5 text-snap" />
                <span className="text-xs font-bold leading-none">
                  {viewsData.totalCount} {viewsData.totalCount === 1 ? "view" : "views"}
                </span>
                <ChevronUp className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-transform group-hover:-translate-y-0.5" />
              </div>
            </motion.button>

            {/* Quick Emoji Reaction Pill */}
            <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full py-1 px-2 flex items-center gap-1 shadow-xl">
              {REACTION_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.85 }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickReaction(emoji);
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-sm transition"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Floating Emoji Reaction Particles */}
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            <AnimatePresence>
              {floatingEmojis.map(({ id, emoji }) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 1, scale: 0.6, y: window.innerHeight - 100, x: window.innerWidth * 0.7 }}
                  animate={{
                    opacity: 0,
                    scale: 2.2,
                    y: window.innerHeight * 0.35,
                    x: window.innerWidth * 0.65 + (Math.random() * 60 - 30),
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="absolute text-4xl drop-shadow-2xl"
                >
                  {emoji}
                </motion.div>
              ))}
            </AnimatePresence>
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

          {/* Paused Indicator Overlay (shows only when manually paused and overlay closed) */}
          <AnimatePresence>
            {isPaused && !showViewersOverlay && (
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

          {/* Story Viewers Overlay Drawer */}
          <StoryViewersOverlay
            open={showViewersOverlay}
            onClose={() => setShowViewersOverlay(false)}
            viewsData={viewsData}
            storyCaption={seg.caption}
            storyMediaUrl={seg.image_url}
            storyCreatedAt={seg.created_at}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
