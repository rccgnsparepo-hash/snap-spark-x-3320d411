import { AnimatePresence, motion } from "framer-motion";
import { Phone, Video, User, MoreHorizontal, ArrowLeft, Pencil, Folder, Clock, BellOff, Search, Ban, Flag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null; bio?: string | null };

export function ChatProfileSheet({ open, onClose, peer, onDeleted }: {
  open: boolean;
  onClose: () => void;
  peer: Profile | null;
  onDeleted?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [disappearSec, setDisappearSec] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !peer) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: m }, { data: b }, { data: cs }] = await Promise.all([
        supabase.from("muted_chats").select("peer_id").eq("owner_id", u.user.id).eq("peer_id", peer.id).maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", u.user.id).eq("blocked_id", peer.id).maybeSingle(),
        supabase.from("chat_settings").select("disappearing_seconds").eq("owner_id", u.user.id).eq("peer_id", peer.id).maybeSingle(),
      ]);
      setMuted(!!m);
      setBlocked(!!b);
      setDisappearSec((cs as { disappearing_seconds: number | null } | null)?.disappearing_seconds ?? null);
    })();
  }, [open, peer]);

  const toggleMute = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    if (muted) { await supabase.from("muted_chats").delete().eq("owner_id", u.user.id).eq("peer_id", peer.id); setMuted(false); toast.success("Unmuted"); }
    else { await supabase.from("muted_chats").insert({ owner_id: u.user.id, peer_id: peer.id }); setMuted(true); toast.success("Muted"); }
  };

  const toggleBlock = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    if (blocked) { await supabase.from("blocks").delete().eq("blocker_id", u.user.id).eq("blocked_id", peer.id); setBlocked(false); toast.success("Unblocked"); }
    else { await supabase.from("blocks").insert({ blocker_id: u.user.id, blocked_id: peer.id }); setBlocked(true); toast.success("Blocked"); }
  };

  const report = async (kind: "conversation" | "user") => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const reason = window.prompt(`Report ${kind}. What's wrong?`) ?? "";
    if (!reason.trim()) return;
    await supabase.from("reports").insert({ reporter_id: u.user.id, target_user_id: peer.id, target_kind: kind, reason });
    toast.success("Report submitted");
  };

  const setDisappear = async (seconds: number | null) => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    await supabase.from("chat_settings").upsert(
      { owner_id: u.user.id, peer_id: peer.id, disappearing_seconds: seconds, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,peer_id" },
    );
    setDisappearSec(seconds);
    toast.success(seconds ? `Disappearing in ${seconds >= 3600 ? `${seconds/3600}h` : `${seconds/60}m`}` : "Disappearing off");
  };

  const deleteConvo = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!window.confirm("Delete this entire conversation? This cannot be undone.")) return;
    await supabase.from("messages").delete()
      .or(`and(sender_id.eq.${u.user.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${u.user.id})`);
    toast.success("Conversation deleted");
    onDeleted?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && peer && (
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-[60] bg-background flex flex-col"
        >
          <header className="flex items-center justify-between px-4 py-4">
            <button onClick={onClose} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
            <Link to={`/u/${peer.handle}`} className="p-2"><Pencil className="w-5 h-5" /></Link>
          </header>

          <div className="flex flex-col items-center px-6 pb-4">
            <Avatar url={peer.avatar_url} name={peer.display_name} size={120} />
            <h2 className="mt-4 text-xl font-bold flex items-center gap-1.5">
              {peer.display_name}
              <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-snap text-snap-foreground text-[10px] font-black">✓</span>
            </h2>
            <p className="text-muted-foreground text-sm">@{peer.handle}</p>
          </div>

          <div className="grid grid-cols-4 gap-2 px-6 pb-6 relative">
            <ActionBtn icon={Phone} label="Call" onClick={() => toast("Calls coming soon")} />
            <ActionBtn icon={Video} label="Video" onClick={() => toast("Video coming soon")} />
            <Link to={`/u/${peer.handle}`} className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-secondary grid place-items-center"><User className="w-5 h-5" /></div>
              <span className="text-xs">Profile</span>
            </Link>
            <button onClick={() => setMenu((v) => !v)} className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-secondary grid place-items-center"><MoreHorizontal className="w-5 h-5" /></div>
              <span className="text-xs">More</span>
            </button>

            {/* 3-dot menu (image 3) */}
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-4 top-[78px] w-60 card-glass rounded-2xl py-2 shadow-2xl border border-border z-10"
                >
                  {[
                    { icon: BellOff, label: muted ? "Unmute conversation" : "Mute conversation", action: toggleMute },
                    { icon: Search, label: "Search", action: () => toast("Search coming soon") },
                    { icon: Ban, label: blocked ? "Unblock messages" : "Block messages", action: toggleBlock },
                  ].map((m) => (
                    <button key={m.label} onClick={() => { m.action(); setMenu(false); }} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50">
                      <span>{m.label}</span><m.icon className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  {[
                    { icon: Flag, label: "Report conversation", danger: true, action: () => report("conversation") },
                    { icon: Flag, label: "Report user", danger: true, action: () => report("user") },
                    { icon: Trash2, label: "Delete conversation", danger: true, action: deleteConvo },
                  ].map((m) => (
                    <button key={m.label} onClick={() => { m.action(); setMenu(false); }} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 text-rose-400">
                      <span>{m.label}</span><m.icon className="w-4 h-4" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mx-4 card-glass rounded-2xl divide-y divide-border/60">
            <Row icon={Folder} label="Media, Links, Docs" right="›" onClick={() => toast("Coming soon")} />
            <DisappearingRow value={disappearSec} onChange={setDisappear} />
            <Row icon={BellOff} label={muted ? "Muted" : "Notifications on"} right={muted ? "On" : "Off"} onClick={toggleMute} />
            <Row icon={Ban} label={blocked ? "Blocked" : "Block user"} right={blocked ? "On" : "Off"} onClick={toggleBlock} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DisappearingRow({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const label = value == null ? "Off" : value >= 86400 ? `${value/86400}d` : value >= 3600 ? `${value/3600}h` : `${value/60}m`;
  const opts: { l: string; v: number | null }[] = [
    { l: "Off", v: null }, { l: "5 minutes", v: 300 }, { l: "1 hour", v: 3600 }, { l: "24 hours", v: 86400 }, { l: "7 days", v: 604800 },
  ];
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <Clock className="w-5 h-5 text-snap" />
        <span className="flex-1">Disappearing messages</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {opts.map((o) => (
            <button key={o.l} onClick={() => { onChange(o.v); setOpen(false); }}
              className={`px-3 py-1.5 rounded-full text-xs ${ (value ?? null) === o.v ? "bg-snap text-snap-foreground" : "bg-secondary"}`}>{o.l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className="w-14 h-14 rounded-full bg-secondary grid place-items-center"><Icon className="w-5 h-5" /></div>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function Row({ icon: Icon, label, right, onClick, dim }: { icon: typeof Phone; label: string; right?: string; onClick?: () => void; dim?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${dim ? "opacity-50" : ""}`}>
      <Icon className="w-5 h-5 text-snap" />
      <span className="flex-1">{label}</span>
      {right && <span className="text-xs text-muted-foreground">{right}</span>}
    </button>
  );
}