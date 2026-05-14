import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export const Route = createFileRoute("/_app/messages")({
  head: () => ({ meta: [{ title: "DMs — Flick" }] }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const { pathname } = useLocation();
  const showList = pathname === "/messages";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").neq("id", user.id).limit(50)
      .then(({ data }) => setPeople((data ?? []) as Profile[]));
  }, [user]);

  const filtered = people.filter((p) => !q || p.handle.toLowerCase().includes(q.toLowerCase()) || p.display_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid md:grid-cols-[280px_1fr] min-h-screen">
      <aside className={`${showList ? "block" : "hidden md:block"} border-r border-border`}>
        <header className="sticky top-0 bg-background/80 backdrop-blur border-b border-border p-4">
          <h1 className="font-display text-2xl mb-3">DMs</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people"
              className="w-full bg-input rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="text-[11px] mt-2 text-snap">Messages disappear after 24h</p>
        </header>
        <ul>
          {filtered.map((p) => (
            <li key={p.id}>
              <Link to="/messages/$userId" params={{ userId: p.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 border-b border-border">
                <div className="w-11 h-11 rounded-full bg-snap text-snap-foreground grid place-items-center font-bold">
                  {p.display_name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className={`${showList ? "hidden md:block" : "block"}`}>
        <Outlet />
      </section>
    </div>
  );
}
