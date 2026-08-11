import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp } from "lucide-react";

/** Subtle "scroll" cue shown while the main viewport is still at the top. */
export function ScrollHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const vp = document.querySelector<HTMLElement>("[data-app-viewport]");
    if (!vp) return;
    const onScroll = () => setVisible(vp.scrollTop < 40);
    vp.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => vp.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-2 rounded-full card-glass px-4 py-2 text-xs text-muted-foreground"
        >
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <ChevronUp className="w-4 h-4 text-snap" />
          </motion.span>
          Scroll to explore more flicks
        </motion.div>
      )}
    </AnimatePresence>
  );
}