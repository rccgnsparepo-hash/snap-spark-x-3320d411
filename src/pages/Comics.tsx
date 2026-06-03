import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search } from "lucide-react";
import { motion } from "framer-motion";

type Book = {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  subjects: string[];
  download_count: number;
};

const TOPICS = ["popular", "fiction", "adventure", "fantasy", "mystery", "comics"] as const;

export default function ComicsPage() {
  const [topic, setTopic] = useState<typeof TOPICS[number]>("popular");
  const [q, setQ] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = q.trim()
      ? `https://gutendex.com/books?search=${encodeURIComponent(q.trim())}`
      : topic === "popular"
        ? `https://gutendex.com/books?sort=popular`
        : `https://gutendex.com/books?topic=${topic}`;
    fetch(url).then((r) => r.json()).then((j) => {
      setBooks((j.results ?? []) as Book[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [topic, q]);

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 space-y-3">
        <h1 className="font-display text-2xl tracking-tight flex items-center gap-2"><BookOpen className="w-5 h-5 text-snap" /> Library</h1>
        <div className="flex items-center gap-2 bg-secondary rounded-full px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search free books, comics, novels…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TOPICS.map((t) => (
            <button key={t} onClick={() => { setQ(""); setTopic(t); }}
              className={`px-3 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap ${topic === t && !q ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </header>
      {loading ? (
        <p className="text-center py-20 text-muted-foreground">Loading library…</p>
      ) : books.length === 0 ? (
        <p className="text-center py-20 text-muted-foreground">No books found.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 pb-32">
          {books.map((b, i) => {
            const cover = b.formats["image/jpeg"];
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                <Link to={`/comics/${b.id}`} className="block group">
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-secondary">
                    {cover ? <img src={cover} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-muted-foreground"><BookOpen /></div>}
                  </div>
                  <p className="font-semibold text-sm mt-2 line-clamp-2">{b.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.authors[0]?.name ?? "Unknown"}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
