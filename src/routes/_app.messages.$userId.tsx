import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string; expires_at: string };
type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export const Route = createFileRoute("/_app/messages/$userId")({
  component: Thread,
});

function Thread() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
  };

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      .then(({ data }) => setOther(data as Profile | null));
    load();
    const ch = supabase.channel(`dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    const cull = setInterval(() => setMsgs((m) => m.filter((x) => new Date(x.expires_at) > new Date())), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(cull); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: userId, content });
  };

  return (
    <div className="flex flex-col h-screen md:h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/messages" className="md:hidden p-2 -ml-2"><ArrowLeft /></Link>
        <div className="w-9 h-9 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold">
          {other?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{other?.display_name ?? "…"}</div>
          <div className="text-[11px] text-snap flex items-center gap-1"><Timer className="w-3 h-3" /> Disappears in 24h</div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div key={m.id} layout
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-3xl ${
                  mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"
                }`}>
                  {m.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="sticky bottom-0 md:bottom-0 bg-background border-t border-border p-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Send a disappearing message…"
          className="flex-1 bg-input rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" disabled={!text.trim()}
          className="w-12 h-12 rounded-full bg-snap text-snap-foreground grid place-items-center disabled:opacity-50">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
