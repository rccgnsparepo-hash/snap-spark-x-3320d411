import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { LogOut, Camera, Grid3x3, Film, Bookmark, Settings, Edit3, Check, X, Share2, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ProfileSettings } from "@/components/ProfileSettings";

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"grid" | "reels" | "saved">("grid");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [counts, setCounts] = useState({ posts: 0, likes: 0, reshares: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("posts").select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)").eq("author_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      const rows = (data ?? []) as unknown as PostRow[];
      setPosts(rows);
      setCounts((c) => ({ ...c, posts: rows.length }));
    });
    const ids: string[] = [];
    supabase.from("posts").select("id").eq("author_id", user.id).then(async ({ data }) => {
      (data ?? []).forEach((r: { id: string }) => ids.push(r.id));
      if (ids.length === 0) return;
      const [{ count: lc }, { count: rc }] = await Promise.all([
        supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", ids),
        supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", ids),
      ]);
      setCounts((c) => ({ ...c, likes: lc ?? 0, reshares: rc ?? 0 }));
    });
  }, [user]);

  const upload = async (f: File) => {
    if (!user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Avatar must be under 5MB"); return; }
    setBusy(true);
    try {
      const ext = f.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: e1 } = await supabase.storage.from("media").upload(path, f, { contentType: f.type, upsert: true });
      if (e1) throw e1;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (e2) throw e2;
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const startEdit = () => {
    setDraftName(profile?.display_name ?? "");
    setDraftBio(profile?.bio ?? "");
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: draftName.trim() || profile?.display_name,
      bio: draftBio.trim() || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    setEditing(false);
    toast.success("Profile updated");
  };

  const gridPosts = posts.filter((p) => (p.media_url ?? p.image_url));
  const reelPosts = posts.filter((p) => p.media_type === "video");

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-display text-xl tracking-tight">@{profile?.handle}</h1>
        <div className="flex items-center gap-3">
          <button aria-label="Share" className="text-muted-foreground hover:text-foreground"><Share2 className="w-5 h-5" /></button>
          <button onClick={signOut} aria-label="Sign out" className="text-muted-foreground hover:text-foreground"><LogOut className="w-5 h-5" /></button>
          <button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="text-muted-foreground hover:text-foreground"><Settings className="w-5 h-5" /></button>
        </div>
      </header>
      <ProfileSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Split-screen hero: left noir identity, right warm stats */}
      <section className="grid grid-cols-5 min-h-[380px] overflow-hidden">
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="surface-noir col-span-3 relative p-5 flex flex-col justify-between"
        >
          <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-snap/15 blur-3xl" />
          <div className="relative">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Profile</span>
            <h2 className="font-display text-3xl mt-2 leading-tight">{profile?.display_name}</h2>
            <p className="text-snap text-sm font-semibold mt-1">@{profile?.handle}</p>
          </div>

          <div className="relative grid place-items-center my-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative group rounded-full overflow-hidden ring-4 ring-snap/40 shrink-0"
              aria-label="Change avatar"
            >
              <Avatar url={profile?.avatar_url} name={profile?.display_name} size={160} />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition grid place-items-center text-white opacity-0 group-hover:opacity-100">
                <Camera className="w-6 h-6" />
              </span>
              {busy && <span className="absolute inset-0 bg-black/60 grid place-items-center text-xs text-white">…</span>}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>

          <div className="relative">
            <p className="text-xs text-foreground/80 whitespace-pre-wrap line-clamp-3">
              {profile?.bio || <span className="text-muted-foreground italic">Tap edit to add a bio.</span>}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="surface-warm col-span-2 relative p-5 flex flex-col justify-between"
        >
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-70">Stats</span>
            <div className="mt-3 space-y-4">
              <BigStat n={counts.posts} label="flicks" />
              <BigStat n={counts.likes} label="likes" />
              <BigStat n={counts.reshares} label="reshares" />
            </div>
          </div>
          {!editing ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={startEdit}
              className="w-full bg-foreground text-background rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 mt-4"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit profile
            </motion.button>
          ) : (
            <div className="space-y-2 mt-4">
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Display name" className="w-full bg-background/40 border border-foreground/20 rounded-full px-3 py-2 text-xs focus:outline-none focus:border-foreground" />
              <textarea value={draftBio} onChange={(e) => setDraftBio(e.target.value)} placeholder="Add a bio…" rows={2} className="w-full bg-background/40 border border-foreground/20 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-foreground resize-none" />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 bg-snap text-snap-foreground rounded-full py-2 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Save</button>
                <button onClick={() => setEditing(false)} className="flex-1 border border-foreground/40 rounded-full py-2 text-xs flex items-center justify-center gap-1"><X className="w-3 h-3" /> Cancel</button>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      <nav className="sticky top-[57px] z-20 bg-background/90 backdrop-blur border-y border-border grid grid-cols-3">
        {([["grid", Grid3x3], ["reels", Film], ["saved", Bookmark]] as const).map(([k, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`py-3 grid place-items-center border-b-2 transition ${tab === k ? "border-snap text-snap" : "border-transparent text-muted-foreground"}`}>
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {tab === "grid" && (
        gridPosts.length === 0
          ? <Empty label="No flicks yet. Share your first moment." />
          : <div className="grid grid-cols-3 gap-0.5">
              {gridPosts.map((p) => {
                const src = p.media_url ?? p.image_url!;
                return (
                  <div key={p.id} className="aspect-square bg-secondary overflow-hidden">
                    {p.media_type === "video"
                      ? <video src={src} className="w-full h-full object-cover" muted />
                      : <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                );
              })}
            </div>
      )}
      {tab === "reels" && (
        reelPosts.length === 0
          ? <Empty label="No reels yet." />
          : reelPosts.map((p) => <PostCard key={p.id} post={p} />)
      )}
      {tab === "saved" && <Empty label="Saved flicks coming soon." />}
    </>
  );
}

function BigStat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl leading-none">{n}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70 mt-1">{label}</div>
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return <div className="text-center py-16 text-muted-foreground text-sm">{label}</div>;
}
