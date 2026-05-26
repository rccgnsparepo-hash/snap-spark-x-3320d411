import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PostCard, type PostRow } from "@/components/PostCard";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null };

export default function UserProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const [p, setP] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [counts, setCounts] = useState({ posts: 0, likes: 0 });

  useEffect(() => {
    if (!handle) return;
    supabase.from("profiles").select("*").eq("handle", handle).maybeSingle().then(async ({ data }) => {
      const pr = data as Profile | null;
      setP(pr);
      if (!pr) return;
      const { data: ps } = await supabase
        .from("posts")
        .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
        .eq("author_id", pr.id)
        .order("created_at", { ascending: false });
      const rows = (ps ?? []) as unknown as PostRow[];
      setPosts(rows);
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { count } = await supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", ids);
        setCounts({ posts: rows.length, likes: count ?? 0 });
      } else setCounts({ posts: 0, likes: 0 });
    });
  }, [handle]);

  if (!p) return <div className="p-10 text-center text-muted-foreground">Loading profile…</div>;

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="font-display text-lg">@{p.handle}</h1>
      </header>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 flex items-center gap-4">
        <Avatar url={p.avatar_url} name={p.display_name} size={92} ring />
        <div className="flex-1 min-w-0">
          <div className="font-display text-2xl truncate">{p.display_name}</div>
          <div className="text-xs text-muted-foreground">@{p.handle}</div>
          {p.bio && <p className="text-sm mt-2 text-foreground/80 line-clamp-3">{p.bio}</p>}
          <div className="flex gap-4 mt-3 text-sm">
            <span><b>{counts.posts}</b> <span className="text-muted-foreground">flicks</span></span>
            <span><b>{counts.likes}</b> <span className="text-muted-foreground">likes</span></span>
          </div>
        </div>
      </motion.section>
      <div className="px-5">
        <Link to={`/messages/${p.id}`} className="block w-full text-center bg-snap text-snap-foreground font-bold py-2.5 rounded-full">
          <MessageCircle className="w-4 h-4 inline mr-2" /> Message
        </Link>
      </div>
      <div className="mt-6 pb-32">
        {posts.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No flicks yet.</p>}
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </>
  );
}