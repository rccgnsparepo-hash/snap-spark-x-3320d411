import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { LogOut, Camera } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("posts").select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)").eq("author_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setPosts((data ?? []) as unknown as PostRow[]));
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

  return (
    <>
      <div className="h-32 bg-gradient-to-br from-primary/40 via-snap/30 to-transparent" />
      <div className="px-4 -mt-12">
        <div className="flex items-end justify-between">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative group rounded-full border-4 border-background overflow-hidden"
            aria-label="Change avatar"
          >
            <Avatar url={profile?.avatar_url} name={profile?.display_name} size={96} />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition grid place-items-center text-white opacity-0 group-hover:opacity-100">
              <Camera className="w-6 h-6" />
            </span>
            {busy && <span className="absolute inset-0 bg-black/60 grid place-items-center text-xs text-white">…</span>}
          </button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button onClick={signOut} className="px-4 py-1.5 rounded-full border border-border hover:bg-secondary text-sm flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
        <h1 className="text-2xl font-bold mt-3">{profile?.display_name}</h1>
        <p className="text-muted-foreground">@{profile?.handle}</p>
      </div>
      <div className="mt-6 border-t border-border">
        <div className="px-4 py-3 font-semibold border-b border-border">Your flicks</div>
        {posts.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nothing yet.</div> : posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </>
  );
}
