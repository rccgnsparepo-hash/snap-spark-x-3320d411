import { AnimatePresence, motion } from "framer-motion";
import { Phone, Video, User, MoreHorizontal, ArrowLeft, Pencil, Folder, Clock, Camera, BellOff, Search, Ban, Flag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
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

  const deleteConvo = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
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
                    { icon: BellOff, label: "Mute conversation", action: () => toast("Muted") },
                    { icon: Search, label: "Search", action: () => toast("Search coming soon") },
                    { icon: Ban, label: "Block messages", action: () => toast("Blocked") },
                  ].map((m) => (
                    <button key={m.label} onClick={() => { m.action(); setMenu(false); }} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50">
                      <span>{m.label}</span><m.icon className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  {[
                    { icon: Flag, label: "Report conversation", danger: true, action: () => toast("Reported") },
                    { icon: Flag, label: "Report user", danger: true, action: () => toast("Reported") },
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
            <Row icon={Clock} label="Disappearing messages" right="On · 24h" />
            <Row icon={Camera} label="Block screenshots" right="Off" dim />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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