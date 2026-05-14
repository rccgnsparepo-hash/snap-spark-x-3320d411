import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export type PostRow = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

export function PostCard({ post }: { post: PostRow }) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    supabase.from("likes").select("user_id", { count: "exact" }).eq("post_id", post.id)
      .then(({ data, count }) => {
        setLikeCount(count ?? 0);
        setLiked(!!data?.some((d) => d.user_id === user?.id));
      });
  }, [post.id, user?.id]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false); setLikeCount((c) => c - 1);
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setLiked(true); setLikeCount((c) => c + 1);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
    }
  };

  return (
    <article className="px-4 py-3 border-b border-border hover:bg-secondary/20 transition flex gap-3">
      <div className="w-11 h-11 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold shrink-0">
        {post.author?.display_name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold truncate">{post.author?.display_name ?? "Unknown"}</span>
          <span className="text-muted-foreground truncate">@{post.author?.handle}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatDistanceToNowStrict(new Date(post.created_at))}</span>
        </div>
        {post.content && <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>}
        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-3 rounded-2xl border border-border max-h-[500px] w-full object-cover" />
        )}
        <div className="flex items-center gap-8 mt-3 text-muted-foreground text-sm">
          <button className="flex items-center gap-1.5 hover:text-primary transition">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 hover:text-emerald-400 transition">
            <Repeat2 className="w-4 h-4" />
          </button>
          <button onClick={toggleLike} className={`flex items-center gap-1.5 transition ${liked ? "text-rose-500" : "hover:text-rose-500"}`}>
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likeCount > 0 && likeCount}
          </button>
        </div>
      </div>
    </article>
  );
}
