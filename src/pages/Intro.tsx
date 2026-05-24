import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";

export default function IntroPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) return;
      nav(session ? "/" : "/auth", { replace: true });
    }, 2600);
    return () => clearTimeout(t);
  }, [nav, session, loading]);

  return (
    <main className="fixed inset-0 z-50 overflow-hidden grid grid-cols-2">
      {/* Left noir panel */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="surface-noir relative flex flex-col justify-between p-8"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="font-display text-2xl tracking-tight text-snap"
        >
          FL
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="absolute inset-0 grid place-items-center pointer-events-none"
        >
          <div className="w-[140%] aspect-square rounded-full bg-snap/15 blur-3xl" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="relative font-display text-[18vw] md:text-[10vw] leading-[0.85] text-foreground"
        >
          flick
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="relative text-xs text-muted-foreground tracking-[0.3em] uppercase"
        >
          Share moments instantly
        </motion.p>
      </motion.div>

      {/* Right warm panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="surface-warm relative flex flex-col justify-between p-8"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-right text-xs uppercase tracking-[0.25em]"
        >
          v1 · 2026
        </motion.div>

        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid place-items-center"
        >
          <div className="absolute w-48 h-48 rounded-full bg-foreground/10 blur-2xl" />
          <div className="relative w-40 h-40 rounded-full border-[6px] border-foreground/80 grid place-items-center">
            <div className="w-28 h-28 rounded-full bg-foreground/90 grid place-items-center font-display text-5xl text-warm" style={{ color: "oklch(0.86 0.07 80)" }}>
              F
            </div>
          </div>
        </motion.div>

        <div className="space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="text-xs uppercase tracking-[0.3em]"
          >
            Loading experience
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
            className="h-[2px] bg-foreground/80"
          />
        </div>
      </motion.div>

      {/* Center wordmark seam */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        className="absolute inset-0 pointer-events-none grid place-items-center"
      >
        <span className="font-display text-3xl tracking-[0.4em] text-snap mix-blend-difference">
          FLICK
        </span>
      </motion.div>
    </main>
  );
}