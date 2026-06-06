import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BIWfMYFZBQjZMYlW5k3-GSdKd9GMN0t7Q4H2oteK9DKRXvRXleCB4NUSHTMx5h6g-FgksmzDZ_QU3JtiiKPn4s8";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const inIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};
const isPreviewHost = () => {
  const h = location.hostname;
  return h.startsWith("id-preview--") || h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") || h.endsWith(".beta.lovable.dev");
};

let registering: Promise<ServiceWorkerRegistration | null> | null = null;

export async function ensurePushSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  if (inIframe() || isPreviewHost()) return null; // never register in preview
  if (registering) return registering;
  registering = navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch((e) => {
    console.warn("push SW register failed", e); return null;
  });
  return registering;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export async function requestAndSubscribePush(userId: string): Promise<boolean> {
  try {
    const reg = await ensurePushSW();
    if (!reg) return false;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const appKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let sub = await reg.pushManager.getSubscription();
    const existingKey = sub?.options.applicationServerKey ? bufToBase64Url(sub.options.applicationServerKey) : "";
    if (sub && existingKey && existingKey !== VAPID_PUBLIC_KEY) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId);
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey,
      });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
    const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));
    if (!endpoint || !p256dh || !auth) return false;

    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    return true;
  } catch (e) {
    console.warn("push subscribe failed", e);
    return false;
  }
}

/** Best-effort silent re-attach on login: only if permission already granted. */
export async function syncExistingPush(userId: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  await requestAndSubscribePush(userId);
}

export async function unsubscribePush(userId: string) {
  try {
    const reg = await ensurePushSW();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId);
      await sub.unsubscribe();
    }
  } catch (e) { console.warn("unsubscribe failed", e); }
}

// Listen for SW click→navigate messages
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener?.("message", (ev: MessageEvent) => {
    const data = ev.data as { type?: string; url?: string } | undefined;
    if (data?.type === "push-navigate" && data.url) {
      try {
        const u = new URL(data.url, location.origin);
        if (u.origin === location.origin) history.pushState({}, "", u.pathname + u.search + u.hash);
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch { /* noop */ }
    }
  });
}