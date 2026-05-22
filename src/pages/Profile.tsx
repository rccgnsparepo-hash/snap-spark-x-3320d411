import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { LogOut, Camera, Grid3x3, Film, Bookmark, Settings, Edit3, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"grid" | "reels" | "saved">("grid");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [counts, setCounts] = useState({ posts: 0, likes: 0, reshares: 0 });
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
          <button onClick={signOut} aria-label="Sign out" className="text-muted-foreground hover:text-foreground"><LogOut className="w-5 h-5" /></button>
          <button aria-label="Settings" className="text-muted-foreground hover:text-foreground"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <section className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative group rounded-full overflow-hidden ring-2 ring-snap/50 shrink-0"
            aria-label="Change avatar"
          >
            <Avatar url={profile?.avatar_url} name={profile?.display_name} size={88} />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition grid place-items-center text-white opacity-0 group-hover:opacity-100">
              <Camera className="w-5 h-5" />
            </span>
            {busy && <span className="absolute inset-0 bg-black/60 grid place-items-center text-xs text-white">…</span>}
          </button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <div className="flex-1 grid grid-cols-3 text-center gap-2">
            <Stat n={counts.posts} label="flicks" />
            <Stat n={counts.likes} label="likes" />
            <Stat n={counts.reshares} label="reshares" />
          </div>
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="space-y-2">
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Display name" className="w-full bg-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-snap" />
              <textarea value={draftBio} onChange={(e) => setDraftBio(e.target.value)} placeholder="Add a bio…" rows={3} className="w-full bg-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-snap resize-none" />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 bg-snap text-snap-foreground rounded-full py-2 font-semibold text-sm flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Save</button>
                <button onClick={() => setEditing(false)} className="flex-1 border border-border rounded-full py-2 text-sm flex items-center justify-center gap-1"><X className="w-4 h-4" /> Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-base leading-tight">{profile?.display_name}</h2>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-1">{profile?.bio || <span className="text-muted-foreground italic">Tap edit to add a bio.</span>}</p>
              <button onClick={startEdit} className="mt-3 w-full border border-border rounded-full py-1.5 text-sm font-semibold hover:bg-secondary flex items-center justify-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Edit profile</button>
            </>
          )}
        </div>
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

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-bold text-lg leading-none">{n}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return <div className="text-center py-16 text-muted-foreground text-sm">{label}</div>;
}
