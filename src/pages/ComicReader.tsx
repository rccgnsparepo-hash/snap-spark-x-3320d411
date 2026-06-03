import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Type, Plus, Minus } from "lucide-react";

type Book = { id: number; title: string; authors: { name: string }[]; formats: Record<string, string> };

export default function ComicReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(1);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`https://gutendex.com/books/${id}`);
        const b = (await r.json()) as Book;
        setBook(b);
        const txtUrl = b.formats["text/plain; charset=utf-8"] || b.formats["text/plain"] || b.formats["text/html; charset=utf-8"] || b.formats["text/html"];
        if (txtUrl) {
          const proxied = `https://r.jina.ai/${txtUrl}`;
          const tr = await fetch(proxied);
          setText(await tr.text());
        } else {
          setText("This book has no readable text format available.");
        }
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading book…</div>;
  if (!book) return <div className="min-h-screen grid place-items-center text-muted-foreground">Book not found.</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <Link to="/comics"><ArrowLeft /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{book.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{book.authors[0]?.name ?? "Unknown"}</p>
        </div>
        <button onClick={() => setSize((s) => Math.max(0.85, s - 0.1))} className="p-2"><Minus className="w-4 h-4" /></button>
        <Type className="w-4 h-4 text-muted-foreground" />
        <button onClick={() => setSize((s) => Math.min(1.6, s + 0.1))} className="p-2"><Plus className="w-4 h-4" /></button>
      </header>
      <article className="prose prose-invert max-w-2xl mx-auto px-5 py-6 pb-40 whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${size}rem` }}>
        {text}
      </article>
    </div>
  );
}
