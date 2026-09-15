import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bookmark, RotateCcw, Search, Star, Slash, Heart, MessageSquare, Repeat2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { useAppPrefs } from "@/lib/appPrefs";
import { formatDuration, readUsage, todaySeconds, weekAverageSeconds } from "@/lib/usage";
import { toast } from "sonner";

export type SettingsPanel =
  | "saved"
  | "archive"
  | "activity"
  | "time"
  | "insights"
  | "privacy"
  | "closeFriends"
  | "blocked";

const TITLES: Record<SettingsPanel, string> = {
  saved: "Saved",
  archive: "Archive",
  activity: "Your activity",
  time: "Time management",
  insights: "Insights",
  privacy: "Account privacy",
  closeFriends: "Close Friends",
  blocked: "Blocked",
};

type MiniPost = {
  id: string;
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

type MiniProfile = { id: string; handle: string; display_name: string; avatar_url: string | null };

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 px-4 py-3 border-b border-border">{children}</div>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <Icon className="w-5 h-5 mb-2 text-muted-foreground" />
      <div className="font-display text-2xl">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PostStrip({ posts, action }: { posts: MiniPost[]; action?: (p: MiniPost) => React.ReactNode }) {
  if (!posts.length) return <p className="p-6 text-sm text-muted-foreground text-center">Nothing here yet.</p>;
  return (
    <ul>
      {posts.map((p) => {
        const thumb = p.image_url || (p.media_type === "image" ? p.media_url : null);
        return (
          <li key={p.id}>
            <Row>
              <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden shrink-0 grid place-items-center">
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Bookmark className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">{p.content || "(media)"}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              {action?.(p)}
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

export function SettingsDetail({ panel, onClose }: { panel: SettingsPanel | null; onClose: () => void }) {
  const { user } = useAuth();
  const { prefs, update } = useAppPrefs();
  const [posts, setPosts] = useState<MiniPost[]>([]);
  const [people, setPeople] = useState<MiniProfile[]>([]);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState({ posts: 0, likesGiven: 0, comments: 0, saved: 0, likesGot: 0, commentsGot: 0, resharesGot: 0 });
  const [loading, setLoading] = useState(false);

  const usage = useMemo(() => readUsage(), [panel]);

  useEffect(() => {
    if (!panel || !user) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      if (panel === "saved") {
        const { data } = await supabase
          .from("saved_posts")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        const ids = (data ?? []).map((r) => r.post_id);
        const { data: ps } = ids.length
          ? await supabase.from("posts").select("id, content, image_url, media_url, media_type, created_at").in("id", ids)
          : { data: [] as MiniPost[] };
        if (!cancelled) setPosts((ps ?? []) as MiniPost[]);
      }
      if (panel === "archive") {
        const ids = prefs.archivedPosts ?? [];
        const { data: ps } = ids.length
          ? await supabase.from("posts").select("id, content, image_url, media_url, media_type, created_at").in("id", ids)
          : { data: [] as MiniPost[] };
        if (!cancelled) setPosts((ps ?? []) as MiniPost[]);
      }
      if (panel === "activity" || panel === "insights") {
        const mine = await supabase.from("posts").select("id").eq("author_id", user.id);
        const myIds = (mine.data ?? []).map((p) => p.id);
        const [pc, lg, cm, sv, lr, cr, rr] = await Promise.all([
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("saved_posts").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
          myIds.length ? supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
          myIds.length ? supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
          myIds.length ? supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
        ]);
        if (!cancelled)
          setCounts({
            posts: pc.count ?? 0,
            likesGiven: lg.count ?? 0,
            comments: cm.count ?? 0,
            saved: sv.count ?? 0,
            likesGot: lr.count ?? 0,
            commentsGot: cr.count ?? 0,
            resharesGot: rr.count ?? 0,
          });
      }
      if (panel === "closeFriends") {
        const { data } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .neq("id", user.id)
          .limit(50);
        if (!cancelled) setPeople((data ?? []) as MiniProfile[]);
      }
      if (panel === "blocked") {
        const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
        const ids = (data ?? []).map((b) => b.blocked_id);
        const { data: ps } = ids.length
          ? await supabase.from("profiles").select("id, handle, display_name, avatar_url").in("id", ids)
          : { data: [] as MiniProfile[] };
        if (!cancelled) setPeople((ps ?? []) as MiniProfile[]);
      }
      if (!cancelled) setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [panel, user?.id]);

  const filtered = people.filter(
    (p) =>
      !query ||
      p.handle.toLowerCase().includes(query.toLowerCase()) ||
      p.display_name.toLowerCase().includes(query.toLowerCase()),
  );

  const unsave = async (postId: string) => {
    if (!user) return;
    await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    toast.success("Removed from Saved");
  };

  const unarchive = (postId: string) => {
    update({ archivedPosts: (prefs.archivedPosts ?? []).filter((id) => id !== postId) });
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    toast.success("Restored to your profile");
  };

  const unblock = async (id: string) => {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    setPeople((ps) => ps.filter((p) => p.id !== id));
    toast.success("Unblocked");
  };

  const toggleCloseFriend = (id: string) => {
    const set = new Set(prefs.closeFriends);
    set.has(id) ? set.delete(id) : set.add(id);
    update({ closeFriends: [...set] });
  };

  const last7 = Object.keys(usage).sort().slice(-7);
  const peak = Math.max(1, ...last7.map((d) => usage[d] ?? 0));

  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-0 z-[70] bg-background flex flex-col"
        >
          <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={onClose} className="p-1" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg">{TITLES[panel]}</h1>
          </header>

          <div className="flex-1 overflow-y-auto pb-16">
            {loading && <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>}

            {panel === "saved" && !loading && (
              <PostStrip
                posts={posts}
                action={(p) => (
                  <button onClick={() => unsave(p.id)} className="text-xs text-muted-foreground hover:text-foreground">
                    Remove
                  </button>
                )}
              />
            )}

            {panel === "archive" && !loading && (
              <>
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Archived posts stay out of your profile grid until you restore them.
                </p>
                <PostStrip
                  posts={posts}
                  action={(p) => (
                    <button onClick={() => unarchive(p.id)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  )}
                />
              </>
            )}

            {panel === "activity" && !loading && (
              <div className="grid grid-cols-2 gap-3 p-4">
                <Stat label="Posts" value={counts.posts} icon={Repeat2} />
                <Stat label="Likes given" value={counts.likesGiven} icon={Heart} />
                <Stat label="Comments written" value={counts.comments} icon={MessageSquare} />
                <Stat label="Saved" value={counts.saved} icon={Bookmark} />
                <Stat label="Today on Flick" value={formatDuration(todaySeconds())} icon={Clock} />
                <Stat label="Daily average" value={formatDuration(weekAverageSeconds())} icon={Clock} />
              </div>
            )}

            {panel === "insights" && !loading && (
              <div className="grid grid-cols-2 gap-3 p-4">
                <Stat label="Posts published" value={counts.posts} icon={Repeat2} />
                <Stat label="Likes received" value={counts.likesGot} icon={Heart} />
                <Stat label="Comments received" value={counts.commentsGot} icon={MessageSquare} />
                <Stat label="Reshares received" value={counts.resharesGot} icon={Repeat2} />
                <div className="col-span-2 rounded-2xl border border-border bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground mb-1">Average engagement per post</div>
                  <div className="font-display text-3xl">
                    {counts.posts ? ((counts.likesGot + counts.commentsGot + counts.resharesGot) / counts.posts).toFixed(1) : "0.0"}
                  </div>
                </div>
              </div>
            )}

            {panel === "time" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Today" value={formatDuration(todaySeconds())} icon={Clock} />
                  <Stat label="Daily average" value={formatDuration(weekAverageSeconds())} icon={Clock} />
                </div>
                <div className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground mb-3">Last 7 days</div>
                  <div className="flex items-end gap-2 h-28">
                    {last7.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
                    {last7.map((d) => (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-snap"
                          style={{ height: `${Math.max(4, ((usage[d] ?? 0) / peak) * 100)}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground">{new Date(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Daily limit reminder</span>
                    <span className="text-xs text-muted-foreground">
                      {prefs.dailyLimitMin ? `${prefs.dailyLimitMin} min` : "Off"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={15}
                    value={prefs.dailyLimitMin}
                    onChange={(e) => update({ dailyLimitMin: Number(e.target.value) })}
                    className="w-full accent-[hsl(var(--snap))]"
                  />
                </div>
              </div>
            )}

            {panel === "privacy" && (
              <div className="p-4 space-y-3">
                {[
                  { key: "privateAccount" as const, label: "Private account", sub: "Only approved people see your posts" },
                  { key: "allowTags" as const, label: "Allow tags & mentions", sub: "Let others tag you in posts" },
                  { key: "autoShareOnPost" as const, label: "Share sheet after posting", sub: "Open sharing options automatically" },
                ].map((t) => (
                  <label key={t.key} className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.sub}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[t.key])}
                      onChange={(e) => update({ [t.key]: e.target.checked })}
                      className="w-5 h-5 accent-[hsl(var(--snap))]"
                    />
                  </label>
                ))}
                <div className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="text-sm font-semibold mb-2">Who can message you</div>
                  <div className="flex gap-2">
                    {(["everyone", "closeFriends", "nobody"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => update({ dmFrom: o })}
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          prefs.dmFrom === o ? "bg-snap text-snap-foreground border-transparent" : "border-border"
                        }`}
                      >
                        {o === "closeFriends" ? "Close friends" : o[0].toUpperCase() + o.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(panel === "closeFriends" || panel === "blocked") && !loading && (
              <>
                {panel === "closeFriends" && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search people"
                        className="bg-transparent text-sm flex-1 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                {filtered.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    {panel === "blocked" ? "You haven't blocked anyone." : "No people found."}
                  </p>
                )}
                <ul>
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <Row>
                        <Avatar url={p.avatar_url} name={p.display_name} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{p.display_name}</div>
                          <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                        </div>
                        {panel === "blocked" ? (
                          <button onClick={() => unblock(p.id)} className="text-xs px-3 py-1.5 rounded-full border border-border">
                            <Slash className="w-3.5 h-3.5 inline mr-1" /> Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleCloseFriend(p.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border ${
                              prefs.closeFriends.includes(p.id)
                                ? "bg-snap text-snap-foreground border-transparent"
                                : "border-border"
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 inline mr-1" />
                            {prefs.closeFriends.includes(p.id) ? "Added" : "Add"}
                          </button>
                        )}
                      </Row>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
