import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export default function MessagesPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const { pathname } = useLocation();
  const showList = pathname === "/messages";

  const loadUnread = async () => {
    if (!user) return;
    const { data } = await supabase.from("messages").select("sender_id").eq("recipient_id", user.id).is("read_at", null).gt("expires_at", new Date().toISOString());
    const counts: Record<string, number> = {};
    (data ?? []).forEach((m: { sender_id: string }) => { counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1; });
    setUnread(counts);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").neq("id", user.id).limit(100).then(({ data }) => setPeople((data ?? []) as Profile[]));
    loadUnread();
    const ch = supabase.channel("dm-unread").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadUnread).subscribe();
    const cull = setInterval(loadUnread, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(cull); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = people.filter((p) => !q || p.handle.toLowerCase().includes(q.toLowerCase()) || p.display_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid md:grid-cols-[280px_1fr] min-h-screen">
      <aside className={`${showList ? "block" : "hidden md:block"} border-r border-border`}>
        <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border p-4">
          <h1 className="font-display text-2xl mb-3">DMs</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by handle"
              className="w-full bg-input rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="text-[11px] mt-2 text-snap">Messages disappear after 24h</p>
        </header>
        <ul>
          {filtered.map((p) => (
            <li key={p.id}>
              <Link to={`/messages/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 border-b border-border">
                <Avatar url={p.avatar_url} name={p.display_name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                </div>
                {unread[p.id] > 0 && <span className="bg-snap text-snap-foreground text-xs font-bold rounded-full px-2 py-0.5">{unread[p.id]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className={`${showList ? "hidden md:block" : "block"}`}>
        {pathname === "/messages" ? (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-10">
            <MessageCircle className="w-12 h-12 text-snap" />
            <p>Pick someone to start a disappearing chat.</p>
          </div>
        ) : <Outlet />}
      </section>
    </div>
  );
}
