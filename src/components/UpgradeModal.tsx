import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, BadgeCheck, Palette, Crown } from "lucide-react";
import { usePremium } from "@/lib/premium";
import { toast } from "sonner";

export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isPremium, activate } = usePremium();

  const start = async () => {
    await activate();
    toast.success("Flick Verified is on. Welcome to the inner circle.");
    onClose();
  };

  const perks = [
    { icon: BadgeCheck, t: "Verified badge", d: "Stand out everywhere your handle appears." },
    { icon: Palette, t: "Editable theme", d: "Customize colors, fonts & chat backgrounds." },
    { icon: Sparkles, t: "Premium reactions", d: "Animated emoji and exclusive story stickers." },
    { icon: Crown, t: "Priority delivery", d: "Your stories and DMs jump the queue." },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur grid place-items-end md:place-items-center">
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }} onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-md card-glass rounded-t-3xl md:rounded-3xl p-6 border border-border relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-snap/30 blur-3xl pointer-events-none" />
            <button onClick={onClose} className="absolute top-4 right-4 p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 bg-snap text-snap-foreground rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <BadgeCheck className="w-3.5 h-3.5" /> Flick Verified
              </div>
              <h2 className="font-display text-3xl mt-3 leading-tight">Make Flick yours.</h2>
              <p className="text-sm text-muted-foreground mt-1">Unlock the editable, premium tier built for creators.</p>
              <ul className="mt-5 space-y-3">
                {perks.map((p) => (
                  <li key={p.t} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-snap/15 text-snap grid place-items-center shrink-0"><p.icon className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1.5">{p.t} <Check className="w-3.5 h-3.5 text-snap" /></div>
                      <div className="text-xs text-muted-foreground">{p.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl border border-snap/40 bg-snap/5 p-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-snap font-bold">Intro price</div>
                  <div className="font-display text-3xl mt-1">$4.99<span className="text-sm text-muted-foreground font-sans">/mo</span></div>
                </div>
                <div className="text-[10px] text-muted-foreground text-right max-w-[120px]">Cancel anytime. Billing launches with Stripe — your account is unlocked now.</div>
              </div>
              {isPremium ? (
                <div className="mt-5 text-center text-sm text-snap font-semibold">You're already Verified ✦</div>
              ) : (
                <button onClick={start} className="mt-5 w-full bg-snap text-snap-foreground rounded-full py-3.5 font-bold text-sm shadow-[0_0_30px_rgba(180,255,80,0.4)]">
                  Upgrade to Verified
                </button>
              )}
              <button onClick={onClose} className="mt-2 w-full text-xs text-muted-foreground py-2">Maybe later</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}