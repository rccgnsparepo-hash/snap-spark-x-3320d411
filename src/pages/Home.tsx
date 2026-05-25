import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StoriesBar, type StoryGroup } from "@/components/StoriesBar";
import { StoryViewer } from "@/components/StoryViewer";
import { Composer } from "@/components/Composer";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { motion } from "framer-motion";
import { Search, Bell, Heart } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

const CHIPS = ["Trending", "Recent"] as const;

export default function HomePage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [chip, setChip] = useState<typeof CHIPS[number]>("Trending");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<{ id: string; handle: string; display_name: string; avatar_url: string | null }[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data ?? []) as unknown as PostRow[]);
    const { data: likes } = await supabase.from("likes").select("post_id");
    const counts: Record<string, number> = {};
    (likes ?? []).forEach((l: { post_id: string }) => { counts[l.post_id] = (counts[l.post_id] ?? 0) + 1; });
    setLikeCounts(counts);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // user search
  useEffect(() => {
    if (!query.trim()) { setPeople([]); return; }
    const t = setTimeout(async () => {
      const q = query.trim().replace(/^@/, "");
      const { data } = await supabase.from("profiles")
        .select("id, handle, display_name, avatar_url")
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setPeople((data ?? []) as typeof people);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const searching = query.trim().length > 0;

  const filteredPosts = useMemo(() => {
    if (!searching) return posts;
    const q = query.trim().replace(/^@/, "").toLowerCase();
    return posts.filter((p) =>
      p.author?.handle?.toLowerCase().includes(q) ||
      p.author?.display_name?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q),
    );
  }, [posts, query, searching]);

  const ordered = useMemo(() => {
    if (chip === "Recent") return [...filteredPosts].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return [...filteredPosts].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0) || +new Date(b.created_at) - +new Date(a.created_at));
  }, [filteredPosts, chip, likeCounts]);

  const featured = ordered.filter((p) => p.media_url || p.image_url).slice(0, 6);
  const trending = ordered.filter((p) => !featured.includes(p));

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Explore <span className="tape-lime">flicks</span></h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Share moments instantly.</p>
        </div>
        <button aria-label="Notifications" className="relative w-10 h-10 rounded-full bg-secondary grid place-items-center">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-snap" />
        </button>
      </header>

      {/* Search */}
      <div className="px-5 pt-4 relative">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or flicks…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
        {searching && people.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="absolute left-5 right-5 mt-2 card-glass rounded-2xl overflow-hidden z-20 shadow-xl">
            {people.map((p) => (
              <button key={p.id} onClick={() => setQuery("@" + p.handle)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 text-left">
                <Avatar url={p.avatar_url} name={p.display_name} size={32} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4">
        {CHIPS.map((c) => (
          <motion.button
            key={c}
            whileTap={{ scale: 0.94 }}
            onClick={() => setChip(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              chip === c ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </motion.button>
        ))}
      </div>

      {!searching && <StoriesBar onView={(groups, index) => setViewer({ groups, index })} />}
      {!searching && <Composer onPosted={load} />}

      {/* Featured carousel */}
      {!searching && featured.length > 0 && chip === "Trending" && (
        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg">Featured</h2>
            <span className="text-xs text-snap font-semibold">Top liked</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
            {featured.map((p, i) => {
              const src = p.media_url ?? p.image_url!;
              return (
                <motion.article
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, rotateX: 2, rotateY: -2 }}
                  style={{ transformPerspective: 800 }}
                  className="card-glass rounded-3xl overflow-hidden shrink-0 w-[220px] shadow-xl"
                >
                  <div className="relative h-[200px]">
                    {p.media_type === "video"
                      ? <video src={src} muted loop autoPlay playsInline className="w-full h-full object-cover" />
                      : <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    <span className="absolute top-2 left-2 bg-background/70 backdrop-blur text-[10px] px-2 py-1 rounded-full">
                      {formatDistanceToNowStrict(new Date(p.created_at))}
                    </span>
                    <span className="absolute top-2 right-2 bg-background/70 backdrop-blur text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                      <Heart className="w-3 h-3 text-snap" /> {likeCounts[p.id] ?? 0}
                    </span>
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <Avatar url={p.author?.avatar_url} name={p.author?.display_name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">@{p.author?.handle}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.content || "untitled"}</div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}

      {/* Trending now feed */}
      <section className="px-2 pt-4">
        <div className="flex items-baseline justify-between px-3 mb-2">
          <h2 className="font-display text-lg">{searching ? `Results for "${query}"` : chip === "Recent" ? "Just posted" : "Trending now"}</h2>
        </div>
        {ordered.length === 0 && <div className="text-center py-20 text-muted-foreground">{searching ? "Nothing here yet." : "No flicks yet. Be the first."}</div>}
        {(searching ? ordered : trending).map((p) => <PostCard key={p.id} post={p} />)}
      </section>

      <StoryViewer
        groups={viewer?.groups ?? null}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
