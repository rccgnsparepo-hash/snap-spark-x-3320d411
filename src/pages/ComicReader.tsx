import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

type Comic = { id: string; title: string; pages: string[] };

export default function ComicReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [comic, setComic] = useState<Comic | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!id) return;
    supabase.from("comics").select("id,title,pages").eq("id", id).maybeSingle().then(({ data }) => setComic(data as Comic | null));
  }, [id]);
  if (!comic) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 text-white border-b border-white/10">
        <Link to="/comics"><ArrowLeft /></Link>
        <h1 className="font-semibold flex-1 truncate">{comic.title}</h1>
        <span className="text-xs">{page + 1}/{comic.pages.length}</span>
      </header>
      <div className="flex-1 grid place-items-center p-4">
        {comic.pages[page] ? <img src={comic.pages[page]} alt="" className="max-h-[80vh] max-w-full object-contain" /> : <p className="text-white">No pages</p>}
      </div>
      <div className="flex justify-between p-4 text-white">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="p-2 disabled:opacity-30"><ChevronLeft /></button>
        <button disabled={page >= comic.pages.length - 1} onClick={() => setPage(page + 1)} className="p-2 disabled:opacity-30"><ChevronRight /></button>
      </div>
    </div>
  );
}
