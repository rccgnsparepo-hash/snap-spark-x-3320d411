import { supabase } from "@/integrations/supabase/client";

// Native push (Capacitor) initializer. No-op on web — web push lives in `push.ts`.
// The plugin is imported dynamically so the web bundle never pulls in native code.
let initialized = false;

function isNative(): boolean {
  // Capacitor injects `window.Capacitor` when running inside the native shell.
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export async function initNativePush(userId: string) {
  if (initialized || !isNative()) return;
  initialized = true;
  try {
    const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
      import("@capacitor/push-notifications"),
      import("@capacitor/local-notifications"),
    ]);

    // Permissions
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await LocalNotifications.requestPermissions();
    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      // Store native FCM/APNs token alongside web-push subs so the notify function can fan out.
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: `native:${token.value}`,
          p256dh: "native",
          auth: token.value,
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[nativePush] registration error", err);
    });

    // Local fallback while app is foregrounded.
    PushNotifications.addListener("pushNotificationReceived", async (n) => {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1_000_000),
            title: n.title ?? "flick",
            body: n.body ?? "",
            extra: n.data,
          },
        ],
      });
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = (action.notification.data as { url?: string } | undefined)?.url;
      if (url) window.location.assign(url);
    });
  } catch (err) {
    console.warn("[nativePush] init failed", err);
  }
}