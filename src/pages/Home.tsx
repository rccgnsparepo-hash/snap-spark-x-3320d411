import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StoriesBar, type StoryGroup } from "@/components/StoriesBar";
import { StoryViewer } from "@/components/StoryViewer";
import { Composer } from "@/components/Composer";
import { PostCard, type PostRow } from "@/components/PostCard";

export default function HomePage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
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
  return (
    <>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl tracking-tight">Flick</h1>
        <p className="text-[11px] text-muted-foreground -mt-0.5">Share moments instantly.</p>
      </header>
      <StoriesBar onView={(groups, index) => setViewer({ groups, index })} />
      <Composer onPosted={load} />
      <div>
        {posts.length === 0 && <div className="text-center py-20 text-muted-foreground">No flicks yet. Be the first.</div>}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
      <StoryViewer
        groups={viewer?.groups ?? null}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
