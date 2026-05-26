import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bell, Search, Bookmark } from "lucide-react";

type Item = { id: string; title: string; url: string; source: string; image: string | null; ts: number; summary: string };

const SOURCES = ["For You", "Top", "Tech", "World"] as const;

async function fetchHN(): Promise<Item[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
  const j = await res.json();
  return (j.hits ?? []).map((h: { objectID: string; title: string; url: string | null; created_at_i: number; story_text?: string }) => ({
    id: `hn-${h.objectID}`,
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "Hacker News",
    image: null,
    ts: h.created_at_i * 1000,
    summary: h.story_text ?? "",
  }));
}

async function fetchSpaceflight(): Promise<Item[]> {
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=20");
  const j = await res.json();
  return (j.results ?? []).map((a: { id: number; title: string; url: string; news_site: string; image_url: string; published_at: string; summary: string }) => ({
    id: `sf-${a.id}`,
    title: a.title,
    url: a.url,
    source: a.news_site,
    image: a.image_url,
    ts: +new Date(a.published_at),
    summary: a.summary,
  }));
}

async function fetchReddit(sub: string): Promise<Item[]> {
  const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=20`);
  const j = await res.json();
  return (j?.data?.children ?? []).map((c: { data: { id: string; title: string; url: string; subreddit_name_prefixed: string; thumbnail: string; created_utc: number; selftext: string; preview?: { images: { source: { url: string } }[] } } }) => {
    const d = c.data;
    const img = d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") || (d.thumbnail?.startsWith("http") ? d.thumbnail : null);
    return { id: `rd-${d.id}`, title: d.title, url: d.url, source: d.subreddit_name_prefixed, image: img, ts: d.created_utc * 1000, summary: d.selftext ?? "" };
  });
}

export default function NewsPage() {
  const [tab, setTab] = useState<typeof SOURCES[number]>("For You");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const loaders: Promise<Item[]>[] =
      tab === "Top" ? [fetchHN()]
      : tab === "Tech" ? [fetchHN(), fetchReddit("technology")]
      : tab === "World" ? [fetchReddit("worldnews")]
      : [fetchHN(), fetchSpaceflight(), fetchReddit("worldnews")];
    Promise.all(loaders.map((p) => p.catch(() => [] as Item[]))).then((groups) => {
      setItems(groups.flat().sort((a, b) => b.ts - a.ts));
      setLoading(false);
    });
  }, [tab]);

  const filtered = q.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()) || i.source.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight">News <span className="tape-lime">live</span></h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Stay informed without leaving Flick.</p>
        </div>
        <button aria-label="Notifications" className="relative w-10 h-10 rounded-full bg-secondary grid place-items-center">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-snap animate-pulse" />
        </button>
      </header>
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news…" className="bg-transparent flex-1 text-sm focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4">
        {SOURCES.map((s) => (
          <motion.button key={s} whileTap={{ scale: 0.94 }} onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === s ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"}`}>
            {s}
          </motion.button>
        ))}
      </div>
      <div className="px-4 pb-32 space-y-3">
        {loading && <div className="text-center text-muted-foreground py-10">Loading the wire…</div>}
        {!loading && filtered.length === 0 && <div className="text-center text-muted-foreground py-10">No headlines yet.</div>}
        {filtered.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
            <Link to={`/news/read?u=${encodeURIComponent(item.url)}&t=${encodeURIComponent(item.title)}&s=${encodeURIComponent(item.source)}`}
              className="block card-glass rounded-3xl overflow-hidden hover:ring-1 hover:ring-snap/40 transition">
              {item.image && (
                <div className="h-40 bg-secondary overflow-hidden">
                  <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-snap font-bold">
                  <span>{item.source}</span>
                  <span className="text-muted-foreground normal-case font-normal">· {new Date(item.ts).toLocaleDateString()}</span>
                </div>
                <h2 className="font-display text-lg mt-1.5 leading-snug">{item.title}</h2>
                {item.summary && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.summary}</p>}
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-snap font-semibold">Read inside →</span>
                  <Bookmark className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </>
  );
}