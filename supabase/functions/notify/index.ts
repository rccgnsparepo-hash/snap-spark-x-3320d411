import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Body = {
  kind: 'post' | 'message' | 'story' | 'comment' | 'like';
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string; display_name?: string };
  data?: Record<string, unknown>;
  recipients?: string[];
  dedupe_id?: string;
};

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
const NOTIFY_WEBHOOK_URL = Deno.env.get('NOTIFY_WEBHOOK_URL');
// Absolute origin used to build clickable launch URLs for web push (cold start).
const APP_ORIGIN = (Deno.env.get('PUBLIC_APP_URL') ?? 'https://snap-spark-x.lovable.app').replace(/\/$/, '');

/** kind + resource -> in-app path. Mirrors src/lib/native/deepLink.ts. */
function pathFor(kind: Body['kind'], id?: string | null): string {
  switch (kind) {
    case 'message': return id ? `/messages/${id}` : '/messages';
    case 'story': return id ? `/?story=${encodeURIComponent(id)}` : '/';
    case 'post':
    case 'like':
    case 'comment': return id ? `/?post=${encodeURIComponent(id)}` : '/';
    default: return '/';
  }
}

const defaultTitle = (k: Body['kind'], who: string) => {
  switch (k) {
    case 'post': return `${who} just flicked`;
    case 'message': return `${who} sent a message`;
    case 'story': return `${who} posted a story`;
    case 'comment': return `${who} commented`;
    case 'like': return `${who} liked your flick`;
  }
};

/** POST with bounded exponential backoff; retries only on network errors / 5xx / 429. */
async function postWithRetry(url: string, init: RequestInit, attempts = 3): Promise<{ ok: boolean; body: string }> {
  let last = '';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      last = await res.text();
      if (res.ok) return { ok: true, body: last };
      if (res.status < 500 && res.status !== 429) return { ok: false, body: last };
    } catch (e) {
      last = String(e);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  console.error('[notify] delivery failed after retries', url, last);
  return { ok: false, body: last };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const who = body.actor?.display_name || body.actor?.handle || 'Someone';
    const title = body.title ?? defaultTitle(body.kind, who);
    const message = body.message ?? '';
    const payload = { kind: body.kind, title, message, url: body.url ?? null, actor: body.actor ?? null, data: body.data ?? {}, at: new Date().toISOString() };
    const tasks: Promise<unknown>[] = [];
    // NOTE: legacy VAPID web-push has been removed. OneSignal is the ONLY push provider
    // (installed PWA + browser + native Android), targeted by external_id = supabase user id.
    if (NOTIFY_WEBHOOK_URL) {
      tasks.push(postWithRetry(NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
    }
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      // Native push via OneSignal. Prefer targeted external_user_ids (= supabase user id)
      // when we have recipients; fall back to broadcast only when explicitly requested.
      const targets = (body.recipients ?? []).filter((r) => r && r !== body.actor?.id);
      const channelByKind: Record<string, string> = {
        message: 'messages', comment: 'messages',
        like: 'likes', post: 'posts', story: 'stories',
      };
      const androidChannel = channelByKind[body.kind] ?? 'posts';
      const resourceId = (body.data as { post_id?: string; story_id?: string; message_id?: string; news_id?: string } | undefined);
      const rid = resourceId?.post_id ?? resourceId?.story_id ?? resourceId?.message_id ?? resourceId?.news_id ?? null;
      const relPath = body.url && body.url.startsWith('/') ? body.url : pathFor(body.kind, rid);
      const launchUrl = body.url && /^https?:\/\//.test(body.url) ? body.url : `${APP_ORIGIN}${relPath}`;
      const deepLinkData = {
        type: body.kind,
        resourceId: rid,
        senderId: body.actor?.id ?? null,
        deepLink: relPath,
        title,
        body: message,
        timestamp: payload.at,
      };
      const osPayload: Record<string, unknown> = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message || title },
        web_url: launchUrl,
        app_url: `flick:/${relPath}`,
        data: deepLinkData,
        android_channel_id: androidChannel,
        collapse_id: body.dedupe_id ?? undefined,
      };
      if (targets.length) {
        // OneSignal v11 SDK uses aliases; older API accepts include_external_user_ids too.
        osPayload.include_aliases = { external_id: targets };
        osPayload.target_channel = 'push';
      } else {
        osPayload.included_segments = ['Subscribed Users'];
      }
      tasks.push(postWithRetry('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_API_KEY}` },
        body: JSON.stringify(osPayload),
      }));
    }
    const results = (await Promise.all(tasks)) as { ok: boolean }[];
    const delivered = results.filter((r) => r?.ok).length;
    return new Response(JSON.stringify({ ok: true, attempted: results.length, delivered }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});