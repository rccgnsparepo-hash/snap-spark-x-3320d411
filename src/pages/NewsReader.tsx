import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, RotateCw } from "lucide-react";
import { motion } from "framer-motion";

export default function NewsReaderPage() {
  const [params] = useSearchParams();
  const url = params.get("u") ?? "";
  const title = params.get("t") ?? "Article";
  const source = params.get("s") ?? "";
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, { headers: { "X-Return-Format": "markdown" } });
      if (!res.ok) throw new Error("Reader unavailable");
      const md = await res.text();
      setContent(md);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (url) load(); /* eslint-disable-next-line */ }, [url]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/news" className="p-2"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-snap font-bold truncate">{source}</div>
          <div className="text-sm font-semibold truncate">{title}</div>
        </div>
        <button onClick={load} className="p-2 text-muted-foreground" aria-label="Reload"><RotateCw className="w-4 h-4" /></button>
        <a href={url} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground" aria-label="Open original"><ExternalLink className="w-4 h-4" /></a>
      </header>
      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="px-5 py-6 max-w-none pb-32">
        <h1 className="font-display text-2xl mb-3">{title}</h1>
        {loading && <p className="text-muted-foreground">Fetching clean reader view…</p>}
        {error && <p className="text-destructive">Couldn't load reader: {error}. <a className="underline text-snap" href={url} target="_blank" rel="noreferrer">Open original ↗</a></p>}
        {!loading && !error && (
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground/90">{content}</pre>
        )}
      </motion.article>
    </>
  );
}