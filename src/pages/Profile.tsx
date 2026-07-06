import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import {
  LogOut, Camera, Grid3x3, Film, Bookmark, Settings, Edit3, Check, X, Share2,
  Sparkles, Flame, Heart, Repeat2, MessageSquare, ImageIcon, Zap, Trophy, Star,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileSettings } from "@/components/ProfileSettings";
import { GradientMesh } from "@/components/effects/GradientMesh";
import { LiquidBlob } from "@/components/effects/LiquidBlob";
import { MagneticButton } from "@/components/effects/MagneticButton";
import { TiltCard } from "@/components/effects/TiltCard";
import { TextReveal } from "@/components/effects/TextReveal";
import gsap from "gsap";

type Counts = {
  posts: number; likes: number; reshares: number; comments: number;
  saved: number; stories: number; reactions: number; images: number; videos: number;
};
const zeroCounts: Counts = { posts: 0, likes: 0, reshares: 0, comments: 0, saved: 0, stories: 0, reactions: 0, images: 0, videos: 0 };

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"grid" | "reels" | "saved">("grid");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [counts, setCounts] = useState<Counts>(zeroCounts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedPosts, setSavedPosts] = useState<PostRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Fetch real stats from DB (no mock data).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data: mine } = await supabase
        .from("posts")
        .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
        .eq("author_id", user.id).order("created_at", { ascending: false });
      if (!alive) return;
      const rows = (mine ?? []) as unknown as PostRow[];
      setPosts(rows);
      const ids = rows.map((r) => r.id);
      const images = rows.filter((r) => (r.media_url || r.image_url) && r.media_type !== "video").length;
      const videos = rows.filter((r) => r.media_type === "video").length;

      const [lc, rc, cc, sc, stc, rxc] = ids.length
        ? await Promise.all([
            supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", ids),
            supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", ids),
            supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", ids),
            supabase.from("saved_posts").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
            supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", user.id),
            supabase.from("reactions").select("post_id", { count: "exact", head: true }).in("post_id", ids),
          ])
        : await Promise.all([
            Promise.resolve({ count: 0 }),
            Promise.resolve({ count: 0 }),
            Promise.resolve({ count: 0 }),
            supabase.from("saved_posts").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
            supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", user.id),
            Promise.resolve({ count: 0 }),
          ]);
      if (!alive) return;
      setCounts({
        posts: rows.length,
        likes: lc.count ?? 0, reshares: rc.count ?? 0, comments: cc.count ?? 0,
        saved: sc.count ?? 0, stories: stc.count ?? 0, reactions: rxc.count ?? 0,
        images, videos,
      });
    })();
    return () => { alive = false; };
  }, [user]);

  // Saved posts (real data, loaded when Saved tab is opened).
  useEffect(() => {
    if (tab !== "saved" || !user) return;
    let alive = true;
    (async () => {
      const { data: saved } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false });
      const ids = (saved ?? []).map((r: { post_id: string }) => r.post_id);
      if (ids.length === 0) { if (alive) setSavedPosts([]); return; }
      const { data } = await supabase
        .from("posts")
        .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
        .in("id", ids);
      if (alive) setSavedPosts(((data ?? []) as unknown) as PostRow[]);
    })();
    return () => { alive = false; };
  }, [tab, user]);

  // Hero timeline
  useEffect(() => {
    if (!heroRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-orbit", { scale: 0.7, opacity: 0, duration: 1.4, ease: "expo.out" });
      gsap.from(".hero-meta", { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, delay: 0.15, ease: "power3.out" });
      gsap.from(".hero-stat", { y: 30, opacity: 0, duration: 0.8, stagger: 0.07, delay: 0.35, ease: "power3.out" });
      gsap.from(".hero-achv", { y: 24, opacity: 0, duration: 0.7, stagger: 0.06, delay: 0.55, ease: "power3.out" });
    }, heroRef);
    return () => ctx.revert();
  }, [profile?.id]);

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

  const startEdit = () => { setDraftName(profile?.display_name ?? ""); setDraftBio(profile?.bio ?? ""); setEditing(true); };
  const saveEdit = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: draftName.trim() || profile?.display_name, bio: draftBio.trim() || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    setEditing(false);
    toast.success("Profile updated");
  };

  const gridPosts = posts.filter((p) => (p.media_url ?? p.image_url));
  const reelPosts = posts.filter((p) => p.media_type === "video");
  const totalEngagement = counts.likes + counts.reshares + counts.comments + counts.reactions;
  const avgEng = counts.posts ? (totalEngagement / counts.posts) : 0;
  const reputation = Math.min(100, Math.round((counts.posts * 2) + (totalEngagement * 1.2) + counts.stories * 3));
  const memberSince = profile ? new Date(profile.id ? Date.parse((profile as unknown as { created_at?: string }).created_at ?? "") || Date.now() : Date.now()) : new Date();

  const achievements = [
    { icon: Sparkles, label: "First Flick", earned: counts.posts >= 1 },
    { icon: Flame, label: "On Fire", earned: counts.posts >= 10 },
    { icon: Heart, label: "Loved x25", earned: counts.likes >= 25 },
    { icon: Repeat2, label: "Amplified", earned: counts.reshares >= 5 },
    { icon: MessageSquare, label: "Conversationalist", earned: counts.comments >= 10 },
    { icon: ImageIcon, label: "Visual Poet", earned: counts.images >= 5 },
    { icon: Zap, label: "Storyteller", earned: counts.stories >= 3 },
    { icon: Trophy, label: "Verified Presence", earned: reputation >= 60 },
  ];

  return (
    <div className="text-foreground">
      <ProfileSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ===== HERO — WebGL + Liquid blobs + GSAP reveal ===== */}
      <section ref={heroRef} className="relative overflow-hidden">
        <GradientMesh />
        <LiquidBlob className="w-[70vw] h-[70vw] max-w-[700px] max-h-[700px] -top-40 -right-32" color="#C5E863" opacity={0.35} />
        <LiquidBlob className="w-[55vw] h-[55vw] max-w-[520px] max-h-[520px] -bottom-40 -left-32" color="#3fbf6f" opacity={0.22} />

        {/* Top action bar */}
        <div className="relative z-20 flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <div className="text-[10px] uppercase tracking-[0.35em] text-foreground/70 font-semibold px-3 py-1.5 rounded-full border border-foreground/15 backdrop-blur-md bg-background/30">
            Digital Identity
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <MagneticButton ariaLabel="Share" className="w-11 h-11 rounded-full grid place-items-center backdrop-blur-md bg-background/30 border border-foreground/15">
              <Share2 className="w-5 h-5" />
            </MagneticButton>
            <MagneticButton ariaLabel="Settings" onClick={() => setSettingsOpen(true)} className="w-11 h-11 rounded-full grid place-items-center backdrop-blur-md bg-background/30 border border-foreground/15">
              <Settings className="w-5 h-5" />
            </MagneticButton>
          </div>
        </div>

        {/* Identity block */}
        <div className="relative z-10 px-5 pt-6 pb-8 sm:pt-10 sm:pb-14 sm:px-8 max-w-3xl mx-auto">
          <div className="hero-meta text-[10px] uppercase tracking-[0.4em] text-snap font-bold">@{profile?.handle ?? "you"}</div>
          <TextReveal
            text={profile?.display_name ?? "Your identity"}
            as="h1"
            className="font-display text-[13vw] sm:text-6xl lg:text-7xl leading-[0.95] mt-2 tracking-tight break-anywhere"
          />

          <div className="mt-6 grid grid-cols-[auto,1fr] gap-5 items-center">
            {/* Reflective / liquid avatar orb */}
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Change avatar"
              className="hero-orbit relative group w-28 h-28 sm:w-36 sm:h-36 rounded-full grid place-items-center shrink-0"
              style={{
                background:
                  "conic-gradient(from 220deg, #C5E863, #3fbf6f, #0A0A0B, #C5E863)",
                padding: 3,
                filter: "drop-shadow(0 0 30px rgba(197,232,99,0.35))",
              }}
            >
              <span className="absolute inset-[3px] rounded-full overflow-hidden bg-background">
                <Avatar url={profile?.avatar_url} name={profile?.display_name} size={160} />
              </span>
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition grid place-items-center opacity-0 group-hover:opacity-100 text-foreground">
                <Camera className="w-6 h-6" />
              </span>
              {busy && <span className="absolute inset-0 rounded-full bg-black/60 grid place-items-center text-xs">…</span>}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

            <div className="hero-meta min-w-0">
              <p className="text-sm text-foreground/85 leading-relaxed line-clamp-4 whitespace-pre-wrap break-anywhere">
                {profile?.bio || <span className="text-muted-foreground italic">Tap edit to add a bio.</span>}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!editing ? (
                  <>
                    <MagneticButton
                      onClick={startEdit}
                      className="bg-snap text-snap-foreground rounded-full px-5 py-2.5 text-sm font-bold gap-1.5 items-center shadow-[0_10px_30px_-8px_rgba(197,232,99,0.6)]"
                      strength={0.5}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit profile
                    </MagneticButton>
                    <MagneticButton
                      as="div"
                      className="rounded-full px-4 py-2.5 text-xs font-semibold border border-foreground/20 backdrop-blur-md bg-background/30 items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 text-snap mr-1" /> Rep {reputation}
                    </MagneticButton>
                  </>
                ) : (
                  <div className="w-full space-y-2">
                    <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Display name"
                      className="w-full bg-background/60 border border-foreground/20 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-snap transition" />
                    <textarea value={draftBio} onChange={(e) => setDraftBio(e.target.value)} placeholder="Add a bio…" rows={2}
                      className="w-full bg-background/60 border border-foreground/20 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-snap resize-none transition" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex-1 bg-snap text-snap-foreground rounded-full py-2.5 text-sm font-bold inline-flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Save</button>
                      <button onClick={() => setEditing(false)} className="flex-1 border border-foreground/40 rounded-full py-2.5 text-sm inline-flex items-center justify-center gap-1"><X className="w-4 h-4" /> Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reputation meter (liquid fill) */}
          <div className="hero-meta mt-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Reputation</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-snap font-bold">{reputation}/100</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-foreground/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000"
                style={{
                  width: `${reputation}%`,
                  background: "linear-gradient(90deg, #C5E863, #3fbf6f, #C5E863)",
                  backgroundSize: "200% 100%",
                  animation: "flow 6s linear infinite",
                  boxShadow: "0 0 20px rgba(197,232,99,0.6)",
                }}
              />
            </div>
            <style>{`@keyframes flow { 0%{background-position:0% 0} 100%{background-position:200% 0} }`}</style>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="relative px-4 sm:px-6 -mt-2 z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Sparkles, n: counts.posts, l: "Flicks" },
            { icon: Heart, n: counts.likes, l: "Likes" },
            { icon: Repeat2, n: counts.reshares, l: "Reshares" },
            { icon: MessageSquare, n: counts.comments, l: "Replies" },
            { icon: Zap, n: counts.stories, l: "Stories" },
            { icon: Bookmark, n: counts.saved, l: "Saved" },
            { icon: Flame, n: Math.round(avgEng * 10) / 10, l: "Avg engage" },
            { icon: Star, n: reputation, l: "Reputation" },
          ].map((s, i) => (
            <TiltCard key={i} className="hero-stat rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 overflow-hidden">
              <div className="flex items-center justify-between">
                <s.icon className="w-4 h-4 text-snap" />
                <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{s.l}</span>
              </div>
              <div className="font-display text-3xl mt-3 tabular-nums leading-none">{s.n}</div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ===== ACHIEVEMENTS ===== */}
      <section className="px-4 sm:px-6 mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-xl tracking-tight">Achievements</h3>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {achievements.filter((a) => a.earned).length}/{achievements.length}
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4">
          {achievements.map((a, i) => (
            <TiltCard
              key={i}
              max={16}
              className={`hero-achv shrink-0 w-32 sm:w-auto aspect-[4/5] rounded-2xl border p-3 flex flex-col justify-between overflow-hidden ${
                a.earned
                  ? "border-snap/50 bg-gradient-to-br from-snap/15 to-snap/0"
                  : "border-border/50 bg-card/40 opacity-60"
              }`}
            >
              <a.icon className={`w-6 h-6 ${a.earned ? "text-snap" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-bold leading-tight">{a.label}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] mt-1 text-muted-foreground">
                  {a.earned ? "Unlocked" : "Locked"}
                </div>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ===== TABS ===== */}
      <nav className="sticky top-0 z-20 bg-background/85 backdrop-blur border-y border-border grid grid-cols-3 mt-8">
        {([["grid", Grid3x3, "Grid"], ["reels", Film, "Reels"], ["saved", Bookmark, "Saved"]] as const).map(([k, Icon, label]) => (
          <button
            key={k}
            aria-label={label}
            onClick={() => setTab(k)}
            className={`min-h-[48px] inline-flex items-center justify-center gap-2 border-b-2 transition ${
              tab === k ? "border-snap text-snap" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] uppercase tracking-[0.25em] font-semibold">{label}</span>
          </button>
        ))}
      </nav>

      {/* ===== CONTENT ===== */}
      <div className="px-0 pb-24">
        {tab === "grid" && (
          gridPosts.length === 0
            ? <Empty label="No flicks yet. Share your first moment." />
            : <div className="grid grid-cols-3 gap-0.5">
                {gridPosts.map((p) => {
                  const src = p.media_url ?? p.image_url!;
                  return (
                    <div key={p.id} className="aspect-square bg-secondary overflow-hidden group relative">
                      {p.media_type === "video"
                        ? <video src={src} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" muted />
                        : <img src={src} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />}
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
        {tab === "saved" && (
          savedPosts.length === 0
            ? <Empty label="Nothing saved yet." />
            : savedPosts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {/* signal to hide legacy top signout icon on this page */}
      <button onClick={() => {}} className="hidden" aria-hidden><LogOut /></button>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-16 text-muted-foreground text-sm">{label}</div>;
}
