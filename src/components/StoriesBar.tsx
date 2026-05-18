import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";

export type StorySegment = {
  id: string;
  image_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  author: { id: string; handle: string; display_name: string; avatar_url: string | null };
  segments: StorySegment[];
};

type Row = {
  id: string;
  image_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

export function StoriesBar({ onView }: { onView: (groups: StoryGroup[], index: number) => void }) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("id, image_url, media_type, caption, created_at, expires_at, author:profiles!stories_author_id_fkey (id, handle, display_name, avatar_url)")
      .order("created_at", { ascending: true })
      .limit(200);
    const rows = (data ?? []) as unknown as Row[];
    const byAuthor = new Map<string, StoryGroup>();
    rows.forEach((r) => {
      if (!r.author) return;
      const g = byAuthor.get(r.author.id) ?? { author: r.author, segments: [] };
      g.segments.push({
        id: r.id, image_url: r.image_url, media_type: r.media_type,
        caption: r.caption, created_at: r.created_at, expires_at: r.expires_at,
      });
      byAuthor.set(r.author.id, g);
    });
    // newest authors first by latest segment
    setGroups([...byAuthor.values()].sort((a, b) =>
      new Date(b.segments[b.segments.length - 1].created_at).getTime() -
      new Date(a.segments[a.segments.length - 1].created_at).getTime()
    ));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("stories-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-4 no-scrollbar border-b border-border">
      <Link to="/stories/new" className="flex flex-col items-center gap-1.5 shrink-0 group">
        <div className="w-16 h-16 rounded-full bg-secondary border border-dashed border-snap grid place-items-center group-hover:bg-snap/10 transition">
          <Plus className="w-6 h-6 text-snap" />
        </div>
        <span className="text-[11px] text-muted-foreground">Your story</span>
      </Link>
      {groups.map((g, i) => (
        <button key={g.author.id} onClick={() => onView(groups, i)} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="story-ring w-16 h-16">
            <div className="w-full h-full rounded-full bg-background p-0.5 relative">
              <Avatar url={g.author.avatar_url} name={g.author.display_name} size={56} className="!rounded-full" />
              {g.segments.length > 1 && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-snap text-snap-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {g.segments.length}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] truncate max-w-[64px]">@{g.author.handle}</span>
        </button>
      ))}
    </div>
  );
}