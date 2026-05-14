import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Flick" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("posts")
      .select("id, content, image_url, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
      .eq("author_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setPosts((data ?? []) as unknown as PostRow[]));
  }, [user]);

  return (
    <>
      <div className="h-32 bg-gradient-to-br from-primary/40 via-snap/30 to-transparent" />
      <div className="px-4 -mt-12">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold text-3xl border-4 border-background">
            {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <button onClick={signOut}
            className="px-4 py-1.5 rounded-full border border-border hover:bg-secondary text-sm flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <h1 className="text-2xl font-bold mt-3">{profile?.display_name}</h1>
        <p className="text-muted-foreground">@{profile?.handle}</p>
        {profile?.bio && <p className="mt-3">{profile.bio}</p>}
      </div>
      <div className="mt-6 border-t border-border">
        <div className="px-4 py-3 font-semibold border-b border-border">Your flicks</div>
        {posts.length === 0
          ? <div className="text-center py-12 text-muted-foreground">Nothing yet.</div>
          : posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </>
  );
}
