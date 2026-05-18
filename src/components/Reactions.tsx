import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Smile } from "lucide-react";

const EMOJIS = ["🔥", "😂", "😍", "😮", "😢", "👏"] as const;

export function Reactions({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.from("reactions").select("emoji, user_id").eq("post_id", postId);
    const c: Record<string, number> = {};
    let me: string | null = null;
    (data ?? []).forEach((r) => {
      c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) me = r.emoji;
    });
    setCounts(c);
    setMine(me);
  };

  useEffect(() => {
    refresh();
    const ch = supabase.channel(`rx-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions", filter: `post_id=eq.${postId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  const pick = async (e: string) => {
    if (!user) return;
    setOpen(false);
    if (mine === e) {
      setMine(null);
      await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      setMine(e);
      await supabase.from("reactions").upsert({ post_id: postId, user_id: user.id, emoji: e });
    }
  };

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-muted-foreground hover:text-snap transition"
        aria-label="React"
      >
        {mine ? <span className="text-base leading-none">{mine}</span> : <Smile className="w-4 h-4" />}
      </button>
      {top.length > 0 && (
        <span className="flex items-center -space-x-1 text-sm">
          {top.map(([e]) => <span key={e}>{e}</span>)}
          <span className="ml-1.5 text-xs text-muted-foreground">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
        </span>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="absolute bottom-full mb-2 left-0 z-20 flex gap-1 bg-card border border-border rounded-full px-2 py-1.5 shadow-lg"
          >
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => pick(e)}
                className={`text-xl hover:scale-125 transition-transform ${mine === e ? "scale-125" : ""}`}>
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}