import { supabase } from "@/integrations/supabase/client";

export type NotifyKind = "post" | "message" | "story" | "comment" | "like";

export async function notify(input: {
  kind: NotifyKind;
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string | null; display_name?: string | null };
  data?: Record<string, unknown>;
  /** Specific recipients to drop into the in-app inbox. Empty/undefined = broadcast (just webhook/onesignal). */
  recipients?: string[];
}) {
  try {
    // In-app inbox rows (only for known recipients, never the actor themselves).
    if (input.recipients?.length) {
      const actorId = input.actor?.id ?? null;
      const who = input.actor?.display_name ?? input.actor?.handle ?? "Someone";
      const fallbackTitle =
        input.kind === "like" ? `${who} liked your flick`
        : input.kind === "comment" ? `${who} commented on your flick`
        : input.kind === "message" ? `${who} sent you a message`
        : input.kind === "story" ? `${who} posted a story`
        : input.kind === "post" ? `${who} just flicked`
        : `${who} updated something`;
      const rows = input.recipients
        .filter((r) => r && r !== actorId)
        .map((user_id) => ({
          user_id,
          actor_id: actorId,
          kind: input.kind,
          title: input.title ?? fallbackTitle,
          body: input.message ?? null,
          url: input.url ?? null,
          data: input.data ?? {},
        }));
      if (rows.length) await supabase.from("notifications").insert(rows);
    }
    await supabase.functions.invoke("notify", { body: input });
  } catch (e) {
    console.warn("notify failed", e);
  }
}