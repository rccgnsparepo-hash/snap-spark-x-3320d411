import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

type Comic = { id: string; title: string; author: string | null; cover_url: string; description: string | null };

export default function ComicsPage() {
  const [comics, setComics] = useState<Comic[]>([]);
  useEffect(() => {
    supabase.from("comics").select("id,title,author,cover_url,description").order("created_at", { ascending: false }).then(({ data }) => setComics((data ?? []) as Comic[]));
  }, []);
  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl tracking-tight flex items-center gap-2"><BookOpen className="w-5 h-5 text-snap" /> Comics zone</h1>
      </header>
      {comics.length === 0 ? (
        <p className="text-center py-20 text-muted-foreground">No comics yet. Add some via your backend.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
          {comics.map((c) => (
            <Link key={c.id} to={`/comics/${c.id}`} className="block group">
              <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-secondary"><img src={c.cover_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition" /></div>
              <p className="font-semibold text-sm mt-2 truncate">{c.title}</p>
              {c.author && <p className="text-xs text-muted-foreground truncate">{c.author}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
