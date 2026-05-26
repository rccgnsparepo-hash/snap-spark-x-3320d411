import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bookmark, Archive, Activity, Bell, Clock, Tablet, BarChart3, BadgeCheck, Settings, Lock, Star, Crosshair, Slash, EyeOff, Users, MessageSquare, AtSign, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Item = { icon: React.ComponentType<{ className?: string }>; label: string; sub?: string; danger?: boolean; onClick?: () => void };

export function ProfileSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const sections: { title: string; items: Item[] }[] = [
    { title: "How you use Flick", items: [
      { icon: Bookmark, label: "Saved" },
      { icon: Archive, label: "Archive" },
      { icon: Activity, label: "Your activity" },
      { icon: Bell, label: "Notifications" },
      { icon: Clock, label: "Time management" },
      { icon: Tablet, label: "Flick for tablets" },
    ]},
    { title: "For creators", items: [
      { icon: BarChart3, label: "Insights" },
      { icon: BadgeCheck, label: "Flick Verified", sub: "Not subscribed" },
      { icon: Settings, label: "Account tools" },
    ]},
    { title: "Who can see your content", items: [
      { icon: Lock, label: "Account privacy", sub: "Public" },
      { icon: Star, label: "Close Friends", sub: "0" },
      { icon: Crosshair, label: "Crossposting" },
      { icon: Slash, label: "Blocked", sub: "0" },
      { icon: EyeOff, label: "Hide story" },
      { icon: Users, label: "Activity in Friends feed" },
    ]},
    { title: "How others interact with you", items: [
      { icon: MessageSquare, label: "Messages and story replies" },
      { icon: AtSign, label: "Tags and mentions" },
    ]},
    { title: "Account", items: [
      { icon: LogOut, label: "Sign out", danger: true, onClick: signOut },
    ]},
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background flex flex-col">
          <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={onClose} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="font-display text-lg">Settings and activity</h1>
          </header>
          <div className="px-4 py-4">
            <input placeholder="Search" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm focus:outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto pb-10">
            {sections.map((sec) => (
              <div key={sec.title} className="mb-2">
                <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{sec.title}</div>
                <ul className="bg-card/40 border-y border-border">
                  {sec.items.map((it) => (
                    <li key={it.label}>
                      <button
                        onClick={() => (it.onClick ? it.onClick() : toast(`${it.label} coming soon`))}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition ${it.danger ? "text-destructive" : ""}`}>
                        <it.icon className="w-5 h-5" />
                        <span className="flex-1 text-left text-sm">{it.label}</span>
                        {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}