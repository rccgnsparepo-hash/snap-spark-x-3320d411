import { supabase } from "@/integrations/supabase/client";

export type NotifyKind = "post" | "message" | "story" | "comment" | "like";

export async function notify(input: {
  kind: NotifyKind;
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string | null; display_name?: string | null };
  data?: Record<string, unknown>;
}) {
  try {
    await supabase.functions.invoke("notify", { body: input });
  } catch (e) {
    console.warn("notify failed", e);
  }
}