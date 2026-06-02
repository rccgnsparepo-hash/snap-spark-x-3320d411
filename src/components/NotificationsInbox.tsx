import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Heart, MessageCircle, AtSign, Camera, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";

type Notif = {
  id: string; user_id: string; actor_id: string | null; kind: string;
  title: string; body: string | null; url: string | null;
  data: Record<string, unknown>; read_at: string | null; created_at: string;
};

const FILTERS = ["All", "Stories", "Mentions", "Posts", "Messages"] as const;
type Filter = typeof FILTERS[number];

const iconFor = (k: string) => {
  if (k === "like") return Heart;
  if (k === "comment") return MessageCircle;
  if (k === "mention") return AtSign;
  if (k === "story") return Camera;
  if (k === "post") return FileText;
  if (k === "message") return MessageCircle;
  return Bell;
};

export function NotificationsInbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<Filter>("All");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!open || !user) return;
    load();
    const ch = supabase.channel(`inbox-${user.id}`).on("postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const filtered = useMemo(() => items.filter((n) => {
    if (filter === "All") return true;
    if (filter === "Stories") return n.kind === "story";
    if (filter === "Mentions") return n.kind === "mention";
    if (filter === "Posts") return n.kind === "post" || n.kind === "like" || n.kind === "comment";
    if (filter === "Messages") return n.kind === "message";
    return true;
  }), [items, filter]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur flex justify-end">
          <motion.aside initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-[100dvh] bg-card border-l border-border flex flex-col">
            <header className="p-4 border-b border-border flex items-center gap-2">
              <Bell className="w-5 h-5 text-snap" />
              <h2 className="font-display text-lg flex-1">Notifications</h2>
              <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">Mark read</button>
              <button onClick={clearAll} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Clear all"><Trash2 className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 border-b border-border">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${filter === f ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"}`}>{f}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-16 px-6">
                  Nothing here yet. Likes, comments, mentions and DMs will land here in real time.
                </div>
              )}
              <ul>
                {filtered.map((n) => {
                  const Icon = iconFor(n.kind);
                  const unread = !n.read_at;
                  const inner = (
                    <div className={`flex gap-3 px-4 py-3 border-b border-border hover:bg-secondary/40 transition ${unread ? "bg-snap/5" : ""}`}>
                      <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${unread ? "bg-snap/20 text-snap" : "bg-secondary text-muted-foreground"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{n.title}</div>
                        {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">{formatDistanceToNowStrict(new Date(n.created_at))} ago</div>
                      </div>
                      {unread && <span className="w-2 h-2 rounded-full bg-snap mt-2" />}
                    </div>
                  );
                  return (
                    <li key={n.id} onClick={() => supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id)}>
                      {n.url ? <Link to={n.url} onClick={onClose}>{inner}</Link> : inner}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}