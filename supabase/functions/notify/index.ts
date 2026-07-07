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

const defaultTitle = (k: Body['kind'], who: string) => {
  switch (k) {
    case 'post': return `${who} just flicked`;
    case 'message': return `${who} sent a message`;
    case 'story': return `${who} posted a story`;
    case 'comment': return `${who} commented`;
    case 'like': return `${who} liked your flick`;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const who = body.actor?.display_name || body.actor?.handle || 'Someone';
    const title = body.title ?? defaultTitle(body.kind, who);
    const message = body.message ?? '';
    const payload = { kind: body.kind, title, message, url: body.url ?? null, actor: body.actor ?? null, data: body.data ?? {}, at: new Date().toISOString() };
    const tasks: Promise<unknown>[] = [];
    // Targeted web push to specific recipients (excludes the actor).
    if (body.recipients?.length) {
      const targets = body.recipients.filter((r) => r && r !== body.actor?.id);
      if (targets.length) {
        tasks.push(fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/web-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_ids: targets,
            title,
            body: message,
            url: body.url ?? '/',
            kind: body.kind,
            dedupe_id: body.dedupe_id ?? `${body.kind}:${body.actor?.id ?? ''}:${(body.data as { post_id?: string })?.post_id ?? ''}`,
            data: body.data ?? {},
          }),
        }).then((r) => r.text()).catch((e) => ({ err: String(e) })));
      }
    }
    if (NOTIFY_WEBHOOK_URL) {
      tasks.push(fetch(NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.text()).catch((e) => ({ err: String(e) })));
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
      const deepLinkData = {
        type: body.kind,
        resourceId: resourceId?.post_id ?? resourceId?.story_id ?? resourceId?.message_id ?? resourceId?.news_id ?? null,
        senderId: body.actor?.id ?? null,
        deepLink: body.url ?? null,
        title,
        body: message,
        timestamp: payload.at,
      };
      const osPayload: Record<string, unknown> = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message || title },
        url: body.url ?? undefined,
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
      tasks.push(fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_API_KEY}` },
        body: JSON.stringify(osPayload),
      }).then((r) => r.text()).catch((e) => ({ err: String(e) })));
    }
    const results = await Promise.all(tasks);
    return new Response(JSON.stringify({ ok: true, sent: results.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});