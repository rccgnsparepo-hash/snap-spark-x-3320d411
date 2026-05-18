import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { StoryGroup } from "./StoriesBar";
import { Avatar } from "./Avatar";
import { formatDistanceToNowStrict } from "date-fns";

const SEGMENT_MS = 6000;

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
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);
  const start = useRef<number>(0);
  const elapsed = useRef<number>(0);

  useEffect(() => { setGi(startIndex); setSi(0); }, [startIndex, groups]);

  const group = groups?.[gi];
  const seg = group?.segments[si];

  const advance = () => {
    if (!groups || !group) return;
    if (si + 1 < group.segments.length) { setSi(si + 1); }
    else if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); }
    else { onClose(); }
  };
  const back = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { const prev = groups![gi - 1]; setGi(gi - 1); setSi(prev.segments.length - 1); }
  };

  useEffect(() => {
    if (!seg) return;
    elapsed.current = 0;
    const isVideo = seg.media_type === "video";
    if (isVideo) return; // video drives its own timing via onEnded
    const tick = () => {
      if (paused) return;
      start.current = performance.now();
      timer.current = window.setTimeout(advance, SEGMENT_MS - elapsed.current);
    };
    tick();
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, paused, seg?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") back();
    };
    if (groups) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, gi, si]);

  return (
    <AnimatePresence>
      {groups && group && seg && (
        <motion.div className="fixed inset-0 z-50 bg-black grid place-items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

          {/* segment progress bars */}
          <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
            {group.segments.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                <motion.div
                  className="h-full bg-snap"
                  initial={{ width: i < si ? "100%" : "0%" }}
                  animate={{ width: i < si ? "100%" : i === si ? "100%" : "0%" }}
                  transition={{ duration: i === si ? SEGMENT_MS / 1000 : 0, ease: "linear" }}
                  key={`${gi}-${si}-${i}`}
                />
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute top-6 inset-x-4 mt-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <Avatar url={group.author.avatar_url} name={group.author.display_name} size={36} />
              <div className="text-white">
                <div className="text-sm font-semibold leading-tight">@{group.author.handle}</div>
                <div className="text-[11px] text-white/60">{formatDistanceToNowStrict(new Date(seg.created_at))} ago</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-2"><X /></button>
          </div>

          {/* media */}
          <div
            className="relative w-full h-full grid place-items-center"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {seg.media_type === "video" ? (
              <video
                key={seg.id}
                src={seg.image_url}
                autoPlay
                playsInline
                onEnded={advance}
                className="max-h-[90vh] max-w-full object-contain"
              />
            ) : (
              <img key={seg.id} src={seg.image_url} alt="" className="max-h-[90vh] max-w-full object-contain" />
            )}
            {seg.caption && (
              <div className="absolute bottom-10 left-0 right-0 text-center text-white text-lg font-semibold px-6 drop-shadow-lg">
                {seg.caption}
              </div>
            )}
          </div>

          {/* tap zones */}
          <button aria-label="Previous" onClick={back}
            className="absolute inset-y-0 left-0 w-1/3 group">
            <ChevronLeft className="w-6 h-6 text-white/0 group-hover:text-white/40 transition mx-3" />
          </button>
          <button aria-label="Next" onClick={advance}
            className="absolute inset-y-0 right-0 w-1/3 group flex justify-end items-center">
            <ChevronRight className="w-6 h-6 text-white/0 group-hover:text-white/40 transition mx-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}