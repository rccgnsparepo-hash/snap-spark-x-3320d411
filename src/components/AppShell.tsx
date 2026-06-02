import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, MessageCircle, User, LogOut, BookOpen, Newspaper, Plus, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { AnimatedBg } from "./AnimatedBg";
import { AnimatePresence, motion } from "framer-motion";
import { CoachMark } from "./CoachMark";
import { NotificationsInbox } from "./NotificationsInbox";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const tabs: { to: string; icon: typeof Home; label: string; center?: boolean }[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/news", icon: Newspaper, label: "News" },
  { to: "/stories/new", icon: Plus, label: "Post", center: true },
  { to: "/messages", icon: MessageCircle, label: "DMs" },
  { to: "/profile", icon: User, label: "Me" },
];

export function AppShell() {
  const { pathname } = useLocation();
  const { profile, signOut, user } = useAuth();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).is("read_at", null);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel(`inbox-count-${user.id}`).on("postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row relative bg-background">
      <AnimatedBg />
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border p-6 sticky top-0 h-screen bg-background/80 backdrop-blur z-20">
        <Link to="/" className="font-display text-3xl mb-10 tracking-tight">flick<span className="text-snap">.</span></Link>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            return (
              <Link key={t.to} to={t.to}
                className={`flex items-center gap-4 px-4 py-3 rounded-full text-lg transition ${
                  active ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
                }`}>
                <t.icon className="w-6 h-6" /> {t.label}
              </Link>
            );
          })}
          <Link to="/comics" className="flex items-center gap-4 px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60">
            <BookOpen className="w-6 h-6" /> Comics
          </Link>
          <Link to="/camera" className="flex items-center gap-4 px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60">
            <Plus className="w-6 h-6" /> Camera
          </Link>
          <button onClick={() => setInboxOpen(true)} className="flex items-center gap-4 px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60 text-left relative">
            <Bell className="w-6 h-6" /> Notifications
            {unread > 0 && <span className="ml-auto bg-snap text-snap-foreground text-xs font-bold rounded-full px-2 py-0.5">{unread > 99 ? "99+" : unread}</span>}
          </button>
        </nav>
        <div className="mt-auto flex items-center gap-3 p-3 rounded-2xl border border-border">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate text-sm">{profile?.display_name}</div>
            <div className="text-xs text-muted-foreground truncate">@{profile?.handle}</div>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 max-w-2xl w-full mx-auto border-x border-border min-h-[100dvh] pb-32 md:pb-0 bg-background relative z-10">
        {/* Mobile top bar — bell only (logo & nav live in bottom dock) */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-background/85 backdrop-blur border-b border-border">
          <Link to="/" className="font-display text-xl tracking-tight">flick<span className="text-snap">.</span></Link>
          <button onClick={() => setInboxOpen(true)} className="relative w-9 h-9 rounded-full bg-secondary grid place-items-center" aria-label="Notifications">
            <Bell className="w-4 h-4" />
            {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-snap text-snap-foreground text-[10px] font-bold grid place-items-center">{unread > 99 ? "99+" : unread}</span>}
          </button>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile floating dock (image 1 inspired) */}
      <nav className="md:hidden fixed bottom-4 inset-x-3 z-40 pointer-events-none">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto mx-auto max-w-md card-glass rounded-[28px] px-2 py-1.5 grid grid-cols-5 items-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]"
          style={{ background: "linear-gradient(160deg, rgba(20,22,28,0.92), rgba(8,9,12,0.88))" }}
        >
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to === "/stories/new" && pathname.startsWith("/stories")) || (t.to !== "/" && t.to !== "/stories/new" && pathname.startsWith(t.to));
            if (t.center) {
              return (
                <Link key={t.to} to={t.to} className="flex flex-col items-center -mt-7 relative">
                  <motion.div whileTap={{ scale: 0.9 }}
                    className="w-14 h-14 rounded-full grid place-items-center shadow-[0_0_30px_rgba(180,255,80,0.5)]"
                    style={{ background: "radial-gradient(circle at 30% 30%, oklch(0.95 0.18 130), oklch(0.7 0.22 150))" }}>
                    <t.icon className="w-6 h-6 text-snap-foreground" />
                  </motion.div>
                  <span className="text-[9px] uppercase tracking-wider mt-1 text-foreground/80">{t.label}</span>
                </Link>
              );
            }
            return (
              <Link key={t.to} to={t.to} data-coach={t.to === "/messages" ? "coach-dm" : t.to === "/profile" ? "coach-profile" : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 transition ${active ? "text-foreground" : "text-muted-foreground/70"}`}>
                <motion.div whileTap={{ scale: 0.85 }}>
                  <t.icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(180,255,80,0.7)]" : ""}`} />
                </motion.div>
                <span className="text-[9px] uppercase tracking-wider">{t.label}</span>
                {active && (
                  <motion.span layoutId="navdot" className="absolute -bottom-0.5 w-6 h-1 rounded-full bg-snap"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </Link>
            );
          })}
        </motion.div>
      </nav>
      <CoachMark />
      <NotificationsInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
    </div>
  );
}
