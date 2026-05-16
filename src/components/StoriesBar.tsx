import { useEffect, useState } from "react";
import { Plus, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type StoryRow = {
  id: string;
  image_url: string;
  media_type?: string | null;
  caption: string | null;
  created_at: string;
  expires_at?: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

export function StoriesBar({ onView }: { onView: (s: StoryRow) => void }) {
  const [stories, setStories] = useState<StoryRow[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("id, image_url, media_type, caption, created_at, expires_at, author:profiles!stories_author_id_fkey (id, handle, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(40);
    setStories((data ?? []) as unknown as StoryRow[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("stories-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stories" }, load)
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
      {stories.map((s) => (
        <button key={s.id} onClick={() => onView(s)} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="story-ring w-16 h-16">
            <div className="w-full h-full rounded-full bg-background p-0.5">
              <img src={s.image_url} alt="" className="w-full h-full rounded-full object-cover" />
            </div>
          </div>
          <span className="text-[11px] truncate max-w-[64px]">@{s.author?.handle ?? "user"}</span>
          {s.expires_at && (
            <span className="text-[9px] text-snap flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{timeLeft(s.expires_at)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h` : `${m}m`;
}

export type { StoryRow };
