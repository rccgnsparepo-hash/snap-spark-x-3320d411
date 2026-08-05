import { supabase } from "@/integrations/supabase/client";

export type NotifyKind = "post" | "message" | "story" | "comment" | "like" | "mention";

export type NotifyInput = {
  kind: NotifyKind;
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string | null; display_name?: string | null };
  data?: Record<string, unknown>;
  /** Specific recipients to drop into the in-app inbox. Empty/undefined = broadcast (just webhook/onesignal). */
  recipients?: string[];
  /** Optional stable dedupe id so the same logical event won't show twice. */
  dedupe_id?: string;
};

/* ---------- Offline queue: notifications never get silently dropped ---------- */

const QUEUE_KEY = "flick:notify-queue";
const readQueue = (): NotifyInput[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as NotifyInput[];
  } catch {
    return [];
  }
};
const writeQueue = (q: NotifyInput[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50)));
  } catch {
    /* noop */
  }
};
const enqueue = (input: NotifyInput) => writeQueue([...readQueue(), input]);

let flushing = false;
/** Drain queued notifications (called on reconnect and after each successful send). */
export async function flushNotifyQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const queue = readQueue();
    if (!queue.length) return;
    writeQueue([]);
    const failed: NotifyInput[] = [];
    for (const item of queue) {
      const ok = await send(item, 2);
      if (!ok) failed.push(item);
    }
    if (failed.length) writeQueue([...failed, ...readQueue()]);
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushNotifyQueue();
  });
}

/** Invoke the push gateway with bounded exponential-backoff retries. */
async function send(input: NotifyInput, attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabase.functions.invoke("notify", {
        body: { ...input, recipients: input.recipients ?? [] },
      });
      if (!error) return true;
    } catch {
      /* retry */
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  return false;
}

export async function notify(input: NotifyInput) {
  try {
    // In-app inbox rows (only for known recipients, never the actor themselves).
    if (input.recipients?.length) {
      const actorId = input.actor?.id ?? null;
      const who = input.actor?.display_name ?? input.actor?.handle ?? "Someone";
      const fallbackTitle =
        input.kind === "like"
          ? `${who} liked your flick`
          : input.kind === "comment"
            ? `${who} commented on your flick`
            : input.kind === "message"
              ? `${who} sent you a message`
              : input.kind === "story"
                ? `${who} posted a story`
                : input.kind === "post"
                  ? `${who} just flicked`
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
          data: { ...(input.data ?? {}), dedupe_id: input.dedupe_id ?? null } as never,
        }));
      if (rows.length) await supabase.from("notifications").insert(rows);
    }
    if (!navigator.onLine) {
      enqueue(input);
      return;
    }
    const ok = await send(input);
    if (!ok) enqueue(input);
    else void flushNotifyQueue();
  } catch (e) {
    console.warn("notify failed", e);
    enqueue(input);
  }
}
