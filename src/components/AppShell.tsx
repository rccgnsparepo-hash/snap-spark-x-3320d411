import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, Camera, MessageCircle, User, LogOut, Sparkles, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { AnimatedBg } from "./AnimatedBg";
import { AnimatePresence, motion } from "framer-motion";

const tabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/camera", icon: Camera, label: "Camera" },
  { to: "/challenges", icon: Sparkles, label: "Daily" },
  { to: "/messages", icon: MessageCircle, label: "DMs" },
  { to: "/profile", icon: User, label: "Me" },
] as const;

export function AppShell() {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      <AnimatedBg />
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border p-6 sticky top-0 h-screen">
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
      <main className="flex-1 max-w-2xl w-full mx-auto border-x border-border min-h-screen pb-24 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur">
        <motion.div
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-5"
        >
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            return (
              <Link key={t.to} to={t.to}
                className={`relative flex flex-col items-center gap-1 py-3 transition ${active ? "text-snap" : "text-muted-foreground"}`}>
                {active && (
                  <motion.span
                    layoutId="navdot"
                    className="absolute top-1 w-8 h-8 rounded-full bg-snap/15"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <t.icon className="w-6 h-6 relative" />
                <span className="text-[10px] uppercase tracking-wider">{t.label}</span>
              </Link>
            );
          })}
        </motion.div>
      </nav>
    </div>
  );
}
