import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Share2, QrCode, EyeOff, Flag, Star, X, Download, Copy, BookmarkCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function PostActions({ postId, mediaUrl, open, onClose, onShare }: { postId: string; mediaUrl?: string | null; open: boolean; onClose: () => void; onShare: () => void }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("saved_posts").select("post_id").eq("user_id", user.id).eq("post_id", postId).maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, postId, open]);

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
      setSaved(false); toast.success("Removed from saved");
    } else {
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
      setSaved(true); toast.success("Saved");
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/?post=${postId}`);
    toast.success("Link copied");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center">
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-sm card-glass rounded-t-3xl md:rounded-3xl p-4 pb-8">
            <div className="flex justify-end mb-2"><button onClick={onClose}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Quick onClick={toggleSave} icon={saved ? BookmarkCheck : Bookmark} label={saved ? "Saved" : "Save"} />
              <Quick onClick={() => { onShare(); onClose(); }} icon={Share2} label="Share" />
              <Quick onClick={copyLink} icon={Copy} label="Copy link" />
            </div>
            <ul className="divide-y divide-border">
              {mediaUrl && (
                <li><a href={mediaUrl} download target="_blank" rel="noreferrer" onClick={onClose} className="flex items-center gap-3 py-3"><Download className="w-5 h-5" /> Download media</a></li>
              )}
              <li><button className="flex items-center gap-3 py-3 w-full" onClick={() => { toast("Added to favourites"); onClose(); }}><Star className="w-5 h-5" /> Add to favourites</button></li>
              <li><button className="flex items-center gap-3 py-3 w-full" onClick={() => { toast("Hidden"); onClose(); }}><EyeOff className="w-5 h-5" /> Hide</button></li>
              <li><button className="flex items-center gap-3 py-3 w-full" onClick={() => { toast.message("QR coming soon"); onClose(); }}><QrCode className="w-5 h-5" /> QR code</button></li>
              <li><button className="flex items-center gap-3 py-3 w-full text-destructive" onClick={() => { toast("Reported"); onClose(); }}><Flag className="w-5 h-5" /> Report</button></li>
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Quick({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 bg-secondary/60 rounded-2xl py-3 hover:bg-secondary">
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}