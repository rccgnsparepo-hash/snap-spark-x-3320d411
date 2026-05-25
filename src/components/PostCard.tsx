import { Heart, MessageCircle, Repeat2, Send, X, Share2, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./Avatar";
import { Reactions } from "./Reactions";
import { ShareSheet } from "./ShareSheet";
import { VoiceMessage } from "./VoiceMessage";

export type PostRow = {
  id: string;
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

type Comment = {
  id: string; content: string; created_at: string; author_id: string;
  author: { handle: string; display_name: string; avatar_url: string | null } | null;
};

const COMMENT_SELECT = "id, content, created_at, author_id, author:profiles!comments_author_id_fkey (handle, display_name, avatar_url)";

export function PostCard({ post }: { post: PostRow }) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [reshareCount, setReshareCount] = useState(0);
  const [reshared, setReshared] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const refreshCounts = async () => {
    const [likes, reshares, comments] = await Promise.all([
      supabase.from("likes").select("user_id", { count: "exact" }).eq("post_id", post.id),
      supabase.from("reshares").select("user_id", { count: "exact" }).eq("post_id", post.id),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    ]);
    setLikeCount(likes.count ?? 0);
    setReshareCount(reshares.count ?? 0);
    setCommentCount(comments.count ?? 0);
    setLiked(!!likes.data?.some((d) => d.user_id === user?.id));
    setReshared(!!reshares.data?.some((d) => d.user_id === user?.id));
  };

  useEffect(() => {
    refreshCounts();
    const ch = supabase.channel(`post-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, refreshCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "reshares", filter: `post_id=eq.${post.id}` }, refreshCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` }, refreshCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleReshare = async () => {
    if (!user) return;
    if (reshared) {
      setReshared(false); setReshareCount((c) => c - 1);
      await supabase.from("reshares").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setReshared(true); setReshareCount((c) => c + 1);
      await supabase.from("reshares").insert({ user_id: user.id, post_id: post.id });
    }
  };

  const openComments = async () => {
    setShowComments(true);
    const { data } = await supabase.from("comments").select(COMMENT_SELECT).eq("post_id", post.id).order("created_at", { ascending: true });
    setComments((data ?? []) as unknown as Comment[]);
  };

  const sendComment = async () => {
    if (!user || !draft.trim()) return;
    const c = draft.trim();
    setDraft("");
    await supabase.from("comments").insert({ post_id: post.id, author_id: user.id, content: c });
    const { data } = await supabase.from("comments").select(COMMENT_SELECT).eq("post_id", post.id).order("created_at", { ascending: true });
    setComments((data ?? []) as unknown as Comment[]);
  };

  const mediaSrc = post.media_url ?? post.image_url;
  const dlName = mediaSrc ? mediaSrc.split("/").pop() || "flick-media" : "flick-media";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      whileHover={{ y: -2 }}
      className="px-4 py-3 border-b border-border hover:bg-secondary/20 transition flex gap-3"
    >
      <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold truncate">{post.author?.display_name ?? "Unknown"}</span>
          <span className="text-muted-foreground truncate">@{post.author?.handle}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatDistanceToNowStrict(new Date(post.created_at))}</span>
        </div>
        {post.content && <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>}
        {mediaSrc && (
          <div className="mt-3 relative group">
            {post.media_type === "video" && (
              <video
                src={mediaSrc}
                autoPlay muted loop playsInline controls
                className="rounded-2xl border border-border max-h-[520px] w-full bg-black"
              />
            )}
            {post.media_type === "audio" && (
              <div className="rounded-2xl border border-border bg-card p-3">
                <VoiceMessage src={mediaSrc} />
              </div>
            )}
            {(post.media_type === "image" || (!post.media_type && post.image_url)) && (
              <img src={mediaSrc} alt="" className="rounded-2xl border border-border max-h-[520px] w-full object-cover" loading="lazy" />
            )}
            <a
              href={mediaSrc}
              download={dlName}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition bg-background/80 backdrop-blur rounded-full p-2 border border-border"
              aria-label="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}
        <div className="flex items-center gap-6 mt-3 text-muted-foreground text-sm flex-wrap">
          <button onClick={openComments} className="flex items-center gap-1.5 hover:text-primary transition">
            <MessageCircle className="w-4 h-4" /> {commentCount > 0 && commentCount}
          </button>
          <button onClick={toggleReshare} className={`flex items-center gap-1.5 transition ${reshared ? "text-emerald-400" : "hover:text-emerald-400"}`}>
            <Repeat2 className="w-4 h-4" /> {reshareCount > 0 && reshareCount}
          </button>
          <button onClick={toggleLike} className={`flex items-center gap-1.5 transition ${liked ? "text-rose-500" : "hover:text-rose-500"}`}>
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likeCount > 0 && likeCount}
          </button>
          <Reactions postId={post.id} />
          <button onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 hover:text-snap transition ml-auto">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} postId={post.id} postPreview={post.content || "Check this flick"} />
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowComments(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl border border-border max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold">Comments</h3>
                <button onClick={() => setShowComments(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {comments.length === 0 && <p className="text-center text-muted-foreground text-sm">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 text-sm">
                    <Avatar url={c.author?.avatar_url} name={c.author?.display_name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{c.author?.display_name ?? "User"}</span>
                        <span className="text-muted-foreground text-xs">@{c.author?.handle}</span>
                        <span className="text-muted-foreground text-xs">· {formatDistanceToNowStrict(new Date(c.created_at))}</span>
                      </div>
                      <p className="break-words">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendComment(); }} className="p-3 border-t border-border flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="flex-1 bg-input rounded-full px-4 py-2 focus:outline-none" />
                <button type="submit" disabled={!draft.trim()} className="w-10 h-10 rounded-full bg-snap text-snap-foreground grid place-items-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
