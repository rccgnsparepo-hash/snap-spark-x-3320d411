// Push readiness: permission prompt + live enabled/disabled indicator.
import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { initWebPush, requestWebPushPermission, linkWebPushUser } from "@/lib/webPush";
import { isNativePlatform } from "@/lib/native/platform";
import { useAuth } from "@/lib/auth";

type Status = "unsupported" | "default" | "granted" | "denied";

function readPermission(): Status {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as Status;
}

export function PushStatusCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>(readPermission);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setStatus(readPermission()), []);

  useEffect(() => {
    refresh();
    void initWebPush();
    const onVis = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const ok = await requestWebPushPermission();
      refresh();
      if (ok) {
        if (user?.id) await linkWebPushUser(user.id);
        toast.success("Push notifications enabled");
      } else if (readPermission() === "denied") {
        toast.error("Blocked — enable notifications in your browser site settings");
      } else {
        toast("Push isn't available in this preview — open the published app");
      }
    } finally {
      setBusy(false);
    }
  };

  const meta = {
    granted: { label: "Enabled", tone: "text-snap", Icon: BellRing, sub: "You'll receive push notifications" },
    denied: { label: "Blocked", tone: "text-destructive", Icon: BellOff, sub: "Allow notifications in browser site settings" },
    default: { label: "Disabled", tone: "text-muted-foreground", Icon: Bell, sub: "Turn on to get DMs, likes and mentions" },
    unsupported: { label: "Unsupported", tone: "text-muted-foreground", Icon: BellOff, sub: isNativePlatform() ? "Handled by the app settings" : "This browser can't receive web push" },
  }[status];

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-3">
        <meta.Icon className={`w-5 h-5 ${meta.tone}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            Push notifications
            <span className={`text-[10px] uppercase tracking-wider ${meta.tone}`}>{meta.label}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.sub}</p>
        </div>
        {status !== "granted" && status !== "unsupported" && (
          <button
            onClick={enable}
            disabled={busy || status === "denied"}
            className="shrink-0 rounded-full bg-snap text-snap-foreground text-xs font-semibold px-4 py-2 disabled:opacity-50 flex items-center gap-1.5">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === "denied" ? "Blocked" : "Enable"}
          </button>
        )}
      </div>
    </div>
  );
}
