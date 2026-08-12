import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp } from "lucide-react";

/** Subtle "scroll" cue shown while the main viewport is still at the top. Tap = jump to next section. */
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

  const scrollNext = useCallback(() => {
    const vp = document.querySelector<HTMLElement>("[data-app-viewport]");
    if (!vp) return;
    const top = vp.scrollTop;
    // Prefer an explicit next section marker; otherwise advance ~one viewport.
    const sections = Array.from(vp.querySelectorAll<HTMLElement>("[data-scroll-section]"));
    const next = sections.find((el) => el.offsetTop > top + 24);
    const target = next ? next.offsetTop - 8 : Math.min(top + vp.clientHeight * 0.9, vp.scrollHeight);
    vp.scrollTo({ top: target, behavior: "smooth" });
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollNext}
          aria-label="Scroll to next section"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          whileTap={{ scale: 0.95 }}
          className="hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-2 rounded-full card-glass px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <ChevronUp className="w-4 h-4 text-snap" />
          </motion.span>
          Scroll to explore more flicks
        </motion.button>
      )}
    </AnimatePresence>
  );
}