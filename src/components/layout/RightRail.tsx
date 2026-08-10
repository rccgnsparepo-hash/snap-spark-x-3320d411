import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, UserPlus } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null };
type NewsItem = { id: string; title: string; url: string; ts: number };

/** Secondary contextual column shown only on wide desktops (>=1280px). */
export function RightRail() {
  const { user, profile } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .neq("id", user.id)
      .limit(5)
      .then(({ data }) => { if (alive) setPeople((data ?? []) as Person[]); });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    fetch("https://hn.algolia.com/api/v1/search?tags=front_page")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setNews(
          (j.hits ?? []).slice(0, 5).map((h: { objectID: string; title: string; url: string | null; created_at_i: number }) => ({
            id: h.objectID,
            title: h.title,
            url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
            ts: h.created_at_i * 1000,
          })),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <aside className="hidden xl:block w-[320px] shrink-0 min-w-0 border-l border-border">
      <div className="sticky top-0 p-6 space-y-6">
        {profile && (
          <Link to="/profile" className="flex items-center gap-3 p-3 rounded-2xl card-glass">
            <Avatar url={profile.avatar_url} name={profile.display_name} size={44} />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{profile.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">@{profile.handle}</div>
            </div>
          </Link>
        )}

        {people.length > 0 && (
          <section>
            <h2 className="font-display text-sm mb-2 flex items-center gap-2 text-muted-foreground">
              <UserPlus className="w-4 h-4 text-snap" /> Suggested for you
            </h2>
            <div className="card-glass rounded-2xl divide-y divide-border/60">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 min-w-0">
                  <Link to={`/u/${p.handle}`}><Avatar url={p.avatar_url} name={p.display_name} size={36} /></Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/u/${p.handle}`} className="block text-sm font-semibold truncate">{p.display_name}</Link>
                    <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                  </div>
                  <Link to={`/u/${p.handle}`} className="text-[11px] font-bold text-snap shrink-0">View</Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {news.length > 0 && (
          <section>
            <h2 className="font-display text-sm mb-2 flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-snap" /> Today's news
            </h2>
            <div className="card-glass rounded-2xl divide-y divide-border/60">
              {news.map((n) => (
                <Link
                  key={n.id}
                  to={`/news/read?u=${encodeURIComponent(n.url)}&t=${encodeURIComponent(n.title)}`}
                  className="block px-3 py-2.5 hover:bg-secondary/30 min-w-0"
                >
                  <div className="text-[13px] font-semibold leading-snug line-clamp-2">{n.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNowStrict(new Date(n.ts))} ago · Hacker News
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/news" className="block text-xs text-snap font-semibold mt-2">See all news →</Link>
          </section>
        )}
      </div>
    </aside>
  );
}
