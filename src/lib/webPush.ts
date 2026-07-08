// OneSignal Web Push — the single push provider for browser + installed PWA.
// Backend sends via OneSignal REST using external_id = supabase user id.
// This module only initializes the SDK, prompts, and links external_id.

import { supabase } from "@/integrations/supabase/client";
import { ONESIGNAL_APP_ID } from "@/config/onesignal";

let initPromise: Promise<boolean> | null = null;

const inIframe = () => { try { return window.self !== window.top; } catch { return true; } };
const isPreviewHost = () => {
  const h = location.hostname;
  return (
    h.startsWith("id-preview--") || h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") || h.endsWith(".beta.lovable.dev")
  );
};
const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

/** Returns true if OneSignal is initialised and ready to talk to. */
export function initWebPush(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!supported() || inIframe() || isPreviewHost()) return false;
    if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID.length < 10) return false;
    try {
      const OneSignal = (await import("react-onesignal")).default;
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "OneSignalSDKWorker.js",
      });
      // Foreground: let notification show even when tab is focused.
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", (ev: unknown) => {
        // Do NOT preventDefault — display the OS toast anyway.
        try { window.dispatchEvent(new CustomEvent("flick:push-received", { detail: ev })); } catch { /* noop */ }
      });
      // Click routing — forward to the AppShell router.
      OneSignal.Notifications.addEventListener("click", (ev: unknown) => {
        const e = ev as { notification?: { additionalData?: unknown }; result?: { url?: string } };
        const url = e.result?.url;
        const data = (e.notification?.additionalData ?? {}) as Record<string, unknown>;
        window.dispatchEvent(new CustomEvent("flick:push-navigate", { detail: { url, data } }));
      });
      return true;
    } catch (e) {
      console.warn("[onesignal-web] init failed", e);
      return false;
    }
  })();
  return initPromise;
}

export async function requestWebPushPermission(): Promise<boolean> {
  const ok = await initWebPush();
  if (!ok) return false;
  try {
    const OneSignal = (await import("react-onesignal")).default;
    const perm = await OneSignal.Notifications.requestPermission();
    return !!perm;
  } catch (e) {
    console.warn("[onesignal-web] requestPermission failed", e);
    return false;
  }
}

/** Bind the current signed-in user to their OneSignal record + record touchpoint. */
export async function linkWebPushUser(userId: string) {
  const ok = await initWebPush();
  if (!ok || !userId) return;
  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.login(userId);
    // Best-effort: capture the subscription id so we can debug delivery per-device.
    const rawId = OneSignal.User?.PushSubscription?.id;
    const subId: string | undefined = typeof rawId === "string" ? rawId : undefined;
    if (subId) {
      await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: `onesignal-web:${subId}`,
        p256dh: "onesignal",
        auth: "onesignal",
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
    }
  } catch (e) {
    console.warn("[onesignal-web] login failed", e);
  }
}

export async function unlinkWebPushUser() {
  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.logout();
  } catch { /* noop */ }
}