import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { StoryRow } from "./StoriesBar";

export function StoryViewer({ story, onClose }: { story: StoryRow | null; onClose: () => void }) {
  useEffect(() => {
    if (!story) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [story, onClose]);

  return (
    <AnimatePresence>
      {story && (
        <motion.div className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute top-0 inset-x-4 mt-3 h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div className="h-full bg-snap" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 6, ease: "linear" }} />
          </div>
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold">
                {story.author?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="text-white">
                <div className="text-sm font-semibold">@{story.author?.handle}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white"><X /></button>
          </div>
          <img src={story.image_url} alt="" className="max-h-[90vh] max-w-full object-contain" />
          {story.caption && (
            <div className="absolute bottom-10 left-0 right-0 text-center text-white text-lg font-semibold px-6 drop-shadow-lg">
              {story.caption}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
