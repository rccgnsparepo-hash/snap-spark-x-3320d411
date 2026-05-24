import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StoriesBar, type StoryGroup } from "@/components/StoriesBar";
import { StoryViewer } from "@/components/StoryViewer";
import { Composer } from "@/components/Composer";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { motion } from "framer-motion";
import { Search, Bell, Heart } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

const CHIPS = ["Trending", "Recent", "Popular", "Top", "Campus"] as const;

export default function HomePage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [chip, setChip] = useState<typeof CHIPS[number]>("Trending");
  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data ?? []) as unknown as PostRow[]);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("posts-feed").on("postgres_changes", { event: "*", schema: "public", table: "posts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const featured = posts.filter((p) => p.media_url || p.image_url).slice(0, 6);
  const trending = posts.filter((p) => !featured.includes(p));

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
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input placeholder="Search flicks, people, sounds…" className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      {/* Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              chip === c ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <StoriesBar onView={(groups, index) => setViewer({ groups, index })} />
      <Composer onPosted={load} />

      {/* Featured carousel */}
      {featured.length > 0 && (
        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg">Featured</h2>
            <button className="text-xs text-snap font-semibold">See all</button>
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
                  className="card-glass rounded-3xl overflow-hidden shrink-0 w-[220px] shadow-xl"
                >
                  <div className="relative h-[200px]">
                    {p.media_type === "video"
                      ? <video src={src} muted className="w-full h-full object-cover" />
                      : <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    <span className="absolute top-2 left-2 bg-background/70 backdrop-blur text-[10px] px-2 py-1 rounded-full">
                      {formatDistanceToNowStrict(new Date(p.created_at))}
                    </span>
                    <span className="absolute top-2 right-2 bg-background/70 backdrop-blur text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                      <Heart className="w-3 h-3 text-snap" /> {Math.floor(Math.random() * 9) + 1}.{Math.floor(Math.random() * 9)}k
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
          <h2 className="font-display text-lg">Trending now</h2>
        </div>
        {posts.length === 0 && <div className="text-center py-20 text-muted-foreground">No flicks yet. Be the first.</div>}
        {trending.map((p) => <PostCard key={p.id} post={p} />)}
      </section>

      <StoryViewer
        groups={viewer?.groups ?? null}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
